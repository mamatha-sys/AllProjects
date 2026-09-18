const express = require('express');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const [openRequirements, recruiterReview, withBde, clientReview, interviewsScheduled, hired, auditLog] = await Promise.all([
    prisma.requirement.count({ where: { status: 'OPEN' } }),
    prisma.application.count({ where: { stage: 'RECRUITER_REVIEW' } }),
    prisma.application.count({ where: { stage: 'WITH_BDE' } }),
    prisma.application.count({ where: { stage: { in: ['SHARED_WITH_CLIENT', 'CLIENT_REVIEW'] } } }),
    prisma.application.count({ where: { stage: 'INTERVIEW_SCHEDULED' } }),
    prisma.application.count({ where: { stage: { in: ['JOINED', 'HIRED'] } } }),
    prisma.auditLog.findMany({ take: 8, orderBy: { createdAt: 'desc' }, include: { user: true } }),
  ]);

  res.json({
    openRequirements,
    recruiterReview,
    withBde,
    clientReview,
    interviewsScheduled,
    hired,
    recentActivity: auditLog.map((a) => ({
      date: a.createdAt,
      user: a.user ? a.user.name : 'System',
      action: a.action,
      entity: a.entity,
    })),
  });
});

module.exports = router;
