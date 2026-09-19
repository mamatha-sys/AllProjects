import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../api';

export default function Search() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [results, setResults] = useState({ candidates: [], clients: [], requirements: [] });

  async function search(e) {
    e?.preventDefault();
    if (!q.trim()) return;
    setParams({ q });
    const res = await api.get(`/ats/search?q=${encodeURIComponent(q)}`);
    setResults(res.data);
  }

  return (
    <div>
      <div className="page-head"><h1>Search</h1></div>
      <form className="filter-row" onSubmit={search}>
        <input style={{ flex: 1 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search candidates, clients, requirements…" />
        <button className="btn btn-sm btn-primary" type="submit">Search</button>
      </form>

      <div className="card section">
        <h3>Candidates</h3>
        {results.candidates.map((c) => <div className="kv" key={c.id}><Link to={`/candidates/${c.id}`}>{c.name}</Link></div>)}
        {results.candidates.length === 0 && <div className="small-muted">No matches.</div>}
      </div>
      <div className="card section">
        <h3>Clients</h3>
        {results.clients.map((c) => <div className="kv" key={c.id}><Link to={`/clients/${c.id}`}>{c.name}</Link></div>)}
        {results.clients.length === 0 && <div className="small-muted">No matches.</div>}
      </div>
      <div className="card section">
        <h3>Requirements</h3>
        {results.requirements.map((r) => <div className="kv" key={r.id}><Link to={`/requirements/${r.id}`}>{r.title} — {r.client?.name}</Link></div>)}
        {results.requirements.length === 0 && <div className="small-muted">No matches.</div>}
      </div>
    </div>
  );
}
