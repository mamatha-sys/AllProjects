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
      <div className="page-head">
        <div>
          <h1>Job Portal Reports</h1>
          <div className="page-sub">From the connected Job Portal (via integration)</div>
        </div>
      </div>

      <div className="statbar">
        <Stat n={data.registrationsSynced} l="Registrations synced" />
        <Stat n={data.applicationsSynced} l="Applications synced" />
        <Stat n={data.fromNaukri} l="From Naukri" />
        <Stat n={data.fromLinkedIn} l="From LinkedIn" />
      </div>

      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Source</th><th>Candidates</th></tr></thead>
          <tbody>
            {data.rows.map((r) => <tr key={r.source}><td>{r.source}</td><td>{r.candidates}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ n, l }) {
  return <div className="statitem"><div className="n">{n}</div><div className="l">{l}</div></div>;
}
