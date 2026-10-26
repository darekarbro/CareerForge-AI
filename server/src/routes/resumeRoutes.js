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
const editing = require('../services/resumeEditingService');
router.put('/:id/content', async (req, res, next) => { try { res.json({ success: true, data: await editing.saveContent(req.params.id, req.user._id, req.body) }); } catch (error) { next(error); } });
router.get('/:id/history', async (req, res, next) => { try { res.json({ success: true, data: await editing.history(req.params.id, req.user._id) }); } catch (error) { next(error); } });
router.post('/:id/restore', async (req, res, next) => { try { res.json({ success: true, data: await editing.restore(req.params.id, req.user._id, req.body) }); } catch (error) { next(error); } });
router.get('/:id/versions/:versionId', async (req, res, next) => { try {
  const version = await require('../services/tailoringService').getTailoredVersion(req.params.versionId, req.user._id);
  if (String(version.resumeId) !== req.params.id) return res.status(404).json({ success: false, message: 'Version not found' });
  res.json({ success: true, data: version });
} catch (error) { next(error); } });
router.put('/:id/versions/:versionId', async (req, res, next) => { try { res.json({ success: true, data: await editing.saveVersion(req.params.id, req.params.versionId, req.user._id, req.body) }); } catch (error) { next(error); } });
router.post('/:id/versions/:versionId/regenerate', aiLimiter, async (req, res, next) => { try { res.status(202).json({ success: true, data: await require('../services/sectionService').request(req.params.id, req.params.versionId, req.user._id, req.body) }); } catch (error) { next(error); } });
router.post('/:id/versions/:versionId/restore', async (req, res, next) => { try { res.json({ success: true, data: await editing.restoreVersion(req.params.id, req.params.versionId, req.user._id, req.body) }); } catch (error) { next(error); } });

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
router.post('/:id/assess', aiLimiter, async (req, res, next) => { try { res.status(202).json({ success: true, data: await require('../services/assessmentService').request(req.params.id, req.user._id, req.body.versionId) }); } catch (error) { next(error); } });

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
