const ProcessingJob = require('../models/ProcessingJob');
const { enqueueJob } = require('../queues/processingQueue');
async function createJob({ userId, jobType, inputRef }) {
  const { rawInput, ...references } = inputRef;
  const job = await ProcessingJob.create({ owner: userId, jobType, inputRef: references, status: 'PENDING' });
  try { await require('./jobPayloads').save(job, rawInput || {}); }
  catch (error) { await ProcessingJob.deleteOne({ _id: job._id }); throw error; }
  // The job must exist before this check so concurrent resume deletion either sees it or prevents dispatch.
  if (inputRef.resumeId && !await require('../models/Resume').exists({
    _id: inputRef.resumeId, owner: userId, deleting: { $ne: true },
  })) {
    await ProcessingJob.deleteOne({ _id: job._id });
    await require('./jobPayloads').remove(job);
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
  return { jobId: job._id, status: 'PENDING' };
}
module.exports = { createJob, dispatchJob };
