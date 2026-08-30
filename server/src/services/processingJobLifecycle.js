const Notification = require('../models/Notification');
const { emitNotification } = require('../config/socket');

async function notifyCompletion(job) {
  const notification = await Notification.create({
    owner: job.owner,
    jobId: job._id,
    type: 'job_completed',
    title: `Job Completed: ${job.jobType.replace('_', ' ').toUpperCase()}`,
    message: 'Your AI request has finished processing successfully.',
  });
  emitNotification(job.owner, notification);
}

async function notifyFailure(job, error) {
  const notification = await Notification.create({
    owner: job.owner,
    jobId: job._id,
    type: 'job_failed',
    title: `Job Failed: ${job.jobType.replace('_', ' ').toUpperCase()}`,
    message: error.message,
  });
  emitNotification(job.owner, notification);
}

async function runProcessingJob(job, task) {
  const startedAt = new Date();
  job.status = 'RUNNING';
  job.startedAt = startedAt;
  await job.save();

  try {
    const output = await task();
    job.status = 'COMPLETED';
    job.output = output;
    job.durationMs = Date.now() - startedAt.getTime();
    job.completedAt = new Date();
    await job.save();
    try {
      await notifyCompletion(job);
    } catch (notificationError) {
      console.warn('[ProcessingJobLifecycle] Completion notification failed:', notificationError.message);
    }
    return output;
  } catch (error) {
    job.status = 'FAILED';
    job.durationMs = Date.now() - startedAt.getTime();
    job.completedAt = new Date();
    job.error = {
      code: error.code || error.name || 'JOB_FAILURE',
      message: error.message,
    };
    await job.save();
    try {
      await notifyFailure(job, error);
    } catch (notificationError) {
      console.warn('[ProcessingJobLifecycle] Failure notification failed:', notificationError.message);
    }
    throw error;
  }
}

module.exports = { runProcessingJob };
