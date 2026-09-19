import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api';

export default function ClientDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [client, setClient] = useState(null);
  const [requirements, setRequirements] = useState([]);
  const [signedByName, setSignedByName] = useState('');
  const [error, setError] = useState('');

  function load() {
    api.get(`/clients/${id}`).then((res) => setClient(res.data));
    api.get(`/requirements?clientId=${id}`).then((res) => setRequirements(res.data));
  }
  useEffect(load, [id]);

  async function generateAgreement() {
    setError('');
    try {
      await api.post(`/clients/${id}/agreement/generate`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not generate agreement');
    }
  }

  async function sendAgreement() {
    setError('');
    try {
      await api.post(`/clients/${id}/agreement/send`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send agreement');
    }
  }

  async function confirmAgreement(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post(`/clients/${id}/agreement/confirm`, { signedByName });
      setSignedByName('');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not e-sign agreement');
    }
  }

  if (!client) return <div className="small-muted">Loading…</div>;

  const canManage = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(user?.role);
  const canSign = user?.role === 'CLIENT' && user?.clientId === client.id && client.agreementStatus === 'SENT';

  return (
    <div>
      <Link className="small-muted" to="/clients">← Back to clients</Link>
      <div className="page-head" style={{ marginTop: 10 }}>
        <h1>{client.name}</h1>
      </div>
      <div className="card">
        <div className="kv"><span className="k">Industry</span><span>{client.industry || '—'}</span></div>
        <div className="kv"><span className="k">Location</span><span>{client.location || '—'}</span></div>
        <div className="kv"><span className="k">Agreement status</span><span className="status">{client.agreementStatus.replace(/_/g, ' ')}</span></div>
        {client.agreementSignedAt && (
          <div className="kv"><span className="k">Signed by</span><span>{client.agreementSignedBy} on {new Date(client.agreementSignedAt).toLocaleDateString()}</span></div>
        )}
      </div>

      {error && <div className="error-text">{error}</div>}

      {canManage && (
        <div className="card section">
          <h3>Service agreement (e-sign)</h3>
          {client.agreementDocument && (
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, background: 'var(--bg-2, #f6f7f9)', padding: 10, borderRadius: 6 }}>{client.agreementDocument}</pre>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn btn-sm btn-ghost" onClick={generateAgreement}>Generate agreement</button>
            <button className="btn btn-sm btn-primary" onClick={sendAgreement} disabled={!client.agreementDocument || client.agreementStatus === 'SIGNED'}>
              Send to client
            </button>
          </div>
        </div>
      )}

      {canSign && (
        <div className="card section">
          <h3>Review & e-sign</h3>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, background: 'var(--bg-2, #f6f7f9)', padding: 10, borderRadius: 6 }}>{client.agreementDocument}</pre>
          <form onSubmit={confirmAgreement} className="filter-row" style={{ marginTop: 10 }}>
            <input required placeholder="Type your full name to sign" value={signedByName} onChange={(e) => setSignedByName(e.target.value)} />
            <button className="btn btn-sm btn-primary" type="submit">E-sign agreement</button>
          </form>
        </div>
      )}

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
