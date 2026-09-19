import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api';
import { stageLabel } from '../atsVocab';

// The prototype's candidateDetail() (line 8447) is tabbed: Overview,
// Applications, Matching Requirements, Interviews, Activity Timeline, plus
// Rejection History / Hold History / Notes for internal roles.
const TABS = [
  ['overview', 'Overview'],
  ['applications', 'Applications'],
  ['matching', 'Matching Requirements'],
  ['interviews', 'Interviews'],
];

function lifeClass(status) {
  if (status === 'Active') return 'priority-low';
  if (status === 'Rejected') return 'priority-high';
  if (status === 'On Hold') return 'priority-medium';
  return '';
}

export default function CandidateDetail() {
  const { id } = useParams();
  const [candidate, setCandidate] = useState(null);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    api.get(`/candidates/${id}`).then((res) => setCandidate(res.data));
  }, [id]);

  if (!candidate) return <div className="small-muted">Loading…</div>;

  const applications = candidate.applications || [];
  const matching = candidate.matchingRequirements || [];
  const interviews = applications.filter((a) => a.interviewStatus);

  return (
    <div>
      <Link className="small-muted" to="/candidates">← Back to candidates</Link>
      <div className="page-head" style={{ marginTop: 10 }}>
        <div>
          <h1>{candidate.name}</h1>
          <div className="page-sub">
            {[
              candidate.id,
              candidate.location,
              candidate.experienceYears != null ? `${candidate.experienceYears} yrs exp` : null,
              candidate.source ? `source: ${candidate.source}` : null,
            ].filter(Boolean).join(' · ')}
          </div>
        </div>
      </div>

      <div className="tabbar">
        {TABS.map(([key, label]) => (
          <button
            type="button"
            key={key}
            className={`tab-btn ${tab === key ? 'active' : ''}`}
            onClick={() => setTab(key)}
          >
            {key === 'applications' ? `Applications (${applications.length})` : label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="card section">
          <h3>Profile</h3>
          <div className="kv"><span className="k">Email</span><span>{candidate.email || '—'}</span></div>
          <div className="kv"><span className="k">Mobile</span><span>{candidate.phone || '—'}</span></div>
          <div className="kv"><span className="k">Current Location</span><span>{candidate.location || '—'}</span></div>
          <div className="kv"><span className="k">Preferred Location</span><span>{candidate.preferredLocation || '—'}</span></div>
          <div className="kv"><span className="k">Current Company</span><span>{candidate.currentCompany || '—'}</span></div>
          <div className="kv"><span className="k">Current Designation</span><span>{candidate.currentDesignation || '—'}</span></div>
          <div className="kv"><span className="k">Total / Relevant Experience</span><span>
            {candidate.experienceYears != null ? `${candidate.experienceYears} yrs` : '—'}
            {' / '}
            {candidate.relevantExperienceYears != null ? `${candidate.relevantExperienceYears} yrs` : '—'}
          </span></div>
          <div className="kv"><span className="k">Current / Expected Salary</span><span>{`${candidate.currentSalary || '—'} / ${candidate.expectedSalary || '—'}`}</span></div>
          <div className="kv"><span className="k">Notice Period</span><span>{candidate.noticePeriod || '—'}</span></div>
          <div className="kv"><span className="k">Availability</span><span>{candidate.availability || '—'}</span></div>
          <div className="kv"><span className="k">Job Preference</span><span>{candidate.jobPreference || '—'}</span></div>
          <div className="kv"><span className="k">Preferred Work Mode</span><span>{candidate.preferredWorkMode || '—'}</span></div>
          <div className="kv"><span className="k">Education</span><span>
            {[candidate.education, candidate.specialization, candidate.institute, candidate.passingYear].filter(Boolean).join(' · ') || '—'}
          </span></div>
          <div className="kv"><span className="k">Mandatory Skills</span><span>{candidate.skills || '—'}</span></div>
          <div className="kv"><span className="k">Good-to-have Skills</span><span>{candidate.goodToHaveSkills || '—'}</span></div>
          <div className="kv"><span className="k">Technical Skills</span><span>{candidate.technicalSkills || '—'}</span></div>
          <div className="kv"><span className="k">Soft Skills</span><span>{candidate.softSkills || '—'}</span></div>
          <div className="kv"><span className="k">Source / First Source</span><span>{`${candidate.source || '—'} / ${candidate.firstSource || '—'}`}</span></div>
          <div className="kv"><span className="k">Resume</span><span>
            {candidate.resumeName || '—'}
            {candidate.resumeScore != null ? ` · Resume Score ${candidate.resumeScore}%` : ''}
          </span></div>
        </div>
      )}

      {tab === 'applications' && (
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
                  <td>{a.requirement.client?.name || '—'}</td>
                  <td><span className="status">{a.stageLabel || stageLabel(a.stage)}</span></td>
                  <td>{a.owner || '—'}</td>
                  <td>{a.nextAction || '—'}</td>
                  <td>
                    {a.dueDate || '—'}
                    {a.overdue && <span className="status priority-high"> Overdue</span>}
                  </td>
                  <td>{a.matchScore != null ? `${a.matchScore}%` : '—'}</td>
                  <td><span className={`status ${lifeClass(a.lifeStatus)}`}>{a.lifeStatus}</span></td>
                  <td>{a.resumeScore != null ? `${a.resumeScore}%` : '—'}</td>
                  <td>{a.aiInterviewScore != null ? `${a.aiInterviewScore}%` : a.aiInterviewStatus || '—'}</td>
                </tr>
              ))}
              {applications.length === 0 && <tr><td colSpan="11" className="small-muted">No applications yet.</td></tr>}
            </tbody>
          </table>
        </div>
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
                  <td><span className="status">{r.match.overall}%</span></td>
                </tr>
              ))}
              {matching.length === 0 && (
                <tr><td colSpan="4" className="small-muted">No new matching requirements above 50%.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'interviews' && (
        <div className="card section">
          <h3>Interviews</h3>
          {interviews.map((a) => (
            <div className="kv" key={a.id}>
              <span className="k">{a.requirement.title} — {a.requirement.client?.name || '—'}</span>
              <span>
                {a.interviewAt ? new Date(a.interviewAt).toLocaleString() : '—'}
                {' · '}
                <span className="status">{a.interviewStatus}</span>
              </span>
            </div>
          ))}
          {interviews.length === 0 && <div className="small-muted">No interviews yet.</div>}
        </div>
      )}
    </div>
  );
}
