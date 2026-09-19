import { useEffect, useState } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext.jsx';

const HR_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANT_MANAGER', 'STL', 'TL'];

export default function Announcements() {
  const { user } = useAuth();
  const isHR = HR_ROLES.includes(user?.role);
  const [announcements, setAnnouncements] = useState([]);
  const [form, setForm] = useState({ title: '', body: '', category: 'General', pinned: false, date: new Date().toISOString().slice(0, 10) });

  function load() {
    api.get('/announcements').then((res) => setAnnouncements(res.data));
  }
  useEffect(load, []);

  async function post(e) {
    e.preventDefault();
    await api.post('/announcements', form);
    setForm({ title: '', body: '', category: 'General', pinned: false, date: new Date().toISOString().slice(0, 10) });
    load();
  }

  async function togglePin(id) {
    await api.put(`/announcements/${id}/pin`);
    load();
  }

  async function remove(id) {
    if (!confirm('Delete this announcement?')) return;
    await api.delete(`/announcements/${id}`);
    load();
  }

  return (
    <div>
      <div className="page-head"><h1>Announcements</h1></div>

      {isHR && (
        <form className="card section" onSubmit={post}>
          <h3>Post announcement</h3>
          <label className="field"><span>Title</span><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label className="field" style={{ marginTop: 8 }}><span>Body</span><input required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, fontSize: 13 }}>
            <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} /> Pin to top
          </label>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} type="submit">Post</button>
        </form>
      )}

      {announcements.map((a) => (
        <div className="card" key={a.id}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <h3 style={{ fontSize: 14, margin: 0 }}>{a.pinned && '📌 '}{a.title} <span className="status">{a.category}</span></h3>
            {isHR && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-sm" onClick={() => togglePin(a.id)}>{a.pinned ? 'Unpin' : 'Pin'}</button>
                <button className="btn btn-sm" onClick={() => remove(a.id)}>Delete</button>
              </div>
            )}
          </div>
          <div className="small-muted">By {a.postedBy || 'HR'} · {a.date}</div>
          <p style={{ marginTop: 8 }}>{a.body}</p>
        </div>
      ))}
      {announcements.length === 0 && <div className="small-muted">No announcements yet.</div>}
    </div>
  );
}
