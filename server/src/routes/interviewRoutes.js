const express = require('express');
const { body } = require('express-validator');
const interviewController = require('../controllers/interviewController');
const { protect } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');

const router = express.Router();

router.use(protect);

router.get('/analytics', interviewController.getAnalytics);
router.get('/sessions', interviewController.listSessions);

router.post(
  '/sessions',
  [
    body('resumeId').notEmpty().withMessage('resumeId is required'),
    body('targetRole').notEmpty().withMessage('targetRole is required'),
    validate,
  ],
  interviewController.startSession
);

router.get('/sessions/:id', interviewController.getSession);

router.post(
  '/sessions/:id/questions/:qid/answer',
  [
    body('userAnswer').trim().notEmpty().withMessage('userAnswer cannot be empty'),
    validate,
  ],
  interviewController.submitAnswer
);

router.get('/sessions/:id/questions/:qid/suggested-answer', interviewController.getSuggestedAnswer);

module.exports = router;
