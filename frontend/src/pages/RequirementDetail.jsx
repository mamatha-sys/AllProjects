import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api';

const STAGES = [
  'NEW', 'AI_INTERVIEW_REQUIRED', 'AI_INTERVIEW_SCHEDULED', 'AI_INTERVIEW_COMPLETED',
  'RECRUITER_REVIEW', 'RECRUITER_APPROVED', 'WITH_BDE', 'BDE_APPROVED',
  'SHARED_WITH_CLIENT', 'CLIENT_REVIEW', 'CLIENT_SHORTLISTED', 'INTERVIEW_SCHEDULED',
  'INTERVIEW_COMPLETED', 'SELECTED', 'OFFER', 'OFFER_ACCEPTED', 'JOINED', 'HIRED',
  'REJECTED', 'HOLD',
];

export default function RequirementDetail() {
  const { id } = useParams();
  const [requirement, setRequirement] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [matching, setMatching] = useState([]);
  const [linkCandidateId, setLinkCandidateId] = useState('');
  const [error, setError] = useState('');

  function load() {
    api.get(`/requirements/${id}`).then((res) => setRequirement(res.data));
    api.get(`/requirements/${id}/matching-candidates`).then((res) => setMatching(res.data));
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

  async function confirmJoining(applicationId) {
    setError('');
    try {
      await api.post(`/applications/${applicationId}/confirm-joining`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not confirm joining');
    }
  }

  async function linkCandidate(e, candidateId) {
    e?.preventDefault();
    const cid = candidateId || linkCandidateId;
    if (!cid) return;
    await api.post('/applications', { candidateId: cid, requirementId: id });
    setLinkCandidateId('');
    load();
  }

  async function generateJd() {
    await api.post(`/requirements/${id}/generate-jd`);
    load();
  }

  async function toggleStatus() {
    await api.post(`/requirements/${id}/toggle-status`);
    load();
  }

  if (!requirement) return <div className="small-muted">Loading…</div>;

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
        <div className="kv"><span className="k">Recruiter</span><span>{requirement.recruiter?.name || '—'}</span></div>
        <div className="kv"><span className="k">BDE</span><span>{requirement.bde?.name || '—'}</span></div>
        <div className="kv"><span className="k">Status</span><span>{requirement.status}</span></div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button className="btn btn-sm btn-ghost" onClick={generateJd}>Generate job description</button>
          <button className="btn btn-sm btn-ghost" onClick={toggleStatus}>{requirement.status === 'OPEN' ? 'Close requirement' : 'Reopen requirement'}</button>
        </div>
        {requirement.description && (
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, marginTop: 10, background: 'var(--bg-2, #f6f7f9)', padding: 10, borderRadius: 6 }}>{requirement.description}</pre>
        )}
      </div>

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
          <h3>Suggested matches</h3>
          {matching.slice(0, 5).map((c) => (
            <div className="kv" key={c.id}>
              <span className="k">{c.name} <span className="small-muted">({c.skills || c.source})</span></span>
              <button className="btn btn-sm btn-ghost" onClick={(e) => linkCandidate(e, c.id)}>Add to pipeline</button>
            </div>
          ))}
        </div>
      )}

      {error && <div className="error-text">{error}</div>}

      <div className="card section">
        <h3>Pipeline</h3>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Candidate</th><th>Stage</th><th>Move to…</th><th></th></tr></thead>
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
                  <td>
                    {a.stage === 'OFFER_ACCEPTED' && (
                      <button className="btn btn-sm btn-primary" onClick={() => confirmJoining(a.id)}>Confirm joining</button>
                    )}
                  </td>
                </tr>
              ))}
              {(!requirement.applications || requirement.applications.length === 0) && (
                <tr><td colSpan="4" className="small-muted">No candidates in this pipeline yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
