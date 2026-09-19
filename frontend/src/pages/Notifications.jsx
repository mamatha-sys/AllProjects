import { useEffect, useState } from 'react';
import api from '../api';

export default function Notifications() {
  const [rows, setRows] = useState([]);

  function load() {
    api.get('/notifications').then((res) => setRows(res.data));
  }
  useEffect(load, []);

  async function markRead(id) {
    await api.patch(`/notifications/${id}/read`);
    load();
  }

  async function markAllRead() {
    await api.post('/notifications/read-all');
    load();
  }

  return (
    <div>
      <div className="page-head">
        <h1>Notifications</h1>
        <button className="btn btn-ghost" onClick={markAllRead}>Mark all read</button>
      </div>
      <div className="card section">
        {rows.map((n) => (
          <div className="kv" key={n.id} style={{ opacity: n.read ? 0.6 : 1 }}>
            <span className="k">
              {n.title}
              {n.message && <div className="small-muted">{n.message}</div>}
              <div className="small-muted">{new Date(n.createdAt).toLocaleString()}</div>
            </span>
            {!n.read && <button className="btn btn-sm btn-ghost" onClick={() => markRead(n.id)}>Mark read</button>}
          </div>
        ))}
        {rows.length === 0 && <div className="small-muted">No notifications yet.</div>}
      </div>
    </div>
  );
}
