import { useEffect, useState } from 'react';
import api from '../../api';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);

  function load() {
    api.get('/admin/notifications').then((res) => setNotifications(res.data));
  }
  useEffect(load, []);

  async function markRead(id) {
    await api.patch(`/admin/notifications/${id}/read`);
    load();
  }

  return (
    <div>
      <div className="page-head"><h1>Notifications</h1></div>
      {notifications.map((n) => (
        <div className="card" key={n.id} style={{ opacity: n.read ? 0.6 : 1 }}>
          <div className="kv">
            <span className="k">{n.title}</span>
            {!n.read && <button className="btn btn-sm" onClick={() => markRead(n.id)}>Mark read</button>}
          </div>
          {n.message && <div className="small-muted">{n.message}</div>}
        </div>
      ))}
      {notifications.length === 0 && <div className="small-muted">No notifications.</div>}
    </div>
  );
}
