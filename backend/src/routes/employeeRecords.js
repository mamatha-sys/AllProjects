const express = require('express');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const HR_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANT_MANAGER', 'STL', 'TL'];

// Backs the ~11 similarly-shaped HRMS self-service areas (KT, Targets,
// Resignation, Recognition, Disciplinary, Shift Roster, Timesheet, Assets,
// Expense Claims, Helpdesk, Access Requests, Weekly Ideas) off one EmployeeRecord
// model, discriminated by `type`. Each router mounted from index.js is scoped
// to its own type so the frontend just sees a normal-looking REST resource.
function employeeRecordRouter(type, { decisionRoles = HR_ROLES, extraFields = [] } = {}) {
  const router = express.Router();
  router.use(requireAuth);

  router.get('/', async (req, res) => {
    const where = { type };
    if (req.user.role === 'EMPLOYEE') {
      const own = await prisma.employee.findUnique({ where: { userId: req.user.id } });
      if (!own) return res.json([]);
      where.employeeId = own.id;
    } else if (req.query.employeeId) {
      where.employeeId = req.query.employeeId;
    }
    if (req.query.status) where.status = req.query.status;
    const records = await prisma.employeeRecord.findMany({ where, include: { employee: true }, orderBy: { createdAt: 'desc' } });
    res.json(records);
  });

  router.post('/', async (req, res) => {
    const { title, detail, date, amount, hours } = req.body;
    let employeeId = req.body.employeeId;
    if (req.user.role === 'EMPLOYEE') {
      const own = await prisma.employee.findUnique({ where: { userId: req.user.id } });
      if (!own) return res.status(404).json({ error: 'No employee record linked to this account' });
      employeeId = own.id;
    }
    if (!employeeId || !title) return res.status(400).json({ error: 'employeeId and title are required' });

    const record = await prisma.employeeRecord.create({
      data: { type, employeeId, title, detail, date, amount: amount != null ? Number(amount) : null, hours: hours != null ? Number(hours) : null },
    });
    await logAudit({ userId: req.user.id, action: `${type} created`, entity: 'EmployeeRecord', entityId: record.id });
    res.status(201).json(record);
  });

  router.patch('/:id/status', requireRole(...decisionRoles), async (req, res) => {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status is required' });
    const record = await prisma.employeeRecord.update({ where: { id: req.params.id }, data: { status } });
    await logAudit({ userId: req.user.id, action: `${type} status changed`, entity: 'EmployeeRecord', entityId: record.id, toValue: status });
    res.json(record);
  });

  return router;
}

module.exports = employeeRecordRouter;
