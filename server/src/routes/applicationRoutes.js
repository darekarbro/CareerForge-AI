const express = require('express');
const { body } = require('express-validator');
const applicationController = require('../controllers/applicationController');
const { protect } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');

const router = express.Router();

router.use(protect);
router.get('/reminders', async (req, res, next) => { try { res.json({ success: true, data: await require('../services/applicationCalendar').reminders(req.user._id) }); } catch (error) { next(error); } });
router.get('/calendar.ics', async (req, res, next) => { try {
  const apps = await require('../models/Application').find({ owner: req.user._id, ...(req.query.id ? { _id: req.query.id } : { status: { $nin: ['offer', 'rejected'] } }) });
  res.type('text/calendar').attachment('careerforge-applications.ics').send(require('../services/applicationCalendar').calendar(apps));
} catch (error) { next(error); } });

router.get('/analytics', applicationController.getAnalytics);
router.get('/resume-versions', async (req, res, next) => { try { res.json({ success: true, data: await require('../models/TailoredResume').find({ owner: req.user._id }).sort({ createdAt: -1 }).select('targetRole version createdAt resumeId') }); } catch (error) { next(error); } });
router.post('/:id/attachments', require('multer')({ storage: require('multer').memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 } }).single('file'), async (req, res, next) => { try {
  res.status(201).json({ success: true, data: await require('../services/applicationAttachments').add(req.params.id, req.user._id, req.body, req.file) });
} catch (error) { next(error); } });
router.get('/:id/attachments/:attachmentId', async (req, res, next) => { try {
  const file = await require('../services/applicationAttachments').get(req.params.id, req.user._id, req.params.attachmentId);
  res.type('application/octet-stream').attachment(file.name).send(file.data);
} catch (error) { next(error); } });
router.delete('/:id/attachments/:attachmentId', async (req, res, next) => { try {
  res.json({ success: true, data: await require('../services/applicationAttachments').remove(req.params.id, req.user._id, req.params.attachmentId, req.body) });
} catch (error) { next(error); } });
router.get('/:id/resume', async (req, res, next) => { try {
  const application = await require('../models/Application').findOne({ _id: req.params.id, owner: req.user._id });
  if (!application?.resumeSnapshot?.content) return res.status(404).json({ success: false, message: 'No saved resume copy for this application' });
  const result = await require('../services/resumeExport').pdf(application.resumeSnapshot.content, {}, application.roleTitle);
  res.setHeader('Cache-Control', 'private, no-store'); res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', 'attachment; filename=application_resume.pdf'); res.send(result.buffer);
} catch (error) { next(error); } });
router.get('/', applicationController.listApplications);

router.post(
  '/',
  [
    body('company').trim().notEmpty().withMessage('Company is required'),
    body('roleTitle').trim().notEmpty().withMessage('Role title is required'),
    validate,
  ],
  applicationController.createApplication
);

router.put('/:id', applicationController.updateApplication);
router.delete('/:id', applicationController.deleteApplication);

module.exports = router;
