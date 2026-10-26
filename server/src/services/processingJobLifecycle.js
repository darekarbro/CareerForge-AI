const ProcessingJob = require('../models/ProcessingJob');
const Resume = require('../models/Resume');
const InterviewQuestion = require('../models/InterviewQuestion');
const Notification = require('../models/Notification');
const monitoring = require('../agents/monitoringAgent');
const { emitNotification } = require('../config/socket');
const { context, active, throwIfCancelled, cancellationError } = require('./jobContext');

async function runProcessingJob(jobOrId, task) {
  const id = jobOrId._id || jobOrId;
  const leaseOwner = require('node:crypto').randomUUID();
  const job = await ProcessingJob.findOneAndUpdate(
    { _id: id, status: { $in: ['PENDING', 'RETRYING'] } },
    { $set: { status: 'RUNNING', startedAt: new Date(), leaseOwner, leaseExpiresAt: new Date(Date.now() + 90000) } }, { new: true }
  );
  if (!job) return (await ProcessingJob.findById(id))?.output;
  const controller = new AbortController();
  let release;
  const done = new Promise((resolve) => { release = resolve; });
  active.set(String(id), { controller, done });
  const checkpoint = async () => {
    throwIfCancelled();
    if (!await ProcessingJob.exists({ _id: id, status: 'RUNNING', leaseOwner })) throw cancellationError();
  };
  let committing = false;
  const commit = async (write) => {
    await checkpoint();
    // Once persistence starts, cancellation must fail instead of reporting a false cancellation.
    const claimed = await ProcessingJob.findOneAndUpdate({ _id: id, status: 'RUNNING', leaseOwner },
      { $set: { status: 'COMMITTING' } }, { new: true });
    if (!claimed) throw cancellationError();
    committing = true;
    return write();
  };
  const poll = setInterval(async () => {
    if (committing || controller.signal.aborted) return;
    try {
      if (!await ProcessingJob.exists({ _id: id, status: 'RUNNING', leaseOwner })) controller.abort();
    } catch (_error) { /* The task reports database failures through its own awaited operations. */ }
  }, 500);
  poll.unref?.();
  const heartbeat = setInterval(() => ProcessingJob.updateOne({ _id: id, leaseOwner, status: { $in: ['RUNNING', 'COMMITTING'] } },
    { $set: { leaseExpiresAt: new Date(Date.now() + 90000) } }).catch(() => {}), 10000);
  heartbeat.unref?.();
  try {
    return await context.run({ signal: controller.signal, jobId: id, owner: job.owner }, async () => {
      await monitoring.logEvent({ jobId: id, userId: job.owner, agent: 'orchestrator',
        message: 'Processing started', step: 'job_started' });
      try {
        job.inputRef.rawInput = await require('./jobPayloads').read(job);
        if (job.jobType === 'resume_parse') await Resume.updateOne({ _id: job.inputRef.resumeId, deleting: { $ne: true }, processingStatus: { $ne: 'COMPLETED' } },
          { $set: { processingStatus: 'RUNNING' } });
        const output = await task({ job, checkpoint, commit });
        if (!committing) await commit(async () => {});
        const completed = await ProcessingJob.findOneAndUpdate({ _id: id, status: 'COMMITTING', leaseOwner }, {
          $set: { status: 'COMPLETED', output, durationMs: Date.now() - job.startedAt.getTime(), completedAt: new Date() },
          $unset: { 'inputRef.rawInput': 1, leaseOwner: 1, leaseExpiresAt: 1 },
        }, { new: true });
        if (!completed) throw cancellationError();
        await require('./jobPayloads').remove(job);
        await monitoring.logEvent({ jobId: id, userId: job.owner, agent: 'orchestrator',
          level: 'success', message: 'Processing completed', step: 'job_completed' });
        await notify(completed, 'job_completed', 'Your request has finished successfully.');
        return output;
      } catch (error) {
        const cancelled = error.code === 'JOB_CANCELLED' || controller.signal.aborted && !committing;
        const state = cancelled ? 'CANCELLED' : 'FAILED';
        const failed = await ProcessingJob.findOneAndUpdate({ _id: id, leaseOwner,
          status: { $in: ['RUNNING', 'COMMITTING', 'RETRYING'] } }, {
          $set: { status: state, completedAt: new Date(), durationMs: Date.now() - job.startedAt.getTime(),
            error: { code: cancelled ? 'JOB_CANCELLED' : error.code || 'JOB_FAILURE', message: error.message } },
          $unset: { 'inputRef.rawInput': 1, leaseOwner: 1, leaseExpiresAt: 1 },
        }, { new: true });
        if (failed && cancelled) await require('./jobPayloads').remove(job);
        if (failed && job.jobType === 'resume_parse') await Resume.updateOne(
          { _id: job.inputRef.resumeId, processingStatus: { $ne: 'COMPLETED' } }, { $set: { processingStatus: state } });
        if (failed && job.inputRef.questionId) await InterviewQuestion.updateOne(
          { _id: job.inputRef.questionId, evaluationJobId: id }, { $unset: { evaluationJobId: 1 } });
        const persisted = failed || await ProcessingJob.findById(id);
        const stillExists = failed || (persisted?.status === 'CANCELLED' ? persisted : null);
        if (stillExists) {
          await monitoring.logEvent({ jobId: id, userId: job.owner, agent: 'recovery', level: cancelled ? 'warning' : 'error',
            message: cancelled ? 'Processing cancelled' : 'Processing failed: ' + error.message,
            step: cancelled ? 'job_cancelled' : 'job_failed' });
          if (!cancelled) await notify(stillExists, 'job_failed', error.message);
        }
        if (!cancelled) throw error;
        return undefined;
      }
    });
  } finally {
    clearInterval(poll);
    clearInterval(heartbeat);
    active.delete(String(id));
    release();
  }
}
async function notify(job, type, message) {
  try {
    const output = job.output || {};
    const actionLink = '/activity?job=' + job._id;
    const notification = await Notification.create({ owner: job.owner, jobId: job._id, type,
      title: type === 'job_completed' ? 'Processing complete' : 'Processing failed', message, actionLink });
    emitNotification(job.owner, notification);
  } catch (error) { console.warn('Unable to save processing notification:', error.message); }
}
module.exports = { runProcessingJob };
