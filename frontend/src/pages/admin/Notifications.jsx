import { useEffect, useState } from 'react';
import api from '../../api';

// Everyone's in-app inbox, not just an admin view — ATS pipeline changes and
// the client agreement flow push here (see backend/src/utils/notify.js).
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

  async function markAllRead() {
    await api.post('/admin/notifications/read-all');
    load();
  }

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div>
      <div className="page-head">
        <h1>Notifications{unread > 0 ? ` (${unread} unread)` : ''}</h1>
        {unread > 0 && <button className="btn btn-sm" onClick={markAllRead}>Mark all read</button>}
      </div>
      {notifications.map((n) => (
        <div className="card" key={n.id} style={{ opacity: n.read ? 0.6 : 1 }}>
          <div className="kv">
            <span className="k">{n.title}</span>
            {!n.read && <button className="btn btn-sm" onClick={() => markRead(n.id)}>Mark read</button>}
          </div>
          {n.message && <div className="small-muted">{n.message}</div>}
          <div className="small-muted">{new Date(n.createdAt).toLocaleString()}</div>
        </div>
      ))}
      {notifications.length === 0 && <div className="small-muted">No notifications.</div>}
    </div>
  );
}
