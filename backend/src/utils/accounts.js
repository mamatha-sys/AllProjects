// Shared Accounts money rules.
//
// These mirror the design prototype: an invoice's total is amount + GST - TDS
// (TDS is deducted at source by the client, so it never arrives in the bank),
// and a bank credit is only auto-suggested against an invoice when it lands
// within 2% of what is still outstanding on it.

const ROUND = (n) => Math.round((Number(n) || 0) * 100) / 100;

// amount + gst - tds — the figure the client actually transfers.
function invoiceTotal(invoice) {
  return ROUND(Number(invoice.amount || 0) + Number(invoice.gst || 0) - Number(invoice.tds || 0));
}

// What is still to be collected after any receipts already recorded.
function invoiceOutstanding(invoice) {
  return ROUND(invoiceTotal(invoice) - Number(invoice.receivedAmount || 0));
}

const SETTLED_TOLERANCE = 0.5; // rupees — below this an invoice counts as closed

// The status an invoice *should* carry, given its receipts and due date.
// 'Cancelled' is sticky: a cancelled invoice is never re-derived.
function deriveInvoiceStatus(invoice, today = new Date()) {
  if (invoice.status === 'Cancelled') return 'Cancelled';
  const outstanding = invoiceOutstanding(invoice);
  if (outstanding <= SETTLED_TOLERANCE) return 'Paid';
  if (Number(invoice.receivedAmount || 0) > 0) return 'Partially Paid';
  if (invoice.dueDate && String(invoice.dueDate) < toIsoDate(today)) return 'Overdue';
  return 'Pending';
}

function toIsoDate(d) {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

// "Net 30" / "Net 45" / "Due on receipt" -> number of days.
function termDays(paymentTerms) {
  const m = String(paymentTerms || '').match(/(\d+)/);
  return m ? Number(m[1]) : 30;
}

function dueDateFor(invoiceDate, paymentTerms) {
  const d = new Date(invoiceDate);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + termDays(paymentTerms));
  return toIsoDate(d);
}

// An invoice is "open" for matching purposes while money is still expected on it.
function isOpenInvoice(invoice) {
  return invoice.status !== 'Cancelled' && invoiceOutstanding(invoice) > SETTLED_TOLERANCE;
}

const SUGGEST_TOLERANCE_PCT = 0.02; // 2% of the outstanding amount

// The prototype's suggestInvoiceFor: credits only, closest open invoice by
// outstanding amount, and only confident enough to offer when the gap is
// within 2% of that invoice. Returns null when nothing is close enough.
function suggestInvoiceFor(txn, invoices) {
  if (!txn || txn.type !== 'Credit') return null;
  const open = invoices.filter(isOpenInvoice);
  let best = null;
  let bestDiff = Infinity;
  for (const inv of open) {
    const diff = Math.abs(invoiceOutstanding(inv) - Number(txn.amount || 0));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = inv;
    }
  }
  if (!best) return null;
  const allowed = invoiceOutstanding(best) * SUGGEST_TOLERANCE_PCT;
  return bestDiff <= allowed ? { invoice: best, diff: ROUND(bestDiff) } : null;
}

// The reconciliation state machine. 'Imported' and 'Suggested Match' are
// presentation states derived from the stored row, not stored themselves.
const RECON_STATES = ['Unmatched', 'Matched', 'Reconciled', 'Ignored'];

function txnState(txn) {
  if (txn.reconStatus && RECON_STATES.includes(txn.reconStatus)) return txn.reconStatus;
  return txn.matched ? 'Matched' : 'Unmatched';
}

module.exports = {
  ROUND,
  invoiceTotal,
  invoiceOutstanding,
  deriveInvoiceStatus,
  dueDateFor,
  termDays,
  toIsoDate,
  isOpenInvoice,
  suggestInvoiceFor,
  txnState,
  RECON_STATES,
  SETTLED_TOLERANCE,
  SUGGEST_TOLERANCE_PCT,
};
