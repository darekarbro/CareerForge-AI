const Job = require('../models/ProcessingJob');
const Question = require('../models/InterviewQuestion');
const { fail } = require('./resumeContent');
let timer, sweeping = false;
async function prepareAnswer(job) {
  if (!job.inputRef.questionId) return;
  const question = await Question.findOne({ _id: job.inputRef.questionId, sessionId: job.inputRef.sessionId });
  if (!question) throw fail('This question no longer exists', 404);
  if (question.evaluatedByJobId && String(question.evaluatedByJobId) !== String(job._id) && String(question.evaluatedByJobId) !== String(job.inputRef.answerBaseJobId)) throw fail('A newer answer has already been reviewed. Start a new answer retry from the session.', 409);
  if (String(question.evaluatedByJobId) === String(job._id)) return;
  const claimed = await Question.updateOne({ _id: question._id, $or: [{ evaluationJobId: null }, { evaluationJobId: job._id }] }, { $set: { evaluationJobId: job._id } });
  if (!claimed.matchedCount) throw fail('Another answer is currently being reviewed', 409);
}
async function enqueue(job) {
  await require('./jobPayloads').read(job);
  if (job.inputRef.resumeId) await require('./resumeService').getResumeById(job.inputRef.resumeId, job.owner);
  await prepareAnswer(job);
  await require('../queues/processingQueue').enqueueRecovery(job.jobType, { jobId: String(job._id) });
}
async function retry(id, owner) {
  const job = await Job.findOne({ _id: id, owner, status: 'FAILED' });
  if (!job) throw fail('Only a failed request can be retried', 409);
  if (job.retryCount >= 5) throw fail('Retry limit reached. Start this action again from its resume or job workspace.', 409);
  await require('./jobPayloads').read(job); await prepareAnswer(job);
  const reset = await Job.findOneAndUpdate({ _id: id, owner, status: 'FAILED', retryCount: job.retryCount }, {
    $set: { status: 'PENDING', recoveredAt: new Date() }, $inc: { retryCount: 1 },
    $unset: { error: 1, output: 1, completedAt: 1, leaseOwner: 1, leaseExpiresAt: 1 },
  }, { new: true });
  if (!reset) throw fail('This request is already being retried', 409);
  try { await enqueue(reset); } catch (error) { await failRecovery(reset, error); throw error; }
  return { jobId: reset._id, status: 'PENDING' };
}
async function failRecovery(job, error) {
  await Job.updateOne({ _id: job._id, status: { $in: ['PENDING', 'RETRYING'] } }, { $set: { status: 'FAILED', completedAt: new Date(), error: { code: error.code || 'RECOVERY_FAILURE', message: error.message } } });
  if (job.inputRef.questionId) await Question.updateOne({ _id: job.inputRef.questionId, evaluationJobId: job._id }, { $unset: { evaluationJobId: 1 } });
}
async function recoverStalled({ now = new Date(), enqueueJob = enqueue } = {}) {
  const expired = await Job.find({ status: { $in: ['RUNNING', 'COMMITTING'] }, $or: [
    { leaseExpiresAt: { $lt: now } }, { leaseExpiresAt: { $exists: false }, updatedAt: { $lt: new Date(now - 10 * 60000) } },
  ] }).limit(100);
  for (const job of expired) {
    const filter = { _id: job._id, status: job.status, ...(job.leaseOwner ? { leaseOwner: job.leaseOwner, leaseExpiresAt: job.leaseExpiresAt } : { leaseOwner: { $exists: false } }) };
    if (job.retryCount >= 2) {
      await Job.updateOne(filter, { $set: { status: 'FAILED', error: { code: 'RECOVERY_LIMIT', message: 'This request stopped repeatedly. Retry it from Activity or start the action again.' }, completedAt: now }, $unset: { leaseOwner: 1, leaseExpiresAt: 1 } });
      continue;
    }
    await Job.updateOne(filter, { $set: { status: 'RETRYING', recoveredAt: now }, $inc: { retryCount: 1 }, $unset: { leaseOwner: 1, leaseExpiresAt: 1 } });
  }
  const queued = await Job.find({ status: { $in: ['PENDING', 'RETRYING'] }, createdAt: { $lte: new Date(now - 3000) } }).limit(100);
  for (const job of queued) {
    try { await enqueueJob(job); } catch (error) { await failRecovery(job, error); }
  }
  return queued.length;
}
function start() {
  const sweep = async () => { if (sweeping) return; sweeping = true; try { await recoverStalled(); } catch (error) { console.warn('Job recovery temporarily unavailable:', error.message); } finally { sweeping = false; } };
  sweep(); timer = setInterval(sweep, 30000); timer.unref?.();
}
function stop() { clearInterval(timer); timer = null; }
module.exports = { retry, recoverStalled, start, stop };
