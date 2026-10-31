const router = require('express').Router();
const service = require('../services/workspaceService');
const { protect } = require('../middlewares/auth');
const { aiLimiter } = require('../middlewares/rateLimits');
router.use(protect);
const run = (handler, status = 200) => async (req, res, next) => { try { res.status(status).json({ success: true, data: await handler(req) }); } catch (error) { next(error); } };
router.get('/', run((req) => service.list(req.user._id, req.query.state)));
router.post('/', run((req) => service.save(req.user._id, req.body), 201));
router.get('/:id', run((req) => service.details(req.params.id, req.user._id)));
router.put('/:id', run((req) => service.save(req.user._id, req.body, req.params.id)));
router.post('/:id/archive', run((req) => service.setArchived(req.params.id, req.user._id, req.body, true)));
router.post('/:id/restore', run((req) => service.setArchived(req.params.id, req.user._id, req.body, false)));
router.put('/:id/preparation', run((req) => service.checklist(req.params.id, req.user._id, req.body)));
router.post('/:id/tailor', aiLimiter, run(async (req) => require('../services/tailoringService').tailorResume(await service.inputs(req.params.id, req.user._id)), 202));
router.post('/:id/analyze', aiLimiter, run(async (req) => require('../services/gapAnalysisService').runGapAnalysis(await service.inputs(req.params.id, req.user._id)), 202));
router.post('/:id/interview', aiLimiter, run(async (req) => require('../services/interviewService').startSession({ ...await service.inputs(req.params.id, req.user._id), count: req.body.count || 5,
  difficulty: req.body.difficulty, timeLimitSeconds: req.body.timeLimitSeconds, topicFocus: req.body.topicFocus, feedbackMode: req.body.feedbackMode }), 202));
module.exports = router;
