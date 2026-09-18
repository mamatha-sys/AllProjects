import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';

const HR_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANT_MANAGER', 'STL', 'TL'];
const STATUSES = ['Present', 'Absent', 'Late', 'Half Day', 'Leave'];

export default function Attendance() {
  const { user } = useAuth();
  const isHR = HR_ROLES.includes(user?.role);
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
      <div className="page-head"><h1>Attendance & Time</h1></div>

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
