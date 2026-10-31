// Opt-in live acceptance test. Uses only fictional data and its own temporary database.
// Run from the repository root: node server/scripts/testGroqLive.js --live
if (!process.argv.includes('--live')) {
  console.error('Add --live to authorize real Groq API calls using server/.env.');
  process.exit(1);
}
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const http = require('node:http');
const root = path.resolve(__dirname, '../..');
const settings = require('dotenv').parse(fs.readFileSync(path.join(root, 'server/.env')));
for (const key of ['GROQ_API_KEY', 'GROQ_MODEL', 'GROQ_TIMEOUT_MS']) {
  if (settings[key]) process.env[key] = settings[key];
}
for (const key of ['MONGODB_URI', 'REDIS_URL', 'OPENROUTER_API_KEY', 'GEMINI_API_KEY',
  'FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY',
  'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'APP_URL']) process.env[key] = '';
process.env.QUEUE_MODE = 'combined';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'groq-live-synthetic-test-only-secret-123456789';
process.env.CLIENT_URL = 'http://localhost:3000';
process.env.AUTH_RATE_LIMIT_MAX = '1000';
process.env.AI_RATE_LIMIT_MAX = '1000';
const env = require('../src/config/env');
const clean = (value) => String(value || '').replaceAll(env.GROQ_API_KEY || 'no-key-configured', '[REDACTED]')
  .replace(/gsk_[A-Za-z0-9_-]+/g, '[REDACTED]');
const factory = require('../src/providers/providerFactory');
const axios = require('axios');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { connectDB, disconnectDB } = require('../src/config/db');
const { initSocket, closeSocket } = require('../src/config/socket');
const { closeQueue } = require('../src/queues/processingQueue');
const { waitForJobs } = require('../src/services/jobContext');
const app = require('../src/app');
const pdfOnly = process.argv.includes('--pdf-roundtrip');
const resumeOnly = process.argv.includes('--resume-only');
const reuseSource = resumeOnly && process.argv.includes('--reuse-source');
const reportPath = path.join(root, pdfOnly ? '.test-tmp/groq-live-pdf-results.json' : resumeOnly ? '.test-tmp/groq-resume-quality-results.json' : '.test-tmp/groq-live-results.json');
if (fs.existsSync(reportPath)) fs.copyFileSync(reportPath, path.join(root, '.test-tmp/groq-live-previous-results.json'));
const report = { startedAt: new Date().toISOString(), model: factory.groq.model, data: 'fictional only',
  mode: pdfOnly ? 'pdf-roundtrip' : resumeOnly ? 'resume-quality' : 'all-features',
  database: 'isolated temporary MongoDB', fallbackAllowed: false, calls: [], actions: [], checks: [], failures: [] };
const output = (value) => console.log(JSON.stringify(value));
const save = () => { fs.mkdirSync(path.dirname(reportPath), { recursive: true }); fs.writeFileSync(reportPath, JSON.stringify(report, null, 2)); };
let server, db, directory, base, token, resumeId;
let quota = null;
const jobIds = [];
const originalPost = axios.post;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const resetMilliseconds = (value) => {
  let ms = 0;
  for (const match of String(value || '').matchAll(/([\d.]+)(ms|s|m|h)/g)) {
    ms += Number(match[1]) * { ms: 1, s: 1000, m: 60000, h: 3600000 }[match[2]];
  }
  return ms;
};
axios.post = async (url, body, options) => {
  if (url !== 'https://api.groq.com/openai/v1/chat/completions') throw new Error('Unexpected external destination');
  const started = Date.now();
  const call = { action: body.response_format?.json_schema?.name || 'json-action', model: body.model };
  try {
    const response = await originalPost(url, body, options);
    if (resumeOnly && call.action === 'tailorResume') {
      await fsp.writeFile(path.join(root, '.test-tmp/groq-resume-provider-output.json'), response.data.choices[0].message.content);
    }
    Object.assign(call, { status: response.status, durationMs: Date.now() - started,
      responseModel: response.data.model, usage: response.data.usage });
    quota = { remaining: Number(response.headers['x-ratelimit-remaining-tokens']),
      resetAt: Date.now() + resetMilliseconds(response.headers['x-ratelimit-reset-tokens']) };
    return response;
  } catch (error) {
    Object.assign(call, { status: error.response?.status || null, durationMs: Date.now() - started,
      error: clean(error.response?.data?.error?.message || error.message) });
    throw error;
  } finally { report.calls.push(call); save(); output({ groqCall: call.action, status: call.status, durationMs: call.durationMs }); }
};
// A fallback must never make this Groq acceptance test appear successful.
for (const provider of [factory.openRouter, factory.gemini, factory.deterministic]) provider.isAvailable = () => false;
const execute = factory.execute.bind(factory);
factory.execute = async (action, params, onAttempt) => {
  if (Number.isFinite(quota?.remaining) && quota.remaining < (action === 'tailorResume' ? 6000 : 3000) && quota.resetAt > Date.now()) {
    const pause = Math.min(60000, quota.resetAt - Date.now() + 1000);
    output({ quotaPauseSeconds: Math.ceil(pause / 1000), nextAction: action });
    await sleep(pause);
  }
  const started = Date.now(), attempts = [];
  try {
    const result = await execute(action, params, async (name) => { attempts.push(name); if (onAttempt) await onAttempt(name); });
    assert.equal(result.aiProvider, 'groq');
    assert.deepEqual(attempts, ['groq']);
    report.actions.push({ action, passed: true, durationMs: Date.now() - started, provider: result.aiProvider });
    save(); return result;
  } catch (error) {
    report.actions.push({ action, passed: false, durationMs: Date.now() - started, error: clean(error.message) });
    save(); throw error;
  }
};
const resumeText = `Alex Example
alex@example.test | +1 202 555 0100 | Example City
https://github.com/alex-example

Summary
Backend developer building Node.js services with JavaScript, Express, MongoDB and Python. Focused on automated testing, clear API contracts and reliable service operation.

Skills
JavaScript, Node.js, Express, MongoDB, Python, Git, REST APIs, unit testing

Experience
Backend Developer at Example Labs
Example City | January 2023 - December 2025
- Built a Node.js and Express inventory API with authenticated routes and input validation.
- Wrote unit tests for Python data import tools and documented failure handling.
- Reduced invalid inventory records by 25% through validation and automated tests.
- Collaborated with three developers using Git and reviewed changes before release.

Education
BSc Computer Science
Example University
2022

Projects
Inventory Demo
A sample inventory tracker with a Node.js API and MongoDB storage.
Technologies: JavaScript, Node.js, Express, MongoDB
https://example.test/inventory
- Added unit tests for inventory validation and error responses.

Certifications
Example Testing Certificate, Example Training, 2024`;
const jd = 'Backend Engineer at Fictional Systems. Required: JavaScript, Node.js, Express, MongoDB, REST APIs and automated testing. Preferred: Docker and Kubernetes. Build reliable APIs and explain engineering trade-offs.';
async function request(method, route, body) {
  const multipart = body instanceof FormData;
  const response = await fetch(base + route, { method, headers: {
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
    ...(body && !multipart ? { 'Content-Type': 'application/json' } : {}),
  }, ...(body ? { body: multipart ? body : JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
  const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : Buffer.from(await response.arrayBuffer());
  return { status: response.status, data };
}
async function successfulJob(response) {
  assert.equal(response.status, 202, clean(response.data?.message || 'Expected queued response'));
  const id = response.data.data.jobId;
  jobIds.push(id);
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    const status = await request('GET', '/api/processing-jobs/' + id);
    assert.equal(status.status, 200);
    const job = status.data.data;
    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status)) {
      await waitForJobs([id]);
      assert.equal(job.status, 'COMPLETED', clean(job.error?.message || 'Job failed'));
      return job.output;
    }
    await sleep(150);
  }
  throw new Error('Processing job did not reach a terminal state');
}
function check(name, details) { report.checks.push({ name, passed: true, ...details }); save(); output({ check: name, passed: true, ...details }); }
function verifyCalls() {
  assert(report.actions.every((action) => action.passed));
  assert(report.calls.filter((call) => call.status !== 200).every((call) => call.status === 400 &&
    /json.*schema|failed to generate json/i.test(call.error || '') &&
    report.actions.some((action) => action.action === call.action && action.passed)));
}
async function main() {
  assert(factory.groq.isAvailable(), 'Configure GROQ_API_KEY in server/.env first');
  output({ configured: true, model: factory.groq.model, live: true, fallbackAllowed: false });
  const testRoot = path.join(root, '.test-tmp');
  await fsp.mkdir(testRoot, { recursive: true });
  directory = await fsp.mkdtemp(path.join(testRoot, 'groq-live-mongo-'));
  const binaryPath = path.join(root, 'server/node_modules/.cache/mongodb-memory-server/mongod-x64-win32-7.0.24.exe');
  assert(fs.existsSync(binaryPath), 'Local MongoDB test binary is missing; no download will be attempted');
  db = await MongoMemoryServer.create({ binary: { systemBinary: binaryPath }, instance: {
    dbPath: directory, ip: '127.0.0.1', args: ['--wiredTigerCacheSizeGB', '0.25'],
  } });
  await connectDB({ uri: db.getUri() });
  server = http.createServer(app); initSocket(server);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + server.address().port;
  const account = await request('POST', '/api/auth/register', {
    name: 'Groq Synthetic Test', email: 'groq-live@example.test', password: 'synthetic-test-password',
  });
  assert.equal(account.status, 201); token = account.data.data.token;
  // This isolated fictional fixture explicitly enables the provider under test.
  await require('../src/models/User').updateOne({ _id: account.data.data.user.id }, { $set: { emailVerifiedAt: new Date(), 'privacy.providers': { groq: true, openrouter: false, gemini: false } } });
  assert(token, 'Registration must return a token');
  const providers = await request('GET', '/api/processing-jobs/health/providers');
  assert.equal(providers.data.data.activeProvider, 'groq');
  check('Authenticated API selects Groq', { model: providers.data.data.groq.model });

  if (pdfOnly) {
    const pdf = await fsp.readFile(path.join(root, '.test-tmp/groq-live-export.pdf'));
    const form = new FormData(); form.append('file', new Blob([pdf], { type: 'application/pdf' }), 'groq-synthetic-roundtrip.pdf');
    const upload = await request('POST', '/api/resumes/upload', form);
    resumeId = upload.data?.data?.resume?._id;
    const parsed = await successfulJob(upload);
    resumeId = parsed.resume._id;
    assert.equal(parsed.resume.aiProvider, 'groq'); assert.equal(parsed.resume.processingStatus, 'COMPLETED');
    assert.equal(parsed.resume.parsedData.contactInfo.name, 'Alex Example');
    assert(parsed.resume.parsedData.education.some((item) => /Example University/.test(item.institution)));
    assert(Number.isFinite(parsed.resume.atsScore.score));
    check('Exported PDF uploads, extracts, parses and scores with Groq', { score: parsed.resume.atsScore.score });
    assert.deepEqual(report.actions.map((item) => item.action), ['parseResume', 'scoreATS']);
    verifyCalls();
    report.passed = true;
    return;
  }

  let parsed;
  if (reuseSource) {
    const fixture = JSON.parse(await fsp.readFile(path.join(root, '.test-tmp/groq-resume-quality-content.json'), 'utf8')).source;
    assert.equal(fixture.contactInfo.name, 'Alex Example'); assert.equal(fixture.contactInfo.email, 'alex@example.test');
    const resume = await require('../src/models/Resume').create({ owner: account.data.data.user.id,
      title: 'Previously validated fictional fixture', parsedData: fixture, rawText: resumeText,
      processingStatus: 'COMPLETED', aiProvider: 'groq' });
    parsed = { resume: resume.toObject() };
    check('Previously validated fictional source loaded locally');
  } else {
    const form = new FormData(); form.append('file', new Blob([resumeText], { type: 'text/plain' }), 'groq-synthetic-resume.txt');
    form.append('title', 'Groq synthetic acceptance test');
    const upload = await request('POST', '/api/resumes/upload', form);
    resumeId = upload.data?.data?.resume?._id;
    parsed = await successfulJob(upload);
  }
  resumeId = parsed.resume._id;
  assert.equal(parsed.resume.aiProvider, 'groq');
  assert.equal(parsed.resume.processingStatus, 'COMPLETED');
  assert.equal(parsed.resume.parsedData.contactInfo.name, 'Alex Example');
  assert(parsed.resume.parsedData.skills.all.some((skill) => /node/i.test(skill)));
  assert(parsed.resume.parsedData.workExperience.some((item) => /Example Labs/i.test(item.company)));
  check(reuseSource ? 'Previously validated parsed facts retained' : 'Resume upload and Groq parsing', { skills: parsed.resume.parsedData.skills.all.length });
  if (!reuseSource) {
    const baseline = await request('GET', '/api/resumes/' + resumeId + '/ats-score');
    assert.equal(baseline.status, 200); assert(Number.isFinite(baseline.data.data.score));
    check('Groq ATS score persisted and retrievable', { score: baseline.data.data.score });
  }

  const tailored = await successfulJob(await request('POST', '/api/resumes/' + resumeId + '/tailor', {
    targetRole: 'Backend Engineer', jobDescriptionText: jd,
  }));
  const version = tailored.tailoredResume;
  assert.equal(version.aiProvider, 'groq'); assert.equal(tailored.aiProvider, 'groq');
  assert.equal(version.diffFromOriginal.addedSkills.length, 0);
  assert(version.tailoredContent.education.some((item) => /Example University/.test(item.institution)));
  const versions = await request('GET', '/api/resumes/' + resumeId + '/versions');
  assert(versions.data.data.some((item) => item._id === version._id));
  check('Groq tailoring and version persistence', { version: version.version, tailoredAtsScore: version.atsScore.score });
  const pdf = await request('GET', '/api/resumes/' + resumeId + '/download/' + version._id);
  assert.equal(pdf.status, 200); assert.equal(pdf.data.subarray(0, 4).toString(), '%PDF');
  const pdfPath = path.join(root, resumeOnly ? '.test-tmp/groq-resume-quality.pdf' : '.test-tmp/groq-live-export.pdf');
  await fsp.writeFile(pdfPath, pdf.data);
  const pdfText = await require('../src/agents/parserAgent').extractTextFromBuffer(pdf.data, 'pdf');
  assert(pdfText.includes('Alex Example')); assert(pdfText.includes('Example University'));
  check('Tailored PDF export', { bytes: pdf.data.length, reader: 'production parser' });

  if (resumeOnly) {
    const { resumeText: text } = require('../src/providers/resumeFacts');
    report.detail = {
      sourceWords: text(parsed.resume.parsedData).split(/\s+/).filter(Boolean).length,
      tailoredWords: text(version.tailoredContent).split(/\s+/).filter(Boolean).length,
      summaryWords: version.tailoredContent.summary.split(/\s+/).filter(Boolean).length,
      experienceBullets: version.tailoredContent.workExperience.reduce((sum, entry) => sum + entry.highlights.length, 0),
      projectBullets: version.tailoredContent.projects.reduce((sum, entry) => sum + entry.highlights.length, 0),
    };
    await fsp.writeFile(path.join(root, '.test-tmp/groq-resume-quality-content.json'), JSON.stringify({
      source: parsed.resume.parsedData, tailored: version.tailoredContent, diff: version.diffFromOriginal,
      suggestions: version.improvementSuggestions,
    }, null, 2));
    assert.deepEqual(report.actions.map((item) => item.action), reuseSource ? ['tailorResume', 'scoreATS'] : ['parseResume', 'scoreATS', 'tailorResume', 'scoreATS']);
    verifyCalls();
    report.passed = true;
    return;
  }

  const gap = await successfulJob(await request('POST', '/api/resumes/' + resumeId + '/gap-analysis', {
    targetRole: 'Backend Engineer', company: 'Fictional Systems', jobDescriptionText: jd,
  }));
  assert.equal(gap.aiProvider, 'groq'); assert.equal(gap.gapAnalysis.aiProvider, 'groq');
  assert(Number.isFinite(gap.gapAnalysis.matchScore));
  assert([...gap.gapAnalysis.mustHaveMissing, ...gap.gapAnalysis.niceToHaveMissing].some((item) => /Docker|Kubernetes/i.test(item.skill)));
  check('Groq JD gap analysis and saved report', { matchScore: gap.gapAnalysis.matchScore });
  const rewritten = await successfulJob(await request('POST', '/api/resumes/' + resumeId + '/versions/' + version._id + '/regenerate', { section: 'projects', index: 0 }));
  assert.equal(rewritten.aiProvider, 'groq'); assert.equal(rewritten.section, 'projects');
  assert.equal(rewritten.value.title, version.sourceContent.projects[0].title);
  check('Groq scoped project rewrite retains the original project identity');

  const generated = await successfulJob(await request('POST', '/api/interview/sessions', {
    resumeId, targetRole: 'Backend Engineer', jobDescriptionId: gap.gapAnalysis.jobDescriptionId, count: 3,
    difficulty: 'Hard', topicFocus: 'API design', timeLimitSeconds: 120,
  }));
  assert.equal(generated.aiProvider, 'groq'); assert.equal(generated.session.aiProvider, 'groq');
  assert.equal(generated.questions.length, 3);
  assert(generated.questions.every((question) => question.difficulty === 'Hard'));
  assert.equal(new Set(generated.questions.map((question) => question.questionText)).size, 3);
  check('Groq interview questions and suggested answers', { questions: generated.questions.length });
  for (const question of generated.questions) {
    const answer = await successfulJob(await request('POST', '/api/interview/sessions/' + generated.session._id + '/questions/' + question._id + '/answer', {
      userAnswer: 'I clarify the API requirements and failure cases, then compare alternatives and their trade-offs. In the inventory demo I used authenticated Express routes, input validation and MongoDB indexes. I wrote unit tests and checked error responses before release. I would monitor latency and failures, validate the result with tests, and document limitations and recovery steps.',
    }));
    assert.equal(answer.aiProvider, 'groq'); assert.equal(answer.question.feedback.aiProvider, 'groq');
    assert(Number.isFinite(answer.question.feedback.overallScore));
  }
  const session = await request('GET', '/api/interview/sessions/' + generated.session._id);
  assert.equal(session.data.data.session.status, 'completed');
  assert.equal(session.data.data.session.answeredCount, 3);
  check('Groq answer evaluation, feedback persistence and session completion', { answers: 3, overallScore: session.data.data.session.overallScore });
  const improved = await successfulJob(await request('POST', '/api/interview/sessions/' + generated.session._id + '/questions/' + generated.questions[0]._id + '/answer', {
    retry: true, userAnswer: 'I first define the API requirements, schema and error contract. I compare alternatives and failure cases, implement authenticated routes with validation, then write contract tests, measure latency and error rates, and plan rollback and recovery before release.',
  }));
  assert.equal(improved.aiProvider, 'groq'); assert.equal(improved.session.answeredCount, 3); assert.equal(improved.question.attempts.length, 1);
  check('Groq improved-answer retry preserves the session question count');
  const usage = await request('GET', '/api/processing-jobs/usage');
  assert(usage.data.data.providerTokenReports > 0); assert(usage.data.data.inputTokens > 0);
  check('Groq token usage is visible without storing request text in metrics');
  for (const id of jobIds) {
    const timeline = await request('GET', '/api/processing-jobs/' + id + '/timeline');
    assert(timeline.data.data.some((event) => event.step === 'job_completed'));
    assert(!timeline.data.data.some((event) => event.metadata?.aiProvider && event.metadata.aiProvider !== 'groq'));
  }
  const notifications = await request('GET', '/api/notifications');
  assert(notifications.data.data.length >= jobIds.length);
  check('Saved processing timelines and completion notifications', { jobs: jobIds.length });
  const expected = ['parseResume', 'scoreATS', 'tailorResume', 'analyzeGap', 'generateQuestions', 'evaluateAnswer'];
  assert(expected.every((action) => report.actions.some((result) => result.action === action && result.passed)));
  verifyCalls();
  report.passed = true;
}
(async () => {
  try { await main(); }
  catch (error) {
    report.passed = false; report.failures.push(clean(error.message));
    output({ passed: false, error: clean(error.message) }); process.exitCode = 1;
  } finally {
    try {
      await waitForJobs(jobIds);
      if (resumeId && mongoose.connection.readyState === 1) {
        const record = await require('../src/models/Resume').findById(resumeId);
        if (record) await require('../src/services/resumeService').deleteResume(resumeId, record.owner);
      }
      await closeSocket();
      if (server?.listening) await new Promise((resolve) => server.close(resolve));
      await closeQueue(); await disconnectDB(); await db?.stop();
      const testRoot = path.join(root, '.test-tmp');
      if (directory && path.resolve(directory).startsWith(testRoot + path.sep)) await fsp.rm(directory, { recursive: true, force: true });
    } catch (error) { report.cleanupError = clean(error.message); process.exitCode = 1; }
    report.finishedAt = new Date().toISOString(); save();
    output({ passed: report.passed, uniqueActions: [...new Set(report.actions.filter((result) => result.passed).map((result) => result.action))],
      realGroqRequests: report.calls.length, checks: report.checks.length, report: path.relative(root, reportPath) });
  }
})();
