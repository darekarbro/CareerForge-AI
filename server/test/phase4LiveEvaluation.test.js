const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const axios = require('axios');
const env = require('../src/config/env');
const { run } = require('../scripts/evaluatePhase4Live.cjs');

const paymentCase = 'live-payment-unsafe';
const parsed = { contactInfo: { name: '', email: '' }, summary: '',
  skills: { all: [], technical: [], tools: [], frameworks: [], soft: [] },
  workExperience: [], education: [], projects: [], certifications: [] };
const feedback = { clarityScore: 50, relevanceScore: 60, structureScore: 50, technicalScore: 20, overallScore: 45,
  strengths: [], improvements: [], starAdherence: '', comments: '' };

async function mockRun(t, { invalidFirstResponse = false } = {}) {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'phase4-live-test-'));
  const oldEnv = { GROQ_API_KEY: env.GROQ_API_KEY, GROQ_MODEL: env.GROQ_MODEL };
  Object.assign(env, { GROQ_API_KEY: 'fixture-test-key', GROQ_MODEL: 'openai/gpt-oss-120b' });
  t.after(async () => {
    Object.assign(env, oldEnv);
    await fs.promises.rm(dir, { recursive: true, force: true });
  });
  t.mock.method(console, 'log', () => {});
  let calls = 0;
  t.mock.method(axios, 'post', async (_url, body) => {
    calls++;
    const result = body.response_format.json_schema.name === 'evaluateAnswer' ? feedback : parsed;
    const content = calls === 1 && invalidFirstResponse ? 'invalid JSON' : JSON.stringify(result);
    return { status: 200, headers: {}, data: { model: env.GROQ_MODEL,
      usage: { prompt_tokens: 599, completion_tokens: 466 }, choices: [{ message: { content } }] } };
  });
  return { dir, output: path.join(dir, 'report.json'), calls: () => calls };
}

test('live evaluation retries a checkpoint without losing a successful payment response or repeating the request', async (t) => {
  const { dir, output, calls } = await mockRun(t, { invalidFirstResponse: true });
  const rename = fs.promises.rename;
  let injected = false;
  t.mock.method(fs.promises, 'rename', async (source, target) => {
    const report = JSON.parse(await fs.promises.readFile(source, 'utf8'));
    if (!injected && report.cases.at(-1)?.id === paymentCase) {
      injected = true;
      throw Object.assign(new Error('Simulated transient file lock'), { code: 'UNKNOWN' });
    }
    return rename(source, target);
  });

  const report = await run(output);
  const payment = report.cases.find(item => item.id === paymentCase);
  assert.equal(report.checkpointRetries, 1);
  assert.equal(report.cases[0].failure, 'invalid-json');
  assert.equal(report.cases[0].failureStage, 'provider-response');
  assert.equal(payment.status, 'accepted');
  assert.equal(payment.expectedBranchCorrect, true);
  assert.equal(calls(), 16);
  assert.equal(report.requests.filter(item => item.caseId === paymentCase).length, 1);
  assert.deepEqual(JSON.parse(await fs.promises.readFile(output, 'utf8')), report);
  assert.deepEqual(await fs.promises.readdir(dir), ['report.json']);
});

test('a permanent checkpoint failure stops the run and leaves the previous report readable', async (t) => {
  const { dir, output, calls } = await mockRun(t);
  t.mock.method(fs.promises, 'rename', async () => {
    throw Object.assign(new Error('Simulated write failure'), { code: 'EIO' });
  });

  await assert.rejects(run(output), { code: 'BENCHMARK_CHECKPOINT' });
  const previous = JSON.parse(await fs.promises.readFile(output, 'utf8'));
  assert.equal(previous.state, 'started');
  assert.deepEqual(previous.cases, []);
  assert.equal(calls(), 1);
  assert.deepEqual(await fs.promises.readdir(dir), ['report.json']);
});
