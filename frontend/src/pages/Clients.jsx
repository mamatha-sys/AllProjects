import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({ name: '', industry: '', location: '' });
  const [showForm, setShowForm] = useState(false);

  function load() {
    api.get('/clients').then((res) => setClients(res.data));
  }
  useEffect(load, []);

  async function createClient(e) {
    e.preventDefault();
    await api.post('/clients', form);
    setForm({ name: '', industry: '', location: '' });
    setShowForm(false);
    load();
  }

  return (
    <div>
      <div className="page-head">
        <h1>Clients</h1>
        <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancel' : 'Add Client'}
        </button>
      </div>

      {showForm && (
        <form className="card section" onSubmit={createClient}>
          <div className="grid-2">
            <label className="field">
              <span>Name</span>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="field">
              <span>Industry</span>
              <input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
            </label>
            <label className="field">
              <span>Location</span>
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </label>
          </div>
          <button className="btn btn-primary btn-sm" type="submit">Save</button>
        </form>
      )}

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr><th>Name</th><th>Industry</th><th>Location</th><th>Agreement</th></tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} className="row-link">
                <td><Link to={`/clients/${c.id}`}>{c.name}</Link></td>
                <td>{c.industry || '—'}</td>
                <td>{c.location || '—'}</td>
                <td><span className="status">{c.agreementStatus.replace(/_/g, ' ')}</span></td>
              </tr>
            ))}
            {clients.length === 0 && <tr><td colSpan="4" className="small-muted">No clients yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
