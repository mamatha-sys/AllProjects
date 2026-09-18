const express = require('express');
const prisma = require('../db');
const { requireAuth, requireRole, isDeptScopedRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();
router.use(requireAuth);

async function scopedWhere(user) {
  if (user.role === 'CLIENT') return { clientId: user.clientId };
  if (user.role === 'RECRUITER') return { recruiterId: user.id };
  if (user.role === 'BDE') return { bdeId: user.id };
  if (isDeptScopedRole(user.role) && user.atsDepartment) return { department: user.atsDepartment };
  return {};
}

router.get('/', async (req, res) => {
  const where = await scopedWhere(req.user);
  if (req.query.status) where.status = req.query.status;
  if (req.query.clientId) where.clientId = req.query.clientId;
  const requirements = await prisma.requirement.findMany({
    where,
    include: { client: true, recruiter: true, bde: true, _count: { select: { applications: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(requirements);
});

router.get('/:id', async (req, res) => {
  const requirement = await prisma.requirement.findUnique({
    where: { id: req.params.id },
    include: { client: true, recruiter: true, bde: true, applications: { include: { candidate: true } } },
  });
  if (!requirement) return res.status(404).json({ error: 'Requirement not found' });
  if (req.user.role === 'CLIENT' && requirement.clientId !== req.user.clientId) {
    return res.status(403).json({ error: 'This record is outside your client scope' });
  }
  res.json(requirement);
});

router.post('/', requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TL', 'STL', 'ASSISTANT_MANAGER'), async (req, res) => {
  const { title, clientId, department, priority, recruiterId, bdeId } = req.body;
  if (!title || !clientId) return res.status(400).json({ error: 'title and clientId are required' });
  const requirement = await prisma.requirement.create({
    data: { title, clientId, department, priority: priority || 'MEDIUM', recruiterId, bdeId },
  });
  await logAudit({ userId: req.user.id, action: 'Requirement created', entity: 'Requirement', entityId: requirement.id });
  res.status(201).json(requirement);
});

router.put('/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TL', 'STL', 'ASSISTANT_MANAGER'), async (req, res) => {
  const { title, department, priority, status, recruiterId, bdeId } = req.body;
  const requirement = await prisma.requirement.update({
    where: { id: req.params.id },
    data: { title, department, priority, status, recruiterId, bdeId },
  });
  await logAudit({ userId: req.user.id, action: 'Requirement updated', entity: 'Requirement', entityId: requirement.id });
  res.json(requirement);
});

module.exports = router;
