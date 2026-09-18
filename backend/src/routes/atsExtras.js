const express = require('express');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Recruiter & BDE workload view.
router.get('/team', async (req, res) => {
  const recruiters = await prisma.user.findMany({ where: { role: { in: ['RECRUITER', 'BDE'] } } });
  const rows = await Promise.all(
    recruiters.map(async (u) => {
      const openAsRecruiter = await prisma.requirement.count({ where: { recruiterId: u.id, status: 'OPEN' } });
      const openAsBde = await prisma.requirement.count({ where: { bdeId: u.id, status: 'OPEN' } });
      return { id: u.id, name: u.name, role: u.role, openRequirements: openAsRecruiter + openAsBde };
    })
  );
  res.json(rows);
});

// Interview calendar — every application with an interview scheduled/completed.
router.get('/calendar', async (req, res) => {
  const applications = await prisma.application.findMany({
    where: { interviewStatus: { not: null } },
    include: { candidate: true, requirement: { include: { client: true } } },
    orderBy: { interviewAt: 'asc' },
  });
  res.json(applications);
});

// Global search across candidates, clients and requirements.
router.get('/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ candidates: [], clients: [], requirements: [] });
  const [candidates, clients, requirements] = await Promise.all([
    prisma.candidate.findMany({ where: { name: { contains: q } } }),
    prisma.client.findMany({ where: { name: { contains: q } } }),
    prisma.requirement.findMany({ where: { title: { contains: q } }, include: { client: true } }),
  ]);
  res.json({ candidates, clients, requirements });
});

module.exports = router;
