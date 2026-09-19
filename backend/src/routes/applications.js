const express = require('express');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { pushNotification } = require('../utils/notify');

const router = express.Router();
router.use(requireAuth);

// Who is allowed to move an application INTO each stage. Admins/Super Admins always allowed.
const STAGE_OWNERS = {
  NEW: ['RECRUITER', 'TL', 'STL', 'MANAGER', 'ASSISTANT_MANAGER'],
  AI_INTERVIEW_REQUIRED: ['RECRUITER', 'TL', 'STL', 'MANAGER', 'ASSISTANT_MANAGER'],
  AI_INTERVIEW_SCHEDULED: ['RECRUITER', 'TL', 'STL', 'MANAGER', 'ASSISTANT_MANAGER'],
  AI_INTERVIEW_COMPLETED: ['RECRUITER', 'TL', 'STL', 'MANAGER', 'ASSISTANT_MANAGER'],
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

  const existing = await prisma.application.findUnique({
    where: { id: req.params.id },
    include: { candidate: true, requirement: true },
  });
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

  // Notify the requirement's recruiter/BDE whenever the stage moves — mirrors
  // the prototype's pushNotification() calls on every pipeline transition.
  const notifyIds = new Set([existing.requirement.recruiterId, existing.requirement.bdeId].filter(Boolean));
  notifyIds.delete(req.user.id);
  await Promise.all(
    [...notifyIds].map((userId) =>
      pushNotification({
        userId,
        title: `${existing.candidate.name} moved to ${stage.replace(/_/g, ' ')}`,
        message: `Requirement: ${existing.requirementId}`,
      })
    )
  );

  res.json(application);
});

// Client confirms a candidate has joined — mirrors the prototype's
// openClientJoiningModal()/confirmClientJoining(), moves the application to
// JOINED and stamps the joining date.
router.post('/:id/confirm-joining', async (req, res) => {
  const existing = await prisma.application.findUnique({
    where: { id: req.params.id },
    include: { candidate: true, requirement: true },
  });
  if (!existing) return res.status(404).json({ error: 'Application not found' });

  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);
  const isClientOwner = req.user.role === 'CLIENT' && req.user.clientId === existing.requirement.clientId;
  const isAtsTeam = ['RECRUITER', 'BDE', 'TL', 'STL', 'MANAGER', 'ASSISTANT_MANAGER'].includes(req.user.role);
  if (!isAdmin && !isClientOwner && !isAtsTeam) {
    return res.status(403).json({ error: "This action isn't included in your role's permissions" });
  }

  const { joiningDate } = req.body;
  const application = await prisma.application.update({
    where: { id: req.params.id },
    data: { stage: 'JOINED', joiningDate: joiningDate ? new Date(joiningDate) : new Date() },
  });

  await logAudit({
    userId: req.user.id, action: 'Client confirmed candidate joining', entity: 'Application',
    entityId: application.id, fromValue: existing.stage, toValue: 'JOINED',
  });

  const notifyIds = new Set([existing.requirement.recruiterId, existing.requirement.bdeId].filter(Boolean));
  await Promise.all(
    [...notifyIds].map((userId) =>
      pushNotification({ userId, title: `${existing.candidate.name} confirmed as joined`, message: `Requirement: ${existing.requirementId}` })
    )
  );

  res.json(application);
});

module.exports = router;
