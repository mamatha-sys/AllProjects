import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';

const ACCOUNTS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'];
const STATUSES = ['All', 'Pending', 'Partially Paid', 'Overdue', 'Paid', 'Cancelled'];

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export function statusClass(status) {
  if (status === 'Overdue') return 'priority-high';
  if (status === 'Paid') return 'priority-low';
  if (status === 'Partially Paid') return 'priority-medium';
  return '';
}

export default function Invoices() {
  const { user } = useAuth();
  const canManage = ACCOUNTS_ROLES.includes(user?.role);
  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState('All');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get('/invoices').then((res) => setInvoices(res.data));
    api.get('/invoices/summary').then((res) => setSummary(res.data)).catch(() => setSummary(null));
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
            {rows.map((i) => (
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
                    )}
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={canManage ? 12 : 11} className="small-muted">No invoices in this state.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ n, l }) {
  return <div className="statitem"><div className="n">{n}</div><div className="l">{l}</div></div>;
}
