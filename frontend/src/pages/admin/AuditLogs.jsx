import { useEffect, useState } from 'react';
import api from '../../api';

// Audit Logs — the prototype's auditView() (line 10587). Column order is its
// own: User, Action, Entity, Date, Previous, New; the page subtitle is the
// recorded-action count.

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.get('/admin/audit')
      .then((res) => { setLogs(res.data); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  return (
    <div>
      <div className="page-head">
        <div><h1>Audit Logs</h1>
          <div className="page-sub">{logs.length} recorded actions</div></div>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>User</th><th>Action</th><th>Entity</th><th>Date</th><th>Previous</th><th>New</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{l.user?.name || 'System'}</td>
                <td>{l.action}</td>
                <td>{l.entity}</td>
                <td className="cell-muted">{new Date(l.createdAt).toLocaleString()}</td>
                <td className="cell-muted">{l.fromValue || '—'}</td>
                <td className="cell-muted">{l.toValue || '—'}</td>
              </tr>
            ))}
            {loaded && logs.length === 0 && (
              <tr><td colSpan="6" className="small-muted" style={{ padding: 16 }}>No activity yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
