const Preferences = require('../models/OpportunityPreferences');
const { fail, text, revision } = require('./resumeContent');
const { assessMatch } = require('./requirementMatching');
const structure = require('./resumeStructure');
const { plain } = require('../providers/resumeFacts');
const { refreshSkillConflicts } = require('../providers/skillConflicts');
const defaults = { roles: [], locations: [], workModes: [], avoidCompanies: [], revision: 0 };
const normalize = (value) => String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
const contains = (text, term) => (' ' + normalize(text).replace(/[^\p{L}\p{N}+#]+/gu, ' ') + ' ').includes(' ' + normalize(term).replace(/[^\p{L}\p{N}+#]+/gu, ' ') + ' ');
function preferenceMatch(source, value) {
  if (!contains(source, value)) return false;
  const term = normalize(value).replace(/[^\p{L}\p{N}+#]+/gu, ' ').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ +/g, '\\s+');
  const clauses = normalize(source).split(/[.!?;\n]+/);
  // A plain mention is only provisional support. Explicit denial or conflicting
  // wording withholds credit rather than turning a negated preference into a match.
  const before = new RegExp('\\b(?:no|not|never|without|excluding|except)\\b(?:\\s+[\\p{L}-]+){0,4}\\s+' + term + '(?![\\p{L}\\p{N}+#])', 'u');
  const after = new RegExp('(?:^|[^\\p{L}\\p{N}+#])' + term + '\\s+(?:(?:work|working|roles?|options?)\\s+)?(?:(?:is|are)\\s+)?(?:not\\s+(?:available|offered|supported|permitted)|unavailable|excluded|prohibited)\\b', 'u');
  return !clauses.some((clause) => before.test(clause) || after.test(clause));
}
async function get(owner) { return await Preferences.findOne({ owner }).lean() || { ...defaults }; }
async function save(owner, input) {
  if (!input || typeof input !== 'object' || Object.keys(input).some((key) => !['roles', 'locations', 'workModes', 'avoidCompanies', 'revision'].includes(key))) throw fail('Unsupported opportunity preference');
  const data = Object.fromEntries(['roles', 'locations', 'workModes', 'avoidCompanies'].map((key) => {
    if (!Array.isArray(input[key]) || input[key].length > 20) throw fail('Choose at most 20 values for ' + key);
    return [key, [...new Set(input[key].map((item) => text(item, key, 120)).filter(Boolean))]];
  }));
  if (data.workModes.some((mode) => !['remote', 'hybrid', 'onsite'].includes(mode))) throw fail('Choose remote, hybrid or onsite');
  const expected = revision(input.revision);
  if (!expected) {
    try { return await Preferences.create({ owner, ...data }); }
    catch (error) { if (error.code === 11000) throw fail('Preferences changed elsewhere. Reload before saving.', 409); throw error; }
  }
  const result = await Preferences.findOneAndUpdate({ owner, revision: expected }, { $set: data, $inc: { revision: 1 } }, { new: true, runValidators: true });
  if (!result) throw fail('Preferences changed elsewhere. Reload before saving.', 409);
  return result;
}
function rank(workspace, preferences, resume, facts = []) {
  let content = resume ? structure.selectedContent(resume, workspace.resumeSelection) : {};
  const citations = [];
  // A selected resume scopes entry-specific facts. Imported or historical facts must still
  // reference the current source revision; independent confirmed manual facts are usable too.
  const usable = facts.filter((item) => {
    if (item.verification !== 'confirmed' || item.archivedAt) return false;
    if (item.context?.recordId && String(item.context.recordId) !== String(resume?._id || '')) return false;
    if (item.context?.entryId) {
      if (!['projects', 'workExperience'].includes(item.context.section)) return false;
      if (!content[item.context.section]?.some((entry) => entry.entryId === item.context.entryId)) return false;
    }
    if (item.source?.resumeId) return String(item.source.resumeId) === String(resume?._id || '') && item.source.revision === (resume?.contentRevision || 1);
    return item.source?.kind === 'manual' && !item.source?.profileId && !item.source?.sourceId;
  });
  if (usable.length) {
    content = plain(content);
    content.workExperience = [...(content.workExperience || []), ...usable.map((item, index) => {
      citations.push({ path: 'workExperience[' + ((content.workExperience || []).length + index) + '].highlights[0]', evidenceId: String(item._id), title: item.title, quote: item.statement, verification: 'confirmed' });
      return { highlights: [item.statement] };
    })];
    content = refreshSkillConflicts(content, content);
  }
  const report = assessMatch({ resumeData: content, jobDescriptionText: workspace.description, targetRole: workspace.title });
  const rows = report.requirementMatches.filter((row) => /_skill$/.test(row.category));
  const weight = rows.reduce((sum, row) => sum + row.weight, 0);
  let possible = weight ? 60 : 0, earned = weight ? rows.filter((row) => row.status === 'supported').reduce((sum, row) => sum + row.weight, 0) / weight * 60 : 0;
  const reasons = [], concerns = [];
  if (weight) reasons.push({ label: 'Career evidence covers ' + rows.filter((row) => row.status === 'supported').length + ' of ' + rows.length + ' recognized skill requirements', points: Math.round(earned), possible: 60 });
  else concerns.push('No recognized skill requirements; review the description manually.');
  if (!resume) concerns.push('No resume selected; only independent confirmed career facts can contribute evidence.');
  else if (!resume.verifiedAt) concerns.push('Selected resume is self-reported and has not been verified by you.');
  const criteria = (values, label, points, source) => {
    if (!values?.length) return;
    possible += points; const matches = values.filter((value) => preferenceMatch(source, value));
    if (matches.length) { earned += points; reasons.push({ label: label + ': ' + matches.join(', '), points, possible: points }); }
    else { reasons.push({ label: label + ': no explicit match in the saved job text', points: 0, possible: points }); concerns.push('Confirm ' + label.toLowerCase() + ' with the employer.'); }
  };
  criteria(preferences.roles, 'Preferred role', 20, workspace.title);
  criteria(preferences.locations, 'Preferred location', 10, workspace.description);
  const modeText = workspace.description.replace(/on[ -]site/ig, 'onsite');
  criteria(preferences.workModes, 'Preferred work arrangement', 10, modeText);
  const deprioritized = preferences.avoidCompanies?.some((company) => normalize(company) === normalize(workspace.company)) || false;
  if (deprioritized) concerns.unshift('Company is on your avoid list; placed after other opportunities.');
  const missing = rows.filter((row) => row.status !== 'supported').map((row) => row.label);
  if (missing.length) concerns.push('Skill evidence to review: ' + missing.join(', '));
  const constraints = report.requirementMatches.filter((row) => !/_skill$/.test(row.category));
  if (constraints.length) concerns.push('Review experience and job constraints separately: ' + constraints.map((row) => row.label).join('; '));
  return { workspace, score: possible ? Math.round(earned / possible * 100) : null, deprioritized, reasons, concerns,
    evidence: rows.filter((row) => row.status === 'supported').map((row) => ({ skill: row.label, citations: row.supportingEvidence.map((citation) => ({ ...citation, ...citations.find((item) => item.path === citation.path), ...(resume ? { resumeId: String(resume._id) } : {}) })) })),
    method: 'Weighted skill evidence (60), preferred role (20), location (10), work arrangement (10). Only configured and assessable criteria enter the denominator. Text matches require confirmation; this is a prioritization aid, not a hiring probability.' };
}
async function ranked(owner, state) {
  const [preferences, workspaces, resumes, facts] = await Promise.all([get(owner), require('./workspaceService').list(owner, state),
    require('../models/Resume').find({ owner, deleting: { $ne: true }, processingStatus: 'COMPLETED' }),
    require('../models/CareerEvidence').find({ owner, verification: 'confirmed', archivedAt: null }).limit(4000)]);
  const byId = new Map(resumes.map((resume) => [String(resume._id), resume]));
  const items = workspaces.map((workspace) => {
    try { return rank(workspace, preferences, byId.get(String(workspace.resumeId)), facts); }
    catch (error) { if (error.code !== 'SELECTION_STALE') throw error; return { workspace, score: null, deprioritized: false, reasons: [], evidence: [], concerns: ['Resume entries changed. Review this workspace’s resume selection before ranking.'] }; }
  }).sort((a, b) => Number(a.deprioritized) - Number(b.deprioritized) || (b.score ?? -1) - (a.score ?? -1) || String(a.workspace._id).localeCompare(String(b.workspace._id)));
  return { preferences, items };
}
module.exports = { get, save, rank, ranked };
