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
  await User.updateOne({ _id: account.user.id }, { $set: { emailVerifiedAt: new Date(), 'privacy.providers': { groq: true, openrouter: true, gemini: true } } });
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
  assert(session.overallScore > 0, JSON.stringify(session.toObject()));
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

test('Career profiles and editable resumes validate fields, protect ownership and preserve revision history', async () => {
  const a = await user(), b = await user();
  const initial = (await request('GET', '/api/profile', { token: a.token })).data.data;
  assert.equal(initial.revision, 0); assert.equal(initial.content.contactInfo.email, a.user.email);
  const payload = { revision: 0, content: facts, targetRole: 'Backend Engineer', experienceLevel: 'early', onboardingCompleted: true };
  assert.equal((await request('PUT', '/api/profile', { token: a.token, body: { ...payload, role: 'admin' } })).status, 400);
  assert.equal((await request('PUT', '/api/profile', { token: a.token, body: payload })).data.data.revision, 1);
  assert.equal((await request('PUT', '/api/profile', { token: a.token, body: payload })).status, 409);
  assert.equal((await request('GET', '/api/profile', { token: b.token })).data.data.content.workExperience.length, 0);
  const created = await request('POST', '/api/profile/resumes', { token: a.token, body: { title: 'Verified facts' } });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const id = created.data.data._id;
  const edited = structuredClone(facts); edited.projects[0].description = 'Verified user contribution to Python validation.';
  const body = { revision: 1, title: 'Edited facts', content: edited };
  assert.equal((await request('PUT', '/api/resumes/' + id + '/content', { token: b.token, body })).status, 404);
  const saved = await request('PUT', '/api/resumes/' + id + '/content', { token: a.token, body });
  assert.equal(saved.data.data.contentRevision, 2); assert.equal(saved.data.data.atsScoreStale, true);
  assert.equal((await request('PUT', '/api/resumes/' + id + '/content', { token: a.token, body })).status, 409);
  const restored = await request('POST', '/api/resumes/' + id + '/restore', { token: a.token, body: { revision: 2, restoreRevision: 1 } });
  assert.equal(restored.data.data.contentRevision, 3); assert.equal(restored.data.data.parsedData.projects[0].description, facts.projects[0].description);
  const history = await request('GET', '/api/resumes/' + id + '/history', { token: a.token });
  assert.equal(history.data.data.length, 3);
});

test('Job workspaces reuse descriptions, isolate accounts and freeze the resume submitted with an application', async () => {
  const a = await user(), b = await user(), resume = await ready(a.id);
  const body = { company: 'Target Co', title: 'Backend Engineer', description: 'Docker and Python required', resumeId: String(resume._id), jobUrl: 'https://example.test/job' };
  const saved = await request('POST', '/api/workspaces', { token: a.token, body });
  assert.equal(saved.status, 201, JSON.stringify(saved.data)); const id = saved.data.data._id;
  assert.equal((await request('GET', '/api/workspaces/' + id, { token: b.token })).status, 404);
  assert.equal((await request('POST', '/api/workspaces/' + id + '/tailor', { token: b.token, body: {} })).status, 404);
  const output = await successfulJob(await request('POST', '/api/workspaces/' + id + '/tailor', { token: a.token, body: {} }));
  await successfulJob(await request('POST', '/api/workspaces/' + id + '/analyze', { token: a.token, body: {} }));
  const interview = await successfulJob(await request('POST', '/api/workspaces/' + id + '/interview', { token: a.token, body: { difficulty: 'Hard', count: 3 } }));
  assert.equal(interview.questions.length, 3); assert(interview.questions.every((item) => item.difficulty === 'Hard'));
  assert.equal(await Description.countDocuments(), 1);
  const details = (await request('GET', '/api/workspaces/' + id, { token: a.token })).data.data;
  assert.equal(details.versions.length, 1); assert.equal(details.interviews.length, 1); assert(details.gap);
  const version = output.tailoredResume, application = await request('POST', '/api/applications', { token: a.token, body: {
    company: 'Target Co', roleTitle: 'Backend Engineer', workspaceId: id, resumeVersionId: version._id,
    deadline: '2026-01-02', followUpAt: '2026-01-05', notes: 'Follow up with the recruiter',
  } });
  assert.equal(application.status, 201, JSON.stringify(application.data));
  const snapshot = application.data.data.resumeSnapshot;
  await request('PUT', '/api/resumes/' + resume._id + '/versions/' + version._id, { token: a.token, body: { revision: 1, content: { ...version.tailoredContent, summary: 'Changed after application was saved' } } });
  assert.equal((await Application.findById(application.data.data._id)).resumeSnapshot.content.summary, snapshot.content.summary);
  assert.equal((await request('GET', '/api/applications?search=Target&due=1', { token: a.token })).data.data.length, 1);
  assert.equal((await request('POST', '/api/applications', { token: b.token, body: { company: 'Other', roleTitle: 'Other', resumeVersionId: version._id } })).status, 404);
  assert.equal((await request('PUT', '/api/workspaces/' + id, { token: a.token, body: { ...body, revision: 0 } })).status, 409);
});
test('Repeated assessments reuse a stable input snapshot and detect edits', async () => {
  const a = await user(), resume = await ready(a.id), factory = require('../src/providers/providerFactory'), original = factory.deterministic.scoreATS;
  let calls = 0; factory.deterministic.scoreATS = async (params) => { calls++; return original.call(factory.deterministic, params); };
  try {
    const url = '/api/resumes/' + resume._id + '/assess';
    const first = await successfulJob(await request('POST', url, { token: a.token, body: {} }));
    const second = await successfulJob(await request('POST', url, { token: a.token, body: {} }));
    assert.equal(first.assessment.score, second.assessment.score); assert.equal(calls, 1); assert.equal(second.assessment.assessmentMeta.cached, true);
    await request('PUT', '/api/resumes/' + resume._id + '/content', { token: a.token, body: { revision: 1, content: { ...facts, summary: facts.summary + ' Additional verified detail.' } } });
    assert.equal((await Resume.findById(resume._id)).atsScoreStale, true);
    const third = await successfulJob(await request('POST', url, { token: a.token, body: {} }));
    assert.notEqual(first.assessment.assessmentMeta.fingerprint, third.assessment.assessmentMeta.fingerprint); assert.equal(calls, 2);
    await require('../src/models/AssessmentCache').updateOne({ owner: a.id, fingerprint: third.assessment.assessmentMeta.fingerprint }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    await successfulJob(await request('POST', url, { token: a.token, body: {} }));
    assert.equal(calls, 3);
  } finally { factory.deterministic.scoreATS = original; }
});

test('Failed jobs retain encrypted retry inputs and owned retries complete without duplicate artifacts', async () => {
  const a = await user(), b = await user(), resume = await ready(a.id), original = generator.tailorResume;
  const secret = 'PRIVATE_SYNTHETIC_JOB_INPUT';
  let response;
  generator.tailorResume = async () => { throw new Error('Controlled transient provider failure'); };
  try {
    response = await request('POST', '/api/resumes/' + resume._id + '/tailor', { token: a.token, body: { targetRole: 'Backend Engineer', jobDescriptionText: secret } });
    const failed = await finished(response.data.data.jobId);
    assert.equal(failed.status, 'FAILED'); assert.equal(failed.inputRef.rawInput, undefined);
    const payload = await require('../src/models/JobPayload').findOne({ jobId: failed._id });
    assert(payload); assert(!payload.ciphertext.includes(Buffer.from(secret)));
    assert.equal((await request('GET', '/api/processing-jobs/' + failed._id, { token: a.token })).data.data.inputRef.rawInput, undefined);
    assert.equal((await request('POST', '/api/processing-jobs/' + failed._id + '/retry', { token: b.token, body: {} })).status, 409);
  } finally { generator.tailorResume = original; }
  const retried = await successfulJob(await request('POST', '/api/processing-jobs/' + response.data.data.jobId + '/retry', { token: a.token, body: {} }));
  assert.equal(await Tailored.countDocuments(), 1); assert.equal(retried.tailoredResume.jobDescriptionText, secret);
  assert.equal(await require('../src/models/JobPayload').countDocuments(), 0);
  const usage = (await request('GET', '/api/processing-jobs/usage', { token: a.token })).data.data;
  assert(usage.providerAttempts > 0); assert.equal(usage.completed, 1);
});
test('Expired worker leases recover a committed resume version and a partially inserted question set exactly once', async () => {
  const a = await user(), resume = await ready(a.id), create = require('../src/services/jobService').createJob;
  const tailorJob = await create({ userId: a.id, jobType: 'resume_tailor', inputRef: { resumeId: resume._id, targetRole: 'Engineer', rawInput: { targetRole: 'Engineer' } } });
  const version = await Tailored.create({ owner: a.id, resumeId: resume._id, processingJobId: tailorJob._id, targetRole: 'Engineer', version: 1, tailoredContent: facts });
  const questionJob = await create({ userId: a.id, jobType: 'question_generation', inputRef: { resumeId: resume._id, targetRole: 'Engineer', rawInput: { count: 2 } } });
  const pending = [1, 2].map((order) => ({ _id: new mongoose.Types.ObjectId(), questionText: 'Question ' + order, suggestedAnswer: 'Answer', topic: 'Testing', order }));
  const session = await Session.create({ owner: a.id, resumeId: resume._id, targetRole: 'Engineer', totalQuestions: 2, processingJobId: questionJob._id, pendingQuestions: pending });
  await Question.create({ ...pending[0], sessionId: session._id });
  for (const job of [tailorJob, questionJob]) await Job.collection.updateOne({ _id: job._id }, { $set: { status: 'COMMITTING', leaseOwner: 'stopped-worker', leaseExpiresAt: new Date(Date.now() - 1000), createdAt: new Date(Date.now() - 60000) } });
  const queued = [];
  await require('../src/services/jobRecovery').recoverStalled({ enqueueJob: async (job) => queued.push(job._id) });
  assert.equal(queued.length, 2);
  for (const id of queued) await require('../src/agents/orchestrator').runJob(id);
  assert.equal(await Tailored.countDocuments(), 1); assert.equal(await Session.countDocuments(), 1); assert.equal(await Question.countDocuments(), 2);
  assert.equal(String((await Job.findById(tailorJob._id)).output.tailoredResume._id), String(version._id));
  assert.equal((await Job.findById(questionJob._id)).status, 'COMPLETED');
  assert.equal((await Session.findById(session._id).select('+pendingQuestions')).pendingQuestions, undefined);
});
test('Resume exports preserve full long-form content across three layouts and editable DOCX', async () => {
  const a = await user(), resume = await ready(a.id), fixture = require('./fixtures/resumes').experienced;
  const version = await Tailored.create({ owner: a.id, resumeId: resume._id, targetRole: 'Engineer', version: 1, tailoredContent: fixture });
  const url = '/api/resumes/' + resume._id + '/download/' + version._id;
  for (const template of ['classic', 'modern', 'compact']) {
    const response = await request('GET', url + '?template=' + template + '&preview=1', { token: a.token });
    assert.equal(response.status, 200); assert(Number(response.headers.get('x-page-count')) >= 2);
    const text = await require('../src/agents/parserAgent').extractTextFromBuffer(response.data, 'pdf');
    for (const fact of ['Example Company 6', 'Validation Project 4', 'Example Python Course', 'Example University']) assert(text.includes(fact), template + ': ' + fact);
    await fs.writeFile(path.join(testRoot, 'export-' + template + '.pdf'), response.data);
  }
  assert.equal(await require('../src/models/ProductEvent').countDocuments(), 0);
  const docx = await request('GET', url + '?format=docx', { token: a.token });
  assert.equal(docx.status, 200); assert.equal(docx.data.subarray(0, 2).toString(), 'PK');
  const text = (await require('mammoth').extractRawText({ buffer: docx.data })).value;
  assert(text.includes('Example Company 6')); assert(text.includes('Validation Project 4')); assert(text.includes('Example Python Course'));
  await fs.writeFile(path.join(testRoot, 'export-editable.docx'), docx.data);
  assert.equal(await require('../src/models/ProductEvent').countDocuments({ type: 'docx_export' }), 1);
  assert.equal((await request('GET', url + '?fontSize=6', { token: a.token })).status, 400);
});
test('Interview modes hide feedback until completion and retries replace scores without inflating counts', async () => {
  const a = await user(), resume = await ready(a.id);
  const output = await successfulJob(await request('POST', '/api/interview/sessions', { token: a.token, body: {
    resumeId: String(resume._id), targetRole: 'Backend Engineer', count: 3, difficulty: 'Easy', timeLimitSeconds: 120, feedbackMode: 'end', topicFocus: 'API design',
  } }));
  const session = output.session, questions = output.questions;
  assert(questions.every((item) => !item.suggestedAnswer && item.difficulty === 'Easy' && item.topic === 'API design'));
  const url = '/api/interview/sessions/' + session._id;
  const answer = async (question, retry, text = 'Basic answer') => successfulJob(await request('POST', url + '/questions/' + question._id + '/answer', { token: a.token, body: { userAnswer: text, retry } }));
  assert.equal((await answer(questions[0], false)).question.feedback, undefined);
  assert.equal((await request('GET', url + '/questions/' + questions[0]._id + '/suggested-answer', { token: a.token })).status, 409);
  await Promise.all(questions.slice(1).map((item) => answer(item, false)));
  const completed = (await request('GET', url, { token: a.token })).data.data;
  assert.equal(completed.session.answeredCount, 3); assert(completed.questions.every((item) => item.feedback && item.suggestedAnswer));
  const retried = await answer(questions[0], true, 'I define requirements and constraints, compare alternatives and trade-offs, then validate using tests and plan failure recovery.');
  assert.equal(retried.session.answeredCount, 3); assert.equal(retried.question.attempts.length, 1); assert.equal(retried.session.status, 'completed');
  const stored = await Question.find({ sessionId: session._id });
  assert.equal(retried.session.overallScore, Math.round(stored.reduce((sum, item) => sum + item.feedback.overallScore, 0) / 3));
  const follow = await successfulJob(await request('POST', url + '/follow-up', { token: a.token, body: { topic: 'API design' } }));
  assert.equal(follow.session.topicFocus, 'API design'); assert.equal(follow.session.resumeId.toString(), resume._id.toString());
});
test('Reviewed versions export saved choices; scoped rewrites and review revisions remain owned', async () => {
  const a = await user(), b = await user(), resume = await ready(a.id);
  const { tailoredResume: version } = await successfulJob(await request('POST', '/api/resumes/' + resume._id + '/tailor', { token: a.token, body: { targetRole: 'Backend Engineer' } }));
  const url = '/api/resumes/' + resume._id + '/versions/' + version._id;
  const content = structuredClone(version.tailoredContent); content.summary = 'Verified edited summary for Python engineering.';
  const body = { revision: 1, content, decisions: { summary: 'edited', 0: 'rejected' } };
  assert.equal((await request('PUT', url, { token: b.token, body })).status, 404);
  assert.equal((await request('PUT', url, { token: a.token, body })).data.data.contentRevision, 2);
  assert.equal((await request('PUT', url, { token: a.token, body })).status, 409);
  const pdf = await request('GET', '/api/resumes/' + resume._id + '/download/' + version._id, { token: a.token });
  assert((await require('../src/agents/parserAgent').extractTextFromBuffer(pdf.data, 'pdf')).includes(content.summary));
  const rewrite = await successfulJob(await request('POST', url + '/regenerate', { token: a.token, body: { section: 'projects', index: 0 } }));
  assert.equal(rewrite.section, 'projects'); assert.equal(rewrite.value.title, facts.projects[0].title);
  assert.equal((await Tailored.findById(version._id)).reviewedContent.summary, content.summary);
  assert.equal((await request('POST', url + '/regenerate', { token: a.token, body: { section: 'projects', index: -1 } })).status, 400);
  assert.equal((await request('POST', url + '/restore', { token: a.token, body: { revision: 2, restoreRevision: 1 } })).data.data.contentRevision, 3);
});

test('Phase 1: verification is single-use, stored hashed, expires and gates processing before file creation', async () => {
  const account = await auth.register({ name: 'Verify Candidate', email: 'verify@example.test', password: 'fictional-password' });
  const mail = require('../src/services/accountMailService'), token = mail.testMessages.findLast((item) => item.to === account.user.email).text.match(/#token=([a-f0-9]{64})/)[1];
  const stored = await User.findById(account.user.id).select('+verificationHash');
  assert.notEqual(stored.verificationHash, token); assert.equal(stored.verificationHash, require('../src/services/privatePayload').digest(token));
  assert.equal(account.user.verificationHash, undefined);
  const form = new FormData(); form.append('file', new Blob(['Fictional Candidate\nSkills\nPython']), 'fixture.txt');
  const denied = await request('POST', '/api/resumes/upload', { token: account.token, body: form });
  assert.equal(denied.status, 403); assert.equal(denied.data.code, 'EMAIL_UNVERIFIED'); assert.equal(await Resume.countDocuments(), 0);
  await User.updateOne({ _id: stored._id }, { $set: { verificationExpiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await request('POST', '/api/auth/verify-email', { body: { token } })).status, 400);
  await User.updateOne({ _id: stored._id }, { $set: { verificationExpiresAt: new Date(Date.now() + 60000) } });
  const attempts = await Promise.all([1, 2].map(() => request('POST', '/api/auth/verify-email', { body: { token } })));
  assert.deepEqual(attempts.map((item) => item.status).sort(), [200, 400]);
  assert((await User.findById(stored._id)).emailVerifiedAt);
});
test('Phase 1: recovery has generic responses, persistent cooldown and single-use reset revokes HTTP and sockets', async () => {
  const a = await user(), b = await auth.login({ email: a.user.email, password: 'original-password' }), socket = await socketFor(a.token);
  const mail = require('../src/services/accountMailService');
  const known = await request('POST', '/api/auth/forgot-password', { body: { email: a.user.email } });
  const unknown = await request('POST', '/api/auth/forgot-password', { body: { email: 'unknown@example.test' } });
  assert.deepEqual(known.data, unknown.data);
  const count = mail.testMessages.length;
  await request('POST', '/api/auth/forgot-password', { body: { email: a.user.email } }); assert.equal(mail.testMessages.length, count);
  const token = mail.testMessages.findLast((item) => item.to === a.user.email && item.subject.startsWith('Reset')).text.match(/#token=([a-f0-9]{64})/)[1];
  const stored = await User.findById(a.id).select('+resetHash'); assert.notEqual(stored.resetHash, token);
  const disconnected = new Promise((resolve) => socket.once('disconnect', resolve));
  const results = await Promise.all([1, 2].map(() => request('POST', '/api/auth/reset-password', { body: { token, password: 'new-fictional-password' } })));
  assert.deepEqual(results.map((item) => item.status).sort(), [200, 400]); await disconnected;
  for (const token of [a.token, b.token]) assert.equal((await request('GET', '/api/auth/me', { token })).status, 401);
  await assert.rejects(auth.login({ email: a.user.email, password: 'original-password' }));
  assert((await auth.login({ email: a.user.email, password: 'new-fictional-password' })).token);
  const outbox = await require('../src/models/AccountMail').findOne({ kind: 'reset', owner: a.id }).lean(); assert.equal(outbox.payload, undefined);
});
test('Phase 1: expired reset tokens and passwords over bcrypt byte limits are rejected', async () => {
  const a = await user(), mail = require('../src/services/accountMailService'); await mail.request(a.user.email, 'reset');
  const token = mail.testMessages.findLast((item) => item.to === a.user.email && item.subject.startsWith('Reset')).text.match(/#token=([a-f0-9]{64})/)[1];
  await User.updateOne({ _id: a.id }, { $set: { resetExpiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await request('POST', '/api/auth/reset-password', { body: { token, password: 'valid-new-password' } })).status, 400);
  assert.equal((await request('POST', '/api/auth/register', { body: { name: 'Bytes', email: 'bytes@example.test', password: 'é'.repeat(40) } })).status, 400);
  assert.equal((await request('GET', '/api/auth/me', { token: a.token })).status, 200);
});
test('Phase 1: logout revokes only its session; logout-all and expiry invalidate other devices', async () => {
  const a = await user(), b = await auth.login({ email: a.user.email, password: 'original-password' });
  assert.equal((await request('GET', '/api/auth/sessions', { token: a.token })).data.data.length, 2);
  assert.equal((await request('POST', '/api/auth/logout', { token: a.token })).status, 200);
  assert.equal((await request('GET', '/api/auth/me', { token: a.token })).status, 401);
  assert.equal((await request('GET', '/api/auth/me', { token: b.token })).status, 200);
  const c = await auth.login({ email: a.user.email, password: 'original-password' });
  assert.equal((await request('POST', '/api/auth/logout-all', { token: b.token })).status, 200);
  assert.equal((await request('GET', '/api/auth/me', { token: c.token })).status, 401);
  const d = await auth.login({ email: a.user.email, password: 'original-password' });
  await require('../src/models/AuthSession').updateMany({ owner: a.id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  const expired = await request('GET', '/api/auth/me', { token: d.token }); assert.equal(expired.data.code, 'SESSION_EXPIRED');
});
test('Phase 1: export contains only owned data, includes originals and excludes secrets', async () => {
  const a = await user(), b = await user(); await ready(b.id, 'FOREIGN_PRIVATE_RESUME');
  const form = new FormData(); const original = 'Export Fictional Candidate\nSkills\nPython'; form.append('file', new Blob([original]), 'export.txt');
  await successfulJob(await request('POST', '/api/resumes/upload', { token: a.token, body: form }));
  assert.equal((await request('POST', '/api/privacy/export', { token: a.token, body: { password: 'wrong-password' } })).status, 401);
  const response = await request('POST', '/api/privacy/export', { token: a.token, body: { password: 'original-password' } });
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const zip = await require('jszip').loadAsync(response.data), json = await zip.file('account-data.json').async('string');
  assert(!json.includes('FOREIGN_PRIVATE_RESUME')); assert(!json.includes('ciphertext')); assert(!json.includes('resetHash')); assert(!json.includes(a.token)); assert(!json.includes('$2a$'));
  const data = JSON.parse(json); assert.equal(data.records.Resume.length, 1); assert.equal(data.account.email, a.user.email);
  const manifest = JSON.parse(await zip.file('manifest.json').async('string')); assert.equal(manifest.files.length, 1); assert.equal(await zip.file(manifest.files[0].filename).async('string'), original);
  await require('../src/services/resumeService').deleteResume(data.records.Resume[0]._id, a.id);
});
test('Phase 1: Google export requires fresh matching proof and rejected reauthentication preserves the app session', async () => {
  const a = await user(), verify = auth.verifyFirebaseToken;
  await User.updateOne({ _id: a.id }, { $set: { authProvider: 'firebase', firebaseUid: 'fixture-google-uid' } });
  const decoded = { uid: 'fixture-google-uid', email_verified: true, firebase: { sign_in_provider: 'google.com' }, auth_time: Math.floor(Date.now() / 1000) };
  try {
    for (const proof of [{ ...decoded, uid: 'different-user' }, { ...decoded, auth_time: decoded.auth_time - 301 }]) {
      auth.verifyFirebaseToken = async () => proof;
      const rejected = await request('POST', '/api/privacy/export', { token: a.token, body: { idToken: 'fictional-google-token' } });
      assert.equal(rejected.status, 401); assert.equal(rejected.data.code, 'REAUTH_REQUIRED');
    }
    auth.verifyFirebaseToken = async () => { throw Object.assign(new Error('Invalid identity token'), { statusCode: 401 }); };
    assert.equal((await request('POST', '/api/privacy/export', { token: a.token, body: { idToken: 'expired-fixture' } })).data.code, 'REAUTH_REQUIRED');
    assert.equal((await request('GET', '/api/auth/me', { token: a.token })).status, 200);
    auth.verifyFirebaseToken = async () => decoded;
    const exported = await request('POST', '/api/privacy/export', { token: a.token, body: { idToken: 'fictional-google-token' } });
    assert.equal(exported.status, 200); assert.equal(exported.data.subarray(0, 2).toString(), 'PK');
  } finally { auth.verifyFirebaseToken = verify; }
});
test('Phase 1: external providers require per-account consent and revocation changes assessment cache', async () => {
  const a = await user(), factory = require('../src/providers/providerFactory'), context = require('../src/services/jobContext').context;
  const available = factory.groq.isAvailable, calculate = factory.groq.scoreATS; let calls = 0;
  factory.groq.isAvailable = () => true;
  factory.groq.scoreATS = async (params) => { calls++; return factory.deterministic.scoreATS(params); };
  const privacy = require('../src/services/privacyService'), settings = await privacy.get(a.id); settings.providers = { groq: false, openrouter: false, gemini: false };
  const params = { resumeData: facts, rawText: JSON.stringify(facts), userId: a.id };
  try {
    await privacy.save(a.id, settings);
    const run = () => context.run({ owner: a.id }, () => require('../src/agents/analyzerAgent').scoreATS(params));
    assert.equal((await run()).aiProvider, 'deterministic-fallback'); assert.equal(calls, 0);
    await privacy.save(a.id, { ...settings, providers: { ...settings.providers, groq: true } });
    assert.equal((await run()).aiProvider, 'groq'); assert.equal(calls, 1);
    await privacy.save(a.id, settings); assert.equal((await run()).aiProvider, 'deterministic-fallback'); assert.equal(calls, 1);
    assert.equal((await request('PUT', '/api/privacy', { token: a.token, body: { ...settings, activityDays: 999 } })).status, 400);
  } finally { factory.groq.isAvailable = available; factory.groq.scoreATS = calculate; }
});
test('Phase 1: shorter retention removes supporting records and retry inputs without deleting resume facts', async () => {
  const a = await user(), resume = await ready(a.id), old = new Date(Date.now() - 40 * 86400000);
  const job = await Job.create({ owner: a.id, jobType: 'ats_score', status: 'COMPLETED', completedAt: old });
  await Log.collection.insertOne({ owner: new mongoose.Types.ObjectId(a.id), jobId: job._id, agent: 'monitoring', message: 'old', createdAt: old });
  await Notification.collection.insertOne({ owner: new mongoose.Types.ObjectId(a.id), createdAt: old });
  const pending = await require('../src/services/jobService').createJob({ userId: a.id, jobType: 'ats_score', inputRef: { resumeId: resume._id, rawInput: { fictional: true } } });
  await require('../src/models/JobPayload').collection.updateOne({ jobId: pending._id }, { $set: { createdAt: new Date(Date.now() - 2 * 3600000) } });
  const privacy = require('../src/services/privacyService'), settings = await privacy.get(a.id); await privacy.save(a.id, { ...settings, activityDays: 30, retryInputHours: 1 });
  assert.equal(await Job.countDocuments({ _id: job._id }), 0); assert.equal(await Log.countDocuments(), 0); assert.equal(await Notification.countDocuments(), 0);
  assert.equal(await require('../src/models/JobPayload').countDocuments({ jobId: pending._id }), 0); assert(await Resume.findById(resume._id)); assert(await Job.findById(pending._id));
});
test('Phase 1: deletion waits for active requests, retries failed file cleanup and removes every owned record', async () => {
  const a = await user(), b = await user(), other = await ready(b.id, 'Other account preserved');
  const form = new FormData(); form.append('file', new Blob(['Delete Fictional Candidate\nSkills\nPython']), 'delete.txt');
  const { resume } = await successfulJob(await request('POST', '/api/resumes/upload', { token: a.token, body: form }));
  const originalPath = require('../src/config/cloudinary').getOriginalDownload(resume).path;
  const operation = await require('../src/models/AccountOperation').create({ owner: a.id, expiresAt: new Date(Date.now() + 60000) });
  const response = await request('POST', '/api/privacy/delete', { token: a.token, body: { password: 'original-password', confirmation: 'DELETE' } });
  assert.equal(response.status, 202); const receipt = response.data.data.receipt;
  assert.equal((await request('GET', '/api/auth/me', { token: a.token })).status, 401);
  const privacy = require('../src/services/privacyService'), Deletion = require('../src/models/AccountDeletion');
  await privacy.sweepDeletions(); assert(await User.findById(a.id)); await operation.deleteOne();
  const cloud = require('../src/config/cloudinary'), originalDelete = cloud.deleteFile;
  cloud.deleteFile = async () => { throw new Error('Controlled unavailable storage'); };
  try { await Deletion.updateMany({ owner: a.id }, { $set: { nextAttemptAt: new Date(0) } }); await privacy.sweepDeletions(); assert.equal((await privacy.deletionStatus(receipt)).status, 'retrying'); }
  finally { cloud.deleteFile = originalDelete; }
  await Deletion.updateMany({ owner: a.id }, { $set: { nextAttemptAt: new Date(0) } }); await privacy.sweepDeletions();
  assert.equal((await privacy.deletionStatus(receipt)).status, 'completed'); assert.equal(await User.findById(a.id), null);
  await assert.rejects(fs.stat(originalPath), { code: 'ENOENT' });
  for (const model of Object.values(mongoose.models)) if (model.schema.path('owner') && model.modelName !== 'AccountDeletion') assert.equal(await model.countDocuments({ owner: a.id }), 0, model.modelName);
  assert(await Resume.findById(other._id));
  const publicStatus = await request('POST', '/api/privacy/deletion-status', { body: { receipt } }); assert.equal(publicStatus.status, 200); assert(!JSON.stringify(publicStatus.data).includes(a.user.email));
  const completed = await Deletion.findOne({ receiptHash: require('../src/services/privatePayload').digest(receipt) }).lean(); assert.equal(completed.owner, undefined); assert.equal(completed.emailHash, undefined); assert.equal(completed.files?.length || 0, 0);
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
