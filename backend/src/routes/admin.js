const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const {
  ROLE_FEATURE_ACTIONS, ROLE_ACCESS_MODULES, CATALOG_ROLES, ROLE_SCOPE_DESC,
  PRODUCT_ACCESS, moduleById, mergeAccess, sanitizeFeatures,
} = require('../utils/roleAccess');

const router = express.Router();
router.use(requireAuth);

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];
const SUPER_ADMIN_ONLY = ['SUPER_ADMIN'];
const ALL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANT_MANAGER', 'STL', 'TL', 'RECRUITER', 'BDE', 'CLIENT', 'ACCOUNTANT', 'EMPLOYEE'];

// ---- Users ----
//
// One employee = one user = one login. The prototype's Users screen (usersView,
// line 9893) shows fifteen columns per login and lets an admin change roles,
// suspend a login and reset a password inline.
//
// NOTE ON ROLES: the prototype gives each login three independent product roles
// (hrmsRole / atsRole / accountsRole). Main carries one User.role, and splitting
// it is a separate, deliberately deferred change. The three product columns
// below are therefore DERIVED read-only (utils/roleAccess.js PRODUCT_ACCESS).
// When the split lands, replace `productAccess` with the three stored columns
// and turn the single `role` select in the UI into three.
const USER_STATUSES = ['Active', 'Inactive', 'Suspended'];

// The wide row the Users table renders: login + linked employee + reach.
async function shapeUser(user) {
  const [assignedAsRecruiter, assignedAsBde] = await Promise.all([
    prisma.requirement.findMany({ where: { recruiterId: user.id }, include: { client: true } }),
    prisma.requirement.findMany({ where: { bdeId: user.id }, include: { client: true } }),
  ]);
  const requirements = [...assignedAsRecruiter, ...assignedAsBde];
  const emp = user.employee;
  const clientNames = [...new Set(requirements.map((r) => r.client?.name).filter(Boolean))];
  if (user.client?.name) clientNames.push(user.client.name);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username || user.email,
    role: user.role,
    productAccess: PRODUCT_ACCESS[user.role] || { hrms: 'No Access', ats: 'No Access', accounts: 'No Access' },
    status: user.status || 'Active',
    employeeId: emp ? emp.employeeCode : null,
    employeeRecordId: emp ? emp.id : null,
    department: emp?.department || user.atsDepartment || null,
    designation: emp?.designation || null,
    branch: user.branch || emp?.branch || emp?.location || null,
    team: user.team || emp?.team || null,
    atsDepartment: user.atsDepartment,
    // "Scope — how far their access reaches", the prototype's userScopeLabel().
    scope: user.role === 'CLIENT'
      ? `Client: ${user.client?.name || 'not assigned'}`
      : user.atsDepartment
        ? `${user.atsDepartment} department`
        : ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(user.role) ? 'All departments' : 'Own records',
    assignedClients: [...new Set(clientNames)],
    assignedRequirements: requirements.length,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

router.get('/users', requireRole(...ADMIN_ROLES), async (req, res) => {
  const users = await prisma.user.findMany({
    include: { employee: true, client: true },
    orderBy: { name: 'asc' },
  });
  res.json(await Promise.all(users.map(shapeUser)));
});

// Employees with no login yet — the "Create login" picker on the Users screen.
router.get('/users/employees-without-login', requireRole(...ADMIN_ROLES), async (req, res) => {
  const employees = await prisma.employee.findMany({
    where: { userId: null },
    select: { id: true, employeeCode: true, name: true, email: true, department: true, team: true, designation: true, branch: true, location: true },
    orderBy: { name: 'asc' },
  });
  res.json(employees);
});

router.post('/users', requireRole(...ADMIN_ROLES), async (req, res) => {
  const { name, email, password, role, atsDepartment, clientId, employeeId, branch, team, username, status } = req.body;
  if (!name || !email || !password || !role) return res.status(400).json({ error: 'name, email, password and role are required' });
  if (!ALL_ROLES.includes(role)) return res.status(400).json({ error: 'Unknown role' });
  if (status && !USER_STATUSES.includes(status)) return res.status(400).json({ error: 'Unknown status' });
  if (role === 'CLIENT' && !clientId) return res.status(400).json({ error: 'A Client login must be tied to one client' });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: 'That email already has a login' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name, email, passwordHash, role, atsDepartment, clientId,
      branch, team, username: username || email, status: status || 'Active',
    },
  });

  // Access is granted TO an existing employee — never a second identity.
  if (employeeId) {
    const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    if (emp.userId) return res.status(409).json({ error: 'That employee already has a login' });
    await prisma.employee.update({ where: { id: employeeId }, data: { userId: user.id } });
  }

  await logAudit({ userId: req.user.id, action: 'User created', entity: 'User', entityId: user.id, toValue: `${role} · ${user.status}` });
  res.status(201).json(await shapeUser(await prisma.user.findUnique({ where: { id: user.id }, include: { employee: true, client: true } })));
});

router.put('/users/:id', requireRole(...ADMIN_ROLES), async (req, res) => {
  const { name, role, atsDepartment, branch, team, status, username } = req.body;
  if (role && !ALL_ROLES.includes(role)) return res.status(400).json({ error: 'Unknown role' });
  if (status && !USER_STATUSES.includes(status)) return res.status(400).json({ error: 'Unknown status' });
  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'User not found' });

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { name, role, atsDepartment, branch, team, status, username },
    include: { employee: true, client: true },
  });
  if (role && role !== existing.role) {
    await logAudit({ userId: req.user.id, action: `Role changed for ${user.name}`, entity: 'User', entityId: user.id, fromValue: existing.role, toValue: role });
  }
  if (status && status !== existing.status) {
    await logAudit({ userId: req.user.id, action: `Login ${status.toLowerCase()} for ${user.name}`, entity: 'User', entityId: user.id, fromValue: existing.status, toValue: status });
  }
  if (!role && !status) {
    await logAudit({ userId: req.user.id, action: 'User updated', entity: 'User', entityId: user.id });
  }
  res.json(await shapeUser(user));
});

// Suspend / restore a login without touching its role.
router.post('/users/:id/toggle-status', requireRole(...ADMIN_ROLES), async (req, res) => {
  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'User not found' });
  if (existing.id === req.user.id) return res.status(409).json({ error: 'You cannot disable your own login' });
  const next = (existing.status || 'Active') === 'Active' ? 'Inactive' : 'Active';
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { status: next }, include: { employee: true, client: true } });
  await logAudit({ userId: req.user.id, action: `Login ${next === 'Active' ? 'enabled' : 'disabled'} for ${user.name}`, entity: 'User', entityId: user.id, fromValue: existing.status, toValue: next });
  res.json(await shapeUser(user));
});

router.post('/users/:id/reset-password', requireRole(...ADMIN_ROLES), async (req, res) => {
  const { password } = req.body;
  if (!password || String(password).length < 6) return res.status(400).json({ error: 'A password of at least 6 characters is required' });
  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'User not found' });
  await prisma.user.update({ where: { id: req.params.id }, data: { passwordHash: await bcrypt.hash(String(password), 10) } });
  // The new password is never echoed back or logged.
  await logAudit({ userId: req.user.id, action: `Password reset for ${existing.name}`, entity: 'User', entityId: existing.id, toValue: 'Reset' });
  res.json({ ok: true });
});

// ---- Role catalog ----
//
// The prototype carries two unreconciled permission matrices. This follows
// `roleAccessFor` (the one the Role Catalog UI actually edits), not
// `rolePermissions` — see the note at the top of utils/roleAccess.js.
router.get('/role-catalog', async (req, res) => {
  const [counts, rows] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.roleAccess.findMany(),
  ]);
  const countFor = (role) => counts.find((c) => c.role === role)?._count._all || 0;

  res.json(CATALOG_ROLES.map((role) => {
    const modules = ROLE_ACCESS_MODULES.map((m) => {
      const merged = mergeAccess(role, m.id, rows.find((r) => r.role === role && r.moduleId === m.id));
      return { id: m.id, label: m.label, enabled: merged.moduleEnabled };
    });
    const enabled = modules.filter((m) => m.enabled);
    return {
      role,
      users: countFor(role),
      scope: ROLE_SCOPE_DESC[role] || '—',
      // Kept so anything still reading the old flat shape keeps working.
      access: enabled.length === ROLE_ACCESS_MODULES.length
        ? 'Full access to every module'
        : enabled.map((m) => m.label).join(', ') || 'No module access',
      modules,
    };
  }));
});

// The module + feature catalog itself, so the UI never hard-codes it.
router.get('/role-catalog/modules', (req, res) => {
  res.json({ actions: ROLE_FEATURE_ACTIONS, modules: ROLE_ACCESS_MODULES });
});

// One role's full matrix: every module, every feature, every action.
router.get('/role-catalog/:role/access', requireRole(...ADMIN_ROLES), async (req, res) => {
  const { role } = req.params;
  if (!CATALOG_ROLES.includes(role)) return res.status(404).json({ error: 'Unknown role' });
  const rows = await prisma.roleAccess.findMany({ where: { role } });
  res.json({
    role,
    scope: ROLE_SCOPE_DESC[role] || '—',
    actions: ROLE_FEATURE_ACTIONS,
    modules: ROLE_ACCESS_MODULES.map((m) => ({
      id: m.id,
      label: m.label,
      featureNames: m.features,
      ...mergeAccess(role, m.id, rows.find((r) => r.moduleId === m.id)),
    })),
  });
});

async function upsertRoleAccess(role, moduleId, patch) {
  const rows = await prisma.roleAccess.findUnique({ where: { role_moduleId: { role, moduleId } } });
  const current = mergeAccess(role, moduleId, rows);
  const next = { ...current, ...patch };
  await prisma.roleAccess.upsert({
    where: { role_moduleId: { role, moduleId } },
    create: { role, moduleId, moduleEnabled: next.moduleEnabled, features: JSON.stringify(next.features) },
    update: { moduleEnabled: next.moduleEnabled, features: JSON.stringify(next.features) },
  });
  return next;
}

// Turn a whole module on or off for a role.
router.put('/role-catalog/:role/modules/:moduleId', requireRole(...ADMIN_ROLES), async (req, res) => {
  const { role, moduleId } = req.params;
  if (!CATALOG_ROLES.includes(role)) return res.status(404).json({ error: 'Unknown role' });
  const mod = moduleById(moduleId);
  if (!mod) return res.status(404).json({ error: 'Unknown module' });
  if (typeof req.body.enabled !== 'boolean') return res.status(400).json({ error: 'enabled must be true or false' });

  const before = mergeAccess(role, moduleId, await prisma.roleAccess.findUnique({ where: { role_moduleId: { role, moduleId } } }));
  const next = await upsertRoleAccess(role, moduleId, { moduleEnabled: req.body.enabled });
  await logAudit({
    userId: req.user.id, action: 'Module access changed', entity: 'RoleAccess',
    entityId: `${role}/${moduleId}`, fromValue: before.moduleEnabled ? 'On' : 'Off', toValue: next.moduleEnabled ? 'On' : 'Off',
  });
  res.json({ role, moduleId, label: mod.label, ...next });
});

// Save one module's feature x action grid for a role.
router.put('/role-catalog/:role/modules/:moduleId/features', requireRole(...ADMIN_ROLES), async (req, res) => {
  const { role, moduleId } = req.params;
  if (!CATALOG_ROLES.includes(role)) return res.status(404).json({ error: 'Unknown role' });
  const mod = moduleById(moduleId);
  if (!mod) return res.status(404).json({ error: 'Unknown module' });
  if (!req.body.features || typeof req.body.features !== 'object') {
    return res.status(400).json({ error: 'features must be an object' });
  }
  const features = sanitizeFeatures(moduleId, req.body.features);
  const next = await upsertRoleAccess(role, moduleId, {
    features,
    ...(typeof req.body.enabled === 'boolean' ? { moduleEnabled: req.body.enabled } : {}),
  });
  await logAudit({
    userId: req.user.id, action: 'Feature permissions saved', entity: 'RoleAccess',
    entityId: `${role}/${moduleId}`, toValue: mod.label,
  });
  res.json({ role, moduleId, label: mod.label, ...next });
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
