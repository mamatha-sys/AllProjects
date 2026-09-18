import { useEffect, useState } from 'react';
import api from '../../api';

export default function JobPortalReports() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    api.get('/reports/job-portal').then((res) => setRows(res.data));
  }, []);

  return (
    <div>
      <div className="page-head"><h1>Job Portal Reports</h1></div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Source</th><th>Candidates</th></tr></thead>
          <tbody>
            {rows.map((r) => <tr key={r.source}><td>{r.source}</td><td>{r.candidates}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
