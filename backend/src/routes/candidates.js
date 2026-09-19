const express = require('express');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();
router.use(requireAuth);

const RECRUITING_ROLES = ['SUPER_ADMIN', 'ADMIN', 'RECRUITER', 'TL', 'STL', 'MANAGER', 'ASSISTANT_MANAGER'];

// Candidates already on file with the same email or phone. Mirrors the
// prototype's checkCandidateDuplicate() — used both by the Add Candidate form
// (to warn while typing) and by POST / below (to block a silent double-entry).
async function findDuplicates({ email, phone, excludeId }) {
  const or = [];
  if (email) or.push({ email });
  if (phone) or.push({ phone });
  if (or.length === 0) return [];
  return prisma.candidate.findMany({
    where: { OR: or, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    orderBy: { createdAt: 'desc' },
  });
}

router.get('/', async (req, res) => {
  const candidates = await prisma.candidate.findMany({
    include: { applications: { include: { requirement: { include: { client: true } } } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(candidates);
});

// Must stay above /:id so "check-duplicate" isn't read as a candidate id.
router.get('/check-duplicate', async (req, res) => {
  const email = (req.query.email || '').trim();
  const phone = (req.query.phone || '').trim();
  const matches = await findDuplicates({ email, phone, excludeId: req.query.excludeId });
  res.json({
    duplicate: matches.length > 0,
    matches: matches.map((m) => ({ id: m.id, name: m.name, email: m.email, phone: m.phone, source: m.source })),
  });
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
  const { name, email, phone, source, skills, experienceYears, allowDuplicate } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  // Warn (409) rather than silently creating a second record for the same
  // person — the caller re-sends with allowDuplicate to go ahead anyway.
  if (!allowDuplicate) {
    const matches = await findDuplicates({ email, phone });
    if (matches.length > 0) {
      return res.status(409).json({
        error: `Already on file: ${matches.map((m) => m.name).join(', ')}. Re-submit to add anyway.`,
        duplicate: true,
        matches: matches.map((m) => ({ id: m.id, name: m.name, email: m.email, phone: m.phone })),
      });
    }
  }

  const candidate = await prisma.candidate.create({
    data: { name, email, phone, source, skills, experienceYears: experienceYears != null && experienceYears !== '' ? Number(experienceYears) : undefined },
  });
  await logAudit({ userId: req.user.id, action: 'Candidate created', entity: 'Candidate', entityId: candidate.id });
  res.status(201).json(candidate);
});

router.put('/:id', requireRole(...RECRUITING_ROLES), async (req, res) => {
  const { name, email, phone, source, skills, experienceYears } = req.body;
  const candidate = await prisma.candidate.update({
    where: { id: req.params.id },
    data: { name, email, phone, source, skills, experienceYears: experienceYears != null && experienceYears !== '' ? Number(experienceYears) : undefined },
  });
  await logAudit({ userId: req.user.id, action: 'Candidate updated', entity: 'Candidate', entityId: candidate.id });
  res.json(candidate);
});

module.exports = router;
