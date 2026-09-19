const express = require('express');
const prisma = require('../db');
const { requireAuth, requireRole, isDeptScopedRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();
router.use(requireAuth);

const RAISE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TL', 'STL', 'ASSISTANT_MANAGER'];

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

// Candidates not yet linked to this requirement, ranked by naive skill/source
// overlap — mirrors the prototype's matchingCandidatesFor() suggestion list.
router.get('/:id/matching-candidates', async (req, res) => {
  const requirement = await prisma.requirement.findUnique({ where: { id: req.params.id } });
  if (!requirement) return res.status(404).json({ error: 'Requirement not found' });

  const [candidates, linked] = await Promise.all([
    prisma.candidate.findMany(),
    prisma.application.findMany({ where: { requirementId: requirement.id }, select: { candidateId: true } }),
  ]);
  const linkedIds = new Set(linked.map((a) => a.candidateId));
  const keywords = `${requirement.title} ${requirement.department || ''}`.toLowerCase().split(/\W+/).filter(Boolean);

  const ranked = candidates
    .filter((c) => !linkedIds.has(c.id))
    .map((c) => {
      const haystack = `${c.skills || ''} ${c.source || ''}`.toLowerCase();
      const score = keywords.reduce((n, kw) => (kw.length > 2 && haystack.includes(kw) ? n + 1 : n), 0);
      return { ...c, matchScore: score };
    })
    .sort((a, b) => b.matchScore - a.matchScore);

  res.json(ranked);
});

router.post('/', requireRole(...RAISE_ROLES), async (req, res) => {
  const { title, description, clientId, department, priority, recruiterId, bdeId } = req.body;
  if (!title || !clientId) return res.status(400).json({ error: 'title and clientId are required' });
  const requirement = await prisma.requirement.create({
    data: { title, description, clientId, department, priority: priority || 'MEDIUM', recruiterId, bdeId },
  });
  await logAudit({ userId: req.user.id, action: 'Requirement created', entity: 'Requirement', entityId: requirement.id });
  res.status(201).json(requirement);
});

router.put('/:id', requireRole(...RAISE_ROLES), async (req, res) => {
  const { title, description, department, priority, status, recruiterId, bdeId } = req.body;
  const requirement = await prisma.requirement.update({
    where: { id: req.params.id },
    data: { title, description, department, priority, status, recruiterId, bdeId },
  });
  await logAudit({ userId: req.user.id, action: 'Requirement updated', entity: 'Requirement', entityId: requirement.id });
  res.json(requirement);
});

// Activate/deactivate — mirrors the prototype's toggleRequirementStatus()/activateRequirement().
router.post('/:id/toggle-status', requireRole(...RAISE_ROLES), async (req, res) => {
  const existing = await prisma.requirement.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Requirement not found' });
  const status = existing.status === 'OPEN' ? 'CLOSED' : 'OPEN';
  const requirement = await prisma.requirement.update({ where: { id: req.params.id }, data: { status } });
  await logAudit({
    userId: req.user.id, action: 'Requirement status toggled', entity: 'Requirement',
    entityId: requirement.id, fromValue: existing.status, toValue: status,
  });
  res.json(requirement);
});

// Simple templated job description generator — mirrors the prototype's jobDescriptionHtml().
router.post('/:id/generate-jd', requireRole(...RAISE_ROLES), async (req, res) => {
  const requirement = await prisma.requirement.findUnique({ where: { id: req.params.id }, include: { client: true } });
  if (!requirement) return res.status(404).json({ error: 'Requirement not found' });

  const description = [
    `${requirement.title} — ${requirement.client.name}`,
    '',
    `Department: ${requirement.department || 'General'}   Priority: ${requirement.priority}`,
    `Location: ${requirement.client.location || 'To be discussed'}`,
    '',
    'Role Overview:',
    `We are hiring a ${requirement.title} on behalf of ${requirement.client.name}. This is a great opportunity`,
    'to join a growing team and make an immediate impact.',
    '',
    'Key Responsibilities:',
    '- Own end-to-end delivery within your area of expertise',
    '- Collaborate closely with cross-functional stakeholders',
    '- Uphold quality and process standards',
    '',
    'What We Are Looking For:',
    '- Relevant hands-on experience for the role above',
    '- Strong communication and ownership',
  ].join('\n');

  const updated = await prisma.requirement.update({ where: { id: requirement.id }, data: { description } });
  await logAudit({ userId: req.user.id, action: 'Job description generated', entity: 'Requirement', entityId: requirement.id });
  res.json(updated);
});

module.exports = router;
