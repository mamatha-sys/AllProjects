const prisma = require('../db');

async function logAudit({ userId, action, entity, entityId, fromValue, toValue }) {
  await prisma.auditLog.create({
    data: { userId, action, entity, entityId, fromValue, toValue },
  });
}

module.exports = { logAudit };
