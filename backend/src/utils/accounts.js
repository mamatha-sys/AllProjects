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

// ---------------------------------------------------------------------------
// Period picker. The prototype's financial year runs April to March and rolls
// over on its own; the picker offers the whole year, either half, any quarter
// or a single month of it (fyOf / periodMonths / periodLabel in the accounts
// application). `sel` is one of: all | FY:<year> | H1:<year> | H2:<year> |
// Q1:<year>..Q4:<year> | M:<YYYY-MM>.
// ---------------------------------------------------------------------------

function currentFy(today = new Date()) {
  return today.getMonth() + 1 >= 4 ? today.getFullYear() : today.getFullYear() - 1;
}

// All twelve month keys of a financial year, April first.
function fyMonths(year) {
  const out = [];
  for (let i = 0; i < 12; i += 1) {
    const m = 4 + i;
    const y = m > 12 ? year + 1 : year;
    out.push(`${y}-${String(m > 12 ? m - 12 : m).padStart(2, '0')}`);
  }
  return out;
}

const PERIOD_SLICE = {
  FY: [0, 12], H1: [0, 6], H2: [6, 12], Q1: [0, 3], Q2: [3, 6], Q3: [6, 9], Q4: [9, 12],
};

const PERIOD_WORD = {
  FY: 'FY', H1: 'Apr–Sep', H2: 'Oct–Mar', Q1: 'Q1 Apr–Jun', Q2: 'Q2 Jul–Sep', Q3: 'Q3 Oct–Dec', Q4: 'Q4 Jan–Mar',
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (mk) => (mk ? `${MONTH_NAMES[Number(String(mk).slice(5, 7)) - 1]} ${String(mk).slice(0, 4)}` : '—');

function lastDayOf(mk) {
  const y = Number(String(mk).slice(0, 4));
  const m = Number(String(mk).slice(5, 7));
  return toIsoDate(new Date(y, m, 0));
}

// { from, to, label, months[] } for a picker selection. `all` means every date.
function dashRange(sel, today = new Date()) {
  const s = String(sel || `FY:${currentFy(today)}`);
  if (s === 'all') return { all: true, from: null, to: null, label: 'Every month on record', months: null };
  if (s.startsWith('M:')) {
    const mk = s.slice(2);
    return { all: false, from: `${mk}-01`, to: lastDayOf(mk), label: monthLabel(mk), months: [mk] };
  }
  const [kind, yRaw] = s.split(':');
  const year = Number(yRaw) || currentFy(today);
  const slice = PERIOD_SLICE[kind] || PERIOD_SLICE.FY;
  const months = fyMonths(year).slice(slice[0], slice[1]);
  const word = PERIOD_WORD[kind] || 'FY';
  return {
    all: false,
    from: `${months[0]}-01`,
    to: lastDayOf(months[months.length - 1]),
    label: kind === 'FY' ? `FY ${year}–${String(year + 1).slice(2)}` : `${word} ${year}–${String(year + 1).slice(2)}`,
    months,
  };
}

const inRange = (dateStr, range) => {
  if (!dateStr) return false;
  if (!range || range.all) return true;
  const d = String(dateStr).slice(0, 10);
  return d >= range.from && d <= range.to;
};

// ---------------------------------------------------------------------------
// Receivables ageing, in the prototype's own bucket vocabulary.
// ---------------------------------------------------------------------------

const AGE_BUCKETS = ['Not due yet', '0–30 days', '31–60 days', '61–90 days', '90+ days'];

function daysOverdue(dueDate, today = new Date()) {
  if (!dueDate) return null;
  const d = new Date(dueDate);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((today - d) / 86400000);
}

// 'Settled' is a sixth bucket the chips only show when something lands in it.
function ageBucket(invoice, today = new Date()) {
  if (invoiceOutstanding(invoice) <= SETTLED_TOLERANCE) return 'Settled';
  const n = daysOverdue(invoice.dueDate, today);
  if (n == null || n < 0) return 'Not due yet';
  if (n <= 30) return '0–30 days';
  if (n <= 60) return '31–60 days';
  if (n <= 90) return '61–90 days';
  return '90+ days';
}

// ---------------------------------------------------------------------------
// Bank matching. The embedded accounting app reads the client out of the
// narration before it ever looks at the amount, which is what turns a pile of
// "no match" lines into "client named". We keep main's 2%-of-outstanding
// amount match as the fallback, and add the narration read on top of it.
// ---------------------------------------------------------------------------

const normName = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

// Words a bank narration is full of that say nothing about who paid.
const NOISE = new Set(['NEFT', 'RTGS', 'IMPS', 'UPI', 'CR', 'DR', 'CHQ', 'CHEQUE', 'TRF', 'TRANSFER',
  'PAYMENT', 'PAYMT', 'INB', 'MB', 'BY', 'TO', 'FROM', 'THE', 'AND', 'LTD', 'PVT', 'PRIVATE',
  'LIMITED', 'INDIA', 'BANK', 'REF', 'UTR', 'A', 'C', 'AC', 'NO']);

function clientFromNarration(description, clients) {
  const text = normName(description);
  if (!text) return null;
  let best = null;
  clients.forEach((c) => {
    const full = normName(c.name);
    if (!full) return;
    if (text.includes(full)) {
      if (!best || full.length > best.score) best = { client: c, score: full.length, why: `"${c.name}" appears in the narration` };
      return;
    }
    // Fall back to the distinctive words of the name — banks truncate.
    const words = full.split(' ').filter((w) => w.length > 3 && !NOISE.has(w));
    const hit = words.filter((w) => text.includes(w));
    if (hit.length && hit.length === words.length) {
      const score = hit.join('').length;
      if (!best || score > best.score) best = { client: c, score, why: `the narration names ${hit.join(' ')}` };
    }
  });
  return best;
}

// Oldest invoice first, exactly as the application settles a lump receipt.
function allocPlan(invoices, amount) {
  let left = ROUND(amount);
  const parts = [];
  invoices
    .filter(isOpenInvoice)
    .sort((a, b) => String(a.invoiceDate || '').localeCompare(String(b.invoiceDate || '')))
    .forEach((inv) => {
      if (left <= SETTLED_TOLERANCE) return;
      const take = Math.min(left, invoiceOutstanding(inv));
      if (take <= SETTLED_TOLERANCE) return;
      parts.push({ invoiceId: inv.id, invoiceNumber: inv.invoiceNumber, amount: ROUND(take) });
      left = ROUND(left - take);
    });
  return { parts, unallocated: ROUND(Math.max(0, left)) };
}

// The confidence vocabulary shown against a credit: the prototype's own words.
// 'client named' | 'amount only — check' | 'several match' | 'no match'.
function matchCredit(txn, invoices, clients) {
  if (!txn || txn.type !== 'Credit') return null;
  const named = clientFromNarration(txn.description, clients);
  if (named) {
    const theirs = invoices.filter((i) => i.clientId === named.client.id && isOpenInvoice(i));
    if (theirs.length) {
      const exact = theirs.find((i) => Math.abs(invoiceOutstanding(i) - Number(txn.amount || 0)) <= 1);
      const plan = allocPlan(theirs, txn.amount);
      return {
        kind: 'client named',
        client: named.client.name,
        clientId: named.client.id,
        why: named.why,
        invoiceId: exact ? exact.id : (plan.parts[0] || {}).invoiceId || null,
        invoiceNumber: exact ? exact.invoiceNumber : (plan.parts[0] || {}).invoiceNumber || null,
        plan,
        options: theirs.map((i) => i.id),
      };
    }
    return { kind: 'no match', client: named.client.name, clientId: named.client.id, why: `${named.client.name} is named but has nothing outstanding`, plan: { parts: [], unallocated: ROUND(txn.amount) }, options: [] };
  }
  const amountHits = invoices.filter((i) => isOpenInvoice(i) && Math.abs(invoiceOutstanding(i) - Number(txn.amount || 0)) <= invoiceOutstanding(i) * SUGGEST_TOLERANCE_PCT);
  if (amountHits.length === 1) {
    return {
      kind: 'amount only — check',
      client: null,
      why: 'nothing in the narration — this is the only invoice the amount fits',
      invoiceId: amountHits[0].id,
      invoiceNumber: amountHits[0].invoiceNumber,
      plan: { parts: [{ invoiceId: amountHits[0].id, invoiceNumber: amountHits[0].invoiceNumber, amount: ROUND(txn.amount) }], unallocated: 0 },
      options: amountHits.map((i) => i.id),
    };
  }
  if (amountHits.length > 1) {
    return {
      kind: 'several match',
      client: null,
      why: `${amountHits.length} invoices are open for this amount — pick the right one`,
      invoiceId: null,
      invoiceNumber: null,
      plan: { parts: [], unallocated: ROUND(txn.amount) },
      options: amountHits.map((i) => i.id),
    };
  }
  return { kind: 'no match', client: null, why: 'no client in the narration and no invoice at this amount', invoiceId: null, invoiceNumber: null, plan: { parts: [], unallocated: ROUND(txn.amount) }, options: [] };
}

module.exports = {
  ROUND,
  currentFy,
  fyMonths,
  dashRange,
  inRange,
  monthLabel,
  lastDayOf,
  AGE_BUCKETS,
  ageBucket,
  daysOverdue,
  normName,
  clientFromNarration,
  allocPlan,
  matchCredit,
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
