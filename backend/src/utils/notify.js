const prisma = require('../db');

// In-app notification helper — the app's equivalent of the prototype's
// pushNotification(). Writes into the Notification model that the existing
// Administration > Notifications page already reads (see routes/admin.js),
// rather than introducing a second notification store.
async function pushNotification({ userId, title, message }) {
  if (!userId || !title) return null;
  return prisma.notification.create({ data: { userId, title, message } });
}

// Same, for a set of user ids — duplicates and empty ids are dropped, and the
// acting user never gets notified about their own action.
async function notifyUsers(userIds, { title, message, exceptUserId } = {}) {
  const ids = new Set((userIds || []).filter(Boolean));
  if (exceptUserId) ids.delete(exceptUserId);
  if (ids.size === 0) return [];
  return Promise.all([...ids].map((userId) => pushNotification({ userId, title, message })));
}

module.exports = { pushNotification, notifyUsers };
