const ProcessingJob = require('../models/ProcessingJob');
const { enqueueJob } = require('../queues/processingQueue');
async function createJob({ userId, jobType, inputRef }) {
  const user = await require('../models/User').findOne({ _id: userId, deleting: { $ne: true } });
  if (!user) throw Object.assign(new Error('Account unavailable'), { statusCode: 401 });
  if (!user.emailVerifiedAt) throw Object.assign(new Error('Verify your email before starting AI processing. Open Account settings to resend the link.'), { statusCode: 403, code: 'EMAIL_UNVERIFIED' });
  const { rawInput, ...references } = inputRef;
  const controls = require('./operationalControls'), telemetry = require('./telemetry');
  const id = await controls.reserveJob(userId);
  let job;
  try { job = await ProcessingJob.create({ _id: id, owner: userId, jobType, inputRef: references, status: 'PENDING', queuedAt: new Date(),
    traceId: telemetry.ids().traceId, traceContext: telemetry.carrier() }); }
  catch (error) { await controls.releaseJob(userId, id); throw error; }
  try { await require('./jobPayloads').save(job, rawInput || {}); }
  catch (error) { await ProcessingJob.deleteOne({ _id: job._id }); await controls.releaseJob(userId, id); throw error; }
  // The job must exist before this check so concurrent resume deletion either sees it or prevents dispatch.
  if (inputRef.resumeId && !await require('../models/Resume').exists({
    _id: inputRef.resumeId, owner: userId, deleting: { $ne: true },
  })) {
    await ProcessingJob.deleteOne({ _id: job._id });
    await require('./jobPayloads').remove(job);
    await controls.releaseJob(userId, id);
    throw Object.assign(new Error('Resume is no longer available'), { statusCode: 409 });
  }
  return job;
}
async function dispatchJob(job) {
  try { await enqueueJob(job.jobType, { jobId: String(job._id) }); }
  catch (error) {
    await ProcessingJob.updateOne({ _id: job._id, status: 'PENDING' }, {
      $set: { status: 'FAILED', completedAt: new Date(), error: { code: 'QUEUE_FAILURE', message: error.message } },
      $unset: { 'inputRef.rawInput': 1 },
    });
    throw error;
  }
  return { jobId: job._id, status: 'PENDING', traceId: job.traceId };
}
module.exports = { createJob, dispatchJob };
