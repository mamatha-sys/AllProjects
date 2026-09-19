import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

// Lightweight candidate portal ("myApplications" from the reference prototype)
// — no candidate login, just an email lookup against every application tied
// to that email, matching the public/no-account apply flow in Careers.jsx.
export default function MyApplications() {
  const [email, setEmail] = useState('');
  const [applications, setApplications] = useState(null);
  const [busy, setBusy] = useState(false);

  async function check(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.get(`/public/my-applications?email=${encodeURIComponent(email)}`);
      setApplications(res.data.applications);
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
            <div className="small-muted">My Applications</div>
          </div>
        </div>
      </header>
      <main className="careers-content">
        <Link className="small-muted" to="/careers">← Back to openings</Link>
        <h1 style={{ marginTop: 10 }}>Check your application status</h1>
        <form className="filter-row" onSubmit={check} style={{ maxWidth: 420 }}>
          <input style={{ flex: 1 }} required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email used to apply" />
          <button className="btn btn-sm btn-primary" type="submit" disabled={busy}>{busy ? 'Checking…' : 'Check'}</button>
        </form>

        {applications && (
          <div className="card section">
            {applications.map((a) => (
              <div className="kv" key={a.id}>
                <span className="k">{a.jobTitle} — {a.client}</span>
                <span className="status">{a.stage.replace(/_/g, ' ')}</span>
              </div>
            ))}
            {applications.length === 0 && <div className="small-muted">No applications found for that email.</div>}
          </div>
        )}
      </main>
    </div>
  );
}
