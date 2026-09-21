import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';

const ACCOUNTS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'];

// "Received and Paid mean the same thing — the whole invoice is in."
const PAY_STATUS = ['All', 'Pending', 'Partially Paid', 'Overdue', 'Paid', 'Cancelled'];

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export function statusClass(status) {
  if (status === 'Overdue') return 'priority-high';
  if (status === 'Paid') return 'priority-low';
  if (status === 'Partially Paid') return 'priority-medium';
  return '';
}

// The invoice lens: the column set the accounting application offers, in its
// own order. Invoice no, date, client, received and pending are always on; the
// rest are yours to show or hide.
const WORK_COLS = [
  ['btype', 'Billing type'], ['gstyn', 'Client paying GST'], ['cgstin', 'Client GSTIN'],
  ['dept', 'Department'], ['rec', 'Recruiter'], ['cand', 'Candidates'],
  ['before', 'Before GST'], ['gst', 'GST'], ['after', 'After GST'], ['tds', 'TDS'], ['receivable', 'Receivable'],
  ['pays', 'Payments'], ['proof', 'Proof'], ['tdscert', 'TDS certificate'],
  ['status', 'Status'], ['due', 'Due date'], ['age', 'Age'], ['sent', 'Sent'],
];

// Everything except "Sent" is on out of the box, exactly as the application
// opens: the accountant hides what they do not want, rather than hunting for
// the column they do.
const DEFAULT_COLS = {
  btype: true, gstyn: true, cgstin: true, dept: true, rec: true, cand: true,
  before: true, gst: true, after: true, tds: true, receivable: true,
  pays: true, proof: true, tdscert: true, status: true, due: true, age: true, sent: false,
};

// The table header says "TDS cert"; the column chooser spells it out.
const HEADER_LABEL = { tdscert: 'TDS cert' };

const GROUP_BY = [['inv', 'Invoice'], ['client', 'Client'], ['dept', 'Department'], ['rec', 'Recruiter'], ['month', 'Invoice month']];

const NUM_COLS = new Set(['cand', 'before', 'gst', 'after', 'tds', 'receivable', 'received', 'pending', 'pays']);

const VIEWS_KEY = 'tl.invoices.savedViews';

const loadViews = () => {
  try { return JSON.parse(localStorage.getItem(VIEWS_KEY) || '[]'); } catch { return []; }
};

export default function Invoices() {
  const { user } = useAuth();
  const canManage = ACCOUNTS_ROLES.includes(user?.role);

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('all');
  const [filters, setFilters] = useState({ client: 'All', dept: 'All', rec: 'All', gstin: 'All', status: 'All', q: '' });
  const [age, setAge] = useState('All');
  const [group, setGroup] = useState('inv');
  const [cols, setCols] = useState(DEFAULT_COLS);
  const [showCols, setShowCols] = useState(false);
  const [open, setOpen] = useState({});
  const [views, setViews] = useState(loadViews);

  const load = useCallback(() => {
    api.get('/invoices/register', { params: { period } })
      .then((res) => setData(res.data))
      .catch((e) => setError(e.response?.data?.error || 'That did not work.'));
  }, [period]);
  useEffect(load, [load]);

  async function run(fn) {
    setError('');
    try { await fn(); load(); } catch (e) { setError(e.response?.data?.error || 'That did not work.'); }
  }

  const rows = useMemo(() => {
    if (!data) return [];
    return data.rows.filter((r) => {
      if (filters.client !== 'All' && r.client !== filters.client) return false;
      if (filters.dept !== 'All' && r.department !== filters.dept) return false;
      if (filters.rec !== 'All' && r.recruiter !== filters.rec) return false;
      if (filters.status !== 'All' && r.status !== filters.status) return false;
      if (filters.gstin === 'Yes' && !r.clientPayingGst) return false;
      if (filters.gstin === 'No' && r.clientPayingGst) return false;
      if (age !== 'All' && r.age !== age) return false;
      const q = filters.q.trim().toLowerCase();
      if (q && ![r.invoiceNumber, r.client, r.candidateName, r.department, r.recruiter, r.clientGstin]
        .join(' ').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, filters, age]);

  const active = useMemo(() => {
    const C = [['inv', 'Invoice no'], ['date', 'Invoice date'], ['client', 'Client']];
    WORK_COLS.forEach(([k, label]) => {
      if (['pays', 'proof', 'tdscert', 'status', 'due', 'age', 'sent'].includes(k)) return;
      if (cols[k]) C.push([k, label]);
    });
    C.push(['received', 'Received'], ['pending', 'Pending']);
    ['pays', 'proof', 'tdscert', 'status', 'due', 'age', 'sent'].forEach((k) => {
      if (cols[k]) C.push([k, HEADER_LABEL[k] || WORK_COLS.find((c) => c[0] === k)[1]]);
    });
    C.push(['act', 'Actions']);
    return C;
  }, [cols]);

  if (!data) return <div className="small-muted">Loading…</div>;
  const k = data.kpis;

  const groupKeyOf = (r) => (group === 'client' ? r.client
    : group === 'dept' ? (r.department || '—')
      : group === 'rec' ? (r.recruiter || 'not assigned')
        : group === 'month' ? String(r.invoiceDate || '').slice(0, 7) || '—' : null);

  const sum = (list, f) => Math.round(list.reduce((s, r) => s + f(r), 0) * 100) / 100;
  const totals = {
    cand: sum(rows, (r) => r.candidates),
    before: sum(rows, (r) => r.billing),
    gst: sum(rows, (r) => r.gst),
    after: sum(rows, (r) => r.invoiceValue),
    tds: sum(rows, (r) => r.tds),
    receivable: sum(rows, (r) => r.receivable),
    received: sum(rows, (r) => r.received),
    pending: sum(rows, (r) => r.pending),
  };

  const cell = (key, r) => {
    switch (key) {
      case 'inv': return (
        <td key={key}>
          <button className="acct-exp" onClick={() => setOpen({ ...open, [r.id]: !open[r.id] })} title="Open everything about this invoice here">{open[r.id] ? '▾' : '▸'}</button>
          <Link to={`/invoices/${r.id}`}>{r.invoiceNumber}</Link>
        </td>
      );
      case 'date': return <td key={key}>{r.invoiceDate}</td>;
      case 'client': return <td key={key}>{r.client}</td>;
      case 'btype': return <td key={key} className="small-muted">{r.billingType}</td>;
      case 'gstyn': return <td key={key}>{r.clientPayingGst ? 'Yes' : 'No'}</td>;
      case 'cgstin': return (
        <td key={key} className="small-muted">
          {r.clientGstin || (r.gst > 0.5 ? <span className="status priority-high">missing</span> : 'Not registered')}
        </td>
      );
      case 'dept': return <td key={key}>{r.department}</td>;
      case 'rec': return <td key={key}>{r.recruiter || <span className="small-muted">not assigned</span>}</td>;
      case 'cand': return <td key={key} className="num">{r.candidates}</td>;
      case 'before': return <td key={key} className="num" style={{ fontWeight: 600 }}>{money(r.billing)}</td>;
      case 'gst': return <td key={key} className="num">{money(r.gst)}</td>;
      case 'after': return <td key={key} className="num" style={{ fontWeight: 600 }}>{money(r.invoiceValue)}</td>;
      case 'tds': return <td key={key} className="num">{money(r.tds)}</td>;
      case 'receivable': return <td key={key} className="num">{money(r.receivable)}</td>;
      case 'received': return <td key={key} className="num">{money(r.received)}</td>;
      case 'pending': return <td key={key} className="num" style={{ fontWeight: 600 }}>{money(r.pending)}</td>;
      case 'pays': return <td key={key} className="num">{r.paymentCount || '—'}{r.paymentCount ? <div className="small-muted">{r.paymentMethods.join(', ')}</div> : null}</td>;
      case 'proof': return <td key={key}>{r.proof ? <span className={`status ${r.proof === 'attached' ? 'priority-low' : 'priority-high'}`}>{r.proof}</span> : <span className="small-muted">—</span>}</td>;
      case 'tdscert': return (
        <td key={key}>
          {r.tdsCert
            ? (
              <>
                <span className={`status ${r.tdsCert === 'in hand' ? 'priority-low' : 'priority-high'}`}>{r.tdsCert}</span>
                {canManage && (
                  <button className="btn btn-sm" style={{ marginLeft: 6 }} onClick={() => run(() => api.patch(`/invoices/${r.id}/tds-certificate`, { received: r.tdsCert !== 'in hand' }))}>
                    {r.tdsCert === 'in hand' ? 'Undo' : 'Got it'}
                  </button>
                )}
              </>
            )
            : <span className="small-muted">no TDS</span>}
        </td>
      );
      case 'status': return <td key={key}><span className={`status ${statusClass(r.status)}`}>{r.status}</span></td>;
      case 'due': return <td key={key}>{r.dueDate || '—'}</td>;
      case 'age': return (
        <td key={key}>
          <span className={`status ${r.age === '90+ days' || r.age === '61–90 days' ? 'priority-high' : r.age === 'Settled' ? 'priority-low' : ''}`}>{r.age}</span>
          {r.daysOverdue > 0 && r.pending > 0.5 && <div className="small-muted">{r.daysOverdue} day(s)</div>}
        </td>
      );
      case 'sent': return (
        <td key={key}>
          {r.sentVia
            ? <span className="status priority-low">{r.sentVia} · {r.sentDate}</span>
            : (
              <>
                <span className="status">Not sent</span>
                {canManage && <button className="btn btn-sm" style={{ marginLeft: 6 }} onClick={() => run(() => api.patch(`/invoices/${r.id}/sent`, { via: 'Email' }))}>Mark sent</button>}
              </>
            )}
        </td>
      );
      default: return (
        <td key={key} style={{ whiteSpace: 'nowrap' }}>
          <div className="qa-row">
            <Link className="btn btn-sm" to={`/invoices/${r.id}`}>₹ Account</Link>
            {canManage && r.pending > 0.5 && r.status !== 'Cancelled' && (
              <button className="btn btn-sm" onClick={() => run(() => api.patch(`/invoices/${r.id}/pay`))}>Settle in full</button>
            )}
          </div>
        </td>
      );
    }
  };

  const expandRow = (r) => (
    <tr key={`${r.id}-exp`} className="acct-kid">
      <td colSpan={active.length}>
        <div className="grid-3">
          <div>
            <div className="section-label">Candidate</div>
            <div className="kv"><span className="k">Name</span><span>{r.candidateName || '—'}</span></div>
            <div className="kv"><span className="k">Department</span><span>{r.department}</span></div>
            <div className="kv"><span className="k">Recruiter</span><span>{r.recruiter || 'not assigned'}</span></div>
            <div className="kv"><span className="k">Billing type</span><span>{r.billingType}</span></div>
          </div>
          <div>
            <div className="section-label">What this invoice bills</div>
            <div className="kv"><span className="k">Fee before GST</span><span>{money(r.billing)}</span></div>
            <div className="kv"><span className="k">GST{r.gstPercent != null ? ` @ ${r.gstPercent}%` : ''}</span><span>+ {money(r.gst)}</span></div>
            <div className="kv"><span className="k">After GST</span><span>{money(r.invoiceValue)}</span></div>
            <div className="kv"><span className="k">TDS{r.tdsPercent != null ? ` @ ${r.tdsPercent}%` : ''}</span><span>− {money(r.tds)}</span></div>
            <div className="kv" style={{ fontWeight: 700 }}><span className="k">Receivable</span><span>{money(r.receivable)}</span></div>
          </div>
          <div>
            <div className="section-label">Instalments</div>
            {r.payments.length === 0 && <div className="small-muted">Nothing received yet.</div>}
            {r.payments.map((p) => (
              <div className="kv" key={p.id}>
                <span className="k">{p.date} · {p.method}{p.reference ? ` · ${p.reference}` : ''}</span>
                <span>{money(p.amount)}</span>
              </div>
            ))}
            <div className="kv" style={{ fontWeight: 700 }}><span className="k">Pending</span><span>{money(r.pending)}</span></div>
          </div>
        </div>
      </td>
    </tr>
  );

  let body;
  if (group === 'inv') {
    body = rows.flatMap((r) => (open[r.id] ? [<tr key={r.id}>{active.map(([key]) => cell(key, r))}</tr>, expandRow(r)] : [<tr key={r.id}>{active.map(([key]) => cell(key, r))}</tr>]));
  } else {
    const map = new Map();
    rows.forEach((r) => {
      const gk = String(groupKeyOf(r) || '—');
      if (!map.has(gk)) map.set(gk, []);
      map.get(gk).push(r);
    });
    body = [...map.entries()].map(([gk, list]) => (
      <Fragment key={`g-${gk}`}>
        <tr style={{ fontWeight: 600 }}>
          <td>
            <button className="acct-exp" onClick={() => setOpen({ ...open, [`G:${gk}`]: !open[`G:${gk}`] })}>{open[`G:${gk}`] ? '▾' : '▸'}</button>
            {gk}
          </td>
          <td className="small-muted">{list.length} invoice(s)</td>
          {active.slice(2).map(([key]) => (NUM_COLS.has(key)
            ? <td key={key} className="num">{key === 'cand' ? sum(list, (r) => r.candidates) : money(sum(list, (r) => ({ before: r.billing, gst: r.gst, after: r.invoiceValue, tds: r.tds, receivable: r.receivable, received: r.received, pending: r.pending, pays: r.paymentCount }[key] || 0)))}</td>
            : <td key={key} />))}
        </tr>
        {open[`G:${gk}`] && list.flatMap((r) => [<tr key={r.id} className="acct-kid">{active.map(([key]) => cell(key, r))}</tr>, ...(open[r.id] ? [expandRow(r)] : [])])}
      </Fragment>
    ));
  }

  const saveView = () => {
    const name = window.prompt('Name this view');
    if (!name) return;
    const next = [...views.filter((v) => v.name !== name), { name, period, filters, age, group, cols }];
    setViews(next);
    try { localStorage.setItem(VIEWS_KEY, JSON.stringify(next)); } catch { /* private window */ }
  };
  const applyView = (v) => { setPeriod(v.period); setFilters(v.filters); setAge(v.age); setGroup(v.group); setCols(v.cols); };
  const deleteView = (name) => {
    const next = views.filter((v) => v.name !== name);
    setViews(next);
    try { localStorage.setItem(VIEWS_KEY, JSON.stringify(next)); } catch { /* private window */ }
  };

  const anyFilter = filters.client !== 'All' || filters.dept !== 'All' || filters.rec !== 'All'
    || filters.gstin !== 'All' || filters.status !== 'All' || filters.q.trim() || age !== 'All';

  const tc = data.tdsCertificates;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Invoices</h1>
          <div className="page-sub">
            Everything about a client invoice on one page — filters, the headline numbers, the candidates
            and the invoice table with its account, printable copy and payments.
          </div>
        </div>
      </div>

      {error && <div className="card section error-text" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="filter-row">
        <label className="field"><span>Client</span>
          <select value={filters.client} onChange={(e) => setFilters({ ...filters, client: e.target.value })}>
            <option>All</option>{data.clients.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="field"><span>Period</span>
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="all">Every month on record</option>
            <option value={`FY:${new Date().getMonth() + 1 >= 4 ? new Date().getFullYear() : new Date().getFullYear() - 1}`}>This financial year</option>
            <option value={`FY:${(new Date().getMonth() + 1 >= 4 ? new Date().getFullYear() : new Date().getFullYear() - 1) - 1}`}>Last financial year</option>
          </select>
        </label>
        <label className="field"><span>Department</span>
          <select value={filters.dept} onChange={(e) => setFilters({ ...filters, dept: e.target.value })}>
            <option>All</option>{data.departments.map((d) => <option key={d}>{d}</option>)}
          </select>
        </label>
        <label className="field"><span>Recruiter · {data.recruiters.length}</span>
          <select value={filters.rec} onChange={(e) => setFilters({ ...filters, rec: e.target.value })}>
            <option>All</option>{data.recruiters.map((r) => <option key={r}>{r}</option>)}
          </select>
        </label>
        <label className="field"><span>GST charged</span>
          <select value={filters.gstin} onChange={(e) => setFilters({ ...filters, gstin: e.target.value })}>
            <option value="All">All</option>
            <option value="Yes">Yes — GST on this invoice</option>
            <option value="No">No — no GST on this invoice</option>
          </select>
        </label>
        <label className="field"><span>Status</span>
          <select title="Received and Paid mean the same thing — the whole invoice is in" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            {PAY_STATUS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="field" style={{ minWidth: 220 }}><span>Search anything</span>
          <input value={filters.q} placeholder="Candidate, client, invoice no, position…" onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
        </label>
        {anyFilter && (
          <button className="btn btn-sm" onClick={() => { setFilters({ client: 'All', dept: 'All', rec: 'All', gstin: 'All', status: 'All', q: '' }); setAge('All'); }}>Reset all</button>
        )}
      </div>

      <div className="statbar">
        <Stat n={k.candidates} l="Total candidates" s={`${k.invoices} invoice(s)`} />
        <Stat n={k.clients} l="Total clients" s={`${k.invoices} invoice(s)`} />
        <Stat n={money(k.invoiceValue)} l="Total amount" s={`before GST ${money(k.billing)} + GST ${money(k.gst)} = ${money(k.invoiceValue)} − TDS ${money(k.tds)} = ${money(k.receivable)} receivable`} />
        <Stat n={money(k.received)} l="Amount received" s={`${k.receivable ? Math.round((k.received / k.receivable) * 100) : 0}% of ${money(k.receivable)} receivable`} tone="good" />
        <Stat n={money(k.pending)} l="Pending amount" s={`of ${money(k.receivable)} receivable`} tone="bad" />
        <Stat n={k.overdueCount} l="Overdue invoices" s={k.overdueCount ? `${money(k.overdueValue)} past due date` : 'nothing past due'} tone="bad" />
      </div>

      <div className="filter-row">
        <span className="section-label" style={{ marginRight: 4 }}>How old is the outstanding</span>
        <button className={`btn btn-sm ${age === 'All' ? 'btn-primary' : ''}`} onClick={() => setAge('All')}>All {data.rows.length}</button>
        {data.ageing.map((b) => (
          <button key={b.bucket} className={`btn btn-sm ${age === b.bucket ? 'btn-primary' : ''}`} disabled={!b.count} onClick={() => setAge(age === b.bucket ? 'All' : b.bucket)}>
            {b.bucket} <b>{b.count}</b>{b.outstanding ? ` ${money(b.outstanding)}` : ''}
          </button>
        ))}
        {tc.toCollect > 0
          ? <span className="status priority-high">TDS to collect {money(tc.toCollectValue)} · {tc.toCollect} certificate(s)</span>
          : tc.inHandValue > 0
            ? <span className="status priority-low">All TDS certificates in hand · {money(tc.inHandValue)}</span>
            : <span className="small-muted">Click a bucket to see only those invoices</span>}
      </div>

      <div className="filter-row">
        <span className="section-label" style={{ marginRight: 4 }}>Saved views</span>
        {views.length === 0 && <span className="small-muted">None yet — set your filters, then save the combination so you never set them again.</span>}
        {views.map((v) => (
          <span className="chip" key={v.name}>
            <button className="link-btn" onClick={() => applyView(v)}>{v.name}</button>
            <button title="Remove" onClick={() => deleteView(v.name)}>×</button>
          </span>
        ))}
        <button className="btn btn-sm" onClick={saveView}>＋ Save this view</button>
        <label className="field"><span>Group by</span>
          <select value={group} onChange={(e) => { setGroup(e.target.value); setOpen({}); }}>
            {GROUP_BY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <button className="btn btn-sm" onClick={() => setShowCols((v) => !v)}>▦ Columns</button>
      </div>

      {showCols && (
        <div className="card section">
          <h3>Show these columns</h3>
          <div className="grid-4">
            {WORK_COLS.map(([key, label]) => (
              <label key={key} className="small-muted" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={!!cols[key]} onChange={(e) => setCols({ ...cols, [key]: e.target.checked })} /> {label}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="card section">
        <h3>Invoices · {rows.length}</h3>
        <div className="small-muted" style={{ marginBottom: 10 }}>
          {k.candidates} candidate(s) — click ▸ on an invoice to see its candidates, its instalments and the GST / TDS breakdown
        </div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>{active.map(([key, label]) => <th key={key} className={NUM_COLS.has(key) ? 'num' : ''}>{label}</th>)}</tr>
            </thead>
            <tbody>
              {body}
              {rows.length === 0 && <tr><td colSpan={active.length} className="small-muted">No invoice matches these filters.</td></tr>}
            </tbody>
            <tfoot>
              <tr>
                {active.map(([key]) => {
                  if (key === 'inv') return <td key={key}>TOTAL</td>;
                  if (key === 'cand') return <td key={key} className="num">{totals.cand}</td>;
                  if (totals[key] !== undefined) return <td key={key} className="num">{money(totals[key])}</td>;
                  return <td key={key} />;
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ n, l, s, tone }) {
  return (
    <div className={`statitem${tone ? ` acct-${tone}` : ''}`}>
      <div className="n">{n}</div>
      <div className="l">{l}</div>
      {s && <div className="s">{s}</div>}
    </div>
  );
}
