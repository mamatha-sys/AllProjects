const express = require('express');
const prisma = require('../db');
const { logAudit } = require('../utils/audit');
const { notifyUsers } = require('../utils/notify');

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

// Candidate portal — where an applicant checks what happened to the
// applications they submitted, keyed on the email they applied with (no
// account, matching the no-login apply flow above). The prototype's
// candidatePortalView()/myApplications().
router.get('/my-applications', async (req, res) => {
  const email = (req.query.email || '').trim();
  if (!email) return res.status(400).json({ error: 'email is required' });

  const candidate = await prisma.candidate.findFirst({
    where: { email },
    include: {
      applications: {
        include: { requirement: { include: { client: true } } },
        orderBy: { updatedAt: 'desc' },
      },
    },
  });
  if (!candidate) return res.json({ name: null, applications: [] });

  res.json({
    name: candidate.name,
    applications: candidate.applications.map((a) => ({
      id: a.id,
      jobTitle: a.requirement.title,
      client: a.requirement.client.name,
      location: a.requirement.client.location,
      stage: a.stage,
      interviewAt: a.interviewAt,
      appliedAt: a.createdAt,
      updatedAt: a.updatedAt,
    })),
  });
});

// ---- Client agreement signing link -----------------------------------------
// The tokenised link a client receives (see POST /api/clients/:id/agreement/send).
// It is deliberately outside the login wall so the signatory doesn't need a
// TeamLink account — the opaque token is the only thing that grants access,
// and it exposes nothing beyond that one client's own agreement.

router.get('/agreement/:token', async (req, res) => {
  const client = await prisma.client.findUnique({ where: { esignToken: req.params.token } });
  if (!client || !client.agreementDocument) {
    return res.status(404).json({ error: 'This signing link is not valid — ask TeamLink to resend it' });
  }

  // First open is recorded as a timestamp. The prototype has no "Viewed"
  // agreement status — the lifecycle is Draft -> Sent -> Confirmed -> Active —
  // so opening the link leaves the status on Sent.
  if (client.agreementStatus === 'SENT' && !client.agreementViewedAt) {
    await prisma.client.update({ where: { id: client.id }, data: { agreementViewedAt: new Date() } });
    await logAudit({ action: 'Agreement opened by client', entity: 'Client', entityId: client.id, toValue: 'Sent' });
  }

  res.json({
    clientName: client.name,
    agreementId: client.agreementId,
    document: client.agreementDocument,
    status: client.agreementStatus,
    signedAt: client.agreementSignedAt,
    signedBy: client.agreementSignedBy,
    signedByTitle: client.agreementSignedByTitle,
  });
});

router.post('/agreement/:token/sign', async (req, res) => {
  const { signedByName, signedByTitle } = req.body;
  if (!signedByName) return res.status(400).json({ error: 'Type your full name to sign' });

  const client = await prisma.client.findUnique({ where: { esignToken: req.params.token } });
  if (!client || !client.agreementDocument) {
    return res.status(404).json({ error: 'This signing link is not valid — ask TeamLink to resend it' });
  }
  if (['CONFIRMED', 'ACTIVE'].includes(client.agreementStatus)) {
    return res.status(409).json({ error: 'This agreement has already been signed' });
  }
  if (client.agreementStatus !== 'SENT') {
    return res.status(400).json({ error: 'This agreement has not been sent for signature' });
  }

  const updated = await prisma.client.update({
    where: { id: client.id },
    data: {
      agreementStatus: 'CONFIRMED',
      agreementSignedAt: new Date(),
      agreementSignedBy: signedByName,
      agreementSignedByTitle: signedByTitle || null,
    },
  });
  await logAudit({
    action: 'Agreement e-signed via signing link', entity: 'Client',
    entityId: client.id, fromValue: 'Sent', toValue: 'Confirmed',
  });

  const owners = await prisma.requirement.findMany({ where: { clientId: client.id }, select: { recruiterId: true, bdeId: true } });
  await notifyUsers(owners.flatMap((r) => [r.recruiterId, r.bdeId]), {
    title: `${client.name} signed the service agreement`,
    message: `${updated.agreementId || 'Agreement'} signed by ${signedByName}.`,
  });

  res.json({ message: 'Agreement signed', agreementId: updated.agreementId, signedAt: updated.agreementSignedAt });
});

module.exports = router;
