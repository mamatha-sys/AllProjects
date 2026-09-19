const express = require('express');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');
const { STAGE_CODES, stageLabel } = require('../utils/atsVocab');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  // A client only ever sees their own pipeline (prototype atsDashboard, line 6252).
  const appScope = req.user.role === 'CLIENT' ? { requirement: { clientId: req.user.clientId } } : {};
  const reqScope = req.user.role === 'CLIENT' ? { clientId: req.user.clientId } : {};
  const count = (where) => prisma.application.count({ where: { ...appScope, ...where } });

  const [
    openRequirements, recruiterReview, withBde, clientReview, interviewsUpcoming, hiringOutcomes, auditLog,
    activeEmployees, pendingLeave, invoicesPending, invoicesOverdue,
    stageGroups, recruiters,
  ] = await Promise.all([
    prisma.requirement.count({ where: { ...reqScope, status: 'OPEN' } }),
    count({ stage: 'RECRUITER_REVIEW' }),
    count({ stage: 'WITH_BDE' }),
    count({ stage: { in: ['SHARED_WITH_CLIENT', 'CLIENT_REVIEW'] } }),
    // "Interviews upcoming" counts scheduled interviews, not the stage.
    count({ interviewStatus: 'SCHEDULED' }),
    count({ stage: { in: ['JOINED', 'HIRED'] } }),
    prisma.auditLog.findMany({ take: 8, orderBy: { createdAt: 'desc' }, include: { user: true } }),
    prisma.employee.count({ where: { employmentStatus: 'Active' } }),
    prisma.leaveRequest.count({ where: { status: 'Pending' } }),
    prisma.invoice.count({ where: { status: 'Pending' } }),
    prisma.invoice.count({ where: { status: 'Overdue' } }),
    prisma.application.groupBy({ by: ['stage'], where: appScope, _count: { stage: true } }),
    prisma.user.findMany({ where: { role: 'RECRUITER' }, select: { id: true, name: true } }),
  ]);

  // "Pipeline by stage": the prototype lists the 18 pipeline stages in order,
  // then Hold and Rejected, showing only the stages that have candidates.
  const byStage = Object.fromEntries(stageGroups.map((g) => [g.stage, g._count.stage]));
  const pipelineByStage = [...STAGE_CODES, 'HOLD', 'REJECTED']
    .filter((s) => (byStage[s] || 0) > 0)
    .map((s) => ({ stage: s, label: stageLabel(s), count: byStage[s] }));

  // "Recruiter workload": requirements per recruiter.
  const recruiterWorkload = await Promise.all(
    recruiters.map(async (u) => ({
      name: u.name,
      requirements: await prisma.requirement.count({ where: { recruiterId: u.id } }),
    }))
  );

  res.json({
    openRequirements,
    recruiterReview,
    withBde,
    clientReview,
    interviewsUpcoming,
    hiringOutcomes,
    pipelineByStage,
    recruiterWorkload,
    activeEmployees,
    pendingLeave,
    invoicesPending,
    invoicesOverdue,
    recentActivity: auditLog.map((a) => ({
      date: a.createdAt,
      user: a.user ? a.user.name : 'System',
      action: a.action,
      entity: a.entity,
    })),
  });
});

module.exports = router;
