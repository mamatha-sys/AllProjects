const express = require('express');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { pushNotification } = require('../utils/notify');

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

// --- E-sign agreement flow --------------------------------------------------
// Mirrors the prototype's generateAgreementDocument / sendAgreementToClient /
// confirmAgreementByClient sequence: Admin generates + sends a document, the
// client's own login confirms/e-signs it.

router.post('/:id/agreement/generate', requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), async (req, res) => {
  const client = await prisma.client.findUnique({ where: { id: req.params.id } });
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const document = [
    `SERVICE AGREEMENT — TeamLink Consultants & ${client.name}`,
    `Industry: ${client.industry || 'N/A'}   Location: ${client.location || 'N/A'}`,
    '',
    'This agreement authorizes TeamLink Consultants to source, screen and present candidates',
    `for open requirements raised by ${client.name}, on standard commercial terms (placement`,
    'fee: one month CTC equivalent per confirmed hire, payable within 30 days of joining).',
    '',
    `Generated ${new Date().toISOString().slice(0, 10)}.`,
  ].join('\n');

  const updated = await prisma.client.update({ where: { id: client.id }, data: { agreementDocument: document } });
  await logAudit({ userId: req.user.id, action: 'Agreement document generated', entity: 'Client', entityId: client.id });
  res.json(updated);
});

router.post('/:id/agreement/send', requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), async (req, res) => {
  const client = await prisma.client.findUnique({ where: { id: req.params.id } });
  if (!client) return res.status(404).json({ error: 'Client not found' });
  if (!client.agreementDocument) return res.status(400).json({ error: 'Generate the agreement document first' });

  const updated = await prisma.client.update({
    where: { id: client.id },
    data: { agreementStatus: 'SENT', agreementSentAt: new Date() },
  });
  await logAudit({ userId: req.user.id, action: 'Agreement sent to client', entity: 'Client', entityId: client.id });

  const clientUsers = await prisma.user.findMany({ where: { clientId: client.id, role: 'CLIENT' } });
  await Promise.all(
    clientUsers.map((u) =>
      pushNotification({ userId: u.id, title: 'Service agreement ready to sign', message: `${client.name}: please review and e-sign the agreement.` })
    )
  );

  res.json(updated);
});

router.post('/:id/agreement/confirm', requireRole('CLIENT', 'SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const client = await prisma.client.findUnique({ where: { id: req.params.id } });
  if (!client) return res.status(404).json({ error: 'Client not found' });
  if (req.user.role === 'CLIENT' && client.id !== req.user.clientId) {
    return res.status(403).json({ error: 'This record is outside your client scope' });
  }
  if (client.agreementStatus !== 'SENT') return res.status(400).json({ error: 'No pending agreement to sign' });

  const { signedByName } = req.body;
  const updated = await prisma.client.update({
    where: { id: client.id },
    data: { agreementStatus: 'SIGNED', agreementSignedAt: new Date(), agreementSignedBy: signedByName || req.user.name },
  });
  await logAudit({ userId: req.user.id, action: 'Agreement e-signed by client', entity: 'Client', entityId: client.id });
  res.json(updated);
});

module.exports = router;
