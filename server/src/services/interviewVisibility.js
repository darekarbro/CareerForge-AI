const { plain } = require('../providers/resumeFacts');
const hidden = (session) => session?.feedbackMode === 'end' && session.status !== 'completed';
function publicSession(record, visibility = record) {
  const value = plain(record); delete value.pendingQuestions;
  if (hidden(visibility)) for (const key of ['overallScore', 'answerScores', 'scoreTotals', 'dimensionAverages', 'weakTopics', 'strongTopics']) delete value[key];
  return value;
}
function publicQuestion(record, session) {
  const value = plain(record);
  if (hidden(session)) for (const key of ['feedback', 'suggestedAnswer', 'keyPoints', 'attempts']) delete value[key];
  return value;
}
function publicOutput(output, session) {
  if (!output) return output;
  return { ...plain(output), ...(output.session ? { session: publicSession(output.session, session) } : {}), ...(output.question ? { question: publicQuestion(output.question, session) } : {}), ...(output.questions ? { questions: output.questions.map((item) => publicQuestion(item, session)) } : {}) };
}
function publicEvent(record, session) {
  const value = plain(record);
  return hidden(session) && value.step === 'evaluation_completed' ? { ...value, message: 'Evaluation completed. Feedback unlocks after completing the session.', metadata: { aiProvider: value.metadata?.aiProvider } } : value;
}
module.exports = { hidden, publicSession, publicQuestion, publicOutput, publicEvent };
