import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';

const HR_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANT_MANAGER', 'STL', 'TL'];
const TYPES = ['Sick', 'Casual', 'Earned', 'Unpaid'];

export default function Leave() {
  const { user } = useAuth();
  const isHR = HR_ROLES.includes(user?.role);

  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState({ type: 'Casual', fromDate: '', toDate: '', reason: '' });

  function load() {
    api.get('/leave').then((res) => setRequests(res.data));
  }
  useEffect(load, []);

  async function submitLeave(e) {
    e.preventDefault();
    await api.post('/leave', form);
    setForm({ type: 'Casual', fromDate: '', toDate: '', reason: '' });
    load();
  }

  async function decide(id, status) {
    await api.patch(`/leave/${id}/decision`, { status });
    load();
  }

  return (
    <div>
      <div className="page-head"><h1>Leave & Holidays</h1></div>

      <form className="card section" onSubmit={submitLeave}>
        <h3>Request leave</h3>
        <div className="grid-2">
          <label className="field">
            <span>Type</span>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label className="field"><span>From</span><input type="date" required value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} /></label>
          <label className="field"><span>To</span><input type="date" required value={form.toDate} onChange={(e) => setForm({ ...form, toDate: e.target.value })} /></label>
          <label className="field"><span>Reason</span><input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></label>
        </div>
        <button className="btn btn-primary btn-sm" type="submit">Submit request</button>
      </form>

      <div className="tbl-wrap">
        <table>
          <thead><tr>{isHR && <th>Employee</th>}<th>Type</th><th>From</th><th>To</th><th>Reason</th><th>Status</th>{isHR && <th>Decision</th>}</tr></thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                {isHR && <td>{r.employee?.name}</td>}
                <td>{r.type}</td>
                <td>{r.fromDate}</td>
                <td>{r.toDate}</td>
                <td>{r.reason || '—'}</td>
                <td><span className={`status ${r.status === 'Approved' ? 'priority-low' : r.status === 'Rejected' ? 'priority-high' : ''}`}>{r.status}</span></td>
                {isHR && (
                  <td>
                    {r.status === 'Pending' ? (
                      <>
                        <button className="btn btn-sm" onClick={() => decide(r.id, 'Approved')}>Approve</button>{' '}
                        <button className="btn btn-sm" onClick={() => decide(r.id, 'Rejected')}>Reject</button>
                      </>
                    ) : '—'}
                  </td>
                )}
              </tr>
            ))}
            {requests.length === 0 && <tr><td colSpan={isHR ? 7 : 5} className="small-muted">No leave requests yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
