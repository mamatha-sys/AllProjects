import { useEffect, useState } from 'react';
import api from '../../api';

export default function AtsReports() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    api.get('/reports/ats').then((res) => setRows(res.data));
  }, []);

  return (
    <div>
      <div className="page-head"><h1>ATS Reports</h1></div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Client</th><th>Open</th><th>In Pipeline</th><th>Selected</th><th>Joined</th><th>Rejected</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.client}>
                <td>{r.client}</td><td>{r.open}</td><td>{r.inPipeline}</td><td>{r.selected}</td><td>{r.joined}</td><td>{r.rejected}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="6" className="small-muted">No data yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
