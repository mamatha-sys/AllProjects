const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('password123', 10);

  const orbit = await prisma.client.create({
    data: { name: 'Orbit Software Solutions', industry: 'IT', location: 'Hyderabad', agreementStatus: 'SIGNED', agreementSentAt: new Date('2026-08-01'), agreementSignedAt: new Date('2026-08-03'), agreementSignedBy: 'Orbit HR Desk' },
  });
  const medivant = await prisma.client.create({
    data: { name: 'Medivant Healthcare', industry: 'Medical', location: 'Bengaluru', agreementStatus: 'SENT', agreementSentAt: new Date('2026-09-10') },
  });
  const nimbus = await prisma.client.create({ data: { name: 'Nimbus Retail Pvt Ltd', industry: 'Retail', location: 'Chennai' } });

  const admin = await prisma.user.create({
    data: { name: 'Vasu (Admin)', email: 'admin@teamlink.test', passwordHash: password, role: 'SUPER_ADMIN' },
  });
  const manager = await prisma.user.create({
    data: { name: 'Anita Desai', email: 'manager@teamlink.test', passwordHash: password, role: 'MANAGER', atsDepartment: 'IT' },
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
  const clientUser = await prisma.user.create({
    data: { name: 'Orbit Software Solutions (Client)', email: 'client@teamlink.test', passwordHash: password, role: 'CLIENT', clientId: orbit.id },
  });

  const req1 = await prisma.requirement.create({
    data: {
      title: 'Senior Backend Engineer',
      description: 'Own the core services team building TeamLink’s backend platform. 5+ years Node.js experience.',
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
  const req3 = await prisma.requirement.create({
    data: { title: 'Store Operations Executive', clientId: nimbus.id, department: 'Retail', priority: 'LOW', status: 'CLOSED' },
  });

  const cand1 = await prisma.candidate.create({ data: { name: 'Arjun Mehta', email: 'arjun@example.com', phone: '9000000001', source: 'Naukri', skills: 'Node.js, Backend, IT' } });
  const cand2 = await prisma.candidate.create({ data: { name: 'Priya Sharma', email: 'priya@example.com', phone: '9000000002', source: 'LinkedIn', skills: 'React, Frontend, IT' } });
  const cand3 = await prisma.candidate.create({ data: { name: 'Rahul Verma', email: 'rahul@example.com', phone: '9000000003', source: 'TeamLink Website', skills: 'Nursing, Medical, ICU' } });
  const cand4 = await prisma.candidate.create({ data: { name: 'Sneha Patil', email: 'sneha@example.com', phone: '9000000004', source: 'Indeed', skills: 'Node.js, IT, Backend' } });

  await prisma.application.create({ data: { candidateId: cand1.id, requirementId: req1.id, stage: 'RECRUITER_REVIEW' } });
  await prisma.application.create({ data: { candidateId: cand2.id, requirementId: req1.id, stage: 'WITH_BDE' } });
  await prisma.application.create({
    data: { candidateId: cand3.id, requirementId: req2.id, stage: 'INTERVIEW_SCHEDULED', interviewStatus: 'SCHEDULED', interviewAt: new Date('2026-09-25T10:30:00') },
  });

  await prisma.notification.create({ data: { userId: recruiter.id, title: 'Priya Sharma moved to WITH BDE', message: `Requirement: ${req1.id}` } });
  await prisma.notification.create({ data: { userId: clientUser.id, title: 'Service agreement signed', message: 'Thanks for e-signing — requirements are now live.', read: true } });

  await prisma.auditLog.create({ data: { userId: admin.id, action: 'Demo data seeded', entity: 'System' } });

  console.log('Seed complete. Demo logins (password: password123):');
  console.log('  admin@teamlink.test      (Super Admin)');
  console.log('  manager@teamlink.test    (Manager, IT dept)');
  console.log('  recruiter@teamlink.test  (Recruiter)');
  console.log('  bde@teamlink.test        (BDE)');
  console.log('  tl@teamlink.test         (TL, department-scoped)');
  console.log('  client@teamlink.test     (Client — sees only Orbit)');
  console.log(`Unused fourth candidate (${cand4.name}) is left unlinked to demo matching-candidates suggestions on requirement ${req1.id}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
