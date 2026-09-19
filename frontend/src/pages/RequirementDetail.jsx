import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api';

// Keep in step with STAGE_OWNERS in backend/src/routes/applications.js.
const STAGES = [
  'NEW', 'AI_INTERVIEW_REQUIRED', 'AI_INTERVIEW_SCHEDULED', 'AI_INTERVIEW_COMPLETED',
  'RECRUITER_REVIEW', 'RECRUITER_APPROVED', 'WITH_BDE', 'BDE_APPROVED',
  'SHARED_WITH_CLIENT', 'CLIENT_REVIEW', 'CLIENT_SHORTLISTED', 'INTERVIEW_SCHEDULED',
  'INTERVIEW_COMPLETED', 'SELECTED', 'OFFER', 'OFFER_ACCEPTED', 'JOINED', 'HIRED',
  'REJECTED', 'HOLD',
];

const RAISE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TL', 'STL', 'ASSISTANT_MANAGER'];

export default function RequirementDetail() {
  const { id } = useParams();
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

  const canManage = RAISE_ROLES.includes(user?.role);

  return (
    <div>
      <Link className="small-muted" to="/requirements">← Back to requirements</Link>
      <div className="page-head" style={{ marginTop: 10 }}>
        <h1>{requirement.title}</h1>
        <span className={`status priority-${requirement.priority.toLowerCase()}`}>{requirement.priority}</span>
      </div>
      <div className="card">
        <div className="kv"><span className="k">Client</span><span>{requirement.client?.name}</span></div>
        <div className="kv"><span className="k">Department</span><span>{requirement.department || '—'}</span></div>
        <div className="kv"><span className="k">Skills</span><span>{requirement.skills || '—'}</span></div>
        <div className="kv"><span className="k">Experience</span><span>{requirement.experience || '—'}</span></div>
        <div className="kv"><span className="k">Openings</span><span>{requirement.openings}</span></div>
        <div className="kv"><span className="k">Recruiter</span><span>{requirement.recruiter?.name || '—'}</span></div>
        <div className="kv"><span className="k">BDE</span><span>{requirement.bde?.name || '—'}</span></div>
        <div className="kv"><span className="k">Status</span><span className="status">{requirement.status}</span></div>
        {canManage && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
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
              <thead><tr><th>Candidate</th><th>Match</th><th>Why</th><th></th></tr></thead>
              <tbody>
                {matching.slice(0, 8).map((c) => (
                  <tr key={c.id}>
                    <td><Link to={`/candidates/${c.id}`}>{c.name}</Link></td>
                    <td><span className="status">{c.match.overall}%</span></td>
                    <td className="small-muted">
                      {c.match.reasons.join('; ') || '—'}
                      {c.match.gaps.length > 0 && <div>Gaps: {c.match.gaps.join('; ')}</div>}
                    </td>
                    <td><button className="btn btn-sm" onClick={(e) => linkCandidate(e, c.id)}>Add to pipeline</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card section">
        <h3>Pipeline</h3>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Candidate</th><th>Stage</th><th>Move to…</th></tr></thead>
            <tbody>
              {requirement.applications?.map((a) => (
                <tr key={a.id}>
                  <td><Link to={`/candidates/${a.candidate.id}`}>{a.candidate.name}</Link></td>
                  <td><span className="status">{a.stage.replace(/_/g, ' ')}</span></td>
                  <td>
                    <select value={a.stage} onChange={(e) => setStage(a.id, e.target.value)}>
                      {STAGES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
              {(!requirement.applications || requirement.applications.length === 0) && (
                <tr><td colSpan="3" className="small-muted">No candidates in this pipeline yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
