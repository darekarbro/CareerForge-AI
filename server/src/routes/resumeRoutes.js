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
router.get('/:id/import-review', async (req, res, next) => { try { res.setHeader('Cache-Control', 'private, no-store'); res.json({ success: true, data: await require('../services/importReviewService').review(req.params.id, req.user._id) }); } catch (error) { next(error); } });
router.get('/:id/source-document', async (req, res, next) => { try {
  const resume = await require('../services/resumeService').getResumeById(req.params.id, req.user._id);
  const buffer = await require('../config/cloudinary').readOriginal(resume);
  res.setHeader('Cache-Control', 'private, no-store');
  res.type(resume.fileType === 'pdf' ? 'application/pdf' : resume.fileType === 'txt' ? 'text/plain' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', resume.fileType === 'pdf' ? 'inline; filename=resume-source.pdf' : 'attachment; filename=resume-source.' + resume.fileType);
  res.send(buffer);
} catch (error) { next(error); } });
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
router.get('/:id/versions/:versionId/evidence', async (req, res, next) => { try {
  const version = await require('../services/tailoringService').getTailoredVersion(req.params.versionId, req.user._id);
  if (String(version.resumeId) !== req.params.id) return res.status(404).json({ success: false, message: 'Version not found' });
  res.setHeader('Cache-Control', 'private, no-store'); res.json({ success: true, data: await require('../services/claimEvidenceService').version(req.user._id, version) });
} catch (error) { next(error); } });
router.post('/:id/versions/:versionId/evidence', async (req, res, next) => { try {
  const version = await require('../services/tailoringService').getTailoredVersion(req.params.versionId, req.user._id);
  if (String(version.resumeId) !== req.params.id) return res.status(404).json({ success: false, message: 'Version not found' });
  const resume = await require('../services/resumeService').getReadyResume(req.params.id, req.user._id);
  const original = version.sourceContent || resume.parsedData, data = resume.toObject(); if (version.sourceRevision !== (resume.contentRevision || 1)) data.verifiedAt = null;
  const snapshots = (await require('../services/evidenceService').syncResume(req.user._id, data, require('../services/resumeStructure').withEntryIds(original), version.sourceRevision)).map(require('../services/evidenceService').snapshot);
  const entryIds = ['workExperience', 'projects'].flatMap((section) => require('../services/resumeStructure').withEntryIds(original)[section].map((entry) => entry.entryId));
  const extra = await require('../models/CareerEvidence').find({ owner: req.user._id, archivedAt: null, verification: 'confirmed', 'context.entryId': { $in: entryIds }, 'context.recordId': String(data._id) }).limit(4000);
  const collected = [...new Map([...snapshots, ...extra.map(require('../services/evidenceService').snapshot)].map((item) => [item.id, item])).values()];
  await version.updateOne({ $set: { evidenceSnapshot: collected } }); version.evidenceSnapshot = collected;
  res.json({ success: true, data: await require('../services/claimEvidenceService').version(req.user._id, version) });
} catch (error) { next(error); } });
router.get('/:id/versions/:versionId/history', async (req, res, next) => { try { res.json({ success: true, data: await editing.versionHistory(req.params.id, req.params.versionId, req.user._id) }); } catch (error) { next(error); } });
router.put('/:id/versions/:versionId/layout', async (req, res, next) => { try { res.json({ success: true, data: await editing.saveLayout(req.params.id, req.params.versionId, req.user._id, req.body) }); } catch (error) { next(error); } });
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
