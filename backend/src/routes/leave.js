const express = require('express');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();
router.use(requireAuth);

const HR_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANT_MANAGER', 'STL', 'TL'];

router.get('/', async (req, res) => {
  const where = {};
  if (req.user.role === 'EMPLOYEE') {
    const own = await prisma.employee.findUnique({ where: { userId: req.user.id } });
    if (!own) return res.json([]);
    where.employeeId = own.id;
  } else if (req.query.employeeId) {
    where.employeeId = req.query.employeeId;
  }
  if (req.query.status) where.status = req.query.status;
  const leave = await prisma.leaveRequest.findMany({ where, include: { employee: true }, orderBy: { createdAt: 'desc' } });
  res.json(leave);
});

router.post('/', async (req, res) => {
  const { type, fromDate, toDate, reason } = req.body;
  let employeeId = req.body.employeeId;
  if (req.user.role === 'EMPLOYEE') {
    const own = await prisma.employee.findUnique({ where: { userId: req.user.id } });
    if (!own) return res.status(404).json({ error: 'No employee record linked to this account' });
    employeeId = own.id;
  }
  if (!employeeId || !type || !fromDate || !toDate) {
    return res.status(400).json({ error: 'employeeId, type, fromDate and toDate are required' });
  }
  const leave = await prisma.leaveRequest.create({ data: { employeeId, type, fromDate, toDate, reason } });
  await logAudit({ userId: req.user.id, action: 'Leave requested', entity: 'LeaveRequest', entityId: leave.id });
  res.status(201).json(leave);
});

router.patch('/:id/decision', requireRole(...HR_ROLES), async (req, res) => {
  const { status } = req.body; // Approved | Rejected
  if (!['Approved', 'Rejected'].includes(status)) return res.status(400).json({ error: 'status must be Approved or Rejected' });
  const leave = await prisma.leaveRequest.update({ where: { id: req.params.id }, data: { status, decidedAt: new Date() } });
  await logAudit({ userId: req.user.id, action: 'Leave ' + status.toLowerCase(), entity: 'LeaveRequest', entityId: leave.id, toValue: status });
  res.json(leave);
});

module.exports = router;
