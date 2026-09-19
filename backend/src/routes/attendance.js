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

// ---- Regularization requests (correcting a missed/incorrect punch after the fact) ----

router.get('/regularizations', async (req, res) => {
  const where = {};
  const employeeId = await resolveEmployeeId(req, req.query.employeeId);
  if (req.user.role === 'EMPLOYEE' && !employeeId) return res.json([]);
  if (employeeId) where.employeeId = employeeId;
  if (req.query.status) where.status = req.query.status;
  const regularizations = await prisma.attendanceRegularization.findMany({ where, include: { employee: true }, orderBy: { createdAt: 'desc' } });
  res.json(regularizations);
});

router.post('/regularizations', async (req, res) => {
  const { date, requestedCheckIn, requestedCheckOut, reason } = req.body;
  const own = await prisma.employee.findUnique({ where: { userId: req.user.id } });
  if (!own) return res.status(404).json({ error: 'No employee record linked to this account' });
  if (!date) return res.status(400).json({ error: 'date is required' });
  const regularization = await prisma.attendanceRegularization.create({ data: { employeeId: own.id, date, requestedCheckIn, requestedCheckOut, reason } });
  await logAudit({ userId: req.user.id, action: 'Attendance regularization requested', entity: 'AttendanceRegularization', entityId: regularization.id });
  res.status(201).json(regularization);
});

router.patch('/regularizations/:id/decision', requireRole(...HR_ROLES), async (req, res) => {
  const { status } = req.body; // Approved | Rejected
  if (!['Approved', 'Rejected'].includes(status)) return res.status(400).json({ error: 'status must be Approved or Rejected' });
  const existing = await prisma.attendanceRegularization.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Request not found' });
  const regularization = await prisma.attendanceRegularization.update({ where: { id: req.params.id }, data: { status, decidedAt: new Date() } });
  if (status === 'Approved') {
    await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId: existing.employeeId, date: existing.date } },
      update: { checkIn: existing.requestedCheckIn || undefined, checkOut: existing.requestedCheckOut || undefined, status: 'Present' },
      create: { employeeId: existing.employeeId, date: existing.date, status: 'Present', checkIn: existing.requestedCheckIn, checkOut: existing.requestedCheckOut },
    });
  }
  await logAudit({ userId: req.user.id, action: 'Regularization ' + status.toLowerCase(), entity: 'AttendanceRegularization', entityId: regularization.id, toValue: status });
  res.json(regularization);
});

// ---- Attendance policy (grace time, half/full day thresholds) ----

router.get('/policy', async (req, res) => {
  let config = await prisma.hrConfig.findFirst();
  if (!config) config = await prisma.hrConfig.create({ data: {} });
  res.json(config);
});

router.put('/policy', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const { graceTimeMinutes, halfDayHours, fullDayHours, freeLateArrivalsPerMonth } = req.body;
  let config = await prisma.hrConfig.findFirst();
  if (!config) config = await prisma.hrConfig.create({ data: {} });
  const updated = await prisma.hrConfig.update({
    where: { id: config.id },
    data: {
      graceTimeMinutes: graceTimeMinutes != null ? Number(graceTimeMinutes) : undefined,
      halfDayHours: halfDayHours != null ? Number(halfDayHours) : undefined,
      fullDayHours: fullDayHours != null ? Number(fullDayHours) : undefined,
      freeLateArrivalsPerMonth: freeLateArrivalsPerMonth != null ? Number(freeLateArrivalsPerMonth) : undefined,
    },
  });
  await logAudit({ userId: req.user.id, action: 'Attendance policy updated', entity: 'HrConfig', entityId: updated.id });
  res.json(updated);
});

// ---- Monthly report: per-employee present/absent/late/half-day counts + attendance % ----

router.get('/report', requireRole(...HR_ROLES), async (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7); // YYYY-MM
  const employees = await prisma.employee.findMany({ where: { employmentStatus: { not: 'Relieved' } } });
  const records = await prisma.attendance.findMany({ where: { date: { startsWith: month } } });

  const [year, mo] = month.split('-').map(Number);
  const daysInMonth = new Date(year, mo, 0).getDate();
  let workingDays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, mo - 1, d).getDay();
    if (dow !== 0 && dow !== 6) workingDays++;
  }

  const rows = employees.map((e) => {
    const recs = records.filter((r) => r.employeeId === e.id);
    const present = recs.filter((r) => r.status === 'Present').length;
    const late = recs.filter((r) => r.status === 'Late').length;
    const halfDay = recs.filter((r) => r.status === 'Half Day').length;
    const absent = recs.filter((r) => r.status === 'Absent').length;
    const leave = recs.filter((r) => r.status === 'Leave').length;
    const effectivePresentDays = present + late + halfDay * 0.5;
    const pct = workingDays ? Math.round((effectivePresentDays / workingDays) * 100) : 0;
    return { employeeId: e.id, employeeCode: e.employeeCode, name: e.name, department: e.department, workingDays, present, late, halfDay, absent, leave, pct };
  });

  res.json({ month, workingDays, rows });
});

module.exports = router;
