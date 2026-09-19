const express = require('express');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const {
  ROUND, invoiceTotal, invoiceOutstanding, deriveInvoiceStatus, dueDateFor,
} = require('../utils/accounts');

const router = express.Router();
router.use(requireAuth);

const ACCOUNTS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'];

// Everything an invoice row needs on screen, computed the same way everywhere:
// total = amount + GST - TDS, outstanding = total - received.
function decorate(invoice) {
  const status = deriveInvoiceStatus(invoice);
  return {
    ...invoice,
    status,
    total: invoiceTotal(invoice),
    outstanding: invoiceOutstanding(invoice),
  };
}

// Statuses are derived from receipts and the due date, so they are refreshed
// on read rather than left to drift. Only writes the row when it actually moved.
async function syncStatus(invoice) {
  const status = deriveInvoiceStatus(invoice);
  if (status !== invoice.status) {
    await prisma.invoice.update({ where: { id: invoice.id }, data: { status } });
    return { ...invoice, status };
  }
  return invoice;
}

async function nextInvoiceNumber() {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const last = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: 'desc' },
    select: { invoiceNumber: true },
  });
  const seq = last ? Number(String(last.invoiceNumber).slice(prefix.length)) + 1 : 1;
  return prefix + String(seq).padStart(4, '0');
}

router.get('/', async (req, res) => {
  const where = {};
  if (req.user.role === 'CLIENT') where.clientId = req.user.clientId;
  if (req.query.clientId) where.clientId = req.query.clientId;
  const invoices = await prisma.invoice.findMany({
    where,
    include: { client: true, candidate: true, requirement: true },
    orderBy: { invoiceDate: 'desc' },
  });
  const synced = await Promise.all(invoices.map(syncStatus));
  let rows = synced.map(decorate);
  // Filter on the derived status so "Overdue" means what it says.
  if (req.query.status) rows = rows.filter((i) => i.status === req.query.status);
  res.json(rows);
});

// Receivables summary for the accountant dashboard and reports.
router.get('/summary', async (req, res) => {
  const where = req.user.role === 'CLIENT' ? { clientId: req.user.clientId } : {};
  const invoices = await prisma.invoice.findMany({ where });
  const rows = invoices.map(decorate);
  const bucket = (status) => {
    const list = rows.filter((i) => i.status === status);
    return {
      status,
      count: list.length,
      total: ROUND(list.reduce((s, i) => s + i.total, 0)),
      outstanding: ROUND(list.reduce((s, i) => s + i.outstanding, 0)),
    };
  };
  res.json({
    byStatus: ['Pending', 'Partially Paid', 'Overdue', 'Paid', 'Cancelled'].map(bucket),
    invoiced: ROUND(rows.reduce((s, i) => s + i.total, 0)),
    received: ROUND(rows.reduce((s, i) => s + Number(i.receivedAmount || 0), 0)),
    outstanding: ROUND(rows.filter((i) => i.status !== 'Cancelled').reduce((s, i) => s + i.outstanding, 0)),
    gstCharged: ROUND(rows.reduce((s, i) => s + Number(i.gst || 0), 0)),
    tdsDeducted: ROUND(rows.reduce((s, i) => s + Number(i.tds || 0), 0)),
  });
});

router.get('/:id', async (req, res) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: {
      client: true, candidate: true,
      requirement: { include: { recruiter: true, bde: true } },
      payments: { orderBy: { date: 'asc' } },
    },
  });
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  if (req.user.role === 'CLIENT' && invoice.clientId !== req.user.clientId) {
    return res.status(403).json({ error: 'This record is outside your client scope' });
  }
  const synced = await syncStatus(invoice);
  const application = invoice.candidateId && invoice.requirementId
    ? await prisma.application.findUnique({ where: { candidateId_requirementId: { candidateId: invoice.candidateId, requirementId: invoice.requirementId } } })
    : null;
  res.json({ ...decorate(synced), applicationId: application?.id || null });
});

router.post('/', requireRole(...ACCOUNTS_ROLES), async (req, res) => {
  const { clientId, candidateId, requirementId, amount, gst, tds, invoiceDate, dueDate, paymentTerms, notes } = req.body;
  if (!clientId || !amount || !invoiceDate) return res.status(400).json({ error: 'clientId, amount and invoiceDate are required' });
  const terms = paymentTerms || 'Net 30';
  const invoice = await prisma.invoice.create({
    data: {
      clientId,
      candidateId: candidateId || null,
      requirementId: requirementId || null,
      amount: Number(amount),
      gst: Number(gst) || 0,
      tds: Number(tds) || 0,
      invoiceDate,
      // A blank due date is derived from the payment terms rather than left empty,
      // otherwise nothing can ever go Overdue.
      dueDate: dueDate || dueDateFor(invoiceDate, terms),
      paymentTerms: terms,
      notes: notes || null,
      invoiceNumber: await nextInvoiceNumber(),
    },
  });
  await logAudit({ userId: req.user.id, action: 'Invoice created', entity: 'Invoice', entityId: invoice.id, toValue: invoice.invoiceNumber });
  res.status(201).json(decorate(invoice));
});

// Record a receipt. Several of these can land on one invoice, which is how an
// invoice reaches "Partially Paid" and then "Paid".
router.post('/:id/payments', requireRole(...ACCOUNTS_ROLES), async (req, res) => {
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  if (invoice.status === 'Cancelled') return res.status(400).json({ error: 'This invoice is cancelled' });

  const amount = ROUND(req.body.amount);
  if (!(amount > 0)) return res.status(400).json({ error: 'A positive amount is required' });
  const outstanding = invoiceOutstanding(invoice);
  if (amount > outstanding + 0.5) {
    return res.status(400).json({ error: `That is more than the ₹${outstanding.toLocaleString('en-IN')} still outstanding on this invoice` });
  }

  const date = req.body.date || new Date().toISOString().slice(0, 10);
  const payment = await prisma.invoicePayment.create({
    data: {
      invoiceId: invoice.id,
      date,
      amount,
      method: req.body.method || 'Bank Transfer',
      reference: req.body.reference || null,
      notes: req.body.notes || null,
      recordedBy: req.user.name || req.user.email || null,
    },
  });
  const received = ROUND(Number(invoice.receivedAmount || 0) + amount);
  const next = { ...invoice, receivedAmount: received };
  const status = deriveInvoiceStatus(next);
  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: { receivedAmount: received, status, paidDate: status === 'Paid' ? date : invoice.paidDate },
    include: { payments: { orderBy: { date: 'asc' } } },
  });
  await logAudit({
    userId: req.user.id, action: 'Payment recorded', entity: 'Invoice', entityId: invoice.id,
    fromValue: invoice.status, toValue: `${status} — ₹${amount}`,
  });
  res.status(201).json({ invoice: decorate(updated), payment });
});

router.delete('/:id/payments/:paymentId', requireRole(...ACCOUNTS_ROLES), async (req, res) => {
  const payment = await prisma.invoicePayment.findUnique({ where: { id: req.params.paymentId } });
  if (!payment || payment.invoiceId !== req.params.id) return res.status(404).json({ error: 'Payment not found' });
  if (payment.bankTxnId) {
    return res.status(400).json({ error: 'This receipt came from a reconciled bank line — unmatch the transaction instead' });
  }
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  await prisma.invoicePayment.delete({ where: { id: payment.id } });
  const received = ROUND(Math.max(0, Number(invoice.receivedAmount || 0) - Number(payment.amount || 0)));
  const status = deriveInvoiceStatus({ ...invoice, receivedAmount: received });
  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: { receivedAmount: received, status, paidDate: status === 'Paid' ? invoice.paidDate : null },
  });
  await logAudit({ userId: req.user.id, action: 'Payment removed', entity: 'Invoice', entityId: invoice.id, fromValue: invoice.status, toValue: status });
  res.json(decorate(updated));
});

// Kept for the existing UI: settles whatever is still outstanding in one go.
router.patch('/:id/pay', requireRole(...ACCOUNTS_ROLES), async (req, res) => {
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  if (invoice.status === 'Cancelled') return res.status(400).json({ error: 'This invoice is cancelled' });
  const outstanding = invoiceOutstanding(invoice);
  if (outstanding <= 0.5) return res.status(400).json({ error: 'Already marked paid' });

  const date = req.body?.date || new Date().toISOString().slice(0, 10);
  await prisma.invoicePayment.create({
    data: {
      invoiceId: invoice.id, date, amount: outstanding,
      method: req.body?.method || 'Bank Transfer',
      notes: 'Settled in full', recordedBy: req.user.name || req.user.email || null,
    },
  });
  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: { receivedAmount: invoiceTotal(invoice), status: 'Paid', paidDate: date },
  });
  await logAudit({ userId: req.user.id, action: 'Invoice paid', entity: 'Invoice', entityId: invoice.id, fromValue: invoice.status, toValue: 'Paid' });
  res.json(decorate(updated));
});

router.patch('/:id/cancel', requireRole(...ACCOUNTS_ROLES), async (req, res) => {
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  if (invoice.status === 'Cancelled') return res.status(400).json({ error: 'Already cancelled' });
  if (Number(invoice.receivedAmount || 0) > 0) {
    return res.status(400).json({ error: 'Money has already been received against this invoice — it cannot be cancelled' });
  }
  const txn = await prisma.bankTransaction.findFirst({ where: { matchedInvoiceId: invoice.id } });
  if (txn) return res.status(400).json({ error: 'A bank transaction is matched to this invoice — unmatch it first' });

  const updated = await prisma.invoice.update({ where: { id: invoice.id }, data: { status: 'Cancelled' } });
  await logAudit({ userId: req.user.id, action: 'Invoice cancelled', entity: 'Invoice', entityId: invoice.id, fromValue: invoice.status, toValue: 'Cancelled' });
  res.json(decorate(updated));
});

module.exports = router;
