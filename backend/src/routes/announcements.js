const express = require('express');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();
router.use(requireAuth);

const HR_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANT_MANAGER', 'STL', 'TL'];

router.get('/', async (req, res) => {
  const announcements = await prisma.announcement.findMany({ orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }] });
  res.json(announcements);
});

router.post('/', requireRole(...HR_ROLES), async (req, res) => {
  const { title, body, category, pinned, target, date } = req.body;
  if (!title || !body || !date) return res.status(400).json({ error: 'title, body and date are required' });
  const announcement = await prisma.announcement.create({ data: { title, body, category, pinned: !!pinned, target, date } });
  await logAudit({ userId: req.user.id, action: 'Announcement posted', entity: 'Announcement', entityId: announcement.id });
  res.status(201).json(announcement);
});

module.exports = router;
