const express = require('express');
const { body } = require('express-validator');
const applicationController = require('../controllers/applicationController');
const { protect } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');

const router = express.Router();

router.use(protect);

router.get('/analytics', applicationController.getAnalytics);
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
