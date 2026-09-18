import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';

const HR_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANT_MANAGER', 'STL', 'TL'];

// Generic list + create + (optional) status-decision page for the EmployeeRecord-backed
// HRMS areas (KT, Targets, Resignation, Recognition, Disciplinary, Shift Roster, Timesheet,
// Assets, Expenses, Helpdesk, Access Requests, Weekly Ideas) — one component, ~12 configs.
export default function SimpleRecordPage({
  title,
  apiPath,
  titleLabel = 'Title',
  detailLabel = 'Detail',
  showDate = false,
  dateLabel = 'Date',
  showAmount = false,
  showHours = false,
  statuses = ['Open', 'In Progress', 'Resolved'],
  decisions = null, // e.g. ['Approved', 'Rejected'] to show decision buttons for HR roles
}) {
  const { user } = useAuth();
  const isHR = HR_ROLES.includes(user?.role);
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState({ title: '', detail: '', date: '', amount: '', hours: '' });

  function load() {
    api.get(apiPath).then((res) => setRecords(res.data));
  }
  useEffect(load, [apiPath]);

  async function submit(e) {
    e.preventDefault();
    const payload = { title: form.title, detail: form.detail };
    if (showDate) payload.date = form.date;
    if (showAmount) payload.amount = form.amount;
    if (showHours) payload.hours = form.hours;
    await api.post(apiPath, payload);
    setForm({ title: '', detail: '', date: '', amount: '', hours: '' });
    load();
  }

  async function decide(id, status) {
    await api.patch(`${apiPath}/${id}/status`, { status });
    load();
  }

  return (
    <div>
      <div className="page-head"><h1>{title}</h1></div>

      <form className="card section" onSubmit={submit}>
        <div className="grid-2">
          <label className="field"><span>{titleLabel}</span><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label className="field"><span>{detailLabel}</span><input value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} /></label>
          {showDate && <label className="field"><span>{dateLabel}</span><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>}
          {showAmount && <label className="field"><span>Amount (₹)</span><input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>}
          {showHours && <label className="field"><span>Hours</span><input type="number" step="0.5" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} /></label>}
        </div>
        <button className="btn btn-primary btn-sm" type="submit">Submit</button>
      </form>

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              {isHR && <th>Employee</th>}
              <th>{titleLabel}</th>
              <th>{detailLabel}</th>
              {showDate && <th>{dateLabel}</th>}
              {showAmount && <th>Amount</th>}
              {showHours && <th>Hours</th>}
              <th>Status</th>
              {isHR && decisions && <th></th>}
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id}>
                {isHR && <td>{r.employee?.name}</td>}
                <td>{r.title}</td>
                <td>{r.detail || '—'}</td>
                {showDate && <td>{r.date || '—'}</td>}
                {showAmount && <td>{r.amount != null ? `₹${r.amount.toLocaleString('en-IN')}` : '—'}</td>}
                {showHours && <td>{r.hours ?? '—'}</td>}
                <td><span className="status">{r.status}</span></td>
                {isHR && decisions && (
                  <td>
                    {decisions.map((d) => (
                      <button key={d} className="btn btn-sm" style={{ marginRight: 6 }} onClick={() => decide(r.id, d)}>{d}</button>
                    ))}
                  </td>
                )}
              </tr>
            ))}
            {records.length === 0 && (
              <tr><td colSpan="8" className="small-muted">No records yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
