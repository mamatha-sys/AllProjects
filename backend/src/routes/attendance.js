const express = require('express');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();
router.use(requireAuth);

const HR_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANT_MANAGER', 'STL', 'TL'];

async function resolveEmployeeId(req, requestedEmployeeId) {
  if (req.user.role === 'EMPLOYEE') {
    const own = await prisma.employee.findUnique({ where: { userId: req.user.id } });
    return own ? own.id : null;
  }
  return requestedEmployeeId || null;
}

router.get('/', async (req, res) => {
  const where = {};
  const employeeId = await resolveEmployeeId(req, req.query.employeeId);
  if (req.user.role === 'EMPLOYEE' && !employeeId) return res.json([]);
  if (employeeId) where.employeeId = employeeId;
  if (req.query.date) where.date = req.query.date;
  const attendance = await prisma.attendance.findMany({ where, include: { employee: true }, orderBy: { date: 'desc' } });
  res.json(attendance);
});

// Employees mark their own attendance; HR/managers can mark for anyone.
router.post('/', async (req, res) => {
  const { date, status, checkIn, checkOut } = req.body;
  let employeeId = req.body.employeeId;
  if (req.user.role === 'EMPLOYEE') {
    const own = await prisma.employee.findUnique({ where: { userId: req.user.id } });
    if (!own) return res.status(404).json({ error: 'No employee record linked to this account' });
    employeeId = own.id;
  } else if (!HR_ROLES.includes(req.user.role)) {
    return res.status(403).json({ error: "This isn't included in your role's permissions" });
  }
  if (!employeeId || !date || !status) return res.status(400).json({ error: 'employeeId, date and status are required' });

  const attendance = await prisma.attendance.upsert({
    where: { employeeId_date: { employeeId, date } },
    update: { status, checkIn, checkOut },
    create: { employeeId, date, status, checkIn, checkOut },
  });
  await logAudit({ userId: req.user.id, action: 'Attendance marked', entity: 'Attendance', entityId: attendance.id, toValue: status });
  res.status(201).json(attendance);
});

module.exports = router;
