const interviewService = require('../services/interviewService');

const startSession = async (req, res, next) => {
  try {
    const { targetRole, resumeId, jobDescriptionId, count } = req.body;
    if (!resumeId) {
      return res.status(400).json({
        success: false,
        message: 'A resumeId is required to start a mock interview session.',
      });
    }

    const result = await interviewService.startSession({
      userId: req.user._id,
      targetRole: targetRole || 'Fullstack Developer',
      resumeId,
      jobDescriptionId,
      count: count || 5,
    });

    res.status(201).json({
      success: true,
      message: 'Interview session initialized and questions generated',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

const listSessions = async (req, res, next) => {
  try {
    const sessions = await interviewService.listSessions(req.user._id);
    res.status(200).json({
      success: true,
      data: sessions,
    });
  } catch (err) {
    next(err);
  }
};

const getSession = async (req, res, next) => {
  try {
    const sessionData = await interviewService.getSessionById(req.params.id, req.user._id);
    res.status(200).json({
      success: true,
      data: sessionData,
    });
  } catch (err) {
    next(err);
  }
};

const submitAnswer = async (req, res, next) => {
  try {
    const { id, qid } = req.params;
    const { userAnswer } = req.body;

    if (!userAnswer || userAnswer.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'userAnswer content is required.',
      });
    }

    const result = await interviewService.submitAnswer({
      sessionId: id,
      questionId: qid,
      userId: req.user._id,
      userAnswer,
    });

    res.status(200).json({
      success: true,
      message: 'Answer submitted and evaluated',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

const getSuggestedAnswer = async (req, res, next) => {
  try {
    const { id, qid } = req.params;
    const result = await interviewService.getSuggestedAnswer(id, qid, req.user._id);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

const getAnalytics = async (req, res, next) => {
  try {
    const analytics = await interviewService.getAnalytics(req.user._id);
    res.status(200).json({
      success: true,
      data: analytics,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  startSession,
  listSessions,
  getSession,
  submitAnswer,
  getSuggestedAnswer,
  getAnalytics,
};
