import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { statusClass } from './Invoices.jsx';

const ACCOUNTS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'];
const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const today = () => new Date().toISOString().slice(0, 10);

export default function InvoiceDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const canManage = ACCOUNTS_ROLES.includes(user?.role);
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ amount: '', date: today(), method: 'Bank Transfer', reference: '' });

  const load = useCallback(() => {
    api.get(`/invoices/${id}`).then((res) => setInvoice(res.data));
  }, [id]);
  useEffect(load, [load]);

  async function run(fn) {
    setError('');
    try {
      await fn();
      load();
    } catch (e) {
      setError(e.response?.data?.error || 'That did not work.');
    }
  }

  const addPayment = (e) => {
    e.preventDefault();
    run(async () => {
      await api.post(`/invoices/${id}/payments`, { ...form, amount: Number(form.amount) });
      setForm({ amount: '', date: today(), method: 'Bank Transfer', reference: '' });
    });
  };

  if (!invoice) return <div className="small-muted">Loading…</div>;

  const payments = invoice.payments || [];

  return (
    <div>
      <Link className="small-muted" to="/invoices">← Back to invoices</Link>
      <div className="page-head" style={{ marginTop: 10 }}>
        <div>
          <h1>{invoice.invoiceNumber || invoice.client?.name}</h1>
          <div className="page-sub">{invoice.client?.name}</div>
        </div>
        <span className={`status ${statusClass(invoice.status)}`}>{invoice.status}</span>
      </div>

      {error && <div className="card section error-text" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="card section">
        <h3>Invoice</h3>
        <div className="kv"><span className="k">Candidate</span><span>{invoice.candidate?.name || '—'}</span></div>
        <div className="kv"><span className="k">Requirement</span><span>{invoice.requirement?.title || '—'}</span></div>
        <div className="kv"><span className="k">Invoice Date</span><span>{invoice.invoiceDate}</span></div>
        <div className="kv"><span className="k">Due Date</span><span>{invoice.dueDate || '—'}</span></div>
        <div className="kv"><span className="k">Payment Terms</span><span>{invoice.paymentTerms}</span></div>
        {invoice.paidDate && <div className="kv"><span className="k">Paid On</span><span>{invoice.paidDate}</span></div>}
      </div>

      <div className="card section">
        <h3>What it is worth</h3>
        <div className="kv"><span className="k">Amount</span><span>{money(invoice.amount)}</span></div>
        <div className="kv"><span className="k">GST</span><span>+ {money(invoice.gst)}</span></div>
        <div className="kv"><span className="k">TDS deducted at source</span><span>− {money(invoice.tds)}</span></div>
        <div className="kv"><span className="k">Total payable</span><span style={{ fontWeight: 700 }}>{money(invoice.total)}</span></div>
        <div className="kv"><span className="k">Received</span><span>{money(invoice.receivedAmount)}</span></div>
        <div className="kv"><span className="k">Outstanding</span><span style={{ fontWeight: 700 }}>{money(invoice.outstanding)}</span></div>
      </div>

      <div className="card section">
        <h3>Receipts</h3>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Reference</th><th>Note</th><th>Recorded by</th>{canManage && <th></th>}</tr></thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{p.date}</td>
                  <td>{money(p.amount)}</td>
                  <td>{p.method}</td>
                  <td>{p.reference || '—'}</td>
                  <td className="small-muted">{p.notes || '—'}</td>
                  <td>{p.recordedBy || '—'}</td>
                  {canManage && (
                    <td>
                      {/* A receipt that came from a reconciled bank line is undone
                          on the bank screen, so the two never drift apart. */}
                      {p.bankTxnId
                        ? <span className="small-muted">From bank</span>
                        : <button className="btn btn-sm" onClick={() => run(() => api.delete(`/invoices/${id}/payments/${p.id}`))}>Remove</button>}
                    </td>
                  )}
                </tr>
              ))}
              {payments.length === 0 && <tr><td colSpan={canManage ? 7 : 6} className="small-muted">Nothing received yet.</td></tr>}
            </tbody>
          </table>
        </div>

        {canManage && invoice.outstanding > 0.5 && invoice.status !== 'Cancelled' && (
          <form onSubmit={addPayment} style={{ marginTop: 14 }}>
            <div className="grid-2">
              <label className="field"><span>Amount (₹)</span>
                <input required type="number" step="0.01" max={invoice.outstanding} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </label>
              <label className="field"><span>Date</span>
                <input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </label>
              <label className="field"><span>Method</span>
                <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                  <option>Bank Transfer</option><option>Cheque</option><option>UPI</option><option>Cash</option>
                </select>
              </label>
              <label className="field"><span>Reference / UTR</span>
                <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
              </label>
            </div>
            <div className="qa-row">
              <button className="btn btn-primary btn-sm" type="submit">Record receipt</button>
              <button className="btn btn-sm" type="button" onClick={() => run(() => api.patch(`/invoices/${id}/pay`))}>Settle in full</button>
              {invoice.receivedAmount === 0 && (
                <button className="btn btn-sm" type="button" onClick={() => run(() => api.patch(`/invoices/${id}/cancel`))}>Cancel invoice</button>
              )}
            </div>
          </form>
        )}
      </div>

      {invoice.candidate && (
        <div className="card section">
          <h3>Linked candidate journey</h3>
          <div><Link to={`/candidates/${invoice.candidate.id}`}>View candidate in ATS →</Link></div>
          {invoice.requirement && (
            <div style={{ marginTop: 8 }}>
              <Link to={`/requirements/${invoice.requirement.id}`}>View requirement in ATS →</Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
