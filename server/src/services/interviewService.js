const InterviewSession = require('../models/InterviewSession');
const InterviewQuestion = require('../models/InterviewQuestion');
const JobDescription = require('../models/JobDescription');
const generatorAgent = require('../agents/generatorAgent');
const evaluatorAgent = require('../agents/evaluatorAgent');
const { createJob, dispatchJob } = require('./jobService');
const { plain } = require('../providers/resumeFacts');
const fail = (message, statusCode) => Object.assign(new Error(message), { statusCode });
function visibleQuestion(question, session) {
  const result = plain(question);
  if (session.feedbackMode === 'end' && session.status !== 'completed') {
    delete result.feedback; delete result.suggestedAnswer; delete result.keyPoints; delete result.attempts;
  }
  return result;
}

class InterviewService {
  async startSession({ userId, targetRole, resumeId, jobDescriptionId, count = 5, workspaceId, workspaceRevision, resumeSelection, difficulty = 'Medium', timeLimitSeconds = 0, topicFocus = '', feedbackMode = 'instant' }) {
    if (!Number.isInteger(count) || count < 1 || count > 10) throw fail('Choose 1 to 10 interview questions', 400);
    if (!['Easy', 'Medium', 'Hard'].includes(difficulty)) throw fail('Choose a valid interview difficulty', 400);
    if (![0, 60, 120, 180, 300].includes(timeLimitSeconds)) throw fail('Choose a supported practice timer', 400);
    if (!['instant', 'end'].includes(feedbackMode)) throw fail('Choose a supported feedback mode', 400);
    topicFocus = require('./resumeContent').text(topicFocus, 'Focus topic', 150);
    const resume = await require('./resumeService').getReadyResume(resumeId, userId);
    if (workspaceId) {
      const workspace = await require('./workspaceService').get(workspaceId, userId);
      if (workspace.archivedAt || String(workspace.resumeId) !== String(resumeId)) throw fail('Restore the workspace and use its selected resume before practicing.', 409);
      resumeSelection = workspace.resumeSelection; workspaceRevision = workspace.preparationRevision || 1; targetRole = workspace.title; jobDescriptionId = workspace.jobDescriptionId;
    }
    if (jobDescriptionId && !await JobDescription.exists({ _id: jobDescriptionId, owner: userId })) {
      throw fail('Job description not found', 404);
    }
    const job = await createJob({ userId, jobType: 'question_generation', inputRef: {
      resumeId: resume._id, workspaceId, workspaceRevision, jobDescriptionId: jobDescriptionId || undefined,
      targetRole, rawInput: { count, difficulty, timeLimitSeconds, topicFocus, feedbackMode, sourceRevision: resume.contentRevision || 1, ...(workspaceId || resumeSelection ? { sourceSnapshot: require('./resumeStructure').selectedContent(resume, resumeSelection) } : {}) },
    } });
    return dispatchJob(job);
  }
  async processQuestions({ job, checkpoint, commit }) {
    const existing = await InterviewSession.findOne({ processingJobId: job._id, owner: job.owner }).select('+pendingQuestions');
    if (existing) return commit(() => this.finishQuestions(existing, job));
    const resume = await require('./resumeService').getReadyResume(job.inputRef.resumeId, job.owner);
    const jd = job.inputRef.jobDescriptionId ?
      await JobDescription.findOne({ _id: job.inputRef.jobDescriptionId, owner: job.owner }) : null;
    if (job.inputRef.jobDescriptionId && !jd) throw fail('Job description not found', 404);
    const generated = await generatorAgent.generateQuestions({
      resumeData: job.inputRef.rawInput.sourceSnapshot || plain(resume.parsedData), targetRole: job.inputRef.targetRole,
      jobDescriptionText: jd?.rawText || '', count: job.inputRef.rawInput.count, difficulty: job.inputRef.rawInput.difficulty,
      topicFocus: job.inputRef.rawInput.topicFocus, jobId: job._id, userId: job.owner,
    });
    if (!generated.questions.length) throw fail('No interview questions generated', 502);
    await checkpoint();
    return commit(async () => {
      const session = await InterviewSession.create({
        processingJobId: job._id,
        pendingQuestions: generated.questions.map((question, index) => ({ ...question, _id: new (require('mongoose').Types.ObjectId)(), order: index + 1 })),
        workspaceId: job.inputRef.workspaceId, workspaceRevision: job.inputRef.workspaceRevision || 1, sourceRevision: job.inputRef.rawInput.sourceRevision || resume.contentRevision || 1,
        difficulty: job.inputRef.rawInput.difficulty, timeLimitSeconds: job.inputRef.rawInput.timeLimitSeconds,
        topicFocus: job.inputRef.rawInput.topicFocus, feedbackMode: job.inputRef.rawInput.feedbackMode,
        owner: job.owner, resumeId: resume._id, targetRole: job.inputRef.targetRole,
        jobDescriptionId: jd?._id, totalQuestions: generated.questions.length,
        aiProvider: generated.aiProvider, status: 'in_progress',
      });
      return this.finishQuestions(session, job);
    });
  }
  async finishQuestions(session, job) {
      try {
        if (session.pendingQuestions?.length) await InterviewQuestion.bulkWrite(session.pendingQuestions.map((question) => ({ updateOne: {
          filter: { _id: question._id, sessionId: session._id }, update: { $setOnInsert: { ...question, sessionId: session._id } }, upsert: true,
        } })));
        const questions = await InterviewQuestion.find({ sessionId: session._id }).sort({ order: 1 });
        if (questions.length !== session.totalQuestions) throw fail('Question generation is incomplete; retry this request.', 503);
        await InterviewSession.updateOne({ _id: session._id }, { $unset: { pendingQuestions: 1 } });
        await require('../models/ProcessingJob').updateOne({ _id: job._id }, { $set: { 'inputRef.sessionId': session._id } });
        await require('./workspaceService').link(job, { $addToSet: { interviewIds: session._id } });
        const publicSession = plain(session); delete publicSession.pendingQuestions;
        return { session: publicSession, questions: questions.map((item) => visibleQuestion(item, session)), aiProvider: session.aiProvider };
      } catch (error) {
        throw error;
      }
  }
  async listSessions(userId) {
    return InterviewSession.find({ owner: userId }).populate('resumeId', 'title originalFileName').sort({ createdAt: -1 });
  }
  async getSessionById(sessionId, userId) {
    const session = await InterviewSession.findOne({ _id: sessionId, owner: userId }).populate('resumeId');
    if (!session) throw fail('Interview session not found', 404);
    const questions = await InterviewQuestion.find({ sessionId: session._id }).sort({ order: 1 });
    return { session, questions: questions.map((item) => visibleQuestion(item, session)) };
  }
  async getSuggestedAnswer(sessionId, questionId, userId) {
    const { session, questions } = await this.getSessionById(sessionId, userId);
    if (session.feedbackMode === 'end' && session.status !== 'completed') throw fail('Model answers unlock after completing this session', 409);
    const question = questions.find((item) => String(item._id) === String(questionId));
    if (!question) throw fail('Question not found', 404);
    return { questionId: question._id, suggestedAnswer: question.suggestedAnswer, keyPoints: question.keyPoints };
  }
  async submitAnswer({ sessionId, questionId, userId, userAnswer, retry = false }) {
    const session = await InterviewSession.findOne({ _id: sessionId, owner: userId });
    if (!session) throw fail('Interview session not found', 404);
    if (typeof retry !== 'boolean') throw fail('Retry must be true or false', 400);
    if (session.status === 'cancelled' || session.status === 'completed' && !retry) throw fail('This session no longer accepts answers', 409);
    if (typeof userAnswer !== 'string' || !userAnswer.trim() || userAnswer.length > 12000) {
      throw fail('Provide an answer between 1 and 12000 characters', 400);
    }
    const question = await InterviewQuestion.findOne({ _id: questionId, sessionId });
    if (!question) throw fail('Question not found', 404);
    if (question.answeredAt && !retry) throw fail('Choose retry to improve an answered question', 409);
    if (question.attempts.length >= 10) throw fail('Start another practice session after 10 retries', 409);
    const job = await createJob({ userId, jobType: 'answer_evaluation', inputRef: {
      resumeId: session.resumeId, sessionId: session._id, questionId: question._id,
      answerBaseJobId: question.evaluatedByJobId,
      targetRole: session.targetRole, rawInput: { userAnswer: userAnswer.trim() },
    } });
    const claimed = await InterviewQuestion.findOneAndUpdate({
      _id: questionId, sessionId, evaluationJobId: null, evaluatedByJobId: question.evaluatedByJobId || null,
    }, { $set: { evaluationJobId: job._id } });
    if (!claimed) {
      await require('../models/ProcessingJob').deleteOne({ _id: job._id });
      await require('./jobPayloads').remove(job);
      throw fail('This question is already being evaluated', 409);
    }
    try { return await dispatchJob(job); }
    catch (error) {
      await InterviewQuestion.updateOne({ _id: questionId, evaluationJobId: job._id }, { $unset: { evaluationJobId: 1 } });
      throw error;
    }
  }
  async processAnswer({ job, checkpoint, commit }) {
    const session = await InterviewSession.findOne({ _id: job.inputRef.sessionId, owner: job.owner, status: { $ne: 'cancelled' } });
    const question = await InterviewQuestion.findOne({ _id: job.inputRef.questionId,
      sessionId: job.inputRef.sessionId, $or: [{ evaluationJobId: job._id }, { evaluatedByJobId: job._id }] });
    if (!session || !question) throw fail('Interview question is no longer available', 409);
    if (String(question.evaluatedByJobId) === String(job._id)) return commit(async () => {
      const updated = await this.updateScores(session, question, job.owner);
      return { question: visibleQuestion(question, updated), session: updated, aiProvider: question.feedback.aiProvider };
    });
    const { userAnswer } = job.inputRef.rawInput;
    const feedback = await evaluatorAgent.evaluateAnswer({ question: plain(question), userAnswer,
      suggestedAnswer: question.suggestedAnswer, targetRole: session.targetRole, jobId: job._id, userId: job.owner });
    await checkpoint();
    return commit(async () => {
      const updatedQuestion = await InterviewQuestion.findOneAndUpdate({ _id: question._id, evaluationJobId: job._id }, {
        $set: { userAnswer, feedback: { ...feedback, evaluatedAt: new Date() }, answeredAt: new Date(), evaluatedByJobId: job._id },
        ...(question.answeredAt ? { $push: { attempts: { $each: [{ userAnswer: question.userAnswer, feedback: plain(question.feedback), answeredAt: question.answeredAt }], $slice: -10 } } } : {}),
        $unset: { evaluationJobId: 1 },
      }, { new: true, runValidators: true });
      if (!updatedQuestion) throw fail('Answer was already evaluated', 409);
      const updatedSession = await this.updateScores(session, updatedQuestion, job.owner);
      return { question: visibleQuestion(updatedQuestion, updatedSession), session: updatedSession, aiProvider: feedback.aiProvider };
    });
  }
  async updateScores(session, question, owner) {
    const answered = await InterviewQuestion.find({ sessionId: session._id, answeredAt: { $exists: true } });
    const entry = (item) => ({ topic: item.topic, overall: item.feedback.overallScore, clarity: item.feedback.clarityScore,
      relevance: item.feedback.relevanceScore, structure: item.feedback.structureScore, technical: item.feedback.technicalScore });
    const seed = Object.fromEntries(answered.map((item) => [String(item._id), entry(item)]));
    const scores = { $map: { input: { $objectToArray: '$answerScores' }, as: 'pair', in: '$$pair.v' } };
    const sum = (key) => ({ $sum: { $map: { input: scores, as: 'item', in: '$$item.' + key } } });
    const totalUpdates = Object.fromEntries(['overall', 'clarity', 'relevance', 'structure', 'technical'].map((key) => ['scoreTotals.' + key, sum(key)]));
    const average = (key) => ({ $round: [{ $divide: ['$scoreTotals.' + key, { $max: [1, '$answeredCount'] }] }, 0] });
    const averages = Object.fromEntries(['clarity', 'relevance', 'structure', 'technical'].map((key) => ['dimensionAverages.' + key, average(key)]));
    const topics = (operator, threshold) => ({ $setUnion: [{ $map: { input: { $filter: { input: scores, as: 'item', cond: { [operator]: ['$$item.overall', threshold] } } }, as: 'item', in: '$$item.topic' } }, []] });
    const complete = { $gte: ['$answeredCount', '$totalQuestions'] };
    const updated = await InterviewSession.findOneAndUpdate({ _id: session._id, owner, status: { $ne: 'cancelled' } }, [
      { $set: { answerScores: { $mergeObjects: [{ $literal: seed }, { $ifNull: ['$answerScores', {}] }, { $literal: { [String(question._id)]: entry(question) } }] } } },
      { $set: { answeredCount: { $size: { $objectToArray: '$answerScores' } }, ...totalUpdates, weakTopics: topics('$lt', 70), strongTopics: topics('$gte', 80) } },
      { $set: { overallScore: average('overall'), ...averages, status: { $cond: [complete, 'completed', 'in_progress'] }, completedAt: { $cond: [complete, '$$NOW', '$$REMOVE'] } } },
    ], { new: true });
    if (!updated) throw fail('Session no longer accepts answers', 409);
    return updated;
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
