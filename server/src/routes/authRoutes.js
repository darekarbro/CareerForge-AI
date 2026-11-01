const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { protect } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');

const router = express.Router();

router.post(
  '/register',
  [
    body('name').isString().bail().trim().isLength({ min: 1, max: 120 }).withMessage('Name must contain 1 to 120 characters'),
    body('targetRolePreference').optional().isString().bail().trim().isLength({ min: 1, max: 120 }),
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').isString().isLength({ min: 8, max: 128 }).custom((value) => Buffer.byteLength(value, 'utf8') <= 72).withMessage('Password must contain 8–72 UTF-8 bytes'),
    validate,
  ],
  authController.register
);

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').isString().bail().isLength({ min: 1, max: 128 }).withMessage('Provide a password of at most 128 characters'),
    validate,
  ],
  authController.login
);

router.post(
  '/firebase',
  [
    body('idToken').isString().bail().isLength({ min: 1, max: 20000 }).withMessage('Firebase ID token is required'),
    validate,
  ],
  authController.firebaseLogin
);

router.get('/me', protect, authController.getMe);
const handle = (work) => async (req, res, next) => { try { res.json({ success: true, data: await work(req) }); } catch (error) { next(error); } };
router.post('/forgot-password', [body('email').trim().isEmail(), validate], handle((req) => require('../services/accountMailService').request(req.body.email, 'reset')));
router.post('/reset-password', handle((req) => require('../services/authService').resetPassword(req.body.token, req.body.password)));
router.post('/verify-email', handle((req) => require('../services/authService').verifyEmail(req.body.token)));
router.post('/resend-verification', protect, handle((req) => require('../services/accountMailService').request(req.user.email, 'verify')));
router.post('/logout', protect, handle(async (req) => { await require('../services/sessionService').revokeCurrent(req.user._id, req.auth.sessionId); return { loggedOut: true }; }));
router.post('/logout-all', protect, handle(async (req) => { await require('../services/sessionService').revokeAll(req.user._id); return { loggedOut: true }; }));
router.get('/sessions', protect, handle(async (req) => (await require('../models/AuthSession').find({ owner: req.user._id, authVersion: req.user.authVersion || 0, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 })).map((item) => ({ id: item._id, device: item.device, createdAt: item.createdAt, expiresAt: item.expiresAt, current: String(item._id) === String(req.auth.sessionId) }))));
router.put('/me', protect, authController.updateProfile);
router.put('/password', protect, [
  body('currentPassword').isString().notEmpty(),
  body('newPassword').isString().isLength({ min: 8, max: 128 }).custom((value) => Buffer.byteLength(value, 'utf8') <= 72),
  validate,
], async (req, res, next) => {
  try {
    const result = await require('../services/authService').changePassword(req.user._id, req.body);
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
});

module.exports = router;
