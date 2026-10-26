const express = require('express');
const { body } = require('express-validator');
const resumeController = require('../controllers/resumeController');
const { protect } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const upload = require('../middlewares/upload');
const { aiLimiter } = require('../middlewares/rateLimits');

const router = express.Router();

// Apply auth to all resume routes
router.use(protect);

router.get('/dashboard', resumeController.getDashboardMetrics);
router.get('/', resumeController.listResumes);

router.post(
  '/upload',
  aiLimiter,
  upload.single('file'),
  resumeController.uploadResume
);

router.get('/:id', resumeController.getResume);
router.get('/:id/original', resumeController.downloadOriginal);
router.delete('/:id', resumeController.deleteResume);

router.post(
  '/:id/tailor',
  aiLimiter,
  [
    body('targetRole').trim().notEmpty().withMessage('Target role is required'),
    validate,
  ],
  resumeController.tailorResume
);

router.get('/:id/versions', resumeController.getVersions);
router.get('/:id/ats-score', resumeController.getAtsScore);

router.post(
  '/:id/gap-analysis',
  aiLimiter,
  [
    body('jobDescriptionText').trim().notEmpty().withMessage('Job description text is required'),
    validate,
  ],
  resumeController.runGapAnalysis
);

router.get('/:id/download/:versionId', resumeController.downloadTailoredPdf);

module.exports = router;
