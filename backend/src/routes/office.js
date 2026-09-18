const express = require('express');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();
router.use(requireAuth);

const ACCOUNTS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'];
router.use(requireRole(...ACCOUNTS_ROLES));

router.get('/', async (req, res) => {
  const expenses = await prisma.officeExpense.findMany({ orderBy: { category: 'asc' } });
  res.json(expenses);
});

router.post('/', async (req, res) => {
  const { category, location, monthlyAmount } = req.body;
  if (!category || monthlyAmount == null) return res.status(400).json({ error: 'category and monthlyAmount are required' });
  const expense = await prisma.officeExpense.create({ data: { category, location, monthlyAmount: Number(monthlyAmount) } });
  await logAudit({ userId: req.user.id, action: 'Office expense added', entity: 'OfficeExpense', entityId: expense.id });
  res.status(201).json(expense);
});

module.exports = router;
