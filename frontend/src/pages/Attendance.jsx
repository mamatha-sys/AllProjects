import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import TabsPage from '../components/TabsPage.jsx';
import { downloadCsv, to12h } from '../utils/csv.js';

const HR_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANT_MANAGER', 'STL', 'TL'];
const STATUSES = ['Present', 'Absent', 'Late', 'Half Day', 'Leave'];
const METHODS = ['Web Check-in', 'Mobile App', 'Biometric (Fingerprint)'];

const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);

// The code/name/department/role filters shared by the Biometric, Punch Log and
// Reports tabs — kept in one place so all three read the same way.
function filterQuery(filters) {
  const params = new URLSearchParams();
  Object.keys(filters).forEach((k) => { if (filters[k]) params.set(k, filters[k]); });
  return params.toString();
}

function useDepartments(enabled) {
  const [departments, setDepartments] = useState([]);
  useEffect(() => {
    if (!enabled) return;
    api.get('/admin/departments').then((res) => setDepartments(res.data.map((d) => d.name))).catch(() => setDepartments([]));
  }, [enabled]);
  return departments;
}

function StatusPill({ status }) {
  if (!status) return <span className="status">Not marked</span>;
  const cls = ['Present', 'WFH'].includes(status) ? 'priority-low' : status === 'Absent' ? 'priority-high' : 'priority-medium';
  return <span className={`status ${cls}`}>{status}</span>;
}

// ---- Tab 1: Dashboard -------------------------------------------------------

function DashboardTab({ isHR }) {
  const [date, setDate] = useState(today());
  const [data, setData] = useState(null);
  const [showMarking, setShowMarking] = useState(true);

  function load() {
    api.get(`/attendance/dashboard?date=${date}`).then((res) => setData(res.data));
  }
  useEffect(load, [date]);

  async function mark(employeeId, status) {
    await api.post('/attendance', { employeeId, date, status });
    load();
  }

  if (!isHR) return <SelfServiceTab />;
  if (!data) return <div className="small-muted">Loading…</div>;
  const k = data.kpis;

  return (
    <div>
      <div className="statbar">
        <Stat n={k.presentToday} l="Present Today" />
        <Stat n={k.absentToday} l="Absent Today" />
        <Stat n={k.lateCheckIn} l="Late Check-in" />
        <Stat n={k.halfDayCut} l="Half-day Cut (month)" />
        <Stat n={k.missingPunchIn} l="Missing Punch-in" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <div className="card">
          <h3 style={{ fontSize: 13, marginBottom: 8 }}>Biometric Reports — Check-in / Check-out</h3>
          <div className="kv"><span className="k">Total Checked In</span><span><b>{k.totalCheckedIn}</b></span></div>
          <div className="kv"><span className="k">Total Checked Out</span><span><b>{k.totalCheckedOut}</b></span></div>
          {data.byMethod.map((m) => (
            <div className="kv" key={m.method}><span className="k">{m.method}</span><span className="small-muted">In: {m.in} · Out: {m.out}</span></div>
          ))}
        </div>
        <div className="card">
          <h3 style={{ fontSize: 13, marginBottom: 8 }}>Regularization Requests</h3>
          {data.regularizations.map((r) => (
            <div className="kv" key={r.id}>
              <span className="k"><b>{r.employee?.name}</b> <span className="small-muted">{r.date}: {r.reason || '—'}</span></span>
              <span className={`status ${r.status === 'Approved' ? 'priority-low' : r.status === 'Rejected' ? 'priority-high' : ''}`}>{r.status}</span>
            </div>
          ))}
          {data.regularizations.length === 0 && <div className="small-muted">No regularization requests.</div>}
        </div>
      </div>

      <div className="card section" style={{ marginTop: 16 }}>
        <div className="filter-row">
          <h3 style={{ flex: 1 }}>Daily marking — {date}</h3>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <button className="btn btn-sm" onClick={() => setShowMarking((s) => !s)}>{showMarking ? '− Hide' : '+ Show'} daily marking</button>
        </div>
        {showMarking && (
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Code</th><th>Name</th><th>Department</th><th>Status</th><th>In</th><th>Location</th><th>Mark</th></tr></thead>
              <tbody>
                {data.marking.map((r) => (
                  <tr key={r.employeeId}>
                    <td>{r.employeeCode}</td>
                    <td>{r.name}</td>
                    <td>{r.department || '—'}</td>
                    <td><StatusPill status={r.status} /></td>
                    <td>{r.checkIn ? to12h(r.checkIn) : '—'}</td>
                    <td>{r.location || '—'}</td>
                    <td>
                      {['Present', 'Absent', 'Half Day'].map((s) => (
                        <button key={s} className="btn btn-sm" style={{ marginRight: 4 }} onClick={() => mark(r.employeeId, s)}>{s}</button>
                      ))}
                    </td>
                  </tr>
                ))}
                {data.marking.length === 0 && <tr><td colSpan="7" className="small-muted">No employees.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// An employee's own view of the Dashboard tab: punch in/out and see their history.
function SelfServiceTab() {
  const [records, setRecords] = useState([]);
  const [punches, setPunches] = useState([]);
  const [method, setMethod] = useState(METHODS[0]);
  const [message, setMessage] = useState('');

  function load() {
    api.get('/attendance').then((res) => setRecords(res.data));
    api.get('/attendance/punches').then((res) => setPunches(res.data));
  }
  useEffect(load, []);

  async function punch(direction) {
    setMessage('');
    const res = await api.post('/attendance/punches', { direction, method });
    setMessage(`Punched ${direction} at ${to12h(res.data.time)} via ${res.data.method}.`);
    load();
  }

  const todayPunches = punches.filter((p) => p.date === today());

  return (
    <div>
      <div className="card section">
        <h3>Check in / Check out</h3>
        <div className="filter-row">
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            {METHODS.map((m) => <option key={m}>{m}</option>)}
          </select>
          <button className="btn btn-sm btn-primary" onClick={() => punch('In')}>Punch In</button>
          <button className="btn btn-sm" onClick={() => punch('Out')}>Punch Out</button>
        </div>
        {message && <div className="small-muted" style={{ marginTop: 8 }}>{message}</div>}
        <div className="small-muted" style={{ marginTop: 8 }}>
          {todayPunches.length ? `${todayPunches.length} punch(es) recorded today.` : 'No punches recorded today yet.'}
        </div>
      </div>

      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Date</th><th>Status</th><th>Check-in</th><th>Check-out</th></tr></thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id}>
                <td>{r.date}</td>
                <td><StatusPill status={r.status} /></td>
                <td>{r.checkIn ? to12h(r.checkIn) : '—'}</td>
                <td>{r.checkOut ? to12h(r.checkOut) : '—'}</td>
              </tr>
            ))}
            {records.length === 0 && <tr><td colSpan="4" className="small-muted">No attendance records yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- Tab 2: Biometric Attendance List ---------------------------------------

function BiometricTab() {
  const [filters, setFilters] = useState({ date: '', code: '', name: '', department: '', role: '' });
  const [data, setData] = useState(null);
  const departments = useDepartments(true);

  useEffect(() => {
    api.get(`/attendance/biometric?${filterQuery(filters)}`).then((res) => setData(res.data));
  }, [filters]);

  function exportCsv() {
    downloadCsv(
      `attendance-${data.month}.csv`,
      ['Code', 'Name', 'Department', 'Role', 'Present', 'Late', 'Half-day Cut', 'Attendance %'],
      data.rows.map((r) => [r.employeeCode, r.name, r.department, r.role, r.present, r.late, r.halfDayCut, `${r.pct}%`])
    );
  }

  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  return (
    <div>
      <div className="filter-row">
        <input type="date" value={filters.date} onChange={(e) => set('date', e.target.value)} />
        <input placeholder="Employee ID…" value={filters.code} onChange={(e) => set('code', e.target.value)} />
        <input placeholder="Employee name…" value={filters.name} onChange={(e) => set('name', e.target.value)} />
        <select value={filters.department} onChange={(e) => set('department', e.target.value)}>
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d}>{d}</option>)}
        </select>
        <button className="btn btn-sm" onClick={() => setFilters({ date: '', code: '', name: '', department: '', role: '' })}>Clear</button>
        {data && <button className="btn btn-sm btn-primary" onClick={exportCsv}>Export</button>}
      </div>
      <div className="small-muted" style={{ marginBottom: 8 }}>
        {filters.date
          ? `Showing the biometric report for ${filters.date}. Clear the date to go back to each employee's last-ever punch.`
          : "Showing each employee's last-ever punch. Pick a date above to see that specific day's biometric report instead."}
      </div>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Code</th><th>Name</th><th>Department</th><th>Role</th><th>Method</th>
              <th>{filters.date ? 'Punches' : 'Last punch (ever)'}</th>
              <th>Check-in</th><th>Check-out</th><th>Location</th>
              <th>Present (month)</th><th>Late (month)</th><th>Half-day Cut (month)</th>
            </tr>
          </thead>
          <tbody>
            {(data?.rows || []).map((r) => (
              <tr key={r.employeeId}>
                <td>{r.employeeCode}</td><td>{r.name}</td><td>{r.department || '—'}</td><td>{r.role || '—'}</td>
                <td>{r.method}</td><td>{r.lastPunch}</td>
                <td>{to12h(r.checkIn)}</td><td>{to12h(r.checkOut)}</td><td>{r.location}</td>
                <td>{r.present}</td><td>{r.late}</td><td>{r.halfDayCut}</td>
              </tr>
            ))}
            {data && data.rows.length === 0 && <tr><td colSpan="12" className="small-muted">No employees match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
      {data && <div className="small-muted" style={{ marginTop: 6 }}>{data.rows.length} employee(s)</div>}
    </div>
  );
}

// ---- Tab 3: Punch Log (Detailed) --------------------------------------------

function PunchLogTab() {
  const [filters, setFilters] = useState({ from: `${thisMonth()}-01`, to: today(), name: '', department: '' });
  const [data, setData] = useState(null);
  const departments = useDepartments(true);

  useEffect(() => {
    api.get(`/attendance/punch-log?${filterQuery(filters)}`).then((res) => setData(res.data));
  }, [filters]);

  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  function exportCsv() {
    downloadCsv(
      `punch-log-${filters.from}_${filters.to}.csv`,
      ['Date', 'Code', 'Name', 'Department', 'Punches', 'First In', 'Last Out', 'Hours', 'Method', 'Location', 'Late?'],
      data.rows.map((r) => [r.date, r.employeeCode, r.name, r.department, r.punches, r.firstIn, r.lastOut, r.hours ?? '—', r.method, r.location, r.late ? 'Late' : 'On time'])
    );
  }

  return (
    <div>
      <div className="filter-row">
        <input type="date" value={filters.from} onChange={(e) => set('from', e.target.value)} />
        <input type="date" value={filters.to} onChange={(e) => set('to', e.target.value)} />
        <input placeholder="Employee name…" value={filters.name} onChange={(e) => set('name', e.target.value)} />
        <select value={filters.department} onChange={(e) => set('department', e.target.value)}>
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d}>{d}</option>)}
        </select>
        <button className="btn btn-sm" onClick={() => setFilters({ from: `${thisMonth()}-01`, to: today(), name: '', department: '' })}>Clear</button>
        {data && <button className="btn btn-sm btn-primary" onClick={exportCsv}>Export</button>}
      </div>
      <div className="small-muted" style={{ marginBottom: 8 }}>Every device punch, paired into one session per employee per day.</div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Date</th><th>Code</th><th>Name</th><th>Punches</th><th>First In</th><th>Last Out</th><th>Hours</th><th>Method</th><th>Location</th><th>Late?</th></tr></thead>
          <tbody>
            {(data?.rows || []).map((r) => (
              <tr key={`${r.employeeId}-${r.date}`}>
                <td>{r.date}</td><td>{r.employeeCode}</td><td>{r.name}</td>
                <td>{r.punches}</td><td>{to12h(r.firstIn)}</td><td>{to12h(r.lastOut)}</td>
                <td>{r.hours ?? '—'}</td><td>{r.method}</td><td>{r.location}</td>
                <td><span className={`status ${r.late ? 'priority-medium' : 'priority-low'}`}>{r.late ? 'Late' : 'On time'}</span></td>
              </tr>
            ))}
            {data && data.rows.length === 0 && <tr><td colSpan="10" className="small-muted">No punches in this date range.</td></tr>}
          </tbody>
        </table>
      </div>
      {data && <div className="small-muted" style={{ marginTop: 6 }}>{data.rows.length} session(s)</div>}
    </div>
  );
}

// ---- Tab 4: Reports (Monthly) -----------------------------------------------

function ReportsTab() {
  const [month, setMonth] = useState(thisMonth());
  const [filters, setFilters] = useState({ code: '', name: '', department: '' });
  const [report, setReport] = useState(null);
  const departments = useDepartments(true);

  useEffect(() => {
    api.get(`/attendance/report?month=${month}&${filterQuery(filters)}`).then((res) => setReport(res.data));
  }, [month, filters]);

  function exportCsv() {
    downloadCsv(
      `attendance-report-${month}.csv`,
      ['Code', 'Name', 'Department', 'Working Days', 'Present', 'Half Day', 'Absent', 'Leave', 'Late', 'Half-day Cut', 'Attendance %'],
      report.rows.map((r) => [r.employeeCode, r.name, r.department, r.workingDays, r.present, r.halfDay, r.absent, r.leave, r.late, r.halfDayCut, `${r.pct}%`])
    );
  }

  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  return (
    <div>
      <div className="filter-row">
        <h3 style={{ flex: 1 }}>Monthly Attendance Report — {report?.monthLabel || month}</h3>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        {report && <button className="btn btn-sm btn-primary" onClick={exportCsv}>Export</button>}
      </div>
      <div className="filter-row">
        <input placeholder="Employee ID…" value={filters.code} onChange={(e) => set('code', e.target.value)} />
        <input placeholder="Employee name…" value={filters.name} onChange={(e) => set('name', e.target.value)} />
        <select value={filters.department} onChange={(e) => set('department', e.target.value)}>
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d}>{d}</option>)}
        </select>
      </div>
      {report && (
        <div className="statbar">
          <Stat n={report.totals.present} l="Total Present Days" />
          <Stat n={report.totals.absent} l="Total Absent Days" />
          <Stat n={report.totals.late} l="Total Late Days" />
          <Stat n={report.totals.halfDayCut} l="Total Half-day Cuts" />
        </div>
      )}
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Code</th><th>Name</th><th>Department</th><th>Working Days</th><th>Present</th><th>Half Day</th><th>Absent</th><th>Leave</th><th>Late</th><th>Half-day Cut</th><th>Attendance %</th></tr></thead>
          <tbody>
            {(report?.rows || []).map((r) => (
              <tr key={r.employeeId}>
                <td>{r.employeeCode}</td><td>{r.name}</td><td>{r.department || '—'}</td>
                <td>{r.workingDays}</td><td>{r.present}</td><td>{r.halfDay}</td><td>{r.absent}</td>
                <td>{r.leave}</td><td>{r.late}</td><td>{r.halfDayCut}</td>
                <td><b>{r.pct}%</b></td>
              </tr>
            ))}
            {report && report.rows.length === 0 && <tr><td colSpan="11" className="small-muted">No employees match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- Tab 5: Check-in Methods (usage + attendance policy) --------------------

function MethodsTab({ canEdit }) {
  const [methods, setMethods] = useState([]);
  const [policy, setPolicy] = useState(null);
  const [error, setError] = useState('');

  function load() {
    api.get('/attendance/methods').then((res) => setMethods(res.data));
    api.get('/attendance/policy').then((res) => setPolicy(res.data));
  }
  useEffect(load, []);

  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      const res = await api.put('/attendance/policy', policy);
      setPolicy(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save the policy');
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div className="card">
        <h3 style={{ fontSize: 13, marginBottom: 4 }}>Check-in Methods</h3>
        <div className="small-muted" style={{ marginBottom: 8 }}>Methods your people may use to record a punch. Usage counts come from the punch log.</div>
        {methods.map((m) => (
          <div className="kv" key={m.method}><span className="k">{m.method}</span><span className="small-muted">{m.punches} punch(es) recorded</span></div>
        ))}
        <div className="small-muted" style={{ marginTop: 8, fontStyle: 'italic' }}>
          A production check-in would additionally capture GPS location (with permission) and a face verification.
        </div>
      </div>

      {policy && (
        <form className="card" onSubmit={save}>
          <h3 style={{ fontSize: 13, marginBottom: 8 }}>Attendance Policies</h3>
          <label className="field"><span>Grace time (late after)</span><input disabled={!canEdit} value={policy.graceTime} onChange={(e) => setPolicy({ ...policy, graceTime: e.target.value })} placeholder="09:30" /></label>
          <label className="field" style={{ marginTop: 8 }}><span>Free late arrivals per month</span><input type="number" disabled={!canEdit} value={policy.freeLateArrivalsPerMonth} onChange={(e) => setPolicy({ ...policy, freeLateArrivalsPerMonth: Number(e.target.value) })} /></label>
          <label className="field" style={{ marginTop: 8 }}><span>Minimum hours for a half day</span><input type="number" disabled={!canEdit} value={policy.halfDayHours} onChange={(e) => setPolicy({ ...policy, halfDayHours: Number(e.target.value) })} /></label>
          <label className="field" style={{ marginTop: 8 }}><span>Minimum hours for a full day</span><input type="number" disabled={!canEdit} value={policy.fullDayHours} onChange={(e) => setPolicy({ ...policy, fullDayHours: Number(e.target.value) })} /></label>
          {error && <div className="error-text">{error}</div>}
          {canEdit && <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} type="submit">Save policy</button>}
          <div className="small-muted" style={{ marginTop: 8 }}>Late days beyond the free allowance become half-day cuts in the monthly report and in payroll.</div>
        </form>
      )}
    </div>
  );
}

// ---- Regularization (kept from main — correcting a missed punch after the fact) ----

function RegularizationTab({ isHR }) {
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState({ date: today(), requestedCheckIn: '', requestedCheckOut: '', reason: '' });

  function load() {
    api.get('/attendance/regularizations').then((res) => setRequests(res.data));
  }
  useEffect(load, []);

  async function submit(e) {
    e.preventDefault();
    await api.post('/attendance/regularizations', form);
    setForm({ ...form, reason: '' });
    load();
  }

  async function decide(id, status) {
    await api.patch(`/attendance/regularizations/${id}/decision`, { status });
    load();
  }

  return (
    <div>
      <form className="card section" onSubmit={submit}>
        <h3>Request regularization</h3>
        <div className="grid-2">
          <label className="field"><span>Date</span><input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
          <label className="field"><span>Requested Check-in</span><input value={form.requestedCheckIn} onChange={(e) => setForm({ ...form, requestedCheckIn: e.target.value })} placeholder="09:15" /></label>
          <label className="field"><span>Requested Check-out</span><input value={form.requestedCheckOut} onChange={(e) => setForm({ ...form, requestedCheckOut: e.target.value })} placeholder="18:15" /></label>
          <label className="field"><span>Reason</span><input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></label>
        </div>
        <button className="btn btn-primary btn-sm" type="submit">Submit request</button>
      </form>

      <div className="tbl-wrap">
        <table>
          <thead><tr>{isHR && <th>Employee</th>}<th>Date</th><th>Requested In</th><th>Requested Out</th><th>Reason</th><th>Status</th>{isHR && <th></th>}</tr></thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                {isHR && <td>{r.employee?.name}</td>}
                <td>{r.date}</td>
                <td>{r.requestedCheckIn || '—'}</td>
                <td>{r.requestedCheckOut || '—'}</td>
                <td>{r.reason || '—'}</td>
                <td><span className={`status ${r.status === 'Approved' ? 'priority-low' : r.status === 'Rejected' ? 'priority-high' : ''}`}>{r.status}</span></td>
                {isHR && <td>{r.status === 'Pending' && (<><button className="btn btn-sm" onClick={() => decide(r.id, 'Approved')}>Approve</button>{' '}<button className="btn btn-sm" onClick={() => decide(r.id, 'Rejected')}>Reject</button></>)}</td>}
              </tr>
            ))}
            {requests.length === 0 && <tr><td colSpan={isHR ? 7 : 5} className="small-muted">No regularization requests yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ n, l }) {
  return <div className="statitem"><div className="n">{n}</div><div className="l">{l}</div></div>;
}

export default function Attendance() {
  const { user } = useAuth();
  const isHR = HR_ROLES.includes(user?.role);
  const canEditPolicy = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role);

  return (
    <TabsPage
      title="Attendance & Time"
      subtitle="Daily marking, device punches, monthly reports and the check-in methods your people may use"
      tabs={[
        { key: 'dashboard', label: 'Dashboard', element: <DashboardTab isHR={isHR} /> },
        ...(isHR ? [
          { key: 'biometric', label: 'Biometric Attendance List', element: <BiometricTab /> },
          { key: 'punchlog', label: 'Punch Log (Detailed)', element: <PunchLogTab /> },
          { key: 'reports', label: 'Reports (Monthly)', element: <ReportsTab /> },
        ] : []),
        { key: 'regularization', label: 'Regularization', element: <RegularizationTab isHR={isHR} /> },
        { key: 'methods', label: 'Check-in Methods', element: <MethodsTab canEdit={canEditPolicy} /> },
      ]}
    />
  );
}
