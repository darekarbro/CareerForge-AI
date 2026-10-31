const router = require('express').Router();
const { protect } = require('../middlewares/auth');
const { authLimiter } = require('../middlewares/rateLimits');
const service = require('../services/privacyService');
router.post('/deletion-status', authLimiter, async (req, res, next) => { try { res.json({ success: true, data: await service.deletionStatus(req.body.receipt) }); } catch (error) { next(error); } });
router.use(protect);
router.get('/', async (req, res, next) => { try { res.json({ success: true, data: await service.get(req.user._id) }); } catch (error) { next(error); } });
router.put('/', async (req, res, next) => { try { res.json({ success: true, data: await service.save(req.user._id, req.body) }); } catch (error) { next(error); } });
router.post('/export', authLimiter, async (req, res, next) => { try {
  const buffer = await service.exportData(req.user, req.body);
  res.setHeader('Cache-Control', 'private, no-store'); res.setHeader('Content-Type', 'application/zip'); res.setHeader('Content-Disposition', 'attachment; filename=careerforge-account.zip'); res.send(buffer);
} catch (error) { next(error); } });
router.post('/delete', authLimiter, async (req, res, next) => { try { res.status(202).json({ success: true, data: await service.requestDeletion(req.user, req.body) }); } catch (error) { next(error); } });
module.exports = router;
