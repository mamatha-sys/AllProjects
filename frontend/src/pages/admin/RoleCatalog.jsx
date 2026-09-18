import { useEffect, useState } from 'react';
import api from '../../api';

export default function RoleCatalog() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    api.get('/admin/role-catalog').then((res) => setRows(res.data));
  }, []);

  return (
    <div>
      <div className="page-head"><h1>Role Catalog</h1></div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Role</th><th>Access</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.role}><td>{r.role}</td><td>{r.access}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
