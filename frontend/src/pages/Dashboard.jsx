import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import AccountsDashboard from './AccountsDashboard.jsx';

const ACCOUNTS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'];
const NOT_CLIENT = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANT_MANAGER', 'STL', 'TL', 'RECRUITER', 'BDE'];

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [jp, setJp] = useState(null);

  useEffect(() => {
    api.get('/dashboard').then((res) => setStats(res.data));
    if (NOT_CLIENT.includes(user?.role)) {
      api.get('/integrations/job-portal').then((res) => setJp(res.data)).catch(() => setJp(null));
    }
  }, [user?.role]);

  async function syncNow() {
    await api.post('/integrations/job-portal/sync');
    api.get('/integrations/job-portal').then((res) => setJp(res.data));
  }

  if (!stats) return <div className="small-muted">Loading dashboard…</div>;

  return (
    <div>
      <div className="page-head">
        <h1>Dashboard</h1>
      </div>
      {/* The six ATS tiles, with the prototype's own labels and counts
          (atsDashboard, line 6262). */}
      <div className="statbar">
        <Stat n={stats.openRequirements} l="Open requirements" />
        <Stat n={stats.recruiterReview} l="Recruiter review" />
        <Stat n={stats.withBde} l="With BDE" />
        <Stat n={stats.clientReview} l="Client review" />
        <Stat n={stats.interviewsUpcoming} l="Interviews upcoming" />
        <Stat n={stats.hiringOutcomes} l="Hiring outcomes this cycle" />
      </div>
      <div className="statbar">
        <Stat n={stats.activeEmployees} l="Active employees" />
        <Stat n={stats.pendingLeave} l="Pending leave requests" />
        <Stat n={stats.invoicesPending} l="Pending invoices" />
        <Stat n={stats.invoicesOverdue} l="Overdue invoices" />
      </div>
      {ACCOUNTS_ROLES.includes(user?.role) && <AccountsDashboard />}

      {jp && (
        <div className="card section">
          <h3 style={{ fontSize: 13, marginBottom: 8 }}>Job Portal Integration</h3>
          <div className="kv"><span className="k">Connection</span><span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: jp.status === 'Connected' ? '#1e8449' : '#c0392b', marginRight: 6 }} />{jp.status}</span></div>
          <div className="kv"><span className="k">Last Sync</span><span>{jp.lastSync ? new Date(jp.lastSync).toLocaleString() : '—'}</span></div>
          <div className="kv"><span className="k">Candidates Synced</span><span>{jp.candidatesSynced}</span></div>
          {jp.requirementsNeedingMapping > 0 && (
            <div className="kv"><span className="k">Needs Mapping</span><span className="status priority-high">{jp.requirementsNeedingMapping}</span></div>
          )}
          <div style={{ marginTop: 8 }}>
            <button className="btn btn-sm btn-primary" onClick={syncNow}>Sync</button>{' '}
            <a className="btn btn-sm" href="/careers" target="_blank" rel="noreferrer">Open Job Portal ↗</a>
          </div>
          <div style={{ marginTop: 8 }}><Link className="link-btn" to="/admin/integrations">Full integration details →</Link></div>
        </div>
      )}

      <div className="card section">
        <h3>Pipeline by stage</h3>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Stage</th><th>Candidates</th></tr></thead>
            <tbody>
              {(stats.pipelineByStage || []).map((s) => (
                <tr key={s.stage}>
                  <td>{s.label}</td>
                  <td>{s.count}</td>
                </tr>
              ))}
              {(!stats.pipelineByStage || stats.pipelineByStage.length === 0) && (
                <tr><td colSpan="2" className="small-muted">No candidates in the pipeline yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card section">
        <h3>Recruiter workload</h3>
        {(stats.recruiterWorkload || []).map((r) => (
          <div className="kv" key={r.name}>
            <span className="k">{r.name}</span>
            <span>{r.requirements} requirements</span>
          </div>
        ))}
        {(!stats.recruiterWorkload || stats.recruiterWorkload.length === 0) && (
          <div className="small-muted">No recruiters on file.</div>
        )}
      </div>

      <div className="card section">
        <h3>Recent activity</h3>
        <div className="timeline">
          {stats.recentActivity.map((a, i) => (
            <div className="timeline-item" key={i}>
              <div className="timeline-date">{new Date(a.date).toLocaleString()}</div>
              <div>{a.user} — {a.action} ({a.entity})</div>
            </div>
          ))}
          {stats.recentActivity.length === 0 && <div className="small-muted">No activity yet.</div>}
        </div>
      </div>
    </div>
  );
}

function Stat({ n, l }) {
  return (
    <div className="statitem">
      <div className="n">{n}</div>
      <div className="l">{l}</div>
    </div>
  );
}
