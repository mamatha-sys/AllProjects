const express = require('express');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();
router.use(requireAuth);

const HR_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANT_MANAGER', 'STL', 'TL'];

router.get('/', async (req, res) => {
  const patterns = await prisma.shiftPattern.findMany({ orderBy: { startTime: 'asc' } });
  res.json(patterns);
});

router.post('/', requireRole(...HR_ROLES), async (req, res) => {
  const { name, startTime, endTime } = req.body;
  if (!name || !startTime || !endTime) return res.status(400).json({ error: 'name, startTime and endTime are required' });
  const pattern = await prisma.shiftPattern.create({ data: { name, startTime, endTime } });
  await logAudit({ userId: req.user.id, action: 'Shift pattern added', entity: 'ShiftPattern', entityId: pattern.id });
  res.status(201).json(pattern);
});

router.put('/:id', requireRole(...HR_ROLES), async (req, res) => {
  const { active } = req.body;
  const pattern = await prisma.shiftPattern.update({ where: { id: req.params.id }, data: { active } });
  res.json(pattern);
});

module.exports = router;
