const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();
router.use(requireAuth);

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];
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

// ---- Company setup ----
router.get('/company', async (req, res) => {
  let company = await prisma.company.findFirst();
  if (!company) company = await prisma.company.create({ data: { name: 'TeamLink Consultants' } });
  res.json(company);
});

router.put('/company', requireRole(...ADMIN_ROLES), async (req, res) => {
  const { name, email, phone, address } = req.body;
  let company = await prisma.company.findFirst();
  if (!company) company = await prisma.company.create({ data: { name: name || 'TeamLink Consultants' } });
  const updated = await prisma.company.update({ where: { id: company.id }, data: { name, email, phone, address } });
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
  const notification = await prisma.notification.update({ where: { id: req.params.id }, data: { read: true } });
  res.json(notification);
});

// ---- Audit logs ----
router.get('/audit', requireRole(...ADMIN_ROLES), async (req, res) => {
  const logs = await prisma.auditLog.findMany({ include: { user: true }, orderBy: { createdAt: 'desc' }, take: 200 });
  res.json(logs);
});

module.exports = router;
