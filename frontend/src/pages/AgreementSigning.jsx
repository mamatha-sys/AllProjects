import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';

// The client-facing signing page reached by the tokenised link TeamLink sends
// out (POST /api/clients/:id/agreement/send). The client reads the agreement
// and types their name to e-sign — no TeamLink login required.
export default function AgreementSigning() {
  const { token } = useParams();
  const [agreement, setAgreement] = useState(null);
  const [form, setForm] = useState({ signedByName: '', signedByTitle: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get(`/public/agreement/${token}`)
      .then((res) => setAgreement(res.data))
      .catch((err) => setError(err.response?.data?.error || 'This signing link is not valid'));
  }, [token]);

  async function sign(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`/public/agreement/${token}/sign`, form);
      setAgreement({ ...agreement, status: 'SIGNED', signedBy: form.signedByName, signedAt: res.data.signedAt });
    } catch (err) {
      setError(err.response?.data?.error || 'Could not record your signature');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="careers-shell">
      <header className="careers-header">
        <div className="logo-lockup">
          <div className="mark">TL</div>
          <div>
            <div style={{ fontWeight: 600 }}>TeamLink Consultants</div>
            <div className="small-muted">Service agreement</div>
          </div>
        </div>
      </header>
      <main className="careers-content">
        {error && !agreement && <div className="error-text">{error}</div>}
        {!agreement && !error && <div className="small-muted">Loading…</div>}

        {agreement && (
          <>
            <h1>Recruitment / Staffing Services Agreement</h1>
            <p className="small-muted">
              {agreement.clientName}
              {agreement.agreementId ? ` · ${agreement.agreementId}` : ''}
            </p>

            <div className="card section">
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12.5, maxHeight: 420, overflowY: 'auto', margin: 0 }}>
                {agreement.document}
              </pre>
            </div>

            {agreement.status === 'SIGNED' ? (
              <div className="card section">
                <h3>Signed</h3>
                <div className="small-muted">
                  Signed by {agreement.signedBy}
                  {agreement.signedByTitle ? ` (${agreement.signedByTitle})` : ''}
                  {agreement.signedAt ? ` on ${new Date(agreement.signedAt).toLocaleString()}` : ''}. A copy is now with
                  your TeamLink account team — you can close this window.
                </div>
              </div>
            ) : (
              <div className="card section">
                <h3>E-sign this agreement</h3>
                <p className="small-muted">Typing your full name below records your acceptance of the terms above.</p>
                {error && <div className="error-text">{error}</div>}
                <form onSubmit={sign} className="filter-row">
                  <input
                    required
                    placeholder="Full name"
                    value={form.signedByName}
                    onChange={(e) => setForm({ ...form, signedByName: e.target.value })}
                  />
                  <input
                    placeholder="Designation (optional)"
                    value={form.signedByTitle}
                    onChange={(e) => setForm({ ...form, signedByTitle: e.target.value })}
                  />
                  <button className="btn btn-sm btn-primary" type="submit" disabled={busy}>
                    {busy ? 'Signing…' : 'Sign agreement'}
                  </button>
                </form>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
