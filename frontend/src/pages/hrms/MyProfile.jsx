import { useEffect, useState } from 'react';
import api from '../../api';

export default function MyProfile() {
  const [employee, setEmployee] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ phone: '', email: '', emergencyContactName: '', emergencyContactPhone: '', address: '' });
  const [message, setMessage] = useState('');

  function load() {
    api.get('/employees/me')
      .then((res) => { setEmployee(res.data); setForm({ phone: res.data.phone || '', email: res.data.email || '', emergencyContactName: res.data.emergencyContactName || '', emergencyContactPhone: res.data.emergencyContactPhone || '', address: res.data.address || '' }); })
      .catch(() => setError('No employee record linked to this account.'));
  }
  useEffect(load, []);

  async function submit(e) {
    e.preventDefault();
    setMessage('');
    try {
      await api.put('/employees/me', form);
      setMessage('Submitted for HR review.');
      load();
    } catch (err) {
      setMessage(err.response?.data?.error || 'No changes to submit.');
    }
  }

  if (error) return <div className="empty small-muted">{error}</div>;
  if (!employee) return <div className="small-muted">Loading…</div>;

  return (
    <div>
      <div className="page-head"><div><h1>My Profile</h1><div className="page-sub">{employee.name} · {employee.employeeCode}</div></div></div>

      {employee.pendingChanges && <div className="card section" style={{ borderColor: 'var(--warn)' }}><div className="small-muted">Your submitted changes are pending HR review.</div></div>}

      <form className="card section" onSubmit={submit}>
        <h3>Editable details</h3>
        <div className="grid-2">
          <label className="field"><span>Phone</span><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          <label className="field"><span>Email</span><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label className="field"><span>Emergency Contact Name</span><input value={form.emergencyContactName} onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} /></label>
          <label className="field"><span>Emergency Contact Phone</span><input value={form.emergencyContactPhone} onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })} /></label>
          <label className="field"><span>Address</span><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
        </div>
        <button className="btn btn-primary btn-sm" type="submit">Submit for Review</button>
        {message && <span className="small-muted" style={{ marginLeft: 10 }}>{message}</span>}
      </form>

      <div className="card">
        <h3 style={{ fontSize: 13, marginBottom: 8 }}>Read-only details</h3>
        <div className="kv"><span className="k">Department</span><span>{employee.department || '—'}</span></div>
        <div className="kv"><span className="k">Designation</span><span>{employee.designation || '—'}</span></div>
        <div className="kv"><span className="k">Reporting Manager</span><span>{employee.reportingManager?.name || '—'}</span></div>
        <div className="kv"><span className="k">Joining Date</span><span>{employee.dateOfJoining ? new Date(employee.dateOfJoining).toLocaleDateString() : '—'}</span></div>
      </div>
    </div>
  );
}
