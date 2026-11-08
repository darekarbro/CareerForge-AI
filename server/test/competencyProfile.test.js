const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildProfile } = require('../src/services/competencyService');
const { buildLearningPlan } = require('../src/services/learningPlanService');

test('Phase 4: longitudinal competencies link every attempt without counting retries as independent demonstrations', () => {
  const profile = buildProfile([
    { _id: 'q1', sessionId: 's1', topic: 'API design', questionText: 'Design an API', userAnswer: 'A concrete response', answeredAt: new Date('2026-11-02'),
      feedback: { overallScore: 85, technicalScore: 80, aiProvider: 'deterministic-fallback' },
      attempts: [{ userAnswer: 'Unclear first try', answeredAt: new Date('2026-11-01'), feedback: { overallScore: 30 } }] },
    { _id: 'q2', sessionId: 's2', topic: 'api design', questionText: 'Recover an API', userAnswer: 'A recovery response', answeredAt: new Date('2026-11-03'),
      feedback: { overallScore: 81, technicalScore: 77 } },
    { _id: 'q3', sessionId: 's2', topic: 'Unanswered', feedback: {} },
  ]);
  assert.equal(profile.competencies.length, 1);
  const item = profile.competencies[0];
  assert.equal(item.status, 'developing'); assert.equal(item.averageScore, 83); assert.equal(item.sampleCount, 2);
  assert.equal(item.assessedSampleCount, 1);
  assert.equal(item.attemptCount, 3); assert.equal(item.confidence, 'low'); assert.equal(item.trend.delta, 51);
  assert.equal(item.evidence[2].current, false); assert.equal(item.evidence[2].attemptIndex, 0);
  assert.equal(item.evidence[2].href, '/interview/session/s1?question=q1&attempt=0');
  assert.equal(item.evidence[1].attemptIndex, 1); assert.equal(item.evidence[1].current, true);
  assert(profile.limitations.some((line) => line.includes('unassessed')));
});

test('Phase 4: a single high score is developing evidence rather than a claimed strength', () => {
  assert.equal(buildProfile([{ _id: 'q', sessionId: 's', topic: 'Python', userAnswer: 'Answer', answeredAt: new Date(), feedback: { overallScore: 95 } }]).competencies[0].status, 'developing');
  assert.deepEqual(buildProfile([]).competencies, []);
});

test('checked technical scores drive practice gaps and unassessed answers only retain history', () => {
  const answer = (id, topic, technicalAssessment, technicalScore, overallScore) => ({
    _id: id, sessionId: id, topic, userAnswer: 'A saved answer', answeredAt: new Date(),
    feedback: { technicalAssessment, technicalScore, overallScore },
  });
  const profile = buildProfile([
    answer('q1', 'HTTP caching', 'rubric-checked', 55, 62),
    answer('q2', 'Unverified topic', 'unassessed', 50, 20),
    { ...answer('q3', 'Unverified topic', undefined, 85, 85), feedback: { aiProvider: 'deterministic-fallback', technicalScore: 85, overallScore: 85 } },
  ]);
  const unassessed = profile.competencies.find(item => item.topic === 'Unverified topic');
  assert.equal(unassessed.assessmentBasis, 'unassessed');
  assert.equal(unassessed.assessedSampleCount, 0);
  assert(unassessed.evidence.some(item => item.href === '/interview/session/q2?question=q2&attempt=0'));
  const plan = buildLearningPlan(profile);
  assert.deepEqual(plan.items.map(item => item.topic), ['HTTP caching']);
  assert.equal(plan.items[0].reassessment.difficulty, 'Medium');
  assert.match(plan.items[0].reason, /technical average of 55\/100/);
});
