const express = require('express');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const candidates = await prisma.candidate.findMany({
    include: { applications: { include: { requirement: { include: { client: true } } } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(candidates);
});

router.get('/:id', async (req, res) => {
  const candidate = await prisma.candidate.findUnique({
    where: { id: req.params.id },
    include: { applications: { include: { requirement: { include: { client: true } } } } },
  });
  if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
  res.json(candidate);
});

router.post('/', requireRole('SUPER_ADMIN', 'ADMIN', 'RECRUITER', 'TL', 'STL', 'MANAGER', 'ASSISTANT_MANAGER'), async (req, res) => {
  const { name, email, phone, source } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const candidate = await prisma.candidate.create({ data: { name, email, phone, source } });
  await logAudit({ userId: req.user.id, action: 'Candidate created', entity: 'Candidate', entityId: candidate.id });
  res.status(201).json(candidate);
});

module.exports = router;
