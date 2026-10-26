const Workspace = require('../models/JobWorkspace');
const Description = require('../models/JobDescription');
const { text, url, revision, fail } = require('./resumeContent');
async function get(id, owner) {
  const item = await Workspace.findOne({ _id: id, owner });
  if (!item) throw fail('Job workspace not found', 404);
  return item;
}
async function save(owner, input, id) {
  if (Object.keys(input).some((key) => !['company', 'title', 'jobUrl', 'description', 'notes', 'resumeId', 'revision'].includes(key))) throw fail('Unsupported workspace field');
  const company = text(input.company, 'Company', 150), title = text(input.title, 'Role', 150), description = text(input.description, 'Job description', 24000);
  if (!company || !title || !description) throw fail('Company, role and job description are required');
  const notes = text(input.notes, 'Job notes', 10000), jobUrl = url(input.jobUrl, 'Job link');
  if (input.resumeId) await require('./resumeService').getReadyResume(input.resumeId, owner);
  const before = id ? await get(id, owner) : null;
  if (before && before.revision !== revision(input.revision)) throw fail('This job changed elsewhere. Reload it before saving.', 409);
  const changed = !before || before.description !== description || before.title !== title || before.company !== company;
  const jd = changed ? await Description.create({ owner, company, targetRole: title, title: title + ' @ ' + company, rawText: description }) : null;
  const data = { company, title, description, notes, jobUrl,
    resumeId: input.resumeId || null, jobDescriptionId: jd?._id || before.jobDescriptionId };
  try {
    if (!before) return await Workspace.create({ owner, ...data });
    const updated = await Workspace.findOneAndUpdate({ _id: id, owner, revision: input.revision }, { $set: data, $inc: { revision: 1 } }, { new: true, runValidators: true });
    if (!updated) throw fail('This job changed elsewhere. Reload it before saving.', 409);
    return updated;
  } catch (error) { if (jd) await Description.deleteOne({ _id: jd._id }); throw error; }
}
async function details(id, owner) {
  const workspace = await get(id, owner);
  const [versions, interviews, application, gap] = await Promise.all([
    require('../models/TailoredResume').find({ owner, workspaceId: id }).sort({ createdAt: -1 }).select('version targetRole createdAt resumeId reviewedAt'),
    require('../models/InterviewSession').find({ owner, workspaceId: id }).sort({ createdAt: -1 }),
    workspace.applicationId ? require('../models/Application').findOne({ _id: workspace.applicationId, owner }) : null,
    workspace.latestGapId ? require('../models/GapAnalysis').findOne({ _id: workspace.latestGapId, owner }) : null,
  ]);
  return { workspace, versions, interviews, application, gap };
}
async function inputs(id, owner) {
  const item = await get(id, owner);
  if (!item.resumeId) throw fail('Choose a resume in this job workspace first');
  await require('./resumeService').getReadyResume(item.resumeId, owner);
  return { resumeId: item.resumeId, userId: owner, targetRole: item.title, jobDescriptionText: item.description,
    company: item.company, jobDescriptionId: item.jobDescriptionId, workspaceId: item._id };
}
async function link(job, update) {
  if (job.inputRef.workspaceId) await Workspace.updateOne({ _id: job.inputRef.workspaceId, owner: job.owner }, update);
}
module.exports = { get, save, details, inputs, link,
  list: (owner) => Workspace.find({ owner }).sort({ updatedAt: -1 }) };
