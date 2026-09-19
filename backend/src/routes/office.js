const express = require('express');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { ROUND } = require('../utils/accounts');

const router = express.Router();
router.use(requireAuth);

const ACCOUNTS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'];
router.use(requireRole(...ACCOUNTS_ROLES));

// An expense row's net cost to the business is the amount excluding the GST
// paid on it — that GST is input credit, not spend.
function decorate(e) {
  const gross = ROUND(Number(e.monthlyAmount || 0));
  const gst = ROUND(Number(e.gstAmount || 0));
  return { ...e, gross, gst, net: ROUND(gross - gst), month: (e.expenseDate || '').slice(0, 7) || null };
}

router.get('/', async (req, res) => {
  const where = {};
  if (req.query.category) where.category = req.query.category;
  if (req.query.location) where.location = req.query.location;
  const expenses = await prisma.officeExpense.findMany({ where, orderBy: [{ expenseDate: 'desc' }, { category: 'asc' }] });
  let rows = expenses.map(decorate);
  if (req.query.month) rows = rows.filter((r) => r.month === req.query.month);
  res.json(rows);
});

// Office & Business: the category and month summary, the profit & loss and the
// GST position — GST charged to clients against GST paid to vendors.
router.get('/summary', async (req, res) => {
  const [expenses, invoices] = await Promise.all([
    prisma.officeExpense.findMany(),
    prisma.invoice.findMany({ where: { status: { not: 'Cancelled' } } }),
  ]);
  const rows = expenses.map(decorate);
  const month = req.query.month || null;
  const inScope = month ? rows.filter((r) => r.month === month) : rows;
  const invoicesInScope = month ? invoices.filter((i) => String(i.invoiceDate).slice(0, 7) === month) : invoices;

  const group = (rowsIn, keyOf) => {
    const map = new Map();
    rowsIn.forEach((r) => {
      const k = keyOf(r) || '—';
      const cur = map.get(k) || { key: k, count: 0, gross: 0, gst: 0, net: 0 };
      cur.count += 1;
      cur.gross = ROUND(cur.gross + r.gross);
      cur.gst = ROUND(cur.gst + r.gst);
      cur.net = ROUND(cur.net + r.net);
      map.set(k, cur);
    });
    return [...map.values()].sort((a, b) => b.net - a.net);
  };

  // Income is taken net of GST: GST charged is collected for the government,
  // not earned, and TDS is deducted but still counts as income billed.
  const incomeNet = ROUND(invoicesInScope.reduce((s, i) => s + Number(i.amount || 0), 0));
  const gstCharged = ROUND(invoicesInScope.reduce((s, i) => s + Number(i.gst || 0), 0));
  const gstPaid = ROUND(inScope.reduce((s, r) => s + r.gst, 0));
  const spendNet = ROUND(inScope.reduce((s, r) => s + r.net, 0));

  res.json({
    month,
    byCategory: group(inScope, (r) => r.category),
    byMonth: group(rows.filter((r) => r.month), (r) => r.month).sort((a, b) => String(a.key).localeCompare(String(b.key))),
    byLocation: group(inScope, (r) => r.location || 'All'),
    profitAndLoss: {
      incomeNet,
      spendNet,
      profit: ROUND(incomeNet - spendNet),
      marginPct: incomeNet > 0 ? ROUND(((incomeNet - spendNet) / incomeNet) * 100) : 0,
    },
    gstPosition: {
      charged: gstCharged,
      paid: gstPaid,
      // Positive means GST is owed to the government; negative is credit carried.
      payable: ROUND(gstCharged - gstPaid),
    },
    unpaidCount: inScope.filter((r) => r.paidStatus === 'Unpaid').length,
    unpaidValue: ROUND(inScope.filter((r) => r.paidStatus === 'Unpaid').reduce((s, r) => s + r.gross, 0)),
  });
});

router.post('/', async (req, res) => {
  const { category, location, monthlyAmount, vendor, expenseDate, gstAmount, paidStatus, recurring, notes } = req.body;
  if (!category || monthlyAmount == null) return res.status(400).json({ error: 'category and monthlyAmount are required' });
  const gross = Number(monthlyAmount);
  const gst = Number(gstAmount) || 0;
  if (!(gross > 0)) return res.status(400).json({ error: 'monthlyAmount must be a positive number' });
  if (gst < 0 || gst > gross) return res.status(400).json({ error: 'GST cannot be negative or larger than the amount' });

  const expense = await prisma.officeExpense.create({
    data: {
      category,
      location: location || null,
      monthlyAmount: gross,
      vendor: vendor || null,
      expenseDate: expenseDate || new Date().toISOString().slice(0, 10),
      gstAmount: gst,
      paidStatus: paidStatus === 'Unpaid' ? 'Unpaid' : 'Paid',
      recurring: recurring === undefined ? true : !!recurring,
      notes: notes || null,
    },
  });
  await logAudit({ userId: req.user.id, action: 'Office expense added', entity: 'OfficeExpense', entityId: expense.id, toValue: `${category} — ₹${gross}` });
  res.status(201).json(decorate(expense));
});

router.patch('/:id', async (req, res) => {
  const existing = await prisma.officeExpense.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Expense not found' });
  const data = {};
  ['category', 'location', 'vendor', 'expenseDate', 'notes'].forEach((k) => { if (req.body[k] !== undefined) data[k] = req.body[k] || null; });
  if (req.body.monthlyAmount !== undefined) data.monthlyAmount = Number(req.body.monthlyAmount);
  if (req.body.gstAmount !== undefined) data.gstAmount = Number(req.body.gstAmount) || 0;
  if (req.body.paidStatus !== undefined) data.paidStatus = req.body.paidStatus === 'Unpaid' ? 'Unpaid' : 'Paid';
  if (req.body.recurring !== undefined) data.recurring = !!req.body.recurring;

  const gross = data.monthlyAmount ?? existing.monthlyAmount;
  const gst = data.gstAmount ?? existing.gstAmount;
  if (!(gross > 0)) return res.status(400).json({ error: 'monthlyAmount must be a positive number' });
  if (gst < 0 || gst > gross) return res.status(400).json({ error: 'GST cannot be negative or larger than the amount' });

  const expense = await prisma.officeExpense.update({ where: { id: existing.id }, data });
  await logAudit({ userId: req.user.id, action: 'Office expense updated', entity: 'OfficeExpense', entityId: expense.id });
  res.json(decorate(expense));
});

router.delete('/:id', async (req, res) => {
  const existing = await prisma.officeExpense.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Expense not found' });
  await prisma.officeExpense.delete({ where: { id: existing.id } });
  await logAudit({ userId: req.user.id, action: 'Office expense removed', entity: 'OfficeExpense', entityId: existing.id, fromValue: `${existing.category} — ₹${existing.monthlyAmount}` });
  res.json({ ok: true });
});

module.exports = router;
