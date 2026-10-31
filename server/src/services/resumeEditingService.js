const Resume = require('../models/Resume');
const Tailored = require('../models/TailoredResume');
const { cleanResumeContent, revision, text, fail } = require('./resumeContent');
const { resumeText, plain } = require('../providers/resumeFacts');
const structure = require('./resumeStructure');
const owned = (id, owner) => require('./resumeService').getReadyResume(id, owner);
const legacyRevision = (expected) => expected === 1 ? { $or: [{ contentRevision: 1 }, { contentRevision: { $exists: false } }] } : { contentRevision: expected };
const sourceSnapshot = (item) => ({ revision: item.contentRevision || 1, content: structure.withEntryIds(item.parsedData), title: item.title,
  name: item.revisionName || item.title, presentation: structure.presentation(item.presentation), savedAt: item.updatedAt });
function versionContent(item, value) {
  const content = plain(value || item.reviewedContent || item.tailoredContent), reference = structure.withEntryIds(item.tailoredContent);
  for (const section of structure.entrySections) content[section] = (content[section] || []).map((entry, index) => {
    if (entry.entryId) return entry;
    const fields = section === 'projects' ? ['title', 'link'] : section === 'workExperience' ? ['role', 'company', 'startDate'] : section === 'education' ? ['degree', 'institution'] : ['name', 'issuer'];
    const original = reference[section].find((item) => fields.every((key) => String(item[key] || '') === String(entry[key] || ''))) || reference[section][index];
    return { ...entry, entryId: original?.entryId || 'legacy-' + section + '-' + index };
  });
  return structure.withEntryIds(content);
}
const versionSnapshot = (item) => ({ revision: item.contentRevision || 1, content: versionContent(item), decisions: item.reviewDecisions || {},
  name: item.revisionName || 'Generated draft', presentation: structure.presentation(item.presentation), savedAt: item.updatedAt });
async function saveContent(id, owner, input) {
  if (Object.keys(input).some((key) => !['revision', 'revisionName', 'presentation', 'title', 'content'].includes(key))) throw fail('Unsupported resume update');
  const expected = revision(input.revision), content = cleanResumeContent(input.content), before = await owned(id, owner);
  if ((before.contentRevision || 1) !== expected) throw fail('This resume changed elsewhere. Resolve your draft against the latest version.', 409);
  const title = text(input.title ?? before.title, 'Resume title', 120);
  if (!title) throw fail('A resume title is required');
  const updated = await Resume.findOneAndUpdate({ _id: id, owner, deleting: { $ne: true }, ...legacyRevision(expected) }, {
    $set: { title, parsedData: content, rawText: resumeText(content), contentRevision: expected + 1,
      ...(!before.sourceText && before.sourceType === 'upload' && before.rawText.length <= 48000 ? { sourceText: before.rawText } : {}),
      revisionName: text(input.revisionName ?? before.revisionName, 'Revision name', 100) || 'Verified resume', presentation: structure.presentation(input.presentation ?? before.presentation),
      verifiedAt: new Date(), sourceType: 'edited', aiProvider: 'user-verified', atsScoreStale: true },
    $push: { revisionHistory: { $each: [sourceSnapshot(before)], $slice: -20 } },
  }, { new: true, runValidators: true });
  if (!updated) throw fail('This resume changed elsewhere. Resolve your draft against the latest version.', 409);
  return updated;
}
async function history(id, owner) {
  const resume = await owned(id, owner);
  return [...plain(resume.revisionHistory || []), { ...sourceSnapshot(resume), current: true }];
}
async function restore(id, owner, input) {
  const resume = await owned(id, owner), entry = (resume.revisionHistory || []).find((item) => item.revision === input.restoreRevision);
  if (!entry) throw fail('That revision is no longer available', 404);
  return saveContent(id, owner, { revision: input.revision, revisionName: 'Restored ' + (entry.name || 'revision ' + entry.revision), presentation: entry.presentation, title: entry.title, content: plain(entry.content) });
}
async function saveVersion(id, versionId, owner, input, replaceDecisions = false) {
  await owned(id, owner);
  if (Object.keys(input).some((key) => !['revision', 'revisionName', 'presentation', 'content', 'decisions'].includes(key))) throw fail('Unsupported version update');
  const expected = revision(input.revision), content = cleanResumeContent(input.content);
  const version = await Tailored.findOne({ _id: versionId, resumeId: id, owner });
  if (!version) throw fail('Resume version not found', 404);
  if ((version.contentRevision || 1) !== expected) throw fail('This version changed elsewhere. Resolve your draft against the latest version.', 409);
  const choices = input.decisions || {};
  if (!choices || typeof choices !== 'object' || Array.isArray(choices) || Object.keys(choices).length > 5000 ||
    Object.entries(choices).some(([key, value]) => !/^(?:summary|\d+|r_[a-zA-Z0-9_-]{1,230})$/.test(key) || !['accepted', 'rejected', 'edited'].includes(value))) throw fail('Invalid review decisions');
  const decisions = { ...(replaceDecisions ? {} : version.reviewDecisions || {}), ...choices };
  const updated = await Tailored.findOneAndUpdate({ _id: versionId, resumeId: id, owner, ...legacyRevision(expected) }, {
    $set: { reviewedContent: content, reviewDecisions: decisions, contentRevision: expected + 1,
      revisionName: text(input.revisionName ?? version.revisionName, 'Revision name', 100) || 'Reviewed version', presentation: structure.presentation(input.presentation ?? version.presentation),
      reviewedAt: new Date(), atsScoreStale: true },
    $push: { editHistory: { $each: [versionSnapshot(version)], $slice: -30 } },
  }, { new: true, runValidators: true });
  if (!updated) throw fail('This version changed elsewhere. Resolve your draft against the latest version.', 409);
  return updated;
}
async function versionHistory(id, versionId, owner) {
  const version = await Tailored.findOne({ _id: versionId, resumeId: id, owner });
  if (!version) throw fail('Resume version not found', 404);
  return [...plain(version.editHistory || []).map((entry) => ({ ...entry, content: versionContent(version, entry.content) })), { ...versionSnapshot(version), current: true }];
}
async function restoreVersion(id, versionId, owner, input) {
  const entry = (await versionHistory(id, versionId, owner)).find((item) => item.revision === input.restoreRevision);
  if (!entry) throw fail('That revision is no longer available', 404);
  return saveVersion(id, versionId, owner, { revision: input.revision, revisionName: 'Restored ' + (entry.name || 'revision ' + entry.revision), presentation: entry.presentation, content: plain(entry.content), decisions: entry.decisions }, true);
}
async function saveLayout(id, versionId, owner, input) {
  if (Object.keys(input).some((key) => !['revision', 'settings'].includes(key))) throw fail('Unsupported layout field');
  if (!input.settings || typeof input.settings !== 'object' || Array.isArray(input.settings)) throw fail('Provide layout settings');
  const options = require('./resumeExport').settings(input.settings);
  const result = await Tailored.findOneAndUpdate({ _id: versionId, resumeId: id, owner, ...(input.revision === 1 ? { $or: [{ layoutRevision: 1 }, { layoutRevision: { $exists: false } }] } : { layoutRevision: revision(input.revision) }) },
    { $set: { exportSettings: options }, $inc: { layoutRevision: 1 } }, { new: true });
  if (!result) { if (!await Tailored.exists({ _id: versionId, resumeId: id, owner })) throw fail('Resume version not found', 404); throw fail('Layout changed elsewhere. Reload this version before saving layout settings.', 409); }
  return result;
}
module.exports = { saveContent, history, restore, saveVersion, restoreVersion, versionHistory, saveLayout };
