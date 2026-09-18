const express = require('express');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();
router.use(requireAuth);

const PAYROLL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'];

router.get('/', async (req, res) => {
  const where = {};
  if (req.user.role === 'EMPLOYEE') {
    const own = await prisma.employee.findUnique({ where: { userId: req.user.id } });
    if (!own) return res.json([]);
    where.employeeId = own.id;
  } else if (req.query.employeeId) {
    where.employeeId = req.query.employeeId;
  }
  if (req.query.month) where.month = req.query.month;
  const payslips = await prisma.payslip.findMany({ where, include: { employee: true }, orderBy: { month: 'desc' } });
  res.json(payslips);
});

// Runs a simple payroll cycle for every active employee for a given month,
// deriving pay components from a flat CTC figure per employee (demo simplification).
router.post('/run', requireRole(...PAYROLL_ROLES), async (req, res) => {
  const { month, defaultCTC } = req.body; // month = "YYYY-MM"
  if (!month) return res.status(400).json({ error: 'month is required (YYYY-MM)' });
  const ctc = Number(defaultCTC) || 600000;
  const basic = Math.round((ctc * 0.5) / 12);
  const hra = Math.round((ctc * 0.2) / 12);
  const allowances = Math.round((ctc * 0.15) / 12);
  const deductions = Math.round((ctc * 0.05) / 12);
  const netPay = basic + hra + allowances - deductions;

  const employees = await prisma.employee.findMany({ where: { employmentStatus: 'Active' } });
  const payslips = [];
  for (const emp of employees) {
    const slip = await prisma.payslip.upsert({
      where: { employeeId_month: { employeeId: emp.id, month } },
      update: { basic, hra, allowances, deductions, netPay },
      create: { employeeId: emp.id, month, basic, hra, allowances, deductions, netPay },
    });
    payslips.push(slip);
  }
  await logAudit({ userId: req.user.id, action: 'Payroll run', entity: 'Payslip', entityId: month, toValue: String(payslips.length) + ' payslips' });
  res.status(201).json({ month, count: payslips.length, payslips });
});

module.exports = router;
