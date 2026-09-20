const express = require('express');
const prisma = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const {
  ROUND, invoiceTotal, invoiceOutstanding, deriveInvoiceStatus,
  suggestInvoiceFor, txnState, toIsoDate,
} = require('../utils/accounts');

const router = express.Router();
router.use(requireAuth);

const ACCOUNTS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'];
router.use(requireRole(...ACCOUNTS_ROLES));

// ---------------------------------------------------------------------------
// The reconciliation state machine
//
//   Unmatched --match--> Matched --reconcile--> Reconciled
//        ^                  |                       |
//        |                  +------ unmatch --------+
//        |                  v
//        +--- unignore -- Ignored <-- ignore -- (Unmatched | Matched)
//
// A Reconciled line is closed: it cannot be re-matched or ignored. Unmatching
// it is the one way back, and that reverses the receipt it created.
// ---------------------------------------------------------------------------

function actor(req) {
  return req.user.name || req.user.email || 'Accounts';
}

async function loadTxn(id) {
  return prisma.bankTransaction.findUnique({ where: { id } });
}

// Shared by the manual "/:id/match" + "/:id/reconcile" routes and by
// auto-post-on-import — one credit line, matched then settled against the
// invoice it confidently belongs to, with the same double-claim guard
// either way so an invoice is never posted against twice.
async function applyMatch(txn, invoice, who) {
  const claimed = await prisma.bankTransaction.findFirst({
    where: { matchedInvoiceId: invoice.id, id: { not: txn.id }, reconStatus: { in: ['Matched', 'Reconciled'] } },
  });
  if (claimed) return null;
  return prisma.bankTransaction.update({
    where: { id: txn.id },
    data: {
      matched: true,
      matchedInvoiceId: invoice.id,
      reconStatus: 'Matched',
      matchedBy: who,
      matchedDate: toIsoDate(new Date()),
      clientName: invoice.client?.name || null,
    },
  });
}

async function applyReconcile(txn, invoice, who) {
  const outstanding = invoiceOutstanding(invoice);
  const applied = ROUND(Math.min(Number(txn.amount || 0), outstanding));
  const unallocated = ROUND(Number(txn.amount || 0) - applied);
  await prisma.invoicePayment.create({
    data: {
      invoiceId: invoice.id,
      date: txn.date,
      amount: applied,
      method: 'Bank Transfer',
      reference: txn.reference || null,
      notes: `Bank statement · ${txn.description}${unallocated > 0.5 ? ` · ₹${unallocated} left unallocated` : ''}`,
      bankTxnId: txn.id,
      recordedBy: who,
    },
  });
  const received = ROUND(Number(invoice.receivedAmount || 0) + applied);
  const status = deriveInvoiceStatus({ ...invoice, receivedAmount: received });
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { receivedAmount: received, status, paidDate: status === 'Paid' ? txn.date : invoice.paidDate, bankTxnId: txn.id },
  });
  return prisma.bankTransaction.update({ where: { id: txn.id }, data: { reconStatus: 'Reconciled', matched: true } });
}

// Only auto-posted when the amount is (near enough) an exact match to one
// open invoice's outstanding balance — the same suggestion the UI would
// show, but tight enough that nobody has to glance at it first. Anything
// looser is left as a "Suggested" line for a human to confirm.
const AUTO_POST_TOLERANCE = 1; // ₹ — covers rounding only, not a real ambiguity
async function tryAutoPost(txn, who) {
  if (txn.type !== 'Credit') return null;
  const invoices = await prisma.invoice.findMany({ include: { client: true } });
  const suggestion = suggestInvoiceFor(txn, invoices);
  if (!suggestion || suggestion.diff > AUTO_POST_TOLERANCE) return null;
  const matched = await applyMatch(txn, suggestion.invoice, who);
  if (!matched) return null;
  const reconciled = await applyReconcile(matched, suggestion.invoice, who);
  return { invoice: suggestion.invoice, txn: reconciled };
}

// Attach the derived state and, for anything still to be matched, the invoice
// the matching rules would suggest.
function decorate(txn, invoiceById, suggestion) {
  const inv = txn.matchedInvoiceId ? invoiceById.get(txn.matchedInvoiceId) : null;
  return {
    ...txn,
    state: txnState(txn),
    matchedInvoice: inv
      ? { id: inv.id, invoiceNumber: inv.invoiceNumber, client: inv.client?.name, total: invoiceTotal(inv), outstanding: invoiceOutstanding(inv), status: inv.status }
      : null,
    suggestion: suggestion
      ? {
        invoiceId: suggestion.invoice.id,
        invoiceNumber: suggestion.invoice.invoiceNumber,
        client: suggestion.invoice.client?.name,
        outstanding: invoiceOutstanding(suggestion.invoice),
        diff: suggestion.diff,
      }
      : null,
  };
}

router.get('/', async (req, res) => {
  const [transactions, invoices] = await Promise.all([
    prisma.bankTransaction.findMany({ orderBy: { date: 'desc' } }),
    prisma.invoice.findMany({ include: { client: true } }),
  ]);
  const invoiceById = new Map(invoices.map((i) => [i.id, i]));
  const filtered = req.query.state
    ? transactions.filter((t) => txnState(t) === req.query.state)
    : transactions;
  res.json(filtered.map((t) => {
    const needsMatch = txnState(t) === 'Unmatched';
    return decorate(t, invoiceById, needsMatch ? suggestInvoiceFor(t, invoices) : null);
  }));
});

// Reconciliation position: how much of the statement is still to be dealt with.
router.get('/summary', async (req, res) => {
  const transactions = await prisma.bankTransaction.findMany();
  const count = (state) => transactions.filter((t) => txnState(t) === state).length;
  const value = (state, type) => ROUND(transactions
    .filter((t) => txnState(t) === state && (!type || t.type === type))
    .reduce((s, t) => s + Number(t.amount || 0), 0));
  const credits = ROUND(transactions.filter((t) => t.type === 'Credit').reduce((s, t) => s + t.amount, 0));
  const debits = ROUND(transactions.filter((t) => t.type === 'Debit').reduce((s, t) => s + t.amount, 0));
  res.json({
    total: transactions.length,
    unmatched: count('Unmatched'),
    matched: count('Matched'),
    reconciled: count('Reconciled'),
    ignored: count('Ignored'),
    unmatchedValue: value('Unmatched'),
    reconciledValue: value('Reconciled'),
    credits,
    debits,
    netMovement: ROUND(credits - debits),
  });
});

// Import statement lines. Accepts either a parsed array of rows or raw CSV text
// with a date / description / amount(or debit+credit) header. Lines already on
// file are skipped rather than duplicated, so re-importing an overlapping
// statement is safe.
router.post('/import', async (req, res) => {
  let rows = Array.isArray(req.body?.transactions) ? req.body.transactions : null;
  if (!rows && typeof req.body?.csv === 'string') {
    const parsed = parseCsv(req.body.csv);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    rows = parsed.rows;
  }
  if (!rows || !rows.length) return res.status(400).json({ error: 'Provide transactions[] or csv text to import' });

  const existing = await prisma.bankTransaction.findMany();
  const key = (t) => [t.date, t.type, ROUND(t.amount), String(t.reference || '').trim().toLowerCase() || String(t.description || '').trim().toLowerCase()].join('|');
  const seen = new Set(existing.map(key));

  const batch = `IMP-${Date.now()}`;
  const created = [];
  const skipped = [];
  for (const raw of rows) {
    const date = String(raw.date || '').slice(0, 10);
    const amount = ROUND(raw.amount);
    const type = raw.type || (Number(raw.credit) > 0 ? 'Credit' : 'Debit');
    if (!date || !(amount > 0)) { skipped.push({ row: raw, reason: 'A date and a non-zero amount are required' }); continue; }
    const row = {
      date,
      description: String(raw.description || raw.narration || '—'),
      type: type === 'Credit' ? 'Credit' : 'Debit',
      amount,
      reference: raw.reference ? String(raw.reference) : null,
      balance: raw.balance == null || raw.balance === '' ? null : Number(raw.balance),
      importBatch: batch,
    };
    const k = key(row);
    if (seen.has(k)) { skipped.push({ row, reason: 'Already on file' }); continue; }
    seen.add(k);
    created.push(await prisma.bankTransaction.create({ data: row }));
  }

  // Auto-post: every newly imported credit that matches one open invoice's
  // outstanding balance almost exactly is matched AND reconciled immediately
  // — no separate click. Anything looser (ambiguous, partial, no invoice
  // close enough) is left "Suggested" for the accountant to confirm by hand,
  // same as it always was.
  let autoPosted = 0;
  if (req.body?.autoPost) {
    const who = actor(req);
    for (let i = 0; i < created.length; i += 1) {
      const result = await tryAutoPost(created[i], who);
      if (result) { created[i] = result.txn; autoPosted += 1; }
    }
  }

  await logAudit({
    userId: req.user.id, action: 'Bank statement imported', entity: 'BankTransaction', entityId: batch,
    toValue: `${created.length} imported, ${skipped.length} skipped${autoPosted ? `, ${autoPosted} auto-reconciled` : ''}`,
  });
  res.status(201).json({ batch, imported: created.length, duplicates: skipped.length, autoPosted, skipped, transactions: created });
});

// Match to an invoice. With an invoiceId this is the manual match; without one
// it uses the suggestion, and refuses when nothing is close enough.
router.post('/:id/match', async (req, res) => {
  const txn = await loadTxn(req.params.id);
  if (!txn) return res.status(404).json({ error: 'Transaction not found' });
  const state = txnState(txn);
  if (state === 'Reconciled') return res.status(400).json({ error: 'This transaction is already reconciled — unmatch it first' });
  if (state === 'Ignored') return res.status(400).json({ error: 'This transaction is ignored — restore it before matching' });
  if (txn.type !== 'Credit') return res.status(400).json({ error: 'Only money received can be matched to an invoice' });

  let invoice;
  let manual = false;
  if (req.body?.invoiceId) {
    manual = true;
    invoice = await prisma.invoice.findUnique({ where: { id: req.body.invoiceId }, include: { client: true } });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  } else {
    const invoices = await prisma.invoice.findMany({ include: { client: true } });
    const suggestion = suggestInvoiceFor(txn, invoices);
    if (!suggestion) return res.status(400).json({ error: 'No confident suggestion — use a manual match' });
    invoice = suggestion.invoice;
  }

  if (invoice.status === 'Cancelled') return res.status(400).json({ error: 'That invoice is cancelled' });
  if (invoiceOutstanding(invoice) <= 0.5) return res.status(400).json({ error: 'That invoice is already settled in full' });

  // One invoice, one transaction — the prototype's guard against double-claiming.
  const claimed = await prisma.bankTransaction.findFirst({
    where: { matchedInvoiceId: invoice.id, id: { not: txn.id }, reconStatus: { in: ['Matched', 'Reconciled'] } },
  });
  if (claimed) return res.status(400).json({ error: 'That invoice is already matched against another transaction' });

  const updated = await prisma.bankTransaction.update({
    where: { id: txn.id },
    data: {
      matched: true,
      matchedInvoiceId: invoice.id,
      reconStatus: 'Matched',
      matchedBy: actor(req),
      matchedDate: toIsoDate(new Date()),
      clientName: invoice.client?.name || null,
    },
  });
  await logAudit({
    userId: req.user.id, action: manual ? 'Manual match applied' : 'Match applied',
    entity: 'BankTransaction', entityId: txn.id, fromValue: state, toValue: `Matched — ${invoice.invoiceNumber || invoice.id}`,
  });
  res.json({ ...updated, state: 'Matched', matchedInvoice: { id: invoice.id, invoiceNumber: invoice.invoiceNumber, client: invoice.client?.name, outstanding: invoiceOutstanding(invoice) } });
});

// Undo a match. From Reconciled this also reverses the receipt, so the invoice
// goes back to being owed.
router.post('/:id/unmatch', async (req, res) => {
  const txn = await loadTxn(req.params.id);
  if (!txn) return res.status(404).json({ error: 'Transaction not found' });
  const state = txnState(txn);
  if (state === 'Unmatched') return res.status(400).json({ error: 'This transaction is not matched to anything' });
  if (state === 'Ignored') return res.status(400).json({ error: 'This transaction is ignored — restore it first' });

  let reversed = 0;
  if (state === 'Reconciled') {
    const payments = await prisma.invoicePayment.findMany({ where: { bankTxnId: txn.id } });
    for (const p of payments) {
      const invoice = await prisma.invoice.findUnique({ where: { id: p.invoiceId } });
      await prisma.invoicePayment.delete({ where: { id: p.id } });
      if (!invoice) continue;
      const received = ROUND(Math.max(0, Number(invoice.receivedAmount || 0) - Number(p.amount || 0)));
      const next = { ...invoice, receivedAmount: received };
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { receivedAmount: received, status: deriveInvoiceStatus(next), paidDate: null, bankTxnId: null },
      });
      reversed = ROUND(reversed + Number(p.amount || 0));
    }
  }

  const updated = await prisma.bankTransaction.update({
    where: { id: txn.id },
    data: { matched: false, matchedInvoiceId: null, reconStatus: 'Unmatched', matchedBy: null, matchedDate: null, clientName: null },
  });
  await logAudit({
    userId: req.user.id, action: state === 'Reconciled' ? 'Reconciliation reversed' : 'Transaction unmatched',
    entity: 'BankTransaction', entityId: txn.id, fromValue: `${state} — ${txn.matchedInvoiceId || '—'}`, toValue: 'Unmatched',
  });
  res.json({ ...updated, state: 'Unmatched', reversed });
});

// Close the line off: record the receipt against the matched invoice.
router.post('/:id/reconcile', async (req, res) => {
  const txn = await loadTxn(req.params.id);
  if (!txn) return res.status(404).json({ error: 'Transaction not found' });
  const state = txnState(txn);
  if (state === 'Reconciled') return res.status(400).json({ error: 'Already reconciled' });
  if (state === 'Ignored') return res.status(400).json({ error: 'This transaction is ignored — restore it first' });
  if (state !== 'Matched') return res.status(400).json({ error: 'Match the transaction to an invoice before reconciling' });

  const invoice = await prisma.invoice.findUnique({ where: { id: txn.matchedInvoiceId } });
  if (!invoice) return res.status(400).json({ error: 'The matched invoice no longer exists — unmatch this transaction' });

  const outstanding = invoiceOutstanding(invoice);
  // A credit larger than the invoice settles it and leaves the rest unallocated,
  // exactly as the prototype's allocation does.
  const applied = ROUND(Math.min(Number(txn.amount || 0), outstanding));
  const unallocated = ROUND(Number(txn.amount || 0) - applied);

  await prisma.invoicePayment.create({
    data: {
      invoiceId: invoice.id,
      date: txn.date,
      amount: applied,
      method: 'Bank Transfer',
      reference: txn.reference || null,
      notes: `Bank statement · ${txn.description}${unallocated > 0.5 ? ` · ₹${unallocated} left unallocated` : ''}`,
      bankTxnId: txn.id,
      recordedBy: actor(req),
    },
  });
  const received = ROUND(Number(invoice.receivedAmount || 0) + applied);
  const status = deriveInvoiceStatus({ ...invoice, receivedAmount: received });
  const updatedInvoice = await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      receivedAmount: received,
      status,
      paidDate: status === 'Paid' ? txn.date : invoice.paidDate,
      bankTxnId: txn.id,
    },
  });
  const updated = await prisma.bankTransaction.update({
    where: { id: txn.id },
    data: { reconStatus: 'Reconciled', matched: true },
  });
  await logAudit({
    userId: req.user.id, action: 'Transaction reconciled', entity: 'BankTransaction', entityId: txn.id,
    fromValue: 'Matched', toValue: `Reconciled — ${invoice.invoiceNumber || invoice.id} marked ${status}`,
  });
  res.json({
    ...updated,
    state: 'Reconciled',
    applied,
    unallocated,
    invoice: { id: updatedInvoice.id, invoiceNumber: updatedInvoice.invoiceNumber, status: updatedInvoice.status, receivedAmount: updatedInvoice.receivedAmount, outstanding: invoiceOutstanding(updatedInvoice) },
  });
});

// Park a line that is not ours to reconcile. It stays on file and can be restored.
router.post('/:id/ignore', async (req, res) => {
  const txn = await loadTxn(req.params.id);
  if (!txn) return res.status(404).json({ error: 'Transaction not found' });
  const state = txnState(txn);
  if (state === 'Reconciled') return res.status(400).json({ error: 'A reconciled transaction cannot be ignored — unmatch it first' });
  if (state === 'Ignored') return res.status(400).json({ error: 'Already ignored' });

  const updated = await prisma.bankTransaction.update({
    where: { id: txn.id },
    data: { reconStatus: 'Ignored', ignoredReason: req.body?.reason || null },
  });
  await logAudit({ userId: req.user.id, action: 'Transaction ignored', entity: 'BankTransaction', entityId: txn.id, fromValue: state, toValue: 'Ignored' });
  res.json({ ...updated, state: 'Ignored' });
});

router.post('/:id/unignore', async (req, res) => {
  const txn = await loadTxn(req.params.id);
  if (!txn) return res.status(404).json({ error: 'Transaction not found' });
  if (txnState(txn) !== 'Ignored') return res.status(400).json({ error: 'This transaction is not ignored' });

  // Back to where it was: still matched if a match survived the parking.
  const back = txn.matched && txn.matchedInvoiceId ? 'Matched' : 'Unmatched';
  const updated = await prisma.bankTransaction.update({
    where: { id: txn.id },
    data: { reconStatus: back, ignoredReason: null },
  });
  await logAudit({ userId: req.user.id, action: 'Transaction restored', entity: 'BankTransaction', entityId: txn.id, fromValue: 'Ignored', toValue: back });
  res.json({ ...updated, state: back });
});

// ---------------------------------------------------------------------------

// A forgiving statement parser: finds the header row, then maps date /
// description / reference / debit / credit / balance columns by name.
function parseCsv(text) {
  const lines = String(text).split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { error: 'The file is empty' };
  const split = (l) => {
    const out = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < l.length; i += 1) {
      const c = l[i];
      if (c === '"') { if (q && l[i + 1] === '"') { cur += '"'; i += 1; } else q = !q; } else if ((c === ',' || c === '\t') && !q) { out.push(cur); cur = ''; } else cur += c;
    }
    out.push(cur);
    return out.map((x) => x.trim().replace(/^"|"$/g, ''));
  };
  const num = (v) => {
    const n = String(v == null ? '' : v).replace(/[₹,\s]/g, '');
    return n === '' || Number.isNaN(Number(n)) ? null : Number(n);
  };
  const iso = (v) => {
    const t = String(v || '').trim();
    let m = t.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
    m = t.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
    if (m) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`; }
    return null;
  };

  let hi = -1;
  let head = null;
  for (let i = 0; i < Math.min(lines.length, 25); i += 1) {
    const c = split(lines[i]).map((x) => x.toLowerCase());
    if (c.some((x) => /date/.test(x)) && c.some((x) => /credit|deposit|withdraw|debit|amount/.test(x))) { hi = i; head = c; break; }
  }
  if (hi < 0) return { error: 'No header row with a date and an amount column was found' };

  const find = (...pats) => { for (const p of pats) { const i = head.findIndex((h) => p.test(h)); if (i >= 0) return i; } return -1; };
  const iDate = find(/date/);
  const iDesc = find(/narration|description|particular|remark|details/);
  const iRef = find(/ref|utr|cheque|chq/);
  const iCr = find(/deposit|credit|money in/);
  const iDr = find(/withdraw|debit|money out/);
  const iAmt = find(/^amount$/, /amount/);
  const iBal = find(/balance|closing/);

  const rows = [];
  for (const line of lines.slice(hi + 1)) {
    const c = split(line);
    const date = iso(c[iDate]);
    if (!date) continue;
    const cr = iCr >= 0 ? num(c[iCr]) : null;
    const dr = iDr >= 0 ? num(c[iDr]) : null;
    let amount = null;
    let type = null;
    if (cr) { amount = Math.abs(cr); type = 'Credit'; } else if (dr) { amount = Math.abs(dr); type = 'Debit'; } else if (iAmt >= 0) {
      const a = num(c[iAmt]);
      if (a != null && a !== 0) { amount = Math.abs(a); type = a > 0 ? 'Credit' : 'Debit'; }
    }
    if (amount == null) continue;
    rows.push({
      date,
      description: iDesc >= 0 ? c[iDesc] : '—',
      reference: iRef >= 0 ? c[iRef] : null,
      amount,
      type,
      balance: iBal >= 0 ? num(c[iBal]) : null,
    });
  }
  if (!rows.length) return { error: 'No usable transaction rows were found below the header' };
  return { rows };
}

// ---- Duplicate statement lines — the same line imported more than once ----
// Groups by same date + debit/credit amount + (reference or the first 40
// chars of the description), matching the reference app's detector.
router.get('/duplicates', async (req, res) => {
  const all = await prisma.bankTransaction.findMany({ orderBy: { createdAt: 'asc' } });
  const groups = new Map();
  all.forEach((t) => {
    const key = [t.date, t.type, ROUND(t.amount), (t.reference || t.description || '').trim().toLowerCase().slice(0, 40)].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  });
  const dupeGroups = [...groups.values()].filter((g) => g.length > 1);
  const extraCount = dupeGroups.reduce((s, g) => s + (g.length - 1), 0);
  const extraAmount = ROUND(dupeGroups.reduce((s, g) => s + g.slice(1).reduce((s2, t) => s2 + t.amount, 0), 0));
  res.json({
    groups: dupeGroups.map((g) => g.map((t, i) => ({ ...t, isKeep: i === 0 }))),
    extraCount,
    extraAmount,
  });
});

router.post('/duplicates/drop', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids[] is required' });
  const txns = await prisma.bankTransaction.findMany({ where: { id: { in: ids } } });
  const stillMatched = txns.filter((t) => t.matched || t.reconStatus === 'Reconciled');
  if (stillMatched.length) {
    return res.status(400).json({ error: 'Unmatch the reconciled/matched copies before removing them as duplicates' });
  }
  await prisma.bankTransaction.deleteMany({ where: { id: { in: ids } } });
  await logAudit({ userId: req.user.id, action: 'Duplicate statement line(s) removed', entity: 'BankTransaction', toValue: `${ids.length} removed` });
  res.json({ ok: true, removed: ids.length });
});

module.exports = router;
