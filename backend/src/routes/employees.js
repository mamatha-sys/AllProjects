const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const ROLE_BY_DESIGNATION = {
  'Super Admin': 'SUPER_ADMIN', 'HR Admin': 'ADMIN', 'Manager': 'MANAGER', 'Assistant Manager': 'ASSISTANT_MANAGER',
  'Senior Team Lead (STL)': 'STL', 'Team Lead (TL)': 'TL', 'Employee (Self-Service)': 'EMPLOYEE', 'Accountant': 'ACCOUNTANT',
};

const router = express.Router();
router.use(requireAuth);

const HR_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANT_MANAGER', 'STL', 'TL'];
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

const DEFAULT_ONBOARDING_TASKS = [
  'Offer letter signed', 'ID proof collected', 'PAN card collected',
  'Laptop/asset assigned', 'Reporting manager introduction', 'System access provisioned',
];
const DEFAULT_OFFBOARDING_TASKS = [
  'Exit interview scheduled', 'Assets returned', 'Access revoked',
  'Full & final settlement processed', 'Experience letter issued',
];

function completionPct(e) {
  const fields = [
    'name', 'department', 'designation', 'reportingManagerId', 'location', 'phone', 'email', 'dateOfJoining',
    'dateOfBirth', 'gender', 'bloodGroup', 'addressLine1', 'city', 'state', 'postalCode',
    'emergencyContactName', 'emergencyContactPhone', 'branch', 'bankName', 'bankAccountNumber', 'ifscCode',
    'panNumber', 'aadhaarNumber', 'educationDetails', 'skills',
  ];
  const filled = fields.filter((f) => e[f]).length;
  return Math.round((filled / fields.length) * 100);
}

function withComputed(e) {
  return {
    ...e,
    profileCompletionPct: completionPct(e),
    onboardingTasks: e.onboardingTasks ? JSON.parse(e.onboardingTasks) : null,
    offboardingTasks: e.offboardingTasks ? JSON.parse(e.offboardingTasks) : null,
    pendingChanges: e.pendingChanges ? JSON.parse(e.pendingChanges) : null,
  };
}

router.get('/me', async (req, res) => {
  const employee = await prisma.employee.findUnique({ where: { userId: req.user.id }, include: { reportingManager: true } });
  if (!employee) return res.status(404).json({ error: 'No employee record linked to this account' });
  res.json(withComputed(employee));
});

// Employee self-service: submit profile-field changes for HR review rather than
// applying them directly (phone/email/emergency contact/address only).
router.put('/me', async (req, res) => {
  const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });
  if (!employee) return res.status(404).json({ error: 'No employee record linked to this account' });

  const editable = {
    phone: 'Phone', email: 'Email', emergencyContactName: 'Emergency contact name', emergencyContactPhone: 'Emergency contact phone',
    emergencyContactRelation: 'Emergency contact relation', address: 'Address', bloodGroup: 'Blood group',
    bankName: 'Bank name', bankAccountNumber: 'Account number', ifscCode: 'IFSC code',
  };
  const changes = [];
  for (const [field, label] of Object.entries(editable)) {
    if (req.body[field] !== undefined && req.body[field] !== (employee[field] || '')) {
      changes.push({ field, label, from: employee[field] || '', to: req.body[field] });
    }
  }
  if (changes.length === 0) return res.status(400).json({ error: 'No changes to submit' });

  const updated = await prisma.employee.update({ where: { id: employee.id }, data: { pendingChanges: JSON.stringify(changes) } });
  await logAudit({ userId: req.user.id, action: 'Profile changes submitted for review', entity: 'Employee', entityId: employee.id });
  res.json(withComputed(updated));
});

router.get('/', requireRole(...HR_ROLES), async (req, res) => {
  const where = {};
  if (req.query.department) where.department = req.query.department;
  if (req.query.employmentStatus) where.employmentStatus = req.query.employmentStatus;
  const employees = await prisma.employee.findMany({ where, include: { reportingManager: true }, orderBy: { name: 'asc' } });
  res.json(employees.map(withComputed));
});

router.put('/:id/manager', requireRole(...HR_ROLES), async (req, res) => {
  const { reportingManagerId } = req.body;
  const employee = await prisma.employee.update({ where: { id: req.params.id }, data: { reportingManagerId: reportingManagerId || null } });
  await logAudit({ userId: req.user.id, action: 'Reporting manager set', entity: 'Employee', entityId: employee.id });
  res.json(withComputed(employee));
});

router.get('/:id', async (req, res) => {
  const employee = await prisma.employee.findUnique({
    where: { id: req.params.id },
    include: { reportingManager: true, user: { select: { id: true, name: true, email: true, role: true } }, salaryStructure: true },
  });
  if (!employee) return res.status(404).json({ error: 'Employee not found' });
  if (req.user.role === 'EMPLOYEE' && employee.userId !== req.user.id) {
    return res.status(403).json({ error: "This isn't included in your role's permissions" });
  }
  res.json(withComputed(employee));
});

// Creates the employee record and — when a role + password are supplied — their
// login account together, in one step (matching the reference app's combined flow).
router.post('/', requireRole(...HR_ROLES), async (req, res) => {
  let { employeeCode } = req.body;
  const { name, email, phone, department, designation, location, dateOfJoining, dateOfBirth, gender, employeeType, role, password, branch } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  if (!employeeCode) {
    const count = await prisma.employee.count();
    employeeCode = 'EMP-' + String(count + 1).padStart(4, '0');
  }

  let userId = null;
  if (role && password) {
    if (!email) return res.status(400).json({ error: 'email is required to create a login account' });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { name, email, passwordHash, role } });
    userId = user.id;
  }

  const employee = await prisma.employee.create({
    data: {
      employeeCode, name, email, phone, department, designation, location, gender, employeeType, branch, userId,
      dateOfJoining: dateOfJoining ? new Date(dateOfJoining) : null,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      onboardingTasks: JSON.stringify(DEFAULT_ONBOARDING_TASKS.map((task) => ({ task, completed: false }))),
    },
  });
  await logAudit({ userId: req.user.id, action: 'Employee created' + (userId ? ' with login account' : ''), entity: 'Employee', entityId: employee.id });
  res.status(201).json(withComputed(employee));
});

router.put('/:id', requireRole(...HR_ROLES), async (req, res) => {
  const editableFields = [
    'name', 'email', 'phone', 'department', 'designation', 'location', 'employmentStatus', 'employeeType',
    'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelation', 'address', 'addressType',
    'addressLine1', 'addressLine2', 'city', 'district', 'state', 'country', 'postalCode', 'bloodGroup',
    'branch', 'shift', 'employmentExperience', 'educationDetails', 'skills',
    'bankName', 'bankAccountNumber', 'ifscCode', 'panNumber', 'aadhaarNumber', 'uanNumber', 'pfNumber', 'esiNumber',
  ];
  const data = {};
  editableFields.forEach((f) => { if (req.body[f] !== undefined) data[f] = req.body[f]; });
  const employee = await prisma.employee.update({ where: { id: req.params.id }, data });
  await logAudit({ userId: req.user.id, action: 'Employee updated', entity: 'Employee', entityId: employee.id });
  res.json(withComputed(employee));
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
  res.json(withComputed(employee));
});

// Approve or reject an employee's self-submitted profile changes.
router.patch('/:id/changes/approve', requireRole(...HR_ROLES), async (req, res) => {
  const employee = await prisma.employee.findUnique({ where: { id: req.params.id } });
  if (!employee || !employee.pendingChanges) return res.status(400).json({ error: 'No pending changes' });
  const changes = JSON.parse(employee.pendingChanges);
  const data = { pendingChanges: null };
  changes.forEach((c) => { data[c.field] = c.to; });
  const updated = await prisma.employee.update({ where: { id: req.params.id }, data });
  await logAudit({ userId: req.user.id, action: 'Profile changes approved', entity: 'Employee', entityId: employee.id });
  res.json(withComputed(updated));
});

router.patch('/:id/changes/reject', requireRole(...HR_ROLES), async (req, res) => {
  const employee = await prisma.employee.update({ where: { id: req.params.id }, data: { pendingChanges: null } });
  await logAudit({ userId: req.user.id, action: 'Profile changes sent back for edit', entity: 'Employee', entityId: employee.id });
  res.json(withComputed(employee));
});

// Transfer an employee to a new department, keeping a note in the audit trail.
router.post('/:id/transfer', requireRole(...HR_ROLES), async (req, res) => {
  const { department, reason } = req.body;
  if (!department) return res.status(400).json({ error: 'department is required' });
  const existing = await prisma.employee.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Employee not found' });
  const employee = await prisma.employee.update({ where: { id: req.params.id }, data: { department } });
  await logAudit({ userId: req.user.id, action: 'Employee transferred' + (reason ? ` (${reason})` : ''), entity: 'Employee', entityId: employee.id, fromValue: existing.department, toValue: department });
  res.json(withComputed(employee));
});

// Onboarding checklist
router.patch('/:id/onboarding/:index', requireRole(...HR_ROLES), async (req, res) => {
  const employee = await prisma.employee.findUnique({ where: { id: req.params.id } });
  if (!employee) return res.status(404).json({ error: 'Employee not found' });
  const tasks = employee.onboardingTasks ? JSON.parse(employee.onboardingTasks) : DEFAULT_ONBOARDING_TASKS.map((task) => ({ task, completed: false }));
  const idx = Number(req.params.index);
  if (!tasks[idx]) return res.status(400).json({ error: 'Invalid task index' });
  tasks[idx].completed = !tasks[idx].completed;
  const updated = await prisma.employee.update({ where: { id: req.params.id }, data: { onboardingTasks: JSON.stringify(tasks) } });
  res.json(withComputed(updated));
});

// Offboarding
router.post('/:id/offboarding', requireRole(...HR_ROLES), async (req, res) => {
  const employee = await prisma.employee.findUnique({ where: { id: req.params.id } });
  if (!employee) return res.status(404).json({ error: 'Employee not found' });
  if (employee.offboardingStatus) return res.status(400).json({ error: 'Offboarding already in progress for this employee' });
  const updated = await prisma.employee.update({
    where: { id: req.params.id },
    data: {
      offboardingStatus: 'Serving Notice',
      offboardingTasks: JSON.stringify(DEFAULT_OFFBOARDING_TASKS.map((task) => ({ task, completed: false }))),
      employmentStatus: 'Notice Period',
    },
  });
  await logAudit({ userId: req.user.id, action: 'Offboarding initiated', entity: 'Employee', entityId: employee.id, fromValue: employee.employmentStatus, toValue: 'Notice Period' });
  res.json(withComputed(updated));
});

router.patch('/:id/offboarding/:index', requireRole(...HR_ROLES), async (req, res) => {
  const employee = await prisma.employee.findUnique({ where: { id: req.params.id } });
  if (!employee || !employee.offboardingTasks) return res.status(400).json({ error: 'No offboarding in progress' });
  const tasks = JSON.parse(employee.offboardingTasks);
  const idx = Number(req.params.index);
  if (!tasks[idx]) return res.status(400).json({ error: 'Invalid task index' });
  tasks[idx].completed = !tasks[idx].completed;
  const allDone = tasks.every((t) => t.completed);
  const data = { offboardingTasks: JSON.stringify(tasks), offboardingStatus: allDone ? 'Cleared' : 'Serving Notice' };
  if (allDone) data.employmentStatus = 'Relieved';
  const updated = await prisma.employee.update({ where: { id: req.params.id }, data });
  if (allDone) {
    await prisma.fnfRequest.create({ data: { employeeId: employee.id, lastWorkingDate: new Date().toISOString().slice(0, 10) } });
    await logAudit({ userId: req.user.id, action: 'Offboarding cleared', entity: 'Employee', entityId: employee.id, toValue: 'Relieved' });
  }
  res.json(withComputed(updated));
});

// Bulk import — CSV rows already parsed client-side into objects.
router.post('/bulk-import', requireRole(...HR_ROLES), async (req, res) => {
  const rows = req.body.rows;
  if (!Array.isArray(rows)) return res.status(400).json({ error: 'rows must be an array' });
  let imported = 0, skipped = 0;
  let seq = await prisma.employee.count();
  for (const r of rows) {
    if (!r.name) { skipped++; continue; }
    if (r.email) {
      const dup = await prisma.employee.findFirst({ where: { email: r.email } });
      if (dup) { skipped++; continue; }
    }
    seq += 1;
    await prisma.employee.create({
      data: {
        employeeCode: 'EMP-' + String(seq).padStart(4, '0'),
        name: r.name, email: r.email || null, phone: r.phone || null,
        department: r.department || null, designation: r.designation || null, location: r.location || null,
        onboardingTasks: JSON.stringify(DEFAULT_ONBOARDING_TASKS.map((task) => ({ task, completed: false }))),
      },
    });
    imported++;
  }
  await logAudit({ userId: req.user.id, action: 'Bulk import run', entity: 'Employee', toValue: `${imported} imported, ${skipped} skipped` });
  res.json({ imported, skipped });
});

module.exports = router;
