const express = require('express');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');
const {
  ROUND, invoiceTotal, invoiceOutstanding, deriveInvoiceStatus, txnState,
} = require('../utils/accounts');

const router = express.Router();
router.use(requireAuth);

// The Accountant's own view: receivables, what needs chasing and what is still
// sitting unreconciled on the bank statement.
router.get('/accounts', async (req, res) => {
  const [invoices, transactions] = await Promise.all([
    prisma.invoice.findMany({ include: { client: true } }),
    prisma.bankTransaction.findMany({ orderBy: { date: 'desc' } }),
  ]);
  const rows = invoices.map((i) => ({
    id: i.id,
    invoiceNumber: i.invoiceNumber,
    client: i.client?.name || '—',
    invoiceDate: i.invoiceDate,
    dueDate: i.dueDate,
    status: deriveInvoiceStatus(i),
    total: invoiceTotal(i),
    outstanding: invoiceOutstanding(i),
  }));
  const needsAttention = rows
    .filter((i) => ['Overdue', 'Partially Paid', 'Pending'].includes(i.status))
    .sort((a, b) => String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999')))
    .slice(0, 8);
  const unreconciled = transactions.filter((t) => ['Unmatched', 'Matched'].includes(txnState(t)));

  res.json({
    invoices: rows.length,
    pending: rows.filter((i) => i.status === 'Pending').length,
    partiallyPaid: rows.filter((i) => i.status === 'Partially Paid').length,
    overdue: rows.filter((i) => i.status === 'Overdue').length,
    paid: rows.filter((i) => i.status === 'Paid').length,
    unreconciled: unreconciled.length,
    outstanding: ROUND(rows.filter((i) => i.status !== 'Cancelled').reduce((s, i) => s + i.outstanding, 0)),
    received: ROUND(invoices.reduce((s, i) => s + Number(i.receivedAmount || 0), 0)),
    needsAttention,
    unreconciledTransactions: unreconciled.slice(0, 8).map((t) => ({
      id: t.id, date: t.date, description: t.description, type: t.type, amount: t.amount, state: txnState(t),
    })),
  });
});

router.get('/', async (req, res) => {
  const [
    openRequirements, recruiterReview, withBde, clientReview, interviewsScheduled, hired, auditLog,
    activeEmployees, pendingLeave, invoicesPending, invoicesOverdue,
  ] = await Promise.all([
    prisma.requirement.count({ where: { status: 'OPEN' } }),
    prisma.application.count({ where: { stage: 'RECRUITER_REVIEW' } }),
    prisma.application.count({ where: { stage: 'WITH_BDE' } }),
    prisma.application.count({ where: { stage: { in: ['SHARED_WITH_CLIENT', 'CLIENT_REVIEW'] } } }),
    prisma.application.count({ where: { stage: 'INTERVIEW_SCHEDULED' } }),
    prisma.application.count({ where: { stage: { in: ['JOINED', 'HIRED'] } } }),
    prisma.auditLog.findMany({ take: 8, orderBy: { createdAt: 'desc' }, include: { user: true } }),
    prisma.employee.count({ where: { employmentStatus: 'Active' } }),
    prisma.leaveRequest.count({ where: { status: 'Pending' } }),
    prisma.invoice.count({ where: { status: 'Pending' } }),
    prisma.invoice.count({ where: { status: 'Overdue' } }),
  ]);

  res.json({
    openRequirements,
    recruiterReview,
    withBde,
    clientReview,
    interviewsScheduled,
    hired,
    activeEmployees,
    pendingLeave,
    invoicesPending,
    invoicesOverdue,
    recentActivity: auditLog.map((a) => ({
      date: a.createdAt,
      user: a.user ? a.user.name : 'System',
      action: a.action,
      entity: a.entity,
    })),
  });
});

module.exports = router;
