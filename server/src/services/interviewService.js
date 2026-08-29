const InterviewSession = require('../models/InterviewSession');
const InterviewQuestion = require('../models/InterviewQuestion');
const Resume = require('../models/Resume');
const ProcessingJob = require('../models/ProcessingJob');
const generatorAgent = require('../agents/generatorAgent');
const evaluatorAgent = require('../agents/evaluatorAgent');
const { enqueueJob } = require('../queues/processingQueue');

class InterviewService {
  async startSession({ userId, targetRole, resumeId, jobDescriptionId, count = 5 }) {
    const resume = await Resume.findOne({ _id: resumeId, owner: userId });
    if (!resume) {
      const error = new Error('Resume not found');
      error.statusCode = 404;
      throw error;
    }

    // 1. Create InterviewSession record
    const session = await InterviewSession.create({
      owner: userId,
      targetRole: targetRole || 'Fullstack Developer',
      resumeId: resume._id,
      jobDescriptionId: jobDescriptionId || null,
      status: 'in_progress',
      totalQuestions: count,
      startedAt: new Date(),
    });

    // 2. Create ProcessingJob for question generation
    const processingJob = await ProcessingJob.create({
      owner: userId,
      jobType: 'question_generation',
      status: 'PENDING',
      inputRef: {
        sessionId: session._id,
        resumeId: resume._id,
        targetRole: session.targetRole,
        rawInput: {
          resumeData: resume.parsedData,
          targetRole: session.targetRole,
          count,
        },
      },
    });

    await enqueueJob('question_generation', { jobId: processingJob._id });

    // Generate questions immediately
    const generated = await generatorAgent.generateQuestions({
      resumeData: resume.parsedData,
      targetRole: session.targetRole,
      count,
      jobId: processingJob._id,
      userId,
    });

    // Persist questions
    const questionDocs = await Promise.all(
      generated.questions.map((q, idx) =>
        InterviewQuestion.create({
          sessionId: session._id,
          order: idx + 1,
          questionText: q.questionText,
          category: q.category || 'technical',
          topic: q.topic || 'General',
          difficulty: q.difficulty || 'Medium',
          suggestedAnswer: q.suggestedAnswer,
          keyPoints: q.keyPoints || [],
        })
      )
    );

    session.aiProvider = generated.aiProvider;
    await session.save();

    return {
      session,
      questions: questionDocs,
      jobId: processingJob._id,
    };
  }

  async listSessions(userId) {
    return InterviewSession.find({ owner: userId })
      .populate('resumeId', 'title originalFileName')
      .sort({ createdAt: -1 });
  }

  async getSessionById(sessionId, userId) {
    const session = await InterviewSession.findOne({ _id: sessionId, owner: userId }).populate('resumeId');
    if (!session) {
      const error = new Error('Interview session not found');
      error.statusCode = 404;
      throw error;
    }

    const questions = await InterviewQuestion.find({ sessionId: session._id }).sort({ order: 1 });

    return {
      session,
      questions,
    };
  }

  async getSuggestedAnswer(sessionId, questionId, userId) {
    const session = await InterviewSession.findOne({ _id: sessionId, owner: userId });
    if (!session) {
      const error = new Error('Interview session not found');
      error.statusCode = 404;
      throw error;
    }

    const question = await InterviewQuestion.findOne({ _id: questionId, sessionId: session._id });
    if (!question) {
      const error = new Error('Question not found');
      error.statusCode = 404;
      throw error;
    }

    return {
      questionId: question._id,
      suggestedAnswer: question.suggestedAnswer,
      keyPoints: question.keyPoints,
    };
  }

  async submitAnswer({ sessionId, questionId, userId, userAnswer }) {
    const session = await InterviewSession.findOne({ _id: sessionId, owner: userId });
    if (!session) {
      const error = new Error('Interview session not found');
      error.statusCode = 404;
      throw error;
    }

    const question = await InterviewQuestion.findOne({ _id: questionId, sessionId: session._id });
    if (!question) {
      const error = new Error('Question not found');
      error.statusCode = 404;
      throw error;
    }

    // 1. Create ProcessingJob for evaluation
    const processingJob = await ProcessingJob.create({
      owner: userId,
      jobType: 'answer_evaluation',
      status: 'PENDING',
      inputRef: {
        sessionId: session._id,
        questionId: question._id,
        targetRole: session.targetRole,
        rawInput: {
          question,
          userAnswer,
          suggestedAnswer: question.suggestedAnswer,
          targetRole: session.targetRole,
        },
      },
    });

    await enqueueJob('answer_evaluation', { jobId: processingJob._id });

    // 2. Evaluate answer
    const feedback = await evaluatorAgent.evaluateAnswer({
      question,
      userAnswer,
      suggestedAnswer: question.suggestedAnswer,
      targetRole: session.targetRole,
      jobId: processingJob._id,
      userId,
    });

    question.userAnswer = userAnswer;
    question.feedback = {
      ...feedback,
      evaluatedAt: new Date(),
      aiProvider: feedback.aiProvider,
    };
    question.answeredAt = new Date();
    await question.save();

    // 3. Update session aggregates
    const allQuestions = await InterviewQuestion.find({ sessionId: session._id });
    const answered = allQuestions.filter(q => q.feedback?.overallScore !== undefined);
    
    session.answeredCount = answered.length;
    if (answered.length > 0) {
      const totalScore = answered.reduce((sum, q) => sum + (q.feedback.overallScore || 0), 0);
      session.overallScore = Math.round(totalScore / answered.length);

      session.dimensionAverages = {
        clarity: Math.round(answered.reduce((sum, q) => sum + (q.feedback.clarityScore || 0), 0) / answered.length),
        relevance: Math.round(answered.reduce((sum, q) => sum + (q.feedback.relevanceScore || 0), 0) / answered.length),
        structure: Math.round(answered.reduce((sum, q) => sum + (q.feedback.structureScore || 0), 0) / answered.length),
        technical: Math.round(answered.reduce((sum, q) => sum + (q.feedback.technicalScore || 0), 0) / answered.length),
      };

      // Weak topics identification (< 70 score)
      const weak = answered.filter(q => (q.feedback.overallScore || 0) < 70).map(q => q.topic);
      session.weakTopics = Array.from(new Set(weak));

      const strong = answered.filter(q => (q.feedback.overallScore || 0) >= 80).map(q => q.topic);
      session.strongTopics = Array.from(new Set(strong));
    }

    if (session.answeredCount >= session.totalQuestions) {
      session.status = 'completed';
      session.completedAt = new Date();
    }

    await session.save();

    return {
      question,
      session,
      jobId: processingJob._id,
    };
  }

  async getAnalytics(userId) {
    const sessions = await InterviewSession.find({ owner: userId }).sort({ createdAt: 1 });
    const questions = await InterviewQuestion.find({
      sessionId: { $in: sessions.map(s => s._id) },
      userAnswer: { $ne: '' },
    });

    const scoreTrends = sessions.map((s, idx) => ({
      sessionId: s._id,
      index: idx + 1,
      targetRole: s.targetRole,
      date: s.createdAt.toLocaleDateString(),
      overallScore: s.overallScore || 0,
      clarity: s.dimensionAverages?.clarity || 0,
      technical: s.dimensionAverages?.technical || 0,
      relevance: s.dimensionAverages?.relevance || 0,
      structure: s.dimensionAverages?.structure || 0,
    }));

    // Weak-topic heatmap aggregation
    const topicStats = {};
    questions.forEach(q => {
      const topic = q.topic || 'General';
      if (!topicStats[topic]) {
        topicStats[topic] = { topic, totalQuestions: 0, totalScore: 0, weakCount: 0 };
      }
      const score = q.feedback?.overallScore || 0;
      topicStats[topic].totalQuestions += 1;
      topicStats[topic].totalScore += score;
      if (score < 70) {
        topicStats[topic].weakCount += 1;
      }
    });

    const topicHeatmap = Object.values(topicStats).map(t => ({
      topic: t.topic,
      averageScore: Math.round(t.totalScore / Math.max(1, t.totalQuestions)),
      totalAttempts: t.totalQuestions,
      needsImprovement: t.weakCount > 0,
    }));

    return {
      totalSessions: sessions.length,
      completedSessions: sessions.filter(s => s.status === 'completed').length,
      scoreTrends,
      topicHeatmap,
    };
  }
}

module.exports = new InterviewService();
