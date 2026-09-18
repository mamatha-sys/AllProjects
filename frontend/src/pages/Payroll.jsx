import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';

const PAYROLL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'];

export default function Payroll() {
  const { user } = useAuth();
  const canRun = PAYROLL_ROLES.includes(user?.role);
  const [payslips, setPayslips] = useState([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [defaultCTC, setDefaultCTC] = useState(600000);
  const [message, setMessage] = useState('');

  function load() {
    api.get('/payroll').then((res) => setPayslips(res.data));
  }
  useEffect(load, []);

  async function runPayroll(e) {
    e.preventDefault();
    setMessage('');
    const res = await api.post('/payroll/run', { month, defaultCTC });
    setMessage(`Generated ${res.data.count} payslips for ${res.data.month}.`);
    load();
  }

  return (
    <div>
      <div className="page-head"><h1>Payroll & Compensation</h1></div>

      {canRun && (
        <form className="card section" onSubmit={runPayroll}>
          <h3>Run payroll cycle</h3>
          <div className="filter-row">
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            <input type="number" value={defaultCTC} onChange={(e) => setDefaultCTC(e.target.value)} placeholder="Default annual CTC" style={{ width: 160 }} />
            <button className="btn btn-sm btn-primary" type="submit">Run for all active employees</button>
          </div>
          {message && <div className="small-muted" style={{ marginTop: 8 }}>{message}</div>}
        </form>
      )}

      <div className="tbl-wrap">
        <table>
          <thead><tr>{canRun && <th>Employee</th>}<th>Month</th><th>Basic</th><th>HRA</th><th>Allowances</th><th>Deductions</th><th>Net Pay</th></tr></thead>
          <tbody>
            {payslips.map((p) => (
              <tr key={p.id}>
                {canRun && <td>{p.employee?.name}</td>}
                <td>{p.month}</td>
                <td>₹{p.basic.toLocaleString('en-IN')}</td>
                <td>₹{p.hra.toLocaleString('en-IN')}</td>
                <td>₹{p.allowances.toLocaleString('en-IN')}</td>
                <td>₹{p.deductions.toLocaleString('en-IN')}</td>
                <td style={{ fontWeight: 600 }}>₹{p.netPay.toLocaleString('en-IN')}</td>
              </tr>
            ))}
            {payslips.length === 0 && <tr><td colSpan={canRun ? 7 : 6} className="small-muted">No payslips yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
