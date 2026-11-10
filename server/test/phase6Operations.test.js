const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const env = require('../src/config/env');
const controls = require('../src/services/operationalControls');
const { context } = require('../src/services/jobContext');
const Job = require('../src/models/ProcessingJob');
const Admission = require('../src/models/JobAdmission');
const Budget = require('../src/models/UsageBudget');
const Gate = require('../src/models/ProviderGate');
const telemetry = require('../src/services/telemetry');
let db, directory;
const original = { ...env };
const owner = new mongoose.Types.ObjectId();
const policy = { provider: 'groq', model: 'fixture', benchmarkId: 'synthetic-control-test', qualityScore: 0.95, samples: 10, p95Ms: 50,
  maxInputBytes: 10000, maxOutputTokens: 100, inputUsdPerMillion: 1, outputUsdPerMillion: 2 };
before(async () => {
  const root = path.resolve(__dirname, '../../.test-tmp'); await fs.mkdir(root, { recursive: true });
  directory = await fs.mkdtemp(path.join(root, 'phase6-controls-'));
  const binaryPath = path.resolve(__dirname, '../node_modules/.cache/mongodb-memory-server/mongod-x64-win32-7.0.24.exe');
  const binary = await fs.stat(binaryPath).then(() => ({ systemBinary: binaryPath }), () => ({}));
  db = await MongoMemoryServer.create({ binary });
  mongoose.set('bufferCommands', false); await mongoose.connect(db.getUri());
  for (const Model of [Job, Admission, Budget, Gate]) await Model.init();
  env.AI_MODEL_POLICY_PATH = path.join(directory, 'models.json');
  await fs.writeFile(env.AI_MODEL_POLICY_PATH, JSON.stringify([policy]));
});
beforeEach(async () => { for (const Model of [Job, Admission, Budget, Gate]) await Model.deleteMany({}); env.MAX_ACTIVE_JOBS_PER_USER = 3; env.USER_DAILY_BUDGET_MICROUSD = 1000000; env.PROVIDER_CONCURRENCY = 2; });
after(async () => { Object.assign(env, original); await mongoose.disconnect(); await db?.stop(); await telemetry.shutdown(); if (directory) await fs.rm(directory, { recursive: true, force: true }); });
test('concurrent admissions reserve exactly the configured number across producers', async () => {
  const attempts = await Promise.allSettled(Array.from({ length: 25 }, () => controls.reserveJob(owner)));
  assert.equal(attempts.filter((entry) => entry.status === 'fulfilled').length, 3);
  assert(attempts.filter((entry) => entry.status === 'rejected').every((entry) => entry.reason.code === 'USER_JOB_LIMIT'));
  assert.equal((await Admission.findOne({ owner })).slots.length, 3);
  assert(await controls.reserveJob(new mongoose.Types.ObjectId()));
});
test('terminal slots are reclaimed but a newly reserved retry cannot be pruned as an old failure', async () => {
  const id = await controls.reserveJob(owner), completedAt = new Date(Date.now() + 5);
  await Job.create({ _id: id, owner, jobType: 'ats_score', status: 'FAILED', completedAt });
  await new Promise((resolve) => setTimeout(resolve, 15));
  await controls.reserveJob(owner, id);
  await Promise.allSettled(Array.from({ length: 8 }, () => controls.reserveJob(owner)));
  const slots = (await Admission.findOne({ owner })).slots;
  assert.equal(slots.length, 3); assert.equal(slots.filter((slot) => String(slot.jobId) === String(id)).length, 1);
});
const call = (work = async () => 'ok') => context.run({ owner, signal: new AbortController().signal }, () => controls.networkCall({ provider: 'groq', model: 'fixture', body: { test: 'bounded' }, timeoutMs: 100 }, work));
test('spending reservation is atomic and debits ambiguous failures without refund', async () => {
  env.PROVIDER_CONCURRENCY = 50; env.USER_DAILY_BUDGET_MICROUSD = 3000;
  const attempts = await Promise.allSettled(Array.from({ length: 20 }, () => call()));
  const charged = await Budget.findOne({ owner });
  assert(charged.reservedMicrousd <= 3000); assert(charged.attempts > 0);
  assert.equal(attempts.filter((entry) => entry.status === 'fulfilled').length, charged.attempts);
  assert(attempts.some((entry) => entry.status === 'rejected' && entry.reason.code === 'SPENDING_BUDGET'));
  assert.equal((await Gate.findById('groq')).slots.length, 0);
});
test('provider concurrency and shared cooldown block attempts before transport', async () => {
  let release, entered; const ready = new Promise((resolve) => { entered = resolve; });
  env.PROVIDER_CONCURRENCY = 1;
  const held = call(() => new Promise((resolve) => { release = resolve; entered(); }));
  await ready; await assert.rejects(call(), { code: 'PROVIDER_BUSY' }); release('ok'); await held;
  await assert.rejects(call(async () => { throw Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }); }));
  const debit = (await Budget.findOne({ owner })).reservedMicrousd;
  await assert.rejects(call(), { code: 'PROVIDER_BUSY' });
  assert.equal((await Budget.findOne({ owner })).reservedMicrousd, debit);
  assert.equal((await Gate.findById('groq')).slots.length, 0);
});
test('unmeasured models, missing owners and oversized requests never reach transport', async () => {
  let calls = 0;
  const options = { provider: 'groq', model: 'unknown', body: {}, timeoutMs: 100 };
  await assert.rejects(context.run({ owner }, () => controls.networkCall(options, async () => calls++)), { code: 'MODEL_NOT_APPROVED' });
  await assert.rejects(controls.networkCall({ ...options, model: 'fixture' }, async () => calls++), { code: 'MODEL_NOT_APPROVED' });
  await assert.rejects(context.run({ owner }, () => controls.networkCall({ ...options, model: 'fixture', body: { text: 'x'.repeat(11000) } }, async () => calls++)), { code: 'MODEL_INPUT_LIMIT' });
  assert.equal(calls, 0); assert.equal(await Budget.countDocuments(), 0);
});
test('measured policy filters low quality and selects lower rates before latency', async () => {
  const data = [policy, { ...policy, model: 'low-quality', qualityScore: 0.2, inputUsdPerMillion: 0 },
    { ...policy, provider: 'openrouter', model: 'cheaper', inputUsdPerMillion: 0, outputUsdPerMillion: 0.5, p95Ms: 1000 }];
  await fs.writeFile(env.AI_MODEL_POLICY_PATH, JSON.stringify(data));
  try { assert.deepEqual(controls.policies().map((entry) => entry.model), ['cheaper', 'fixture']); }
  finally { await fs.writeFile(env.AI_MODEL_POLICY_PATH, JSON.stringify([policy])); }
});
test('isolated calibration enforces consent, request budget and capability lifetime without approving production traffic', async () => {
  const user = await require('../src/models/User').create({ name: 'Calibration fixture', email: 'calibration-fixture@example.test', password: 'fixture-password', emailVerifiedAt: new Date(), privacy: { providers: { groq: true } } });
  const candidate = { ...policy, model: 'unapproved-candidate' }, options = { provider: 'groq', model: candidate.model, body: {}, timeoutMs: 100 };
  let calls = 0;
  assert.equal(controls.policyFor('groq', candidate.model), undefined);
  await controls.withCalibration({ owner: user._id, candidates: [candidate], requestLimit: 1 }, async () => {
    await controls.networkCall(options, async () => calls++);
    await assert.rejects(controls.networkCall(options, async () => calls++), { code: 'BENCHMARK_LIMIT' });
  });
  assert.equal(calls, 1); assert.equal(controls.policyFor('groq', candidate.model), undefined);
  await assert.rejects(context.run({ owner: user._id, calibration: {} }, () => controls.networkCall(options, async () => calls++)), { code: 'MODEL_NOT_APPROVED' });
  await controls.withCalibration({ owner: user._id, candidates: [candidate], requestLimit: 1 }, async () => {
    await require('../src/models/User').updateOne({ _id: user._id }, { $set: { 'privacy.providers.groq': false } });
    await assert.rejects(controls.networkCall(options, async () => calls++), { code: 'MODEL_NOT_APPROVED' });
  });
  const nodeEnv = env.NODE_ENV; env.NODE_ENV = 'production';
  try { await assert.rejects(controls.withCalibration({ owner: user._id, candidates: [candidate], requestLimit: 1 }, async () => {}), /isolated/); }
  finally { env.NODE_ENV = nodeEnv; }
});
test('real chat transport caps output and charges both schema repair network attempts', async () => {
  const axios = require('axios'), post = axios.post, Provider = require('../src/providers/groqProvider');
  const provider = new Provider(); provider.model = 'fixture'; provider.apiKey = 'test-only';
  let calls = 0;
  axios.post = async (_url, body) => {
    calls++; assert.equal(body.max_completion_tokens, policy.maxOutputTokens);
    if (calls === 1) throw Object.assign(new Error('schema'), { response: { status: 400, data: { error: { code: 'json_parse_failed' } } } });
    return { data: { choices: [{ message: { content: '{}' } }] } };
  };
  try { await context.run({ owner }, () => provider._callChatCompletion('test', 'test', 'parseResume')); assert.equal(calls, 2); assert.equal((await Budget.findOne({ owner })).attempts, 2); }
  finally { axios.post = post; }
});
test('real provider timeout aborts a slow HTTP request, retains its debit and opens cooldown', async () => {
  const http = require('node:http'), Provider = require('../src/providers/groqProvider');
  const server = http.createServer((_req, res) => { const timer = setTimeout(() => res.end('{}'), 2000); res.on('close', () => clearTimeout(timer)); });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const provider = new Provider(); provider.model = 'fixture'; provider.apiKey = 'test-only'; provider.timeoutMs = 100;
    provider.baseUrl = 'http://127.0.0.1:' + server.address().port;
    const start = Date.now();
    await assert.rejects(context.run({ owner }, () => provider._callChatCompletion('test', 'test', 'parseResume')), /timed out/);
    assert(Date.now() - start < 1500); assert.equal((await Budget.findOne({ owner })).attempts, 1);
    const gate = await Gate.findById('groq'); assert.equal(gate.slots.length, 0); assert(gate.cooldownUntil > new Date());
  } finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
});
