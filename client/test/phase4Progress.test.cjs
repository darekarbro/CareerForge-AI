const { test, beforeEach, afterEach } = require('node:test'), assert = require('node:assert/strict');
const h = require('./helpers.cjs'), { React, load, render, screen, fireEvent, api, respond } = h;
beforeEach(() => { h.reset(); h.session('A'); }); afterEach(() => { h.cleanup(); h.auth.getState().logout(false); });

test('Phase 4: competency view links supporting attempts and launches a gap-specific reassessment', async () => {
  const Page = load('pages/interview/progress.js').default, originalGet = api.get, posts = [];
  const evidence = { sessionId: 's1', questionId: 'q1', attemptIndex: 0, current: true, questionText: 'Explain a SQL index.', answerExcerpt: 'It speeds up reads.', score: 45, provider: 'deterministic-fallback', answeredAt: '2026-11-04', href: '/interview/session/s1?question=q1&attempt=0' };
  api.get = async (url) => {
    if (url === '/interview/competencies') return respond({ rubricVersion: 'v1', limitations: ['Missing topics are unassessed.'], competencies: [{ topic: 'SQL', status: 'gap', averageScore: 45, sampleCount: 1, sessionCount: 1, attemptCount: 1, confidence: 'low', trend: { firstScore: 45, latestScore: 45 }, evidence: [evidence] }] });
    if (url === '/interview/learning-plan') return respond({ limitations: ['Practice plans are suggestions.'], items: [{ topic: 'SQL', reason: 'An answer needs a concrete example.', sourceEvidence: [evidence], practiceTasks: [{ title: 'Compare query plans', instructions: 'Run the same query with and without an index.', doneWhen: 'Record the plans and explain the difference.' }], projectMilestones: [{ title: 'Build an indexed search', instructions: 'Seed 1000 fictional records.', doneWhen: 'Show timings and a write-cost trade-off.' }], reassessment: { topicFocus: 'SQL', difficulty: 'Easy', count: 3, successCriteria: ['Explain a trade-off using the project.'] } }] });
    return originalGet(url);
  };
  api.post = async (url, body) => { posts.push({ url, body }); return respond({ session: { _id: 's2' } }); };
  let destination; h.router.push = async (url) => { destination = url; };
  render(React.createElement(Page)); await screen.findByText('Needs practice · 45%'); fireEvent.click(screen.getByText('Answers behind SQL'));
  assert(screen.getAllByRole('link', { name: 'Explain a SQL index. · Attempt 1 (latest)' }).every((link) => link.getAttribute('href') === evidence.href));
  assert(screen.getByText('Done when: Record the plans and explain the difference.')); assert(screen.getByText('Small project milestones'));
  fireEvent.click(screen.getByRole('button', { name: 'Reassess SQL' })); await h.waitFor(() => assert.equal(destination, '/interview/session/s2'));
  assert.deepEqual(posts[0], { url: '/interview/sessions/s1/follow-up', body: { topic: 'SQL', difficulty: 'Easy' } });
});

test('Phase 4: competency and learning views have recoverable endpoint errors', async () => {
  const Page = load('pages/interview/progress.js').default, originalGet = api.get;
  api.get = async (url) => url === '/interview/competencies' || url === '/interview/learning-plan' ? Promise.reject(new Error('Offline')) : originalGet(url);
  render(React.createElement(Page)); await screen.findByRole('button', { name: 'Retry profile' }); assert(screen.getByRole('button', { name: 'Retry learning plan' }));
});

test('Phase 4: competency profile separates checked technical scores from unassessed answer history', async () => {
  const Page = load('pages/interview/progress.js').default, originalGet = api.get;
  const evidence = { sessionId: 's1', questionId: 'q1', attemptIndex: 0, current: true, questionText: 'Explain an index.', answerExcerpt: 'It speeds up reads.', score: 57, provider: 'deterministic-fallback', answeredAt: '2026-11-04', href: '/interview/session/s1?question=q1&attempt=0' };
  const counts = { sampleCount: 1, sessionCount: 1, attemptCount: 1, confidence: 'low' };
  api.get = async url => {
    if (url === '/interview/competencies') return respond({ competencies: [
      { ...counts, topic: 'SQL', status: 'developing', assessmentBasis: 'unassessed', averageScore: 57, assessmentScore: null, trend: { firstScore: 57, latestScore: 57 }, evidence: [evidence] },
      { ...counts, topic: 'Binary search', status: 'strength', assessmentBasis: 'technical', averageScore: 67, assessmentScore: 92, evidence: [] },
    ] });
    if (url === '/interview/learning-plan') return respond({ items: [] });
    return originalGet(url);
  };
  render(React.createElement(Page));
  await screen.findByText('Unassessed');
  assert(screen.getByText('Demonstrated strength · Technical score 92%'));
  assert.equal(screen.queryByText(/57%|67%/), null);
  fireEvent.click(screen.getByText('Answers behind SQL'));
  assert.equal(screen.getByRole('link', { name: 'Explain an index. · Attempt 1 (latest)' }).getAttribute('href'), evidence.href);
  assert(screen.getByText(/Technical correctness unassessed/));
});
