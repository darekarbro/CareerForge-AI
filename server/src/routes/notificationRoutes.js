const express = require('express');
const notificationController = require('../controllers/notificationController');
const { protect } = require('../middlewares/auth');

const router = express.Router();

router.use(protect);

router.get('/', notificationController.listNotifications);
router.put('/:id/read', notificationController.markAsRead);
router.post('/mark-all-read', notificationController.markAllAsRead);
router.delete('/clear', notificationController.clearAll);

module.exports = router;
