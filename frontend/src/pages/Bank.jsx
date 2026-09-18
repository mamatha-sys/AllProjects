import { useEffect, useState } from 'react';
import api from '../api';

export default function Bank() {
  const [transactions, setTransactions] = useState([]);

  function load() {
    api.get('/bank').then((res) => setTransactions(res.data));
  }
  useEffect(load, []);

  async function reconcile(id) {
    await api.post(`/bank/${id}/reconcile`);
    load();
  }

  return (
    <div>
      <div className="page-head"><h1>Bank & Reconciliation</h1></div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Date</th><th>Description</th><th>Type</th><th>Amount</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id}>
                <td>{t.date}</td>
                <td>{t.description}</td>
                <td>{t.type}</td>
                <td>₹{t.amount.toLocaleString('en-IN')}</td>
                <td><span className={`status ${t.matched ? 'priority-low' : ''}`}>{t.matched ? 'Matched' : 'Unmatched'}</span></td>
                <td>{!t.matched && <button className="btn btn-sm" onClick={() => reconcile(t.id)}>Match / Reconcile</button>}</td>
              </tr>
            ))}
            {transactions.length === 0 && <tr><td colSpan="6" className="small-muted">No transactions yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
