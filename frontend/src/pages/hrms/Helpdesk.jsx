import { useEffect, useState } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext.jsx';
import TabsPage from '../../components/TabsPage.jsx';

const HR_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANT_MANAGER', 'STL', 'TL'];

function PriorityPill({ priority }) {
  const cls = ['Urgent', 'High'].includes(priority) ? 'priority-high' : priority === 'Medium' ? 'priority-medium' : 'priority-low';
  return <span className={`status ${cls}`}>{priority}</span>;
}

function StatusPill({ status }) {
  const cls = status === 'Open' ? 'priority-medium' : status === 'In Progress' ? '' : 'priority-low';
  return <span className={`status ${cls}`}>{status}</span>;
}

function Stat({ n, l }) {
  return <div className="statitem"><div className="n">{n}</div><div className="l">{l}</div></div>;
}

function useMeta() {
  const [meta, setMeta] = useState(null);
  useEffect(() => { api.get('/helpdesk/meta').then((res) => setMeta(res.data)); }, []);
  return meta;
}

// ---- Tickets: raise, assign, work and close --------------------------------

function TicketsTab({ isHR }) {
  const meta = useMeta();
  const [tickets, setTickets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [filters, setFilters] = useState({ status: '', category: '', priority: '' });
  const [form, setForm] = useState({ employeeId: '', title: '', detail: '', category: 'IT Support', priority: 'Medium' });
  const [error, setError] = useState('');

  function load() {
    const params = new URLSearchParams();
    Object.keys(filters).forEach((k) => { if (filters[k]) params.set(k, filters[k]); });
    api.get(`/helpdesk?${params.toString()}`).then((res) => setTickets(res.data));
    if (isHR) api.get('/employees').then((res) => setEmployees(res.data)).catch(() => setEmployees([]));
  }
  useEffect(load, [isHR, filters]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      const payload = { title: form.title, detail: form.detail, category: form.category, priority: form.priority };
      if (isHR) payload.employeeId = form.employeeId;
      await api.post('/helpdesk', payload);
      setForm({ ...form, title: '', detail: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not raise the ticket');
    }
  }

  // Resolving or closing needs a resolution note; the server enforces it too.
  async function setStatus(ticket, status) {
    setError('');
    const body = { status };
    if (['Resolved', 'Closed'].includes(status)) {
      const note = prompt(`${status} ticket — resolution note:`, '');
      if (note === null) return;
      if (!note.trim()) { setError('A resolution note is required.'); return; }
      body.resolution = note.trim();
    }
    try {
      await api.patch(`/helpdesk/${ticket.id}/status`, body);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not change the status');
    }
  }

  async function assign(ticket, assignedTo) {
    await api.patch(`/helpdesk/${ticket.id}/assign`, { assignedTo: assignedTo || null });
    load();
  }

  async function escalate(ticket) {
    await api.patch(`/helpdesk/${ticket.id}/escalate`);
    load();
  }

  async function addNote(ticket) {
    const text = prompt('Internal note (never shown to the employee who raised the ticket):', '');
    if (!text || !text.trim()) return;
    await api.post(`/helpdesk/${ticket.id}/notes`, { text: text.trim(), internal: true });
    load();
  }

  async function rate(ticket) {
    const v = prompt('How satisfied were you with the resolution? (1-5)', '5');
    if (v === null) return;
    await api.patch(`/helpdesk/${ticket.id}/csat`, { csat: Number(v) || 5 });
    load();
  }

  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  return (
    <div>
      <div className="statbar">
        <Stat n={tickets.filter((t) => t.status === 'Open').length} l="Open" />
        <Stat n={tickets.filter((t) => t.status === 'In Progress').length} l="In Progress" />
        <Stat n={tickets.filter((t) => ['Resolved', 'Closed'].includes(t.status)).length} l="Resolved" />
        <Stat n={tickets.filter((t) => t.sla?.breached).length} l="SLA Breached" />
      </div>

      <form className="card section" onSubmit={submit}>
        <h3>Raise a ticket</h3>
        <div className="grid-2">
          {isHR && (
            <label className="field">
              <span>Employee</span>
              <select required value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
                <option value="">Select employee</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </label>
          )}
          <label className="field"><span>Subject</span><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label className="field"><span>Description</span><input value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} /></label>
          <label className="field">
            <span>Category</span>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {(meta?.categories || []).map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Priority</span>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {(meta?.priorities || []).map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
        </div>
        {meta && <div className="small-muted">Auto-routed to <b>{meta.routing.find((r) => r.category === form.category)?.team || 'HR Team'}</b> · target response {meta.slaHours[form.priority]}h.</div>}
        {error && <div className="error-text">{error}</div>}
        <button className="btn btn-primary btn-sm" type="submit">Raise ticket</button>
      </form>

      <div className="filter-row">
        <select value={filters.status} onChange={(e) => set('status', e.target.value)}>
          <option value="">All statuses</option>
          {(meta?.statuses || []).map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={filters.category} onChange={(e) => set('category', e.target.value)}>
          <option value="">All categories</option>
          {(meta?.categories || []).map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={filters.priority} onChange={(e) => set('priority', e.target.value)}>
          <option value="">All priorities</option>
          {(meta?.priorities || []).map((p) => <option key={p}>{p}</option>)}
        </select>
      </div>

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              {isHR && <th>Employee</th>}
              <th>Subject</th><th>Category</th><th>Priority</th><th>Routed To</th>
              <th>Assigned To</th><th>SLA</th><th>Status</th><th>Resolution</th><th>CSAT</th><th></th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id}>
                {isHR && <td>{t.employee?.name}</td>}
                <td>
                  <b>{t.title}</b>
                  {t.escalated && <span className="status priority-high" style={{ marginLeft: 6 }}>Escalated</span>}
                  <div className="small-muted">{t.detail || '—'}</div>
                </td>
                <td>{t.category}</td>
                <td><PriorityPill priority={t.priority} /></td>
                <td className="small-muted">{t.routedTo}</td>
                <td>
                  {isHR ? (
                    <select value={t.assignedTo || ''} onChange={(e) => assign(t, e.target.value)}>
                      <option value="">Unassigned</option>
                      {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                  ) : (t.assignedToName || 'Unassigned')}
                </td>
                <td><span className={`status ${t.sla?.breached ? 'priority-high' : 'priority-low'}`}>{t.sla?.label}</span></td>
                <td><StatusPill status={t.status} /></td>
                <td className="small-muted">{t.resolution || '—'}</td>
                <td>
                  {t.csat != null ? `${t.csat} / 5`
                    : (!isHR && ['Resolved', 'Closed'].includes(t.status) ? <button className="btn btn-sm" onClick={() => rate(t)}>Rate</button> : '—')}
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {isHR && (
                    <>
                      <select value={t.status} onChange={(e) => setStatus(t, e.target.value)}>
                        {(meta?.statuses || []).map((s) => <option key={s}>{s}</option>)}
                      </select>{' '}
                      <button className="btn btn-sm" onClick={() => addNote(t)}>Note ({t.noteCount})</button>{' '}
                      {!t.escalated && ['Urgent', 'High'].includes(t.priority) && <button className="btn btn-sm" onClick={() => escalate(t)}>Escalate</button>}
                    </>
                  )}
                </td>
              </tr>
            ))}
            {tickets.length === 0 && <tr><td colSpan={isHR ? 11 : 10} className="small-muted">No tickets match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- Helpdesk Dashboard, Reports & Analytics --------------------------------

function AnalyticsTab() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get('/helpdesk/analytics').then((res) => setData(res.data)); }, []);

  if (!data) return <div className="small-muted">Loading…</div>;
  const k = data.kpis;

  return (
    <div>
      <div className="statbar">
        <Stat n={k.total} l="Total Tickets" />
        <Stat n={k.open} l="Open" />
        <Stat n={k.inProgress} l="In Progress" />
        <Stat n={k.resolved} l="Resolved" />
        <Stat n={k.escalated} l="Escalated" />
        <Stat n={k.slaBreached} l="SLA Breached" />
        <Stat n={k.avgResolutionDays ?? '—'} l="Avg Resolution (days)" />
        <Stat n={k.avgCsat ?? '—'} l="Avg CSAT / 5" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <div className="card">
          <h3 style={{ fontSize: 13, marginBottom: 8 }}>By Category</h3>
          {data.byCategory.map((c) => <div className="kv" key={c.category}><span className="k">{c.category}</span><span>{c.tickets}</span></div>)}
        </div>
        <div className="card">
          <h3 style={{ fontSize: 13, marginBottom: 8 }}>By Priority</h3>
          {data.byPriority.map((p) => <div className="kv" key={p.priority}><span className="k">{p.priority}</span><span>{p.tickets}</span></div>)}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <div className="card">
          <h3 style={{ fontSize: 13, marginBottom: 8 }}>By Status</h3>
          {data.byStatus.map((s) => <div className="kv" key={s.status}><span className="k">{s.status}</span><span>{s.tickets}</span></div>)}
        </div>
        <div className="card">
          <h3 style={{ fontSize: 13, marginBottom: 8 }}>Agent Workload</h3>
          {data.byAgent.map((a) => <div className="kv" key={a.agent}><span className="k">{a.agent}</span><span className="small-muted">{a.open} open of {a.total}</span></div>)}
          {data.byAgent.length === 0 && <div className="small-muted">No tickets assigned.</div>}
        </div>
      </div>
    </div>
  );
}

// ---- Routing map & knowledge base -------------------------------------------

function RoutingTab() {
  const meta = useMeta();
  if (!meta) return <div className="small-muted">Loading…</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div className="card">
        <h3 style={{ fontSize: 13, marginBottom: 8 }}>Auto Routing</h3>
        {meta.routing.map((r) => <div className="kv" key={r.category}><span className="k">{r.category}</span><span>{r.team}</span></div>)}
        <div className="small-muted" style={{ marginTop: 8, fontStyle: 'italic' }}>Email/WhatsApp/SMS delivery is simulated in this build.</div>
        <h3 style={{ fontSize: 13, margin: '14px 0 8px' }}>SLA Targets</h3>
        {Object.keys(meta.slaHours).map((p) => <div className="kv" key={p}><span className="k">{p}</span><span>{meta.slaHours[p]}h</span></div>)}
      </div>
      <div className="card">
        <h3 style={{ fontSize: 13, marginBottom: 8 }}>Knowledge Base</h3>
        {meta.knowledgeBase.map((a) => (
          <div className="kv" key={a.title}><span className="k">{a.title}</span><span className="status">{a.category}</span></div>
        ))}
      </div>
    </div>
  );
}

// Rendered as a tab inside Employee Services, hence `embedded` — see TabsPage.
export default function Helpdesk({ embedded = true }) {
  const { user } = useAuth();
  const isHR = HR_ROLES.includes(user?.role);

  return (
    <TabsPage
      embedded={embedded}
      title="Helpdesk"
      subtitle="Raise, route, escalate and resolve employee IT, HR, facilities and payroll tickets"
      tabs={[
        { key: 'tickets', label: 'Tickets', element: <TicketsTab isHR={isHR} /> },
        ...(isHR ? [{ key: 'analytics', label: 'Dashboard, Reports & Analytics', element: <AnalyticsTab /> }] : []),
        { key: 'routing', label: 'Routing & Knowledge Base', element: <RoutingTab /> },
      ]}
    />
  );
}
