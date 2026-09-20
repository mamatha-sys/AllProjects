const express = require('express');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');
const { ROUND, invoiceOutstanding, deriveInvoiceStatus } = require('../utils/accounts');
const { resolvePeriod, inRange } = require('../utils/period');

const router = express.Router();
router.use(requireAuth);

// A "join" here maps to one Invoice (this app raises exactly one invoice per
// candidate placement) — the reference app's separate joining register isn't
// a concept this schema has, so Invoice stands in for it throughout.
async function scopedInvoices(req) {
  const invoices = await prisma.invoice.findMany({
    include: {
      client: true,
      candidate: true,
      requirement: { include: { recruiter: true, bde: true } },
    },
  });
  const { mode, fy, q, h, from: cf, to: ct } = req.query;
  const period = resolvePeriod({ mode: mode || 'ALL', fy, q, h, from: cf, to: ct });

  return invoices.filter((i) => {
    if (period.from || period.to) {
      if (!inRange(i.invoiceDate, period.from, period.to)) return false;
    }
    if (req.query.client && i.client?.name !== req.query.client) return false;
    if (req.query.department && i.requirement?.department !== req.query.department) return false;
    if (req.query.section && i.requirement?.section !== req.query.section) return false;
    if (req.query.role) {
      const has = req.query.role === 'RECRUITER' ? i.requirement?.recruiterId : req.query.role === 'BDE' ? i.requirement?.bdeId : true;
      if (!has) return false;
    }
    if (req.query.recruiter) {
      const names = [i.requirement?.recruiter?.name, i.requirement?.bde?.name];
      if (!names.includes(req.query.recruiter)) return false;
    }
    const status = deriveInvoiceStatus(i);
    if (req.query.status && status !== req.query.status) return false;
    if (req.query.q) {
      const needle = req.query.q.toLowerCase();
      const hay = [i.candidate?.name, i.client?.name, i.candidate?.phone, i.invoiceNumber, i.requirement?.recruiter?.name, i.requirement?.bde?.name, i.requirement?.department]
        .filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  }).map((i) => ({ ...i, status: deriveInvoiceStatus(i), outstanding: invoiceOutstanding(i) }));
}

function agg(rows) {
  const t = { joins: rows.length, billing: 0, gst: 0, invoiceValue: 0, tds: 0, receivable: 0, received: 0, pending: 0, profit: 0 };
  rows.forEach((i) => {
    t.billing += Number(i.amount || 0);
    t.gst += Number(i.gst || 0);
    t.invoiceValue += Number(i.amount || 0) + Number(i.gst || 0);
    t.tds += Number(i.tds || 0);
    const receivable = Number(i.amount || 0) + Number(i.gst || 0) - Number(i.tds || 0);
    t.receivable += receivable;
    t.received += Number(i.receivedAmount || 0);
    t.pending += i.outstanding;
    t.profit += Number(i.amount || 0) - Number(i.tds || 0);
  });
  Object.keys(t).forEach((k) => { if (k !== 'joins') t[k] = ROUND(t[k]); });
  return t;
}

// ---- Filter option lists (period-independent, for the filter bar's selects) ----
router.get('/filters', async (req, res) => {
  const [clients, requirements, users] = await Promise.all([
    prisma.client.findMany({ select: { name: true } }),
    prisma.requirement.findMany({ select: { department: true, section: true } }),
    prisma.user.findMany({ where: { role: { in: ['RECRUITER', 'BDE'] } }, select: { name: true, role: true } }),
  ]);
  res.json({
    clients: [...new Set(clients.map((c) => c.name))].sort(),
    departments: [...new Set(requirements.map((r) => r.department).filter(Boolean))].sort(),
    sections: [...new Set(requirements.map((r) => r.section).filter(Boolean))].sort(),
    roles: ['RECRUITER', 'BDE'],
    employees: users.map((u) => ({ name: u.name, role: u.role })),
  });
});

router.get('/', async (req, res) => {
  const rows = await scopedInvoices(req);
  const t = agg(rows);

  const expenses = await prisma.officeExpense.findMany();
  const { mode, fy, q, h, from: cf, to: ct } = req.query;
  const period = resolvePeriod({ mode: mode || 'ALL', fy, q, h, from: cf, to: ct });
  const expInRange = expenses.filter((e) => !period.from || !period.to || inRange(e.expenseDate, period.from, period.to));
  const officeExpenseTotal = ROUND(expInRange.reduce((s, e) => s + Number(e.monthlyAmount || 0), 0));

  const overdueInvoices = rows.filter((i) => i.status === 'Overdue').length;

  // GST position — what clients pay us against what we pay vendors.
  const gstOut = t.gst;
  const gstOutReceived = ROUND(rows.reduce((s, i) => {
    const receivable = Number(i.amount || 0) + Number(i.gst || 0) - Number(i.tds || 0);
    const share = receivable > 0 ? Number(i.gst || 0) * (Number(i.receivedAmount || 0) / receivable) : 0;
    return s + share;
  }, 0));
  const gstPendingOnReceivable = ROUND(gstOut - gstOutReceived);
  const gstInp = ROUND(expInRange.reduce((s, e) => s + Number(e.gstAmount || 0), 0));
  const gstNet = ROUND(gstOut - gstInp);

  // Client-by-client pending/received.
  const byClient = new Map();
  rows.forEach((i) => {
    const key = i.client?.name || '—';
    const cur = byClient.get(key) || { client: key, department: i.requirement?.department || '—', before: 0, after: 0, receivable: 0, received: 0, pending: 0, lastPayment: null };
    cur.before += Number(i.amount || 0);
    cur.after += Number(i.amount || 0) + Number(i.gst || 0);
    const receivable = Number(i.amount || 0) + Number(i.gst || 0) - Number(i.tds || 0);
    cur.receivable += receivable;
    cur.received += Number(i.receivedAmount || 0);
    cur.pending += i.outstanding;
    if (i.paidDate && (!cur.lastPayment || i.paidDate > cur.lastPayment)) cur.lastPayment = i.paidDate;
    byClient.set(key, cur);
  });
  const clientMoney = [...byClient.values()].map((c) => ({
    ...c, before: ROUND(c.before), after: ROUND(c.after), receivable: ROUND(c.receivable), received: ROUND(c.received), pending: ROUND(c.pending),
    collectedPct: c.receivable > 0 ? Math.round((c.received / c.receivable) * 100) : 0,
  })).sort((a, b) => b.pending - a.pending);

  // Office spend by category, in period.
  const byCat = new Map();
  expInRange.forEach((e) => {
    const cur = byCat.get(e.category) || { category: e.category, net: 0, count: 0 };
    cur.net += Number(e.monthlyAmount || 0);
    cur.count += 1;
    byCat.set(e.category, cur);
  });
  const spendByCategory = [...byCat.values()].map((c) => ({ ...c, net: ROUND(c.net), pct: officeExpenseTotal > 0 ? Math.round((c.net / officeExpenseTotal) * 100) : 0 })).sort((a, b) => b.net - a.net);

  res.json({
    period,
    kpis: {
      totalCandidates: t.joins,
      dropped: 0,
      incomeBeforeGst: t.billing,
      incomeAfterGst: t.invoiceValue,
      gst: t.gst,
      tds: t.tds,
      netProfit: t.profit,
      received: t.received,
      receivable: t.receivable,
      pending: t.pending,
      overdueInvoices,
      officeExpenses: officeExpenseTotal,
      profitAfterExpenses: ROUND(t.profit - officeExpenseTotal),
    },
    gstPosition: {
      out: gstOut, outReceived: gstOutReceived, pendingGst: gstPendingOnReceivable, inp: gstInp, net: gstNet,
    },
    clientMoney,
    spendByCategory,
    officeExpenseTotal,
  });
});

// Recruiter drill-down — candidates, clients, month-by-month for one person.
router.get('/recruiter/:name', async (req, res) => {
  const rows = await scopedInvoices(req);
  const mine = rows.filter((i) => [i.requirement?.recruiter?.name, i.requirement?.bde?.name].includes(req.params.name));
  const t = agg(mine);

  const byClient = new Map();
  mine.forEach((i) => {
    const key = i.client?.name || '—';
    const cur = byClient.get(key) || { client: key, joined: 0, fee: 0, gst: 0, receivable: 0, received: 0, pending: 0, profit: 0 };
    cur.joined += 1;
    cur.fee += Number(i.amount || 0);
    cur.gst += Number(i.gst || 0);
    const receivable = Number(i.amount || 0) + Number(i.gst || 0) - Number(i.tds || 0);
    cur.receivable += receivable;
    cur.received += Number(i.receivedAmount || 0);
    cur.pending += i.outstanding;
    cur.profit += Number(i.amount || 0) - Number(i.tds || 0);
    byClient.set(key, cur);
  });

  const byMonth = new Map();
  mine.forEach((i) => {
    const key = (i.invoiceDate || '').slice(0, 7);
    const cur = byMonth.get(key) || { month: key, count: 0, fee: 0, profit: 0 };
    cur.count += 1;
    cur.fee += Number(i.amount || 0);
    cur.profit += Number(i.amount || 0) - Number(i.tds || 0);
    byMonth.set(key, cur);
  });

  res.json({
    name: req.params.name,
    totals: t,
    clients: [...byClient.values()].map((c) => ({ ...c, fee: ROUND(c.fee), gst: ROUND(c.gst), receivable: ROUND(c.receivable), received: ROUND(c.received), pending: ROUND(c.pending), profit: ROUND(c.profit) })).sort((a, b) => b.joined - a.joined),
    months: [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)),
    candidates: mine.map((i) => ({
      id: i.id, candidateName: i.candidate?.name, clientName: i.client?.name,
      requirementTitle: i.requirement?.title, joinedDate: i.invoiceDate, invoiceNumber: i.invoiceNumber,
      before: Number(i.amount || 0), receivable: Number(i.amount || 0) + Number(i.gst || 0) - Number(i.tds || 0),
      pending: i.outstanding, status: i.status,
    })),
  });
});

module.exports = router;
