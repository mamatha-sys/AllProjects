const express = require('express');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();
router.use(requireAuth);

// Who is allowed to move an application INTO each stage. Admins/Super Admins always allowed.
const STAGE_OWNERS = {
  NEW: ['RECRUITER', 'TL', 'STL', 'MANAGER', 'ASSISTANT_MANAGER'],
  RECRUITER_REVIEW: ['RECRUITER', 'TL', 'STL', 'MANAGER', 'ASSISTANT_MANAGER'],
  RECRUITER_APPROVED: ['RECRUITER', 'TL', 'STL', 'MANAGER', 'ASSISTANT_MANAGER'],
  WITH_BDE: ['RECRUITER', 'BDE', 'TL', 'STL', 'MANAGER', 'ASSISTANT_MANAGER'],
  BDE_APPROVED: ['BDE', 'TL', 'STL', 'MANAGER', 'ASSISTANT_MANAGER'],
  SHARED_WITH_CLIENT: ['BDE', 'TL', 'STL', 'MANAGER', 'ASSISTANT_MANAGER'],
  CLIENT_REVIEW: ['BDE', 'TL', 'STL', 'MANAGER', 'ASSISTANT_MANAGER'],
  CLIENT_SHORTLISTED: ['CLIENT', 'BDE', 'TL', 'STL', 'MANAGER', 'ASSISTANT_MANAGER'],
  INTERVIEW_SCHEDULED: ['RECRUITER', 'BDE', 'TL', 'STL', 'MANAGER', 'ASSISTANT_MANAGER'],
  INTERVIEW_COMPLETED: ['RECRUITER', 'BDE', 'TL', 'STL', 'MANAGER', 'ASSISTANT_MANAGER'],
  SELECTED: ['CLIENT', 'TL', 'STL', 'MANAGER', 'ASSISTANT_MANAGER'],
  OFFER: ['RECRUITER', 'TL', 'STL', 'MANAGER', 'ASSISTANT_MANAGER'],
  OFFER_ACCEPTED: ['RECRUITER', 'TL', 'STL', 'MANAGER', 'ASSISTANT_MANAGER'],
  JOINED: ['RECRUITER', 'TL', 'STL', 'MANAGER', 'ASSISTANT_MANAGER'],
  HIRED: ['TL', 'STL', 'MANAGER', 'ASSISTANT_MANAGER'],
  REJECTED: ['RECRUITER', 'BDE', 'CLIENT', 'TL', 'STL', 'MANAGER', 'ASSISTANT_MANAGER'],
  HOLD: ['RECRUITER', 'BDE', 'TL', 'STL', 'MANAGER', 'ASSISTANT_MANAGER'],
};

router.get('/', async (req, res) => {
  const where = {};
  if (req.query.requirementId) where.requirementId = req.query.requirementId;
  if (req.query.candidateId) where.candidateId = req.query.candidateId;
  if (req.query.stage) where.stage = req.query.stage;
  const applications = await prisma.application.findMany({
    where,
    include: { candidate: true, requirement: { include: { client: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  res.json(applications);
});

router.post('/', async (req, res) => {
  const { candidateId, requirementId } = req.body;
  if (!candidateId || !requirementId) return res.status(400).json({ error: 'candidateId and requirementId are required' });
  const application = await prisma.application.create({ data: { candidateId, requirementId } });
  await logAudit({ userId: req.user.id, action: 'Application created', entity: 'Application', entityId: application.id });
  res.status(201).json(application);
});

router.patch('/:id/stage', async (req, res) => {
  const { stage, interviewAt } = req.body;
  if (!stage) return res.status(400).json({ error: 'stage is required' });

  const allowedRoles = STAGE_OWNERS[stage];
  if (!allowedRoles) return res.status(400).json({ error: 'Unknown stage' });
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
  if (!isAdmin && !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: "Moving to this stage isn't included in your role's permissions" });
  }

  const existing = await prisma.application.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Application not found' });

  const application = await prisma.application.update({
    where: { id: req.params.id },
    data: {
      stage,
      interviewStatus: stage === 'INTERVIEW_SCHEDULED' ? 'SCHEDULED' : stage === 'INTERVIEW_COMPLETED' ? 'COMPLETED' : existing.interviewStatus,
      interviewAt: interviewAt ? new Date(interviewAt) : existing.interviewAt,
    },
  });

  await logAudit({
    userId: req.user.id,
    action: 'Application stage changed',
    entity: 'Application',
    entityId: application.id,
    fromValue: existing.stage,
    toValue: stage,
  });

  res.json(application);
});

module.exports = router;
