const express = require('express');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const {
  ROUND, invoiceTotal, invoiceOutstanding, deriveInvoiceStatus, dueDateFor,
  dashRange, inRange, ageBucket, daysOverdue, AGE_BUCKETS,
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

// ---------------------------------------------------------------------------
// The invoice register. One row per invoice with every column the prototype's
// invoice lens can show, the ageing chip counts, and the KPI strip — computed
// once on the server so the table, the chips and the totals never disagree.
// ---------------------------------------------------------------------------
router.get('/register', async (req, res) => {
  const where = req.user.role === 'CLIENT' ? { clientId: req.user.clientId } : {};
  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      client: true,
      candidate: true,
      requirement: { include: { recruiter: true, bde: true } },
      payments: { orderBy: { date: 'asc' } },
    },
    orderBy: { invoiceDate: 'desc' },
  });

  const range = dashRange(req.query.period);
  const inPeriod = invoices.filter((i) => range.all || inRange(i.invoiceDate, range));

  const row = (i) => {
    const status = deriveInvoiceStatus(i);
    const billing = ROUND(Number(i.amount || 0));
    const gst = ROUND(Number(i.gst || 0));
    const tds = ROUND(Number(i.tds || 0));
    const receivable = invoiceTotal(i);
    const received = ROUND(Number(i.receivedAmount || 0));
    return {
      id: i.id,
      invoiceNumber: i.invoiceNumber || i.id.slice(-6),
      invoiceDate: i.invoiceDate,
      client: i.client?.name || '—',
      clientId: i.clientId,
      // "Billing type" is how the fee was arrived at, as the client agreement states it.
      billingType: (i.feePercent ?? i.client?.agreementFeePercent) != null
        ? `% of Annual CTC · ${i.feePercent ?? i.client.agreementFeePercent}%`
        : 'Flat fee',
      clientGstin: i.client?.gst || '',
      department: i.client?.ownerDepartment || '—',
      recruiter: i.requirement?.recruiter?.name || null,
      bde: i.requirement?.bde?.name || null,
      candidates: i.candidateId ? 1 : 0,
      candidateName: i.candidate?.name || null,
      clientPayingGst: gst > 0.5,
      // Money, in the prototype's own column order: before GST, GST, after GST,
      // TDS, receivable. Receivable is amount + GST − TDS.
      billing,
      gst,
      invoiceValue: ROUND(billing + gst),
      tds,
      receivable,
      received,
      pending: ROUND(receivable - received),
      paymentCount: i.payments.length,
      paymentMethods: [...new Set(i.payments.map((p) => p.method || '—'))],
      proof: i.payments.length ? (i.payments.some((p) => !p.reference) ? `${i.payments.filter((p) => !p.reference).length} pending` : 'attached') : null,
      tdsCert: tds > 0.5 ? (i.tdsCertReceived ? 'in hand' : 'to collect') : null,
      tdsCertRef: i.tdsCertRef,
      tdsCertDate: i.tdsCertDate,
      status,
      dueDate: i.dueDate,
      age: ageBucket(i),
      daysOverdue: daysOverdue(i.dueDate),
      sentVia: i.sentVia,
      sentDate: i.sentDate,
      gstPercent: i.gstPercent ?? i.client?.gstPercent ?? null,
      tdsPercent: i.tdsPercent ?? i.client?.tdsPercent ?? null,
      payments: i.payments.map((p) => ({ id: p.id, date: p.date, amount: p.amount, method: p.method, reference: p.reference, recordedBy: p.recordedBy })),
    };
  };

  const rows = inPeriod.map(row).filter((r) => r.status !== 'Cancelled' || req.query.includeCancelled === '1');
  const live = rows.filter((r) => r.status !== 'Cancelled');
  const sum = (k) => ROUND(live.reduce((s, r) => s + r[k], 0));
  const overdue = live.filter((r) => r.pending > 0.5 && r.daysOverdue != null && r.daysOverdue > 0);

  const ageing = [...AGE_BUCKETS, 'Settled'].map((bucket) => {
    const list = rows.filter((r) => r.age === bucket);
    return { bucket, count: list.length, outstanding: ROUND(list.reduce((s, r) => s + r.pending, 0)) };
  }).filter((b) => b.bucket !== 'Settled' || b.count > 0);

  const tdsToCollect = live.filter((r) => r.tds > 0.5 && !r.tdsCert?.startsWith('in hand'));
  const tdsInHand = live.filter((r) => r.tds > 0.5 && r.tdsCert === 'in hand');

  res.json({
    period: { sel: req.query.period || null, ...range },
    rows,
    kpis: {
      candidates: live.reduce((s, r) => s + r.candidates, 0),
      clients: new Set(live.map((r) => r.client)).size,
      invoices: live.length,
      billing: sum('billing'),
      gst: sum('gst'),
      invoiceValue: sum('invoiceValue'),
      tds: sum('tds'),
      receivable: sum('receivable'),
      received: sum('received'),
      pending: sum('pending'),
      overdueCount: overdue.length,
      overdueValue: ROUND(overdue.reduce((s, r) => s + r.pending, 0)),
    },
    ageing,
    tdsCertificates: {
      toCollect: tdsToCollect.length,
      toCollectValue: ROUND(tdsToCollect.reduce((s, r) => s + r.tds, 0)),
      inHand: tdsInHand.length,
      inHandValue: ROUND(tdsInHand.reduce((s, r) => s + r.tds, 0)),
    },
    departments: [...new Set(invoices.map((i) => i.client?.ownerDepartment).filter(Boolean))].sort(),
    recruiters: [...new Set(invoices.map((i) => i.requirement?.recruiter?.name).filter(Boolean))].sort(),
    clients: [...new Set(invoices.map((i) => i.client?.name).filter(Boolean))].sort(),
  });
});

router.get('/:id', async (req, res) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: { client: true, candidate: true, requirement: true, payments: { orderBy: { date: 'asc' } } },
  });
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  if (req.user.role === 'CLIENT' && invoice.clientId !== req.user.clientId) {
    return res.status(403).json({ error: 'This record is outside your client scope' });
  }
  const synced = await syncStatus(invoice);
  res.json(decorate(synced));
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

// Form 16A against an invoice the client deducted TDS on. Until it is in hand
// the register keeps the invoice in its "TDS to collect" total.
router.patch('/:id/tds-certificate', requireRole(...ACCOUNTS_ROLES), async (req, res) => {
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  if (Number(invoice.tds || 0) <= 0.5) return res.status(400).json({ error: 'No TDS was deducted on this invoice' });
  const received = !!req.body.received;
  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      tdsCertReceived: received,
      tdsCertRef: received ? (req.body.reference || null) : null,
      tdsCertDate: received ? (req.body.date || new Date().toISOString().slice(0, 10)) : null,
    },
  });
  await logAudit({
    userId: req.user.id, action: received ? 'TDS certificate received' : 'TDS certificate cleared',
    entity: 'Invoice', entityId: invoice.id, toValue: updated.tdsCertRef || '',
  });
  res.json(decorate(updated));
});

// Record that the invoice went to the client, and how.
router.patch('/:id/sent', requireRole(...ACCOUNTS_ROLES), async (req, res) => {
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  const via = ['Email', 'WhatsApp', 'Post', 'By hand'].includes(req.body.via) ? req.body.via : 'Email';
  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: { sentVia: via, sentDate: req.body.date || new Date().toISOString().slice(0, 10) },
  });
  await logAudit({ userId: req.user.id, action: 'Invoice sent', entity: 'Invoice', entityId: invoice.id, toValue: via });
  res.json(decorate(updated));
});

module.exports = router;
