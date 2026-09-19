import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

export default function Requirements() {
  const [requirements, setRequirements] = useState([]);
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({ title: '', clientId: '', department: '', priority: 'MEDIUM', skills: '', experience: '', openings: 1 });
  const [showForm, setShowForm] = useState(false);

  function load() {
    api.get('/requirements').then((res) => setRequirements(res.data));
  }
  useEffect(() => {
    load();
    api.get('/clients').then((res) => setClients(res.data));
  }, []);

  async function createRequirement(e) {
    e.preventDefault();
    await api.post('/requirements', form);
    setForm({ title: '', clientId: '', department: '', priority: 'MEDIUM', skills: '', experience: '', openings: 1 });
    setShowForm(false);
    load();
  }

  return (
    <div>
      <div className="page-head">
        <h1>Requirements</h1>
        <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancel' : 'Add Requirement'}
        </button>
      </div>

      {showForm && (
        <form className="card section" onSubmit={createRequirement}>
          <div className="grid-2">
            <label className="field">
              <span>Title</span>
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
            <label className="field">
              <span>Client</span>
              <select required value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
                <option value="">Select client</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Department</span>
              <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </label>
            <label className="field">
              <span>Priority</span>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </label>
            <label className="field">
              <span>Must-have skills (comma-separated)</span>
              <input
                value={form.skills}
                placeholder="Node.js, PostgreSQL, REST"
                onChange={(e) => setForm({ ...form, skills: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Experience (years)</span>
              <input value={form.experience} placeholder="5-8" onChange={(e) => setForm({ ...form, experience: e.target.value })} />
            </label>
            <label className="field">
              <span>Openings</span>
              <input type="number" min="1" value={form.openings} onChange={(e) => setForm({ ...form, openings: e.target.value })} />
            </label>
          </div>
          <button className="btn btn-primary btn-sm" type="submit">Save</button>
        </form>
      )}

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr><th>Title</th><th>Client</th><th>Priority</th><th>Status</th><th>Applications</th><th>Matching candidates</th></tr>
          </thead>
          <tbody>
            {requirements.map((r) => (
              <tr key={r.id} className="row-link">
                <td><Link to={`/requirements/${r.id}`}>{r.title}</Link></td>
                <td>{r.client?.name}</td>
                <td><span className={`status priority-${r.priority.toLowerCase()}`}>{r.priority}</span></td>
                <td>{r.status}</td>
                <td>{r._count?.applications ?? 0}</td>
                <td>{r.matchingCandidates ?? 0}</td>
              </tr>
            ))}
            {requirements.length === 0 && <tr><td colSpan="6" className="small-muted">No requirements yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
