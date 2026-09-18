import { useEffect, useState } from 'react';
import api from '../../api';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    api.get('/admin/audit').then((res) => setLogs(res.data));
  }, []);

  return (
    <div>
      <div className="page-head"><h1>Audit Logs</h1></div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Date</th><th>User</th><th>Action</th><th>Entity</th><th>From</th><th>To</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{new Date(l.createdAt).toLocaleString()}</td>
                <td>{l.user?.name || 'System'}</td>
                <td>{l.action}</td>
                <td>{l.entity}</td>
                <td>{l.fromValue || '—'}</td>
                <td>{l.toValue || '—'}</td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan="6" className="small-muted">No activity yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
