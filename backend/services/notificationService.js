const Notification = require("../models/Notification");

/**
 * Create a notification for a user.
 */
async function createNotification(userId, { type, roomId = null, documentId = null, payload = {} }) {
  return Notification.create({ userId, type, roomId, documentId, payload });
}

/**
 * Get notifications for a user, optionally only unread ones.
 */
async function getNotifications(userId, { unreadOnly = false, limit = 50 } = {}) {
  const filter = { userId };
  if (unreadOnly) filter.read = false;

  return Notification.find(filter)
    .populate("roomId", "title documentId")
    .sort({ createdAt: -1 })
    .limit(limit);
}

/**
 * Mark a single notification as read.
 */
async function markRead(userId, notificationId) {
  const n = await Notification.findOne({ _id: notificationId, userId });
  if (!n) {
    const e = new Error("Notification not found."); e.status = 404; throw e;
  }
  n.read = true;
  await n.save();
  return n;
}

/**
 * Mark all notifications as read.
 */
async function markAllRead(userId) {
  await Notification.updateMany({ userId, read: false }, { $set: { read: true } });
}

/**
 * Count unread notifications.
 */
async function countUnread(userId) {
  return Notification.countDocuments({ userId, read: false });
}

module.exports = {
  createNotification,
  getNotifications,
  markRead,
  markAllRead,
  countUnread,
};
