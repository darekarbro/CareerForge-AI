const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildLearningPlan } = require('../src/services/learningPlanService');

test('Phase 4: plans turn linked interview gaps into observable tasks, milestones and reassessment', () => {
  const source = { sessionId: 's1', questionId: 'q1', attemptIndex: 0, href: '/interview/session/s1?question=q1&attempt=0' };
  const plan = buildLearningPlan({ competencies: [
    { topic: 'API design', status: 'gap', averageScore: 45, sampleCount: 1, confidence: 'low', evidence: [source] },
    { topic: 'SQL', status: 'strength', averageScore: 90, sampleCount: 3, confidence: 'moderate', evidence: [] },
  ] });
  assert.equal(plan.items.length, 1); const item = plan.items[0];
  assert.deepEqual(item.sourceEvidence, [source]); assert.equal(item.reassessment.topicFocus, 'API design'); assert.equal(item.reassessment.difficulty, 'Easy');
  assert.equal(item.reassessment.count, 3); assert.equal(item.practiceTasks.length, 2); assert.equal(item.projectMilestones.length, 2);
  for (const task of [...item.practiceTasks, ...item.projectMilestones]) assert(task.instructions && task.doneWhen);
  assert(item.reassessment.successCriteria.some((text) => text.includes('reviewer')));
});

test('Phase 4: JD-only gaps stay unassessed and superseded reports cannot generate obsolete tasks', () => {
  const requirement = { id: 'req1', label: 'Python', category: 'required_skill', status: 'missing', sourceText: 'Python required', missingEvidence: 'Show a real project' };
  const report = { _id: 'g1', resumeId: 'r1', jobDescriptionId: 'j1', requirementMatches: [requirement] };
  const plan = buildLearningPlan({ competencies: [] }, [report]);
  assert.equal(plan.items[0].confidence, 'unassessed'); assert.deepEqual(plan.items[0].sourceEvidence, []);
  assert.equal(plan.items[0].requirementSources[0].analysisId, 'g1'); assert(plan.items[0].reason.includes('does not establish a lack of skill'));
  const newer = { ...report, _id: 'g2', requirementMatches: [{ ...requirement, status: 'supported' }] };
  assert.deepEqual(buildLearningPlan({ competencies: [] }, [newer, report]).items, []);
});
