import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api';

import { ALL_STAGE_CODES, stageLabel, requirementStatusLabel, REJECT_SIDES, REJECT_REASON_CATEGORIES, HOLD_REASON_CATEGORIES } from '../atsVocab';

const RAISE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TL', 'STL', 'ASSISTANT_MANAGER'];

function priorityClass(priority) {
  if (priority === 'Urgent' || priority === 'High') return 'priority-high';
  if (priority === 'Medium') return 'priority-medium';
  return 'priority-low';
}

export default function RequirementDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [requirement, setRequirement] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [matching, setMatching] = useState([]);
  const [linkCandidateId, setLinkCandidateId] = useState('');
  const [error, setError] = useState('');
  const [matchDetail, setMatchDetail] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectForm, setRejectForm] = useState({ side: '', reasonCategory: '', detail: '', comment: '' });
  const [holdTarget, setHoldTarget] = useState(null);
  const [holdForm, setHoldForm] = useState({ reasonCategory: '', reviewDate: '', comment: '' });

  function load() {
    api.get(`/requirements/${id}`).then((res) => setRequirement(res.data));
    api.get(`/requirements/${id}/matching-candidates`).then((res) => setMatching(res.data)).catch(() => setMatching([]));
  }
  useEffect(() => {
    load();
    api.get('/candidates').then((res) => setCandidates(res.data));
  }, [id]);

  async function setStage(applicationId, stage) {
    if (stage === 'REJECTED') { openReject(applicationId); return; }
    if (stage === 'HOLD') { openHold(applicationId); return; }
    setError('');
    try {
      await api.patch(`/applications/${applicationId}/stage`, { stage });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not change stage');
    }
  }

  function openReject(applicationId) {
    setRejectTarget(applicationId);
    setRejectForm({ side: '', reasonCategory: '', detail: '', comment: '' });
  }

  async function confirmReject() {
    setError('');
    try {
      await api.patch(`/applications/${rejectTarget}/reject`, rejectForm);
      setRejectTarget(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not reject this application');
    }
  }

  function openHold(applicationId) {
    setHoldTarget(applicationId);
    const reviewDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    setHoldForm({ reasonCategory: '', reviewDate, comment: '' });
  }

  async function confirmHold() {
    setError('');
    try {
      await api.patch(`/applications/${holdTarget}/hold`, holdForm);
      setHoldTarget(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not put this application on hold');
    }
  }

  async function resumeHold(applicationId) {
    setError('');
    try {
      await api.patch(`/applications/${applicationId}/resume-hold`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not resume this application');
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

  const canManage = RAISE_ROLES.includes(user?.role);

  return (
    <div>
      <Link className="small-muted" to="/requirements">← Back to requirements</Link>
      <div className="page-head" style={{ marginTop: 10 }}>
        <div>
          <h1>{requirement.title}</h1>
          <div className="page-sub">
            {[requirement.internal ? 'TeamLink Internal' : requirement.client?.name, requirement.department]
              .filter(Boolean).join(' · ')}
          </div>
        </div>
        <span className={`status ${priorityClass(requirement.priority)}`}>{requirement.priority}</span>
      </div>

      {/* Openings / Filled / Remaining and the count of candidates at or above
          the match threshold — the prototype's "Matching Candidates" panel. */}
      <div className="card section">
        <h3>Matching Candidates</h3>
        <div className="small-muted">
          Candidates in the master at or above {requirement.matchThreshold ?? 70}% match ·
          {' '}Openings {requirement.openings} · Filled {requirement.filled ?? 0} · Remaining {requirement.remaining ?? requirement.openings}
        </div>
        <div className="statbar" style={{ marginTop: 10 }}>
          <div className="statitem">
            <div className="n">{requirement.matchingCandidates ?? 0}</div>
            <div className="l">At or above threshold</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="kv"><span className="k">Client</span><span>{requirement.internal ? 'TeamLink Internal' : requirement.client?.name}</span></div>
        <div className="kv"><span className="k">Location</span><span>{[requirement.location, requirement.workMode].filter(Boolean).join(' · ') || '—'}</span></div>
        <div className="kv"><span className="k">Department</span><span>{requirement.department || '—'}</span></div>
        <div className="kv"><span className="k">Skills</span><span>{requirement.skills || '—'}</span></div>
        <div className="kv"><span className="k">Good-to-have Skills</span><span>{requirement.goodToHaveSkills || '—'}</span></div>
        <div className="kv"><span className="k">Experience</span><span>{requirement.experience || '—'}</span></div>
        <div className="kv"><span className="k">Salary</span><span>{requirement.salary || '—'}</span></div>
        <div className="kv"><span className="k">Openings</span><span>{requirement.openings}</span></div>
        <div className="kv"><span className="k">Priority</span><span>{requirement.priority}</span></div>
        <div className="kv"><span className="k">Recruiter / BDE</span><span>{`${requirement.recruiter?.name || '—'} / ${requirement.bde?.name || '—'}`}</span></div>
        <div className="kv"><span className="k">Closing</span><span>{requirement.closingDate || '—'}</span></div>
        <div className="kv"><span className="k">Type</span><span>{requirement.internal ? 'Internal' : 'Client'}</span></div>
        <div className="kv"><span className="k">Status</span><span className="status">{requirementStatusLabel(requirement.status)}</span></div>
        {canManage && (
          <div className="qa-row" style={{ marginTop: 10 }}>
            <button className="btn btn-sm" onClick={() => runAction('generate-jd')}>Generate job description</button>
            {requirement.status === 'DRAFT' ? (
              <button className="btn btn-sm btn-primary" onClick={() => runAction('activate')}>Activate requirement</button>
            ) : (
              <button className="btn btn-sm" onClick={() => runAction('toggle-status')}>
                {requirement.status === 'OPEN' ? 'Close requirement' : 'Reopen requirement'}
              </button>
            )}
          </div>
        )}
      </div>

      {error && <div className="error-text">{error}</div>}

      {requirement.description && (
        <div className="card section">
          <h3>Job description</h3>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, margin: 0 }}>{requirement.description}</pre>
        </div>
      )}

      <div className="card section">
        <h3>Link a candidate</h3>
        <form onSubmit={linkCandidate} className="filter-row">
          <select value={linkCandidateId} onChange={(e) => setLinkCandidateId(e.target.value)}>
            <option value="">Select candidate</option>
            {candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="btn btn-sm btn-primary" type="submit">Add to pipeline</button>
        </form>
      </div>

      {matching.length > 0 && (
        <div className="card section">
          <h3>Suggested candidates <span className="small-muted">({matching.length} match this requirement)</span></h3>
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
                    <td>{c.match.matchedSkills.slice(0, 3).join(', ') || '—'}</td>
                    <td>
                      {c.match.missingSkills.length
                        ? c.match.missingSkills.slice(0, 3).join(', ')
                        : <span className="status priority-low">None</span>}
                    </td>
                    <td><button className="link-btn" onClick={() => setMatchDetail(c)}><span className="status">{c.match.overall}%</span></button></td>
                    <td><button className="btn btn-sm" onClick={(e) => linkCandidate(e, c.id)}>Add to Pipeline</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card section">
        <h3>Candidates in pipeline ({requirement.applications?.length ?? 0})</h3>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Candidate</th><th>Stage</th><th>Score</th><th>Move to…</th></tr></thead>
            <tbody>
              {requirement.applications?.map((a) => (
                <tr key={a.id}>
                  <td><Link to={`/candidates/${a.candidate.id}`}>{a.candidate.name}</Link></td>
                  <td><span className="status">{stageLabel(a.stage)}</span></td>
                  <td>{a.matchScore != null ? `${a.matchScore}%` : a.resumeScore != null ? `${a.resumeScore}%` : '—'}</td>
                  <td>
                    {a.stage === 'HOLD' ? (
                      <button className="btn btn-sm" onClick={() => resumeHold(a.id)}>Resume to Previous Stage</button>
                    ) : a.stage === 'REJECTED' ? (
                      <span className="small-muted">Reason: {a.rejectedDetail || '—'}</span>
                    ) : (
                      <select value={a.stage} onChange={(e) => setStage(a.id, e.target.value)}>
                        {ALL_STAGE_CODES.map((s) => <option key={s} value={s}>{stageLabel(s)}</option>)}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
              {(!requirement.applications || requirement.applications.length === 0) && (
                <tr><td colSpan="4" className="small-muted">No candidates in the pipeline yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {rejectTarget && (
        <div className="card section" style={{ borderColor: 'var(--warn)' }}>
          <h3>Reject application</h3>
          <div className="notice" style={{ marginBottom: 10 }}>Rejecting closes this application only. The candidate stays Active in the Candidate Master and remains searchable for other requirements.</div>
          <div className="grid-2">
            <label className="field">
              <span>Rejected Side*</span>
              <select value={rejectForm.side} onChange={(e) => setRejectForm({ ...rejectForm, side: e.target.value })}>
                <option value="">Select</option>
                {REJECT_SIDES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Reason Category*</span>
              <select value={rejectForm.reasonCategory} onChange={(e) => setRejectForm({ ...rejectForm, reasonCategory: e.target.value })}>
                <option value="">Select</option>
                {REJECT_REASON_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <label className="field"><span>Detailed Reason*</span>
            <textarea rows="2" value={rejectForm.detail} onChange={(e) => setRejectForm({ ...rejectForm, detail: e.target.value })} placeholder="Required — kept on the candidate's rejection history" />
          </label>
          <label className="field"><span>Comments</span>
            <textarea rows="2" value={rejectForm.comment} onChange={(e) => setRejectForm({ ...rejectForm, comment: e.target.value })} />
          </label>
          <button className="btn btn-sm" onClick={() => setRejectTarget(null)}>Cancel</button>{' '}
          <button className="btn btn-sm btn-primary" onClick={confirmReject}>Confirm Rejection</button>
        </div>
      )}

      {holdTarget && (
        <div className="card section" style={{ borderColor: 'var(--warn)' }}>
          <h3>Put on hold</h3>
          <div className="notice" style={{ marginBottom: 10 }}>A hold is reversible — "Resume to Previous Stage" puts the candidate back exactly where they were.</div>
          <div className="grid-2">
            <label className="field">
              <span>Hold Reason*</span>
              <select value={holdForm.reasonCategory} onChange={(e) => setHoldForm({ ...holdForm, reasonCategory: e.target.value })}>
                <option value="">Select</option>
                {HOLD_REASON_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="field"><span>Review Date</span>
              <input type="date" value={holdForm.reviewDate} onChange={(e) => setHoldForm({ ...holdForm, reviewDate: e.target.value })} />
            </label>
          </div>
          <label className="field"><span>Comment</span>
            <textarea rows="2" value={holdForm.comment} onChange={(e) => setHoldForm({ ...holdForm, comment: e.target.value })} />
          </label>
          <button className="btn btn-sm" onClick={() => setHoldTarget(null)}>Cancel</button>{' '}
          <button className="btn btn-sm btn-primary" onClick={confirmHold}>Put on Hold</button>
        </div>
      )}

      {matchDetail && (
        <div className="card section" style={{ borderColor: 'var(--warn)' }}>
          <div className="page-head" style={{ marginBottom: 8 }}>
            <h3>{matchDetail.name} × {requirement.title}</h3>
            <button className="btn btn-sm" onClick={() => setMatchDetail(null)}>Close</button>
          </div>
          <div className="small-muted" style={{ fontWeight: 700, marginBottom: 6 }}>What increased the score</div>
          {matchDetail.match.reasons?.length
            ? matchDetail.match.reasons.map((r, i) => <div key={i} style={{ color: 'var(--teal, #1e8449)' }}>✓ {r}</div>)
            : <div className="small-muted">No positive signals — the score comes from defaults only.</div>}
          <div className="small-muted" style={{ fontWeight: 700, margin: '12px 0 6px' }}>What reduced the score</div>
          {matchDetail.match.gaps?.length
            ? matchDetail.match.gaps.map((g, i) => <div key={i} style={{ color: 'var(--red, #c0392b)' }}>− {g}</div>)
            : <div className="small-muted">Nothing reduced the score on the data available.</div>}
          <div className="small-muted" style={{ marginTop: 12, fontStyle: 'italic' }}>Deterministic score — the same candidate and requirement always produce the same result. Mandatory skills carry the heaviest weight.</div>
        </div>
      )}
    </div>
  );
}
