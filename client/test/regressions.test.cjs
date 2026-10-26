const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { React, load, api, auth, resumes, socket, sockets, router, respond, session, reset,
  render, screen, fireEvent, waitFor, cleanup, act } = require('./helpers.cjs');
const element = React.createElement;
beforeEach(reset);
afterEach(() => { cleanup(); auth.getState().logout(); });

test('Tailoring shows the complete resume including projects, education, certificates and unchanged contact details', () => {
  const Component = load('components/ResumeDiffView/ResumeDiffView.js').default;
  const content = {
    contactInfo: { name: 'Detailed Candidate', email: 'detailed@example.test' },
    education: [{ degree: 'BSc', institution: 'Actual University', graduationYear: '2024', score: 'GPA 3.8' }],
    certifications: [{ name: 'Actual Certificate', issuer: 'Actual Issuer', year: '2025' }],
  };
  render(element(Component, { originalResume: { parsedData: content }, targetRole: 'Backend Engineer',
    tailoredContent: { summary: 'A detailed, evidence-based summary.', education: [], certifications: [], skills: { all: ['Python', 'Rust'], technical: ['Python', 'Rust'] },
      workExperience: [{ role: 'Developer', company: 'Actual Company', startDate: '2023', current: true, highlights: ['A complete experience achievement.'] }],
      projects: [{ title: 'Complete Project', description: 'The full project purpose and personal contribution.', technologies: ['Python'],
        link: 'https://example.test/project', highlights: ['Detailed implementation and actual outcome.'] }] },
    improvementSuggestions: ['Add a verified project outcome.'] }));
  const preview = screen.getByRole('article', { name: 'Complete tailored resume' });
  for (const text of ['Detailed Candidate', 'detailed@example.test', 'Actual University', 'Actual Certificate', 'GPA 3.8',
    'Complete Project', 'The full project purpose and personal contribution.', 'Detailed implementation and actual outcome.', 'Present']) {
    assert(preview.textContent.includes(text), text);
  }
  assert(screen.getByRole('link', { name: 'https://example.test/project' }));
  assert(screen.getByText('2 skills retained'));
  assert(screen.getByRole('complementary', { name: 'Details to strengthen' }));
  assert(!screen.queryByText(/Injected Skills/));
});

test('10,11: changing accounts clears private state and disconnects the previous socket', async () => {
  session('A');
  let release;
  api.get = async () => new Promise((resolve) => { release = resolve; });
  resumes.setState({ activeResume: { title: 'PRIVATE_A' }, dashboardMetrics: { private: 'A' },
    tailoredVersions: [{ private: 'A' }], activeJobTimeline: [{ message: 'PRIVATE_A' }] });
  const pending = resumes.getState().fetchDashboardMetrics();
  const oldSocket = socket.getSocket();
  auth.getState().logout();
  session('B');
  release(respond({ private: 'LATE_A' }));
  await pending;
  assert(oldSocket.disconnected);
  assert.equal(resumes.getState().activeResume, null);
  assert.equal(resumes.getState().dashboardMetrics, null);
  assert.deepEqual(resumes.getState().tailoredVersions, []);
  assert.deepEqual(resumes.getState().activeJobTimeline, []);
  const newSocket = socket.getSocket();
  assert.notEqual(newSocket, oldSocket); assert.equal(newSocket.options.auth.token, 'token-B');
});
test('36,37: transient failures preserve a valid session and profile updates persist', async () => {
  session('A');
  api.get = async () => { throw new Error('temporary outage'); };
  await auth.getState().initialize();
  assert(auth.getState().isAuthenticated);
  assert.equal(JSON.parse(localStorage.getItem('careerforge_auth')).token, 'token-A');
  auth.getState().updateUser({ id: 'A', name: 'New Name', targetRolePreference: 'Data / ML Engineer' });
  assert.equal(JSON.parse(localStorage.getItem('careerforge_auth')).user.name, 'New Name');
  let release;
  api.get = async () => new Promise((resolve) => { release = resolve; });
  const pending = auth.getState().initialize();
  auth.getState().logout();
  release(respond({ id: 'A', name: 'Late old profile' }));
  await pending;
  assert.equal(auth.getState().user, null);
});
test('11,38: subscriptions leave rooms and rejoin after reconnect', () => {
  session('A');
  const userStop = socket.subscribeToUserEvents('A', () => {}), jobStop = socket.subscribeToJob('job1', () => {});
  const current = socket.getSocket();
  const before = current.sent.filter(([event]) => event === 'join_job').length;
  current.trigger('connect');
  assert.equal(current.sent.filter(([event]) => event === 'join_job').length, before + 1);
  jobStop(); userStop();
  assert(current.sent.some(([event, id]) => event === 'leave_job' && id === 'job1'));
  assert(current.sent.some(([event, id]) => event === 'leave_user' && id === 'A'));
});
test('14,47: question drafts remain separate and the correct draft is submitted through the queued API', async () => {
  session('A'); router.query = { id: 'session1' }; router.pathname = '/interview/session/[id]';
  const questions = ['q1', 'q2'].map((id, index) => ({ _id: id, category: 'technical', topic: 'Testing',
    questionText: 'Question ' + (index + 1), difficulty: 'Medium', suggestedAnswer: 'Model answer', keyPoints: [] }));
  const initial = { _id: 'session1', targetRole: 'Engineer', overallScore: 0, status: 'in_progress' };
  let submitted;
  api.get = async (url) => {
    if (url === '/notifications') return respond([], { unreadCount: 0 });
    if (url === '/interview/sessions/session1') return respond({ session: initial, questions });
    if (url.endsWith('/timeline')) return respond([]);
    if (url === '/processing-jobs/answerJob') return respond({ _id: 'answerJob', status: 'COMPLETED', output: {
      question: { ...questions[0], userAnswer: submitted.body.userAnswer, feedback: { overallScore: 70, strengths: [], improvements: [] } },
      session: { ...initial, answeredCount: 1, overallScore: 70 },
    } });
    throw new Error(url);
  };
  api.post = async (url, body) => { submitted = { url, body }; return { status: 202, data: { data: { jobId: 'answerJob' } } }; };
  const Page = load('pages/interview/session/[id].js').default;
  render(element(Page));
  await screen.findByText('Question 1');
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Draft for question one' } });
  fireEvent.click(screen.getByRole('button', { name: /^Q2/ }));
  assert.equal(screen.getByRole('textbox').value, '');
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Draft for question two' } });
  fireEvent.click(screen.getByRole('button', { name: /^Q1/ }));
  assert.equal(screen.getByRole('textbox').value, 'Draft for question one');
  fireEvent.click(screen.getByRole('button', { name: /Submit for Dimension Evaluation/ }));
  await screen.findByText('Your Submitted Answer:');
  assert.equal(submitted.url, '/interview/sessions/session1/questions/q1/answer');
  assert.equal(submitted.body.userAnswer, 'Draft for question one');
  fireEvent.click(screen.getByRole('button', { name: /^Q2/ }));
  assert.equal(screen.getByRole('textbox').value, 'Draft for question two');
});
test('34: failed application saves retain the modal, entered values and an error message', async () => {
  const Board = load('components/ApplicationBoard/ApplicationBoard.js').default;
  let rejectSave, calls = 0;
  render(element(Board, { applications: [], onAddApplication: () => { calls++; return new Promise((_resolve, reject) => { rejectSave = reject; }); } }));
  fireEvent.click(screen.getByRole('button', { name: /Add Application/ }));
  fireEvent.change(screen.getByPlaceholderText('e.g. Google, Stripe'), { target: { value: 'Actual Co' } });
  fireEvent.change(screen.getByPlaceholderText('e.g. Senior Backend Engineer'), { target: { value: 'Engineer' } });
  const save = screen.getByRole('button', { name: /Save Application/ });
  fireEvent.click(save); fireEvent.click(save);
  assert.equal(calls, 1);
  await act(async () => rejectSave(new Error('offline')));
  assert(screen.getByRole('alert').textContent.includes('edits have been kept'));
  assert.equal(screen.getByPlaceholderText('e.g. Google, Stripe').value, 'Actual Co');
  assert.equal(screen.getByPlaceholderText('e.g. Senior Backend Engineer').value, 'Engineer');
});
test('15: job personalization uses the selected resume and does not reuse another resume cache', async () => {
  session('A');
  const role = { id: 'backend', title: 'Backend Engineer', defaultKeywords: ['Node.js'] };
  api.get = async (url) => {
    if (url === '/notifications') return respond([], { unreadCount: 0 });
    if (url === '/jobs/roles') return respond([role]);
    if (url === '/resumes') return respond([{ _id: 'r1', title: 'Resume One', processingStatus: 'COMPLETED' },
      { _id: 'r2', title: 'Resume Two', processingStatus: 'COMPLETED' }]);
    throw new Error(url);
  };
  const calls = [];
  api.post = async (_url, body) => {
    calls.push(body);
    return respond({ links: { linkedin: 'https://example.test/' + body.resumeId }, generatedKeywords: ['Skills for ' + body.resumeId] });
  };
  const Page = load('pages/jobs.js').default;
  render(element(Page));
  await screen.findByRole('button', { name: /Personalize search links/ });
  fireEvent.click(screen.getByRole('button', { name: /Personalize search links/ }));
  await screen.findByText('Skills for r1');
  assert.equal(calls[0].resumeId, 'r1');
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'r2' } });
  assert(!screen.queryByText('Skills for r1'));
  fireEvent.click(screen.getByRole('button', { name: /Personalize search links/ }));
  await screen.findByText('Skills for r2');
  assert.equal(calls[1].resumeId, 'r2');
});
test('36: saving settings refreshes the visible account and persisted profile', async () => {
  session('A');
  api.put = async (_url, body) => respond({ id: 'A', email: 'A@example.test', ...body });
  const Page = load('pages/settings.js').default;
  render(element(Page));
  await screen.findByDisplayValue('User A');
  fireEvent.change(screen.getByDisplayValue('User A'), { target: { value: 'Updated Candidate' } });
  fireEvent.change(screen.getByDisplayValue('Fullstack Developer'), { target: { value: 'Data / ML Engineer' } });
  fireEvent.click(screen.getByRole('button', { name: /Save Profile/ }));
  await screen.findByText('Profile updated successfully!');
  assert.equal(auth.getState().user.name, 'Updated Candidate');
  assert.equal(JSON.parse(localStorage.getItem('careerforge_auth')).user.targetRolePreference, 'Data / ML Engineer');
  assert(screen.getByText('Updated Candidate'));
});
test('39: an open notifications drawer receives live activity and clears its unread indicator', async () => {
  session('A');
  const original = { _id: 'n1', title: 'Old activity', message: 'Old result', isRead: false, createdAt: new Date().toISOString() };
  api.get = async () => respond([original], { unreadCount: 1 });
  api.post = async () => respond({}); api.delete = async () => respond({});
  const Navbar = load('components/AppShell/Navbar.js').default;
  render(element(Navbar, { onToggleSidebar: () => {} }));
  fireEvent.click(screen.getByTitle('Notifications'));
  await screen.findByText('Old activity');
  await act(async () => socket.getSocket().trigger('notification', {
    _id: 'n2', title: 'New activity', message: 'Live result', isRead: false, createdAt: new Date().toISOString(),
  }));
  assert(screen.getByText('New activity')); assert(screen.getByLabelText('2 unread notifications'));
  fireEvent.click(screen.getByRole('button', { name: /Mark all read/i }));
  await waitFor(() => assert(!screen.queryByLabelText(/unread notifications/)));
  fireEvent.click(screen.getByRole('button', { name: /Clear all/i }));
  await screen.findByText('No recent activity.');
});
test('28: processing watcher reconciles persisted events, deduplicates and waits for terminal status', async () => {
  session('A');
  let poll = 0;
  api.get = async (url) => {
    if (url.endsWith('/timeline')) return respond([{ _id: 'e1', step: 'parse_completed', message: 'Parsed', createdAt: '2026-10-25T00:00:00Z' }]);
    poll++;
    return respond({ _id: 'job1', status: poll < 3 ? 'RUNNING' : 'COMPLETED', output: { complete: true } });
  };
  const { waitForProcessingJob } = load('services/processing.js');
  const statuses = [];
  const result = await waitForProcessingJob('job1', { pollMs: 5, onStatus: (job) => statuses.push(job.status) });
  assert(result.complete); assert.deepEqual(statuses, ['RUNNING', 'RUNNING', 'COMPLETED']);
  assert(socket.getSocket().sent.some(([event, id]) => event === 'leave_job' && id === 'job1'));
});
test('29,30: pending resume details refresh automatically and gate dependent actions', async () => {
  session('A'); router.query = { id: 'r1' }; router.pathname = '/resume/[id]';
  let complete = false;
  const pending = { _id: 'r1', title: 'Pending Resume', processingJobId: 'parseJob', processingStatus: 'PENDING', parsedData: {}, atsScore: { score: 0 } };
  const done = { ...pending, processingStatus: 'COMPLETED', parsedData: { contactInfo: { name: 'Parsed Candidate', email: 'parsed@example.test' }, skills: { all: [] }, workExperience: [] },
    atsScore: { score: 80, strengths: [], improvements: [] }, parsingWarnings: [] };
  api.get = async (url) => {
    if (url === '/notifications') return respond([], { unreadCount: 0 });
    if (url === '/resumes/r1') return respond(pending);
    if (url === '/resumes/r1/versions' || url.endsWith('/timeline')) return respond([]);
    if (url === '/processing-jobs/parseJob') return respond({ _id: 'parseJob', status: complete ? 'COMPLETED' : 'RUNNING', output: complete ? { resume: done } : {} });
    throw new Error(url);
  };
  const Page = load('pages/resume/[id]/index.js').default;
  render(element(Page));
  await screen.findByText('Pending Resume');
  assert(screen.getByRole('button', { name: /Run JD Gap Analysis/ }).disabled);
  assert.equal(screen.getByRole('link', { name: /Tailor For Role/ }).getAttribute('aria-disabled'), 'true');
  complete = true;
  await waitFor(() => assert(screen.getByText(/Parsed Candidate/)), { timeout: 3000 });
  assert(!screen.getByRole('button', { name: /Run JD Gap Analysis/ }).disabled);
  assert.equal(screen.getByRole('link', { name: /Tailor For Role/ }).getAttribute('aria-disabled'), 'false');
});
