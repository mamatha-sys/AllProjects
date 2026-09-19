import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import TabsPage from '../components/TabsPage.jsx';

const PAYROLL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'];
const inr = (n) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

function DashboardTab({ canRun }) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [defaultCTC, setDefaultCTC] = useState(600000);
  const [message, setMessage] = useState('');
  const [fnf, setFnf] = useState([]);
  const [policy, setPolicy] = useState(null);

  function load() {
    if (canRun) {
      api.get('/payroll/fnf').then((res) => setFnf(res.data));
      api.get('/payroll/policy').then((res) => setPolicy(res.data));
    }
  }
  useEffect(load, [canRun]);

  async function runPayroll(e) {
    e.preventDefault();
    setMessage('');
    const res = await api.post('/payroll/run', { month, defaultCTC });
    setMessage(`Generated ${res.data.count} payslips for ${res.data.month}.`);
  }

  async function processFnf(id) {
    const amount = prompt('Settlement amount (₹)');
    if (amount === null) return;
    await api.patch(`/payroll/fnf/${id}/process`, { settlementAmount: Number(amount) || 0 });
    load();
  }

  async function savePolicy(patch) {
    const updated = { ...policy, ...patch };
    setPolicy(updated);
    await api.put('/payroll/policy', updated);
  }

  if (!canRun) return <div className="small-muted">Payroll processing isn't included in your role's permissions — see the Payslips tab for your own pay history.</div>;

  return (
    <div>
      <div className="statbar">
        <div className="statitem"><div className="n">{month}</div><div className="l">Payroll Cycle</div></div>
        <div className="statitem"><div className="n">{fnf.filter((f) => f.status === 'Pending').length}</div><div className="l">F&F Requests</div></div>
      </div>

      <form className="card section" onSubmit={runPayroll}>
        <h3>Run payroll cycle</h3>
        <div className="filter-row">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          <input type="number" value={defaultCTC} onChange={(e) => setDefaultCTC(e.target.value)} placeholder="Default annual CTC (employees without a salary structure)" style={{ width: 260 }} />
          <button className="btn btn-sm btn-primary" type="submit">Run for all active employees</button>
        </div>
        {message && <div className="small-muted" style={{ marginTop: 8 }}>{message}</div>}
      </form>

      {policy && (
        <div className="card section">
          <h3>How attendance affects pay</h3>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 0', fontSize: 13 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={policy.unmarkedDaysUnpaid} onChange={(e) => savePolicy({ unmarkedDaysUnpaid: e.target.checked })} /> Unmarked working days are unpaid
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 0', fontSize: 13 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={policy.weekendsPaid} onChange={(e) => savePolicy({ weekendsPaid: e.target.checked })} /> Weekends are paid
          </label>
          <label className="field" style={{ marginTop: 8, maxWidth: 240 }}>
            <span>Paid leave days per month</span>
            <input type="number" value={policy.paidLeaveDaysPerMonth} onChange={(e) => savePolicy({ paidLeaveDaysPerMonth: Number(e.target.value) })} />
          </label>
        </div>
      )}

      <div className="card section">
        <h3>Full & Final Settlements</h3>
        {fnf.map((f) => (
          <div className="kv" key={f.id}>
            <span className="k">{f.employee?.name} — last working day {f.lastWorkingDate}</span>
            <span>
              {f.status === 'Pending'
                ? <button className="btn btn-sm" onClick={() => processFnf(f.id)}>Process</button>
                : <span className="status priority-low">Processed {f.settlementAmount ? `· ${inr(f.settlementAmount)}` : ''}</span>}
            </span>
          </div>
        ))}
        {fnf.length === 0 && <div className="small-muted">No F&F requests.</div>}
      </div>
    </div>
  );
}

function StructureTab({ canRun }) {
  const [rows, setRows] = useState([]);

  function load() {
    api.get('/payroll/structure').then((res) => setRows(res.data));
  }
  useEffect(load, []);

  async function editCtc(employeeId, current) {
    const v = prompt('Annual CTC (₹)', current || 600000);
    if (v === null) return;
    await api.put(`/payroll/structure/${employeeId}`, { payMode: 'Package', ctc: Number(v) || 0 });
    load();
  }

  async function editStipend(employeeId, current) {
    const v = prompt('Monthly stipend (₹)', current || 20000);
    if (v === null) return;
    await api.put(`/payroll/structure/${employeeId}`, { payMode: 'Stipend', stipend: Number(v) || 0 });
    load();
  }

  async function toggleMode(row) {
    const mode = row.structure?.payMode === 'Stipend' ? 'Package' : 'Stipend';
    await api.put(`/payroll/structure/${row.employeeId}`, { payMode: mode });
    load();
  }

  if (!canRun) return <div className="small-muted">Salary structures aren't included in your role's permissions.</div>;

  return (
    <div className="tbl-wrap">
      <table>
        <thead><tr><th>Code</th><th>Name</th><th>Pay Type</th><th>HRA</th><th>Bonus</th><th>Special Allowance</th><th>Employer PF</th><th>PF</th><th>PT</th><th>Gratuity</th><th>Net</th><th>CTC</th><th></th></tr></thead>
        <tbody>
          {rows.map((r) => {
            const s = r.structure;
            const isStipend = s?.payMode === 'Stipend';
            return (
              <tr key={r.employeeId}>
                <td>{r.employeeCode}</td>
                <td>{r.name}</td>
                <td><button className="btn btn-sm" onClick={() => toggleMode(r)}>{s?.payMode || 'Package'}</button></td>
                {isStipend ? (
                  <td colSpan="7" className="small-muted" style={{ textAlign: 'center', fontStyle: 'italic' }}>Fixed stipend — no components</td>
                ) : (
                  <>
                    <td>{inr(s?.hra)}</td><td>{inr(s?.bonus)}</td><td>{inr(s?.specialAllowance)}</td>
                    <td>{inr(s?.employerPf)}</td><td>{inr(s?.employeePf)}</td><td>{inr(s?.professionalTax)}</td><td>{inr(s?.gratuity)}</td>
                  </>
                )}
                <td><b>{isStipend ? inr(s?.stipend) : inr(r.breakup?.net)}</b></td>
                <td>{isStipend ? inr(s?.stipend) : inr(s?.ctc)}</td>
                <td>{isStipend ? <button className="btn btn-sm" onClick={() => editStipend(r.employeeId, s?.stipend)}>Edit stipend</button> : <button className="btn btn-sm" onClick={() => editCtc(r.employeeId, s?.ctc)}>Edit CTC</button>}</td>
              </tr>
            );
          })}
          {rows.length === 0 && <tr><td colSpan="13" className="small-muted">No employees.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function PayslipsTab({ canRun }) {
  const [payslips, setPayslips] = useState([]);
  useEffect(() => { api.get('/payroll').then((res) => setPayslips(res.data)); }, []);

  return (
    <div className="tbl-wrap">
      <table>
        <thead><tr>{canRun && <th>Employee</th>}<th>Month</th><th>Basic</th><th>HRA</th><th>Bonus</th><th>Special Allowance</th><th>PF</th><th>PT</th><th>LOP Days</th><th>Net Pay</th></tr></thead>
        <tbody>
          {payslips.map((p) => (
            <tr key={p.id}>
              {canRun && <td>{p.employee?.name}</td>}
              <td>{p.month}</td>
              <td>{inr(p.basic)}</td>
              <td>{inr(p.hra)}</td>
              <td>{inr(p.bonus)}</td>
              <td>{inr(p.specialAllowance)}</td>
              <td>{inr(p.employeePf)}</td>
              <td>{inr(p.professionalTax)}</td>
              <td>{p.lopDays || 0}</td>
              <td style={{ fontWeight: 700 }}>{inr(p.netPay)}</td>
            </tr>
          ))}
          {payslips.length === 0 && <tr><td colSpan={canRun ? 10 : 9} className="small-muted">No payslips yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export default function Payroll() {
  const { user } = useAuth();
  const canRun = PAYROLL_ROLES.includes(user?.role);

  return (
    <TabsPage
      title="Payroll & Compensation"
      subtitle="Pay runs, salary structures, settlements and payslips"
      tabs={[
        { key: 'dashboard', label: 'Dashboard', element: <DashboardTab canRun={canRun} /> },
        { key: 'structure', label: 'Salary Structure', element: <StructureTab canRun={canRun} /> },
        { key: 'payslips', label: 'Payslips', element: <PayslipsTab canRun={canRun} /> },
      ]}
    />
  );
}
