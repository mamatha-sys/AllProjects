import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

export default function Careers() {
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    api.get('/public/jobs').then((res) => setJobs(res.data));
  }, []);

  return (
    <div className="careers-shell">
      <header className="careers-header">
        <div className="logo-lockup">
          <div className="mark">TL</div>
          <div>
            <div style={{ fontWeight: 600 }}>TeamLink Consultants</div>
            <div className="small-muted">Careers</div>
          </div>
        </div>
        <Link className="small-muted" to="/my-applications">Check application status →</Link>
      </header>
      <main className="careers-content">
        <h1>Open Positions</h1>
        <p className="small-muted">Browse current openings across our client companies — no account needed to apply.</p>
        <div className="careers-list">
          {jobs.map((j) => (
            <Link className="careers-card" to={`/careers/${j.id}`} key={j.id}>
              <div className="careers-card-title">{j.title}</div>
              <div className="small-muted">{j.client} · {j.location || 'Location TBD'}</div>
              {j.description && <p>{j.description}</p>}
            </Link>
          ))}
          {jobs.length === 0 && <div className="small-muted">No open positions right now — check back soon.</div>}
        </div>
      </main>
    </div>
  );
}
