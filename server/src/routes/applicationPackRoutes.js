const router = require('express').Router({ mergeParams: true });
const service = require('../services/applicationPackService');
const run = (fn) => async (req, res, next) => { try { res.setHeader('Cache-Control', 'private, no-store'); res.json({ success: true, data: await fn(req) }); } catch (error) { next(error); } };
router.get('/', run((req) => service.view(req.params.id, req.user._id)));
router.post('/', run((req) => service.generate(req.params.id, req.user._id, req.body)));
router.put('/', run((req) => service.save(req.params.id, req.user._id, req.body)));
router.get('/download', async (req, res, next) => { try {
  const output = await service.download(req.params.id, req.user._id);
  res.setHeader('Cache-Control', 'private, no-store'); res.type('text/plain'); res.attachment('application-preparation.txt'); res.send(output);
} catch (error) { next(error); } });
module.exports = router;
