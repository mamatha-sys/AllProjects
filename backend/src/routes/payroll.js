const express = require('express');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();
router.use(requireAuth);

const PAYROLL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'];

async function getPolicy() {
  let config = await prisma.hrConfig.findFirst();
  if (!config) config = await prisma.hrConfig.create({ data: {} });
  return config;
}

// CTC breakup driven by the configurable CTC Split Settings (see PUT /ctc-settings)
// rather than hardcoded percentages: Basic is a % of CTC, HRA/Bonus/PF/Gratuity are
// % of Basic (PF capped), flat professional tax, Special Allowance absorbs the
// remainder so the pieces reconcile exactly back to CTC — mirrors the reference
// app's Salary Structure panel and its Configuration Policies screen.
function salaryBreakup(annualCtc, cfg) {
  const monthlyCtc = annualCtc / 12;
  const basic = Math.round(monthlyCtc * (cfg.basicPctOfCtc / 100));
  const hra = Math.round(basic * (cfg.hraPctOfBasic / 100));
  const bonus = Math.round(basic * (cfg.bonusPctOfBasic / 100));
  const employeePf = Math.round(Math.min(basic * (cfg.employeePfPctOfBasic / 100), cfg.employeePfMonthlyCap));
  const employerPf = Math.round(Math.min(basic * (cfg.employerPfPctOfBasic / 100), cfg.employerPfMonthlyCap));
  const professionalTax = cfg.professionalTaxFlat;
  const gratuity = Math.round(basic * (cfg.gratuityPctOfBasic / 100));
  const gross = basic + hra + bonus;
  const special = Math.max(0, Math.round(monthlyCtc - gross - employerPf - gratuity));
  const grossWithSpecial = gross + special;
  const deductions = employeePf + professionalTax;
  const net = grossWithSpecial - deductions;
  const ctcCheck = Math.round((grossWithSpecial + employerPf + gratuity) * 12);
  return { basic, hra, bonus, special, employerPf, employeePf, professionalTax, gratuity, gross: grossWithSpecial, deductions, net, ctcCheck };
}

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

// ---- Salary structures ----

router.get('/structure', requireRole(...PAYROLL_ROLES), async (req, res) => {
  const cfg = await getPolicy();
  const employees = await prisma.employee.findMany({ include: { salaryStructure: true }, orderBy: { name: 'asc' } });
  res.json(
    employees.map((e) => {
      const ss = e.salaryStructure;
      const breakup = ss && ss.payMode === 'Package' ? salaryBreakup(ss.ctc || 0, cfg) : null;
      return { employeeId: e.id, employeeCode: e.employeeCode, name: e.name, department: e.department, structure: ss, breakup };
    })
  );
});

// Reference CTC breakup for the "Standard Package" example shown on the Payroll dashboard.
router.get('/reference-structure', requireRole(...PAYROLL_ROLES), async (req, res) => {
  const cfg = await getPolicy();
  res.json(salaryBreakup(Number(req.query.ctc) || 300000, cfg));
});

router.put('/structure/:employeeId', requireRole(...PAYROLL_ROLES), async (req, res) => {
  const { payMode, ctc, stipend } = req.body;
  const cfg = await getPolicy();
  const data = {};
  if (payMode) data.payMode = payMode;
  if (ctc != null) {
    data.ctc = Number(ctc);
    const b = salaryBreakup(Number(ctc), cfg);
    Object.assign(data, { basic: b.basic, hra: b.hra, bonus: b.bonus, specialAllowance: b.special, employerPf: b.employerPf, employeePf: b.employeePf, professionalTax: b.professionalTax, gratuity: b.gratuity });
  }
  if (stipend != null) data.stipend = Number(stipend);

  const structure = await prisma.salaryStructure.upsert({
    where: { employeeId: req.params.employeeId },
    update: data,
    create: { employeeId: req.params.employeeId, payMode: payMode || 'Package', ...data },
  });
  await logAudit({ userId: req.user.id, action: 'Salary structure updated', entity: 'SalaryStructure', entityId: structure.id });
  res.json(structure);
});

// ---- CTC Split Settings (how CTC is broken into components) ----

router.put('/ctc-settings', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const fields = ['basicPctOfCtc', 'hraPctOfBasic', 'bonusPctOfBasic', 'employeePfPctOfBasic', 'employerPfPctOfBasic', 'employeePfMonthlyCap', 'employerPfMonthlyCap', 'gratuityPctOfBasic', 'professionalTaxFlat'];
  const config = await getPolicy();
  const data = {};
  fields.forEach((f) => { if (req.body[f] != null) data[f] = Number(req.body[f]); });
  const updated = await prisma.hrConfig.update({ where: { id: config.id }, data });
  await logAudit({ userId: req.user.id, action: 'CTC split settings updated', entity: 'HrConfig', entityId: updated.id });
  res.json(updated);
});

// ---- Payroll policy (how attendance turns into pay) ----

router.get('/policy', async (req, res) => {
  res.json(await getPolicy());
});

router.put('/policy', requireRole('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  const { unmarkedDaysUnpaid, weekendsPaid, paidLeaveDaysPerMonth } = req.body;
  const config = await getPolicy();
  const updated = await prisma.hrConfig.update({
    where: { id: config.id },
    data: {
      unmarkedDaysUnpaid: typeof unmarkedDaysUnpaid === 'boolean' ? unmarkedDaysUnpaid : undefined,
      weekendsPaid: typeof weekendsPaid === 'boolean' ? weekendsPaid : undefined,
      paidLeaveDaysPerMonth: paidLeaveDaysPerMonth != null ? Number(paidLeaveDaysPerMonth) : undefined,
    },
  });
  await logAudit({ userId: req.user.id, action: 'Payroll policy updated', entity: 'HrConfig', entityId: updated.id });
  res.json(updated);
});

// ---- Full & Final settlement requests ----

router.get('/fnf', requireRole(...PAYROLL_ROLES), async (req, res) => {
  const requests = await prisma.fnfRequest.findMany({ include: { employee: true }, orderBy: { createdAt: 'desc' } });
  res.json(requests);
});

router.patch('/fnf/:id/process', requireRole(...PAYROLL_ROLES), async (req, res) => {
  const { settlementAmount } = req.body;
  const fnf = await prisma.fnfRequest.update({
    where: { id: req.params.id },
    data: { status: 'Processed', settlementAmount: settlementAmount != null ? Number(settlementAmount) : null, processedAt: new Date() },
  });
  await logAudit({ userId: req.user.id, action: 'F&F settlement processed', entity: 'FnfRequest', entityId: fnf.id });
  res.json(fnf);
});

// Runs a payroll cycle for every active employee for a given month. Uses each
// employee's salary structure when set (falling back to a flat default CTC),
// and prorates pay against that month's attendance per the payroll policy —
// unmarked/absent working days beyond the paid-leave allowance become loss of pay.
router.post('/run', requireRole(...PAYROLL_ROLES), async (req, res) => {
  const { month, defaultCTC } = req.body; // month = "YYYY-MM"
  if (!month) return res.status(400).json({ error: 'month is required (YYYY-MM)' });
  const policy = await getPolicy();

  const [year, mo] = month.split('-').map(Number);
  const daysInMonth = new Date(year, mo, 0).getDate();
  let workingDays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, mo - 1, d).getDay();
    if (policy.weekendsPaid || (dow !== 0 && dow !== 6)) workingDays++;
  }

  const employees = await prisma.employee.findMany({ where: { employmentStatus: { in: ['Active', 'Notice Period'] } }, include: { salaryStructure: true } });
  const payslips = [];
  for (const emp of employees) {
    const ctc = emp.salaryStructure?.payMode === 'Package' ? emp.salaryStructure.ctc : Number(defaultCTC) || 600000;
    const b = salaryBreakup(ctc, policy);
    const gross = b.gross;

    const records = await prisma.attendance.findMany({ where: { employeeId: emp.id, date: { startsWith: month } } });
    const absentDays = records.filter((r) => r.status === 'Absent').length;
    const markedDays = records.length;
    const unmarkedDays = policy.unmarkedDaysUnpaid ? Math.max(0, workingDays - markedDays) : 0;
    const leaveDays = records.filter((r) => r.status === 'Leave').length;
    const unpaidLeaveDays = Math.max(0, leaveDays - policy.paidLeaveDaysPerMonth);
    const lopDays = absentDays + unmarkedDays + unpaidLeaveDays;

    const perDayPay = workingDays ? gross / workingDays : 0;
    const lopDeduction = Math.round(perDayPay * lopDays);
    const netPay = Math.max(0, gross - b.deductions - lopDeduction);

    const slip = await prisma.payslip.upsert({
      where: { employeeId_month: { employeeId: emp.id, month } },
      update: {
        basic: b.basic, hra: b.hra, allowances: b.bonus + b.special, deductions: b.deductions, netPay,
        bonus: b.bonus, specialAllowance: b.special, employerPf: b.employerPf, employeePf: b.employeePf,
        professionalTax: b.professionalTax, gratuity: b.gratuity, lopDays,
      },
      create: {
        employeeId: emp.id, month, basic: b.basic, hra: b.hra, allowances: b.bonus + b.special, deductions: b.deductions, netPay,
        bonus: b.bonus, specialAllowance: b.special, employerPf: b.employerPf, employeePf: b.employeePf,
        professionalTax: b.professionalTax, gratuity: b.gratuity, lopDays,
      },
    });
    payslips.push(slip);
  }
  await logAudit({ userId: req.user.id, action: 'Payroll run', entity: 'Payslip', entityId: month, toValue: String(payslips.length) + ' payslips' });
  res.status(201).json({ month, count: payslips.length, payslips });
});

module.exports = router;
