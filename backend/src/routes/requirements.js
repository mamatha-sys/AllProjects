const express = require('express');
const prisma = require('../db');
const { requireAuth, requireRole, isDeptScopedRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { MATCH_THRESHOLD, rankCandidates } = require('../utils/matching');

const router = express.Router();
router.use(requireAuth);

const RAISE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TL', 'STL', 'ASSISTANT_MANAGER'];
// Match suggestions read across the whole candidate master, so they stay
// inside the TeamLink team — a client never browses the candidate pool.
const MATCHING_ROLES = [...RAISE_ROLES, 'RECRUITER', 'BDE'];

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

  // How many candidates in the master list clear the match threshold for each
  // requirement — the prototype's matchingCandidateCount(), computed live.
  if (!MATCHING_ROLES.includes(req.user.role)) return res.json(requirements);
  const candidates = await prisma.candidate.findMany();
  res.json(
    requirements.map((r) => ({ ...r, matchingCandidates: rankCandidates(candidates, r).length }))
  );
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

// Suggested candidates for this requirement — everyone not already in the
// pipeline who clears the match threshold, ranked, with the reasons behind the
// score. Mirrors the prototype's matchingCandidatesFor()/matchingCandidatesView().
router.get('/:id/matching-candidates', requireRole(...MATCHING_ROLES), async (req, res) => {
  const requirement = await prisma.requirement.findUnique({ where: { id: req.params.id } });
  if (!requirement) return res.status(404).json({ error: 'Requirement not found' });

  const [candidates, linked] = await Promise.all([
    prisma.candidate.findMany(),
    prisma.application.findMany({ where: { requirementId: requirement.id }, select: { candidateId: true } }),
  ]);

  const ranked = rankCandidates(candidates, requirement, {
    excludeIds: new Set(linked.map((a) => a.candidateId)),
    threshold: req.query.threshold ? Number(req.query.threshold) : MATCH_THRESHOLD,
  });
  res.json(ranked);
});

router.post('/', requireRole(...RAISE_ROLES), async (req, res) => {
  const { title, description, clientId, department, priority, skills, experience, openings, status, recruiterId, bdeId } = req.body;
  if (!title || !clientId) return res.status(400).json({ error: 'title and clientId are required' });
  const requirement = await prisma.requirement.create({
    data: {
      title, description, clientId, department, priority: priority || 'MEDIUM',
      skills, experience, openings: openings != null ? Number(openings) : undefined,
      status: status === 'DRAFT' ? 'DRAFT' : undefined,
      recruiterId, bdeId,
    },
  });
  await logAudit({ userId: req.user.id, action: 'Requirement created', entity: 'Requirement', entityId: requirement.id });
  res.status(201).json(requirement);
});

router.put('/:id', requireRole(...RAISE_ROLES), async (req, res) => {
  const { title, description, department, priority, status, skills, experience, openings, recruiterId, bdeId } = req.body;
  const requirement = await prisma.requirement.update({
    where: { id: req.params.id },
    data: {
      title, description, department, priority, status, skills, experience,
      openings: openings != null ? Number(openings) : undefined,
      recruiterId, bdeId,
    },
  });
  await logAudit({ userId: req.user.id, action: 'Requirement updated', entity: 'Requirement', entityId: requirement.id });
  res.json(requirement);
});

// Activate a draft requirement — the prototype's activateRequirement() refuses
// until the client's service agreement has actually been signed.
router.post('/:id/activate', requireRole(...RAISE_ROLES), async (req, res) => {
  const existing = await prisma.requirement.findUnique({ where: { id: req.params.id }, include: { client: true } });
  if (!existing) return res.status(404).json({ error: 'Requirement not found' });
  if (existing.status === 'OPEN') return res.status(400).json({ error: 'This requirement is already open' });
  if (existing.client.agreementStatus !== 'SIGNED') {
    return res.status(400).json({ error: "Cannot activate — this client's service agreement isn't signed yet" });
  }

  const requirement = await prisma.requirement.update({ where: { id: req.params.id }, data: { status: 'OPEN' } });
  await logAudit({
    userId: req.user.id, action: 'Requirement activated', entity: 'Requirement',
    entityId: requirement.id, fromValue: existing.status, toValue: 'OPEN',
  });
  res.json(requirement);
});

// Open/close toggle — the prototype's toggleRequirementStatus().
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

// Templated job description built from the requirement + client — the
// prototype's jobDescriptionHtml(). Saved onto description, which is what the
// public Job Portal (routes/public.js) already shows candidates.
router.post('/:id/generate-jd', requireRole(...RAISE_ROLES), async (req, res) => {
  const requirement = await prisma.requirement.findUnique({ where: { id: req.params.id }, include: { client: true } });
  if (!requirement) return res.status(404).json({ error: 'Requirement not found' });

  const skills = String(requirement.skills || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const description = [
    `${requirement.title} — ${requirement.client.name}`,
    '',
    `Department: ${requirement.department || 'General'}`,
    `Location: ${requirement.client.location || 'To be discussed'}`,
    `Experience: ${requirement.experience || 'As per role'}`,
    `Openings: ${requirement.openings}`,
    '',
    'Role Overview',
    `TeamLink Consultants is hiring a ${requirement.title} on behalf of ${requirement.client.name}` +
      `${requirement.client.industry ? ` (${requirement.client.industry} sector)` : ''}. This is a full-time` +
      ' position with scope to own delivery end to end.',
    '',
    'Key Responsibilities',
    '- Own end-to-end delivery within your area of expertise',
    '- Work with cross-functional stakeholders to ship on committed timelines',
    '- Uphold the quality, documentation and process standards of the team',
    '',
    'What We Are Looking For',
    ...(skills.length ? skills.map((s) => `- Hands-on experience with ${s}`) : ['- Relevant hands-on experience for the role above']),
    '- Strong written and verbal communication',
    '- Ownership and a bias towards getting things done',
    '',
    'How To Apply',
    'Apply through the TeamLink careers portal — our recruitment team will get back to shortlisted applicants.',
  ].join('\n');

  const updated = await prisma.requirement.update({ where: { id: requirement.id }, data: { description } });
  await logAudit({ userId: req.user.id, action: 'Job description generated', entity: 'Requirement', entityId: requirement.id });
  res.json(updated);
});

module.exports = router;
