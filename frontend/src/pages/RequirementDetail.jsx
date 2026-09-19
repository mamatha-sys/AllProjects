import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api';

import { ALL_STAGE_CODES, stageLabel, requirementStatusLabel, agreementStatusLabel } from '../atsVocab';
import { StatusBadge, SkillPills, KV, fmtDate } from './ats/atsUi';

const RAISE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TL', 'STL', 'ASSISTANT_MANAGER'];

// The prototype's requirementDetail() (line 7170): breadcrumb, a Draft notice,
// the Job Posting strip, the Matching Candidates strip, then a two-column body
// with the detail card / suggestion table / pipeline on the left and the
// "Requirement info" card on the right.
export default function RequirementDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [requirement, setRequirement] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [matching, setMatching] = useState([]);
  const [linkCandidateId, setLinkCandidateId] = useState('');
  const [error, setError] = useState('');

  function load() {
    api.get(`/requirements/${id}`).then((res) => setRequirement(res.data));
    api.get(`/requirements/${id}/matching-candidates`).then((res) => setMatching(res.data)).catch(() => setMatching([]));
  }
  useEffect(() => {
    load();
    api.get('/candidates').then((res) => setCandidates(res.data));
  }, [id]);

  async function setStage(applicationId, stage) {
    setError('');
    try {
      await api.patch(`/applications/${applicationId}/stage`, { stage });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not change stage');
    }
  }

  async function linkCandidate(e, candidateId) {
    e?.preventDefault();
    const cid = candidateId || linkCandidateId;
    if (!cid) return;
    setError('');
    try {
      await api.post('/applications', { candidateId: cid, requirementId: id });
      setLinkCandidateId('');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not add this candidate to the pipeline');
    }
  }

  async function runAction(path) {
    setError('');
    try {
      await api.post(`/requirements/${id}/${path}`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not complete that action');
    }
  }

  if (!requirement) return <div className="small-muted">Loading…</div>;

  const r = requirement;
  const canManage = RAISE_ROLES.includes(user?.role);
  const clientName = r.internal ? 'TeamLink Internal' : r.client?.name || '—';
  const agreementActive = r.internal || r.client?.agreementStatus === 'ACTIVE';
  const postingSources = String(r.postingSources || '').split(',').map((s) => s.trim()).filter(Boolean);
  const applications = r.applications || [];

  return (
    <div>
      <div className="breadcrumb">
        <span className="bc-link" onClick={() => navigate('/requirements')}>ATS</span>
        <span className="bc-sep">/</span>
        <span className="bc-link" onClick={() => navigate('/requirements')}>Jobs / Requirements</span>
        <span className="bc-sep">/</span>
        <span className="bc-current">{r.id}</span>
      </div>
      <Link className="small-muted" to="/requirements">← Back to requirements</Link>
      <div className="page-head" style={{ marginTop: 10 }}>
        <div>
          <h1 style={{ fontSize: 20 }}>{r.title}</h1>
          <div className="page-sub">{[r.id, clientName, r.department].filter(Boolean).join(' · ')}</div>
        </div>
        <span className="status active">{requirementStatusLabel(r.status)}</span>
      </div>

      {r.status === 'DRAFT' && !r.internal && (
        <div className="notice amber">
          This requirement is saved as Draft.
          {' '}
          {agreementActive
            ? 'The client agreement is signed — you can activate it now.'
            : 'It cannot go live until the client agreement is signed.'}
          <div style={{ marginTop: 10 }}>
            {agreementActive && canManage
              ? <button className="btn btn-sm btn-primary" onClick={() => runAction('activate')}>Activate Requirement</button>
              : (
                <span className="link-btn" onClick={() => navigate(`/clients/${r.clientId}`)}>
                  Go to Agreement →
                </span>
              )}
          </div>
        </div>
      )}

      {/* Job Posting strip. */}
      <div className="card section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <b style={{ fontSize: 13 }}>Job Posting</b>
          <div className="small-muted" style={{ fontSize: 12, marginTop: 2 }}>
            Status:{' '}
            <span className={`status ${r.status === 'OPEN' ? 'active' : 'pending'}`}>
              {r.status === 'OPEN' ? 'Posted' : 'Draft'}
            </span>
            {postingSources.length ? ` · ${postingSources.join(' · ')}` : ' · no sources selected yet'}
            {!agreementActive && (
              <span style={{ color: 'var(--red)' }}> · agreement not signed — posting blocked</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Link className="btn btn-sm" to={`/careers/${r.id}`}>View Job Description</Link>
          <Link className="btn btn-sm" to={`/careers/${r.id}`}>Preview Job Posting</Link>
          {canManage && (
            <>
              <button className="btn btn-sm" onClick={() => runAction('generate-jd')}>Generate Job Description</button>
              {r.status !== 'DRAFT' && (
                <button className="btn btn-sm btn-primary" onClick={() => runAction('toggle-status')}>
                  {r.status === 'OPEN' ? 'Close Requirement' : 'Reopen Requirement'}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Matching Candidates strip. */}
      <div className="card section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <b style={{ fontSize: 13 }}>Matching Candidates</b>
          <div className="small-muted" style={{ fontSize: 12, marginTop: 2 }}>
            Candidates in the master at or above {r.matchThreshold ?? 70}% match ·
            {' '}Openings {r.openings} · Filled {r.filled ?? 0} · Remaining {r.remaining ?? r.openings}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 22, fontWeight: 600 }}>{r.matchingCandidates ?? 0}</span>
        </div>
      </div>

      {error && <div className="notice red">{error}</div>}

      <div className="two-col">
        <div>
          <div className="card section">
            <div className="grid-2">
              <KV k="Location">{[r.location, r.workMode].filter(Boolean).join(' · ') || '—'}</KV>
              <KV k="Experience">{r.experience || '—'}</KV>
              <KV k="Salary">{r.salary || '—'}</KV>
              <KV k="Openings">{r.openings}</KV>
              <KV k="Priority">{r.priority}</KV>
              <KV k="Recruiter / BDE">{`${r.recruiter?.name || '—'} / ${r.bde?.name || '—'}`}</KV>
              <KV k="Employment Type">{r.employmentType || '—'}</KV>
              <KV k="Joining Timeline">{r.joiningTimeline || '—'}</KV>
              <KV k="Max Notice Period">{r.noticePeriodMax || '—'}</KV>
              <KV k="Education">{r.education || '—'}</KV>
            </div>
            <div style={{ margin: '10px 0' }}>
              <SkillPills value={r.skills} />
              {r.goodToHaveSkills && <SkillPills value={r.goodToHaveSkills} />}
            </div>
            <div className="small-muted" style={{ whiteSpace: 'pre-line' }}>
              {r.description || r.jobDescription || 'No job description on file yet.'}
            </div>
          </div>

          <div className="card section">
            <h3 style={{ fontSize: 14, marginBottom: 4 }}>
              Matching Candidates for {r.internal ? 'this internal role' : `${r.title} — ${clientName}`}
            </h3>
            <div className="small-muted" style={{ marginBottom: 10 }}>
              Deterministically matched on the same 14 signals used candidate-side. Recruiter review is
              required before any candidate is shared further.
            </div>
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Candidate</th><th>Location</th><th>Experience</th>
                    <th>Matching Skills</th><th>Missing Mandatory</th><th>Score</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {matching.slice(0, 8).map((c) => (
                    <tr key={c.id}>
                      <td><Link to={`/candidates/${c.id}`}>{c.name}</Link></td>
                      <td>{c.location || '—'}</td>
                      <td>{c.experienceYears != null ? `${c.experienceYears} yrs` : '—'}</td>
                      <td><SkillPills value={c.match.matchedSkills.slice(0, 3)} variant="match" /></td>
                      <td>
                        {c.match.missingSkills.length
                          ? <SkillPills value={c.match.missingSkills.slice(0, 3)} />
                          : <span className="status active">None</span>}
                      </td>
                      <td><Link className="link-btn" to={`/candidates/${c.id}?tab=matching`}>{c.match.overall}% — Details</Link></td>
                      <td><button className="btn btn-sm btn-primary" onClick={(e) => linkCandidate(e, c.id)}>Add to Pipeline</button></td>
                    </tr>
                  ))}
                  {matching.length === 0 && (
                    <tr>
                      <td colSpan="7" className="small-muted" style={{ padding: 16 }}>
                        No unmatched candidates above 50% right now.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: 14, marginBottom: 10 }}>Candidates in pipeline ({applications.length})</h3>
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>Candidate</th><th>Stage</th><th>Score</th><th>Move to…</th></tr></thead>
                <tbody>
                  {applications.map((a) => (
                    <tr key={a.id}>
                      <td><Link to={`/candidates/${a.candidate.id}`}>{a.candidate.name}</Link></td>
                      <td><StatusBadge stage={a.stage} /></td>
                      <td>{a.matchScore != null ? `${a.matchScore}%` : a.resumeScore != null ? `${a.resumeScore}%` : '—'}</td>
                      <td>
                        <select value={a.stage} onChange={(e) => setStage(a.id, e.target.value)}>
                          {ALL_STAGE_CODES.map((s) => <option key={s} value={s}>{stageLabel(s)}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                  {applications.length === 0 && (
                    <tr>
                      <td colSpan="4" className="small-muted" style={{ padding: 16 }}>
                        No candidates in the pipeline yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Not in the prototype, kept from this app: add anyone from the
                master to the pipeline, not only the suggestions above. */}
            <form onSubmit={linkCandidate} className="filter-row" style={{ marginTop: 12, marginBottom: 0 }}>
              <select value={linkCandidateId} onChange={(e) => setLinkCandidateId(e.target.value)}>
                <option value="">Select candidate</option>
                {candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button className="btn btn-sm btn-primary" type="submit">Add to pipeline</button>
            </form>
          </div>
        </div>

        <div>
          <div className="card">
            <h3 style={{ fontSize: 13, marginBottom: 10 }}>Requirement info</h3>
            <KV k="Created">{fmtDate(r.createdAt)}</KV>
            <KV k="Closing">{fmtDate(r.closingDate)}</KV>
            <KV k="Type">{r.internal ? 'Internal' : 'Client'}</KV>
            {!r.internal && (
              <KV k="Agreement">
                <span className={`status ${r.client?.agreementStatus === 'ACTIVE' ? 'active' : 'pending'}`}>
                  {agreementStatusLabel(r.client?.agreementStatus)}
                </span>
              </KV>
            )}
            <div className="divider" />
            {canManage && (
              <button
                className="btn btn-sm"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => runAction(r.status === 'DRAFT' ? 'activate' : 'toggle-status')}
              >
                {r.status === 'DRAFT' ? 'Activate Requirement' : r.status === 'OPEN' ? 'Close Requirement' : 'Reopen Requirement'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
