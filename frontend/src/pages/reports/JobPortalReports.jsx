import { useEffect, useState } from 'react';
import api from '../../api';

export default function JobPortalReports() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/reports/job-portal').then((res) => setData(res.data));
  }, []);

  if (!data) return <div className="small-muted">Loading…</div>;

  return (
    <div>
      <div className="page-head"><div><h1>Job Portal Reports</h1><div className="page-sub">From the connected Job Portal (via integration)</div></div></div>
      <div className="statbar">
        <div className="statitem"><div className="n">{data.registrationsSynced}</div><div className="l">Registrations synced</div></div>
        <div className="statitem"><div className="n">{data.applicationsSynced}</div><div className="l">Applications synced</div></div>
        <div className="statitem"><div className="n">{data.fromNaukri}</div><div className="l">From Naukri</div></div>
        <div className="statitem"><div className="n">{data.fromLinkedIn}</div><div className="l">From LinkedIn</div></div>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Source</th><th>Candidates</th></tr></thead>
          <tbody>
            {data.bySource.map((r) => <tr key={r.source}><td>{r.source}</td><td>{r.candidates}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
