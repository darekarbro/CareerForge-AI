const service = require('./interviewService');
async function followUp(id, owner, input) {
  const { session } = await service.getSessionById(id, owner);
  const topic = input.topic || session.weakTopics?.[0];
  if (!topic) throw require('./resumeContent').fail('Choose a topic to practise');
  return service.startSession({ userId: owner, resumeId: session.resumeId._id, targetRole: session.targetRole,
    jobDescriptionId: session.jobDescriptionId, workspaceId: session.workspaceId, count: 3,
    difficulty: input.difficulty || session.difficulty, topicFocus: topic, timeLimitSeconds: session.timeLimitSeconds, feedbackMode: session.feedbackMode });
}
module.exports = { followUp };
