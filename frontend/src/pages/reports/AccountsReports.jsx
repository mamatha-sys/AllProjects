import { useEffect, useState } from 'react';
import api from '../../api';

export default function AccountsReports() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    api.get('/reports/accounts').then((res) => setRows(res.data));
  }, []);

  return (
    <div>
      <div className="page-head"><h1>Accounts Reports</h1></div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Status</th><th>Count</th><th>Total (incl. GST)</th></tr></thead>
          <tbody>
            {rows.map((r) => <tr key={r.status}><td>{r.status}</td><td>{r.count}</td><td>₹{r.amount.toLocaleString('en-IN')}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
