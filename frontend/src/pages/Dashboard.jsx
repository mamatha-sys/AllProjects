import { useEffect, useState } from 'react';
import api from '../api';

export default function Dashboard() {
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
