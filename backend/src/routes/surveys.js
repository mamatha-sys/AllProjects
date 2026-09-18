const express = require('express');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();
router.use(requireAuth);

const HR_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANT_MANAGER', 'STL', 'TL'];

router.get('/', async (req, res) => {
  const surveys = await prisma.survey.findMany({ include: { responses: true }, orderBy: { createdAt: 'desc' } });
  res.json(surveys.map((s) => ({ ...s, questions: JSON.parse(s.questions) })));
});

router.post('/', requireRole(...HR_ROLES), async (req, res) => {
  const { title, questions } = req.body; // questions: string[]
  if (!title || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'title and a non-empty questions array are required' });
  }
  const survey = await prisma.survey.create({ data: { title, questions: JSON.stringify(questions) } });
  await logAudit({ userId: req.user.id, action: 'Survey created', entity: 'Survey', entityId: survey.id });
  res.status(201).json({ ...survey, questions });
});

router.post('/:id/respond', async (req, res) => {
  const { answers } = req.body; // string[]
  const own = await prisma.employee.findUnique({ where: { userId: req.user.id } });
  if (!own) return res.status(404).json({ error: 'No employee record linked to this account' });
  if (!Array.isArray(answers)) return res.status(400).json({ error: 'answers must be an array' });
  const response = await prisma.surveyResponse.upsert({
    where: { surveyId_employeeId: { surveyId: req.params.id, employeeId: own.id } },
    update: { answers: JSON.stringify(answers) },
    create: { surveyId: req.params.id, employeeId: own.id, answers: JSON.stringify(answers) },
  });
  res.status(201).json(response);
});

module.exports = router;
