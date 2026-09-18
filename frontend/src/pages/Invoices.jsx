import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';

const ACCOUNTS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'];

export default function Invoices() {
  const { user } = useAuth();
  const canManage = ACCOUNTS_ROLES.includes(user?.role);
  const [invoices, setInvoices] = useState([]);

  function load() {
    api.get('/invoices').then((res) => setInvoices(res.data));
  }
  useEffect(load, []);

  async function markPaid(id) {
    await api.patch(`/invoices/${id}/pay`);
    load();
  }

  return (
    <div>
      <div className="page-head"><h1>Invoices</h1></div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Client</th><th>Candidate</th><th>Amount</th><th>GST</th><th>Status</th><th>Due</th>{canManage && <th></th>}</tr></thead>
          <tbody>
            {invoices.map((i) => (
              <tr key={i.id}>
                <td><Link to={`/invoices/${i.id}`}>{i.client?.name}</Link></td>
                <td>{i.candidate?.name || '—'}</td>
                <td>₹{i.amount.toLocaleString('en-IN')}</td>
                <td>₹{i.gst.toLocaleString('en-IN')}</td>
                <td><span className={`status ${i.status === 'Overdue' ? 'priority-high' : i.status === 'Paid' ? 'priority-low' : ''}`}>{i.status}</span></td>
                <td>{i.dueDate || '—'}</td>
                {canManage && (
                  <td>{i.status !== 'Paid' && <button className="btn btn-sm" onClick={() => markPaid(i.id)}>Mark Paid</button>}</td>
                )}
              </tr>
            ))}
            {invoices.length === 0 && <tr><td colSpan={canManage ? 7 : 6} className="small-muted">No invoices yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
