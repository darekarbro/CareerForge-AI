const Resume = require('../models/Resume');
const Tailored = require('../models/TailoredResume');
const { cleanResumeContent, revision, text, fail } = require('./resumeContent');
const { resumeText, plain } = require('../providers/resumeFacts');
const owned = (id, owner) => require('./resumeService').getReadyResume(id, owner);
const legacyRevision = (expected) => expected === 1 ? { $or: [{ contentRevision: 1 }, { contentRevision: { $exists: false } }] } : { contentRevision: expected };
async function saveContent(id, owner, input) {
  if (Object.keys(input).some((key) => !['revision', 'title', 'content'].includes(key))) throw fail('Unsupported resume update');
  const expected = revision(input.revision), content = cleanResumeContent(input.content), before = await owned(id, owner);
  if ((before.contentRevision || 1) !== expected) throw fail('This resume changed elsewhere. Reload it before saving.', 409);
  const title = text(input.title ?? before.title, 'Resume title', 120);
  if (!title) throw fail('A resume title is required');
  const updated = await Resume.findOneAndUpdate({ _id: id, owner, deleting: { $ne: true }, ...legacyRevision(expected) }, {
    $set: { title, parsedData: content, rawText: resumeText(content), contentRevision: expected + 1,
      verifiedAt: new Date(), sourceType: 'edited', aiProvider: 'user-verified', atsScoreStale: true },
    $push: { revisionHistory: { $each: [{ revision: expected, content: plain(before.parsedData), title: before.title, savedAt: new Date() }], $slice: -20 } },
  }, { new: true, runValidators: true });
  if (!updated) throw fail('This resume changed elsewhere. Reload it before saving.', 409);
  return updated;
}
async function history(id, owner) {
  const resume = await owned(id, owner);
  return [...plain(resume.revisionHistory || []), { revision: resume.contentRevision || 1, content: plain(resume.parsedData), title: resume.title, savedAt: resume.updatedAt, current: true }];
}
async function restore(id, owner, input) {
  const resume = await owned(id, owner), entry = (resume.revisionHistory || []).find((item) => item.revision === input.restoreRevision);
  if (!entry) throw fail('That revision is no longer available', 404);
  return saveContent(id, owner, { revision: input.revision, title: entry.title, content: plain(entry.content) });
}
async function saveVersion(id, versionId, owner, input) {
  await owned(id, owner);
  if (Object.keys(input).some((key) => !['revision', 'content', 'decisions'].includes(key))) throw fail('Unsupported version update');
  const expected = revision(input.revision), content = cleanResumeContent(input.content);
  const version = await Tailored.findOne({ _id: versionId, resumeId: id, owner });
  if (!version) throw fail('Resume version not found', 404);
  if ((version.contentRevision || 1) !== expected) throw fail('This version changed elsewhere. Reload it before saving.', 409);
  const decisions = input.decisions || {};
  if (!decisions || typeof decisions !== 'object' || Array.isArray(decisions) || Object.keys(decisions).length > 5000 ||
    Object.entries(decisions).some(([key, value]) => !/^(?:summary|\d+)$/.test(key) || !['accepted', 'rejected', 'edited'].includes(value))) throw fail('Invalid review decisions');
  const updated = await Tailored.findOneAndUpdate({ _id: versionId, resumeId: id, owner, ...legacyRevision(expected) }, {
    $set: { reviewedContent: content, reviewDecisions: decisions, contentRevision: expected + 1, reviewedAt: new Date(), atsScoreStale: true },
    $push: { editHistory: { $each: [{ revision: expected, content: plain(version.reviewedContent || version.tailoredContent), decisions: version.reviewDecisions || {}, savedAt: new Date() }], $slice: -30 } },
  }, { new: true, runValidators: true });
  if (!updated) throw fail('This version changed elsewhere. Reload it before saving.', 409);
  return updated;
}
async function restoreVersion(id, versionId, owner, input) {
  const version = await Tailored.findOne({ _id: versionId, resumeId: id, owner });
  const entry = version?.editHistory?.find((item) => item.revision === input.restoreRevision);
  if (!entry) throw fail('That revision is no longer available', 404);
  return saveVersion(id, versionId, owner, { revision: input.revision, content: plain(entry.content), decisions: entry.decisions });
}
module.exports = { saveContent, history, restore, saveVersion, restoreVersion };
