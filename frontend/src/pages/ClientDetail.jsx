import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api';

const AGREEMENT_EDIT_ROLES = ['SUPER_ADMIN', 'ADMIN'];

export default function ClientDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [client, setClient] = useState(null);
  const [requirements, setRequirements] = useState([]);
  const [signing, setSigning] = useState({ signedByName: '', signedByTitle: '' });
  const [signingLink, setSigningLink] = useState('');
  const [error, setError] = useState('');

  function load() {
    api.get(`/clients/${id}`).then((res) => setClient(res.data));
    api.get(`/requirements?clientId=${id}`).then((res) => setRequirements(res.data));
  }
  useEffect(load, [id]);

  async function agreementAction(path) {
    setError('');
    try {
      const res = await api.post(`/clients/${id}/agreement/${path}`);
      if (res.data.signingPath) setSigningLink(`${window.location.origin}${res.data.signingPath}`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not complete that action');
    }
  }

  async function confirmAgreement(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post(`/clients/${id}/agreement/confirm`, signing);
      setSigning({ signedByName: '', signedByTitle: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not e-sign this agreement');
    }
  }

  if (!client) return <div className="small-muted">Loading…</div>;

  const canManage = AGREEMENT_EDIT_ROLES.includes(user?.role);
  const canSign = user?.role === 'CLIENT' && user?.clientId === client.id && ['SENT', 'VIEWED'].includes(client.agreementStatus);

  return (
    <div>
      <Link className="small-muted" to="/clients">← Back to clients</Link>
      <div className="page-head" style={{ marginTop: 10 }}>
        <h1>{client.name}</h1>
        <span className="status">{client.agreementStatus.replace(/_/g, ' ')}</span>
      </div>
      <div className="card">
        <div className="kv"><span className="k">Industry</span><span>{client.industry || '—'}</span></div>
        <div className="kv"><span className="k">Location</span><span>{client.location || '—'}</span></div>
        <div className="kv"><span className="k">Agreement</span><span>{client.agreementId || 'Not raised yet'}</span></div>
        <div className="kv"><span className="k">Placement fee</span><span>{client.agreementFeePercent ?? '—'}% of annual CTC</span></div>
        {client.agreementSentAt && (
          <div className="kv"><span className="k">Sent</span><span>{new Date(client.agreementSentAt).toLocaleString()}</span></div>
        )}
        {client.agreementSignedAt && (
          <div className="kv">
            <span className="k">Signed</span>
            <span>
              {client.agreementSignedBy}
              {client.agreementSignedByTitle ? ` (${client.agreementSignedByTitle})` : ''} on{' '}
              {new Date(client.agreementSignedAt).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>

      {error && <div className="error-text">{error}</div>}

      {canManage && (
        <div className="card section">
          <h3>Service agreement</h3>
          {client.agreementDocument ? (
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12.5, maxHeight: 280, overflowY: 'auto', margin: 0 }}>
              {client.agreementDocument}
            </pre>
          ) : (
            <div className="small-muted">No agreement generated for this client yet.</div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-sm" onClick={() => agreementAction('generate')} disabled={client.agreementStatus === 'SIGNED'}>
              {client.agreementDocument ? 'Regenerate document' : 'Generate document'}
            </button>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => agreementAction('send')}
              disabled={!client.agreementDocument || client.agreementStatus === 'SIGNED'}
            >
              {client.agreementStatus === 'NOT_SENT' || client.agreementStatus === 'DRAFT' ? 'Send for signature' : 'Resend for signature'}
            </button>
          </div>
          {signingLink && (
            <div className="section">
              <div className="small-muted">Signing link for the client (they do not need a TeamLink login):</div>
              <input readOnly value={signingLink} onFocus={(e) => e.target.select()} style={{ width: '100%' }} />
            </div>
          )}
        </div>
      )}

      {canSign && (
        <div className="card section">
          <h3>Review &amp; e-sign</h3>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12.5, maxHeight: 280, overflowY: 'auto', margin: 0 }}>
            {client.agreementDocument}
          </pre>
          <form onSubmit={confirmAgreement} className="filter-row" style={{ marginTop: 10 }}>
            <input
              required
              placeholder="Type your full name to sign"
              value={signing.signedByName}
              onChange={(e) => setSigning({ ...signing, signedByName: e.target.value })}
            />
            <input
              placeholder="Designation (optional)"
              value={signing.signedByTitle}
              onChange={(e) => setSigning({ ...signing, signedByTitle: e.target.value })}
            />
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
