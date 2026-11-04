const { test, beforeEach, afterEach } = require('node:test'), assert = require('node:assert/strict');
const h = require('./helpers.cjs'), { React, load, render, screen, fireEvent, api, respond } = h;
beforeEach(() => { h.reset(); h.session('A'); }); afterEach(() => { h.cleanup(); h.auth.getState().logout(false); });

test('Phase 4: adaptive interview refreshes the next prompt after an answer and keeps future questions locked', async () => {
  h.router.query = { id: 's1' };
  const Page = load('pages/interview/session/[id].js').default, originalGet = api.get;
  const session = { _id: 's1', targetRole: 'Backend Engineer', adaptiveEnabled: true, totalQuestions: 3, feedbackMode: 'instant', status: 'in_progress' };
  const q = (id, text) => ({ _id: id, questionText: text, category: 'technical', topic: 'SQL', difficulty: 'Medium', attempts: [] });
  let questions = [q('q1', 'Explain a SQL index.'), q('q2', 'Original second question.'), q('q3', 'Original third question.')];
  api.get = async (url) => url === '/interview/sessions/s1' ? respond({ session, questions }) : originalGet(url);
  api.post = async () => {
    questions = [{ ...questions[0], userAnswer: 'An index accelerates reads.', answeredAt: '2026-11-04', feedback: { overallScore: 75 } },
      { ...questions[1], questionText: 'Which writes become slower with this index?', adaptation: { kind: 'deeper', reason: 'Explore the trade-off from your previous answer.', sourceAnswerExcerpt: 'An index accelerates reads.' } }, questions[2]];
    return respond({ question: questions[0], session });
  };
  render(React.createElement(Page));
  await screen.findByRole('heading', { name: 'Explain a SQL index.' });
  assert(screen.getByRole('button', { name: 'Q2' }).disabled); assert(screen.getByRole('button', { name: 'Next Question' }).disabled);
  fireEvent.change(screen.getByLabelText('Your Response (Technical explanation or STAR breakdown)'), { target: { value: 'An index accelerates reads.' } }); fireEvent.click(screen.getByRole('button', { name: 'Submit answer' }));
  await screen.findByText('Your Submitted Answer:'); fireEvent.click(screen.getByRole('button', { name: 'Next Question' }));
  await screen.findByRole('heading', { name: 'Which writes become slower with this index?' }); assert(screen.getByText('Deeper question')); assert(screen.getByText('Explore the trade-off from your previous answer.')); assert(screen.getByRole('button', { name: 'Q3' }).disabled);
});

test('Phase 4: answer evidence links open the requested question and historical attempt', async () => {
  h.router.query = { id: 's1', question: 'q2', attempt: '0' };
  const Page = load('pages/interview/session/[id].js').default, originalGet = api.get;
  const question = { _id: 'q2', questionText: 'Explain query plans.', category: 'technical', topic: 'SQL', difficulty: 'Medium', userAnswer: 'My improved response.', answeredAt: '2026-11-04', feedback: { overallScore: 82 }, attempts: [{ userAnswer: 'My first response.', feedback: { overallScore: 40 } }] };
  api.get = async (url) => url === '/interview/sessions/s1' ? respond({ session: { _id: 's1', targetRole: 'Engineer', status: 'completed' }, questions: [{ ...question, _id: 'q1', questionText: 'First question.' }, question] }) : originalGet(url);
  render(React.createElement(Page)); await screen.findByRole('heading', { name: 'Explain query plans.' });
  const attempts = screen.getByText('Previous attempts (1)').closest('details'); assert.equal(attempts.open, true); assert(screen.getByText('My first response.'));
});

test('Phase 4: future adaptive question links stop at the first unanswered question', async () => {
  h.router.query = { id: 's1', question: 'q3' };
  const Page = load('pages/interview/session/[id].js').default, originalGet = api.get;
  const questions = [1, 2, 3].map((index) => ({ _id: 'q' + index, questionText: 'Seed question ' + index, category: 'technical', topic: 'SQL', difficulty: 'Medium', attempts: [] }));
  api.get = async (url) => url === '/interview/sessions/s1' ? respond({ session: { _id: 's1', adaptiveEnabled: true, targetRole: 'Engineer', status: 'in_progress' }, questions }) : originalGet(url);
  render(React.createElement(Page)); await screen.findByRole('heading', { name: 'Seed question 1' });
  assert.equal(screen.queryByRole('heading', { name: 'Seed question 3' }), null); assert(screen.getByRole('button', { name: 'Q3' }).disabled);
});

test('Phase 4: a job-gap reassessment preselects three questions and allows changing the focus', async () => {
  h.router.query = { topic: 'SQL', resume: 'r1', description: 'jd1', difficulty: 'Easy', count: '3' };
  const { writeDraft } = load('services/draftStorage.js');
  writeDraft('A', 'interview-setup', { resumeId: 'r1', targetRole: 'Engineer', workspaceId: '', jobDescriptionId: 'jd1', count: 5, difficulty: 'Easy', topicFocus: 'SQL', feedbackMode: 'instant', timeLimitSeconds: 0 }, 0, {});
  const Page = load('pages/interview/setup.js').default, originalGet = api.get;
  api.get = async (url) => url === '/resumes' ? respond([{ _id: 'r1', title: 'Source resume', processingStatus: 'COMPLETED' }]) : url === '/interview/descriptions' ? respond([{ _id: 'jd1', title: 'Source job' }]) : url === '/workspaces' ? respond([]) : originalGet(url);
  render(React.createElement(Page)); await screen.findByRole('option', { name: 'Source resume' });
  await h.waitFor(() => assert.equal(screen.getByRole('combobox', { name: 'Questions' }).value, '3'));
  assert.equal(screen.getByRole('combobox', { name: 'Resume' }).value, 'r1'); assert.equal(screen.getByRole('combobox', { name: 'Saved job description (optional)' }).value, 'jd1');
  const topic = screen.getByLabelText('Focus topic (optional)'); fireEvent.change(topic, { target: { value: 'SQL joins' } }); assert.equal(topic.value, 'SQL joins');
});
