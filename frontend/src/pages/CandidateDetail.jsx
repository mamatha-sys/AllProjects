import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../api';
import {
  Tabs, StatusBadge, LifeBadge, SkillPills, KV, fmtDate,
} from './ats/atsUi';

// The prototype's candidateDetail() (line 8447) is tabbed: Overview,
// Applications, Matching Requirements, Interviews, Activity Timeline, plus
// Rejection History / Hold History / Notes for internal roles.
export default function CandidateDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [candidate, setCandidate] = useState(null);
  const tab = params.get('tab') || 'overview';
  const setTab = (t) => setParams(t === 'overview' ? {} : { tab: t });

  useEffect(() => {
    api.get(`/candidates/${id}`).then((res) => setCandidate(res.data));
  }, [id]);

  if (!candidate) return <div className="small-muted">Loading…</div>;

  const applications = candidate.applications || [];
  const matching = candidate.matchingRequirements || [];
  const interviews = applications.filter((a) => a.interviewStatus);
  const rejected = applications.filter((a) => a.stage === 'REJECTED');
  const held = applications.filter((a) => a.stage === 'HOLD');

  const tabs = [
    ['overview', 'Overview'],
    ['applications', `Applications (${applications.length})`],
    ['matching', 'Matching Requirements'],
    ['interviews', 'Interviews'],
    ['timeline', 'Activity Timeline'],
    ['rejection', 'Rejection History'],
    ['hold', 'Hold History'],
    ['notes', 'Notes'],
  ];

  const subtitle = [
    candidate.id,
    candidate.location,
    candidate.experienceYears != null ? `${candidate.experienceYears} yrs exp` : null,
    candidate.source ? `source: ${candidate.source}` : null,
  ].filter(Boolean).join(' · ');

  // The prototype's Activity Timeline reads each application's stageHistory.
  // This app does not keep a per-stage history, so the timeline is built from
  // what it does record: when each application was raised and where it stands.
  const timeline = applications.flatMap((a) => {
    const ctx = a.requirement?.title || '—';
    const items = [{ date: a.createdAt, label: `New — ${ctx}` }];
    if (a.updatedAt && a.updatedAt !== a.createdAt) {
      items.push({ date: a.updatedAt, label: `${a.stageLabel} — ${ctx}` });
    }
    return items;
  }).sort((x, y) => String(y.date).localeCompare(String(x.date)));

  return (
    <div>
      <div className="breadcrumb">
        <span className="bc-link" onClick={() => navigate('/candidates')}>ATS</span>
        <span className="bc-sep">/</span>
        <span className="bc-link" onClick={() => navigate('/candidates')}>Candidates &amp; Pipeline</span>
        <span className="bc-sep">/</span>
        <span className="bc-current">{candidate.name}</span>
      </div>
      <Link className="small-muted" to="/candidates">← Back to candidates</Link>
      <div className="page-head" style={{ marginTop: 10 }}>
        <div>
          <h1 style={{ fontSize: 20 }}>{candidate.name}</h1>
          <div className="page-sub">{subtitle}</div>
        </div>
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'overview' && (
        <div className="two-col">
          <div>
            <div className="card section">
              <h3 style={{ fontSize: 13, marginBottom: 10 }}>Profile</h3>
              <div className="grid-2">
                <KV k="Email">{candidate.email || '—'}</KV>
                {/* The prototype's candidateDetail reads c.mobile while its own
                    saveNewCandidate stores c.contact, so a manually-added
                    candidate always shows "—" there. The intent — show the
                    number that was entered — is implemented here. */}
                <KV k="Mobile">{candidate.phone || '—'}</KV>
                <KV k="Preferred Location">{candidate.preferredLocation || '—'}</KV>
                <KV k="Education">{candidate.education || '—'}</KV>
                <KV k="Current Company">{candidate.currentCompany || '—'}</KV>
                <KV k="Current Designation">{candidate.currentDesignation || '—'}</KV>
                <KV k="Total / Relevant Experience">
                  {candidate.experienceYears != null ? `${candidate.experienceYears} yrs` : '—'}
                  {' / '}
                  {candidate.relevantExperienceYears != null ? `${candidate.relevantExperienceYears} yrs` : '—'}
                </KV>
                <KV k="Current / Expected Salary">{`${candidate.currentSalary || '—'} / ${candidate.expectedSalary || '—'}`}</KV>
                <KV k="Notice Period">{candidate.noticePeriod || '—'}</KV>
                <KV k="Availability">{candidate.availability || '—'}</KV>
                <KV k="Job Preference">{candidate.jobPreference || '—'}</KV>
                <KV k="Preferred Work Mode">{candidate.preferredWorkMode || '—'}</KV>
                <KV k="Specialization / Institute">
                  {[candidate.specialization, candidate.institute, candidate.passingYear].filter(Boolean).join(' · ') || '—'}
                </KV>
                <KV k="Resume">
                  {candidate.resumeName || '—'}
                  {candidate.resumeScore != null ? ` · Resume Score ${candidate.resumeScore}%` : ''}
                </KV>
              </div>
              <div style={{ marginTop: 10 }}>
                <SkillPills value={candidate.skills} empty="No skills on file" />
              </div>
              {candidate.goodToHaveSkills && (
                <div style={{ marginTop: 6 }}>
                  <SkillPills value={candidate.goodToHaveSkills} />
                  {' '}<span className="cell-muted" style={{ fontSize: 11.5 }}>good-to-have</span>
                </div>
              )}
              {candidate.softSkills && (
                <div style={{ marginTop: 6 }}>
                  <SkillPills value={candidate.softSkills} />
                  {' '}<span className="cell-muted" style={{ fontSize: 11.5 }}>soft skills</span>
                </div>
              )}
            </div>
          </div>
          <div>
            <div className="card">
              <h3 style={{ fontSize: 13, marginBottom: 10 }}>Sync status</h3>
              <KV k="Origin">{candidate.source || '—'}</KV>
              <KV k="First Source">{candidate.firstSource || '—'}</KV>
              <KV k="Status">
                <span className={`status ${candidate.profileStatus === 'Active' ? 'active' : 'new'}`}>
                  {candidate.profileStatus || 'Active'}
                </span>
              </KV>
              <KV k="Source Campaign">{candidate.sourceCampaign || '—'}</KV>
            </div>
          </div>
        </div>
      )}

      {tab === 'applications' && (
        <>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Application</th><th>Requirement</th><th>Client</th><th>Current Stage</th>
                  <th>Owner</th><th>Next Action</th><th>Due Date</th><th>Match Score</th>
                  <th>Status</th><th>Resume</th><th>AI Interview</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((a) => (
                  <tr key={a.id}>
                    <td>{a.id}</td>
                    <td><Link to={`/requirements/${a.requirement.id}`}>{a.requirement.title}</Link></td>
                    <td>{a.requirement.client?.name || 'TeamLink Internal'}</td>
                    <td><StatusBadge stage={a.stage} label={a.stageLabel} /></td>
                    <td className="cell-muted">{a.owner || '—'}</td>
                    <td className="cell-muted">{a.nextAction || '—'}</td>
                    <td className="cell-muted">
                      {fmtDate(a.dueDate)}
                      {a.overdue && <> <span className="status rejected">Overdue</span></>}
                    </td>
                    <td>{a.matchScore != null ? `${a.matchScore}%` : '—'}</td>
                    <td><LifeBadge status={a.lifeStatus} /></td>
                    <td>{a.resumeScore != null ? `${a.resumeScore}%` : '—'}</td>
                    <td>{a.aiInterviewScore != null ? `${a.aiInterviewScore}% (Simulated)` : a.aiInterviewStatus || '—'}</td>
                  </tr>
                ))}
                {applications.length === 0 && (
                  <tr><td colSpan="11" className="small-muted" style={{ padding: 16 }}>No applications yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {rejected.length > 0 && (
            <div className="notice" style={{ marginTop: 14 }}>
              This candidate has a rejection on record but remains active and searchable for other
              requirements — profiles are never deleted on rejection.
            </div>
          )}
        </>
      )}

      {tab === 'matching' && (
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Requirement</th><th>Client</th><th>Location</th><th>Match</th></tr></thead>
            <tbody>
              {matching.map((r) => (
                <tr key={r.id}>
                  <td><Link to={`/requirements/${r.id}`}>{r.title}</Link></td>
                  <td>{r.internal ? 'TeamLink Internal' : r.client?.name || '—'}</td>
                  <td>{r.location || '—'}</td>
                  <td><Link className="link-btn" to={`/requirements/${r.id}`}>{r.match.overall}% — Details</Link></td>
                </tr>
              ))}
              {matching.length === 0 && (
                <tr>
                  <td colSpan="4" className="small-muted" style={{ padding: 16 }}>
                    No new matching requirements above 50%.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'interviews' && (
        interviews.length === 0
          ? <div className="empty"><h3>No interviews yet</h3></div>
          : interviews.map((a) => (
            <div className="card section" key={a.id}>
              <h3 style={{ fontSize: 13, marginBottom: 8 }}>
                {a.requirement.title} — {a.requirement.client?.name || 'TeamLink Internal'}
              </h3>
              <KV k="Date / Time">{a.interviewAt ? new Date(a.interviewAt).toLocaleString('en-GB') : '—'}</KV>
              <KV k="Mode">{a.interviewMode || '—'}</KV>
              <KV k="Interviewer">{a.interviewer || '—'}</KV>
              <KV k="Status">{a.interviewStatus || '—'}</KV>
              {a.interviewScore != null && <KV k="Score">{a.interviewScore}%</KV>}
              {a.interviewFeedback && <KV k="Feedback">{a.interviewFeedback}</KV>}
            </div>
          ))
      )}

      {tab === 'timeline' && (
        <div className="card">
          <div className="timeline">
            {timeline.map((t, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <div className="timeline-item" key={i}>
                <div className="timeline-date">{fmtDate(t.date)}</div>
                <div className="timeline-label">{t.label}</div>
              </div>
            ))}
            {timeline.length === 0 && <div className="small-muted">No activity yet.</div>}
          </div>
        </div>
      )}

      {tab === 'rejection' && (
        rejected.length === 0 ? (
          <div className="empty">
            <h3>No rejections on record</h3>
            <div>This candidate has never been rejected on any requirement.</div>
          </div>
        ) : (
          <>
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Requirement</th><th>Client</th><th>Previous Stage</th><th>Rejected By</th>
                    <th>Side</th><th>Reason Category</th><th>Detailed Reason</th><th>Date / Time</th><th>Comments</th>
                  </tr>
                </thead>
                <tbody>
                  {rejected.map((a) => (
                    <tr key={a.id}>
                      <td>{a.requirement?.title || '—'}</td>
                      <td className="cell-muted">{a.requirement?.client?.name || '—'}</td>
                      <td className="cell-muted">—</td>
                      <td className="cell-muted">—</td>
                      <td className="cell-muted">—</td>
                      <td className="cell-muted">—</td>
                      <td>—</td>
                      <td className="cell-muted">{fmtDate(a.updatedAt)}</td>
                      <td className="cell-muted">—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="notice" style={{ marginTop: 14 }}>
              A rejection closes one application only — the Candidate Master is never deleted and stays
              searchable for other requirements.
            </div>
          </>
        )
      )}

      {tab === 'hold' && (
        held.length === 0 ? (
          <div className="empty">
            <h3>No holds on record</h3>
            <div>This candidate has never been put on hold.</div>
          </div>
        ) : (
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Requirement</th><th>Previous Stage</th><th>Hold Reason</th><th>Hold By</th>
                  <th>Hold Date</th><th>Review Date</th><th>Comment</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {held.map((a) => (
                  <tr key={a.id}>
                    <td>{a.requirement?.title || '—'}</td>
                    <td className="cell-muted">—</td>
                    <td>—</td>
                    <td className="cell-muted">—</td>
                    <td className="cell-muted">{fmtDate(a.updatedAt)}</td>
                    <td className="cell-muted">—</td>
                    <td className="cell-muted">—</td>
                    <td><span className="status pending">On Hold</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'notes' && (
        <div className="card">
          <div className="small-muted">No internal notes yet.</div>
        </div>
      )}
    </div>
  );
}
