const prisma = require('../db');

// Pushes an in-app notification to a user — mirrors the reference prototype's
// pushNotification() helper, called whenever an ATS stage/ownership change
// affects someone (candidate assigned to a recruiter/BDE, application stage
// changed, agreement sent/signed, etc).
async function pushNotification({ userId, title, message }) {
  if (!userId) return null;
  return prisma.notification.create({ data: { userId, title, message } });
}

module.exports = { pushNotification };
