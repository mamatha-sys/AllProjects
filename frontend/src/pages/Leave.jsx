import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import TabsPage from '../components/TabsPage.jsx';

const HR_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANT_MANAGER', 'STL', 'TL'];

function DashboardTab({ isHR, canEditPolicy }) {
  const [requests, setRequests] = useState([]);
  const [types, setTypes] = useState([]);
  const [form, setForm] = useState({ type: '', fromDate: '', toDate: '', reason: '' });

  function load() {
    api.get('/leave').then((res) => setRequests(res.data));
    api.get('/leave/types').then((res) => setTypes(res.data));
  }
  useEffect(load, []);

  async function submitLeave(e) {
    e.preventDefault();
    await api.post('/leave', form);
    setForm({ type: '', fromDate: '', toDate: '', reason: '' });
    load();
  }

  async function decide(id, status) {
    await api.patch(`/leave/${id}/decision`, { status });
    load();
  }

  async function requestCancel(id) {
    await api.patch(`/leave/${id}/cancel-request`);
    load();
  }

  async function editCap(type) {
    const v = prompt(`Annual/monthly cap for ${type.name} (${type.unit})`, type.cap);
    if (v === null) return;
    await api.put(`/leave/types/${type.id}`, { cap: Number(v) || 0 });
    load();
  }

  async function toggleType(type) {
    await api.put(`/leave/types/${type.id}`, { active: !type.active });
    load();
  }

  const activeTypes = types.filter((t) => t.active);
  const pending = requests.filter((r) => r.status === 'Pending');
  const approved = requests.filter((r) => r.status === 'Approved');
  const rejected = requests.filter((r) => r.status === 'Rejected');
  const cancellations = requests.filter((r) => r.status === 'Cancellation Requested');
  const today = new Date().toISOString().slice(0, 10);
  const onLeaveToday = approved.filter((r) => r.fromDate <= today && (r.toDate || r.fromDate) >= today);

  return (
    <div>
      <div className="statbar">
        <div className="statitem"><div className="n">{pending.length}</div><div className="l">Pending Requests</div></div>
        <div className="statitem"><div className="n">{approved.length}</div><div className="l">Approved</div></div>
        <div className="statitem"><div className="n">{rejected.length}</div><div className="l">Rejected</div></div>
        <div className="statitem"><div className="n">{onLeaveToday.length}</div><div className="l">On Leave Today</div></div>
        <div className="statitem"><div className="n">{cancellations.length}</div><div className="l">Cancellation Requests</div></div>
      </div>

      <form className="card section" onSubmit={submitLeave}>
        <h3>Apply Leave</h3>
        <div className="grid-2">
          <label className="field">
            <span>Type</span>
            <select required value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="">Select type</option>
              {activeTypes.map((t) => <option key={t.id} value={t.name}>{t.name} ({t.code})</option>)}
            </select>
          </label>
          <label className="field"><span>From</span><input type="date" required value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} /></label>
          <label className="field"><span>To</span><input type="date" required value={form.toDate} onChange={(e) => setForm({ ...form, toDate: e.target.value })} /></label>
          <label className="field"><span>Reason</span><input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></label>
        </div>
        <button className="btn btn-primary btn-sm" type="submit">Submit request</button>
      </form>

      <div className="card section">
        <h3>Leave Types & Policy</h3>
        {types.map((t) => (
          <div className="kv" key={t.id} style={{ opacity: t.active ? 1 : 0.55 }}>
            <span className="k">{t.name} ({t.code}) {t.carries && <span className="status priority-low">Carries forward</span>}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="small-muted">{t.unit === 'unpaid' ? 'Unpaid' : `${t.cap}/${t.unit}`}</span>
              {canEditPolicy && <button className="btn btn-sm" onClick={() => editCap(t)}>Edit</button>}
              {canEditPolicy && <button className="btn btn-sm" onClick={() => toggleType(t)}>{t.active ? 'Pause' : 'Resume'}</button>}
            </span>
          </div>
        ))}
      </div>

      <div className="tbl-wrap">
        <table>
          <thead><tr>{isHR && <th>Employee</th>}<th>Type</th><th>From</th><th>To</th><th>Reason</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                {isHR && <td>{r.employee?.name}</td>}
                <td>{r.type}</td>
                <td>{r.fromDate}</td>
                <td>{r.toDate}</td>
                <td>{r.reason || '—'}</td>
                <td><span className={`status ${r.status === 'Approved' ? 'priority-low' : r.status === 'Rejected' ? 'priority-high' : ''}`}>{r.status}</span></td>
                <td>
                  {isHR && ['Pending', 'Cancellation Requested'].includes(r.status) && (
                    <>
                      <button className="btn btn-sm" onClick={() => decide(r.id, r.status === 'Cancellation Requested' ? 'Cancelled' : 'Approved')}>{r.status === 'Cancellation Requested' ? 'Confirm Cancel' : 'Approve'}</button>{' '}
                      <button className="btn btn-sm" onClick={() => decide(r.id, 'Rejected')}>Reject</button>
                    </>
                  )}
                  {!isHR && r.status === 'Approved' && <button className="btn btn-sm" onClick={() => requestCancel(r.id)}>Request Cancellation</button>}
                </td>
              </tr>
            ))}
            {requests.length === 0 && <tr><td colSpan={isHR ? 7 : 6} className="small-muted">No leave requests yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportsTab() {
  const [requests, setRequests] = useState([]);
  useEffect(() => { api.get('/leave').then((res) => setRequests(res.data)); }, []);

  return (
    <div className="tbl-wrap">
      <table>
        <thead><tr><th>Employee</th><th>Department</th><th>Type</th><th>From</th><th>To</th><th>Status</th></tr></thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id}>
              <td>{r.employee?.name}</td><td>{r.employee?.department || '—'}</td><td>{r.type}</td>
              <td>{r.fromDate}</td><td>{r.toDate}</td>
              <td><span className={`status ${r.status === 'Approved' ? 'priority-low' : r.status === 'Rejected' ? 'priority-high' : ''}`}>{r.status}</span></td>
            </tr>
          ))}
          {requests.length === 0 && <tr><td colSpan="6" className="small-muted">No leave requests yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function HolidaysTab({ canManage }) {
  const [holidays, setHolidays] = useState([]);
  const [form, setForm] = useState({ name: '', date: '' });

  function load() {
    api.get('/leave/holidays').then((res) => setHolidays(res.data));
  }
  useEffect(load, []);

  async function add(e) {
    e.preventDefault();
    await api.post('/leave/holidays', form);
    setForm({ name: '', date: '' });
    load();
  }

  return (
    <div>
      {canManage && (
        <form className="filter-row" onSubmit={add}>
          <input required placeholder="Holiday name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <button className="btn btn-sm btn-primary" type="submit">Add holiday</button>
        </form>
      )}
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Holiday</th><th>Date</th></tr></thead>
          <tbody>
            {holidays.map((h) => <tr key={h.id}><td>{h.name}</td><td>{h.date}</td></tr>)}
            {holidays.length === 0 && <tr><td colSpan="2" className="small-muted">No holidays configured.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Leave() {
  const { user } = useAuth();
  const isHR = HR_ROLES.includes(user?.role);
  const canEditPolicy = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role);

  return (
    <TabsPage
      title="Leave & Holidays"
      subtitle="Requests, approvals, leave policy and the holiday calendar"
      tabs={[
        { key: 'dashboard', label: 'Dashboard', element: <DashboardTab isHR={isHR} canEditPolicy={canEditPolicy} /> },
        ...(isHR ? [{ key: 'reports', label: 'Reports', element: <ReportsTab /> }] : []),
        { key: 'holidays', label: 'Holidays', element: <HolidaysTab canManage={isHR} /> },
      ]}
    />
  );
}
