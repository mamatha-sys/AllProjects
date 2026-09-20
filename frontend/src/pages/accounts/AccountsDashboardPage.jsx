import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import PeriodPicker from '../../components/PeriodPicker.jsx';

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const lakh = (n) => `₹${(Number(n || 0) / 100000).toFixed(1)}L`;

export default function AccountsDashboardPage() {
  const [period, setPeriod] = useState({ mode: 'ALL' });
  const [filters, setFilters] = useState({ client: '', department: '', section: '', role: '', recruiter: '', status: '', q: '' });
  const [opts, setOpts] = useState({ clients: [], departments: [], sections: [], roles: [], employees: [] });
  const [data, setData] = useState(null);
  const [recruiterPanel, setRecruiterPanel] = useState(null);
  const [showCandidates, setShowCandidates] = useState(false);

  useEffect(() => {
    api.get('/accounts-dashboard/filters').then((res) => setOpts(res.data));
  }, []);

  function query() {
    const params = { ...period, ...filters };
    Object.keys(params).forEach((k) => { if (params[k] === '') delete params[k]; });
    return params;
  }

  function load() {
    api.get('/accounts-dashboard', { params: query() }).then((res) => setData(res.data));
  }
  useEffect(load, [period, filters]);

  useEffect(() => {
    if (filters.recruiter) {
      api.get(`/accounts-dashboard/recruiter/${encodeURIComponent(filters.recruiter)}`, { params: query() }).then((res) => setRecruiterPanel(res.data));
    } else {
      setRecruiterPanel(null);
      setShowCandidates(false);
    }
  }, [filters.recruiter, period]);

  const employeesForRole = filters.role ? opts.employees.filter((e) => e.role === filters.role) : opts.employees;

  if (!data) return <div className="small-muted">Loading…</div>;
  const k = data.kpis;

  return (
    <div>
      <div className="page-head">
        <div><h1>Accounts Dashboard</h1><div className="page-sub">Income before and after GST, TDS, collections and net profit for the financial year, half, quarter or month you pick. Dropped candidates are excluded from every money column.</div></div>
      </div>

      <div className="notice" style={{ marginBottom: 12 }}>
        <b>{data.period.label}</b>{data.period.from ? ` — ${data.period.from} to ${data.period.to}` : ''}. Every figure on this page is for those dates. The financial year runs April to March and rolls over on its own.
      </div>

      <div className="filter-row" style={{ flexWrap: 'wrap', gap: 8 }}>
        <PeriodPicker value={period} onChange={setPeriod} label={data.period.label} />
        <select value={filters.client} onChange={(e) => setFilters({ ...filters, client: e.target.value })}>
          <option value="">All clients</option>
          {opts.clients.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filters.department} onChange={(e) => setFilters({ ...filters, department: e.target.value })}>
          <option value="">All departments</option>
          {opts.departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filters.section} onChange={(e) => setFilters({ ...filters, section: e.target.value })}>
          <option value="">All sections</option>
          {opts.sections.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filters.role} onChange={(e) => setFilters({ ...filters, role: e.target.value, recruiter: '' })}>
          <option value="">All roles</option>
          <option value="RECRUITER">Recruiter</option>
          <option value="BDE">BDE</option>
        </select>
        <select value={filters.recruiter} onChange={(e) => setFilters({ ...filters, recruiter: e.target.value })} style={{ maxWidth: 210 }}>
          <option value="">All employees</option>
          {employeesForRole.map((e) => <option key={e.name} value={e.name}>{e.name}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">All statuses</option>
          <option>Pending</option><option>Partially Paid</option><option>Paid</option><option>Overdue</option><option>Cancelled</option>
        </select>
        <input placeholder="Search anything" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
        <button className="btn btn-sm" onClick={() => { setFilters({ client: '', department: '', section: '', role: '', recruiter: '', status: '', q: '' }); setPeriod({ mode: 'ALL' }); }}>Reset all</button>
      </div>

      {recruiterPanel && (
        <div className="card section" style={{ borderColor: 'var(--warn)' }}>
          <div className="page-head" style={{ marginBottom: 8 }}>
            <h3>{recruiterPanel.name}</h3>
            <button className="btn btn-sm" onClick={() => setShowCandidates((s) => !s)}>{showCandidates ? '▴ Hide the candidates' : '▾ Show the candidates'}</button>
          </div>
          <div className="statbar">
            <div className="statitem"><div className="n">{recruiterPanel.totals.joins}</div><div className="l">Candidates brought</div></div>
            <div className="statitem"><div className="n">{recruiterPanel.clients.length}</div><div className="l">Clients placed into</div></div>
            <div className="statitem"><div className="n">{money(recruiterPanel.totals.billing)}</div><div className="l">Fee brought in</div></div>
            <div className="statitem"><div className="n">{money(recruiterPanel.totals.profit)}</div><div className="l">Profit from them</div></div>
          </div>
          <div className="statbar">
            <div className="statitem"><div className="n">{money(recruiterPanel.totals.gst)}</div><div className="l">GST charged</div></div>
            <div className="statitem"><div className="n">{money(recruiterPanel.totals.invoiceValue)}</div><div className="l">Invoiced</div></div>
            <div className="statitem"><div className="n">{money(recruiterPanel.totals.received)}</div><div className="l">Collected</div></div>
            <div className="statitem"><div className="n">{money(recruiterPanel.totals.pending)}</div><div className="l">Still pending</div></div>
          </div>
          <h3 style={{ fontSize: 13, marginTop: 10 }}>Which clients, and what each brought</h3>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Client</th><th>Joined</th><th>Fee</th><th>GST</th><th>Receivable</th><th>Collected</th><th>Pending</th><th>Profit</th></tr></thead>
              <tbody>
                {recruiterPanel.clients.map((c) => (
                  <tr key={c.client}><td>{c.client}</td><td>{c.joined}</td><td>{money(c.fee)}</td><td>{money(c.gst)}</td><td>{money(c.receivable)}</td><td>{money(c.received)}</td><td>{money(c.pending)}</td><td>{money(c.profit)}</td></tr>
                ))}
                {recruiterPanel.clients.length === 0 && <tr><td colSpan="8" className="small-muted">No joining is tagged to {recruiterPanel.name} in this period.</td></tr>}
              </tbody>
            </table>
          </div>
          {showCandidates && (
            <div className="tbl-wrap" style={{ marginTop: 10 }}>
              <table>
                <thead><tr><th>Candidate</th><th>Client</th><th>Joined</th><th>Invoice</th><th>Fee</th><th>Receivable</th><th>Pending</th><th>Status</th></tr></thead>
                <tbody>
                  {recruiterPanel.candidates.map((c) => (
                    <tr key={c.id}><td>{c.candidateName}</td><td>{c.clientName}</td><td>{c.joinedDate}</td><td>{c.invoiceNumber || '—'}</td><td>{money(c.before)}</td><td>{money(c.receivable)}</td><td>{money(c.pending)}</td><td><span className="status">{c.status}</span></td></tr>
                  ))}
                  {recruiterPanel.candidates.length === 0 && <tr><td colSpan="8" className="small-muted">Nothing in this period.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="statbar">
        <div className="statitem"><div className="n">{k.totalCandidates}</div><div className="l">Total candidates</div></div>
        <div className="statitem"><div className="n">{money(k.incomeBeforeGst)}</div><div className="l">Income before GST</div></div>
        <div className="statitem"><div className="n">{money(k.incomeAfterGst)}</div><div className="l">Income after GST</div></div>
        <div className="statitem"><div className="n">{money(k.gst)}</div><div className="l">GST on top</div></div>
      </div>
      <div className="statbar">
        <div className="statitem"><div className="n">{money(k.tds)}</div><div className="l">TDS deducted</div></div>
        <div className="statitem"><div className="n">{money(k.netProfit)}</div><div className="l">Net profit</div></div>
        <div className="statitem"><div className="n">{money(k.received)}</div><div className="l">Amount received</div></div>
        <div className="statitem"><div className="n">{money(k.pending)}</div><div className="l">Pending amount</div></div>
      </div>
      <div className="statbar">
        <div className="statitem"><div className="n">{k.overdueInvoices}</div><div className="l">Overdue invoices</div></div>
        <div className="statitem"><div className="n">{money(k.officeExpenses)}</div><div className="l">Office expenses</div></div>
        <div className="statitem"><div className="n">{money(k.profitAfterExpenses)}</div><div className="l">Profit after expenses</div></div>
      </div>

      <div className="grid-2">
        <div className="card section">
          <h3>Office spend</h3>
          <div className="statbar">
            <div className="statitem"><div className="n">{money(data.officeExpenseTotal)}</div><div className="l">Total amount</div></div>
          </div>
          {data.spendByCategory.map((c) => (
            <div className="kv" key={c.category}><span className="k">{c.category}</span><span>{c.pct}% · {money(c.net)}</span></div>
          ))}
          {data.spendByCategory.length === 0 && <div className="small-muted">No office spend in this period.</div>}
          <div style={{ marginTop: 8 }}><Link to="/office">Office & Accounts →</Link></div>
        </div>

        <div className="card section" style={{ borderColor: data.gstPosition.net >= 0 ? 'var(--danger, #c0392b)' : 'var(--ok, #1e8449)' }}>
          <h3>GST position</h3>
          <div className="kv"><span className="k">GST clients pay us</span><span>{money(data.gstPosition.out)}</span></div>
          <div className="kv"><span className="k">Of that, collected</span><span>{money(data.gstPosition.outReceived)}</span></div>
          <div className="kv"><span className="k">Still to come</span><span>{money(data.gstPosition.pendingGst)}</span></div>
          <div className="kv"><span className="k">GST we pay others</span><span>{money(data.gstPosition.inp)}</span></div>
          <div className="kv"><span className="k">{data.gstPosition.net >= 0 ? 'Payable to Government' : 'Credit carried'}</span><span style={{ fontWeight: 700 }}>{money(Math.abs(data.gstPosition.net))}</span></div>
          <div className="small-muted" style={{ marginTop: 8 }}>GST is never income and never an expense — it is collected on the Government's behalf and paid across after setting off what we already paid our vendors.</div>
        </div>
      </div>

      <div className="card section">
        <h3>Pending &amp; received, client by client</h3>
        <div className="page-sub">{data.clientMoney.filter((c) => c.pending > 0.5).length} client(s) still owe money</div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Client</th><th>Department</th><th>Before GST</th><th>After GST</th><th>Receivable</th><th>Received</th><th>Pending</th><th>Collected</th><th>Last payment</th></tr></thead>
            <tbody>
              {data.clientMoney.map((c) => (
                <tr key={c.client} className="row-link">
                  <td><Link to="/invoices">{c.client}</Link></td>
                  <td>{c.department}</td>
                  <td>{money(c.before)}</td>
                  <td>{money(c.after)}</td>
                  <td>{money(c.receivable)}</td>
                  <td>{money(c.received)}</td>
                  <td style={{ fontWeight: 700, color: c.pending > 0.5 ? 'var(--danger, #c0392b)' : 'var(--ok, #1e8449)' }}>{c.pending > 0.5 ? money(c.pending) : 'settled'}</td>
                  <td>{c.collectedPct}%</td>
                  <td>{c.lastPayment || 'never'}</td>
                </tr>
              ))}
              {data.clientMoney.length === 0 && <tr><td colSpan="9" className="small-muted">Nothing outstanding.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card section">
        <h3>Collection position</h3>
        <div className="kv"><span className="k">Invoice value</span><span>{money(k.incomeAfterGst)}</span></div>
        <div className="kv"><span className="k">Less TDS deducted</span><span>({money(k.tds)})</span></div>
        <div className="kv"><span className="k">Amount receivable</span><span>{money(k.receivable)}</span></div>
        <div className="kv"><span className="k">Received</span><span>{money(k.received)}</span></div>
        <div className="kv" style={{ borderTop: '1px solid var(--line)', fontWeight: 700 }}><span className="k">Pending</span><span>{money(k.pending)}</span></div>
        <div style={{ background: 'var(--line)', borderRadius: 6, height: 8, marginTop: 8, overflow: 'hidden' }}>
          <div style={{ width: `${k.receivable > 0 ? Math.round((k.received / k.receivable) * 100) : 0}%`, background: 'var(--ok, #1e8449)', height: '100%' }} />
        </div>
        <div className="small-muted" style={{ marginTop: 4 }}>{k.receivable > 0 ? Math.round((k.received / k.receivable) * 100) : 0}% collected against receivable</div>
        <div className="small-muted" style={{ marginTop: 8 }}>Net profit is <b>billing − TDS</b>. GST collected is payable to Government, so it is never counted as profit.</div>
      </div>
    </div>
  );
}
