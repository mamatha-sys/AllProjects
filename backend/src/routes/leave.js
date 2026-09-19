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
  const { status } = req.body; // Approved | Rejected | Cancelled
  if (!['Approved', 'Rejected', 'Cancelled'].includes(status)) return res.status(400).json({ error: 'status must be Approved, Rejected or Cancelled' });
  const leave = await prisma.leaveRequest.update({ where: { id: req.params.id }, data: { status, decidedAt: new Date() } });
  await logAudit({ userId: req.user.id, action: 'Leave ' + status.toLowerCase(), entity: 'LeaveRequest', entityId: leave.id, toValue: status });
  res.json(leave);
});

// Employee requests cancellation of an already-approved leave; HR decides via /decision above.
router.patch('/:id/cancel-request', async (req, res) => {
  const own = await prisma.employee.findUnique({ where: { userId: req.user.id } });
  const existing = await prisma.leaveRequest.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Leave request not found' });
  if (req.user.role === 'EMPLOYEE' && (!own || existing.employeeId !== own.id)) {
    return res.status(403).json({ error: "This isn't included in your role's permissions" });
  }
  const leave = await prisma.leaveRequest.update({ where: { id: req.params.id }, data: { status: 'Cancellation Requested' } });
  await logAudit({ userId: req.user.id, action: 'Leave cancellation requested', entity: 'LeaveRequest', entityId: leave.id });
  res.json(leave);
});

// ---- Leave policy: types, reasons, holidays (configurable by Super Admin/Admin) ----

const POLICY_ROLES = ['SUPER_ADMIN', 'ADMIN'];

router.get('/types', async (req, res) => {
  const types = await prisma.leaveType.findMany({ orderBy: { name: 'asc' } });
  res.json(types);
});

router.post('/types', requireRole(...POLICY_ROLES), async (req, res) => {
  const { code, name, cap, unit, carries } = req.body;
  if (!code || !name) return res.status(400).json({ error: 'code and name are required' });
  const type = await prisma.leaveType.create({ data: { code, name, cap: Number(cap) || 0, unit: unit || 'yr', carries: !!carries } });
  res.status(201).json(type);
});

router.put('/types/:id', requireRole(...POLICY_ROLES), async (req, res) => {
  const { cap, active } = req.body;
  const type = await prisma.leaveType.update({ where: { id: req.params.id }, data: { cap: cap != null ? Number(cap) : undefined, active } });
  await logAudit({ userId: req.user.id, action: 'Leave type updated', entity: 'LeaveType', entityId: type.id });
  res.json(type);
});

router.get('/reasons', async (req, res) => {
  const reasons = await prisma.leaveReason.findMany({ orderBy: { label: 'asc' } });
  res.json(reasons);
});

router.post('/reasons', requireRole(...POLICY_ROLES), async (req, res) => {
  const { label } = req.body;
  if (!label) return res.status(400).json({ error: 'label is required' });
  const reason = await prisma.leaveReason.create({ data: { label } });
  res.status(201).json(reason);
});

router.put('/reasons/:id', requireRole(...POLICY_ROLES), async (req, res) => {
  const { active } = req.body;
  const reason = await prisma.leaveReason.update({ where: { id: req.params.id }, data: { active } });
  res.json(reason);
});

router.get('/holidays', async (req, res) => {
  const holidays = await prisma.holiday.findMany({ orderBy: { date: 'asc' } });
  res.json(holidays);
});

router.post('/holidays', requireRole(...HR_ROLES), async (req, res) => {
  const { name, date } = req.body;
  if (!name || !date) return res.status(400).json({ error: 'name and date are required' });
  const holiday = await prisma.holiday.create({ data: { name, date } });
  await logAudit({ userId: req.user.id, action: 'Holiday added', entity: 'Holiday', entityId: holiday.id });
  res.status(201).json(holiday);
});

module.exports = router;
