const express = require('express');
const processingController = require('../controllers/processingController');
const { protect } = require('../middlewares/auth');

const router = express.Router();

router.use(protect);

router.get('/health/providers', processingController.getProviderHealth);
router.get('/:id', processingController.getJobStatus);
router.get('/:id/timeline', processingController.getJobTimeline);
router.post('/:id/cancel', processingController.cancelJob);

module.exports = router;
