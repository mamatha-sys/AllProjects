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

// Every field the prototype's saveNewClient() (line 7437) records, grouped by
// the tab it sits on in the Add Client modal.
const CLIENT_FIELDS = {
  text: [
    // Basic Info
    'name', 'legalName', 'website', 'industry', 'ownerDepartment', 'yearEstablished', 'landline',
    'status', 'activeDate', 'clientType', 'priority',
    'contactName', 'contactDesignation', 'contactPhone', 'contactEmail', 'contactWhatsApp',
    'secondaryContactName', 'secondaryContactDesignation', 'secondaryContactPhone', 'secondaryContactEmail',
    'commPrimary', 'commSecondary', 'commChannels',
    'houseNumber', 'street', 'landmark', 'area', 'pincode', 'country', 'state', 'location',
    // Legal & Finance
    'gst', 'pan', 'tan', 'businessType', 'paymentTerms', 'guaranteePeriod', 'invoiceTrigger',
    'paymentDue', 'commercialNotes', 'accountManager', 'bdeOwner',
    // Agreement
    'agreementRequired', 'agreementTemplate', 'agreementStart', 'agreementEnd',
    // Risk Monitoring
    'riskFlag', 'riskNotes',
  ],
  numeric: ['agreementFeePercent', 'tdsPercent', 'gstPercent'],
};

function pickClient(body) {
  const data = {};
  for (const key of CLIENT_FIELDS.text) {
    if (body[key] !== undefined) data[key] = body[key];
  }
  for (const key of CLIENT_FIELDS.numeric) {
    if (body[key] !== undefined && body[key] !== '') data[key] = Number(body[key]);
  }
  return data;
}

router.post('/', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const data = pickClient(req.body);
  // Prototype saveNewClient(): the full save requires company name, location
  // and the three primary-contact fields. Saving as a draft skips the checks.
  const asDraft = Boolean(req.body.asDraft);
  if (!data.name) return res.status(400).json({ error: 'Enter the company name.' });
  if (!asDraft) {
    if (!data.state) return res.status(400).json({ error: 'Select the client location (State/District/City).' });
    if (!data.contactName || !data.contactEmail || !data.contactPhone) {
      return res.status(400).json({ error: 'Enter the primary contact name, phone and email.' });
    }
  }

  const client = await prisma.client.create({ data: { ...data, agreementStatus: 'DRAFT' } });
  // "Save & Create Agreement" generates the document straight away from the
  // commercial terms; it still starts life as a Draft.
  const withDoc = req.body.createAgreement
    ? await prisma.client.update({
        where: { id: client.id },
        data: { agreementDocument: buildAgreementDocument(client) },
      })
    : client;
  await logAudit({ userId: req.user.id, action: 'Client created', entity: 'Client', entityId: client.id, toValue: 'Draft' });
  res.status(201).json(withDoc);
});

router.put('/:id', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const client = await prisma.client.update({ where: { id: req.params.id }, data: pickClient(req.body) });
  await logAudit({ userId: req.user.id, action: 'Client updated', entity: 'Client', entityId: client.id });
  res.json(client);
});

// ---- Service agreement e-sign flow -----------------------------------------
// The prototype's lifecycle is Draft -> Sent -> Confirmed -> Active
// (generateAgreementDocument line 6316, sendAgreementToClient line 7972,
// confirmAgreementByClient line 7989, activateAgreement line 7998).
//
// Confirmed and Active are deliberately distinct: the client signing the
// document confirms it, and TeamLink then activates it. Only an ACTIVE
// agreement lets a requirement for that client be activated or posted.

const AGREEMENT_EDIT_ROLES = ['SUPER_ADMIN', 'ADMIN'];

router.post('/:id/agreement/generate', requireRole(...AGREEMENT_EDIT_ROLES), async (req, res) => {
  const client = await prisma.client.findUnique({ where: { id: req.params.id } });
  if (!client) return res.status(404).json({ error: 'Client not found' });
  if (['CONFIRMED', 'ACTIVE'].includes(client.agreementStatus)) {
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
  if (['CONFIRMED', 'ACTIVE'].includes(client.agreementStatus)) {
    return res.status(400).json({ error: 'This agreement is already signed' });
  }

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
  if (client.agreementStatus !== 'SENT') {
    return res.status(400).json({ error: 'No pending agreement to sign' });
  }

  const { signedByName, signedByTitle } = req.body;
  const updated = await prisma.client.update({
    where: { id: client.id },
    data: {
      agreementStatus: 'CONFIRMED',
      agreementSignedAt: new Date(),
      agreementSignedBy: signedByName || req.user.name,
      agreementSignedByTitle: signedByTitle || null,
    },
  });
  await logAudit({
    userId: req.user.id, action: 'Agreement confirmed/signed by client', entity: 'Client',
    entityId: client.id, fromValue: 'Sent', toValue: 'Confirmed',
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

// Resend an agreement already out for signature — the prototype's
// resendAgreement() (line 7981). The status stays Sent.
router.post('/:id/agreement/resend', requireRole(...AGREEMENT_EDIT_ROLES), async (req, res) => {
  const client = await prisma.client.findUnique({ where: { id: req.params.id } });
  if (!client) return res.status(404).json({ error: 'Client not found' });
  if (client.agreementStatus !== 'SENT') return res.status(400).json({ error: 'No agreement is currently out for signature' });

  const updated = await prisma.client.update({ where: { id: client.id }, data: { agreementSentAt: new Date() } });
  await logAudit({
    userId: req.user.id, action: 'Agreement resent to client', entity: 'Client',
    entityId: client.id, fromValue: 'Sent', toValue: 'Sent',
  });
  res.json({ ...updated, signingPath: `/agreement/${updated.esignToken}` });
});

// The final step: TeamLink activates the confirmed agreement, which is what
// unblocks requirements for this client — the prototype's activateAgreement()
// (line 7998). Confirming alone is not enough.
router.post('/:id/agreement/activate', requireRole(...AGREEMENT_EDIT_ROLES), async (req, res) => {
  const client = await prisma.client.findUnique({ where: { id: req.params.id } });
  if (!client) return res.status(404).json({ error: 'Client not found' });
  if (client.agreementStatus === 'ACTIVE') return res.status(400).json({ error: 'This agreement is already Active' });
  if (client.agreementStatus !== 'CONFIRMED') {
    return res.status(400).json({ error: 'Only a Confirmed agreement can be activated' });
  }

  const updated = await prisma.client.update({
    where: { id: client.id },
    data: { agreementStatus: 'ACTIVE', agreementActivatedAt: new Date() },
  });
  await logAudit({
    userId: req.user.id, action: 'Agreement activated', entity: 'Client',
    entityId: client.id, fromValue: 'Confirmed', toValue: 'Active',
  });
  res.json(updated);
});

module.exports = router;
