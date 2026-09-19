import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api';
import { agreementStatusLabel, requirementStatusLabel } from '../atsVocab';
import { StatusBadge, KV, agreementBadgeClass, fmtDate } from './ats/atsUi';

const AGREEMENT_EDIT_ROLES = ['SUPER_ADMIN', 'ADMIN'];

// The prototype's clientDetail() lists candidates who have reached the client
// side of the pipeline (line 7492).
const SHARED_STAGES = [
  'SHARED_WITH_CLIENT', 'CLIENT_REVIEW', 'CLIENT_SHORTLISTED', 'INTERVIEW_SCHEDULED',
  'INTERVIEW_COMPLETED', 'SELECTED', 'OFFER', 'OFFER_ACCEPTED', 'JOINED', 'REJECTED',
];

export default function ClientDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [client, setClient] = useState(null);
  const [requirements, setRequirements] = useState([]);
  const [signing, setSigning] = useState({ signedByName: '', signedByTitle: '' });
  const [signingLink, setSigningLink] = useState('');
  const [shared, setShared] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [error, setError] = useState('');

  function load() {
    api.get(`/clients/${id}`).then((res) => setClient(res.data));
    api.get(`/requirements?clientId=${id}`).then((res) => setRequirements(res.data));
    api.get('/applications')
      .then((res) => setShared(res.data.filter((a) => a.requirement?.clientId === id && SHARED_STAGES.includes(a.stage))))
      .catch(() => setShared([]));
    api.get('/invoices').then((res) => setInvoices(res.data.filter((i) => i.clientId === id))).catch(() => setInvoices([]));
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
  const canSign = user?.role === 'CLIENT' && user?.clientId === client.id && client.agreementStatus === 'SENT';

  return (
    <div>
      <div className="breadcrumb">
        <span className="bc-link" onClick={() => navigate('/clients')}>ATS</span>
        <span className="bc-sep">/</span>
        <span className="bc-link" onClick={() => navigate('/clients')}>Clients</span>
        <span className="bc-sep">/</span>
        <span className="bc-current">{client.name}</span>
      </div>
      <Link className="small-muted" to="/clients">← Back to clients</Link>
      <div className="page-head" style={{ marginTop: 10 }}>
        <div>
          <h1 style={{ fontSize: 20 }}>{client.name}</h1>
          <div className="page-sub">{[client.industry, client.location].filter(Boolean).join(' · ') || '—'}</div>
        </div>
        <span className={`status ${agreementBadgeClass(client.agreementStatus)}`}>
          {agreementStatusLabel(client.agreementStatus)}
        </span>
      </div>

      {error && <div className="notice red">{error}</div>}

      <div className="two-col">
      <div>
      <div className="card section">
        <h3 style={{ fontSize: 13, marginBottom: 10 }}>Client details</h3>
        <div className="grid-2">
          <KV k="Contact">
            {[client.contactName, client.contactEmail, client.contactPhone].filter(Boolean).join(' — ') || '—'}
          </KV>
          <KV k="Account Manager">{client.accountManager || '—'}</KV>
          <KV k="GST">{client.gst || '—'}</KV>
          <KV k="TDS">{client.tdsPercent != null ? `${client.tdsPercent}%` : '—'}</KV>
          <KV k="Payment Terms">{client.paymentTerms || '—'}</KV>
          <KV k="Agreement Date">{fmtDate(client.agreementActivatedAt)}</KV>
          <KV k="Agreement">{client.agreementId || 'Not raised yet'}</KV>
          <KV k="Placement fee">{client.agreementFeePercent ?? '—'}% of annual CTC</KV>
          {client.agreementSentAt && <KV k="Sent">{fmtDate(client.agreementSentAt)}</KV>}
          {client.agreementSignedAt && (
            <KV k="Signed">
              {client.agreementSignedBy}
              {client.agreementSignedByTitle ? ` (${client.agreementSignedByTitle})` : ''} on{' '}
              {fmtDate(client.agreementSignedAt)}
            </KV>
          )}
        </div>
      </div>

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
          {/* Draft -> Sent -> Confirmed -> Active. Only an Active agreement
              lets this client's requirements be activated or posted. */}
          <div className="qa-row" style={{ marginTop: 10 }}>
            <button
              className="btn btn-sm"
              onClick={() => agreementAction('generate')}
              disabled={['CONFIRMED', 'ACTIVE'].includes(client.agreementStatus)}
            >
              {client.agreementDocument ? 'Regenerate document' : 'Generate document'}
            </button>
            {client.agreementStatus === 'SENT' ? (
              <button className="btn btn-sm btn-primary" onClick={() => agreementAction('resend')}>
                Resend for signature
              </button>
            ) : (
              <button
                className="btn btn-sm btn-primary"
                onClick={() => agreementAction('send')}
                disabled={!client.agreementDocument || ['CONFIRMED', 'ACTIVE'].includes(client.agreementStatus)}
              >
                Send for signature
              </button>
            )}
            {client.agreementStatus === 'CONFIRMED' && (
              <button className="btn btn-sm btn-primary" onClick={() => agreementAction('activate')}>
                Activate agreement
              </button>
            )}
          </div>
          {client.agreementStatus === 'CONFIRMED' && (
            <div className="small-muted" style={{ marginTop: 8 }}>
              The client has signed. Activate the agreement to let requirements for this client go live.
            </div>
          )}
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
        <h3 style={{ fontSize: 14, marginBottom: 10 }}>Requirements ({requirements.length})</h3>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Requirement</th><th>Openings</th><th>Status</th></tr></thead>
            <tbody>
              {requirements.map((r) => (
                <tr key={r.id} className="row-link" onClick={() => navigate(`/requirements/${r.id}`)}>
                  <td>{r.title}</td>
                  <td>{r.openings}</td>
                  <td><span className="status active">{requirementStatusLabel(r.status)}</span></td>
                </tr>
              ))}
              {requirements.length === 0 && (
                <tr><td colSpan="3" className="small-muted" style={{ padding: 16 }}>No requirements yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: 14, marginBottom: 10 }}>Candidates shared with this client</h3>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Candidate</th><th>Requirement</th><th>Stage</th><th>Action</th></tr></thead>
            <tbody>
              {shared.map((a) => (
                <tr key={a.id}>
                  <td>{a.candidate?.name}</td>
                  <td>{a.requirement?.title}</td>
                  <td><StatusBadge stage={a.stage} /></td>
                  <td><Link className="btn btn-sm" to={`/candidates/${a.candidateId}`}>View</Link></td>
                </tr>
              ))}
              {shared.length === 0 && (
                <tr><td colSpan="4" className="small-muted" style={{ padding: 16 }}>No candidates shared yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>

      <div>
        <div className="card">
          <h3 style={{ fontSize: 13, marginBottom: 10 }}>Billing history</h3>
          {invoices.map((i) => (
            <div className="kv" key={i.id}>
              <span className="k"><Link to={`/invoices/${i.id}`}>{i.invoiceNumber || i.id}</Link></span>
              <span className={`status ${i.status === 'Overdue' ? 'rejected' : i.status === 'Paid' ? 'active' : 'pending'}`}>
                {i.status}
              </span>
            </div>
          ))}
          {invoices.length === 0 && <div className="small-muted">No invoices yet.</div>}
        </div>
      </div>
      </div>
    </div>
  );
}
