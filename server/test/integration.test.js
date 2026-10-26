const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { io: connectSocket } = require('socket.io-client');
const app = require('../src/app');
const { initSocket, closeSocket, emitAgentEvent, emitNotification } = require('../src/config/socket');
const { connectDB, disconnectDB } = require('../src/config/db');
const { closeQueue } = require('../src/queues/processingQueue');
const { waitForJobs } = require('../src/services/jobContext');
const auth = require('../src/services/authService');
const generator = require('../src/agents/generatorAgent');
const User = require('../src/models/User'), Resume = require('../src/models/Resume');
const Job = require('../src/models/ProcessingJob'), Log = require('../src/models/ProcessingLog');
const Tailored = require('../src/models/TailoredResume'), Gap = require('../src/models/GapAnalysis');
const Session = require('../src/models/InterviewSession'), Question = require('../src/models/InterviewQuestion');
const Application = require('../src/models/Application'), Description = require('../src/models/JobDescription');
const Notification = require('../src/models/Notification');
const facts = {
  contactInfo: { name: 'Actual Candidate', email: 'actual@example.test', phone: '1234567890' },
  summary: 'Built Python and Rust services.',
  skills: { all: ['Python', 'Rust', 'React'], technical: ['Python', 'Rust', 'React'] },
  workExperience: [{ role: 'Engineer', company: 'Actual Co', startDate: '2021', endDate: '2024',
    highlights: ['Built Python tooling.', 'Built Rust services with 12 users.'] }],
  projects: [{ title: 'Real Project', description: 'Actual project description', link: 'https://example.test/project',
    technologies: ['Python'], highlights: ['Tested Python integration.'] }],
  education: [{ degree: 'Actual Degree', institution: 'Actual University', graduationYear: '2024' }],
  certifications: [{ name: 'Actual Certificate', issuer: 'Actual Issuer', year: '2024' }],
};
let db, server, base, directory, sequence = 0;
const clients = [];
const testRoot = path.resolve(__dirname, '../../.test-tmp');
before(async () => {
  await fs.mkdir(testRoot, { recursive: true });
  directory = await fs.mkdtemp(path.join(testRoot, 'mongo-'));
  const binaryPath = path.resolve(__dirname, '../node_modules/.cache/mongodb-memory-server/mongod-x64-win32-7.0.24.exe');
  const binary = process.env.MONGOMS_SYSTEM_BINARY ? { systemBinary: process.env.MONGOMS_SYSTEM_BINARY } :
    await fs.stat(binaryPath).then(() => ({ systemBinary: binaryPath }), () => ({}));
  db = await MongoMemoryServer.create({ binary, instance: { dbPath: directory, ip: '127.0.0.1' } });
  await connectDB({ uri: db.getUri() });
  server = http.createServer(app); initSocket(server, 'http://localhost:3000');
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + server.address().port;
});
beforeEach(async () => {
  for (const client of clients.splice(0)) client.disconnect();
  for (const model of Object.values(mongoose.models)) await model.deleteMany({});
});
after(async () => {
  clients.forEach((client) => client.disconnect());
  await closeSocket(); if (server?.listening) await new Promise((resolve) => server.close(resolve));
  await closeQueue(); await disconnectDB(); await db?.stop();
  if (directory && path.resolve(directory).startsWith(testRoot + path.sep)) await fs.rm(directory, { recursive: true, force: true });
});
async function request(method, url, { token, body, headers = {} } = {}) {
  const multipart = body instanceof FormData;
  const response = await fetch(base + url, { method, headers: {
    ...(body && !multipart ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers,
  }, ...(body ? { body: multipart ? body : JSON.stringify(body) } : {}), redirect: 'manual', signal: AbortSignal.timeout(15000) });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : Buffer.from(await response.arrayBuffer());
  return { status: response.status, data, headers: response.headers };
}
async function user() {
  sequence++;
  const account = await auth.register({ name: 'User ' + sequence, email: 'user' + sequence + '@example.test', password: 'original-password' });
  return { ...account, id: String(account.user.id) };
}
async function ready(owner, title = 'Actual Resume') {
  return Resume.create({ owner, title, rawText: JSON.stringify(facts), parsedData: facts, processingStatus: 'COMPLETED' });
}
async function finished(jobId) {
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    const job = await Job.findById(jobId);
    if (job && ['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status)) {
      await waitForJobs([jobId]);
      return Job.findById(jobId);
    }
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
  throw new Error('Timed out waiting for processing job ' + jobId);
}
async function successfulJob(response) {
  assert.equal(response.status, 202, JSON.stringify(response.data));
  const job = await finished(response.data.data.jobId);
  assert.equal(job.status, 'COMPLETED', JSON.stringify(job.error));
  return job.output;
}
async function socketFor(token) {
  const socket = connectSocket(base, { auth: token ? { token } : {}, transports: ['websocket'], reconnection: false, timeout: 2000 });
  clients.push(socket);
  await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
  return socket;
}
test('01: multiple independent local users can register with the real unique index', async () => {
  for (let index = 0; index < 3; index++) {
    const response = await request('POST', '/api/auth/register', { body: {
      name: 'Local ' + index, email: 'local' + index + '@example.test', password: 'test-password',
    } });
    assert.equal(response.status, 201, JSON.stringify(response.data));
  }
  assert.equal(await User.countDocuments(), 3);
  assert.equal(await User.collection.countDocuments({ firebaseUid: '' }), 0);
});
test('02,03: profile updates cannot change roles, identities or password hashes', async () => {
  const account = await user();
  for (const body of [{ role: 'admin' }, { email: 'changed@example.test' }, { firebaseUid: 'other-id' }, { password: 'plaintext' }]) {
    const response = await request('PUT', '/api/auth/me', { token: account.token, body });
    assert.equal(response.status, 400);
  }
  const stored = await User.findById(account.id).select('+password');
  assert.equal(stored.role, 'user'); assert(stored.password.startsWith('$2'));
  const change = await request('PUT', '/api/auth/password', { token: account.token,
    body: { currentPassword: 'original-password', newPassword: 'replacement-password' } });
  assert.equal(change.status, 200);
  assert.notEqual((await User.findById(account.id).select('+password')).password, 'replacement-password');
  assert((await auth.login({ email: account.user.email, password: 'replacement-password' })).token);
  await assert.rejects(auth.login({ email: account.user.email, password: 'original-password' }));
});
test('04: only verified Google identities can link an existing local account', async () => {
  const account = await user(), original = auth.verifyFirebaseToken;
  try {
    auth.verifyFirebaseToken = async () => ({ uid: 'attacker', email: account.user.email, email_verified: false, firebase: { sign_in_provider: 'password' } });
    await assert.rejects(auth.firebaseLogin({ idToken: 'synthetic' }), (error) => error.statusCode === 401);
    auth.verifyFirebaseToken = async () => ({ uid: 'verified-identity', email: account.user.email, email_verified: true, firebase: { sign_in_provider: 'google.com' } });
    assert.equal(String((await auth.firebaseLogin({ idToken: 'synthetic' })).user.id), account.id);
    auth.verifyFirebaseToken = async () => ({ uid: 'different-identity', email: account.user.email, email_verified: true, firebase: { sign_in_provider: 'google.com' } });
    await assert.rejects(auth.firebaseLogin({ idToken: 'synthetic' }), (error) => error.statusCode === 409);
  } finally { auth.verifyFirebaseToken = original; }
});
test('05,06: sockets and timeline APIs isolate two users and reject unauthenticated sockets', async () => {
  const a = await user(), b = await user(), job = await Job.create({ owner: a.id, jobType: 'resume_parse' });
  await Log.create({ owner: a.id, jobId: job._id, agent: 'parser', message: 'PRIVATE_A' });
  assert.equal((await request('GET', '/api/processing-jobs/' + job._id + '/timeline', { token: b.token })).status, 404);
  assert.equal((await request('GET', '/api/processing-jobs/' + job._id + '/timeline', { token: a.token })).data.data[0].message, 'PRIVATE_A');
  await assert.rejects(socketFor(), /Not authorized/);
  const socketA = await socketFor(a.token), socketB = await socketFor(b.token);
  assert.equal((await socketB.timeout(1000).emitWithAck('join_job', String(job._id))).success, false);
  assert.equal((await socketB.timeout(1000).emitWithAck('join_user', a.id)).success, false);
  let leaked = false, globalBroadcast = false, count = 0;
  socketB.on('agent_event', () => { leaked = true; }); socketB.on('notification', () => { leaked = true; });
  socketB.on('job_timeline_update', () => { globalBroadcast = true; });
  socketA.on('agent_event', () => { count++; });
  assert.equal((await socketA.timeout(1000).emitWithAck('join_job', String(job._id))).success, true);
  const received = new Promise((resolve) => socketA.once('agent_event', resolve));
  emitAgentEvent(job._id, a.id, { message: 'PRIVATE_EVENT' }); emitNotification(a.id, { message: 'PRIVATE_NOTIFICATION' });
  assert.equal((await received).message, 'PRIVATE_EVENT');
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(leaked, false); assert.equal(globalBroadcast, false); assert.equal(count, 1);
});
test('07,08,28,29: uploads are private, replayable and complete with honest parsed facts', async () => {
  const a = await user(), b = await user();
  const text = 'Jane Doe\njane@example.test\nSkills\nC++, C#, .NET, Rust\nEducation\nActual Degree\nActual University\n2024';
  const form = new FormData(); form.append('file', new Blob([text], { type: 'text/plain' }), 'resume.txt');
  const response = await request('POST', '/api/resumes/upload', { token: a.token, body: form });
  const output = await successfulJob(response), id = output.resume._id;
  assert.equal(output.resume.processingStatus, 'COMPLETED');
  assert.deepEqual(output.resume.parsedData.workExperience, []);
  assert(output.resume.parsingWarnings.length);
  assert.equal((await request('GET', '/api/resumes/' + id + '/original')).status, 401);
  assert.equal((await request('GET', '/api/resumes/' + id + '/original', { token: b.token })).status, 404);
  assert.equal((await request('GET', '/api/resumes/' + id + '/original', { token: a.token })).data.toString(), text);
  const stored = await Resume.findById(id);
  assert.equal((await request('GET', '/uploads/' + stored.originalFileStorage.filename)).status, 404);
  const timeline = await request('GET', '/api/processing-jobs/' + response.data.data.jobId + '/timeline', { token: a.token });
  assert(timeline.data.data.some((event) => event.step === 'job_completed'));
  assert((await finished(response.data.data.jobId)).inputRef.rawInput === undefined);
  await require('../src/services/resumeService').deleteResume(id, a.id);
  await assert.rejects(fs.stat(path.join(require('../src/config/cloudinary').uploadsDir, stored.originalFileStorage.filename)), { code: 'ENOENT' });
});
test('13,22,23,24,47: queued tailoring preserves sections, exports a complete PDF and allocates unique versions', async () => {
  const account = await user(), resume = await ready(account.id);
  await Resume.updateOne({ _id: resume._id }, { $push: { 'parsedData.skills.all': 'Communication', 'parsedData.skills.soft': 'Communication' } });
  const [first, second] = await Promise.all(['Backend Engineer', 'Data / ML Engineer'].map((targetRole) =>
    request('POST', '/api/resumes/' + resume._id + '/tailor', { token: account.token, body: { targetRole, jobDescriptionText: 'Rust required' } })));
  const outputs = await Promise.all([successfulJob(first), successfulJob(second)]);
  assert.equal(new Set(outputs.map((output) => output.tailoredResume.version)).size, 2);
  const version = outputs[0].tailoredResume;
  assert.equal(version.atsScore.structureScore, 100);
  assert.equal(version.tailoredContent.education[0].institution, 'Actual University');
  assert(version.tailoredContent.skills.soft.includes('Communication'));
  const pdf = await request('GET', '/api/resumes/' + resume._id + '/download/' + version._id, { token: account.token });
  assert.equal(pdf.status, 200);
  const pdfText = await require('../src/agents/parserAgent').extractTextFromBuffer(pdf.data, 'pdf');
  for (const fact of ['Actual University', 'Actual Certificate', 'Actual project description', 'https://example.test/project']) assert(pdfText.includes(fact), fact);
  assert(!pdfText.includes('42%'));
  assert(pdfText.includes('Communication'));
  const index = (await Tailored.collection.indexes()).find((item) => item.name === 'resumeId_1_version_1');
  assert.equal(index.unique, true);
});
test('13,20,27: an eight-question JD-aware interview completes after all eight answers', async () => {
  const account = await user(), resume = await ready(account.id);
  const jd = await Description.create({ owner: account.id, targetRole: 'Backend Engineer', rawText: 'Docker required' });
  const generated = await successfulJob(await request('POST', '/api/interview/sessions', { token: account.token,
    body: { resumeId: String(resume._id), targetRole: 'Backend Engineer', count: 8, jobDescriptionId: String(jd._id) } }));
  assert.equal(generated.questions.length, 8); assert(generated.questions[0].questionText.includes('Docker'));
  // Submit independently queued answers concurrently to exercise atomic session aggregates.
  const responses = await Promise.all(generated.questions.map((question) => request('POST',
    '/api/interview/sessions/' + generated.session._id + '/questions/' + question._id + '/answer', {
      token: account.token, body: { userAnswer: 'I define requirements and constraints, compare alternatives and trade-offs, then validate using tests and plan failure recovery.' },
    })));
  await Promise.all(responses.map(successfulJob));
  const session = await Session.findById(generated.session._id);
  assert.equal(session.answeredCount, 8); assert.equal(session.totalQuestions, 8); assert.equal(session.status, 'completed');
  assert(session.overallScore > 0);
  const analytics = await require('../src/services/interviewService').getAnalytics(account.id);
  assert.equal(analytics.completedSessions, 1); assert.equal(analytics.scoreTrends.length, 1);
});
test('25,47: a queued request returns before generation, and cancellation prevents result persistence', async () => {
  const account = await user(), resume = await ready(account.id);
  const original = generator.tailorResume;
  let begin, release;
  const began = new Promise((resolve) => { begin = resolve; }), gate = new Promise((resolve) => { release = resolve; });
  generator.tailorResume = async (params) => { begin(); await gate; return original.call(generator, params); };
  try {
    const response = await request('POST', '/api/resumes/' + resume._id + '/tailor', {
      token: account.token, body: { targetRole: 'Backend Engineer' },
    });
    assert.equal(response.status, 202); await began;
    const cancelled = await request('POST', '/api/processing-jobs/' + response.data.data.jobId + '/cancel', { token: account.token });
    assert.equal(cancelled.status, 200); release();
    const job = await finished(response.data.data.jobId);
    assert.equal(job.status, 'CANCELLED'); assert.equal(await Tailored.countDocuments(), 0);
  } finally { release(); generator.tailorResume = original; }
});
test('26: failed question generation creates no orphan session', async () => {
  const account = await user(), resume = await ready(account.id), original = generator.generateQuestions;
  generator.generateQuestions = async () => { throw new Error('controlled generation failure'); };
  try {
    const response = await request('POST', '/api/interview/sessions', { token: account.token,
      body: { resumeId: String(resume._id), targetRole: 'Frontend Engineer', count: 5 } });
    assert.equal((await finished(response.data.data.jobId)).status, 'FAILED');
    assert.equal(await Session.countDocuments(), 0); assert.equal(await Question.countDocuments(), 0);
  } finally { generator.generateQuestions = original; }
});
test('30: dependent actions reject a resume that is not ready', async () => {
  const account = await user(), resume = await Resume.create({ owner: account.id });
  const response = await request('POST', '/api/resumes/' + resume._id + '/tailor', { token: account.token, body: { targetRole: 'Backend Engineer' } });
  assert.equal(response.status, 409); assert.equal(await Job.countDocuments(), 0);
});
test('31,32,33: application weeks, progression history and editable application dates stay correct', async () => {
  const account = await user(), service = require('../src/services/applicationService');
  const saved = await service.createApplication(account.id, { company: 'Saved Co', roleTitle: 'Engineer' });
  assert.equal(saved.appliedDate, null);
  const applied = await service.updateApplication(saved._id, account.id, { status: 'applied' });
  assert(applied.appliedDate instanceof Date);
  await service.updateApplication(saved._id, account.id, { appliedDate: '2026-01-02', status: 'interview' });
  const before = await service.getAnalytics(account.id);
  await service.updateApplication(saved._id, account.id, { status: 'rejected' });
  const after = await service.getAnalytics(account.id);
  assert.equal(after.conversionRates.appliedToOa, before.conversionRates.appliedToOa);
  assert.equal(after.conversionRates.oaToInterview, 100);
  await service.createApplication(account.id, { company: 'February Co', roleTitle: 'Engineer', status: 'applied', appliedDate: '2026-02-02' });
  const analytics = await service.getAnalytics(account.id);
  assert.equal(analytics.weeklyVolume.length, 2);
  assert.equal((await Application.findById(saved._id)).appliedDate.toISOString().slice(0, 10), '2026-01-02');
  await assert.rejects(service.updateApplication(saved._id, account.id, { appliedDate: 'invalid' }), (error) => error.statusCode === 400);
});
test('35: recent dashboard inventory includes the newest upload', async () => {
  const account = await user();
  for (let index = 0; index < 7; index++) await ready(account.id, 'Resume ' + index);
  const dashboard = await require('../src/services/resumeService').getDashboardMetrics(account.id);
  assert.equal(dashboard.recentResumes.length, 5); assert.equal(dashboard.recentResumes[0].title, 'Resume 6');
});

test('Legacy and offline-parsed resumes recover source details for a new tailored version through Groq', async () => {
  const account = await user(), resume = await ready(account.id);
  const raw = 'Actual source detail. '.repeat(450) + 'LATE_PROJECT_EVIDENCE';
  await Resume.updateOne({ _id: resume._id }, { $set: { rawText: raw } });
  const factory = require('../src/providers/providerFactory'), groq = factory.groq;
  const original = { available: groq.isAvailable, parse: groq.parseResume, tailor: groq.tailorResume, score: groq.scoreATS };
  const complete = structuredClone(facts);
  complete.projects.push({ title: 'Late Project', description: 'A Rust validation demonstration.', link: '', technologies: ['Rust'], highlights: ['Validated Rust input.'] });
  let received;
  groq.isAvailable = () => true;
  groq.parseResume = async (text) => { received = text; return complete; };
  groq.tailorResume = (params) => factory.deterministic.tailorResume(params);
  groq.scoreATS = (params) => factory.deterministic.scoreATS(params);
  try {
    const output = await successfulJob(await request('POST', '/api/resumes/' + resume._id + '/tailor', {
      token: account.token, body: { targetRole: 'Backend Engineer' },
    }));
    assert.equal(received, raw);
    assert(output.tailoredResume.tailoredContent.projects.some((project) => project.title === 'Late Project'));
    assert.equal(output.aiProvider, 'groq');
    await Resume.updateOne({ _id: resume._id }, { $set: { rawText: 'SHORT_SOURCE_EVIDENCE', aiProvider: 'deterministic-fallback', parsingInputLength: 21 } });
    const shortOutput = await successfulJob(await request('POST', '/api/resumes/' + resume._id + '/tailor', {
      token: account.token, body: { targetRole: 'Backend Engineer' },
    }));
    assert.equal(received, 'SHORT_SOURCE_EVIDENCE');
    assert(shortOutput.tailoredResume.tailoredContent.projects.some((project) => project.title === 'Late Project'));
    assert.equal((await Resume.findById(resume._id)).parsedData.projects.length, facts.projects.length);
  } finally {
    groq.isAvailable = original.available; groq.parseResume = original.parse;
    groq.tailorResume = original.tailor; groq.scoreATS = original.score;
  }
});
test('39,40: notifications are owned, and resume deletion removes derived private data', async () => {
  const account = await user(), resume = await ready(account.id);
  await successfulJob(await request('POST', '/api/resumes/' + resume._id + '/gap-analysis', {
    token: account.token, body: { jobDescriptionText: 'Python required', targetRole: 'Backend Engineer' },
  }));
  const generated = await successfulJob(await request('POST', '/api/interview/sessions', { token: account.token,
    body: { resumeId: String(resume._id), targetRole: 'Backend Engineer', count: 3 } }));
  assert.equal((await request('GET', '/api/notifications', { token: account.token })).data.unreadCount, 2);
  assert((await request('POST', '/api/notifications/mark-all-read', { token: account.token })).data.success);
  assert.equal((await request('GET', '/api/notifications', { token: account.token })).data.unreadCount, 0);
  const response = await request('DELETE', '/api/resumes/' + resume._id, { token: account.token });
  assert.equal(response.status, 200);
  for (const model of [Resume, Tailored, Gap, Job, Log, Session, Question, Description, Notification]) {
    assert.equal(await model.countDocuments(), 0, model.modelName);
  }
  assert.equal((await request('GET', '/api/interview/sessions/' + generated.session._id, { token: account.token })).status, 404);
});
test('45,49,50: CORS rejects untrusted origins and uploads reject invalid types as client errors', async () => {
  assert.equal((await request('GET', '/api/health', { headers: { Origin: 'https://untrusted.example' } })).status, 403);
  const allowed = await request('GET', '/api/health', { headers: { Origin: 'http://localhost:3000' } });
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:3000');
  const account = await user();
  for (const name of ['legacy.doc', 'resume.html']) {
    const form = new FormData(); form.append('file', new Blob(['synthetic']), name);
    assert.equal((await request('POST', '/api/resumes/upload', { token: account.token, body: form })).status, 415);
  }
  assert.equal(await Resume.countDocuments(), 0);
});
test('01,03,13,24: legacy data migration repairs empty UIDs, unhashed passwords, counts and duplicate versions', async () => {
  const account = await user(), resume = await ready(account.id);
  const legacy = await User.collection.insertOne({ name: 'Legacy', email: 'legacy@example.test', firebaseUid: '',
    password: 'legacy-plaintext', role: 'user', authProvider: 'local' });
  await Tailored.collection.dropIndex('resumeId_1_version_1');
  await Tailored.collection.insertMany([1, 1].map((version) => ({
    owner: new mongoose.Types.ObjectId(account.id), resumeId: resume._id, targetRole: 'Engineer', version, createdAt: new Date(),
  })));
  const session = await Session.collection.insertOne({ owner: new mongoose.Types.ObjectId(account.id), resumeId: resume._id,
    targetRole: 'Engineer', status: 'in_progress', totalQuestions: 5, answeredCount: 0 });
  await Question.create({ sessionId: session.insertedId, questionText: 'Question', suggestedAnswer: 'Answer',
    feedback: { overallScore: 70, clarityScore: 70, relevanceScore: 70, technicalScore: 70, structureScore: 70 }, answeredAt: new Date() });
  await require('../src/config/migrateData').migrateData();
  const migrated = await User.findById(legacy.insertedId).select('+password');
  assert.equal(migrated.firebaseUid, undefined); assert(await migrated.comparePassword('legacy-plaintext'));
  assert.equal((await Session.findById(session.insertedId)).status, 'completed');
  assert.equal((await Session.findById(session.insertedId)).totalQuestions, 1);
  assert.deepEqual((await Tailored.find({ resumeId: resume._id }).sort({ version: 1 })).map((version) => version.version), [1, 2]);
});
test('44: readiness becomes unavailable when MongoDB disconnects', async () => {
  await mongoose.disconnect();
  const response = await request('GET', '/api/health');
  assert.equal(response.status, 503); assert.equal(response.data.status, 'not_ready');
  await connectDB({ uri: db.getUri() });
});

test('43: an unavailable configured database falls back in development and fails closed in production', async () => {
  const env = require('../src/config/env');
  await disconnectDB();
  const fallbackDirectory = await fs.mkdtemp(path.join(testRoot, 'fallback-'));
  const binaryPath = path.resolve(__dirname, '../node_modules/.cache/mongodb-memory-server/mongod-x64-win32-7.0.24.exe');
  const binary = process.env.MONGOMS_SYSTEM_BINARY ? { systemBinary: process.env.MONGOMS_SYSTEM_BINARY } :
    await fs.stat(binaryPath).then(() => ({ systemBinary: binaryPath }), () => ({}));
  try {
    await connectDB({ uri: 'mongodb://127.0.0.1:1/unavailable', memoryOptions: {
      binary, instance: { dbPath: fallbackDirectory, ip: '127.0.0.1' },
    } });
    assert.equal(mongoose.connection.readyState, 1);
    assert.equal(await User.countDocuments(), 0);
    await disconnectDB();
    env.NODE_ENV = 'production';
    await assert.rejects(connectDB({ uri: '' }), /requires an available MONGODB_URI/);
  } finally {
    env.NODE_ENV = 'test'; await disconnectDB(); await connectDB({ uri: db.getUri() });
    if (path.resolve(fallbackDirectory).startsWith(testRoot + path.sep)) await fs.rm(fallbackDirectory, { recursive: true, force: true });
  }
});
