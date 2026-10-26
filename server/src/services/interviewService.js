const InterviewSession = require('../models/InterviewSession');
const InterviewQuestion = require('../models/InterviewQuestion');
const JobDescription = require('../models/JobDescription');
const generatorAgent = require('../agents/generatorAgent');
const evaluatorAgent = require('../agents/evaluatorAgent');
const { createJob, dispatchJob } = require('./jobService');
const { plain } = require('../providers/resumeFacts');
const fail = (message, statusCode) => Object.assign(new Error(message), { statusCode });

class InterviewService {
  async startSession({ userId, targetRole, resumeId, jobDescriptionId, count = 5 }) {
    if (!Number.isInteger(count) || count < 1 || count > 10) throw fail('Choose 1 to 10 interview questions', 400);
    const resume = await require('./resumeService').getReadyResume(resumeId, userId);
    if (jobDescriptionId && !await JobDescription.exists({ _id: jobDescriptionId, owner: userId })) {
      throw fail('Job description not found', 404);
    }
    const job = await createJob({ userId, jobType: 'question_generation', inputRef: {
      resumeId: resume._id, jobDescriptionId: jobDescriptionId || undefined,
      targetRole, rawInput: { count },
    } });
    return dispatchJob(job);
  }
  async processQuestions({ job, checkpoint, commit }) {
    const resume = await require('./resumeService').getReadyResume(job.inputRef.resumeId, job.owner);
    const jd = job.inputRef.jobDescriptionId ?
      await JobDescription.findOne({ _id: job.inputRef.jobDescriptionId, owner: job.owner }) : null;
    if (job.inputRef.jobDescriptionId && !jd) throw fail('Job description not found', 404);
    const generated = await generatorAgent.generateQuestions({
      resumeData: plain(resume.parsedData), targetRole: job.inputRef.targetRole,
      jobDescriptionText: jd?.rawText || '', count: job.inputRef.rawInput.count, jobId: job._id, userId: job.owner,
    });
    if (!generated.questions.length) throw fail('No interview questions generated', 502);
    await checkpoint();
    return commit(async () => {
      const session = await InterviewSession.create({
        owner: job.owner, resumeId: resume._id, targetRole: job.inputRef.targetRole,
        jobDescriptionId: jd?._id, totalQuestions: generated.questions.length,
        aiProvider: generated.aiProvider, status: 'in_progress',
      });
      try {
        const questions = await InterviewQuestion.insertMany(generated.questions.map((question, index) => ({
          ...question, sessionId: session._id, order: index + 1,
        })));
        await require('../models/ProcessingJob').updateOne({ _id: job._id }, { $set: { 'inputRef.sessionId': session._id } });
        return { session, questions, aiProvider: generated.aiProvider };
      } catch (error) {
        await InterviewQuestion.deleteMany({ sessionId: session._id });
        await InterviewSession.deleteOne({ _id: session._id });
        throw error;
      }
    });
  }
  async listSessions(userId) {
    return InterviewSession.find({ owner: userId }).populate('resumeId', 'title originalFileName').sort({ createdAt: -1 });
  }
  async getSessionById(sessionId, userId) {
    const session = await InterviewSession.findOne({ _id: sessionId, owner: userId }).populate('resumeId');
    if (!session) throw fail('Interview session not found', 404);
    return { session, questions: await InterviewQuestion.find({ sessionId: session._id }).sort({ order: 1 }) };
  }
  async getSuggestedAnswer(sessionId, questionId, userId) {
    const { questions } = await this.getSessionById(sessionId, userId);
    const question = questions.find((item) => String(item._id) === String(questionId));
    if (!question) throw fail('Question not found', 404);
    return { questionId: question._id, suggestedAnswer: question.suggestedAnswer, keyPoints: question.keyPoints };
  }
  async submitAnswer({ sessionId, questionId, userId, userAnswer }) {
    const session = await InterviewSession.findOne({ _id: sessionId, owner: userId });
    if (!session) throw fail('Interview session not found', 404);
    if (session.status !== 'in_progress') throw fail('This session no longer accepts answers', 409);
    if (typeof userAnswer !== 'string' || !userAnswer.trim() || userAnswer.length > 12000) {
      throw fail('Provide an answer between 1 and 12000 characters', 400);
    }
    const question = await InterviewQuestion.findOne({ _id: questionId, sessionId });
    if (!question) throw fail('Question not found', 404);
    if (question.answeredAt) throw fail('This question has already been answered', 409);
    const job = await createJob({ userId, jobType: 'answer_evaluation', inputRef: {
      resumeId: session.resumeId, sessionId: session._id, questionId: question._id,
      targetRole: session.targetRole, rawInput: { userAnswer: userAnswer.trim() },
    } });
    const claimed = await InterviewQuestion.findOneAndUpdate({
      _id: questionId, sessionId, evaluationJobId: null, answeredAt: { $exists: false },
    }, { $set: { evaluationJobId: job._id } });
    if (!claimed) {
      await require('../models/ProcessingJob').deleteOne({ _id: job._id });
      throw fail('This question is already being evaluated', 409);
    }
    try { return await dispatchJob(job); }
    catch (error) {
      await InterviewQuestion.updateOne({ _id: questionId, evaluationJobId: job._id }, { $unset: { evaluationJobId: 1 } });
      throw error;
    }
  }
  async processAnswer({ job, checkpoint, commit }) {
    const session = await InterviewSession.findOne({ _id: job.inputRef.sessionId, owner: job.owner, status: 'in_progress' });
    const question = await InterviewQuestion.findOne({ _id: job.inputRef.questionId,
      sessionId: job.inputRef.sessionId, evaluationJobId: job._id });
    if (!session || !question) throw fail('Interview question is no longer available', 409);
    const { userAnswer } = job.inputRef.rawInput;
    const feedback = await evaluatorAgent.evaluateAnswer({ question: plain(question), userAnswer,
      suggestedAnswer: question.suggestedAnswer, targetRole: session.targetRole, jobId: job._id, userId: job.owner });
    await checkpoint();
    return commit(async () => {
      const updatedQuestion = await InterviewQuestion.findOneAndUpdate({ _id: question._id, evaluationJobId: job._id,
        answeredAt: { $exists: false } }, {
        $set: { userAnswer, feedback: { ...feedback, evaluatedAt: new Date() }, answeredAt: new Date() },
        $unset: { evaluationJobId: 1 },
      }, { new: true, runValidators: true });
      if (!updatedQuestion) throw fail('Answer was already evaluated', 409);
      const add = (field, value) => ({ $add: [{ $ifNull: ['$' + field, 0] }, value] });
      const totals = { overall: feedback.overallScore, clarity: feedback.clarityScore,
        relevance: feedback.relevanceScore, structure: feedback.structureScore, technical: feedback.technicalScore };
      const totalUpdates = Object.fromEntries(Object.entries(totals).map(([key, value]) => [
        'scoreTotals.' + key, add('scoreTotals.' + key, value),
      ]));
      const averages = Object.fromEntries(['clarity', 'relevance', 'structure', 'technical'].map((key) => [
        'dimensionAverages.' + key, { $round: [{ $divide: ['$scoreTotals.' + key, '$answeredCount'] }, 0] },
      ]));
      const complete = { $gte: ['$answeredCount', '$totalQuestions'] };
      const updatedSession = await InterviewSession.findOneAndUpdate({ _id: session._id, owner: job.owner, status: 'in_progress' }, [
        { $set: { answeredCount: add('answeredCount', 1), ...totalUpdates,
          weakTopics: { $setUnion: [{ $ifNull: ['$weakTopics', []] }, feedback.overallScore < 70 ? [question.topic] : []] },
          strongTopics: { $setUnion: [{ $ifNull: ['$strongTopics', []] }, feedback.overallScore >= 80 ? [question.topic] : []] } } },
        { $set: { overallScore: { $round: [{ $divide: ['$scoreTotals.overall', '$answeredCount'] }, 0] }, ...averages,
          status: { $cond: [complete, 'completed', 'in_progress'] },
          completedAt: { $cond: [complete, '$$NOW', '$$REMOVE'] } } },
      ], { new: true });
      if (!updatedSession) throw fail('Session no longer accepts answers', 409);
      return { question: updatedQuestion, session: updatedSession, aiProvider: feedback.aiProvider };
    });
  }
  async getAnalytics(userId) {
    const allSessions = await InterviewSession.find({ owner: userId }).sort({ createdAt: 1 });
    const sessions = allSessions.filter((session) => session.status === 'completed');
    const questions = await InterviewQuestion.find({ sessionId: { $in: allSessions.map((session) => session._id) },
      answeredAt: { $exists: true }, 'feedback.overallScore': { $exists: true } });
    const topics = new Map();
    questions.forEach((question) => {
      const key = question.topic || 'General', stats = topics.get(key) || { topic: key, sum: 0, count: 0, weak: 0 };
      stats.sum += question.feedback.overallScore; stats.count++; stats.weak += question.feedback.overallScore < 70 ? 1 : 0;
      topics.set(key, stats);
    });
    return {
      totalSessions: allSessions.length, completedSessions: sessions.length,
      scoreTrends: sessions.map((session, index) => ({ sessionId: session._id, index: index + 1,
        targetRole: session.targetRole, date: session.completedAt?.toISOString(), overallScore: session.overallScore,
        ...plain(session.dimensionAverages) })),
      topicHeatmap: [...topics.values()].map((stats) => ({ topic: stats.topic, averageScore: Math.round(stats.sum / stats.count),
        totalAttempts: stats.count, needsImprovement: stats.weak > 0 })),
    };
  }
}
module.exports = new InterviewService();
