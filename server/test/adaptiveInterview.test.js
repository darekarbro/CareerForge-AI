const { test } = require('node:test');
const assert = require('node:assert/strict');
const { selectFollowUp } = require('../src/services/adaptiveInterview');
const { publicOutput } = require('../src/services/interviewVisibility');

const seed = { _id: 'source', topic: 'API design', category: 'technical', difficulty: 'Medium', keyPoints: ['Failure recovery'] };
test('Phase 4: adaptive policy chooses simpler, clarification and deeper prompts from the previous answer', () => {
  const diagnostic = selectFollowUp({ ...seed, userAnswer: 'I do not know', feedback: { technicalScore: 20 } });
  assert.equal(diagnostic.adaptation.kind, 'diagnostic'); assert.equal(diagnostic.difficulty, 'Easy');
  const clarify = selectFollowUp({ ...seed, userAnswer: 'I used the standard approach with some checks that helped the team.', feedback: { technicalScore: 60 } });
  assert.equal(clarify.adaptation.kind, 'clarification'); assert(clarify.questionText.includes('I used the standard approach'));
  assert(clarify.questionText.includes('Failure recovery'));
  const deeper = selectFollowUp({ ...seed, userAnswer: 'I define the requirements and constraints before comparing alternatives and trade-offs. I implement tests for normal and malformed requests, validate error handling, monitor latency and plan rollback and failure recovery when a dependency fails.', feedback: { technicalScore: 85, relevanceScore: 85 } });
  assert.equal(deeper.adaptation.kind, 'deeper'); assert.equal(deeper.difficulty, 'Hard');
  assert.equal(deeper.adaptation.parentQuestionId, 'source'); assert(deeper.questionText.includes('API design'));
});
test('Phase 4: delayed feedback sanitizes adaptive metadata in processing output', () => {
  const follow = selectFollowUp({ ...seed, userAnswer: 'No idea', feedback: { technicalScore: 20 } });
  const output = publicOutput({ followUpQuestion: follow }, { feedbackMode: 'end', status: 'in_progress' });
  assert.equal(output.followUpQuestion.adaptation, undefined); assert.equal(output.followUpQuestion.suggestedAnswer, undefined);
  assert.equal(output.followUpQuestion.keyPoints, undefined);
});
