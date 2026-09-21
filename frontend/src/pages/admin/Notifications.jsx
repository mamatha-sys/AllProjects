import { useEffect, useState } from 'react';
import api from '../../api';

// Notifications — the prototype's notificationsView() (line 10575): a central
// event log across Email / WhatsApp / SMS / In-App, five columns wide.
//
// Main-only behaviour kept: these are real per-user notifications pushed from
// the ATS pipeline and the client agreement flow (backend/src/utils/notify.js),
// so opening the screen marks them read — which is what the prototype does too
// — and the unread count in the header clears with it.

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get('/admin/notifications').then(async (res) => {
      if (cancelled) return;
      setNotifications(res.data);
      setLoaded(true);
      // Opening the central log marks everything read, as the prototype does.
      if (res.data.some((n) => !n.read)) await api.post('/admin/notifications/read-all').catch(() => {});
    }).catch(() => setLoaded(true));
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <div className="page-head">
        <div><h1>Notifications</h1>
          <div className="page-sub">Central event log across Email / WhatsApp / SMS / In-App</div></div>
      </div>

      <div className="notice amber">
        Demo / Simulated — no real messages are sent through Email, WhatsApp or SMS providers in this build.
      </div>

      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Recipient</th><th>Channel</th><th>Event</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            {notifications.map((n) => (
              <tr key={n.id}>
                <td>{n.recipient || '—'}</td>
                <td>{n.channel || 'In-App'}</td>
                <td>{n.title}{n.message ? <div className="small-muted" style={{ fontSize: 11.5 }}>{n.message}</div> : null}</td>
                <td><span className="status pending">{n.status || 'Delivered'}</span></td>
                <td>{new Date(n.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {loaded && notifications.length === 0 && (
              <tr><td colSpan="5" className="small-muted" style={{ padding: 16 }}>No notifications yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
