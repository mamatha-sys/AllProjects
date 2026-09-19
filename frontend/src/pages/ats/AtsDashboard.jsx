import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../context/AuthContext.jsx';
import { KV } from './atsUi';

// The prototype's atsDashboard() (line 6252): the role work strip, a six-cell
// stat bar, then a two-column body with "Pipeline by stage" on the left and
// "Recruiter workload" on the right. Every count is live and clickable.
export default function AtsDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/dashboard').then((res) => setData(res.data));
  }, []);

  if (!data) return <div className="small-muted">Loading…</div>;

  const role = user?.role;
  const go = (label, n, to) => (
    <div className="assign-row" data-goto="1" key={label} onClick={() => navigate(to)}>
      <span>{label}</span>
      <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <b style={{ fontSize: 15 }}>{n}</b>
        <span className="cell-muted">→</span>
      </span>
    </div>
  );

  // roleWorkStrip(): each role lands on the work that is actually theirs.
  // Super Admin / Admin keep the org-wide stat bar below instead.
  let workTitle = '';
  let workRows = null;
  if (role === 'RECRUITER') {
    workTitle = 'My work';
    workRows = [
      go('Pending my review', data.recruiterReview, '/candidates?stage=RECRUITER_REVIEW'),
      go('Upcoming interviews', data.interviewsUpcoming, '/ats/calendar'),
      go('Open requirements', data.openRequirements, '/requirements'),
    ];
  } else if (role === 'BDE') {
    workTitle = 'My work';
    workRows = [
      go('Candidates waiting with me', data.withBde, '/candidates?stage=WITH_BDE'),
      go('Awaiting client feedback', data.clientReview, '/candidates?stage=CLIENT_REVIEW'),
      go('Client interviews', data.interviewsUpcoming, '/ats/calendar'),
    ];
  } else if (['TL', 'STL', 'MANAGER', 'ASSISTANT_MANAGER'].includes(role)) {
    workTitle = 'Team work';
    workRows = [
      go('Pending approvals', data.recruiterReview + data.withBde + data.clientReview, '/candidates'),
      go('Open requirements', data.openRequirements, '/requirements'),
      go('Upcoming interviews', data.interviewsUpcoming, '/ats/calendar'),
    ];
  } else if (role === 'CLIENT') {
    workTitle = 'Your actions';
    workRows = [
      go('My requirements', data.openRequirements, '/requirements'),
      go('Pending my decision', data.clientReview, '/candidates?stage=CLIENT_REVIEW'),
      go('Interviews', data.interviewsUpcoming, '/ats/calendar'),
    ];
  }

  const stats = [
    [data.openRequirements, 'Open requirements', '/requirements'],
    [data.recruiterReview, 'Recruiter review', '/candidates?stage=RECRUITER_REVIEW'],
    [data.withBde, 'With BDE', '/candidates?stage=WITH_BDE'],
    [data.clientReview, 'Client review', '/candidates?stage=CLIENT_REVIEW'],
    [data.interviewsUpcoming, 'Interviews upcoming', '/ats/calendar'],
    [data.hiringOutcomes, 'Hiring outcomes this cycle', '/candidates?stage=JOINED'],
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>ATS Dashboard</h1>
          <div className="page-sub">Recruitment pipeline overview</div>
        </div>
      </div>

      {workRows && (
        <div className="panel" style={{ margin: '12px 0' }}>
          <div className="panel-head"><h3>{workTitle}</h3></div>
          {workRows}
        </div>
      )}

      <div className="statbar">
        {stats.map(([n, label, to]) => (
          <div className="statitem" key={label} style={{ cursor: 'pointer' }} onClick={() => navigate(to)}>
            <div className="n">{n}</div>
            <div className="l">{label}</div>
          </div>
        ))}
      </div>

      <div className="two-col">
        <div className="card section">
          <h3 style={{ fontSize: 14, marginBottom: 10 }}>Pipeline by stage</h3>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Stage</th><th>Candidates</th></tr></thead>
              <tbody>
                {data.pipelineByStage.map((s) => (
                  <tr
                    key={s.stage}
                    className="row-link"
                    onClick={() => navigate(`/candidates?stage=${encodeURIComponent(s.stage)}`)}
                  >
                    <td>{s.label}</td>
                    <td>{s.count}</td>
                  </tr>
                ))}
                {data.pipelineByStage.length === 0 && (
                  <tr><td colSpan="2" className="small-muted" style={{ padding: 16 }}>No candidates in the pipeline yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <div className="card section">
            <h3 style={{ fontSize: 13, marginBottom: 10 }}>Recruiter workload</h3>
            {data.recruiterWorkload.map((r) => (
              <KV k={r.name} key={r.name}>{r.requirements} requirements</KV>
            ))}
            {data.recruiterWorkload.length === 0 && <div className="empty-mini">No recruiters on file.</div>}
          </div>
          {/* Not in the prototype's dashboard card set: this app keeps its own
              audit trail, and the prototype's Job Portal Integration card has no
              equivalent state here — integration lives under Administration. */}
          <div className="card">
            <h3 style={{ fontSize: 13, marginBottom: 10 }}>Recent activity</h3>
            {data.recentActivity.slice(0, 6).map((a, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <KV k={new Date(a.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} key={i}>
                {a.action}
              </KV>
            ))}
            {data.recentActivity.length === 0 && <div className="empty-mini">No activity yet.</div>}
            <div className="divider" />
            <span className="link-btn" onClick={() => navigate('/admin/integrations')}>
              Full integration details →
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
