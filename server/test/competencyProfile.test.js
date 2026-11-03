const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildProfile } = require('../src/services/competencyService');

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
  assert.equal(item.status, 'strength'); assert.equal(item.averageScore, 83); assert.equal(item.sampleCount, 2);
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
