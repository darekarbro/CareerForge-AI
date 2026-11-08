const test = require('node:test');
const assert = require('node:assert/strict');
const Provider = require('../src/providers/deterministicProvider');
const InterviewQuestion = require('../src/models/InterviewQuestion');
const { selectFollowUp } = require('../src/services/adaptiveInterview');
const { interview } = require('../evaluation/dataset/expanded-v1.json');

const provider = new Provider();
const band = score => score >= 75 ? 'sound' : score >= 40 ? 'partial' : 'unsound';

test('published offline answer cases distinguish paraphrases from misconceptions and select the expected branch', async () => {
  for (const fixture of interview.answers) {
    const question = { ...interview.questions[fixture.questionId], _id: fixture.id, order: 1 };
    const feedback = await provider.evaluateAnswer({ question, userAnswer: fixture.userAnswer });
    const stored = new InterviewQuestion({ feedback }).feedback;
    assert.equal(stored.technicalAssessment, 'rubric-checked', fixture.id);
    assert.equal(band(stored.technicalScore), fixture.expectedTechnical, fixture.id);
    assert.equal(selectFollowUp({ ...question, feedback: stored, userAnswer: fixture.userAnswer }).adaptation.kind,
      fixture.expectedFollowUp, fixture.id);
  }
});

test('a concise correct answer can go deeper while a cache directive misconception receives a diagnostic', async () => {
  const question = interview.questions.cache;
  const valid = 'Set Cache-Control: no-store. Repeat the request through a proxy and check that both requests reach the origin.';
  const wrong = 'Set Cache-Control: no-cache. This prevents storage in shared and private caches. Repeat the request through a proxy and compare the response headers.';
  for (const [userAnswer, expected] of [[valid, 'deeper'], [wrong, 'diagnostic']]) {
    const feedback = await provider.evaluateAnswer({ question, userAnswer });
    assert.equal(selectFollowUp({ ...question, feedback, userAnswer }).adaptation.kind, expected);
  }
});

test('a warning about an early commit is distinct from recommending that commit', async () => {
  const question = interview.questions.atomicity;
  const userAnswer = 'Never commit the first write before the second. Use one database transaction and commit after both updates succeed. Force a failure after the debit and check both accounts retain their original balances.';
  const feedback = await provider.evaluateAnswer({ question, userAnswer });
  assert.equal(band(feedback.technicalScore), 'sound');
});

test('rubric terms alone and technical topics outside the rule scope cannot earn a deeper prompt', async () => {
  const keywords = 'Sorted order. Midpoint comparison. Boundary test. First element. Missing key. Empty array. I have stated each rubric point and repeated the important technical vocabulary several times to cover the topic fully.';
  const specific = await provider.evaluateAnswer({ question: interview.questions['binary-search'], userAnswer: keywords });
  assert(specific.technicalScore < 75);
  const question = { topic: 'Binary search', questionText: 'How would you compare binary search with a hash table?',
    keyPoints: ['Sorted order', 'Midpoint comparison', 'Boundary test'], category: 'technical' };
  const feedback = await provider.evaluateAnswer({ question, userAnswer: keywords });
  assert.equal(feedback.technicalAssessment, 'unassessed');
  assert.equal(selectFollowUp({ ...question, feedback, userAnswer: keywords }).adaptation.kind, 'clarification');
});

test('offline rules reject isolated cache terms, rejected directives and unsafe invariants', async () => {
  const cases = [
    ['cache', 'Cache-Control, no-store, repeat request, origin.'],
    ['cache', 'Set Cache-Control to no-cache instead of no-store. Repeat the request through a proxy and check both requests reach the origin.'],
    ['binary-search', 'The array need not have sorted order. Compare the middle value and discard a half. Test an empty array.'],
    ['atomicity', 'Use one transaction for debit and a separate transaction for credit. Commit after both writes succeed. Force a failure and verify both balances remain unchanged.'],
  ];
  for (const [topic, userAnswer] of cases) {
    const question = interview.questions[topic];
    const feedback = await provider.evaluateAnswer({ question, userAnswer });
    assert(feedback.technicalScore < 40, topic);
    assert.equal(selectFollowUp({ ...question, feedback, userAnswer }).adaptation.kind, 'diagnostic');
  }
});
