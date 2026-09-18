const express = require('express');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();
router.use(requireAuth);

const HR_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANT_MANAGER', 'STL', 'TL'];
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

router.get('/me', async (req, res) => {
  const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });
  if (!employee) return res.status(404).json({ error: 'No employee record linked to this account' });
  res.json(employee);
});

router.get('/', requireRole(...HR_ROLES), async (req, res) => {
  const where = {};
  if (req.query.department) where.department = req.query.department;
  if (req.query.employmentStatus) where.employmentStatus = req.query.employmentStatus;
  const employees = await prisma.employee.findMany({ where, include: { reportingManager: true }, orderBy: { name: 'asc' } });
  res.json(employees);
});

router.put('/:id/manager', requireRole(...HR_ROLES), async (req, res) => {
  const { reportingManagerId } = req.body;
  const employee = await prisma.employee.update({ where: { id: req.params.id }, data: { reportingManagerId: reportingManagerId || null } });
  await logAudit({ userId: req.user.id, action: 'Reporting manager set', entity: 'Employee', entityId: employee.id });
  res.json(employee);
});

router.get('/:id', async (req, res) => {
  const employee = await prisma.employee.findUnique({
    where: { id: req.params.id },
    include: { reportingManager: true, user: { select: { id: true, name: true, email: true, role: true } } },
  });
  if (!employee) return res.status(404).json({ error: 'Employee not found' });
  if (req.user.role === 'EMPLOYEE' && employee.userId !== req.user.id) {
    return res.status(403).json({ error: "This isn't included in your role's permissions" });
  }
  res.json(employee);
});

router.post('/', requireRole(...HR_ROLES), async (req, res) => {
  const { employeeCode, name, email, phone, department, designation, location, dateOfJoining } = req.body;
  if (!employeeCode || !name) return res.status(400).json({ error: 'employeeCode and name are required' });
  const employee = await prisma.employee.create({
    data: { employeeCode, name, email, phone, department, designation, location, dateOfJoining: dateOfJoining ? new Date(dateOfJoining) : null },
  });
  await logAudit({ userId: req.user.id, action: 'Employee created', entity: 'Employee', entityId: employee.id });
  res.status(201).json(employee);
});

router.put('/:id', requireRole(...HR_ROLES), async (req, res) => {
  const { name, email, phone, department, designation, location, employmentStatus } = req.body;
  const employee = await prisma.employee.update({
    where: { id: req.params.id },
    data: { name, email, phone, department, designation, location, employmentStatus },
  });
  await logAudit({ userId: req.user.id, action: 'Employee updated', entity: 'Employee', entityId: employee.id });
  res.json(employee);
});

// Links (or unlinks) this employee record to a login account — lets Administration
// grant an employee self-service access without duplicating their profile data.
router.put('/:id/link-user', requireRole(...ADMIN_ROLES), async (req, res) => {
  const { userId } = req.body;
  if (userId) {
    const alreadyLinked = await prisma.employee.findFirst({ where: { userId, id: { not: req.params.id } } });
    if (alreadyLinked) return res.status(409).json({ error: 'That user account is already linked to another employee' });
  }
  const employee = await prisma.employee.update({ where: { id: req.params.id }, data: { userId: userId || null } });
  await logAudit({ userId: req.user.id, action: 'Employee linked to user account', entity: 'Employee', entityId: employee.id });
  res.json(employee);
});

module.exports = router;
