const express = require('express');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const {
  ROUND, dashRange, inRange, monthLabel, invoiceTotal, invoiceOutstanding, deriveInvoiceStatus,
} = require('../utils/accounts');

const router = express.Router();
router.use(requireAuth);

const ACCOUNTS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'];
router.use(requireRole(...ACCOUNTS_ROLES));

// An expense row's net cost to the business is the amount excluding the GST
// paid on it — that GST is input credit, not spend.
// How many months a bill actually covers — a yearly payment is spread across
// the twelve months it buys, which is the "Amortised" column in the summary.
const FREQ_MONTHS = { Monthly: 1, Quarterly: 3, 'Half-yearly': 6, Yearly: 12, 'One-time': 1 };
const EXP_FREQ = ['Monthly', 'Quarterly', 'Half-yearly', 'Yearly', 'One-time'];
const EXP_MODES = ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card'];
// The application calls an unpaid bill "Pending"; the column has always stored
// "Unpaid", so the label is translated on the way out and on the way in rather
// than rewriting rows.
const PENDING_LABEL = (paidStatus) => (paidStatus === 'Unpaid' ? 'Pending' : 'Paid');
const PENDING_STORE = (label) => ((label === 'Pending' || label === 'Unpaid') ? 'Unpaid' : 'Paid');

function monthsCoveredOf(e) {
  const n = Number(e.monthsCovered);
  if (n > 0) return Math.round(n);
  return FREQ_MONTHS[e.frequency] || 1;
}

function decorate(e) {
  const gross = ROUND(Number(e.monthlyAmount || 0));
  const gst = ROUND(Number(e.gstAmount || 0));
  const tds = ROUND(Number(e.tdsAmount || 0));
  const base = ROUND(gross - gst);
  const months = monthsCoveredOf(e);
  return {
    ...e,
    gross,
    gst,
    tds,
    // "Net" is the cost to the business: the bill without the GST (input
    // credit) and without the TDS we held back and pay on the vendor's behalf.
    base,
    net: ROUND(base - tds),
    monthsCovered: months,
    perMonth: ROUND(ROUND(base - tds) / months),
    pending: e.paidStatus === 'Unpaid',
    // "Total" is the bill as the vendor wrote it: base + GST. "Paid" is what
    // actually left the bank (base + GST − TDS, once settled).
    total: ROUND(base + gst),
    paidValue: e.paidStatus === 'Unpaid' ? 0 : ROUND(base + gst - tds),
    pendingValue: e.paidStatus === 'Unpaid' ? ROUND(base + gst - tds) : 0,
    statusLabel: PENDING_LABEL(e.paidStatus),
    month: (e.expenseDate || '').slice(0, 7) || null,
  };
}

// A bill's net cost spread over the months it covers, starting at its own month.
function amortisedFor(rows, mk) {
  let total = 0;
  rows.forEach((r) => {
    if (!r.month) return;
    const start = new Date(`${r.month}-01`);
    for (let i = 0; i < r.monthsCovered; i += 1) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (key === mk) total += r.perMonth;
    }
  });
  return ROUND(total);
}

function aggExpenses(list) {
  return {
    n: list.length,
    base: ROUND(list.reduce((s, r) => s + r.base, 0)),
    gst: ROUND(list.reduce((s, r) => s + r.gst, 0)),
    tds: ROUND(list.reduce((s, r) => s + r.tds, 0)),
    net: ROUND(list.reduce((s, r) => s + r.net, 0)),
    gross: ROUND(list.reduce((s, r) => s + r.gross, 0)),
    paid: ROUND(list.filter((r) => !r.pending).reduce((s, r) => s + r.net, 0)),
    pendingValue: ROUND(list.filter((r) => r.pending).reduce((s, r) => s + r.net, 0)),
  };
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

// ---------------------------------------------------------------------------
// Office & Accounts — the four tabs, each on its own endpoint so the numbers
// on a tab are computed once rather than re-derived in the browser.
// ---------------------------------------------------------------------------

async function officeScope(query) {
  const range = dashRange(query.period);
  const [expenses, invoices] = await Promise.all([
    prisma.officeExpense.findMany({ orderBy: [{ expenseDate: 'desc' }, { category: 'asc' }] }),
    prisma.invoice.findMany({ include: { client: true } }),
  ]);
  const all = expenses.map(decorate);
  const live = invoices.filter((i) => deriveInvoiceStatus(i) !== 'Cancelled');
  return {
    range,
    all,
    inPeriod: all.filter((r) => range.all || inRange(r.expenseDate, range)),
    invoices: live,
    invoicesInPeriod: live.filter((i) => range.all || inRange(i.invoiceDate, range)),
  };
}

// "Bills & expenses" — the KPI strip and the filter option lists.
router.get('/bills', async (req, res) => {
  const { range, all, inPeriod, invoicesInPeriod } = await officeScope(req.query);
  let list = inPeriod;
  if (req.query.category && req.query.category !== 'All') list = list.filter((r) => r.category === req.query.category);
  if (req.query.vendor && req.query.vendor !== 'All') list = list.filter((r) => (r.vendor || '—') === req.query.vendor);
  if (req.query.status && req.query.status !== 'All') list = list.filter((r) => r.statusLabel === req.query.status);
  if (req.query.gst && req.query.gst !== 'All') list = list.filter((r) => (req.query.gst === 'Yes' ? r.gst > 0.5 : r.gst <= 0.5));
  const q = String(req.query.q || '').trim().toLowerCase();
  if (q) list = list.filter((r) => [r.category, r.vendor, r.description, r.notes, r.location].join(' ').toLowerCase().includes(q));

  const t = aggExpenses(list);
  const periodTotals = aggExpenses(inPeriod);
  // GST payable and profit always compare the whole period — a category filter
  // must not make it look as though we paid more GST than we charged.
  const gstOut = ROUND(invoicesInPeriod.reduce((s, i) => s + Number(i.gst || 0), 0));
  const gstOutReceived = ROUND(invoicesInPeriod.reduce((s, i) => {
    const total = invoiceTotal(i);
    const share = total > 0 ? Number(i.receivedAmount || 0) / total : 0;
    return s + Number(i.gst || 0) * Math.min(1, share);
  }, 0));
  const income = ROUND(invoicesInPeriod.reduce((s, i) => s + Number(i.amount || 0), 0));
  const cashIn = ROUND(invoicesInPeriod.reduce((s, i) => s + Number(i.receivedAmount || 0), 0));

  res.json({
    period: { sel: req.query.period || null, ...range },
    rows: list,
    totals: t,
    periodTotals,
    filtered: list.length !== inPeriod.length,
    gst: {
      out: gstOut,
      outReceived: gstOutReceived,
      pending: ROUND(gstOut - gstOutReceived),
      input: periodTotals.gst,
      net: ROUND(gstOut - periodTotals.gst),
      unclaimable: ROUND(inPeriod.filter((r) => r.gst > 0.5 && String(r.vendorGstin || '').trim().length < 10).reduce((s, r) => s + r.gst, 0)),
      unclaimableCount: inPeriod.filter((r) => r.gst > 0.5 && String(r.vendorGstin || '').trim().length < 10).length,
    },
    profit: { income, spend: periodTotals.net, pl: ROUND(income - periodTotals.net) },
    cashProfit: { cashIn, paid: periodTotals.paid, pl: ROUND(cashIn - periodTotals.paid) },
    outsidePeriod: all.length - inPeriod.length,
    options: {
      categories: [...new Set(all.map((r) => r.category).filter(Boolean))].sort(),
      vendors: [...new Set(all.map((r) => r.vendor || '—'))].sort(),
      statuses: ['All', 'Paid', 'Pending'],
      gst: ['All', 'Yes', 'No'],
      frequencies: EXP_FREQ,
      modes: EXP_MODES,
      groupBy: [['month', 'Month'], ['vendor', 'Paid to'], ['category', 'Category'], ['status', 'Paid / pending'], ['none', 'No grouping — every bill']],
    },
  });
});

// "GST position" — what we charged clients against what we paid vendors, the
// way GSTR-3B reads it: month by month, output against input.
router.get('/gst', async (req, res) => {
  const { range, inPeriod, invoicesInPeriod } = await officeScope(req.query);
  const months = [...new Set([
    ...invoicesInPeriod.map((i) => String(i.invoiceDate || '').slice(0, 7)),
    ...inPeriod.map((r) => r.month),
  ].filter(Boolean))].sort();

  const rows = months.map((mk) => {
    const inv = invoicesInPeriod.filter((i) => String(i.invoiceDate || '').slice(0, 7) === mk);
    const exp = inPeriod.filter((r) => r.month === mk);
    const output = ROUND(inv.reduce((s, i) => s + Number(i.gst || 0), 0));
    const input = ROUND(exp.reduce((s, r) => s + r.gst, 0));
    return {
      month: mk,
      label: monthLabel(mk),
      taxableOutput: ROUND(inv.reduce((s, i) => s + Number(i.amount || 0), 0)),
      output,
      taxableInput: ROUND(exp.reduce((s, r) => s + r.base, 0)),
      input,
      net: ROUND(output - input),
      invoices: inv.length,
      bills: exp.length,
    };
  });
  const output = ROUND(rows.reduce((s, r) => s + r.output, 0));
  const input = ROUND(rows.reduce((s, r) => s + r.input, 0));
  const noGstin = inPeriod.filter((r) => r.gst > 0.5 && String(r.vendorGstin || '').trim().length < 10);
  res.json({
    period: { sel: req.query.period || null, ...range },
    rows,
    totals: { output, input, net: ROUND(output - input) },
    unclaimable: { count: noGstin.length, value: ROUND(noGstin.reduce((s, r) => s + r.gst, 0)), rows: noGstin },
  });
});

// "Profit & Loss" — on accrual (work done, bills raised) or on cash (money in
// and out of the bank), month by month with a running total.
router.get('/pnl', async (req, res) => {
  const basis = req.query.basis === 'cash' ? 'cash' : 'accrual';
  const { range, inPeriod, invoicesInPeriod } = await officeScope(req.query);
  const months = [...new Set([
    ...invoicesInPeriod.map((i) => String(i.invoiceDate || '').slice(0, 7)),
    ...inPeriod.map((r) => r.month),
  ].filter(Boolean))].sort();

  let cum = 0;
  const rows = months.map((mk) => {
    const inv = invoicesInPeriod.filter((i) => String(i.invoiceDate || '').slice(0, 7) === mk);
    const exp = inPeriod.filter((r) => r.month === mk);
    const income = basis === 'accrual'
      ? ROUND(inv.reduce((s, i) => s + Number(i.amount || 0), 0))
      : ROUND(inv.reduce((s, i) => s + Number(i.receivedAmount || 0), 0));
    const spend = basis === 'accrual'
      ? ROUND(exp.reduce((s, r) => s + r.net, 0))
      : ROUND(exp.filter((r) => !r.pending).reduce((s, r) => s + r.net, 0));
    const pl = ROUND(income - spend);
    cum = ROUND(cum + pl);
    return {
      month: mk, label: monthLabel(mk), joins: inv.length, entries: exp.length,
      income, spend, pl, cum, noExp: exp.length === 0, noInc: inv.length === 0,
    };
  });

  const total = (list, k) => ROUND(list.reduce((s, r) => s + r[k], 0));
  const accrualIncome = ROUND(invoicesInPeriod.reduce((s, i) => s + Number(i.amount || 0), 0));
  const cashIncome = ROUND(invoicesInPeriod.reduce((s, i) => s + Number(i.receivedAmount || 0), 0));
  const accrualSpend = ROUND(inPeriod.reduce((s, r) => s + r.net, 0));
  const cashSpend = ROUND(inPeriod.filter((r) => !r.pending).reduce((s, r) => s + r.net, 0));

  res.json({
    period: { sel: req.query.period || null, ...range },
    basis,
    rows,
    totals: {
      joins: total(rows, 'joins'), entries: total(rows, 'entries'),
      income: total(rows, 'income'), spend: total(rows, 'spend'), pl: total(rows, 'pl'),
    },
    accrual: { income: accrualIncome, spend: accrualSpend, pl: ROUND(accrualIncome - accrualSpend) },
    cash: { income: cashIncome, spend: cashSpend, pl: ROUND(cashIncome - cashSpend) },
    receivable: ROUND(invoicesInPeriod.reduce((s, i) => s + invoiceOutstanding(i), 0)),
  });
});

// "Category & month summary" — where the money goes, by category and by month,
// on a cash basis against the amortised run-rate.
router.get('/summary-tabs', async (req, res) => {
  const { range, all, inPeriod } = await officeScope(req.query);
  const t = aggExpenses(inPeriod);

  const cats = new Map();
  inPeriod.forEach((r) => {
    const k = r.category || '—';
    const cur = cats.get(k) || { key: k, n: 0, base: 0, gst: 0, tds: 0, net: 0 };
    cur.n += 1; cur.base = ROUND(cur.base + r.base); cur.gst = ROUND(cur.gst + r.gst);
    cur.tds = ROUND(cur.tds + r.tds); cur.net = ROUND(cur.net + r.net);
    cats.set(k, cur);
  });

  const months = [...new Set(all.map((r) => r.month).filter(Boolean))].sort();
  const monthRows = months.map((mk) => {
    const rs = all.filter((r) => r.month === mk);
    const a = aggExpenses(rs);
    return {
      month: mk, label: monthLabel(mk), n: a.n,
      cash: ROUND(rs.filter((r) => !r.pending).reduce((s, r) => s + r.net, 0)),
      amortised: amortisedFor(all, mk),
      gst: a.gst, tds: a.tds, pending: a.pendingValue,
    };
  });

  res.json({
    period: { sel: req.query.period || null, ...range },
    totals: t,
    gstEntries: inPeriod.filter((r) => r.gst > 0.5).length,
    tdsEntries: inPeriod.filter((r) => r.tds > 0.5).length,
    byCategory: [...cats.values()].sort((a, b) => b.net - a.net),
    byMonth: monthRows,
  });
});

router.post('/', async (req, res) => {
  const { category, location, monthlyAmount, vendor, expenseDate, gstAmount, paidStatus, recurring, notes } = req.body;
  if (!category || monthlyAmount == null) return res.status(400).json({ error: 'category and monthlyAmount are required' });
  const gross = Number(monthlyAmount);
  const gst = Number(gstAmount) || 0;
  if (!(gross > 0)) return res.status(400).json({ error: 'monthlyAmount must be a positive number' });
  if (gst < 0 || gst > gross) return res.status(400).json({ error: 'GST cannot be negative or larger than the amount' });
  const tds = Number(req.body.tdsAmount) || 0;
  if (tds < 0 || tds > gross - gst) return res.status(400).json({ error: 'TDS cannot be negative or larger than the bill before GST' });

  const expense = await prisma.officeExpense.create({
    data: {
      category,
      location: location || null,
      monthlyAmount: gross,
      vendor: vendor || null,
      expenseDate: expenseDate || new Date().toISOString().slice(0, 10),
      gstAmount: gst,
      paidStatus: PENDING_STORE(paidStatus),
      recurring: recurring === undefined ? true : !!recurring,
      notes: notes || null,
      tdsAmount: tds,
      frequency: EXP_FREQ.includes(req.body.frequency) ? req.body.frequency : 'Monthly',
      monthsCovered: Number(req.body.monthsCovered) > 0 ? Math.round(Number(req.body.monthsCovered)) : null,
      vendorGstin: req.body.vendorGstin || null,
      paymentMode: EXP_MODES.includes(req.body.paymentMode) ? req.body.paymentMode : 'Bank Transfer',
      description: req.body.description || null,
      billNumber: req.body.billNumber || null,
    },
  });
  await logAudit({ userId: req.user.id, action: 'Office expense added', entity: 'OfficeExpense', entityId: expense.id, toValue: `${category} — ₹${gross}` });
  res.status(201).json(decorate(expense));
});

router.patch('/:id', async (req, res) => {
  const existing = await prisma.officeExpense.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Expense not found' });
  const data = {};
  ['category', 'location', 'vendor', 'expenseDate', 'notes', 'vendorGstin', 'description', 'billNumber'].forEach((k) => { if (req.body[k] !== undefined) data[k] = req.body[k] || null; });
  if (req.body.monthlyAmount !== undefined) data.monthlyAmount = Number(req.body.monthlyAmount);
  if (req.body.gstAmount !== undefined) data.gstAmount = Number(req.body.gstAmount) || 0;
  if (req.body.tdsAmount !== undefined) data.tdsAmount = Number(req.body.tdsAmount) || 0;
  if (req.body.frequency !== undefined) data.frequency = EXP_FREQ.includes(req.body.frequency) ? req.body.frequency : 'Monthly';
  if (req.body.monthsCovered !== undefined) data.monthsCovered = Number(req.body.monthsCovered) > 0 ? Math.round(Number(req.body.monthsCovered)) : null;
  if (req.body.paymentMode !== undefined) data.paymentMode = EXP_MODES.includes(req.body.paymentMode) ? req.body.paymentMode : 'Bank Transfer';
  if (req.body.paidStatus !== undefined) data.paidStatus = PENDING_STORE(req.body.paidStatus);
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
