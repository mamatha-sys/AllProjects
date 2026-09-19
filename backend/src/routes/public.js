const express = require('express');
const prisma = require('../db');
const { logAudit } = require('../utils/audit');

const router = express.Router();

// Public job listing — the TeamLink Job Portal candidates browse without logging in.
router.get('/jobs', async (req, res) => {
  const jobs = await prisma.requirement.findMany({
    where: { status: 'OPEN' },
    include: { client: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(
    jobs.map((j) => ({
      id: j.id,
      title: j.title,
      description: j.description,
      department: j.department,
      priority: j.priority,
      client: j.client.name,
      location: j.client.location,
      postedAt: j.createdAt,
    }))
  );
});

router.get('/jobs/:id', async (req, res) => {
  const job = await prisma.requirement.findUnique({ where: { id: req.params.id }, include: { client: true } });
  if (!job || job.status !== 'OPEN') return res.status(404).json({ error: 'Job not found' });
  res.json({
    id: job.id,
    title: job.title,
    description: job.description,
    department: job.department,
    priority: job.priority,
    client: job.client.name,
    location: job.client.location,
    postedAt: job.createdAt,
  });
});

// Candidate applies from the public portal — creates (or reuses) a Candidate record
// and links a new Application into the pipeline at the NEW stage.
router.post('/jobs/:id/apply', async (req, res) => {
  const { name, email, phone } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'name and email are required' });

  const job = await prisma.requirement.findUnique({ where: { id: req.params.id } });
  if (!job || job.status !== 'OPEN') return res.status(404).json({ error: 'Job not found' });

  let candidate = await prisma.candidate.findFirst({ where: { email } });
  if (!candidate) {
    candidate = await prisma.candidate.create({ data: { name, email, phone, source: 'Job Portal' } });
  }

  const existing = await prisma.application.findUnique({
    where: { candidateId_requirementId: { candidateId: candidate.id, requirementId: job.id } },
  });
  if (existing) return res.status(409).json({ error: 'You have already applied to this job' });

  const application = await prisma.application.create({ data: { candidateId: candidate.id, requirementId: job.id, stage: 'NEW' } });
  await logAudit({ action: 'Job Portal application received', entity: 'Application', entityId: application.id, toValue: candidate.name });

  res.status(201).json({ message: 'Application submitted', applicationId: application.id });
});

// Candidate self-service status check ("My Applications" from the prototype's
// candidate portal) — looks up every application tied to an email, no login required.
router.get('/my-applications', async (req, res) => {
  const email = (req.query.email || '').trim();
  if (!email) return res.status(400).json({ error: 'email is required' });

  const candidate = await prisma.candidate.findFirst({
    where: { email },
    include: { applications: { include: { requirement: { include: { client: true } } } } },
  });
  if (!candidate) return res.json({ applications: [] });

  res.json({
    applications: candidate.applications.map((a) => ({
      id: a.id,
      jobTitle: a.requirement.title,
      client: a.requirement.client.name,
      stage: a.stage,
      interviewAt: a.interviewAt,
      updatedAt: a.updatedAt,
    })),
  });
});

module.exports = router;
