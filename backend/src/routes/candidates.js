const express = require('express');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();
router.use(requireAuth);

const RECRUITING_ROLES = ['SUPER_ADMIN', 'ADMIN', 'RECRUITER', 'TL', 'STL', 'MANAGER', 'ASSISTANT_MANAGER'];

router.get('/', async (req, res) => {
  const candidates = await prisma.candidate.findMany({
    include: { applications: { include: { requirement: { include: { client: true } } } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(candidates);
});

// Duplicate check — mirrors the prototype's checkCandidateDuplicate(), run
// before adding a new candidate so recruiters don't create the same person twice.
router.get('/check-duplicate', async (req, res) => {
  const { email, phone } = req.query;
  if (!email && !phone) return res.json({ duplicate: false, matches: [] });
  const matches = await prisma.candidate.findMany({
    where: {
      OR: [email ? { email } : undefined, phone ? { phone } : undefined].filter(Boolean),
    },
  });
  res.json({ duplicate: matches.length > 0, matches });
});

router.get('/:id', async (req, res) => {
  const candidate = await prisma.candidate.findUnique({
    where: { id: req.params.id },
    include: { applications: { include: { requirement: { include: { client: true } } } } },
  });
  if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
  res.json(candidate);
});

router.post('/', requireRole(...RECRUITING_ROLES), async (req, res) => {
  const { name, email, phone, source, skills } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const candidate = await prisma.candidate.create({ data: { name, email, phone, source, skills } });
  await logAudit({ userId: req.user.id, action: 'Candidate created', entity: 'Candidate', entityId: candidate.id });
  res.status(201).json(candidate);
});

router.put('/:id', requireRole(...RECRUITING_ROLES), async (req, res) => {
  const { name, email, phone, source, skills } = req.body;
  const candidate = await prisma.candidate.update({ where: { id: req.params.id }, data: { name, email, phone, source, skills } });
  await logAudit({ userId: req.user.id, action: 'Candidate updated', entity: 'Candidate', entityId: candidate.id });
  res.json(candidate);
});

module.exports = router;
