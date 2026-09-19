import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { Tabs, SkillPills, KV, fmtDate } from './ats/atsUi';

// Candidate portal — the prototype's candidatePortalView() (line 6656): a
// seven-tab "My TeamLink" screen. In this app there is no candidate login, so
// the portal is unlocked by the email the person applied with (JobDetail's
// no-login apply flow) rather than by a session.
//
// Every stage shown here is the CANDIDATE-FACING vocabulary — the API masks
// the internal pipeline stage before it leaves the server.
const TABS = (n) => [
  ['profile', 'Profile'],
  ['applications', `Applications (${n})`],
  ['matching', 'Matching Jobs'],
  ['interviews', 'Interviews'],
  ['scores', 'Scores'],
  ['sources', 'Connected Sources'],
  ['privacy', 'Privacy & Consent'],
];

function stageClass(stage) {
  if (stage === 'Applied') return 'applied';
  if (stage === 'Under Review') return 'review';
  if (stage === 'Client Review') return 'review';
  if (stage === 'Interview') return 'interview';
  if (stage === 'Selected') return 'selected';
  if (stage === 'Offer') return 'offer';
  if (stage === 'Joined') return 'joined';
  if (stage === 'Rejected') return 'rejected';
  if (stage === 'On Hold') return 'hold';
  return 'new';
}

export default function MyApplications() {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState(null);
  const [tab, setTab] = useState('profile');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function check(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.get('/public/my-applications', { params: { email } });
      setResult(res.data);
      setTab('profile');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not look that up right now');
    } finally {
      setBusy(false);
    }
  }

  const c = result?.profile;
  const apps = result?.applications || [];
  const jobs = result?.matchingJobs || [];
  const interviewRows = apps.flatMap((a) => {
    const out = [];
    if (a.aiInterviewStatus) {
      out.push({
        key: `${a.id}-ai`, role: a.jobTitle, type: 'AI Interview',
        date: a.aiInterviewDeadline, status: a.aiInterviewStatus, cls: 'pending',
        score: a.aiInterviewScore != null ? `${a.aiInterviewScore}%` : '—',
      });
    }
    if (a.interviewStatus) {
      out.push({
        key: `${a.id}-iv`, role: a.jobTitle, type: a.interviewType || 'Interview',
        date: a.interviewAt, status: a.interviewStatus, cls: 'interview', score: '—',
      });
    }
    return out;
  });

  return (
    <div className="careers-shell">
      <header className="careers-header">
        <div className="logo-lockup">
          <div className="mark">TL</div>
          <div>
            <div style={{ fontWeight: 600 }}>TeamLink Consultants</div>
            <div className="small-muted">My TeamLink</div>
          </div>
        </div>
      </header>
      <main className="careers-content">
        <Link className="small-muted" to="/careers">← Back to open positions</Link>

        {!c && (
          <>
            <h1 style={{ marginTop: 10 }}>Check your application status</h1>
            <p className="small-muted">Enter the email address you applied with — no account needed.</p>
          </>
        )}
        <form className="filter-row" onSubmit={check} style={{ maxWidth: 460, marginTop: c ? 12 : 0 }}>
          <input
            style={{ flex: 1 }}
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <button className="btn btn-sm btn-primary" type="submit" disabled={busy}>
            {busy ? 'Checking…' : 'Check status'}
          </button>
        </form>

        {error && <div className="notice red">{error}</div>}
        {result && !c && (
          <div className="empty">
            <h3>No applications found</h3>
            <div>Nothing is on file for that email address yet.</div>
          </div>
        )}

        {c && (
          <>
            <div className="page-head" style={{ marginTop: 14 }}>
              <div>
                <h1>My TeamLink</h1>
                <div className="page-sub">{c.name} · {c.id}</div>
              </div>
            </div>
            <Tabs tabs={TABS(apps.length)} value={tab} onChange={setTab} style={{ marginBottom: 14 }} />

            {tab === 'profile' && (
              <>
                <div className="card section">
                  <h3 style={{ fontSize: 14, marginBottom: 10 }}>My Profile</h3>
                  <KV k="Name">{c.name}</KV>
                  <KV k="Email">{c.email || '—'}</KV>
                  <KV k="Mobile">{c.phone || '—'}</KV>
                  <KV k="Current Location">{c.location || '—'}</KV>
                  <KV k="Preferred Location">{c.preferredLocation || '—'}</KV>
                  <KV k="Total Experience">{c.experienceYears != null ? `${c.experienceYears} yrs` : '—'}</KV>
                  <KV k="Relevant Experience">{c.relevantExperienceYears != null ? `${c.relevantExperienceYears} yrs` : '—'}</KV>
                  <KV k="Current Company">{c.currentCompany || '—'}</KV>
                  <KV k="Current Designation">{c.currentDesignation || '—'}</KV>
                  <KV k="Notice Period">{c.noticePeriod || '—'}</KV>
                  <KV k="Availability">{c.availability || '—'}</KV>
                  <KV k="Expected Salary">{c.expectedSalary || '—'}</KV>
                  <KV k="Education">{c.education || '—'}</KV>
                  <KV k="Specialization">{c.specialization || '—'}</KV>
                </div>
                <div className="card section">
                  <h3 style={{ fontSize: 14, marginBottom: 8 }}>Resume</h3>
                  <KV k="File">{c.resumeName || 'No resume uploaded'}</KV>
                  <KV k="Resume Score">{c.resumeScore != null ? `${c.resumeScore}%` : '—'}</KV>
                </div>
                <div className="card section">
                  <h3 style={{ fontSize: 14, marginBottom: 8 }}>Skills</h3>
                  <div><SkillPills value={c.skills} variant="match" /></div>
                  {c.softSkills && (
                    <div style={{ marginTop: 8 }}>
                      <SkillPills value={c.softSkills} />
                      {' '}<span className="cell-muted" style={{ fontSize: 11.5 }}>soft skills</span>
                    </div>
                  )}
                </div>
              </>
            )}

            {tab === 'applications' && (
              <div className="tbl-wrap">
                <table>
                  <thead><tr><th>Role</th><th>Company</th><th>Status</th><th>Applied</th><th>Last update</th></tr></thead>
                  <tbody>
                    {apps.map((a) => (
                      <tr key={a.id}>
                        <td><b>{a.jobTitle}</b></td>
                        <td className="cell-muted">{a.client}{a.location ? ` · ${a.location}` : ''}</td>
                        <td><span className={`status ${stageClass(a.stage)}`}>{a.stage}</span></td>
                        <td className="cell-muted">{fmtDate(a.appliedAt)}</td>
                        <td className="cell-muted">{fmtDate(a.updatedAt)}</td>
                      </tr>
                    ))}
                    {apps.length === 0 && (
                      <tr><td colSpan="5" className="small-muted" style={{ padding: 16 }}>No applications found for that email.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {tab === 'matching' && (
              <>
                <div className="cell-muted" style={{ fontSize: 12, marginBottom: 8 }}>
                  Open roles that match your profile. Client commercial terms are not shown.
                </div>
                <div className="tbl-wrap">
                  <table>
                    <thead><tr><th>Role</th><th>Location</th><th>Experience</th><th>Match</th><th /></tr></thead>
                    <tbody>
                      {jobs.map((j) => (
                        <tr key={j.id}>
                          <td><b>{j.title}</b></td>
                          <td className="cell-muted">{j.location || '—'}</td>
                          <td className="cell-muted">{j.experience || '—'}</td>
                          <td><b>{j.match}%</b></td>
                          <td><Link className="btn btn-sm" to={`/careers/${j.id}`}>View Job</Link></td>
                        </tr>
                      ))}
                      {jobs.length === 0 && (
                        <tr><td colSpan="5" className="small-muted" style={{ padding: 16 }}>No matching open roles right now.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {tab === 'interviews' && (
              <>
                <div className="tbl-wrap">
                  <table>
                    <thead><tr><th>Role</th><th>Type</th><th>Date</th><th>Status</th><th>Score</th></tr></thead>
                    <tbody>
                      {interviewRows.map((r) => (
                        <tr key={r.key}>
                          <td>{r.role}</td>
                          <td className="cell-muted">{r.type}</td>
                          <td className="cell-muted">{fmtDate(r.date)}</td>
                          <td><span className={`status ${r.cls}`}>{r.status}</span></td>
                          <td className="cell-muted">{r.score}</td>
                        </tr>
                      ))}
                      {interviewRows.length === 0 && (
                        <tr><td colSpan="5" className="small-muted" style={{ padding: 16 }}>No interviews yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="notice" style={{ marginTop: 12 }}>
                  Interviewer feedback is shared with you by your TeamLink recruiter — it is not published here.
                </div>
              </>
            )}

            {tab === 'scores' && (
              <>
                <div className="card section">
                  <KV k="Resume Score">{c.resumeScore != null ? `${c.resumeScore}%` : '— (upload a resume)'}</KV>
                  {apps.map((a) => (
                    <KV k={`AI Interview — ${a.jobTitle}`} key={a.id}>
                      {a.aiInterviewScore != null ? `${a.aiInterviewScore}% (Simulated)` : a.aiInterviewStatus || '—'}
                    </KV>
                  ))}
                </div>
                <div className="notice">
                  Match scores against individual client requirements are used internally by TeamLink and are
                  not shown here.
                </div>
              </>
            )}

            {tab === 'sources' && (
              <div className="card section">
                <KV k="First Source">{c.firstSource || c.source || '—'}</KV>
                <KV k="Latest Source">{c.source || '—'}</KV>
                {apps.map((a) => (
                  <KV k={a.id} key={a.id}>{`${a.source || '—'} · ${a.applicationMethod || 'Manual'}`}</KV>
                ))}
              </div>
            )}

            {tab === 'privacy' && (
              <div className="card section">
                <h3 style={{ fontSize: 14, marginBottom: 10 }}>Privacy &amp; Consent</h3>
                {[
                  'Share my profile with TeamLink clients',
                  'Contact me by email',
                  'Contact me on WhatsApp',
                  'Keep my profile on file for future roles',
                ].map((label) => (
                  <div className="kv" key={label}>
                    <span className="k">{label}</span>
                    <span><span className="status active">On</span></span>
                  </div>
                ))}
                {/* The prototype stores these against the candidate record via
                    candToggleConsent(). This app has no consent column yet, so
                    the choices are shown as they stand rather than faked as
                    editable. */}
                <div className="cell-muted" style={{ fontSize: 11.5, marginTop: 8 }}>
                  Your choices are visible to your TeamLink recruiter. To change any of them, reply to your
                  recruiter — self-service editing is not switched on yet.
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
