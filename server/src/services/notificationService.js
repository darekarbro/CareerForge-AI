const Notification = require('../models/Notification');

class NotificationService {
  async listUserNotifications(userId, { limit = 20 } = {}) {
    return Notification.find({ owner: userId })
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  async markAsRead(notificationId, userId) {
    return Notification.findOneAndUpdate(
      { _id: notificationId, owner: userId },
      { $set: { isRead: true } },
      { new: true }
    );
  }

  async markAllAsRead(userId) {
    await Notification.updateMany({ owner: userId, isRead: false }, { $set: { isRead: true } });
    return { success: true };
  }

  async clearNotifications(userId) {
    await Notification.deleteMany({ owner: userId });
    return { success: true };
  }
}

module.exports = new NotificationService();
