import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import AccountsDashboard from './AccountsDashboard.jsx';

const ACCOUNTS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'];

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/dashboard').then((res) => setStats(res.data));
  }, []);

  if (!stats) return <div className="small-muted">Loading dashboard…</div>;

  return (
    <div>
      <div className="page-head">
        <h1>Dashboard</h1>
      </div>
      <div className="statbar">
        <Stat n={stats.openRequirements} l="Open requirements" />
        <Stat n={stats.recruiterReview} l="Awaiting recruiter review" />
        <Stat n={stats.withBde} l="Awaiting BDE review" />
        <Stat n={stats.clientReview} l="With client" />
        <Stat n={stats.interviewsScheduled} l="Interviews scheduled" />
        <Stat n={stats.hired} l="Hired this cycle" />
      </div>
      <div className="statbar">
        <Stat n={stats.activeEmployees} l="Active employees" />
        <Stat n={stats.pendingLeave} l="Pending leave requests" />
        <Stat n={stats.invoicesPending} l="Pending invoices" />
        <Stat n={stats.invoicesOverdue} l="Overdue invoices" />
      </div>
      {ACCOUNTS_ROLES.includes(user?.role) && <AccountsDashboard />}
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
