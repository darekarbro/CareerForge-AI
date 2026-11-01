module.exports = ({ test, assert, request, user, ready, successfulJob, Resume }) => {
  const Job = require('../src/models/ProcessingJob'), Question = require('../src/models/InterviewQuestion'), Session = require('../src/models/InterviewSession');
  const library = require('../src/services/evidenceService'), Workspace = require('../src/models/JobWorkspace');
  const fact = (resume, section, entryId, statement) => ({ kind: 'achievement', title: 'Confirmed contribution', statement, technologies: ['Python'], verification: 'confirmed', measurement: 'unknown', measurementNotes: '', context: { section, entryId, recordId: String(resume._id) } });
  test('Main audit: malformed authentication inputs fail as client errors and private responses cannot be cached', async () => {
    const a = await user();
    for (const password of [{ $ne: '' }, ['original-password'], 'x'.repeat(129)]) {
      const response = await request('POST', '/api/auth/login', { body: { email: a.user.email, password } }); assert.equal(response.status, 400);
    }
    for (const fields of [{ name: { value: 'name' } }, { name: 'x'.repeat(121) }, { name: 'Valid Name', targetRolePreference: 'x'.repeat(121) }]) assert.equal((await request('POST', '/api/auth/register', { body: { email: 'invalid@example.test', password: 'valid-password', ...fields } })).status, 400);
    assert.equal((await request('POST', '/api/auth/firebase', { body: { idToken: { token: 'not-a-string' } } })).status, 400);
    const response = await request('GET', '/api/auth/me', { token: a.token }); assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /private.*no-store/);
  });
  test('Main audit: application links are normalized and impossible dates are rejected', async () => {
    const a = await user(), created = await request('POST', '/api/applications', { token: a.token, body: { company: 'Example', roleTitle: 'Engineer', jobLink: 'example.test/jobs/1', deadline: '2026-12-01' } });
    assert.equal(created.status, 201); assert.equal(created.data.data.jobLink, 'https://example.test/jobs/1');
    const url = '/api/applications/' + created.data.data._id;
    const changed = await request('PUT', url, { token: a.token, body: { revision: 1, jobLink: 'example.test/jobs/2' } }); assert.equal(changed.data.data.jobLink, 'https://example.test/jobs/2');
    for (const deadline of [false, [], '2026-02-30', '2026-13-01']) assert.equal((await request('PUT', url, { token: a.token, body: { revision: 2, deadline } })).status, 400);
  });
  test('Main audit: verified Google ownership invalidates an unverified local password and its sessions', async () => {
    const auth = require('../src/services/authService'), verify = auth.verifyFirebaseToken;
    const prior = await auth.register({ name: 'Unverified registration', email: 'identity-owner@example.test', password: 'previous-password' });
    auth.verifyFirebaseToken = async () => ({ uid: 'verified-google-owner', email: 'identity-owner@example.test', email_verified: true, firebase: { sign_in_provider: 'google.com' }, name: 'Verified owner' });
    try {
      const login = await request('POST', '/api/auth/firebase', { body: { idToken: 'synthetic-google-proof' } }); assert.equal(login.status, 200);
      assert.equal(login.data.data.user.id, prior.user.id.toString()); assert.equal(login.data.data.user.authProvider, 'firebase');
      assert.equal((await request('GET', '/api/auth/me', { token: prior.token })).status, 401);
      assert.equal((await request('POST', '/api/auth/login', { body: { email: 'identity-owner@example.test', password: 'previous-password' } })).status, 401);
      assert.equal((await request('GET', '/api/auth/me', { token: login.data.data.token })).status, 200);
    } finally { auth.verifyFirebaseToken = verify; }
  });
  test('Main audit: moving, unlinking and deleting applications removes obsolete workspace references', async () => {
    const a = await user(), create = async (company) => (await request('POST', '/api/workspaces', { token: a.token, body: { company, title: 'Engineer', description: 'Python validation for ' + company } })).data.data;
    const first = await create('First'), second = await create('Second');
    const app = (await request('POST', '/api/applications', { token: a.token, body: { company: 'Example', roleTitle: 'Engineer', workspaceId: first._id } })).data.data;
    const url = '/api/applications/' + app._id;
    assert.equal((await request('PUT', url, { token: a.token, body: { revision: 1, workspaceId: second._id } })).status, 200);
    assert.equal((await Workspace.findById(first._id)).applicationId, undefined); assert.equal(String((await Workspace.findById(second._id)).applicationId), app._id);
    await request('PUT', url, { token: a.token, body: { revision: 2, workspaceId: '' } }); assert.equal((await Workspace.findById(second._id)).applicationId, undefined);
    await request('PUT', url, { token: a.token, body: { revision: 3, workspaceId: first._id } }); await request('DELETE', url, { token: a.token }); assert.equal((await Workspace.findById(first._id)).applicationId, undefined);
  });
  test('Main audit: an in-flight password change cannot overwrite a newer credential version', async () => {
    const a = await user(), User = require('../src/models/User'), compare = User.prototype.comparePassword;
    User.prototype.comparePassword = async function (password) { const result = await compare.call(this, password); await User.updateOne({ _id: this._id }, { $inc: { authVersion: 1 } }); return result; };
    try {
      const response = await request('PUT', '/api/auth/password', { token: a.token, body: { currentPassword: 'original-password', newPassword: 'new-safe-password' } }); assert.equal(response.status, 401); assert.equal(response.data.code, 'SESSION_CHANGED');
      const saved = await User.findById(a.id).select('+password'); assert(await compare.call(saved, 'original-password')); assert.equal(saved.authVersion, 1);
    } finally { User.prototype.comparePassword = compare; }
  });
  test('Main audit: credential changes during privacy reauthentication reject export and deletion', async () => {
    const User = require('../src/models/User'), compare = User.prototype.comparePassword;
    User.prototype.comparePassword = async function (password) { const result = await compare.call(this, password); await User.updateOne({ _id: this._id }, { $inc: { authVersion: 1 } }); return result; };
    try {
      for (const action of ['export', 'delete']) {
        const a = await user(), response = await request('POST', '/api/privacy/' + action, { token: a.token, body: { password: 'original-password', confirmation: 'DELETE', includeOriginals: false } });
        assert.equal(response.status, 401); assert.equal(response.data.code, 'SESSION_CHANGED');
        assert.notEqual((await User.findById(a.id)).deleting, true); assert.equal(await require('../src/models/AccountDeletion').countDocuments({ owner: a.id }), 0);
      }
    } finally { User.prototype.comparePassword = compare; }
    const a = await user(), Zip = require('jszip'), generate = Zip.prototype.generateAsync;
    Zip.prototype.generateAsync = async function (...args) { const buffer = await generate.apply(this, args); await User.updateOne({ _id: a.id }, { $inc: { authVersion: 1 } }); return buffer; };
    try { const response = await request('POST', '/api/privacy/export', { token: a.token, body: { password: 'original-password', includeOriginals: false } }); assert.equal(response.status, 401); assert.equal(response.data.code, 'SESSION_CHANGED'); }
    finally { Zip.prototype.generateAsync = generate; }
  });
  test('Main audit: a stale deletion cannot be activated or recovered after credentials change', async () => {
    const a = await user(), User = require('../src/models/User'), Deletion = require('../src/models/AccountDeletion'), create = Deletion.create;
    Deletion.create = async function (...args) { const record = await create.apply(this, args); await User.updateOne({ _id: a.id }, { $inc: { authVersion: 1 } }); return record; };
    try { const response = await request('POST', '/api/privacy/delete', { token: a.token, body: { password: 'original-password', confirmation: 'DELETE' } }); assert.equal(response.status, 401); assert.equal(response.data.code, 'SESSION_CHANGED'); }
    finally { Deletion.create = create; }
    assert.notEqual((await User.findById(a.id)).deleting, true); assert.equal(await Deletion.countDocuments({ owner: a.id }), 0);
    await Deletion.create({ owner: a.id, authVersion: 0, receiptHash: 'stale-authorization-test', emailHash: 'fictional-hash' });
    await require('../src/services/privacyService').sweepDeletions(); assert(await User.findById(a.id)); assert.equal(await Deletion.countDocuments({ owner: a.id }), 0);
  });
  test('Main audit: exhausted worker recovery releases answer locks and marks interrupted uploads failed', async () => {
    const a = await user(), resume = await ready(a.id), session = await Session.create({ owner: a.id, resumeId: resume._id, targetRole: 'Engineer', totalQuestions: 1 });
    const question = await Question.create({ sessionId: session._id, order: 1, questionText: 'Explain validation', suggestedAnswer: 'Check input', topic: 'Python' });
    const stalled = { owner: a.id, status: 'RUNNING', retryCount: 2, leaseOwner: 'expired-worker', leaseExpiresAt: new Date(Date.now() - 10000) };
    const parse = await Job.create({ ...stalled, jobType: 'resume_parse', inputRef: { resumeId: resume._id } });
    const answer = await Job.create({ ...stalled, jobType: 'answer_evaluation', inputRef: { resumeId: resume._id, sessionId: session._id, questionId: question._id } });
    await Resume.updateOne({ _id: resume._id }, { $set: { processingJobId: parse._id, processingStatus: 'RUNNING' } }); await Question.updateOne({ _id: question._id }, { $set: { evaluationJobId: answer._id } });
    await require('../src/services/jobRecovery').recoverStalled();
    assert.equal((await Job.findById(answer._id)).status, 'FAILED'); assert.equal((await Question.findById(question._id)).evaluationJobId, undefined); assert.equal((await Resume.findById(resume._id)).processingStatus, 'FAILED');
  });
  test('Main audit: expired retry payload cannot leave an upload permanently running', async () => {
    const a = await user(), resume = await ready(a.id), job = await Job.create({ owner: a.id, jobType: 'resume_parse', status: 'PENDING', createdAt: new Date(Date.now() - 10000), inputRef: { resumeId: resume._id } });
    await Resume.updateOne({ _id: resume._id }, { $set: { processingJobId: job._id, processingStatus: 'RUNNING' } });
    await require('../src/services/jobRecovery').recoverStalled(); assert.equal((await Job.findById(job._id)).status, 'FAILED'); assert.equal((await Resume.findById(resume._id)).processingStatus, 'FAILED');
  });
  test('Main audit: summary-only copilot keeps all experience and project content unchanged', async () => {
    const a = await user(), resume = await ready(a.id); resume.verifiedAt = new Date(); await resume.save();
    const source = require('../src/services/resumeStructure').withEntryIds(resume.parsedData);
    await library.save(a.id, fact(resume, 'projects', source.projects[0].entryId, 'I documented Python input validation decisions and tested recovery before importing fictional course data.'));
    const result = await successfulJob(await request('POST', '/api/evidence/copilot', { token: a.token, body: { resumeId: resume._id, targetRole: 'Engineer', scope: 'summary' } }));
    assert.equal(result.copilotRun.status, 'draft_ready');
    for (const section of ['projects', 'workExperience']) {
      assert.deepEqual(require('../src/services/resumeContent').cleanResumeContent(result.tailoredResume.tailoredContent)[section], require('../src/services/resumeContent').cleanResumeContent(source)[section]);
      assert.deepEqual(require('../src/services/resumeContent').cleanResumeContent(result.tailoredResume.sourceContent)[section], require('../src/services/resumeContent').cleanResumeContent(source)[section]);
    }
  });
  test('Main audit: matching entry IDs in different sections do not share retrieval evidence', async () => {
    const a = await user(), resume = await ready(a.id); resume.parsedData.projects[0].entryId = resume.parsedData.workExperience[0].entryId = 'shared-entry'; await resume.save();
    const work = await library.save(a.id, fact(resume, 'workExperience', 'shared-entry', 'I documented Python responsibilities at work.'));
    const project = await library.save(a.id, fact(resume, 'projects', 'shared-entry', 'I tested Python validation in a course project.'));
    const records = await library.retrieve(a.id, 'Python', { resumeId: resume._id, entryIds: ['shared-entry'], entryContexts: [{ section: 'projects', entryId: 'shared-entry' }] });
    assert(records.some((item) => item.id === String(project._id))); assert(records.every((item) => item.id !== String(work._id)));
    resume.parsedData.projects[0].description = 'I implemented Python validation for fictional course data and documented the error cases before importing files. I tested malformed inputs, checked the displayed messages and described recovery steps for the course project.'; resume.verifiedAt = new Date(); await resume.save();
    const sourceRecords = await library.syncResume(a.id, resume), excluded = sourceRecords.find((item) => item.context?.section === 'workExperience');
    await library.verify(excluded._id, a.id, { revision: excluded.revision, verification: 'rejected' });
    const result = await successfulJob(await request('POST', '/api/evidence/copilot', { token: a.token, body: { resumeId: resume._id, targetRole: 'Engineer', scope: 'projects:shared-entry' } })); assert.equal(result.copilotRun.status, 'draft_ready');
    assert(!result.copilotRun.retrieval.some((item) => item.id === String(work._id)));
  });
  test('Main audit: deferred feedback stays hidden in sessions, jobs, activity, analytics and workspaces until completion', async () => {
    const a = await user(), resume = await ready(a.id), workspace = (await request('POST', '/api/workspaces', { token: a.token, body: { company: 'Practice', title: 'Engineer', description: 'Python validation', resumeId: resume._id } })).data.data;
    const generated = await successfulJob(await request('POST', '/api/interview/sessions', { token: a.token, body: { resumeId: resume._id, targetRole: 'Engineer', count: 2, feedbackMode: 'end' } }));
    const sessionId = generated.session._id; await Session.updateOne({ _id: sessionId }, { $set: { workspaceId: workspace._id } });
    const submitted = await request('POST', '/api/interview/sessions/' + sessionId + '/questions/' + generated.questions[0]._id + '/answer', { token: a.token, body: { userAnswer: 'I validate input and test malformed values before accepting data.' } });
    const first = await successfulJob(submitted); assert.equal(first.session.overallScore, undefined); assert.equal(first.question.feedback, undefined);
    for (const path of ['/api/interview/sessions/' + sessionId, '/api/interview/sessions', '/api/workspaces/' + workspace._id]) {
      const result = (await request('GET', path, { token: a.token })).data.data;
      const session = Array.isArray(result) ? result[0] : result.session || result.interviews[0];
      assert.equal(session.overallScore, undefined); assert.equal(session.answerScores, undefined);
    }
    assert.deepEqual((await request('GET', '/api/interview/analytics', { token: a.token })).data.data.topicHeatmap, []);
    const jobId = submitted.data.data.jobId, originalQuestion = await Question.findById(generated.questions[0]._id), rawSession = await Session.findById(sessionId);
    await Job.updateOne({ _id: jobId }, { $set: { output: { question: originalQuestion.toObject(), session: rawSession.toObject() } } });
    await require('../src/models/ProcessingLog').create({ owner: a.id, jobId, agent: 'evaluator', step: 'evaluation_completed', message: 'Overall Score: 90', metadata: { overallScore: 90 } });
    const legacy = (await request('GET', '/api/processing-jobs/' + jobId, { token: a.token })).data.data.output; assert.equal(legacy.session.overallScore, undefined); assert.equal(legacy.question.feedback, undefined);
    const timeline = (await request('GET', '/api/processing-jobs/' + jobId + '/timeline', { token: a.token })).data.data; assert(timeline.every((event) => !event.message.includes('Overall Score:') && event.metadata?.overallScore === undefined));
    await successfulJob(await request('POST', '/api/interview/sessions/' + sessionId + '/questions/' + generated.questions[1]._id + '/answer', { token: a.token, body: { userAnswer: 'I test API contracts, compare error cases and document recovery.' } }));
    const completed = (await request('GET', '/api/interview/sessions/' + sessionId, { token: a.token })).data.data; assert.equal(completed.session.status, 'completed'); assert.equal(typeof completed.session.overallScore, 'number'); assert(completed.questions.every((item) => item.feedback));
    assert((await request('GET', '/api/interview/analytics', { token: a.token })).data.data.topicHeatmap.length > 0);
  });
};
