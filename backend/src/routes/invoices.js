const express = require('express');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const {
  ROUND, invoiceTotal, invoiceOutstanding, deriveInvoiceStatus, dueDateFor,
} = require('../utils/accounts');
const { nextGroupedInvoiceNumber } = require('../utils/invoiceNumber');
const { splitGst } = require('../utils/gstSplit');
const { amountInWords } = require('../utils/numberToWords');

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

router.get('/', async (req, res) => {
  const where = {};
  if (req.user.role === 'CLIENT') where.clientId = req.user.clientId;
  if (req.query.clientId) where.clientId = req.query.clientId;
  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      client: true, candidate: true, requirement: { include: { recruiter: true, bde: true } }, tdsCertificate: true,
      payments: { orderBy: { date: 'asc' } },
    },
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

// ---- Saved views (Work/Invoices filter combinations) ----
// Registered ahead of GET /:id — a literal path segment like "saved-views"
// would otherwise be swallowed by the :id wildcard, since Express matches
// routes in registration order rather than by specificity.
router.get('/saved-views', async (req, res) => {
  const views = await prisma.savedInvoiceView.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(views.map((v) => ({ ...v, filters: JSON.parse(v.filters) })));
});

router.post('/saved-views', async (req, res) => {
  const { name, filters } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name it.' });
  const view = await prisma.savedInvoiceView.create({
    data: { name: name.trim(), filters: JSON.stringify(filters || {}), createdBy: req.user.name || req.user.email || null },
  });
  res.status(201).json({ ...view, filters: JSON.parse(view.filters) });
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

// Everything the printable invoice needs: every candidate row sharing this
// invoice number, the CGST/SGST/IGST split (same-state vs inter-state, from
// the company's and the client's state), and the amount in words — computed
// here so the print view never has to duplicate the money logic.
router.get('/group/:invoiceNumber', async (req, res) => {
  const rows = await prisma.invoice.findMany({
    where: { invoiceNumber: req.params.invoiceNumber },
    include: { client: true, candidate: true, requirement: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!rows.length) return res.status(404).json({ error: 'No invoice with that number' });
  if (req.user.role === 'CLIENT' && rows[0].clientId !== req.user.clientId) {
    return res.status(403).json({ error: 'This record is outside your client scope' });
  }
  let company = await prisma.company.findFirst();
  if (!company) company = await prisma.company.create({ data: { name: 'TeamLink Consultants' } });

  const decorated = rows.map(decorate);
  const client = rows[0].client;
  const before = ROUND(decorated.reduce((s, i) => s + Number(i.amount || 0), 0));
  const gst = ROUND(decorated.reduce((s, i) => s + Number(i.gst || 0), 0));
  const tds = ROUND(decorated.reduce((s, i) => s + Number(i.tds || 0), 0));
  const after = ROUND(before + gst);
  const receivable = ROUND(after - tds);
  const received = ROUND(decorated.reduce((s, i) => s + Number(i.receivedAmount || 0), 0));
  const split = splitGst(gst, company.state, client?.state);

  res.json({
    invoiceNumber: req.params.invoiceNumber,
    invoiceDate: rows[0].invoiceDate,
    dueDate: rows[0].dueDate,
    paymentTerms: rows[0].paymentTerms,
    client,
    company,
    rows: decorated.map((i) => ({
      id: i.id,
      name: i.candidate?.name || i.candidateName || '—',
      role: i.requirement?.title || i.candidateRole || '',
      hsnSac: i.hsnSac || '998512',
      amount: Number(i.amount || 0),
      gst: Number(i.gst || 0),
      tds: Number(i.tds || 0),
      total: i.total,
      status: i.status,
    })),
    totals: { before, gst, after, tds, receivable, received, pending: ROUND(receivable - received) },
    gstSplit: split,
    amountInWords: amountInWords(after),
    netPayableInWords: amountInWords(receivable),
  });
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
      invoiceNumber: await nextGroupedInvoiceNumber({ clientId, invoiceDate }),
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

// ---- TDS certificate (Form 16A) tracking — additive to the existing Invoices screen ----
router.put('/:id/tds-certificate', requireRole(...ACCOUNTS_ROLES), async (req, res) => {
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  const { status, certNumber, certDate, quarter, amount, notes } = req.body;
  const cert = await prisma.tdsCertificate.upsert({
    where: { invoiceId: invoice.id },
    create: { invoiceId: invoice.id, status: status || 'Not received', certNumber, certDate, quarter, amount: amount != null ? Number(amount) : null, notes },
    update: { status: status || 'Not received', certNumber, certDate, quarter, amount: amount != null ? Number(amount) : null, notes },
  });
  await logAudit({ userId: req.user.id, action: `TDS certificate ${cert.status === 'Received' ? 'received' : 'not received'}`, entity: 'Invoice', entityId: invoice.id, toValue: cert.status });
  res.json(cert);
});

router.delete('/saved-views/:id', async (req, res) => {
  await prisma.savedInvoiceView.delete({ where: { id: req.params.id } }).catch(() => {});
  res.json({ ok: true });
});

module.exports = router;
