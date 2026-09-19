import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import TabsPage from '../components/TabsPage.jsx';
import { downloadCsv, inr } from '../utils/csv.js';

const PAYROLL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'];
const thisMonth = () => new Date().toISOString().slice(0, 7);

function Stat({ n, l }) {
  return <div className="statitem"><div className="n">{n}</div><div className="l">{l}</div></div>;
}

// Opens the payslip in its own window, ready to print. Built from the expanded
// payslip the API returns so the figures match the stored run exactly.
function openPayslipWindow(slip) {
  const win = window.open('', '_blank');
  if (!win) {
    alert('Pop-up blocked — allow pop-ups to view the payslip.');
    return;
  }
  const money = (n) => Math.round(Number(n) || 0).toLocaleString('en-IN');
  const rows = (lines) => lines.map((l) => `<tr><td>${l.label}</td><td style="text-align:right">${money(l.amount)}</td></tr>`).join('');
  const totalDeductions = slip.deductionLines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Payslip — ${slip.employee.name} — ${slip.period}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;padding:32px;color:#1c2733}
  h1{font-size:18px;margin:0}
  .sub{color:#6b7785;font-size:12px}
  .head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px}
  table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:13px}
  td,th{padding:6px 8px;border-bottom:1px solid #e2e5ea;text-align:left}
  th{font-size:11px;text-transform:uppercase;color:#6b7785}
  .net{font-weight:bold;font-size:15px;margin-top:8px}
</style></head><body>
<div class="head">
  <div><h1>${slip.company.name}</h1><div class="sub">Payslip for ${slip.period}</div></div>
  <div class="sub">${slip.company.address || ''}</div>
</div>
<table>
  <tr><td>Employee</td><td>${slip.employee.name} (${slip.employee.employeeCode})</td></tr>
  <tr><td>Department</td><td>${slip.employee.department || '—'}</td></tr>
  <tr><td>Designation</td><td>${slip.employee.designation || '—'}</td></tr>
  <tr><td>Pay mode</td><td>${slip.payMode || 'Package'}</td></tr>
  <tr><td>Loss of pay days</td><td>${slip.lopDays || 0}</td></tr>
</table>
<table><thead><tr><th>Earnings</th><th style="text-align:right">Amount (₹)</th></tr></thead><tbody>
  ${rows(slip.earnings)}
  <tr><td><b>Gross Earnings</b></td><td style="text-align:right"><b>${money(slip.gross)}</b></td></tr>
</tbody></table>
<table><thead><tr><th>Deductions</th><th style="text-align:right">Amount (₹)</th></tr></thead><tbody>
  ${rows(slip.deductionLines)}
  <tr><td><b>Total Deductions</b></td><td style="text-align:right"><b>${money(totalDeductions)}</b></td></tr>
</tbody></table>
<table><thead><tr><th>Employer cost (not part of take-home)</th><th style="text-align:right">Amount (₹)</th></tr></thead><tbody>
  ${rows(slip.employerCost)}
</tbody></table>
<div class="net">Net Pay: ₹${money(slip.netPay)}</div>
<p class="sub">This is a system-generated payslip.</p>
</body></html>`);
  win.document.close();
}

// ---- Tab 1: Dashboard -------------------------------------------------------

function DashboardTab({ canRun, isAdmin }) {
  const [cycle, setCycle] = useState(thisMonth());
  const [payslips, setPayslips] = useState([]);
  const [fnf, setFnf] = useState([]);
  const [policy, setPolicy] = useState(null);
  const [reference, setReference] = useState(null);

  function load() {
    if (!canRun) return;
    api.get('/payroll/fnf').then((res) => setFnf(res.data));
    api.get('/payroll/policy').then((res) => setPolicy(res.data));
    api.get('/payroll/reference-structure?ctc=300000').then((res) => setReference(res.data));
  }
  useEffect(load, [canRun]);
  useEffect(() => {
    if (canRun) api.get(`/payroll?month=${cycle}`).then((res) => setPayslips(res.data));
  }, [canRun, cycle]);

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
      <div className="filter-row">
        <input type="month" value={cycle} onChange={(e) => setCycle(e.target.value)} />
      </div>
      <div className="statbar">
        <Stat n={cycle} l="Payroll Cycle" />
        <Stat n={payslips.length} l="Employees Processed" />
        <Stat n={fnf.filter((f) => f.status === 'Pending').length} l="F&F Requests" />
      </div>

      {reference && (
        <div className="card section">
          <h3>Salary Structure — Standard Package reference (₹3,00,000 CTC example)</h3>
          <div className="small-muted" style={{ marginBottom: 8 }}>An illustrative example, not tied to any specific employee's actual pay.</div>
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
              <div className="kv"><span className="k"><b>CTC</b></span><span><b>{inr(reference.ctcCheck)}</b></span></div>
            </div>
          </div>
          {isAdmin && <div className="small-muted" style={{ marginTop: 8 }}>Change the percentages behind this breakup on the Salary Structure tab.</div>}
        </div>
      )}

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
          <div className="small-muted" style={{ marginTop: 8 }}>
            Each late check-in beyond the {policy.freeLateArrivalsPerMonth} free arrivals a month costs half a day's pay (see Attendance → Check-in Methods).
          </div>
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

// ---- Tab 2: Reports ---------------------------------------------------------

function ReportsTab({ canRun }) {
  const [data, setData] = useState(null);

  function load() {
    api.get('/payroll/reports').then((res) => setData(res.data));
  }
  useEffect(load, []);

  async function markPaid(id) {
    await api.patch(`/payroll/runs/${id}/paid`);
    load();
  }

  if (!canRun) return <div className="small-muted">Payroll reports aren't included in your role's permissions.</div>;
  if (!data) return <div className="small-muted">Loading…</div>;

  const c = data.comparison;
  const direction = c ? (c.delta > 0 ? `${inr(Math.abs(c.delta))} more than` : c.delta < 0 ? `${inr(Math.abs(c.delta))} less than` : 'exactly the same as') : '';
  const headline = c
    ? `${c.current.period} paid out ${inr(c.current.net)}, ${direction} ${c.previous.period} (${c.pct > 0 ? '+' : ''}${c.pct}%).`
    : null;
  const headcount = c
    ? (c.headcountDelta === 0
      ? `Headcount was unchanged at ${c.current.employees}.`
      : `Headcount ${c.headcountDelta > 0 ? 'rose' : 'fell'} by ${Math.abs(c.headcountDelta)} to ${c.current.employees}.`)
    : null;

  return (
    <div>
      <div className="card section">
        <h3>Monthly Comparison</h3>
        {c ? (<><div>{headline}</div><div className="small-muted" style={{ marginTop: 4 }}>{headcount}</div></>)
          : <div className="small-muted">Need at least two months of payroll runs to compare.</div>}
      </div>

      <div className="card section">
        <h3>Payroll by Period</h3>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Period</th><th>Employees</th><th>Gross</th><th>Deductions</th><th>Late Cuts</th><th>Net Payout</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {data.byPeriod.map((r) => (
                <tr key={r.id}>
                  <td>{r.period}</td><td>{r.employees}</td>
                  <td>{inr(r.gross)}</td><td>{inr(r.deductions)}</td><td>{inr(r.lateCuts)}</td>
                  <td><b>{inr(r.net)}</b></td>
                  <td><span className={`status ${r.status === 'Paid' ? 'priority-low' : 'priority-medium'}`}>{r.status}</span></td>
                  <td>{r.status !== 'Paid' && <button className="btn btn-sm" onClick={() => markPaid(r.id)}>Mark paid</button>}</td>
                </tr>
              ))}
              {data.byPeriod.length === 0 && <tr><td colSpan="8" className="small-muted">No payroll runs yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card section">
        <h3>Monthly Payout by Department</h3>
        {data.byDepartment.map((d) => (
          <div className="kv" key={d.department}>
            <span className="k">{d.department} <span className="small-muted">— {d.employees} employee(s)</span></span>
            <span><b>{inr(d.net)}</b></span>
          </div>
        ))}
        {data.byDepartment.length === 0 && <div className="small-muted">No employees.</div>}
      </div>
    </div>
  );
}

// ---- Tab 3: Salary Structure (CTC split config + per-employee structures) ----

function StructureTab({ canRun, isAdmin }) {
  const [rows, setRows] = useState([]);
  const [policy, setPolicy] = useState(null);
  const [filters, setFilters] = useState({ code: '', name: '', payType: '' });

  function load() {
    api.get('/payroll/structure').then((res) => setRows(res.data));
    api.get('/payroll/policy').then((res) => setPolicy(res.data));
  }
  useEffect(load, []);

  async function editSplit(key, label) {
    const v = prompt(label, policy[key]);
    if (v === null) return;
    await api.put('/payroll/ctc-settings', { [key]: Number(v) || 0 });
    load();
  }

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

  function exportStructures() {
    downloadCsv(
      'payroll-structures.csv',
      ['Code', 'Name', 'Department', 'Pay Type', 'Basic', 'HRA', 'Bonus', 'Special', 'Gross', 'PF', 'PT', 'Net', 'CTC'],
      filtered.map((r) => {
        const s = r.structure;
        if (s?.payMode === 'Stipend') return [r.employeeCode, r.name, r.department || '', 'Stipend', 0, 0, 0, 0, s.stipend, 0, 0, s.stipend, s.stipend * 12];
        const b = r.breakup || {};
        return [r.employeeCode, r.name, r.department || '', 'Package', b.basic || 0, b.hra || 0, b.bonus || 0, b.special || 0, b.gross || 0, b.employeePf || 0, b.professionalTax || 0, b.net || 0, s?.ctc || 0];
      })
    );
  }

  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const filtered = rows.filter((r) => (
    (!filters.code || (r.employeeCode || '').toLowerCase().includes(filters.code.toLowerCase()))
    && (!filters.name || (r.name || '').toLowerCase().includes(filters.name.toLowerCase()))
    && (!filters.payType || (r.structure?.payMode || 'Package') === filters.payType)
  ));

  const SPLIT_FIELDS = [
    ['basicPctOfCtc', 'Basic % of CTC', '%'],
    ['hraPctOfBasic', 'HRA % of Basic', '%'],
    ['bonusPctOfBasic', 'Bonus % of Basic', '%'],
    ['employeePfPctOfBasic', 'Employee PF % of Basic', '%'],
    ['employerPfPctOfBasic', 'Employer PF % of Basic', '%'],
    ['employeePfMonthlyCap', 'Employee PF monthly cap', ''],
    ['employerPfMonthlyCap', 'Employer PF monthly cap', ''],
    ['gratuityPctOfBasic', 'Gratuity % of Basic', '%'],
    ['professionalTaxFlat', 'Professional Tax (flat monthly)', ''],
  ];

  if (!canRun) return <div className="small-muted">Salary structures aren't included in your role's permissions.</div>;

  return (
    <div>
      {policy && (
        <div className="card section">
          <h3>CTC Split Configuration</h3>
          <div className="small-muted" style={{ marginBottom: 8 }}>These percentages drive every payslip and the salary structures table.</div>
          {SPLIT_FIELDS.map(([key, label, suffix]) => (
            <div className="kv" key={key}>
              <span className="k">{label}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <b>{policy[key]}{suffix}</b>
                {isAdmin && <button className="btn btn-sm" onClick={() => editSplit(key, label)}>Edit</button>}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="filter-row">
        <input placeholder="Employee ID…" value={filters.code} onChange={(e) => set('code', e.target.value)} />
        <input placeholder="Employee name…" value={filters.name} onChange={(e) => set('name', e.target.value)} />
        <select value={filters.payType} onChange={(e) => set('payType', e.target.value)}>
          <option value="">All Pay Types</option><option>Package</option><option>Stipend</option>
        </select>
        <button className="btn btn-sm btn-primary" onClick={exportStructures}>Export</button>
      </div>

      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Code</th><th>Name</th><th>Pay Type</th><th>Basic</th><th>HRA</th><th>Bonus</th><th>Special Allowance</th><th>Employer PF</th><th>PF</th><th>PT</th><th>Gratuity</th><th>Net</th><th>CTC</th><th></th></tr></thead>
          <tbody>
            {filtered.map((r) => {
              const s = r.structure;
              const isStipend = s?.payMode === 'Stipend';
              return (
                <tr key={r.employeeId}>
                  <td>{r.employeeCode}</td>
                  <td>{r.name}</td>
                  <td><button className="btn btn-sm" onClick={() => toggleMode(r)}>{s?.payMode || 'Package'}</button></td>
                  {isStipend ? (
                    <td colSpan="8" className="small-muted" style={{ textAlign: 'center', fontStyle: 'italic' }}>Fixed stipend — no components</td>
                  ) : (
                    <>
                      <td>{inr(s?.basic)}</td><td>{inr(s?.hra)}</td><td>{inr(s?.bonus)}</td><td>{inr(s?.specialAllowance)}</td>
                      <td>{inr(s?.employerPf)}</td><td>{inr(s?.employeePf)}</td><td>{inr(s?.professionalTax)}</td><td>{inr(s?.gratuity)}</td>
                    </>
                  )}
                  <td><b>{isStipend ? inr(s?.stipend) : inr(r.breakup?.net)}</b></td>
                  <td>{isStipend ? inr(s?.stipend) : inr(s?.ctc)}</td>
                  <td>{isStipend ? <button className="btn btn-sm" onClick={() => editStipend(r.employeeId, s?.stipend)}>Edit stipend</button> : <button className="btn btn-sm" onClick={() => editCtc(r.employeeId, s?.ctc)}>Edit CTC</button>}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan="14" className="small-muted">No employees match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- Tab 4: Process Payroll (preview, then confirm) -------------------------

function ProcessTab({ canRun }) {
  const [month, setMonth] = useState(thisMonth());
  const [department, setDepartment] = useState('');
  const [departments, setDepartments] = useState([]);
  const [preview, setPreview] = useState(null);
  const [runs, setRuns] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function loadRuns() {
    api.get('/payroll/runs').then((res) => setRuns(res.data));
  }
  useEffect(() => {
    if (!canRun) return;
    loadRuns();
    api.get('/admin/departments').then((res) => setDepartments(res.data.map((d) => d.name))).catch(() => setDepartments([]));
  }, [canRun]);

  async function calculate(e) {
    e.preventDefault();
    setError(''); setMessage('');
    try {
      const res = await api.get(`/payroll/preview?month=${month}${department ? `&department=${encodeURIComponent(department)}` : ''}`);
      setPreview(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not calculate the run');
    }
  }

  async function confirm() {
    setError('');
    try {
      const res = await api.post('/payroll/run', { month, department: department || undefined });
      setMessage(`Payroll processed for ${res.data.period} — ${res.data.count} employee(s), net ${inr(res.data.run.totalNet)}.`);
      setPreview(null);
      loadRuns();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not process the run');
    }
  }

  if (!canRun) return <div className="small-muted">Payroll processing isn't included in your role's permissions.</div>;

  return (
    <div>
      <form className="card section" onSubmit={calculate}>
        <h3>Run payroll</h3>
        <div className="grid-2">
          <label className="field"><span>Month *</span><input type="month" required value={month} onChange={(e) => setMonth(e.target.value)} /></label>
          <label className="field">
            <span>Department (optional)</span>
            <select value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="">All departments</option>
              {departments.map((d) => <option key={d}>{d}</option>)}
            </select>
          </label>
        </div>
        <button className="btn btn-primary btn-sm" type="submit">Calculate</button>
        {error && <div className="error-text">{error}</div>}
        {message && <div className="small-muted" style={{ marginTop: 8 }}>{message}</div>}
      </form>

      {preview && (
        <div className="card section">
          <h3>Preview — {preview.period}</h3>
          {preview.alreadyProcessed && <div className="error-text">Payroll for {preview.period} has already been processed.</div>}
          <div className="statbar">
            <Stat n={preview.totals.employees} l="Employees" />
            <Stat n={inr(preview.totals.gross)} l="Total Gross" />
            <Stat n={inr(preview.totals.lateCuts)} l="Late Cuts" />
            <Stat n={inr(preview.totals.net)} l="Total Net" />
          </div>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Code</th><th>Name</th><th>Pay Type</th><th>Gross</th><th>Deductions</th><th>LOP Days</th><th>Late Days</th><th>Late Cut</th><th>Net</th></tr></thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.employeeId}>
                    <td>{r.employeeCode}</td><td>{r.name}</td><td>{r.payMode}</td>
                    <td>{inr(r.gross)}</td><td>{inr(r.deductions)}</td><td>{r.lopDays}</td>
                    <td>{r.lateDays}</td><td>{inr(r.lateCut)}</td>
                    <td><b>{inr(r.netPay)}</b></td>
                  </tr>
                ))}
                {preview.rows.length === 0 && <tr><td colSpan="9" className="small-muted">No eligible employees for this month.</td></tr>}
              </tbody>
            </table>
          </div>
          {!preview.alreadyProcessed && preview.rows.length > 0 && (
            <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={confirm}>Confirm & Process Payroll</button>
          )}
        </div>
      )}

      <div className="card section">
        <h3>Payroll history</h3>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Month</th><th>Employees</th><th>Total Gross</th><th>Total Net</th><th>Status</th><th>Processed On</th><th>Paid On</th></tr></thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td>{r.period}</td><td>{r.employees}</td>
                  <td>{inr(r.totalGross)}</td><td><b>{inr(r.totalNet)}</b></td>
                  <td><span className={`status ${r.status === 'Paid' ? 'priority-low' : 'priority-medium'}`}>{r.status}</span></td>
                  <td>{r.processedAt ? new Date(r.processedAt).toISOString().slice(0, 10) : '—'}</td>
                  <td>{r.paidAt ? new Date(r.paidAt).toISOString().slice(0, 10) : '—'}</td>
                </tr>
              ))}
              {runs.length === 0 && <tr><td colSpan="7" className="small-muted">No payroll has been processed yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---- Tab 5: Payslips --------------------------------------------------------

function PayslipsTab({ canRun }) {
  const [payslips, setPayslips] = useState([]);
  const [filters, setFilters] = useState({ code: '', name: '', department: '' });

  useEffect(() => { api.get('/payroll').then((res) => setPayslips(res.data)); }, []);

  async function view(id) {
    const res = await api.get(`/payroll/payslips/${id}`);
    openPayslipWindow(res.data);
  }

  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const filtered = payslips.filter((p) => (
    (!filters.code || (p.employee?.employeeCode || '').toLowerCase().includes(filters.code.toLowerCase()))
    && (!filters.name || (p.employee?.name || '').toLowerCase().includes(filters.name.toLowerCase()))
    && (!filters.department || p.employee?.department === filters.department)
  ));
  const departments = [...new Set(payslips.map((p) => p.employee?.department).filter(Boolean))].sort();

  return (
    <div>
      {canRun && (
        <div className="filter-row">
          <input placeholder="Employee ID…" value={filters.code} onChange={(e) => set('code', e.target.value)} />
          <input placeholder="Employee name…" value={filters.name} onChange={(e) => set('name', e.target.value)} />
          <select value={filters.department} onChange={(e) => set('department', e.target.value)}>
            <option value="">All Departments</option>
            {departments.map((d) => <option key={d}>{d}</option>)}
          </select>
          <span className="small-muted">{filtered.length} payslip(s)</span>
        </div>
      )}
      <div className="tbl-wrap">
        <table>
          <thead><tr>{canRun && <th>Employee</th>}<th>Month</th><th>Pay Type</th><th>Gross</th><th>Basic</th><th>HRA</th><th>PF</th><th>PT</th><th>LOP Days</th><th>Late Cut</th><th>Net Pay</th><th></th></tr></thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                {canRun && <td>{p.employee?.name}</td>}
                <td>{p.month}</td>
                <td>{p.payMode || 'Package'}</td>
                <td>{inr(p.gross || p.basic + p.hra + (p.bonus || 0) + (p.specialAllowance || 0))}</td>
                <td>{inr(p.basic)}</td>
                <td>{inr(p.hra)}</td>
                <td>{inr(p.employeePf)}</td>
                <td>{inr(p.professionalTax)}</td>
                <td>{p.lopDays || 0}</td>
                <td>{inr(p.lateCut)}</td>
                <td style={{ fontWeight: 700 }}>{inr(p.netPay)}</td>
                <td><button className="btn btn-sm" onClick={() => view(p.id)}>View</button></td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={canRun ? 12 : 11} className="small-muted">No payslips yet — run payroll from the Process Payroll tab.</td></tr>}
          </tbody>
        </table>
      </div>
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
        ...(canRun ? [
          { key: 'reports', label: 'Reports', element: <ReportsTab canRun={canRun} /> },
          { key: 'structure', label: 'Salary Structure', element: <StructureTab canRun={canRun} isAdmin={isAdmin} /> },
          { key: 'process', label: 'Process Payroll', element: <ProcessTab canRun={canRun} /> },
        ] : []),
        { key: 'payslips', label: 'Payslips', element: <PayslipsTab canRun={canRun} /> },
      ]}
    />
  );
}
