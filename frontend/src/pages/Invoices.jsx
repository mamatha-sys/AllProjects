import { Fragment, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import PeriodPicker from '../components/PeriodPicker.jsx';
import InvoicePrintModal from '../components/InvoicePrintModal.jsx';
import { downloadCsv } from '../utils/csv.js';

const ACCOUNTS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'];
const STATUSES = ['All', 'Pending', 'Partially Paid', 'Overdue', 'Paid', 'Cancelled'];

// The reference Work page's "Billing type" column — this app doesn't carry a
// client-level billing-model field, so it's shown from the fee % actually
// used on the invoice (the nearest equivalent we have).
function billingTypeOf(g) {
  const withFee = g.rows.find((r) => r.feePercent != null);
  if (withFee) return `% of Annual CTC · ${withFee.feePercent}%`;
  return '—';
}

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export function statusClass(status) {
  if (status === 'Overdue') return 'priority-high';
  if (status === 'Paid') return 'priority-low';
  if (status === 'Partially Paid') return 'priority-medium';
  return '';
}

// Ageing buckets — the reference Work page's "How old is the outstanding" bar.
function ageBucket(i) {
  if (i.outstanding <= 0.5) return 'Settled';
  if (!i.dueDate) return 'No due date';
  const days = Math.floor((Date.now() - new Date(i.dueDate)) / 86400000);
  if (days < 0) return 'Not due yet';
  if (days <= 30) return '0–30 days';
  if (days <= 60) return '31–60 days';
  if (days <= 90) return '61–90 days';
  return '90+ days';
}
const AGE_BUCKETS = ['Not due yet', '0–30 days', '31–60 days', '61–90 days', '90+ days', 'Settled'];
const GROUP_MODES = [['inv', 'Invoice'], ['client', 'Client'], ['dept', 'Department'], ['rec', 'Recruiter'], ['month', 'Invoice month']];

export default function Invoices() {
  const { user } = useAuth();
  const canManage = ACCOUNTS_ROLES.includes(user?.role);
  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState('All');
  const [error, setError] = useState('');

  // --- Additive Work-page features: period, ageing, grouping, saved views, TDS certs ---
  const [period, setPeriod] = useState({ mode: 'ALL' });
  const [age, setAge] = useState('All');
  const [groupBy, setGroupBy] = useState('inv');
  const [savedViews, setSavedViews] = useState([]);
  const [newViewName, setNewViewName] = useState('');
  const [tdsTarget, setTdsTarget] = useState(null);
  const [tdsForm, setTdsForm] = useState({ status: 'Not received', certNumber: '', certDate: '', quarter: '', amount: '', notes: '' });
  const [expanded, setExpanded] = useState(() => new Set());
  const [printTarget, setPrintTarget] = useState(null);
  const [showMoneyCols, setShowMoneyCols] = useState(false);
  const [showColMenu, setShowColMenu] = useState(false);
  const [payTarget, setPayTarget] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', date: '', method: 'Bank Transfer', reference: '' });

  const load = useCallback(() => {
    api.get('/invoices').then((res) => setInvoices(res.data));
    api.get('/invoices/summary').then((res) => setSummary(res.data)).catch(() => setSummary(null));
    api.get('/invoices/saved-views').then((res) => setSavedViews(res.data)).catch(() => setSavedViews([]));
  }, []);
  useEffect(load, [load]);

  async function markPaid(id) {
    setError('');
    try {
      await api.patch(`/invoices/${id}/pay`);
      load();
    } catch (e) {
      setError(e.response?.data?.error || 'That did not work.');
    }
  }

  const rows = status === 'All' ? invoices : invoices.filter((i) => i.status === status);

  // Additive scoping on top of the existing status-tab rows — defaults (period
  // ALL, age All) leave `scopedRows` identical to `rows`, so nothing existing
  // changes unless the new filters are actually used.
  const inPeriod = (i) => {
    if (!period.from && !period.to) return true;
    if (period.from && i.invoiceDate < period.from) return false;
    if (period.to && i.invoiceDate > period.to) return false;
    return true;
  };
  const scopedRows = rows.filter((i) => inPeriod(i) && (age === 'All' || ageBucket(i) === age));

  const ageCounts = AGE_BUCKETS.map((b) => ({ label: b, count: rows.filter((i) => inPeriod(i) && ageBucket(i) === b).length, amount: rows.filter((i) => inPeriod(i) && ageBucket(i) === b).reduce((s, i) => s + i.outstanding, 0) }));

  function groupKeyOf(i) {
    if (groupBy === 'client') return i.client?.name || '—';
    if (groupBy === 'dept') return i.requirement?.department || i.department || '—';
    if (groupBy === 'rec') return i.requirement?.recruiter?.name || i.requirement?.bde?.name || 'not assigned';
    if (groupBy === 'month') return (i.invoiceDate || '').slice(0, 7) || '—';
    return null;
  }
  let grouped = [];
  if (groupBy !== 'inv') {
    const map = new Map();
    scopedRows.forEach((i) => {
      const key = groupKeyOf(i);
      const cur = map.get(key) || { key, count: 0, before: 0, gst: 0, total: 0, received: 0, pending: 0 };
      cur.count += 1;
      cur.before += Number(i.amount || 0);
      cur.gst += Number(i.gst || 0);
      cur.total += i.total;
      cur.received += Number(i.receivedAmount || 0);
      cur.pending += i.outstanding;
      map.set(key, cur);
    });
    grouped = [...map.values()].sort((a, b) => b.pending - a.pending);
  }

  // Every candidate who joined the same client in the same month shares one
  // invoice number (assigned automatically when ATS records the join) — the
  // main table lists one row per invoice number, matching the reference
  // Work page, with the underlying candidate rows visible on expand.
  const invoiceGroupMap = new Map();
  scopedRows.forEach((i) => {
    const key = i.invoiceNumber || `__row_${i.id}`;
    const cur = invoiceGroupMap.get(key) || {
      key, invoiceNumber: i.invoiceNumber, invoiceDate: i.invoiceDate, dueDate: i.dueDate,
      client: i.client, rows: [], before: 0, gst: 0, tds: 0, total: 0, received: 0, pending: 0,
    };
    cur.rows.push(i);
    cur.before += Number(i.amount || 0);
    cur.gst += Number(i.gst || 0);
    cur.tds += Number(i.tds || 0);
    cur.total += i.total;
    cur.received += Number(i.receivedAmount || 0);
    cur.pending += i.outstanding;
    if (i.invoiceDate < cur.invoiceDate) cur.invoiceDate = i.invoiceDate;
    invoiceGroupMap.set(key, cur);
  });
  const invoiceGroups = [...invoiceGroupMap.values()].sort((a, b) => (b.invoiceDate || '').localeCompare(a.invoiceDate || ''));

  function groupStatus(g) {
    if (g.rows.every((r) => r.status === 'Cancelled')) return 'Cancelled';
    if (g.pending <= 0.5) return 'Paid';
    if (g.rows.some((r) => r.status === 'Overdue')) return 'Overdue';
    if (g.received > 0.5) return 'Partially Paid';
    return 'Pending';
  }
  function toggleExpand(key) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function saveView(e) {
    e.preventDefault();
    if (!newViewName.trim()) return;
    await api.post('/invoices/saved-views', { name: newViewName.trim(), filters: { period, age, groupBy, status } });
    setNewViewName('');
    load();
  }
  function applyView(v) {
    if (v.filters.period) setPeriod(v.filters.period);
    if (v.filters.age) setAge(v.filters.age);
    if (v.filters.groupBy) setGroupBy(v.filters.groupBy);
    if (v.filters.status) setStatus(v.filters.status);
  }
  async function deleteView(id) {
    await api.delete(`/invoices/saved-views/${id}`);
    load();
  }

  function openTds(i) {
    setTdsTarget(i);
    const c = i.tdsCertificate;
    setTdsForm({ status: c?.status || 'Not received', certNumber: c?.certNumber || '', certDate: c?.certDate || '', quarter: c?.quarter || '', amount: c?.amount != null ? String(c.amount) : String(i.tds || ''), notes: c?.notes || '' });
  }
  async function saveTds() {
    await api.put(`/invoices/${tdsTarget.id}/tds-certificate`, tdsForm);
    setTdsTarget(null);
    load();
  }

  function openPay(i) {
    setPayTarget(i);
    setPayForm({ amount: i.outstanding > 0.5 ? String(i.outstanding) : '', date: new Date().toISOString().slice(0, 10), method: 'Bank Transfer', reference: '' });
  }
  async function savePay() {
    setError('');
    try {
      await api.post(`/invoices/${payTarget.id}/payments`, { ...payForm, amount: Number(payForm.amount) });
      setPayTarget(null);
      load();
    } catch (e) {
      setError(e.response?.data?.error || 'That did not work.');
    }
  }

  function exportInvoiceAccounts() {
    downloadCsv('invoice-accounts.csv',
      ['Invoice No', 'Invoice Date', 'Client', 'Billing Type', 'Candidates', 'Before GST', 'GST', 'After GST', 'TDS', 'Received', 'Pending', 'Status', 'Due Date'],
      invoiceGroups.map((g) => [g.invoiceNumber || g.rows[0].id.slice(-6), g.invoiceDate, g.client?.name, billingTypeOf(g), g.rows.length, g.before, g.gst, g.before + g.gst, g.tds, g.received, g.pending, groupStatus(g), g.dueDate || '']));
  }
  function exportInstalments() {
    const lines = [];
    invoiceGroups.forEach((g) => g.rows.forEach((i) => (i.payments || []).forEach((p) => {
      lines.push([g.invoiceNumber || i.id.slice(-6), i.client?.name, i.candidate?.name || i.candidateName || '—', p.date, p.amount, p.method, p.reference || '', p.recordedBy || '']);
    })));
    downloadCsv('instalments.csv', ['Invoice No', 'Client', 'Candidate', 'Date', 'Amount', 'Method', 'Reference', 'Recorded By'], lines);
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Invoices</h1>
          <div className="page-sub">An invoice is worth amount + GST − TDS: TDS is deducted at source, so it never reaches the bank.</div>
        </div>
      </div>

      {summary && (
        <div className="statbar">
          <Stat n={money(summary.invoiced)} l="Invoiced" />
          <Stat n={money(summary.received)} l="Received" />
          <Stat n={money(summary.outstanding)} l="Outstanding" />
          <Stat n={money(summary.gstCharged)} l="GST charged" />
          <Stat n={money(summary.tdsDeducted)} l="TDS deducted" />
        </div>
      )}

      {error && <div className="card section error-text" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="tabbar">
        {STATUSES.map((s) => (
          <button key={s} className={`tab-btn ${status === s ? 'active' : ''}`} onClick={() => setStatus(s)}>
            {s}{s !== 'All' ? ` (${invoices.filter((i) => i.status === s).length})` : ''}
          </button>
        ))}
      </div>

      {/* --- Additive Work-page controls: period, ageing, grouping, saved views --- */}
      <div className="filter-row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
        <PeriodPicker value={period} onChange={setPeriod} label={period.mode === 'ALL' ? 'All time' : 'Period'} />
        <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
          {GROUP_MODES.map(([k, l]) => <option key={k} value={k}>Group by {l}</option>)}
        </select>
        {savedViews.map((v) => (
          <span key={v.id} className="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <button className="link-btn" onClick={() => applyView(v)}>{v.name}</button>
            <button className="link-btn" onClick={() => deleteView(v.id)} title="Remove view">×</button>
          </span>
        ))}
        <form onSubmit={saveView} style={{ display: 'inline-flex', gap: 4 }}>
          <input placeholder="Save this view as…" value={newViewName} onChange={(e) => setNewViewName(e.target.value)} style={{ width: 160 }} />
          <button className="btn btn-sm" type="submit">＋ Save view</button>
        </form>
      </div>

      <div className="filter-row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        <span className="small-muted" style={{ alignSelf: 'center' }}>HOW OLD IS THE OUTSTANDING:</span>
        {ageCounts.map((b) => (
          <button key={b.label} className={`btn btn-sm ${age === b.label ? 'btn-primary' : ''}`} disabled={b.count === 0} onClick={() => setAge(age === b.label ? 'All' : b.label)}>
            {b.label} ({b.count}{b.amount > 0.5 ? ` · ${money(b.amount)}` : ''})
          </button>
        ))}
        {age !== 'All' && <button className="btn btn-sm btn-ghost" onClick={() => setAge('All')}>All</button>}
      </div>

      {groupBy !== 'inv' && (
        <div className="card section">
          <h3>Grouped by {GROUP_MODES.find(([k]) => k === groupBy)[1]}</h3>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>{GROUP_MODES.find(([k]) => k === groupBy)[1]}</th><th>Invoices</th><th>Before GST</th><th>GST</th><th>Total</th><th>Received</th><th>Pending</th></tr></thead>
              <tbody>
                {grouped.map((g) => (
                  <tr key={g.key}>
                    <td>{g.key}</td><td>{g.count}</td><td>{money(g.before)}</td><td>{money(g.gst)}</td>
                    <td style={{ fontWeight: 600 }}>{money(g.total)}</td><td>{money(g.received)}</td>
                    <td style={{ fontWeight: 700 }}>{money(g.pending)}</td>
                  </tr>
                ))}
                {grouped.length === 0 && <tr><td colSpan="7" className="small-muted">Nothing matches these filters.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- Table toolbar: matches the reference Work page's local actions --- */}
      <div className="filter-row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 8, position: 'relative' }}>
        <div style={{ position: 'relative' }}>
          <button className="btn btn-sm" onClick={() => setShowColMenu((v) => !v)}>☰ Columns</button>
          {showColMenu && (
            <div className="card section" style={{ position: 'absolute', zIndex: 20, top: '100%', left: 0, marginTop: 4, width: 220 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400 }}>
                <input type="checkbox" checked={showMoneyCols} onChange={(e) => setShowMoneyCols(e.target.checked)} />
                Show GST / TDS / Status / Due
              </label>
            </div>
          )}
        </div>
        <button className="btn btn-sm" onClick={exportInvoiceAccounts}>⬇ Invoice accounts</button>
        <button className="btn btn-sm" onClick={exportInstalments}>⬇ Instalments</button>
      </div>

      <div className="tbl-wrap tbl-wrap-scroll5">
        <table>
          <thead>
            <tr>
              <th></th><th>Invoice No</th><th>Invoice Date</th><th>Client</th><th>Billing Type</th>
              {showMoneyCols && (<><th>Candidates</th><th>Before GST</th><th>GST</th><th>After GST</th><th>TDS</th><th>Received</th><th>Pending</th><th>Status</th><th>Due</th></>)}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoiceGroups.map((g) => {
              const isOpen = expanded.has(g.key);
              const status = groupStatus(g);
              return (
                <Fragment key={g.key}>
                  <tr>
                    <td>
                      <button className="link-btn" onClick={() => toggleExpand(g.key)} title="Show this invoice's account">{isOpen ? '▾' : '▸'}</button>
                    </td>
                    <td>
                      {g.invoiceNumber ? (
                        <button className="link-btn" onClick={() => setPrintTarget(g.invoiceNumber)}>{g.invoiceNumber}</button>
                      ) : (
                        <Link to={`/invoices/${g.rows[0].id}`}>{g.rows[0].id.slice(-6)}</Link>
                      )}
                    </td>
                    <td>{g.invoiceDate}</td>
                    <td>{g.client?.name}</td>
                    <td className="small-muted">{billingTypeOf(g)}</td>
                    {showMoneyCols && (
                      <>
                        <td>{g.rows.length}</td>
                        <td>{money(g.before)}</td>
                        <td>{money(g.gst)}</td>
                        <td style={{ fontWeight: 600 }}>{money(g.before + g.gst)}</td>
                        <td>−{money(g.tds)}</td>
                        <td>{money(g.received)}</td>
                        <td style={{ fontWeight: 700 }}>{money(g.pending)}</td>
                        <td><span className={`status ${statusClass(status)}`}>{status}</span></td>
                        <td>{g.dueDate || '—'}</td>
                      </>
                    )}
                    <td>
                      <Link to={`/invoices/${g.rows[0].id}`}>₹ Account</Link>{' '}
                      {g.invoiceNumber && <button className="link-btn" onClick={() => setPrintTarget(g.invoiceNumber)}>👁 View</button>}{' '}
                      {canManage && g.pending > 0.5 && status !== 'Cancelled' && (
                        <button className="link-btn" onClick={() => openPay(g.rows.find((r) => r.outstanding > 0.5) || g.rows[0])}>+ Payment</button>
                      )}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="small-muted">
                      <td></td>
                      <td colSpan={showMoneyCols ? 14 : 5} style={{ padding: 0 }}>
                        <table style={{ width: '100%' }}>
                          <thead>
                            <tr>
                              <th style={{ paddingLeft: 24 }}>Candidate</th><th>Before GST</th><th>GST</th><th>After GST</th>
                              <th>TDS</th><th>Received</th><th>Pending</th><th>Status</th><th>Due</th><th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.rows.map((i) => (
                              <tr key={i.id}>
                                <td style={{ paddingLeft: 24 }}>
                                  {i.candidate?.name || i.candidateName || '—'}
                                  {(i.requirement?.department || i.department) && <span> · {i.requirement?.department || i.department}</span>}
                                </td>
                                <td>{money(i.amount)}</td>
                                <td>{money(i.gst)}</td>
                                <td>{money(i.amount + i.gst)}</td>
                                <td>−{money(i.tds)}</td>
                                <td>{money(i.receivedAmount)}</td>
                                <td>{money(i.outstanding)}</td>
                                <td><span className={`status ${statusClass(i.status)}`}>{i.status}</span></td>
                                <td>{i.dueDate || '—'}</td>
                                <td>
                                  <Link to={`/invoices/${i.id}`}>Account</Link>{' '}
                                  {canManage && i.outstanding > 0.5 && i.status !== 'Cancelled' && (
                                    <button className="link-btn" onClick={() => openPay(i)}>+ Payment</button>
                                  )}{' '}
                                  {canManage && i.outstanding > 0.5 && i.status !== 'Cancelled' && (
                                    <button className="link-btn" onClick={() => markPaid(i.id)}>Settle in full</button>
                                  )}{' '}
                                  {canManage && i.tds > 0.5 && (
                                    <button className="link-btn" onClick={() => openTds(i)}>
                                      {i.tdsCertificate?.status === 'Received' ? '✓ TDS cert' : 'TDS certificate'}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {invoiceGroups.length === 0 && <tr><td colSpan={showMoneyCols ? 15 : 6} className="small-muted">No invoices in this state.</td></tr>}
          </tbody>
        </table>
      </div>

      {printTarget && <InvoicePrintModal invoiceNumber={printTarget} onClose={() => setPrintTarget(null)} />}

      {payTarget && (
        <div className="card section" style={{ borderColor: 'var(--accent)' }}>
          <h3>Record payment</h3>
          <div className="page-sub">Invoice {payTarget.invoiceNumber || payTarget.id.slice(-6)} · {payTarget.client?.name} · outstanding {money(payTarget.outstanding)}</div>
          <div className="grid-2">
            <label className="field"><span>Amount (₹)</span><input type="number" step="0.01" max={payTarget.outstanding} value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} /></label>
            <label className="field"><span>Date</span><input type="date" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} /></label>
            <label className="field">
              <span>Method</span>
              <select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>
                <option>Bank Transfer</option><option>Cheque</option><option>UPI</option><option>Cash</option>
              </select>
            </label>
            <label className="field"><span>Reference / UTR</span><input value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} /></label>
          </div>
          <button className="btn btn-sm" onClick={() => setPayTarget(null)}>Cancel</button>{' '}
          <button className="btn btn-sm btn-primary" onClick={savePay}>Record payment</button>
        </div>
      )}

      {tdsTarget && (
        <div className="card section" style={{ borderColor: 'var(--warn)' }}>
          <h3>TDS certificate — Form 16A</h3>
          <div className="page-sub">Invoice {tdsTarget.invoiceNumber || tdsTarget.id.slice(-6)} · {tdsTarget.client?.name} · TDS deducted {money(tdsTarget.tds)}</div>
          <div className="grid-2">
            <label className="field">
              <span>Has the client given the Form 16A / TDS certificate?</span>
              <select value={tdsForm.status} onChange={(e) => setTdsForm({ ...tdsForm, status: e.target.value })}>
                <option>Not received</option><option>Received</option>
              </select>
            </label>
            <label className="field"><span>Certificate number</span><input value={tdsForm.certNumber} onChange={(e) => setTdsForm({ ...tdsForm, certNumber: e.target.value })} /></label>
            <label className="field"><span>Certificate date</span><input type="date" value={tdsForm.certDate} onChange={(e) => setTdsForm({ ...tdsForm, certDate: e.target.value })} /></label>
            <label className="field">
              <span>Quarter</span>
              <select value={tdsForm.quarter} onChange={(e) => setTdsForm({ ...tdsForm, quarter: e.target.value })}>
                <option value="">Select</option>
                <option>Q1 (Apr–Jun)</option><option>Q2 (Jul–Sep)</option><option>Q3 (Oct–Dec)</option><option>Q4 (Jan–Mar)</option>
              </select>
            </label>
            <label className="field"><span>Amount in the certificate</span><input type="number" step="0.01" value={tdsForm.amount} onChange={(e) => setTdsForm({ ...tdsForm, amount: e.target.value })} /></label>
            <label className="field"><span>Notes</span><input value={tdsForm.notes} onChange={(e) => setTdsForm({ ...tdsForm, notes: e.target.value })} /></label>
          </div>
          <div className="small-muted" style={{ margin: '8px 0' }}>TDS is your money — the client already paid it to the Income Tax Department against your PAN. Without the certificate you cannot claim that credit when you file, so chase every one of these.</div>
          <button className="btn btn-sm" onClick={() => setTdsTarget(null)}>Cancel</button>{' '}
          <button className="btn btn-sm btn-primary" onClick={saveTds}>Save</button>
        </div>
      )}
    </div>
  );
}

function Stat({ n, l }) {
  return <div className="statitem"><div className="n">{n}</div><div className="l">{l}</div></div>;
}
