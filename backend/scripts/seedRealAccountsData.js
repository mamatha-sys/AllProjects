// One-off, additive import of the reference Accounts app's real seed data
// (236 clients, 123 candidate/invoice join records, 70 office expense rows)
// into the live database. Never deletes or alters existing rows — clients
// are matched by name and skipped if already present; invoices/expenses are
// only inserted, never updated. Does not touch any HRMS or ATS table
// (Candidate, Application, Requirement, Employee, ...).
const { PrismaClient } = require('@prisma/client');
const clientsAndInvoices = require('../prisma/realData/clientsAndInvoices.json');
const officeExpenses = require('../prisma/realData/officeExpenses.json');

const prisma = new PrismaClient();

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const STATUS_MAP = {
  Received: 'Paid',
  Pending: 'Pending',
  Drop: 'Cancelled',
  Replace: 'Cancelled',
};

async function seedClients() {
  const existing = await prisma.client.findMany({ select: { id: true, name: true } });
  const byName = new Map(existing.map((c) => [c.name.trim().toLowerCase(), c.id]));

  let created = 0;
  for (const c of clientsAndInvoices.clients) {
    const key = c.name.trim().toLowerCase();
    if (byName.has(key)) continue;
    const row = await prisma.client.create({
      data: {
        name: c.name,
        industry: c.dept || null,
        location: c.loc || null,
        ownerDepartment: c.dept || null,
        status: c.active === false ? 'Inactive' : 'Active',
        contactName: c.contact || null,
        contactPhone: c.phone || null,
        gstPercent: c.gstPct != null ? c.gstPct * 100 : 18,
        tdsPercent: c.tdsPct != null ? c.tdsPct * 100 : 10,
        commercialNotes: c.notes || null,
      },
    });
    byName.set(key, row.id);
    created += 1;
  }
  console.log(`Clients: ${created} created, ${byName.size - created} already present`);
  return byName;
}

async function seedInvoices(clientIdByName) {
  const existingNumbers = new Set(
    (await prisma.invoice.findMany({ select: { invoiceNumber: true } }))
      .map((i) => i.invoiceNumber)
      .filter(Boolean)
  );

  let created = 0;
  let skippedNoClient = 0;
  let skippedDup = 0;
  for (const r of clientsAndInvoices.candidates) {
    const clientId = clientIdByName.get(String(r.client || '').trim().toLowerCase());
    if (!clientId) {
      skippedNoClient += 1;
      continue;
    }
    const invoiceNumber = r.invNo ? `RD-${r.id}-${r.invNo}` : null;
    if (invoiceNumber && existingNumbers.has(invoiceNumber)) {
      skippedDup += 1;
      continue;
    }

    const amount = round2(Number(r.override || 0));
    const gstApplicable = r.gstReg === 'Yes';
    const gst = gstApplicable ? round2(amount * Number(r.gstPct || 0)) : 0;
    const tds = round2(amount * Number(r.tdsPct || 0));
    const status = STATUS_MAP[r.status] || 'Pending';
    const total = round2(amount + gst - tds);

    await prisma.invoice.create({
      data: {
        clientId,
        amount,
        gst,
        tds,
        status,
        invoiceDate: r.invDate || r.join,
        joiningDate: r.join || null,
        invoiceNumber,
        receivedAmount: status === 'Paid' ? round2(Number(r.received ?? total)) : 0,
        paidDate: r.payDate || null,
        candidateName: r.name || null,
        candidateRole: r.role || r.sheetRole || null,
        candidateQualification: r.qual || null,
        department: r.dept || null,
        section: r.section || null,
        notes: 'Imported from reference Accounts app real data',
      },
    });
    if (invoiceNumber) existingNumbers.add(invoiceNumber);
    created += 1;
  }
  console.log(`Invoices: ${created} created, ${skippedDup} already present, ${skippedNoClient} skipped (no matching client)`);
}

async function seedOfficeExpenses() {
  const existing = await prisma.officeExpense.findMany({
    select: { vendor: true, expenseDate: true, monthlyAmount: true },
  });
  const seen = new Set(existing.map((e) => `${e.vendor || ''}|${e.expenseDate || ''}|${e.monthlyAmount}`));

  let created = 0;
  for (const row of officeExpenses.rows) {
    const vendor = row.vendor || row.cat;
    const key = `${vendor || ''}|${row.date || ''}|${Number(row.base || 0)}`;
    if (seen.has(key)) continue;
    const gstAmount = row.gstApp ? round2(Number(row.base || 0) * Number(row.gstRate || 0)) : 0;
    await prisma.officeExpense.create({
      data: {
        category: row.cat,
        monthlyAmount: Number(row.base || 0),
        vendor: row.vendor || null,
        expenseDate: row.date || null,
        gstAmount,
        paidStatus: row.status === 'Pending' ? 'Unpaid' : 'Paid',
        recurring: row.freq === 'Monthly',
        notes: row.remarks || null,
      },
    });
    seen.add(key);
    created += 1;
  }
  console.log(`Office expenses: ${created} created, ${officeExpenses.rows.length - created} already present`);
}

async function main() {
  const clientIdByName = await seedClients();
  await seedInvoices(clientIdByName);
  await seedOfficeExpenses();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
