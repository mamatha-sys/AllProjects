const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('password123', 10);

  const departmentNames = ['IT', 'HR', 'R&D', 'QA', 'Manufacturing', 'Medical', 'Educational', 'BDE'];
  const departmentsByName = {};
  for (const name of departmentNames) {
    departmentsByName[name] = await prisma.department.create({ data: { name } });
  }
  await prisma.team.createMany({
    data: [
      { name: 'Team-A', departmentId: departmentsByName['Educational'].id },
      { name: 'Team-B', departmentId: departmentsByName['Educational'].id },
    ],
  });

  const orbit = await prisma.client.create({ data: { name: 'Orbit Software Solutions', industry: 'IT', location: 'Hyderabad' } });
  const medivant = await prisma.client.create({ data: { name: 'Medivant Healthcare', industry: 'Medical', location: 'Bengaluru' } });

  const admin = await prisma.user.create({
    data: { name: 'Vasu (Admin)', email: 'admin@teamlink.test', passwordHash: password, role: 'SUPER_ADMIN' },
  });
  const recruiter = await prisma.user.create({
    data: { name: 'Kiran Kumar', email: 'recruiter@teamlink.test', passwordHash: password, role: 'RECRUITER', atsDepartment: 'IT' },
  });
  const bde = await prisma.user.create({
    data: { name: 'Sanjay Mehta', email: 'bde@teamlink.test', passwordHash: password, role: 'BDE', atsDepartment: 'IT' },
  });
  const tl = await prisma.user.create({
    data: { name: 'Divya Rao', email: 'tl@teamlink.test', passwordHash: password, role: 'TL', atsDepartment: 'IT' },
  });
  await prisma.user.create({
    data: { name: 'Orbit Software Solutions (Client)', email: 'client@teamlink.test', passwordHash: password, role: 'CLIENT', clientId: orbit.id },
  });
  const accountant = await prisma.user.create({
    data: { name: 'Lakshmi Narayan', email: 'accountant@teamlink.test', passwordHash: password, role: 'ACCOUNTANT' },
  });
  const employeeUser = await prisma.user.create({
    data: { name: 'Meera Iyer', email: 'employee@teamlink.test', passwordHash: password, role: 'EMPLOYEE' },
  });

  const req1 = await prisma.requirement.create({
    data: {
      title: 'Senior Backend Engineer',
      description: 'Own the core services team building TeamLink’s backend platform. 5+ years Node.js/PostgreSQL experience.',
      clientId: orbit.id, department: 'IT', priority: 'HIGH', recruiterId: recruiter.id, bdeId: bde.id,
    },
  });
  const req2 = await prisma.requirement.create({
    data: {
      title: 'Staff Nurse',
      description: 'ICU-experienced staff nurse for a 200-bed multi-specialty hospital. Night shift rotation.',
      clientId: medivant.id, department: 'Medical', priority: 'MEDIUM',
    },
  });

  const cand1 = await prisma.candidate.create({ data: { name: 'Arjun Mehta', email: 'arjun@example.com', phone: '9000000001', source: 'Naukri' } });
  const cand2 = await prisma.candidate.create({ data: { name: 'Priya Sharma', email: 'priya@example.com', phone: '9000000002', source: 'LinkedIn' } });
  const cand3 = await prisma.candidate.create({ data: { name: 'Rahul Verma', email: 'rahul@example.com', phone: '9000000003', source: 'TeamLink Website' } });

  await prisma.application.create({ data: { candidateId: cand1.id, requirementId: req1.id, stage: 'RECRUITER_REVIEW' } });
  await prisma.application.create({ data: { candidateId: cand2.id, requirementId: req1.id, stage: 'WITH_BDE' } });
  await prisma.application.create({ data: { candidateId: cand3.id, requirementId: req2.id, stage: 'NEW' } });

  // HRMS
  const ONBOARDING = ['Offer letter signed', 'ID proof collected', 'PAN card collected', 'Laptop/asset assigned', 'Reporting manager introduction', 'System access provisioned'];
  const tasks = (doneCount) => JSON.stringify(ONBOARDING.map((task, i) => ({ task, completed: i < doneCount })));

  const empMeera = await prisma.employee.create({
    data: {
      userId: employeeUser.id, employeeCode: 'EMP-001', name: 'Meera Iyer', email: 'employee@teamlink.test',
      department: 'HR', designation: 'HR Executive', location: 'Hyderabad', dateOfJoining: new Date('2024-03-01'), employmentStatus: 'Active',
      employeeType: 'Full-time', gender: 'Female', dateOfBirth: new Date('1996-04-12'),
      emergencyContactName: 'Suresh Iyer', emergencyContactPhone: '9812345670', address: 'Banjara Hills, Hyderabad',
      onboardingTasks: tasks(6), profileStage: 'Locked', isLocked: true,
    },
  });
  const empKiran = await prisma.employee.create({
    data: {
      userId: recruiter.id, employeeCode: 'EMP-002', name: 'Kiran Kumar', email: 'recruiter@teamlink.test',
      department: 'IT', designation: 'Recruiter', location: 'Hyderabad', dateOfJoining: new Date('2023-07-15'), employmentStatus: 'Active',
      employeeType: 'Full-time', gender: 'Male', dateOfBirth: new Date('1994-11-02'),
      onboardingTasks: tasks(6), profileStage: 'Locked', isLocked: true,
    },
  });
  const empDivya = await prisma.employee.create({
    data: {
      userId: tl.id, employeeCode: 'EMP-003', name: 'Divya Rao', email: 'tl@teamlink.test',
      department: 'IT', designation: 'Team Lead', location: 'Bengaluru', dateOfJoining: new Date('2022-01-10'), employmentStatus: 'Active',
      employeeType: 'Full-time', gender: 'Female', dateOfBirth: new Date('1990-06-20'),
      onboardingTasks: tasks(6), profileStage: 'Locked', isLocked: true,
    },
  });
  const newJoinerUser = await prisma.user.create({
    data: { name: 'Rahul Verma', email: 'rahul.verma@teamlink.test', passwordHash: password, role: 'EMPLOYEE' },
  });
  const empNewJoiner = await prisma.employee.create({
    data: {
      userId: newJoinerUser.id, employeeCode: 'EMP-004', name: 'Rahul Verma', email: 'rahul.verma@teamlink.test',
      department: 'IT', designation: 'Junior Developer', dateOfJoining: new Date(), employmentStatus: 'On Probation',
      reportingManagerId: empDivya.id, onboardingTasks: tasks(3),
      // Bare login only — profile deliberately unfilled to demo the employee fill-in → HR review → lock flow.
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  await prisma.attendance.create({ data: { employeeId: empMeera.id, date: today, status: 'Present', checkIn: '09:12', checkOut: '18:05' } });
  await prisma.attendance.create({ data: { employeeId: empKiran.id, date: today, status: 'Late', checkIn: '10:20' } });
  await prisma.attendance.create({ data: { employeeId: empDivya.id, date: today, status: 'Present', checkIn: '09:00', checkOut: '18:30' } });

  // Device punches for the last 10 working days, so the Biometric list, the Punch
  // Log and the monthly report have something real to derive from. Every third day
  // the check-in is after the 09:30 grace time, which is what makes it Late — and
  // what turns into half-day cuts once the two free lates a month are used up.
  const CHECKIN_METHODS = ['Web Check-in', 'Mobile App', 'Biometric (Fingerprint)'];
  const LOCATIONS = ['Hyderabad HQ', 'Bengaluru Office', 'Remote'];
  const punchEmployees = [empMeera, empKiran, empDivya];
  const punchRows = [];
  const attendanceRows = [];
  let dayOffset = 1;
  let workdays = 0;
  while (workdays < 10) {
    const d = new Date(Date.now() - dayOffset * 86400000);
    dayOffset += 1;
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    workdays += 1;
    const iso = d.toISOString().slice(0, 10);
    punchEmployees.forEach((emp, i) => {
      const seq = workdays + i;
      const status = seq % 7 === 0 ? 'Leave' : 'Present';
      const inTime = seq % 3 === 0 ? '09:47' : '09:12';
      attendanceRows.push({ employeeId: emp.id, date: iso, status, checkIn: status === 'Leave' ? null : inTime, checkOut: status === 'Leave' ? null : '18:41' });
      if (status === 'Leave') return;
      const method = CHECKIN_METHODS[seq % CHECKIN_METHODS.length];
      const location = LOCATIONS[seq % LOCATIONS.length];
      punchRows.push({ employeeId: emp.id, date: iso, time: inTime, direction: 'In', method, location });
      punchRows.push({ employeeId: emp.id, date: iso, time: '18:41', direction: 'Out', method, location });
    });
  }
  await prisma.attendance.createMany({ data: attendanceRows });
  await prisma.attendancePunch.createMany({ data: punchRows });
  // Today's punches, matching the three records marked above.
  await prisma.attendancePunch.createMany({
    data: [
      { employeeId: empMeera.id, date: today, time: '09:12', direction: 'In', method: 'Biometric (Fingerprint)', location: 'Hyderabad HQ' },
      { employeeId: empMeera.id, date: today, time: '18:05', direction: 'Out', method: 'Biometric (Fingerprint)', location: 'Hyderabad HQ' },
      { employeeId: empKiran.id, date: today, time: '10:20', direction: 'In', method: 'Mobile App', location: 'Remote' },
      { employeeId: empDivya.id, date: today, time: '09:00', direction: 'In', method: 'Web Check-in', location: 'Bengaluru Office' },
      { employeeId: empDivya.id, date: today, time: '18:30', direction: 'Out', method: 'Web Check-in', location: 'Bengaluru Office' },
    ],
  });

  await prisma.leaveRequest.create({ data: { employeeId: empMeera.id, type: 'Casual Leave', fromDate: '2026-09-25', toDate: '2026-09-26', days: 2, reason: 'Family function', status: 'Pending' } });
  await prisma.leaveRequest.create({ data: { employeeId: empKiran.id, type: 'Sick Leave', fromDate: '2026-09-10', toDate: '2026-09-10', days: 1, reason: 'Fever', status: 'Approved', decidedAt: new Date(), decidedBy: 'Vasu (Admin)' } });
  await prisma.leaveRequest.create({ data: { employeeId: empDivya.id, type: 'Casual Leave', fromDate: '2026-10-05', toDate: '2026-10-09', days: 5, reason: 'Vacation', status: 'Approved', decidedAt: new Date(), decidedBy: 'Vasu (Admin)', approvalReason: 'Approved per Company Policy' } });

  await prisma.attendanceRegularization.create({ data: { employeeId: empKiran.id, date: today, requestedCheckIn: '09:15', reason: 'Biometric device was offline at the gate.' } });

  // Leave policy — types, approval reasons, holiday calendar
  const LEAVE_TYPES = [
    { code: 'CL', name: 'Casual Leave', cap: 12, unit: 'yr', carries: false },
    { code: 'SL', name: 'Sick Leave', cap: 1, unit: 'month', carries: true },
    { code: 'EL', name: 'Earned Leave', cap: 18, unit: 'yr', carries: false, active: false },
    { code: 'ML', name: 'Maternity', cap: 182, unit: 'yr', carries: false, active: false },
    { code: 'PL', name: 'Paternity', cap: 15, unit: 'yr', carries: false, active: false },
    { code: 'LWP', name: 'Loss of Pay', cap: 0, unit: 'unpaid', carries: false, active: false },
  ];
  for (const t of LEAVE_TYPES) await prisma.leaveType.create({ data: t });

  const LEAVE_REASONS = ['Medical Emergency', 'Family Function / Event', 'Personal Reasons', 'Approved per Company Policy', 'Other'];
  for (const label of LEAVE_REASONS) await prisma.leaveReason.create({ data: { label } });

  await prisma.holiday.create({ data: { name: 'Gandhi Jayanti', date: '2026-10-02', type: 'National Holiday' } });
  await prisma.holiday.create({ data: { name: 'Diwali', date: '2026-11-08', type: 'Festival' } });
  await prisma.holiday.create({ data: { name: 'Diwali (2nd day)', date: '2026-11-09', type: 'Festival' } });
  await prisma.holiday.create({ data: { name: 'Christmas', date: '2026-12-25', type: 'National Holiday' } });
  await prisma.holiday.create({ data: { name: 'Republic Day', date: '2027-01-26', type: 'National Holiday' } });
  await prisma.holiday.create({ data: { name: 'Independence Day', date: '2026-08-15', type: 'National Holiday' } });

  // Opening leave balances. `total` is the year's entitlement (a monthly cap is
  // multiplied out to 12); `taken` is what has already been approved.
  const allEmployees = [empMeera, empKiran, empDivya, empNewJoiner];
  const balanceSeed = [
    { type: 'Casual Leave', total: 12 },
    { type: 'Sick Leave', total: 12 },
  ];
  for (const emp of allEmployees) {
    for (const b of balanceSeed) {
      await prisma.leaveBalance.create({ data: { employeeId: emp.id, type: b.type, total: b.total, taken: 0 } });
    }
  }
  // Reflect the two approved leaves seeded above.
  await prisma.leaveBalance.update({ where: { employeeId_type: { employeeId: empKiran.id, type: 'Sick Leave' } }, data: { taken: 1 } });
  await prisma.leaveBalance.update({ where: { employeeId_type: { employeeId: empDivya.id, type: 'Casual Leave' } }, data: { taken: 5 } });

  // Salary structures (feed the payroll run)
  await prisma.salaryStructure.create({ data: { employeeId: empDivya.id, payMode: 'Package', ctc: 1800000, basic: 75000, hra: 30000, bonus: 6250, specialAllowance: 38750, employerPf: 1800, employeePf: 1800, professionalTax: 200, gratuity: 3608 } });
  await prisma.salaryStructure.create({ data: { employeeId: empKiran.id, payMode: 'Package', ctc: 900000, basic: 37500, hra: 15000, bonus: 3125, specialAllowance: 15375, employerPf: 1800, employeePf: 1800, professionalTax: 200, gratuity: 1804 } });
  await prisma.salaryStructure.create({ data: { employeeId: empMeera.id, payMode: 'Package', ctc: 720000, basic: 30000, hra: 12000, bonus: 2500, specialAllowance: 11500, employerPf: 1800, employeePf: 1800, professionalTax: 200, gratuity: 1443 } });
  await prisma.salaryStructure.create({ data: { employeeId: empNewJoiner.id, payMode: 'Stipend', stipend: 25000 } });

  await prisma.payslip.create({ data: { employeeId: empDivya.id, month: '2026-08', basic: 75000, hra: 30000, allowances: 45000, deductions: 2000, netPay: 148000, bonus: 6250, specialAllowance: 38750, employerPf: 1800, employeePf: 1800, professionalTax: 200, gratuity: 3608, lopDays: 0, gross: 150000, lateCut: 0, lateDays: 0, payMode: 'Package' } });
  await prisma.payrollRun.create({
    data: {
      month: '2026-08', period: 'August 2026', status: 'Paid', employees: 1,
      totalGross: 150000, totalDeductions: 2000, totalLateCuts: 0, totalNet: 148000,
      processedBy: 'Vasu (Admin)', paidAt: new Date('2026-09-01'),
    },
  });

  // Accounts
  const invoice1 = await prisma.invoice.create({
    data: { clientId: orbit.id, candidateId: cand1.id, requirementId: req1.id, amount: 150000, gst: 27000, tds: 15000, status: 'Pending', invoiceDate: '2026-09-05', dueDate: '2026-10-05', paymentTerms: 'Net 30' },
  });
  await prisma.invoice.create({
    data: { clientId: medivant.id, amount: 80000, gst: 14400, tds: 8000, status: 'Overdue', invoiceDate: '2026-08-01', dueDate: '2026-08-31', paymentTerms: 'Net 30' },
  });

  await prisma.bankTransaction.create({ data: { date: '2026-09-08', description: 'NEFT - Orbit Software Solutions', type: 'Credit', amount: 177000, matched: false } });
  await prisma.bankTransaction.create({ data: { date: '2026-09-12', description: 'Office rent - Hyderabad', type: 'Debit', amount: 85000, matched: true } });

  await prisma.officeExpense.create({ data: { category: 'Office Rent', location: 'Hyderabad', monthlyAmount: 85000 } });
  await prisma.officeExpense.create({ data: { category: 'Office Rent', location: 'Bengaluru', monthlyAmount: 110000 } });
  await prisma.officeExpense.create({ data: { category: 'Software Subscriptions', location: 'All', monthlyAmount: 22000 } });

  // HRMS long tail
  await prisma.performanceReview.create({ data: { employeeId: empDivya.id, period: '2026-H1', score: 82, band: 'High', recommendation: 'Recommended', notes: 'Consistently exceeds targets.' } });

  const courseOnboarding = await prisma.course.create({ data: { title: 'New Hire Orientation', category: 'Onboarding', duration: '2h' } });
  const coursePosh = await prisma.course.create({ data: { title: 'POSH Awareness', category: 'Compliance', duration: '1h' } });
  await prisma.courseAssignment.create({ data: { courseId: courseOnboarding.id, employeeId: empMeera.id, completed: true } });
  await prisma.courseAssignment.create({ data: { courseId: coursePosh.id, employeeId: empMeera.id, completed: false } });
  await prisma.courseAssignment.create({ data: { courseId: coursePosh.id, employeeId: empKiran.id, completed: true } });

  const project1 = await prisma.project.create({ data: { name: 'Client Portal Revamp', status: 'Active' } });
  await prisma.projectAssignment.create({ data: { projectId: project1.id, employeeId: empDivya.id, role: 'Lead' } });
  await prisma.projectAssignment.create({ data: { projectId: project1.id, employeeId: empKiran.id, role: 'Contributor' } });

  await prisma.survey.create({ data: { title: 'Q3 Engagement Pulse', status: 'Active', questions: JSON.stringify(['How satisfied are you with your role?', 'Would you recommend TeamLink as a place to work?']) } });

  await prisma.policyDocument.create({ data: { title: 'Leave Policy', category: 'Policy', mandatory: true, published: true, target: 'All Employees', uploadedBy: 'Vasu (Admin)', uploadedDate: '01 Jan 2026' } });
  await prisma.policyDocument.create({ data: { title: 'POSH Awareness Handbook', category: 'Compliance', mandatory: true, published: true, target: 'All Employees', uploadedBy: 'Vasu (Admin)', uploadedDate: '01 Feb 2026' } });

  await prisma.announcement.create({ data: { title: 'Diwali Holiday Schedule', body: 'Office will be closed 08–09 Nov 2026 for Diwali.', category: 'Holiday', pinned: true, target: 'All Employees', postedBy: 'Vasu (Admin)', date: '15 Sep 2026' } });
  await prisma.announcement.create({ data: { title: 'Updated WFH Policy', body: 'Hybrid policy now allows 3 WFH days per week.', category: 'Policy', pinned: false, target: 'All Employees', postedBy: 'Vasu (Admin)', date: '10 Sep 2026' } });

  await prisma.hrConfig.create({ data: {} });
  await prisma.company.create({ data: { name: 'TeamLink Consultants', email: 'hello@teamlink.test', phone: '+91 40 1234 5678', address: 'Hyderabad, India' } });

  // Shift patterns
  await prisma.shiftPattern.create({ data: { name: 'Morning', startTime: '09:00', endTime: '18:00' } });
  await prisma.shiftPattern.create({ data: { name: 'Evening', startTime: '14:00', endTime: '23:00' } });
  await prisma.shiftPattern.create({ data: { name: 'Night', startTime: '22:00', endTime: '07:00' } });

  // EmployeeRecord-backed long tail
  await prisma.employeeRecord.create({ data: { type: 'WEEKLY_IDEA', employeeId: empMeera.id, title: 'Auto-tag candidate source in the weekly recruiter report', detail: 'Would save ~20 min/week of manual tagging.', status: 'Approved' } });
  await prisma.employeeRecord.create({ data: { type: 'HELPDESK', employeeId: empKiran.id, title: 'Laptop running slow', detail: 'Requesting IT to check disk space.', status: 'Open', category: 'IT Support', priority: 'Medium', assignedTo: empDivya.id, notes: '[]' } });
  await prisma.employeeRecord.create({ data: { type: 'HELPDESK', employeeId: empMeera.id, title: 'Payslip for August not visible', detail: 'The Payslips tab shows nothing for last month.', status: 'In Progress', category: 'Payroll Query', priority: 'High', assignedTo: empDivya.id, notes: JSON.stringify([{ author: 'Divya Rao', text: 'Checking whether the August run covered this employee.', internal: true }]) } });
  await prisma.employeeRecord.create({ data: { type: 'HELPDESK', employeeId: empNewJoiner.id, title: 'Access card not working at the Hyderabad gate', detail: 'Card beeps red since Monday.', status: 'Resolved', category: 'Facilities', priority: 'Urgent', resolution: 'Card reissued by facilities; old card deactivated.', resolvedAt: today, csat: 5, escalated: true, notes: '[]' } });

  // One employee already serving notice, so the Resignation screen has a live
  // notice period to count down and the exit checklist something to sit against.
  await prisma.employeeRecord.create({
    data: {
      type: 'RESIGNATION', employeeId: empKiran.id, title: 'Moving to a product role',
      detail: 'Offered a platform engineering position elsewhere.', status: 'Notice Period',
      date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    },
  });
  await prisma.employee.update({ where: { id: empKiran.id }, data: { employmentStatus: 'Notice Period', offboardingStatus: 'Serving Notice' } });
  await prisma.employeeRecord.create({ data: { type: 'ASSET', employeeId: empDivya.id, title: 'Dell Latitude 5420', detail: 'Serial: DL5420-8891', status: 'Assigned', category: 'Laptop', amount: 78000, date: '2022-01-15' } });
  await prisma.employeeRecord.create({ data: { type: 'EXPENSE', employeeId: empKiran.id, title: 'Client site travel', detail: 'Cab fare for Orbit Software client visit', status: 'Pending', category: 'Travel', location: 'Hyderabad', amount: 850, date: today } });
  await prisma.employeeRecord.create({ data: { type: 'TIMESHEET', employeeId: empDivya.id, title: 'Client Portal Revamp', status: 'Logged', hours: 6.5, date: today } });
  await prisma.employeeRecord.create({ data: { type: 'SHIFT', employeeId: empMeera.id, title: 'General Shift (9:00–18:00)', status: 'Scheduled', date: today } });
  await prisma.employeeRecord.create({ data: { type: 'RECOGNITION', employeeId: empKiran.id, title: 'Recruiter of the Month', detail: 'Highest offers-to-joins ratio in Q3.', status: 'Awarded', date: '2026-09-01' } });
  await prisma.employeeRecord.create({ data: { type: 'TARGET', employeeId: empKiran.id, title: '5 confirmed joins this quarter', status: 'In Progress', date: '2026-12-31', progressPct: 40 } });

  await prisma.auditLog.create({ data: { userId: admin.id, action: 'Demo data seeded', entity: 'System' } });

  console.log('Seed complete. Demo logins (password: password123):');
  console.log('  admin@teamlink.test      (Super Admin)');
  console.log('  recruiter@teamlink.test  (Recruiter)');
  console.log('  bde@teamlink.test        (BDE)');
  console.log('  tl@teamlink.test         (TL)');
  console.log('  accountant@teamlink.test (Accountant)');
  console.log('  employee@teamlink.test   (Employee)');
  console.log('  client@teamlink.test     (Client)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
