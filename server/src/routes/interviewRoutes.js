const express = require('express');
const { body } = require('express-validator');
const interviewController = require('../controllers/interviewController');
const { protect } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const { aiLimiter } = require('../middlewares/rateLimits');

const router = express.Router();

router.use(protect);

router.get('/analytics', interviewController.getAnalytics);
router.get('/sessions', interviewController.listSessions);
router.get('/descriptions', async (req, res, next) => { try { res.json({ success: true, data: await require('../models/JobDescription').find({ owner: req.user._id }).sort({ createdAt: -1 }).select('title targetRole company') }); } catch (error) { next(error); } });

router.post(
  '/sessions',
  aiLimiter,
  [
    body('resumeId').isMongoId().withMessage('A valid resumeId is required'),
    body('targetRole').isString().trim().isLength({ min: 1, max: 120 }),
    body('jobDescriptionId').optional({ values: 'falsy' }).isMongoId(),
    body('count').optional().isInt({ min: 1, max: 10 }).toInt(),
    validate,
  ],
  interviewController.startSession
);

router.get('/sessions/:id', interviewController.getSession);
router.post('/sessions/:id/follow-up', aiLimiter, async (req, res, next) => { try { res.status(202).json({ success: true, data: await require('../services/interviewFollowUp').followUp(req.params.id, req.user._id, req.body) }); } catch (error) { next(error); } });

router.post(
  '/sessions/:id/questions/:qid/answer',
  aiLimiter,
  [
    body('userAnswer').isString().trim().isLength({ min: 1, max: 12000 }).withMessage('Provide an answer up to 12000 characters'),
    validate,
  ],
  interviewController.submitAnswer
);

router.get('/sessions/:id/questions/:qid/suggested-answer', interviewController.getSuggestedAnswer);

module.exports = router;
