import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api';

export default function CandidateDetail() {
  const { id } = useParams();
  const [candidate, setCandidate] = useState(null);

  useEffect(() => {
    api.get(`/candidates/${id}`).then((res) => setCandidate(res.data));
  }, [id]);

  if (!candidate) return <div className="small-muted">Loading…</div>;

  return (
    <div>
      <Link className="small-muted" to="/candidates">← Back to candidates</Link>
      <div className="page-head" style={{ marginTop: 10 }}>
        <h1>{candidate.name}</h1>
      </div>
      <div className="card">
        <div className="kv"><span className="k">Email</span><span>{candidate.email || '—'}</span></div>
        <div className="kv"><span className="k">Phone</span><span>{candidate.phone || '—'}</span></div>
        <div className="kv"><span className="k">Source</span><span>{candidate.source}</span></div>
      </div>
      <div className="card section">
        <h3>Applications</h3>
        {candidate.applications?.map((a) => (
          <div className="kv" key={a.id}>
            <span className="k"><Link to={`/requirements/${a.requirement.id}`}>{a.requirement.title}</Link> — {a.requirement.client?.name}</span>
            <span className="status">{a.stage.replace(/_/g, ' ')}</span>
          </div>
        ))}
        {(!candidate.applications || candidate.applications.length === 0) && (
          <div className="small-muted">Not linked to any requirement yet.</div>
        )}
      </div>
    </div>
  );
}
