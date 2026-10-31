const express = require('express');
const processingController = require('../controllers/processingController');
const { protect } = require('../middlewares/auth');

const router = express.Router();

router.use(protect);

router.get('/health/providers', processingController.getProviderHealth);
router.get('/', async (req, res, next) => { try {
  const query = { owner: req.user._id };
  if (req.query.status && req.query.status !== 'all') query.status = req.query.status;
  res.json({ success: true, data: await require('../models/ProcessingJob').find(query).sort({ createdAt: -1 }).limit(100).select('-inputRef.rawInput -output -error.stack -leaseOwner') });
} catch (error) { next(error); } });
router.get('/usage', async (req, res, next) => { try {
  const Job = require('../models/ProcessingJob'), since = new Date(Date.now() - 86400000);
  const jobs = await Job.find({ owner: req.user._id, createdAt: { $gte: since } }).select('status durationMs usage');
  const attempts = jobs.flatMap((job) => job.usage || []), successes = attempts.filter((entry) => entry.status === 'success');
  res.json({ success: true, data: { windowHours: 24, requests: jobs.length, completed: jobs.filter((job) => job.status === 'COMPLETED').length,
    failed: jobs.filter((job) => job.status === 'FAILED').length, providerAttempts: attempts.length, offlineResponses: successes.filter((entry) => entry.provider === 'deterministic-fallback').length,
    averageDurationMs: jobs.length ? Math.round(jobs.reduce((sum, job) => sum + job.durationMs, 0) / jobs.length) : 0,
    inputTokens: successes.reduce((sum, entry) => sum + (entry.inputTokens || 0), 0), outputTokens: successes.reduce((sum, entry) => sum + (entry.outputTokens || 0), 0),
    providerTokenReports: successes.filter((entry) => entry.inputTokens !== undefined).length,
    requestLimit: require('../config/env').AI_RATE_LIMIT_MAX, limitWindowMinutes: 15,
  } });
} catch (error) { next(error); } });
router.post('/:id/retry', require('../middlewares/rateLimits').aiLimiter, async (req, res, next) => { try { res.status(202).json({ success: true, data: await require('../services/jobRecovery').retry(req.params.id, req.user._id) }); } catch (error) { next(error); } });
router.get('/:id', processingController.getJobStatus);
router.get('/:id/timeline', processingController.getJobTimeline);
router.post('/:id/cancel', processingController.cancelJob);

module.exports = router;
