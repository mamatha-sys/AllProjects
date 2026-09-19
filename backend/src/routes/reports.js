const express = require('express');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/ats', async (req, res) => {
  const clients = await prisma.client.findMany({ include: { requirements: { include: { applications: true } } } });
  const rows = clients.map((c) => {
    const apps = c.requirements.flatMap((r) => r.applications);
    return {
      client: c.name,
      open: c.requirements.filter((r) => r.status === 'OPEN').length,
      inPipeline: apps.filter((a) => !['JOINED', 'HIRED', 'REJECTED'].includes(a.stage)).length,
      selected: apps.filter((a) => a.stage === 'SELECTED').length,
      joined: apps.filter((a) => ['JOINED', 'HIRED'].includes(a.stage)).length,
      rejected: apps.filter((a) => a.stage === 'REJECTED').length,
    };
  });
  res.json(rows);
});

router.get('/job-portal', async (req, res) => {
  const candidates = await prisma.candidate.findMany();
  const sources = ['Job Portal', 'Naukri', 'Indeed', 'LinkedIn', 'TeamLink Website'];
  res.json(sources.map((s) => ({ source: s, candidates: candidates.filter((c) => c.source === s).length })));
});

module.exports = router;
