import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import TabsPage from '../components/TabsPage.jsx';

const HR_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANT_MANAGER', 'STL', 'TL'];
const STATUSES = ['Present', 'Absent', 'Late', 'Half Day', 'Leave'];

function MarkingTab({ isHR }) {
  const today = new Date().toISOString().slice(0, 10);
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({ employeeId: '', date: today, status: 'Present', checkIn: '', checkOut: '' });

  function load() {
    api.get('/attendance').then((res) => setRecords(res.data));
  }
  useEffect(() => {
    load();
    if (isHR) api.get('/employees').then((res) => setEmployees(res.data));
  }, [isHR]);

  async function markAttendance(e) {
    e.preventDefault();
    await api.post('/attendance', form);
    load();
  }

  return (
    <div>
      <form className="card section" onSubmit={markAttendance}>
        <h3>Mark attendance</h3>
        <div className="grid-2">
          {isHR && (
            <label className="field">
              <span>Employee</span>
              <select required value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
                <option value="">Select employee</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </label>
          )}
          <label className="field"><span>Date</span><input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
          <label className="field">
            <span>Status</span>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label className="field"><span>Check-in</span><input value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} placeholder="09:00" /></label>
          <label className="field"><span>Check-out</span><input value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} placeholder="18:00" /></label>
        </div>
        <button className="btn btn-primary btn-sm" type="submit">Save</button>
      </form>

      <div className="tbl-wrap">
        <table>
          <thead><tr>{isHR && <th>Employee</th>}<th>Date</th><th>Status</th><th>Check-in</th><th>Check-out</th></tr></thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id}>
                {isHR && <td>{r.employee?.name}</td>}
                <td>{r.date}</td>
                <td><span className="status">{r.status}</span></td>
                <td>{r.checkIn || '—'}</td>
                <td>{r.checkOut || '—'}</td>
              </tr>
            ))}
            {records.length === 0 && <tr><td colSpan={isHR ? 5 : 4} className="small-muted">No attendance records yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RegularizationTab({ isHR }) {
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), requestedCheckIn: '', requestedCheckOut: '', reason: '' });

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

function ReportsTab() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [report, setReport] = useState(null);

  useEffect(() => {
    api.get(`/attendance/report?month=${month}`).then((res) => setReport(res.data));
  }, [month]);

  return (
    <div>
      <div className="filter-row">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>
      {report && (
        <div className="statbar">
          <div className="statitem"><div className="n">{report.workingDays}</div><div className="l">Working Days</div></div>
        </div>
      )}
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Code</th><th>Name</th><th>Department</th><th>Present</th><th>Late</th><th>Half Day</th><th>Absent</th><th>Attendance %</th></tr></thead>
          <tbody>
            {(report?.rows || []).map((r) => (
              <tr key={r.employeeId}>
                <td>{r.employeeCode}</td><td>{r.name}</td><td>{r.department || '—'}</td>
                <td>{r.present}</td><td>{r.late}</td><td>{r.halfDay}</td><td>{r.absent}</td>
                <td><b>{r.pct}%</b></td>
              </tr>
            ))}
            {report && report.rows.length === 0 && <tr><td colSpan="8" className="small-muted">No employees.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PoliciesTab({ canEdit }) {
  const [policy, setPolicy] = useState(null);

  function load() {
    api.get('/attendance/policy').then((res) => setPolicy(res.data));
  }
  useEffect(load, []);

  async function save(e) {
    e.preventDefault();
    await api.put('/attendance/policy', policy);
    load();
  }

  if (!policy) return <div className="small-muted">Loading…</div>;

  return (
    <form className="card section" onSubmit={save} style={{ maxWidth: 420 }}>
      <h3>Attendance policy</h3>
      <label className="field"><span>Grace time (minutes)</span><input type="number" disabled={!canEdit} value={policy.graceTimeMinutes} onChange={(e) => setPolicy({ ...policy, graceTimeMinutes: Number(e.target.value) })} /></label>
      <label className="field" style={{ marginTop: 8 }}><span>Free late arrivals per month</span><input type="number" disabled={!canEdit} value={policy.freeLateArrivalsPerMonth} onChange={(e) => setPolicy({ ...policy, freeLateArrivalsPerMonth: Number(e.target.value) })} /></label>
      <label className="field" style={{ marginTop: 8 }}><span>Minimum hours for a half day</span><input type="number" disabled={!canEdit} value={policy.halfDayHours} onChange={(e) => setPolicy({ ...policy, halfDayHours: Number(e.target.value) })} /></label>
      <label className="field" style={{ marginTop: 8 }}><span>Minimum hours for a full day</span><input type="number" disabled={!canEdit} value={policy.fullDayHours} onChange={(e) => setPolicy({ ...policy, fullDayHours: Number(e.target.value) })} /></label>
      {canEdit && <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} type="submit">Save policy</button>}
      <div className="small-muted" style={{ marginTop: 8 }}>Late days beyond the free allowance become half-day cuts in payroll.</div>
    </form>
  );
}

export default function Attendance() {
  const { user } = useAuth();
  const isHR = HR_ROLES.includes(user?.role);
  const canEditPolicy = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role);

  return (
    <TabsPage
      title="Attendance & Time"
      subtitle="Daily marking, regularization requests, monthly reports and policy"
      tabs={[
        { key: 'marking', label: 'Daily Marking', element: <MarkingTab isHR={isHR} /> },
        { key: 'regularization', label: 'Regularization', element: <RegularizationTab isHR={isHR} /> },
        ...(isHR ? [{ key: 'reports', label: 'Reports', element: <ReportsTab /> }] : []),
        { key: 'policies', label: 'Policies', element: <PoliciesTab canEdit={canEditPolicy} /> },
      ]}
    />
  );
}
