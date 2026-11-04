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

test('Phase 4: consecutive diagnostics narrow the check and refer to the previous answer without repeating the prompt', () => {
  const first = selectFollowUp({ ...seed, order: 1, userAnswer: 'No idea', feedback: { technicalScore: 20 } });
  const response = 'I would send a request for one record and check that the response contains its identifier.';
  const source = { ...first, _id: 'second', order: 2, userAnswer: response, feedback: { technicalScore: 35 } };
  const second = selectFollowUp(source);
  assert.equal(second.adaptation.kind, 'diagnostic'); assert.equal(second.difficulty, 'Easy');
  assert.notEqual(second.questionText, first.questionText); assert(second.questionText.includes(response));
  assert(second.questionText.includes('Predict one result')); assert.deepEqual(second.keyPoints, ['Single input', 'Expected result', 'Observable check']);
  assert.deepEqual(selectFollowUp(source), second);
  const third = selectFollowUp({ ...second, _id: 'third', order: 3, userAnswer: response, feedback: { technicalScore: 35 } });
  assert.notEqual(third.questionText, second.questionText); assert(third.questionText.includes('first action'));
  const hidden = publicOutput({ followUpQuestion: second }, { feedbackMode: 'end', status: 'in_progress' });
  assert.equal(hidden.followUpQuestion.adaptation, undefined); assert.equal(hidden.followUpQuestion.keyPoints, undefined);
});
