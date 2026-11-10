const crypto = require('node:crypto');
const mongoose = require('mongoose');
const fs = require('node:fs');
const env = require('../config/env');
const telemetry = require('./telemetry');
const fail = (code, message) => Object.assign(new Error(message), { code, statusCode: 429 });
// Calibration is an in-process capability for isolated evaluation scripts. It
// never writes an approved production policy or accepts a token from HTTP input.
const calibrations = new WeakMap();
async function ensure(Model, filter, fields = {}) {
  try { await Model.updateOne(filter, { $setOnInsert: fields }, { upsert: true }); }
  catch (error) { if (error.code !== 11000) throw error; }
}
async function reserveJob(owner, jobId = new mongoose.Types.ObjectId()) {
  const Admission = require('../models/JobAdmission'), Job = require('../models/ProcessingJob');
  await ensure(Admission, { owner }, { slots: [] });
  const record = await Admission.findOne({ owner }).lean();
  const ids = record.slots.map((slot) => slot.jobId);
  const existing = await Job.find({ _id: { $in: ids } }).select('_id status completedAt').lean();
  const states = new Map(existing.map((job) => [String(job._id), job]));
  // Never clear another request's in-flight reservation. An orphan is reclaimed after five minutes.
  const stale = record.slots.filter((slot) => {
    const job = states.get(String(slot.jobId));
    return job && ['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status) && job.completedAt >= slot.reservedAt ||
      !job && Date.now() - slot.reservedAt.getTime() > 300000;
  }).map((slot) => ({ jobId: slot.jobId, reservedAt: slot.reservedAt }));
  if (stale.length) await Admission.updateOne({ owner }, { $pull: { slots: { $or: stale } } });
  const reserved = await Admission.findOneAndUpdate({ owner, 'slots.jobId': { $ne: jobId },
    $expr: { $lt: [{ $size: '$slots' }, env.MAX_ACTIVE_JOBS_PER_USER] } },
  { $push: { slots: { jobId, reservedAt: new Date() } } });
  if (!reserved) throw fail('USER_JOB_LIMIT', 'Your active job limit is reached. Wait for a request to finish or cancel one in Activity.');
  return jobId;
}
async function releaseJob(owner, jobId) {
  await require('../models/JobAdmission').updateOne({ owner }, { $pull: { slots: { jobId } } });
}
function policies() {
  if (!env.AI_MODEL_POLICY_PATH) return [];
  const value = JSON.parse(fs.readFileSync(env.AI_MODEL_POLICY_PATH, 'utf8'));
  if (!Array.isArray(value)) throw new Error('AI model policy must be an array');
  for (const policy of value) {
    if (!['groq', 'openrouter', 'gemini'].includes(policy.provider) || typeof policy.model !== 'string' || !policy.model ||
      typeof policy.benchmarkId !== 'string' || !policy.benchmarkId || !Number.isFinite(policy.qualityScore) || policy.qualityScore < 0 || policy.qualityScore > 1 ||
      !Number.isSafeInteger(policy.samples) || policy.samples < 1 || !Number.isFinite(policy.p95Ms) || policy.p95Ms <= 0 ||
      !Number.isSafeInteger(policy.maxInputBytes) || policy.maxInputBytes < 1 || policy.maxInputBytes > 1000000 ||
      !Number.isSafeInteger(policy.maxOutputTokens) || policy.maxOutputTokens < 1 || policy.maxOutputTokens > 32768 ||
      ![policy.inputUsdPerMillion, policy.outputUsdPerMillion].every((price) => Number.isFinite(price) && price >= 0)) throw new Error('Invalid measured model policy');
  }
  return value.filter((policy) => policy.qualityScore >= env.AI_MIN_QUALITY_SCORE).sort((a, b) =>
    (a.inputUsdPerMillion + a.outputUsdPerMillion) - (b.inputUsdPerMillion + b.outputUsdPerMillion) || a.p95Ms - b.p95Ms);
}
function policyFor(provider, model) {
  const scope = require('./jobContext').context.getStore(), calibration = scope?.calibration && calibrations.get(scope.calibration);
  return calibration?.candidates.find((policy) => policy.provider === provider && policy.model === model) || policies().find((policy) => policy.provider === provider && policy.model === model);
}
async function withCalibration({ owner, candidates, requestLimit }, work) {
  if (env.NODE_ENV !== 'test' || !Number.isSafeInteger(requestLimit) || requestLimit < 1 || requestLimit > 50 || !Array.isArray(candidates) || !candidates.length) throw new Error('Calibration requires an isolated test process and bounded requests');
  for (const policy of candidates) {
    if (!['groq', 'openrouter', 'gemini'].includes(policy.provider) || typeof policy.model !== 'string' || !policy.model ||
      !Number.isSafeInteger(policy.maxInputBytes) || policy.maxInputBytes < 1 || policy.maxInputBytes > 1000000 ||
      !Number.isSafeInteger(policy.maxOutputTokens) || policy.maxOutputTokens < 1 || policy.maxOutputTokens > 32768 ||
      ![policy.inputUsdPerMillion, policy.outputUsdPerMillion].every((price) => Number.isFinite(price) && price >= 0)) throw new Error('Invalid calibration candidate');
  }
  const account = await require('../models/User').findOne({ _id: owner, deleting: { $ne: true } });
  if (!account?.emailVerifiedAt || candidates.some((policy) => account.privacy?.providers?.[policy.provider] !== true)) throw new Error('Calibration account must verify email and consent to every provider');
  const capability = {}, session = { candidates: structuredClone(candidates), remaining: requestLimit };
  calibrations.set(capability, session);
  try { return await require('./jobContext').context.run({ owner, calibration: capability, signal: new AbortController().signal }, work); }
  finally { calibrations.delete(capability); }
}
async function networkCall({ provider, model, body, timeoutMs }, work) {
  const scope = require('./jobContext').context.getStore();
  const policy = policyFor(provider, model);
  if (!scope?.owner || !policy) throw fail('MODEL_NOT_APPROVED', 'This provider model has no approved measured policy.');
  const calibration = scope.calibration && calibrations.get(scope.calibration);
  if (calibration) {
    if (calibration.remaining <= 0) throw fail('BENCHMARK_LIMIT', 'Calibration request limit reached');
    if (!await require('../models/User').exists({ _id: scope.owner, deleting: { $ne: true }, emailVerifiedAt: { $ne: null }, ['privacy.providers.' + provider]: true })) throw fail('MODEL_NOT_APPROVED', 'Calibration consent was revoked');
    // Allocate before the first transport; failed/blocked attempts are not refunded.
    if (calibration.remaining-- <= 0) throw fail('BENCHMARK_LIMIT', 'Calibration request limit reached');
  }
  const bytes = Buffer.byteLength(JSON.stringify(body));
  if (bytes > policy.maxInputBytes) throw fail('MODEL_INPUT_LIMIT', 'This request exceeds the measured model input limit.');
  const Gate = require('../models/ProviderGate'), Budget = require('../models/UsageBudget');
  const token = crypto.randomUUID(), now = new Date();
  await ensure(Gate, { _id: provider }, { slots: [] });
  await Gate.updateOne({ _id: provider }, { $pull: { slots: { expiresAt: { $lte: now } } } });
  const gate = await Gate.findOneAndUpdate({ _id: provider,
    $or: [{ cooldownUntil: { $lte: now } }, { cooldownUntil: { $exists: false } }],
    $expr: { $lt: [{ $size: '$slots' }, env.PROVIDER_CONCURRENCY] } },
  { $push: { slots: { token, expiresAt: new Date(Date.now() + timeoutMs + 30000) } } });
  if (!gate) { telemetry.measure('careerforge.provider.skipped', 1, { provider, reason: 'cooldown_or_concurrency' }); throw fail('PROVIDER_BUSY', 'Provider is cooling down or at capacity.'); }
  // One input token per UTF-8 byte plus envelope headroom; output is capped on the wire.
  // Reserve the upper estimate even for ambiguous failures. This is not an invoice.
  const reservedMicrousd = Math.ceil((bytes + 1024) * policy.inputUsdPerMillion + policy.maxOutputTokens * policy.outputUsdPerMillion);
  try {
    const day = new Date().toISOString().slice(0, 10), filter = { owner: scope.owner, day };
    await ensure(Budget, filter, { reservedMicrousd: 0, attempts: 0 });
    const charged = await Budget.findOneAndUpdate({ ...filter, reservedMicrousd: { $lte: env.USER_DAILY_BUDGET_MICROUSD - reservedMicrousd } },
      { $inc: { reservedMicrousd, attempts: 1 } });
    if (!charged) throw fail('SPENDING_BUDGET', 'Your daily provider budget is exhausted. Offline processing remains available.');
    scope.reservedMicrousd = (scope.reservedMicrousd || 0) + reservedMicrousd;
    telemetry.measure('careerforge.provider.reserved_microusd', reservedMicrousd, { provider, model });
    return await telemetry.span('provider.http', { provider, model, 'budget.reserved_microusd': reservedMicrousd }, () => work(policy));
  } catch (error) {
    if (!error.statusCode && (!error.response || error.response.status === 429 || error.response.status >= 500)) {
      await Gate.updateOne({ _id: provider }, { $max: { cooldownUntil: new Date(Date.now() + env.PROVIDER_COOLDOWN_MS) } });
    }
    throw error;
  } finally { await Gate.updateOne({ _id: provider }, { $pull: { slots: { token } } }); }
}
module.exports = { reserveJob, releaseJob, policies, policyFor, networkCall, withCalibration };
