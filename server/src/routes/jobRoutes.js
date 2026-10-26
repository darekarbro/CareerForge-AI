const express = require('express');
const { body } = require('express-validator');
const jobController = require('../controllers/jobController');
const { protect } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');

const router = express.Router();

router.use(protect);

router.get('/roles', jobController.getSupportedRoles);

router.post(
  '/search-links',
  [
    body('targetRole').isString().trim().isLength({ min: 1, max: 120 }),
    body('location').optional().isString().trim().isLength({ min: 1, max: 120 }),
    body('resumeId').optional().isMongoId(),
    validate,
  ],
  jobController.generateSearchLinks
);

module.exports = router;
