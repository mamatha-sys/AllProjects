const express = require('express');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();
router.use(requireAuth);

const ACCOUNTS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'];

router.get('/', async (req, res) => {
  const where = {};
  if (req.user.role === 'CLIENT') where.clientId = req.user.clientId;
  if (req.query.status) where.status = req.query.status;
  if (req.query.clientId) where.clientId = req.query.clientId;
  const invoices = await prisma.invoice.findMany({
    where,
    include: { client: true, candidate: true, requirement: true },
    orderBy: { invoiceDate: 'desc' },
  });
  res.json(invoices);
});

router.get('/:id', async (req, res) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: { client: true, candidate: true, requirement: true },
  });
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  if (req.user.role === 'CLIENT' && invoice.clientId !== req.user.clientId) {
    return res.status(403).json({ error: 'This record is outside your client scope' });
  }
  res.json(invoice);
});

router.post('/', requireRole(...ACCOUNTS_ROLES), async (req, res) => {
  const { clientId, candidateId, requirementId, amount, gst, tds, invoiceDate, dueDate, paymentTerms } = req.body;
  if (!clientId || !amount || !invoiceDate) return res.status(400).json({ error: 'clientId, amount and invoiceDate are required' });
  const invoice = await prisma.invoice.create({
    data: { clientId, candidateId, requirementId, amount: Number(amount), gst: Number(gst) || 0, tds: Number(tds) || 0, invoiceDate, dueDate, paymentTerms },
  });
  await logAudit({ userId: req.user.id, action: 'Invoice created', entity: 'Invoice', entityId: invoice.id });
  res.status(201).json(invoice);
});

router.patch('/:id/pay', requireRole(...ACCOUNTS_ROLES), async (req, res) => {
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  if (invoice.status === 'Paid') return res.status(400).json({ error: 'Already marked paid' });
  const updated = await prisma.invoice.update({ where: { id: req.params.id }, data: { status: 'Paid' } });
  await logAudit({ userId: req.user.id, action: 'Invoice paid', entity: 'Invoice', entityId: invoice.id, fromValue: invoice.status, toValue: 'Paid' });
  res.json(updated);
});

module.exports = router;
