import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

export default function Candidates() {
  const [candidates, setCandidates] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', phone: '', source: 'TeamLink Website', skills: '', experienceYears: '' });
  const [showForm, setShowForm] = useState(false);
  const [duplicate, setDuplicate] = useState('');

  const EMPTY = { name: '', email: '', phone: '', source: 'TeamLink Website', skills: '', experienceYears: '' };

  function load() {
    api.get('/candidates').then((res) => setCandidates(res.data));
  }
  useEffect(load, []);

  // Warn as soon as an email/phone that is already on file is entered, so the
  // same person doesn't get added twice.
  async function checkDuplicate() {
    if (!form.email && !form.phone) return setDuplicate('');
    const res = await api.get('/candidates/check-duplicate', { params: { email: form.email, phone: form.phone } });
    setDuplicate(
      res.data.duplicate
        ? `Already on file: ${res.data.matches.map((m) => m.name).join(', ')}. Save again to add anyway.`
        : ''
    );
  }

  async function createCandidate(e) {
    e.preventDefault();
    try {
      // allowDuplicate is only sent on a second attempt, after the warning has
      // been shown — the backend returns 409 until then.
      await api.post('/candidates', { ...form, allowDuplicate: Boolean(duplicate) });
    } catch (err) {
      if (err.response?.status === 409) return setDuplicate(err.response.data.error);
      throw err;
    }
    setForm(EMPTY);
    setDuplicate('');
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
              <input value={form.email} onBlur={checkDuplicate} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label className="field">
              <span>Phone</span>
              <input value={form.phone} onBlur={checkDuplicate} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
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
            <label className="field">
              <span>Skills (comma-separated)</span>
              <input value={form.skills} placeholder="Node.js, PostgreSQL" onChange={(e) => setForm({ ...form, skills: e.target.value })} />
            </label>
            <label className="field">
              <span>Experience (years)</span>
              <input type="number" min="0" step="0.5" value={form.experienceYears} onChange={(e) => setForm({ ...form, experienceYears: e.target.value })} />
            </label>
          </div>
          {duplicate && <div className="error-text">{duplicate}</div>}
          <button className="btn btn-primary btn-sm" type="submit">Save</button>
        </form>
      )}

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Phone</th><th>Skills</th><th>Source</th><th>Applications</th></tr>
          </thead>
          <tbody>
            {candidates.map((c) => (
              <tr key={c.id} className="row-link">
                <td><Link to={`/candidates/${c.id}`}>{c.name}</Link></td>
                <td>{c.email || '—'}</td>
                <td>{c.phone || '—'}</td>
                <td>{c.skills || '—'}</td>
                <td>{c.source}</td>
                <td>{c.applications?.length ?? 0}</td>
              </tr>
            ))}
            {candidates.length === 0 && <tr><td colSpan="6" className="small-muted">No candidates yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
