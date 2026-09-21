import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { statusClass } from './Invoices.jsx';

export const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

// The Accounts dashboard as the accounting application draws it: a period you
// pick (financial year, half, quarter or month), the money columns for exactly
// those dates, and then office spend, the GST position and the collection
// position underneath. Net profit is billing − TDS; GST collected is payable to
// Government, so it is never counted as profit.
export default function AccountsDashboard() {
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState('');
  const [f, setF] = useState({ client: 'All', department: 'All', status: 'All', q: '' });

  const load = useCallback(() => {
    api.get('/dashboard/accounts', { params: { ...(period ? { period } : {}), ...f } })
      .then((res) => setData(res.data))
      .catch(() => setData(null));
  }, [period, f]);
  useEffect(load, [load]);

  if (!data) return null;
  const m = data.money;
  const g = data.gstPosition;
  const p = data.period;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Accounts Dashboard</h1>
          <div className="page-sub">
            Income before and after GST, TDS, collections and net profit for the financial year,
            half, quarter or month you pick.
          </div>
        </div>
      </div>

      <div className="filter-row">
        <label className="field"><span>Client · {data.filterOptions.clients.length}</span>
          <select value={f.client} onChange={(e) => setF({ ...f, client: e.target.value })}>
            <option>All</option>{data.filterOptions.clients.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="field" style={{ minWidth: 230 }}><span>Period</span>
          <select value={period || p.sel} onChange={(e) => setPeriod(e.target.value)}>
            {p.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label className="field"><span>Department</span>
          <select value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })}>
            <option>All</option>{data.filterOptions.departments.map((d) => <option key={d}>{d}</option>)}
          </select>
        </label>
        <label className="field"><span>Status</span>
          <select title="Received and Paid mean the same thing — the whole invoice is in" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            {data.filterOptions.statuses.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="field" style={{ minWidth: 220 }}><span>Search anything</span>
          <input value={f.q} placeholder="Client, invoice no, GSTIN…" onChange={(e) => setF({ ...f, q: e.target.value })} />
        </label>
        {(f.client !== 'All' || f.department !== 'All' || f.status !== 'All' || f.q.trim())
          && <button className="btn btn-sm" onClick={() => setF({ client: 'All', department: 'All', status: 'All', q: '' })}>Reset all</button>}
        <span className="small-muted">showing <b>{data.showing.invoices}</b> of {data.showing.of} invoices</span>
      </div>

      <div className="notice">
        <span>
          <b>{p.label}</b> — {p.all ? 'every month on record' : `${p.from} to ${p.to}`}. Every figure on
          this page is for those dates. The financial year runs April to March and rolls over on its own.
        </span>
      </div>

      <div className="statbar">
        <Stat n={m.candidates} l="Total candidates" s={`${m.candidates} billed · no drops`} />
        <Stat n={money(m.billing)} l="Income before GST" s="Fee earned — this is your income" />
        <Stat n={money(m.invoiceValue)} l="Income after GST" s="What the client is invoiced" />
        <Stat n={money(m.gst)} l="GST on top" s="Collected for Govt — never income" />
        <Stat n={money(m.tds)} l="TDS deducted" s="By clients" />
        <Stat n={money(m.profit)} l="Net profit" s="Billing − TDS" tone="good" />
        <Stat n={money(m.received)} l="Amount received" s={`${m.collectedPct}% of ${money(m.receivable)} receivable`} tone="good" />
        <Stat n={money(m.pending)} l="Pending amount" s={`${m.openRows} open row(s)`} tone="bad" />
        <Stat n={m.overdueInvoices} l="Overdue invoices" s="Past payment due date" tone="bad" />
        <Stat n={money(m.expenseNet)} l="Office expenses" s={`${m.expenseCount} entr${m.expenseCount === 1 ? 'y' : 'ies'}${m.expensePending ? ` · ${money(m.expensePending)} pending` : ''}`} />
        <Stat
          n={money(m.profitAfterExpenses)}
          l="Profit after expenses"
          s="Open Profit & Loss for the full picture"
          tone={m.profitAfterExpenses >= 0 ? 'good' : 'bad'}
        />
      </div>

      <div className="card section">
        <h3>Office spend</h3>
        <div className="small-muted" style={{ marginBottom: 10 }}>{p.label} — where the money goes, by category</div>
        {data.spendByCategory.map((c) => (
          <div className="kv" key={c.category}>
            <span className="k">{c.category} <span className="small-muted">({c.count})</span></span>
            <span>{money(c.net)}</span>
          </div>
        ))}
        {data.spendByCategory.length === 0 && <div className="small-muted">Nothing spent in this period.</div>}
        <div style={{ marginTop: 10 }}><Link to="/office">Office &amp; Accounts →</Link></div>
      </div>

      <div className="card section">
        <h3>GST position</h3>
        <div className="small-muted" style={{ marginBottom: 10 }}>
          {p.label} — what clients pay us against what we pay others
        </div>
        <div className="statbar">
          <Stat n={money(g.charged)} l="GST clients pay us" s="Charged on our invoices" />
          <Stat n={money(g.collected)} l="Of that, collected" s={`${g.collectedPct}% is actually in the bank`} tone="good" />
          <Stat n={money(g.stillToCome)} l="Still to come" s="Rides on the pending invoices" tone="bad" />
          <Stat n={money(g.paid)} l="GST we pay others" s="Vendor and office bills" />
          <Stat
            n={money(g.unclaimableValue)}
            l="Cannot be claimed yet"
            s={g.unclaimableCount ? `${g.unclaimableCount} bill(s) with no vendor GSTIN` : 'every bill has a GSTIN'}
            tone={g.unclaimableValue > 0.5 ? 'bad' : 'good'}
          />
          <Stat
            n={money(Math.abs(g.payable))}
            l={g.payable >= 0 ? 'Payable to Government' : 'Credit carried'}
            s={`charged ${money(g.charged)} − paid ${money(g.paid)}`}
            tone={g.payable >= 0 ? 'bad' : 'good'}
          />
        </div>
        <div className="notice">
          <span>
            GST is never income and never an expense — it is collected on Government&apos;s behalf and paid
            across after setting off what we already paid our vendors.
          </span>
        </div>
      </div>

      <div className="grid-2">
        <div className="card section">
          <h3>Collection position</h3>
          <div className="small-muted" style={{ marginBottom: 8 }}>{p.label}</div>
          <div className="kv"><span className="k">Invoice value</span><span>{money(m.invoiceValue)}</span></div>
          <div className="kv"><span className="k">Less TDS deducted</span><span>({money(m.tds)})</span></div>
          <div className="kv"><span className="k">Amount receivable</span><span>{money(m.receivable)}</span></div>
          <div className="kv"><span className="k">Received</span><span>{money(m.received)}</span></div>
          <div className="kv" style={{ fontWeight: 700 }}><span className="k">Pending</span><span>{money(m.pending)}</span></div>
          <div className="small-muted" style={{ marginTop: 8 }}>{m.collectedPct}% collected against receivable</div>
          <div className="notice" style={{ marginTop: 12 }}>
            <span>Net profit is <b>billing − TDS</b>. GST collected is payable to Government, so it is never counted as profit.</span>
          </div>
        </div>

        <div className="card section">
          <h3>Client money</h3>
          <div className="small-muted" style={{ marginBottom: 8 }}>{p.label}</div>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Client</th><th className="num">Invoices</th><th className="num">Receivable</th><th className="num">Received</th><th className="num">Pending</th></tr></thead>
              <tbody>
                {data.byClient.map((c) => (
                  <tr key={c.client}>
                    <td>{c.client}</td>
                    <td className="num">{c.invoices}</td>
                    <td className="num">{money(c.receivable)}</td>
                    <td className="num">{money(c.received)}</td>
                    <td className="num">{money(c.pending)}</td>
                  </tr>
                ))}
                {data.byClient.length === 0 && <tr><td colSpan="5" className="small-muted">No invoices in this period.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card section">
        <h3>Month by month</h3>
        <div className="small-muted" style={{ marginBottom: 8 }}>{p.label} — billing, GST, TDS, collections and profit</div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Month</th><th className="num">Invoices</th><th className="num">Before GST</th><th className="num">GST</th>
                <th className="num">TDS</th><th className="num">Receivable</th><th className="num">Received</th>
                <th className="num">Pending</th><th className="num">Office spend</th><th className="num">Profit</th>
              </tr>
            </thead>
            <tbody>
              {data.byMonth.map((r) => (
                <tr key={r.month}>
                  <td>{r.label}</td>
                  <td className="num">{r.invoices}</td>
                  <td className="num">{money(r.billing)}</td>
                  <td className="num">{money(r.gst)}</td>
                  <td className="num">{money(r.tds)}</td>
                  <td className="num">{money(r.receivable)}</td>
                  <td className="num">{money(r.received)}</td>
                  <td className="num">{money(r.pending)}</td>
                  <td className="num">{money(r.spend)}</td>
                  <td className="num">{money(r.profit)}</td>
                </tr>
              ))}
              {data.byMonth.length === 0 && <tr><td colSpan="10" className="small-muted">No data in this period.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card section">
        <h3>Invoices needing attention</h3>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Invoice</th><th>Client</th><th>Due</th><th className="num">Outstanding</th><th>Status</th></tr></thead>
            <tbody>
              {data.needsAttention.map((i) => (
                <tr key={i.id}>
                  <td><Link to={`/invoices/${i.id}`}>{i.invoiceNumber || i.id.slice(-6)}</Link></td>
                  <td>{i.client}</td>
                  <td>{i.dueDate || '—'}</td>
                  <td className="num">{money(i.outstanding)}</td>
                  <td><span className={`status ${statusClass(i.status)}`}>{i.status}</span></td>
                </tr>
              ))}
              {data.needsAttention.length === 0 && <tr><td colSpan="5" className="small-muted">Nothing pending.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card section">
        <h3>Bank lines still to deal with</h3>
        {data.unreconciledTransactions.map((t) => (
          <div className="kv" key={t.id}>
            <span className="k">{t.date} · {t.description}</span>
            <span>{money(t.amount)} <span className="small-muted">({t.state})</span></span>
          </div>
        ))}
        {data.unreconciledTransactions.length === 0 && <div className="small-muted">All caught up.</div>}
        <div style={{ marginTop: 10 }}><Link to="/bank">Open Bank &amp; Reconciliation →</Link></div>
      </div>
    </>
  );
}

export function Stat({ n, l, s, tone }) {
  return (
    <div className={`statitem${tone ? ` acct-${tone}` : ''}`}>
      <div className="n">{n}</div>
      <div className="l">{l}</div>
      {s && <div className="s">{s}</div>}
    </div>
  );
}
