import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

export default function Candidates() {
  const [candidates, setCandidates] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', phone: '', source: 'TeamLink Website' });
  const [showForm, setShowForm] = useState(false);

  function load() {
    api.get('/candidates').then((res) => setCandidates(res.data));
  }
  useEffect(load, []);

  async function createCandidate(e) {
    e.preventDefault();
    await api.post('/candidates', form);
    setForm({ name: '', email: '', phone: '', source: 'TeamLink Website' });
    setShowForm(false);
    load();
  }

  return (
    <div>
      <div className="page-head">
        <h1>Candidates</h1>
        <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancel' : 'Add Candidate'}
        </button>
      </div>

      {showForm && (
        <form className="card section" onSubmit={createCandidate}>
          <div className="grid-2">
            <label className="field">
              <span>Name</span>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="field">
              <span>Email</span>
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label className="field">
              <span>Phone</span>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>
            <label className="field">
              <span>Source</span>
              <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                <option>TeamLink Website</option>
                <option>Naukri</option>
                <option>Indeed</option>
                <option>LinkedIn</option>
                <option>Job Portal</option>
              </select>
            </label>
          </div>
          <button className="btn btn-primary btn-sm" type="submit">Save</button>
        </form>
      )}

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Phone</th><th>Source</th><th>Applications</th></tr>
          </thead>
          <tbody>
            {candidates.map((c) => (
              <tr key={c.id} className="row-link">
                <td><Link to={`/candidates/${c.id}`}>{c.name}</Link></td>
                <td>{c.email || '—'}</td>
                <td>{c.phone || '—'}</td>
                <td>{c.source}</td>
                <td>{c.applications?.length ?? 0}</td>
              </tr>
            ))}
            {candidates.length === 0 && <tr><td colSpan="5" className="small-muted">No candidates yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
