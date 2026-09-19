import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { statusClass } from './Invoices.jsx';

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

// The Accountant's panel: what is owed, what needs chasing, and what is still
// sitting unreconciled on the bank statement.
export default function AccountsDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/dashboard/accounts').then((res) => setData(res.data)).catch(() => setData(null));
  }, []);

  if (!data) return null;

  return (
    <>
      <div className="statbar">
        <Stat n={money(data.collected)} l="Collected" />
        <Stat n={money(data.pendingAmount)} l="Pending" />
        <Stat n={data.overdue} l="Overdue invoices" />
        <Stat n={data.unmatched} l="Unmatched transactions" />
      </div>

      <div className="card section">
        <h3>Recent invoices</h3>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Invoice</th><th>Client</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {data.recentInvoices.map((i) => (
                <tr key={i.id} className="row-link">
                  <td><Link to={`/invoices/${i.id}`}>{i.invoiceNumber || i.id.slice(-6)}</Link></td>
                  <td>{i.client}</td>
                  <td>{money(i.total)}</td>
                  <td><span className={`status ${statusClass(i.status)}`}>{i.status}</span></td>
                </tr>
              ))}
              {data.recentInvoices.length === 0 && <tr><td colSpan="4" className="small-muted">No invoices yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card section">
        <h3>By client</h3>
        {data.byClient.map((c) => (
          <div className="kv" key={c.client}><span className="k">{c.client}</span><span>{money(c.total)}</span></div>
        ))}
        {data.byClient.length === 0 && <div className="small-muted">No invoices yet.</div>}
      </div>

      <div className="card section">
        <h3>Invoices needing attention</h3>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Invoice</th><th>Client</th><th>Due</th><th>Outstanding</th><th>Status</th></tr></thead>
            <tbody>
              {data.needsAttention.map((i) => (
                <tr key={i.id}>
                  <td><Link to={`/invoices/${i.id}`}>{i.invoiceNumber || i.id.slice(-6)}</Link></td>
                  <td>{i.client}</td>
                  <td>{i.dueDate || '—'}</td>
                  <td>{money(i.outstanding)}</td>
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

function Stat({ n, l }) {
  return <div className="statitem"><div className="n">{n}</div><div className="l">{l}</div></div>;
}
