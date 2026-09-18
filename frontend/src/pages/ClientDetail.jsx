import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api';

export default function ClientDetail() {
  const { id } = useParams();
  const [client, setClient] = useState(null);
  const [requirements, setRequirements] = useState([]);

  useEffect(() => {
    api.get(`/clients/${id}`).then((res) => setClient(res.data));
    api.get(`/requirements?clientId=${id}`).then((res) => setRequirements(res.data));
  }, [id]);

  if (!client) return <div className="small-muted">Loading…</div>;

  return (
    <div>
      <Link className="small-muted" to="/clients">← Back to clients</Link>
      <div className="page-head" style={{ marginTop: 10 }}>
        <h1>{client.name}</h1>
      </div>
      <div className="card">
        <div className="kv"><span className="k">Industry</span><span>{client.industry || '—'}</span></div>
        <div className="kv"><span className="k">Location</span><span>{client.location || '—'}</span></div>
      </div>
      <div className="card section">
        <h3>Requirements</h3>
        {requirements.map((r) => (
          <div className="kv" key={r.id}>
            <span className="k"><Link to={`/requirements/${r.id}`}>{r.title}</Link></span>
            <span className={`status priority-${r.priority.toLowerCase()}`}>{r.priority}</span>
          </div>
        ))}
        {requirements.length === 0 && <div className="small-muted">No requirements for this client yet.</div>}
      </div>
    </div>
  );
}
