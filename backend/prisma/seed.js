const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('password123', 10);

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
  const empMeera = await prisma.employee.create({
    data: {
      userId: employeeUser.id, employeeCode: 'EMP-001', name: 'Meera Iyer', email: 'employee@teamlink.test',
      department: 'HR', designation: 'HR Executive', location: 'Hyderabad', dateOfJoining: new Date('2024-03-01'), employmentStatus: 'Active',
    },
  });
  const empKiran = await prisma.employee.create({
    data: {
      userId: recruiter.id, employeeCode: 'EMP-002', name: 'Kiran Kumar', email: 'recruiter@teamlink.test',
      department: 'IT', designation: 'Recruiter', location: 'Hyderabad', dateOfJoining: new Date('2023-07-15'), employmentStatus: 'Active',
    },
  });
  const empDivya = await prisma.employee.create({
    data: {
      userId: tl.id, employeeCode: 'EMP-003', name: 'Divya Rao', email: 'tl@teamlink.test',
      department: 'IT', designation: 'Team Lead', location: 'Bengaluru', dateOfJoining: new Date('2022-01-10'), employmentStatus: 'Active',
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  await prisma.attendance.create({ data: { employeeId: empMeera.id, date: today, status: 'Present', checkIn: '09:12', checkOut: '18:05' } });
  await prisma.attendance.create({ data: { employeeId: empKiran.id, date: today, status: 'Late', checkIn: '10:20' } });
  await prisma.attendance.create({ data: { employeeId: empDivya.id, date: today, status: 'Present', checkIn: '09:00', checkOut: '18:30' } });

  await prisma.leaveRequest.create({ data: { employeeId: empMeera.id, type: 'Casual', fromDate: '2026-09-25', toDate: '2026-09-26', reason: 'Family function', status: 'Pending' } });
  await prisma.leaveRequest.create({ data: { employeeId: empKiran.id, type: 'Sick', fromDate: '2026-09-10', toDate: '2026-09-10', reason: 'Fever', status: 'Approved', decidedAt: new Date() } });

  await prisma.payslip.create({ data: { employeeId: empDivya.id, month: '2026-08', basic: 50000, hra: 20000, allowances: 15000, deductions: 5000, netPay: 80000 } });

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

  await prisma.policyDocument.create({ data: { title: 'Leave Policy', category: 'Policy', mandatory: true, published: true, target: 'All Employees', uploadedDate: '01 Jan 2026' } });
  await prisma.policyDocument.create({ data: { title: 'POSH Awareness Handbook', category: 'Compliance', mandatory: true, published: true, target: 'All Employees', uploadedDate: '01 Feb 2026' } });

  await prisma.announcement.create({ data: { title: 'Diwali Holiday Schedule', body: 'Office will be closed 08–09 Nov 2026 for Diwali.', category: 'Holiday', pinned: true, target: 'All Employees', date: '15 Sep 2026' } });
  await prisma.announcement.create({ data: { title: 'Updated WFH Policy', body: 'Hybrid policy now allows 3 WFH days per week.', category: 'Policy', pinned: false, target: 'All Employees', date: '10 Sep 2026' } });

  await prisma.hrConfig.create({ data: {} });
  await prisma.company.create({ data: { name: 'TeamLink Consultants', email: 'hello@teamlink.test', phone: '+91 40 1234 5678', address: 'Hyderabad, India' } });

  // EmployeeRecord-backed long tail
  await prisma.employeeRecord.create({ data: { type: 'WEEKLY_IDEA', employeeId: empMeera.id, title: 'Auto-tag candidate source in the weekly recruiter report', detail: 'Would save ~20 min/week of manual tagging.', status: 'Approved' } });
  await prisma.employeeRecord.create({ data: { type: 'HELPDESK', employeeId: empKiran.id, title: 'Laptop running slow', detail: 'Requesting IT to check disk space.', status: 'Open' } });
  await prisma.employeeRecord.create({ data: { type: 'ASSET', employeeId: empDivya.id, title: 'Dell Latitude 5420', detail: 'Serial: DL5420-8891', status: 'Issued', date: '2022-01-15' } });
  await prisma.employeeRecord.create({ data: { type: 'EXPENSE', employeeId: empKiran.id, title: 'Client site travel', detail: 'Cab fare for Orbit Software client visit', status: 'Pending', amount: 850, date: today } });
  await prisma.employeeRecord.create({ data: { type: 'TIMESHEET', employeeId: empDivya.id, title: 'Client Portal Revamp', status: 'Logged', hours: 6.5, date: today } });
  await prisma.employeeRecord.create({ data: { type: 'SHIFT', employeeId: empMeera.id, title: 'General Shift (9:00–18:00)', status: 'Scheduled', date: today } });
  await prisma.employeeRecord.create({ data: { type: 'RECOGNITION', employeeId: empKiran.id, title: 'Recruiter of the Month', detail: 'Highest offers-to-joins ratio in Q3.', status: 'Awarded', date: '2026-09-01' } });
  await prisma.employeeRecord.create({ data: { type: 'TARGET', employeeId: empKiran.id, title: '5 confirmed joins this quarter', status: 'In Progress', date: '2026-12-31' } });

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
