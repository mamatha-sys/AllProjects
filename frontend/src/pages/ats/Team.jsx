import { useEffect, useState } from 'react';
import api from '../../api';

export default function Team() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    api.get('/ats/team').then((res) => setRows(res.data));
  }, []);

  return (
    <div>
      <div className="page-head"><h1>Recruiter & BDE</h1></div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Name</th><th>Role</th><th>Open Requirements</th></tr></thead>
          <tbody>
            {rows.map((r) => <tr key={r.id}><td>{r.name}</td><td>{r.role}</td><td>{r.openRequirements}</td></tr>)}
            {rows.length === 0 && <tr><td colSpan="3" className="small-muted">No recruiters/BDEs yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
