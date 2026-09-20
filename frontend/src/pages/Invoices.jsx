import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import PeriodPicker from '../components/PeriodPicker.jsx';

const ACCOUNTS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'];
const STATUSES = ['All', 'Pending', 'Partially Paid', 'Overdue', 'Paid', 'Cancelled'];

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
    if (groupBy === 'dept') return i.requirement?.department || '—';
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

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Invoice</th><th>Client</th><th>Candidate</th>
              <th>Amount</th><th>GST</th><th>TDS</th><th>Total</th>
              <th>Received</th><th>Outstanding</th><th>Status</th><th>Due</th>
              {canManage && <th></th>}
            </tr>
          </thead>
          <tbody>
            {scopedRows.map((i) => (
              <tr key={i.id}>
                <td><Link to={`/invoices/${i.id}`}>{i.invoiceNumber || i.id.slice(-6)}</Link></td>
                <td>{i.client?.name}</td>
                <td>{i.candidate?.name || '—'}</td>
                <td>{money(i.amount)}</td>
                <td>{money(i.gst)}</td>
                <td>−{money(i.tds)}</td>
                <td style={{ fontWeight: 600 }}>{money(i.total)}</td>
                <td>{money(i.receivedAmount)}</td>
                <td>{money(i.outstanding)}</td>
                <td><span className={`status ${statusClass(i.status)}`}>{i.status}</span></td>
                <td>{i.dueDate || '—'}</td>
                {canManage && (
                  <td>
                    {i.outstanding > 0.5 && i.status !== 'Cancelled' && (
                      <button className="btn btn-sm" onClick={() => markPaid(i.id)}>Settle in full</button>
                    )}{' '}
                    {i.tds > 0.5 && (
                      <button className="btn btn-sm" onClick={() => openTds(i)}>
                        {i.tdsCertificate?.status === 'Received' ? '✓ TDS cert' : 'TDS certificate'}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {scopedRows.length === 0 && <tr><td colSpan={canManage ? 12 : 11} className="small-muted">No invoices in this state.</td></tr>}
          </tbody>
        </table>
      </div>

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
