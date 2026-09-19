const express = require('express');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { notifyUsers } = require('../utils/notify');
const { buildAgreementDocument, nextAgreementId, newEsignToken } = require('../utils/agreement');

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
  const { name, industry, location, agreementFeePercent } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const client = await prisma.client.create({
    data: { name, industry, location, agreementFeePercent: agreementFeePercent != null ? Number(agreementFeePercent) : undefined },
  });
  await logAudit({ userId: req.user.id, action: 'Client created', entity: 'Client', entityId: client.id });
  res.status(201).json(client);
});

router.put('/:id', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const { name, industry, location, agreementFeePercent } = req.body;
  const client = await prisma.client.update({
    where: { id: req.params.id },
    data: { name, industry, location, agreementFeePercent: agreementFeePercent != null ? Number(agreementFeePercent) : undefined },
  });
  await logAudit({ userId: req.user.id, action: 'Client updated', entity: 'Client', entityId: client.id });
  res.json(client);
});

// ---- Service agreement e-sign flow -----------------------------------------
// Generate the document, send it for signature, then either the client's own
// login confirms it here or they e-sign through the public tokenised link
// handled in routes/public.js. Mirrors the prototype's
// generateAgreementDocument / sendAgreementToClient / confirmAgreementByClient.

const AGREEMENT_EDIT_ROLES = ['SUPER_ADMIN', 'ADMIN'];

router.post('/:id/agreement/generate', requireRole(...AGREEMENT_EDIT_ROLES), async (req, res) => {
  const client = await prisma.client.findUnique({ where: { id: req.params.id } });
  if (!client) return res.status(404).json({ error: 'Client not found' });
  if (client.agreementStatus === 'SIGNED') {
    return res.status(400).json({ error: 'This agreement is already signed — it cannot be regenerated' });
  }

  const updated = await prisma.client.update({
    where: { id: client.id },
    data: { agreementDocument: buildAgreementDocument(client), agreementStatus: 'DRAFT' },
  });
  await logAudit({ userId: req.user.id, action: 'Agreement document generated', entity: 'Client', entityId: client.id });
  res.json(updated);
});

router.post('/:id/agreement/send', requireRole(...AGREEMENT_EDIT_ROLES), async (req, res) => {
  const client = await prisma.client.findUnique({ where: { id: req.params.id } });
  if (!client) return res.status(404).json({ error: 'Client not found' });
  if (!client.agreementDocument) return res.status(400).json({ error: 'Generate the agreement document first' });
  if (client.agreementStatus === 'SIGNED') return res.status(400).json({ error: 'This agreement is already signed' });

  const updated = await prisma.client.update({
    where: { id: client.id },
    data: {
      agreementStatus: 'SENT',
      agreementSentAt: new Date(),
      agreementId: client.agreementId || (await nextAgreementId()),
      esignToken: client.esignToken || newEsignToken(),
    },
  });
  await logAudit({
    userId: req.user.id, action: 'Agreement sent to client', entity: 'Client',
    entityId: client.id, fromValue: client.agreementStatus, toValue: 'SENT',
  });

  // The client's own users get an in-app prompt; the signing link is what an
  // email/WhatsApp dispatch would carry (dispatch itself is out of scope).
  const clientUsers = await prisma.user.findMany({ where: { clientId: client.id, role: 'CLIENT' } });
  await notifyUsers(clientUsers.map((u) => u.id), {
    title: 'Service agreement ready to sign',
    message: `${client.name}: please review and e-sign agreement ${updated.agreementId}.`,
    exceptUserId: req.user.id,
  });

  res.json({ ...updated, signingPath: `/agreement/${updated.esignToken}` });
});

// Signed from inside the app by the client's own login (the public link route
// in routes/public.js is the no-login equivalent).
router.post('/:id/agreement/confirm', requireRole('CLIENT', 'SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const client = await prisma.client.findUnique({ where: { id: req.params.id } });
  if (!client) return res.status(404).json({ error: 'Client not found' });
  if (req.user.role === 'CLIENT' && client.id !== req.user.clientId) {
    return res.status(403).json({ error: 'This record is outside your client scope' });
  }
  if (!['SENT', 'VIEWED'].includes(client.agreementStatus)) {
    return res.status(400).json({ error: 'No pending agreement to sign' });
  }

  const { signedByName, signedByTitle } = req.body;
  const updated = await prisma.client.update({
    where: { id: client.id },
    data: {
      agreementStatus: 'SIGNED',
      agreementSignedAt: new Date(),
      agreementSignedBy: signedByName || req.user.name,
      agreementSignedByTitle: signedByTitle || null,
    },
  });
  await logAudit({
    userId: req.user.id, action: 'Agreement e-signed by client', entity: 'Client',
    entityId: client.id, fromValue: client.agreementStatus, toValue: 'SIGNED',
  });

  // Let the account team know the agreement came back signed.
  const owners = await prisma.requirement.findMany({
    where: { clientId: client.id },
    select: { recruiterId: true, bdeId: true },
  });
  await notifyUsers(owners.flatMap((r) => [r.recruiterId, r.bdeId]), {
    title: `${client.name} signed the service agreement`,
    message: `${updated.agreementId || 'Agreement'} signed by ${updated.agreementSignedBy}.`,
    exceptUserId: req.user.id,
  });

  res.json(updated);
});

module.exports = router;
