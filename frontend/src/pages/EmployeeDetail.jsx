import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';

const HR_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANT_MANAGER', 'STL', 'TL'];

export default function EmployeeDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const isHR = HR_ROLES.includes(user?.role);
  const [employee, setEmployee] = useState(null);

  function load() {
    api.get(`/employees/${id}`).then((res) => setEmployee(res.data));
  }
  useEffect(load, [id]);

  async function toggleOnboarding(index) {
    await api.patch(`/employees/${id}/onboarding/${index}`);
    load();
  }

  async function initiateOffboarding() {
    if (!confirm('Initiate offboarding for this employee?')) return;
    await api.post(`/employees/${id}/offboarding`);
    load();
  }

  async function toggleOffboarding(index) {
    await api.patch(`/employees/${id}/offboarding/${index}`);
    load();
  }

  async function decideChanges(action) {
    await api.patch(`/employees/${id}/changes/${action}`);
    load();
  }

  if (!employee) return <div className="small-muted">Loading…</div>;

  const onboardingDone = employee.onboardingTasks ? employee.onboardingTasks.filter((t) => t.completed).length : 0;
  const onboardingTotal = employee.onboardingTasks ? employee.onboardingTasks.length : 0;
  const onboardingPct = onboardingTotal ? Math.round((onboardingDone / onboardingTotal) * 100) : 0;

  return (
    <div>
      <Link className="small-muted" to="/employees">← Back to employees</Link>
      <div className="page-head" style={{ marginTop: 10 }}>
        <h1>{employee.name}</h1>
        <span className={`status ${employee.employmentStatus === 'Active' ? 'priority-low' : ['Exited', 'Relieved'].includes(employee.employmentStatus) ? 'priority-high' : ''}`}>{employee.employmentStatus}</span>
      </div>

      {employee.pendingChanges && (
        <div className="card section" style={{ borderColor: 'var(--warn)' }}>
          <h3>Profile changes pending review</h3>
          {employee.pendingChanges.map((c, i) => (
            <div className="kv" key={i}><span className="k">{c.label}</span><span>{c.from || '—'} → {c.to}</span></div>
          ))}
          {isHR && (
            <div style={{ marginTop: 10 }}>
              <button className="btn btn-primary btn-sm" onClick={() => decideChanges('approve')}>Approve</button>{' '}
              <button className="btn btn-sm" onClick={() => decideChanges('reject')}>Send back</button>
            </div>
          )}
        </div>
      )}

      <div className="two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <h3 style={{ fontSize: 13, marginBottom: 8 }}>Profile — {employee.profileCompletionPct}% complete</h3>
          <div className="kv"><span className="k">Employee Code</span><span>{employee.employeeCode}</span></div>
          <div className="kv"><span className="k">Email</span><span>{employee.email || '—'}</span></div>
          <div className="kv"><span className="k">Phone</span><span>{employee.phone || '—'}</span></div>
          <div className="kv"><span className="k">Department</span><span>{employee.department || '—'}</span></div>
          <div className="kv"><span className="k">Designation</span><span>{employee.designation || '—'}</span></div>
          <div className="kv"><span className="k">Location</span><span>{employee.location || '—'}</span></div>
          <div className="kv"><span className="k">Employee Type</span><span>{employee.employeeType || '—'}</span></div>
          <div className="kv"><span className="k">Gender</span><span>{employee.gender || '—'}</span></div>
          <div className="kv"><span className="k">Date of Birth</span><span>{employee.dateOfBirth ? new Date(employee.dateOfBirth).toLocaleDateString() : '—'}</span></div>
          <div className="kv"><span className="k">Date of Joining</span><span>{employee.dateOfJoining ? new Date(employee.dateOfJoining).toLocaleDateString() : '—'}</span></div>
          <div className="kv"><span className="k">Reporting Manager</span><span>{employee.reportingManager?.name || '—'}</span></div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 13, marginBottom: 8 }}>Emergency & login</h3>
          <div className="kv"><span className="k">Emergency Contact</span><span>{employee.emergencyContactName || '—'} {employee.emergencyContactPhone ? `(${employee.emergencyContactPhone})` : ''}</span></div>
          <div className="kv"><span className="k">Address</span><span>{employee.address || '—'}</span></div>
          <div className="kv"><span className="k">Login Account</span><span>{employee.user ? `${employee.user.name} · ${employee.user.role}` : 'Not linked'}</span></div>
        </div>
      </div>

      <div className="card section">
        <h3>Onboarding checklist — {onboardingPct}%</h3>
        {(employee.onboardingTasks || []).map((t, i) => (
          <label key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', fontSize: 13.5 }}>
            <input type="checkbox" checked={t.completed} disabled={!isHR} onChange={() => toggleOnboarding(i)} style={{ width: 'auto' }} />
            <span style={{ textDecoration: t.completed ? 'line-through' : 'none', color: t.completed ? 'var(--ink-soft)' : 'var(--ink)' }}>{t.task}</span>
          </label>
        ))}
      </div>

      {isHR && !employee.offboardingStatus && !['Exited', 'Relieved'].includes(employee.employmentStatus) && (
        <div className="card section">
          <h3>Offboarding</h3>
          <button className="btn btn-sm" onClick={initiateOffboarding}>Initiate Offboarding</button>
        </div>
      )}

      {employee.offboardingStatus && (
        <div className="card section">
          <h3>Offboarding — <span className={`status ${employee.offboardingStatus === 'Cleared' ? 'priority-low' : ''}`}>{employee.offboardingStatus}</span></h3>
          {(employee.offboardingTasks || []).map((t, i) => (
            <label key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', fontSize: 13.5 }}>
              <input type="checkbox" checked={t.completed} disabled={!isHR} onChange={() => toggleOffboarding(i)} style={{ width: 'auto' }} />
              <span style={{ textDecoration: t.completed ? 'line-through' : 'none', color: t.completed ? 'var(--ink-soft)' : 'var(--ink)' }}>{t.task}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
