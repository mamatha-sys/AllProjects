import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import TabsPage from '../components/TabsPage.jsx';

const PAYROLL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'];
const inr = (n) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

function DashboardTab({ canRun, isAdmin }) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [defaultCTC, setDefaultCTC] = useState(600000);
  const [message, setMessage] = useState('');
  const [fnf, setFnf] = useState([]);
  const [policy, setPolicy] = useState(null);
  const [reference, setReference] = useState(null);
  const [showCtcSettings, setShowCtcSettings] = useState(false);

  function load() {
    if (canRun) {
      api.get('/payroll/fnf').then((res) => setFnf(res.data));
      api.get('/payroll/policy').then((res) => setPolicy(res.data));
      api.get('/payroll/reference-structure?ctc=300000').then((res) => setReference(res.data));
    }
  }
  useEffect(load, [canRun]);

  async function saveCtcSettings(patch) {
    const res = await api.put('/payroll/ctc-settings', patch);
    setPolicy(res.data);
    api.get('/payroll/reference-structure?ctc=300000').then((r) => setReference(r.data));
  }

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

      {reference && (
        <div className="card section">
          <h3>Salary Structure — Standard Package reference (₹3,00,000 CTC example)</h3>
          <div className="grid-2">
            <div>
              <div className="small-muted" style={{ fontWeight: 700, marginBottom: 4 }}>EARNINGS</div>
              <div className="kv"><span className="k">Basic</span><span>{inr(reference.basic)}</span></div>
              <div className="kv"><span className="k">HRA</span><span>{inr(reference.hra)}</span></div>
              <div className="kv"><span className="k">Bonus</span><span>{inr(reference.bonus)}</span></div>
              <div className="kv"><span className="k">Special Allowance</span><span>{inr(reference.special)}</span></div>
              <div className="kv"><span className="k"><b>Gross</b></span><span><b>{inr(reference.gross)}</b></span></div>
            </div>
            <div>
              <div className="small-muted" style={{ fontWeight: 700, marginBottom: 4 }}>DEDUCTIONS</div>
              <div className="kv"><span className="k">PF (Provident Fund)</span><span>−{inr(reference.employeePf)}</span></div>
              <div className="kv"><span className="k">PT (Professional Tax)</span><span>−{inr(reference.professionalTax)}</span></div>
              <div className="kv"><span className="k"><b>Net Pay</b></span><span><b>{inr(reference.net)}</b></span></div>
              <div className="small-muted" style={{ fontWeight: 700, margin: '8px 0 4px' }}>EMPLOYER COST</div>
              <div className="kv"><span className="k">Employer PF</span><span>{inr(reference.employerPf)}</span></div>
              <div className="kv"><span className="k">Gratuity</span><span>{inr(reference.gratuity)}</span></div>
            </div>
          </div>
          {isAdmin && <button className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => setShowCtcSettings((s) => !s)}>{showCtcSettings ? 'Hide' : 'Configure'} CTC Split Settings</button>}
          {showCtcSettings && policy && (
            <div className="grid-2" style={{ marginTop: 10 }}>
              <label className="field"><span>Basic % of CTC</span><input type="number" value={policy.basicPctOfCtc} onChange={(e) => saveCtcSettings({ basicPctOfCtc: e.target.value })} /></label>
              <label className="field"><span>HRA % of Basic</span><input type="number" value={policy.hraPctOfBasic} onChange={(e) => saveCtcSettings({ hraPctOfBasic: e.target.value })} /></label>
              <label className="field"><span>Bonus % of Basic</span><input type="number" value={policy.bonusPctOfBasic} onChange={(e) => saveCtcSettings({ bonusPctOfBasic: e.target.value })} /></label>
              <label className="field"><span>Employee PF % of Basic</span><input type="number" value={policy.employeePfPctOfBasic} onChange={(e) => saveCtcSettings({ employeePfPctOfBasic: e.target.value })} /></label>
              <label className="field"><span>Employer PF % of Basic</span><input type="number" value={policy.employerPfPctOfBasic} onChange={(e) => saveCtcSettings({ employerPfPctOfBasic: e.target.value })} /></label>
              <label className="field"><span>Gratuity % of Basic</span><input type="number" value={policy.gratuityPctOfBasic} onChange={(e) => saveCtcSettings({ gratuityPctOfBasic: e.target.value })} /></label>
              <label className="field"><span>Professional Tax (flat monthly)</span><input type="number" value={policy.professionalTaxFlat} onChange={(e) => saveCtcSettings({ professionalTaxFlat: e.target.value })} /></label>
            </div>
          )}
        </div>
      )}

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
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role);

  return (
    <TabsPage
      title="Payroll & Compensation"
      subtitle="Pay runs, salary structures, settlements and payslips"
      tabs={[
        { key: 'dashboard', label: 'Dashboard', element: <DashboardTab canRun={canRun} isAdmin={isAdmin} /> },
        { key: 'structure', label: 'Salary Structure', element: <StructureTab canRun={canRun} /> },
        { key: 'payslips', label: 'Payslips', element: <PayslipsTab canRun={canRun} /> },
      ]}
    />
  );
}
