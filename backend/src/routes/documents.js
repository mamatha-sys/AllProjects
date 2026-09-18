const express = require('express');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();
router.use(requireAuth);

const HR_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANT_MANAGER', 'STL', 'TL'];

router.get('/', async (req, res) => {
  const documents = await prisma.policyDocument.findMany({ where: { published: true }, include: { acknowledgments: true }, orderBy: { createdAt: 'desc' } });
  res.json(documents);
});

router.post('/', requireRole(...HR_ROLES), async (req, res) => {
  const { title, category, mandatory, target, uploadedDate } = req.body;
  if (!title || !uploadedDate) return res.status(400).json({ error: 'title and uploadedDate are required' });
  const doc = await prisma.policyDocument.create({ data: { title, category, mandatory: !!mandatory, target, uploadedDate } });
  await logAudit({ userId: req.user.id, action: 'Document published', entity: 'PolicyDocument', entityId: doc.id });
  res.status(201).json(doc);
});

router.post('/:id/acknowledge', async (req, res) => {
  const own = await prisma.employee.findUnique({ where: { userId: req.user.id } });
  if (!own) return res.status(404).json({ error: 'No employee record linked to this account' });
  const ack = await prisma.acknowledgment.upsert({
    where: { documentId_employeeId: { documentId: req.params.id, employeeId: own.id } },
    update: {},
    create: { documentId: req.params.id, employeeId: own.id },
  });
  res.status(201).json(ack);
});

module.exports = router;
