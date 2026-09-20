const prisma = require('../db');

// India FY runs Apr–Mar. "2026-07-15" → FY2026-27 → short code "26".
function fyShort(dateStr) {
  const d = new Date(dateStr || Date.now());
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return String(y).slice(-2);
}

// One invoice number per client per calendar month — every candidate who
// joins that client in that month is grouped onto the same invoice, the way
// the reference Accounts app groups its join rows. Reuses the number already
// assigned to an existing row for the same client+month; otherwise mints the
// next one in the TY<FY>-<seq> series.
async function nextGroupedInvoiceNumber({ clientId, invoiceDate }) {
  const month = String(invoiceDate || '').slice(0, 7);
  if (clientId && month) {
    const sibling = await prisma.invoice.findFirst({
      where: { clientId, invoiceNumber: { not: null }, invoiceDate: { startsWith: month } },
      orderBy: { createdAt: 'asc' },
      select: { invoiceNumber: true },
    });
    if (sibling?.invoiceNumber) return sibling.invoiceNumber;
  }

  const fy = fyShort(invoiceDate);
  const prefix = `TY${fy}-`;
  const candidates = await prisma.invoice.findMany({
    where: { invoiceNumber: { startsWith: prefix } },
    select: { invoiceNumber: true },
  });
  const seq = candidates.reduce((max, c) => {
    const n = Number(String(c.invoiceNumber).slice(prefix.length));
    return Number.isFinite(n) && n > max ? n : max;
  }, 0) + 1;
  return prefix + String(seq).padStart(3, '0');
}

module.exports = { fyShort, nextGroupedInvoiceNumber };
