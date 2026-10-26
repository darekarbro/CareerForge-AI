const { AsyncLocalStorage } = require('node:async_hooks');
const context = new AsyncLocalStorage();
const active = new Map();
function cancellationError() {
  const error = new Error('Processing job was cancelled');
  error.code = 'JOB_CANCELLED';
  error.statusCode = 409;
  return error;
}
const getSignal = () => context.getStore()?.signal;
const throwIfCancelled = () => { if (getSignal()?.aborted) throw cancellationError(); };
const abortJob = (jobId) => active.get(String(jobId))?.controller.abort();
async function waitForJobs(jobIds) {
  await Promise.allSettled(jobIds.map((id) => active.get(String(id))?.done).filter(Boolean));
}
module.exports = { context, active, getSignal, throwIfCancelled, abortJob, waitForJobs, cancellationError };
