const crypto = require('node:crypto');
const Cache = require('../models/AssessmentCache');
const { plain, resumeText } = require('../providers/resumeFacts');
const { createJob, dispatchJob } = require('./jobService');
const { fail } = require('./resumeContent');
const rubricVersion = 'resume-quality-2026-01';
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter((key) => !['_id', '__v', 'warnings'].includes(key)).map((key) => [key, canonical(value[key])]));
  return value;
}
const pending = new Map();
async function cached({ owner, action, params }, calculate) {
  const factory = require('../providers/providerFactory'), status = factory.getProvidersStatus();
  const user = await require('../models/User').findOne({ _id: owner, deleting: { $ne: true } });
  if (!user) throw fail('Account unavailable', 401);
  const provider = ['groq', 'openrouter', 'gemini'].find((name) => user.emailVerifiedAt && user.privacy?.providers?.[name] && status[name]?.configured) || 'deterministic-fallback';
  const model = status[provider]?.model || 'offline-rules-v1';
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify({ action, rubricVersion, provider, model, params: canonical(params) })).digest('hex');
  const key = owner + ':' + fingerprint;
  const stored = await Cache.findOne({ owner, fingerprint, expiresAt: { $gt: new Date() } });
  if (stored) return { ...stored.result, assessmentMeta: { ...stored.result.assessmentMeta, cached: true } };
  if (pending.has(key)) return pending.get(key);
  const promise = (async () => {
    const result = await calculate();
    const actualModel = result.aiProvider === 'deterministic-fallback' ? 'offline-rules-v1' : status[result.aiProvider]?.model || model;
    const record = { ...result, assessmentMeta: { rubricVersion, fingerprint, provider: result.aiProvider, model: actualModel,
      assessedAt: new Date().toISOString(), cached: false, kind: action === 'scoreATS' ? 'resume-quality' : 'job-match' } };
    try { await Cache.updateOne({ owner, fingerprint, expiresAt: { $lte: new Date() } }, { $set: { result: record, expiresAt: new Date(Date.now() + (result.aiProvider === provider ? (user.privacy?.cacheDays || 7) * 86400000 : 300000)) } }, { upsert: true }); }
    catch (error) { if (error.code !== 11000) throw error; }
    return (await Cache.findOne({ owner, fingerprint }))?.result || record;
  })();
  pending.set(key, promise);
  try { return await promise; } finally { pending.delete(key); }
}
async function request(resumeId, owner, versionId) {
  const resume = await require('./resumeService').getReadyResume(resumeId, owner);
  if (versionId) {
    const version = await require('./tailoringService').getTailoredVersion(versionId, owner);
    if (String(version.resumeId) !== resumeId) throw fail('Version not found', 404);
  }
  return dispatchJob(await createJob({ userId: owner, jobType: 'ats_score', inputRef: { resumeId: resume._id, versionId } }));
}
async function processAssessment({ job, checkpoint, commit }) {
  const resume = await require('./resumeService').getReadyResume(job.inputRef.resumeId, job.owner);
  const version = job.inputRef.versionId ? await require('./tailoringService').getTailoredVersion(job.inputRef.versionId, job.owner) : null;
  const content = plain(version ? version.reviewedContent || version.tailoredContent : resume.parsedData), before = (version || resume).contentRevision || 1;
  const result = await require('../agents/analyzerAgent').scoreATS({ resumeData: content, rawText: resumeText(content), jobId: job._id, userId: job.owner });
  await checkpoint();
  return commit(async () => {
    const model = version ? require('../models/TailoredResume') : require('../models/Resume');
    const record = await model.findOneAndUpdate({ _id: (version || resume)._id, owner: job.owner,
      ...(before === 1 ? { $or: [{ contentRevision: 1 }, { contentRevision: { $exists: false } }] } : { contentRevision: before }) },
    { $set: { atsScore: result, assessmentMeta: result.assessmentMeta, atsScoreStale: false } }, { new: true });
    if (!record) throw fail('The resume changed during assessment. Run it again for the latest saved content.', 409);
    return { assessment: result, resumeId: resume._id, versionId: version?._id };
  });
}
module.exports = { cached, request, processAssessment, rubricVersion, canonical };
