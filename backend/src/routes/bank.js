const express = require('express');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();
router.use(requireAuth);

const ACCOUNTS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'];
router.use(requireRole(...ACCOUNTS_ROLES));

router.get('/', async (req, res) => {
  const transactions = await prisma.bankTransaction.findMany({ orderBy: { date: 'desc' } });
  res.json(transactions);
});

// Matches an unmatched transaction to the closest pending invoice by amount,
// or marks it manually reconciled if nothing is close enough.
router.post('/:id/reconcile', async (req, res) => {
  const txn = await prisma.bankTransaction.findUnique({ where: { id: req.params.id } });
  if (!txn) return res.status(404).json({ error: 'Transaction not found' });
  if (txn.matched) return res.status(400).json({ error: 'Already reconciled' });

  const pending = await prisma.invoice.findMany({ where: { status: 'Pending' } });
  const candidate = pending.find((inv) => Math.abs(inv.amount + inv.gst - txn.amount) < 5000);

  if (candidate) {
    await prisma.invoice.update({ where: { id: candidate.id }, data: { status: 'Paid' } });
    const updated = await prisma.bankTransaction.update({ where: { id: txn.id }, data: { matched: true, matchedInvoiceId: candidate.id } });
    await logAudit({ userId: req.user.id, action: 'Transaction reconciled', entity: 'BankTransaction', entityId: txn.id, toValue: candidate.id });
    return res.json(updated);
  }

  const updated = await prisma.bankTransaction.update({ where: { id: txn.id }, data: { matched: true } });
  await logAudit({ userId: req.user.id, action: 'Transaction reconciled manually', entity: 'BankTransaction', entityId: txn.id });
  res.json(updated);
});

module.exports = router;
