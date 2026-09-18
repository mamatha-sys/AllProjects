const express = require('express');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  // Clients see only their own record.
  if (req.user.role === 'CLIENT') {
    const client = await prisma.client.findUnique({ where: { id: req.user.clientId } });
    return res.json(client ? [client] : []);
  }
  const clients = await prisma.client.findMany({ orderBy: { name: 'asc' } });
  res.json(clients);
});

router.get('/:id', async (req, res) => {
  const client = await prisma.client.findUnique({ where: { id: req.params.id } });
  if (!client) return res.status(404).json({ error: 'Client not found' });
  if (req.user.role === 'CLIENT' && client.id !== req.user.clientId) {
    return res.status(403).json({ error: 'This record is outside your client scope' });
  }
  res.json(client);
});

router.post('/', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const { name, industry, location } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const client = await prisma.client.create({ data: { name, industry, location } });
  await logAudit({ userId: req.user.id, action: 'Client created', entity: 'Client', entityId: client.id });
  res.status(201).json(client);
});

router.put('/:id', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const { name, industry, location } = req.body;
  const client = await prisma.client.update({ where: { id: req.params.id }, data: { name, industry, location } });
  await logAudit({ userId: req.user.id, action: 'Client updated', entity: 'Client', entityId: client.id });
  res.json(client);
});

module.exports = router;
