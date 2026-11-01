const crypto = require('node:crypto');
const Workspace = require('../models/JobWorkspace');
const Description = require('../models/JobDescription');
const { text, url, revision, fail } = require('./resumeContent');
const structure = require('./resumeStructure');
const manualSteps = { researchedCompany: 'Research the company', reviewedRequirements: 'Review the job requirements', preparedExamples: 'Prepare examples of your contribution' };
const norm = (value) => value.normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
function duplicateKey(value) {
  let key;
  if (value.jobUrl) {
    const parsed = new URL(value.jobUrl); parsed.hash = '';
    for (const name of [...parsed.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(name)) parsed.searchParams.delete(name);
    parsed.searchParams.sort(); key = parsed.href.replace(/\/$/, '');
  } else key = [value.company, value.title, value.description].map(norm).join('\n');
  return crypto.createHash('sha256').update(key).digest('hex');
}
const duplicateError = (item) => Object.assign(fail('This job is already saved. Open or restore the existing workspace.', 409), { code: 'DUPLICATE_WORKSPACE', details: { workspaceId: item._id, archived: Boolean(item.archivedAt) } });
async function get(id, owner) {
  const item = await Workspace.findOne({ _id: id, owner });
  if (!item) throw fail('Job workspace not found', 404);
  return item;
}
async function save(owner, input, id) {
  if (Object.keys(input).some((key) => !['company', 'title', 'jobUrl', 'description', 'notes', 'resumeId', 'resumeSelection', 'revision'].includes(key))) throw fail('Unsupported workspace field');
  const company = text(input.company, 'Company', 150), title = text(input.title, 'Role', 150), description = text(input.description, 'Job description', 24000);
  if (!company || !title || !description) throw fail('Company, role and job description are required');
  const notes = text(input.notes, 'Job notes', 10000), jobUrl = url(input.jobUrl, 'Job link');
  const resume = input.resumeId ? await require('./resumeService').getReadyResume(input.resumeId, owner) : null;
  const before = id ? await get(id, owner) : null;
  if (before?.archivedAt) throw fail('Restore this workspace before editing it.', 409);
  if (before && before.revision !== revision(input.revision)) throw fail('This job changed elsewhere. Resolve your draft against the latest version.', 409);
  const resumeSelection = resume ? structure.selection(input.resumeSelection === undefined && String(before?.resumeId) === String(resume._id) ? before.resumeSelection : input.resumeSelection, resume) : null;
  if (!resume && input.resumeSelection) throw fail('Choose a resume before selecting entries');
  const key = duplicateKey({ company, title, description, jobUrl });
  const candidates = await Workspace.find({ owner, ...(id ? { _id: { $ne: id } } : {}) }).select('company title description jobUrl duplicateKey archivedAt');
  const duplicate = candidates.find((item) => (item.duplicateKey || duplicateKey(item)) === key);
  if (duplicate) throw duplicateError(duplicate);
  const changed = !before || before.description !== description || before.title !== title || before.company !== company;
  const inputsChanged = changed || String(before?.resumeId || '') !== String(input.resumeId || '') || JSON.stringify(before?.resumeSelection || null) !== JSON.stringify(resumeSelection);
  const jd = changed ? await Description.create({ owner, company, targetRole: title, title: title + ' @ ' + company, rawText: description }) : null;
  const data = { company, title, description, notes, jobUrl, resumeSelection, duplicateKey: key, preparationRevision: before ? (before.preparationRevision || 1) + (inputsChanged ? 1 : 0) : 1, resumeId: input.resumeId || null, jobDescriptionId: jd?._id || before.jobDescriptionId };
  try {
    if (!before) return await Workspace.create({ owner, ...data });
    const updated = await Workspace.findOneAndUpdate({ _id: id, owner, revision: input.revision, archivedAt: null }, { $set: data, $inc: { revision: 1 }, ...(inputsChanged ? { $unset: { latestVersionId: 1, latestGapId: 1 } } : {}) }, { new: true, runValidators: true });
    if (!updated) throw fail('This job changed elsewhere. Resolve your draft against the latest version.', 409);
    return updated;
  } catch (error) {
    if (jd) await Description.deleteOne({ _id: jd._id });
    if (error.code === 11000) { const existing = await Workspace.findOne({ owner, duplicateKey: key }); if (existing) throw duplicateError(existing); }
    throw error;
  }
}
async function details(id, owner) {
  const workspace = await get(id, owner);
  const [versions, interviews, application, gap, resume, latestVersion] = await Promise.all([
    require('../models/TailoredResume').find({ owner, workspaceId: id }).sort({ createdAt: -1 }).select('version targetRole createdAt resumeId reviewedAt').lean(),
    require('../models/InterviewSession').find({ owner, workspaceId: id }).sort({ createdAt: -1 }),
    workspace.applicationId ? require('../models/Application').findOne({ _id: workspace.applicationId, owner }) : null,
    workspace.latestGapId ? require('../models/GapAnalysis').findOne({ _id: workspace.latestGapId, owner }) : null,
    workspace.resumeId ? require('../models/Resume').findOne({ _id: workspace.resumeId, owner, deleting: { $ne: true } }).select('verifiedAt contentRevision') : null,
    workspace.latestVersionId ? require('../models/TailoredResume').findOne({ _id: workspace.latestVersionId, owner }) : null,
  ]);
  const preparation = [
    { key: 'verifiedResume', label: 'Verify the selected resume', done: Boolean(resume?.verifiedAt), automatic: true, href: workspace.resumeId ? '/resume/' + workspace.resumeId + '/edit' : null },
    { key: 'reviewedResume', label: 'Review all AI resume suggestions', done: Boolean(latestVersion && String(latestVersion.resumeId) === String(workspace.resumeId) && latestVersion.sourceRevision === (resume?.contentRevision || 1) && require('./resumeReview').progress(latestVersion).complete), automatic: true, href: latestVersion ? '/resume/' + latestVersion.resumeId + '/tailor?version=' + latestVersion._id : null },
    { key: 'completedPractice', label: 'Complete a job-specific practice session', done: interviews.some((item) => item.status === 'completed' && (item.sourceRevision || 1) === (resume?.contentRevision || 1) && String(item.resumeId) === String(workspace.resumeId) && (item.workspaceRevision || 1) === (workspace.preparationRevision || 1)), automatic: true, href: '/interview/setup?workspace=' + id },
    ...Object.entries(manualSteps).map(([key, label]) => ({ key, label, done: workspace.preparation?.[key] === true, automatic: false })),
  ];
  return { workspace, versions, interviews: interviews.map((session) => require('./interviewVisibility').publicSession(session)), application, gap, preparation };
}
async function setArchived(id, owner, input, archived) {
  const expected = revision(input.revision);
  const result = await Workspace.findOneAndUpdate({ _id: id, owner, revision: expected }, { ...(archived ? { $set: { archivedAt: new Date() } } : { $unset: { archivedAt: 1 } }), $inc: { revision: 1 } }, { new: true });
  if (!result) { await get(id, owner); throw fail('Workspace changed elsewhere. Reload before changing its archive state.', 409); }
  return result;
}
async function checklist(id, owner, input) {
  if (Object.keys(input).some((key) => !['revision', 'preparation'].includes(key)) || !input.preparation || typeof input.preparation !== 'object' || Array.isArray(input.preparation) || Object.entries(input.preparation).some(([key, value]) => !Object.hasOwn(manualSteps, key) || typeof value !== 'boolean')) throw fail('Choose supported preparation checklist items');
  const result = await Workspace.findOneAndUpdate({ _id: id, owner, revision: revision(input.revision), archivedAt: null }, { $set: Object.fromEntries(Object.entries(input.preparation).map(([key, value]) => ['preparation.' + key, value])), $inc: { revision: 1 } }, { new: true });
  if (!result) { await get(id, owner); throw fail('Workspace changed or was archived. Reload before updating preparation.', 409); }
  return result;
}
async function inputs(id, owner) {
  const item = await get(id, owner);
  if (item.archivedAt) throw fail('Restore this workspace before starting preparation.', 409);
  if (!item.resumeId) throw fail('Choose a resume in this job workspace first');
  const resume = await require('./resumeService').getReadyResume(item.resumeId, owner);
  return { resumeId: item.resumeId, resumeSelection: structure.selection(item.resumeSelection, resume), workspaceRevision: item.preparationRevision || 1, userId: owner, targetRole: item.title, jobDescriptionText: item.description,
    company: item.company, jobDescriptionId: item.jobDescriptionId, workspaceId: item._id };
}
async function link(job, update) { if (job.inputRef.workspaceId) {
  const expected = job.inputRef.workspaceRevision || 1;
  await Workspace.updateOne({ _id: job.inputRef.workspaceId, owner: job.owner, ...(expected === 1 ? { $or: [{ preparationRevision: 1 }, { preparationRevision: { $exists: false } }] } : { preparationRevision: expected }) }, update);
} }
function list(owner, state = 'active') {
  if (!['active', 'archived', 'all'].includes(state)) throw fail('Choose active, archived or all workspaces');
  return Workspace.find({ owner, ...(state === 'active' ? { archivedAt: null } : state === 'archived' ? { archivedAt: { $ne: null } } : {}) }).sort({ updatedAt: -1 });
}
module.exports = { get, save, details, inputs, link, list, setArchived, checklist };
