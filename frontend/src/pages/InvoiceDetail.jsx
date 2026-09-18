import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';

const ACCOUNTS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'];

export default function InvoiceDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const canManage = ACCOUNTS_ROLES.includes(user?.role);
  const [invoice, setInvoice] = useState(null);

  function load() {
    api.get(`/invoices/${id}`).then((res) => setInvoice(res.data));
  }
  useEffect(load, [id]);

  async function markPaid() {
    await api.patch(`/invoices/${id}/pay`);
    load();
  }

  if (!invoice) return <div className="small-muted">Loading…</div>;

  return (
    <div>
      <Link className="small-muted" to="/invoices">← Back to invoices</Link>
      <div className="page-head" style={{ marginTop: 10 }}>
        <h1>{invoice.client?.name}</h1>
        <span className={`status ${invoice.status === 'Overdue' ? 'priority-high' : invoice.status === 'Paid' ? 'priority-low' : ''}`}>{invoice.status}</span>
      </div>
      <div className="card">
        <div className="kv"><span className="k">Candidate</span><span>{invoice.candidate?.name || '—'}</span></div>
        <div className="kv"><span className="k">Requirement</span><span>{invoice.requirement?.title || '—'}</span></div>
        <div className="kv"><span className="k">Invoice Date</span><span>{invoice.invoiceDate}</span></div>
        <div className="kv"><span className="k">Due Date</span><span>{invoice.dueDate || '—'}</span></div>
        <div className="kv"><span className="k">Amount</span><span>₹{invoice.amount.toLocaleString('en-IN')}</span></div>
        <div className="kv"><span className="k">GST</span><span>₹{invoice.gst.toLocaleString('en-IN')}</span></div>
        <div className="kv"><span className="k">TDS</span><span>₹{invoice.tds.toLocaleString('en-IN')}</span></div>
        <div className="kv"><span className="k">Total</span><span style={{ fontWeight: 600 }}>₹{(invoice.amount + invoice.gst).toLocaleString('en-IN')}</span></div>
        <div className="kv"><span className="k">Payment Terms</span><span>{invoice.paymentTerms}</span></div>
        {canManage && invoice.status !== 'Paid' && (
          <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={markPaid}>Mark as Paid</button>
        )}
      </div>
      {invoice.candidate && (
        <div className="card section">
          <h3>Linked candidate journey</h3>
          <div className="link-btn" style={{ cursor: 'pointer' }}>
            <Link to={`/candidates/${invoice.candidate.id}`}>View candidate in ATS →</Link>
          </div>
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
