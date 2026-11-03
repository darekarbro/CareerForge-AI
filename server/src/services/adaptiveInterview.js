const Question = require('../models/InterviewQuestion');

const policyVersion = 'adaptive-interview-v1';
function selectFollowUp(question) {
  const answer = question.userAnswer.trim();
  const words = answer.split(/\s+/).filter(Boolean).length;
  const topic = question.topic || 'this topic';
  const focus = (question.keyPoints || []).find((point) => !answer.toLowerCase().includes(point.toLowerCase())) || 'validation and failure handling';
  const diagnostic = words < 8 || /\b(?:don['’]?t know|not sure|no idea|cannot explain)\b/i.test(answer) || question.feedback?.technicalScore < 40;
  const deeper = !diagnostic && words >= 30 && question.feedback?.technicalScore >= 75 && question.feedback?.relevanceScore >= 70;
  const kind = diagnostic ? 'diagnostic' : deeper ? 'deeper' : 'clarification';
  const reason = diagnostic ? 'The previous answer needs a smaller check of the fundamentals.'
    : deeper ? 'The previous answer covered the rubric concepts; test a more demanding application.'
      : 'The previous answer needs a concrete explanation of an uncovered rubric point.';
  const excerpt = answer.slice(0, 180);
  const prompt = diagnostic
    ? `Let us take a smaller step on ${topic}. Define one basic concept, give a simple example, and describe how you would check it works.`
    : deeper
      ? `Building on your answer about ${topic}, compare two approaches under a new constraint: a dependency fails or the workload doubles. Explain the trade-off, a test, and a recovery strategy.`
      : `In your previous answer about ${topic}, you said: “${excerpt}”. Clarify ${focus}: describe your own action and one concrete example or test.`;
  return { questionText: prompt, topic, category: question.category, difficulty: diagnostic ? 'Easy' : deeper ? 'Hard' : question.difficulty,
    keyPoints: diagnostic ? ['Basic definition', 'Concrete example', 'Validation'] : deeper ? ['Constraints', 'Alternatives and trade-offs', 'Validation', 'Failure recovery'] : [focus, 'Personal actions', 'Concrete example'],
    suggestedAnswer: diagnostic ? 'Define the concept in plain language, walk through a small example, then describe a check and its expected result.'
      : deeper ? 'State the new constraint, compare two alternatives, justify a choice, then explain a test and recovery procedure.'
        : `Explain ${focus} using your own concrete action and a verifiable example. State what is uncertain rather than inventing an outcome.`,
    adaptation: { policyVersion, kind, parentQuestionId: question._id, sourceAnswerExcerpt: excerpt, reason } };
}

async function resolveNext(session, source) {
  if (!session.adaptiveEnabled || source.adaptationResolvedAt) return null;
  // Keep the requested question count and stable question IDs. A retry never rewrites an already resolved branch.
  const next = await Question.findOne({ sessionId: session._id, order: { $gt: source.order } }).sort({ order: 1 });
  let followUp = null;
  if (next) {
    if (String(next.adaptation?.parentQuestionId) === String(source._id)) followUp = next;
    else followUp = await Question.findOneAndUpdate({ _id: next._id, sessionId: session._id,
      answeredAt: { $exists: false }, evaluationJobId: null, 'adaptation.parentQuestionId': { $exists: false } },
    { $set: selectFollowUp(source) }, { new: true, runValidators: true });
  }
  await Question.updateOne({ _id: source._id, sessionId: session._id, adaptationResolvedAt: { $exists: false } },
    { $set: { adaptationResolvedAt: new Date() } });
  return followUp;
}

module.exports = { policyVersion, selectFollowUp, resolveNext };
