const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();
router.use(requireAuth);

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];
const SUPER_ADMIN_ONLY = ['SUPER_ADMIN'];
const ALL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANT_MANAGER', 'STL', 'TL', 'RECRUITER', 'BDE', 'CLIENT', 'ACCOUNTANT', 'EMPLOYEE'];

// ---- Users ----
router.get('/users', requireRole(...ADMIN_ROLES), async (req, res) => {
  const users = await prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, atsDepartment: true, clientId: true, createdAt: true }, orderBy: { name: 'asc' } });
  res.json(users);
});

router.post('/users', requireRole(...ADMIN_ROLES), async (req, res) => {
  const { name, email, password, role, atsDepartment, clientId } = req.body;
  if (!name || !email || !password || !role) return res.status(400).json({ error: 'name, email, password and role are required' });
  if (!ALL_ROLES.includes(role)) return res.status(400).json({ error: 'Unknown role' });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { name, email, passwordHash, role, atsDepartment, clientId } });
  await logAudit({ userId: req.user.id, action: 'User created', entity: 'User', entityId: user.id });
  res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

router.put('/users/:id', requireRole(...ADMIN_ROLES), async (req, res) => {
  const { name, role, atsDepartment } = req.body;
  if (role && !ALL_ROLES.includes(role)) return res.status(400).json({ error: 'Unknown role' });
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { name, role, atsDepartment } });
  await logAudit({ userId: req.user.id, action: 'User updated', entity: 'User', entityId: user.id });
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

// ---- Role catalog (reference data — what each role can see) ----
router.get('/role-catalog', (req, res) => {
  res.json([
    { role: 'SUPER_ADMIN', access: 'Full access to every module' },
    { role: 'ADMIN', access: 'Full access to every module' },
    { role: 'MANAGER', access: 'HRMS + ATS + Accounts, cross-department oversight' },
    { role: 'ASSISTANT_MANAGER', access: 'HRMS + ATS, team oversight' },
    { role: 'STL', access: 'HRMS + ATS, senior team-lead scope' },
    { role: 'TL', access: 'HRMS + ATS, team scope' },
    { role: 'RECRUITER', access: 'ATS only — own requirements & candidates' },
    { role: 'BDE', access: 'ATS only — own requirements, client hand-off' },
    { role: 'CLIENT', access: 'ATS (own requirements) + Accounts (own invoices)' },
    { role: 'ACCOUNTANT', access: 'Accounts + Payroll only' },
    { role: 'EMPLOYEE', access: 'HRMS self-service only' },
  ]);
});

// ---- Departments & Teams (Super Admin-managed; everyone can read them for dropdowns) ----
router.get('/departments', async (req, res) => {
  const departments = await prisma.department.findMany({ include: { teams: { orderBy: { name: 'asc' } } }, orderBy: { name: 'asc' } });
  res.json(departments);
});

router.post('/departments', requireRole(...SUPER_ADMIN_ONLY), async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
  try {
    const department = await prisma.department.create({ data: { name: name.trim() } });
    await logAudit({ userId: req.user.id, action: 'Department added', entity: 'Department', entityId: department.id, toValue: department.name });
    res.status(201).json(department);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'That department already exists' });
    throw err;
  }
});

router.delete('/departments/:id', requireRole(...SUPER_ADMIN_ONLY), async (req, res) => {
  const department = await prisma.department.findUnique({ where: { id: req.params.id } });
  if (!department) return res.status(404).json({ error: 'Department not found' });
  await prisma.team.deleteMany({ where: { departmentId: req.params.id } });
  await prisma.department.delete({ where: { id: req.params.id } });
  await logAudit({ userId: req.user.id, action: 'Department removed', entity: 'Department', entityId: req.params.id, fromValue: department.name });
  res.json({ ok: true });
});

router.post('/departments/:id/teams', requireRole(...SUPER_ADMIN_ONLY), async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
  const department = await prisma.department.findUnique({ where: { id: req.params.id } });
  if (!department) return res.status(404).json({ error: 'Department not found' });
  try {
    const team = await prisma.team.create({ data: { name: name.trim(), departmentId: req.params.id } });
    await logAudit({ userId: req.user.id, action: 'Team added', entity: 'Team', entityId: team.id, toValue: `${department.name} / ${team.name}` });
    res.status(201).json(team);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'That team already exists in this department' });
    throw err;
  }
});

router.delete('/teams/:id', requireRole(...SUPER_ADMIN_ONLY), async (req, res) => {
  const team = await prisma.team.findUnique({ where: { id: req.params.id } });
  if (!team) return res.status(404).json({ error: 'Team not found' });
  await prisma.team.delete({ where: { id: req.params.id } });
  await logAudit({ userId: req.user.id, action: 'Team removed', entity: 'Team', entityId: req.params.id, fromValue: team.name });
  res.json({ ok: true });
});

// ---- Company setup ----
router.get('/company', async (req, res) => {
  let company = await prisma.company.findFirst();
  if (!company) company = await prisma.company.create({ data: { name: 'TeamLink Consultants' } });
  res.json(company);
});

router.put('/company', requireRole(...ADMIN_ROLES), async (req, res) => {
  const {
    name, email, phone, address,
    legalName, gstin, pan, addressLine1, addressLine2, city, state, pincode, country,
    bankName, bankAccName, bankAccNo, bankIfsc, bankBranch,
    logo, stamp, signature, signatoryName, signatoryTitle,
  } = req.body;
  let company = await prisma.company.findFirst();
  if (!company) company = await prisma.company.create({ data: { name: name || 'TeamLink Consultants' } });
  const updated = await prisma.company.update({
    where: { id: company.id },
    data: {
      name, email, phone, address,
      legalName, gstin, pan, addressLine1, addressLine2, city, state, pincode, country,
      bankName, bankAccName, bankAccNo, bankIfsc, bankBranch,
      logo, stamp, signature, signatoryName, signatoryTitle,
    },
  });
  await logAudit({ userId: req.user.id, action: 'Company profile updated', entity: 'Company', entityId: updated.id });
  res.json(updated);
});

// ---- Notifications ----
router.get('/notifications', async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { OR: [{ userId: req.user.id }, { userId: null }] },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  res.json(notifications);
});

router.patch('/notifications/:id/read', async (req, res) => {
  // Notifications are now pushed per-user from the ATS pipeline (see
  // utils/notify.js), so only their owner may mark one read. userId null is a
  // broadcast, readable by anyone.
  const existing = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!existing || (existing.userId && existing.userId !== req.user.id)) {
    return res.status(404).json({ error: 'Notification not found' });
  }
  const notification = await prisma.notification.update({ where: { id: req.params.id }, data: { read: true } });
  res.json(notification);
});

router.post('/notifications/read-all', async (req, res) => {
  await prisma.notification.updateMany({
    where: { read: false, OR: [{ userId: req.user.id }, { userId: null }] },
    data: { read: true },
  });
  res.json({ ok: true });
});

// ---- Audit logs ----
router.get('/audit', requireRole(...ADMIN_ROLES), async (req, res) => {
  const logs = await prisma.auditLog.findMany({ include: { user: true }, orderBy: { createdAt: 'desc' }, take: 200 });
  res.json(logs);
});

module.exports = router;
