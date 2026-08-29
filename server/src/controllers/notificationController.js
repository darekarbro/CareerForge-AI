const notificationService = require('../services/notificationService');

const listNotifications = async (req, res, next) => {
  try {
    const notifications = await notificationService.listUserNotifications(req.user._id);
    res.status(200).json({
      success: true,
      data: notifications,
    });
  } catch (err) {
    next(err);
  }
};

const markAsRead = async (req, res, next) => {
  try {
    const notification = await notificationService.markAsRead(req.params.id, req.user._id);
    res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (err) {
    next(err);
  }
};

const markAllAsRead = async (req, res, next) => {
  try {
    await notificationService.markAllAsRead(req.user._id);
    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (err) {
    next(err);
  }
};

const clearAll = async (req, res, next) => {
  try {
    await notificationService.clearNotifications(req.user._id);
    res.status(200).json({
      success: true,
      message: 'Notifications cleared',
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listNotifications,
  markAsRead,
  markAllAsRead,
  clearAll,
};
