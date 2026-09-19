import { useEffect, useState } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext.jsx';

export default function Integrations() {
  const { user } = useAuth();
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role);
  const [jp, setJp] = useState(null);
  const [syncLog, setSyncLog] = useState([]);
  const [mappingQueue, setMappingQueue] = useState([]);
  const [catalog, setCatalog] = useState({ groups: [], catalog: [] });
  const [configuring, setConfiguring] = useState(null);
  const [configValues, setConfigValues] = useState({});
  const [configError, setConfigError] = useState('');
  const [mapTarget, setMapTarget] = useState(null);
  const [requirements, setRequirements] = useState([]);
  const [mapChoice, setMapChoice] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [fallbackLink, setFallbackLink] = useState(false);
  const [testMessage, setTestMessage] = useState('');

  function load() {
    api.get('/integrations/job-portal').then((res) => setJp(res.data));
    api.get('/integrations/sync-log').then((res) => setSyncLog(res.data));
    api.get('/integrations/mapping-queue').then((res) => setMappingQueue(res.data));
    api.get('/integrations/catalog').then((res) => setCatalog(res.data));
    api.get('/requirements').then((res) => setRequirements(res.data)).catch(() => setRequirements([]));
  }
  useEffect(load, []);

  async function syncNow() {
    setSyncing(true);
    setTimeout(async () => {
      await api.post('/integrations/job-portal/sync');
      setSyncing(false);
      load();
    }, 350);
  }

  function openJobPortal() {
    const w = window.open('/careers', 'teamlink-job-portal');
    if (!w) {
      setFallbackLink(true);
    } else {
      setFallbackLink(false);
      w.focus();
    }
  }

  async function testConnection() {
    const res = await api.get('/integrations/job-portal/test');
    setTestMessage(res.data.message);
  }

  async function retrySync(id) {
    await api.post(`/integrations/sync-log/${id}/retry`);
    load();
  }

  function openMap(row) {
    setMapTarget(row);
    setMapChoice(row.suggestedRequirementId || '');
  }

  async function confirmMap() {
    if (!mapChoice) { alert('Pick a requirement first.'); return; }
    await api.post(`/integrations/mapping-queue/${mapTarget.id}/map`, { requirementId: mapChoice });
    setMapTarget(null);
    load();
  }

  async function createDraft(row) {
    await api.post(`/integrations/mapping-queue/${row.id}/draft`);
    load();
  }

  async function archiveRow(row) {
    await api.post(`/integrations/mapping-queue/${row.id}/archive`);
    load();
  }

  function openConfigure(item) {
    setConfiguring(item);
    setConfigError('');
    const initial = {};
    item.fields.forEach((f) => { initial[f.label] = item.values?.[f.label] || f.default || ''; });
    setConfigValues(initial);
  }

  async function toggleChannel(item) {
    await api.post(`/integrations/catalog/${item.id}/toggle`);
    load();
  }

  async function saveConfigure() {
    try {
      await api.post(`/integrations/catalog/${configuring.id}/configure`, { values: configValues });
      setConfiguring(null);
      load();
    } catch (err) {
      setConfigError(err.response?.data?.error || 'Could not save.');
    }
  }

  if (!jp) return <div className="small-muted">Loading…</div>;

  return (
    <div>
      <div className="page-head">
        <div><h1>Integrations</h1><div className="page-sub">Every outside channel the platform talks to — messaging, email, calling, scheduling, job boards, storage, finance and developer access.</div></div>
      </div>

      {mappingQueue.length > 0 && (
        <div className="card section" style={{ borderColor: 'var(--warn)' }}>
          <div className="page-head" style={{ marginBottom: 8 }}>
            <h3 style={{ fontSize: 14 }}>Needs Mapping <span className="status priority-high">{mappingQueue.length}</span></h3>
          </div>
          <div className="small-muted" style={{ marginBottom: 8 }}>These Job Portal jobs have no matching Enterprise requirement. They are not live requirements and their applications stay parked until you map or create one.</div>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Job Portal Job ID</th><th>Job Title</th><th>Source</th><th>Applications</th><th>Date Received</th><th>Mapping Status</th><th>Suggested Requirement</th><th>Actions</th></tr></thead>
              <tbody>
                {mappingQueue.map((r) => (
                  <tr key={r.id}>
                    <td>{r.jobPortalJobId}</td>
                    <td>{r.jobTitle}</td>
                    <td className="small-muted">{r.source}</td>
                    <td className="small-muted">{r.applicationCount}</td>
                    <td className="small-muted">{new Date(r.dateReceived).toLocaleDateString()}</td>
                    <td><span className="status priority-medium">{r.status}</span></td>
                    <td>{requirements.find((q) => q.id === r.suggestedRequirementId)?.title || <span className="small-muted">None</span>}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {isAdmin && (
                        <>
                          <button className="btn btn-sm" onClick={() => openMap(r)}>Map to Existing</button>{' '}
                          <button className="btn btn-sm" onClick={() => createDraft(r)}>Create New (Draft)</button>{' '}
                          <button className="btn btn-sm btn-ghost" onClick={() => archiveRow(r)}>Ignore / Archive</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {mapTarget && (
        <div className="card section" style={{ borderColor: 'var(--warn)' }}>
          <h3>Map — {mapTarget.jobTitle}</h3>
          <div className="kv"><span className="k">Job Portal Job ID</span><span>{mapTarget.jobPortalJobId}</span></div>
          <div className="kv"><span className="k">Applications waiting</span><span>{mapTarget.applicationCount}</span></div>
          <label className="field" style={{ marginTop: 10 }}>
            <span>Map to existing requirement</span>
            <select value={mapChoice} onChange={(e) => setMapChoice(e.target.value)}>
              <option value="">Select requirement</option>
              {requirements.map((r) => <option key={r.id} value={r.id}>{r.title} — {r.client?.name}</option>)}
            </select>
          </label>
          {mapTarget.suggestedRequirementId && <div className="notice" style={{ marginTop: 8 }}>A suggestion is pre-selected based on title and skill overlap — confirm or change it.</div>}
          <div style={{ marginTop: 10 }}>
            <button className="btn btn-sm" onClick={() => setMapTarget(null)}>Cancel</button>{' '}
            <button className="btn btn-sm btn-primary" onClick={confirmMap}>Map & Import Applications</button>
          </div>
        </div>
      )}

      <div className="card section">
        <h3 style={{ fontSize: 14, marginBottom: 10 }}>Job Portal</h3>
        <div className="grid-2">
          <div className="kv"><span className="k">Connection</span><span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: jp.status === 'Connected' ? '#1e8449' : '#c0392b', marginRight: 6 }} />{jp.status}</span></div>
          <div className="kv"><span className="k">Last Sync</span><span>{jp.lastSync ? new Date(jp.lastSync).toLocaleString() : '—'}</span></div>
          <div className="kv"><span className="k">Sync Status</span><span><span className={`status ${jp.lastSyncResult === 'Success' ? 'priority-low' : 'priority-medium'}`}>{jp.lastSyncResult || 'Not yet synced'}</span></span></div>
          <div className="kv"><span className="k">Candidates Synced</span><span>{jp.candidatesSynced}</span></div>
          <div className="kv"><span className="k">Applications Synced</span><span>{jp.applicationsSynced}</span></div>
          <div className="kv"><span className="k">Requirements Synced</span><span>{jp.requirementsSynced}</span></div>
          <div className="kv"><span className="k">Requirements Needing Mapping</span><span>{jp.requirementsNeedingMapping}</span></div>
          <div className="kv"><span className="k">Failed Records</span><span>{jp.failedRecords}</span></div>
        </div>
        <div style={{ marginTop: 10 }}>
          <button className="btn btn-sm btn-primary" disabled={syncing} onClick={syncNow}>{syncing ? 'Syncing…' : 'Sync'}</button>{' '}
          <button className="btn btn-sm" onClick={openJobPortal}>Open Job Portal ↗</button>{' '}
          <button className="btn btn-sm" onClick={testConnection}>Test Connection</button>
          {testMessage && <span className="small-muted" style={{ marginLeft: 10 }}>{testMessage}</span>}
        </div>
        {fallbackLink && <div className="notice" style={{ marginTop: 8 }}>Pop-ups appear to be blocked. Use this link instead: <a href="/careers" target="_blank" rel="noreferrer">Open TeamLink Job Portal ↗</a></div>}
        <div className="small-muted" style={{ marginTop: 10 }}>Sync pulls candidate/application data from the Job Portal into this ATS — it never navigates away. Open Job Portal opens the candidate-facing app in a new tab — it never triggers a sync.</div>
      </div>

      <div className="card section">
        <h3 style={{ fontSize: 14, marginBottom: 10 }}>Sync Logs</h3>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Date</th><th>Entity</th><th>Status</th><th>Reason</th><th></th></tr></thead>
            <tbody>
              {syncLog.map((l) => (
                <tr key={l.id}>
                  <td>{new Date(l.date).toLocaleString()}</td>
                  <td>{l.entity}</td>
                  <td><span className={`status ${l.status === 'Success' ? 'priority-low' : 'priority-high'}`}>{l.status}</span></td>
                  <td>{l.reason || '—'}</td>
                  <td>{l.status === 'Failed' && <button className="btn btn-sm" onClick={() => retrySync(l.id)}>Retry</button>}</td>
                </tr>
              ))}
              {syncLog.length === 0 && <tr><td colSpan="5" className="small-muted">No sync activity yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card section">
        <h3 style={{ fontSize: 14, marginBottom: 4 }}>Integrations</h3>
        <div className="small-muted" style={{ marginBottom: 10 }}>Enable a channel and add its credentials to switch it on for every product.</div>
        {catalog.groups.map((g) => {
          const items = catalog.catalog.filter((c) => c.group === g);
          if (!items.length) return null;
          return (
            <div key={g} style={{ marginBottom: 14 }}>
              <div className="page-sub" style={{ fontWeight: 700, marginBottom: 6 }}>{g}</div>
              {items.map((item) => (
                <div className="kv" key={item.id}>
                  <span className="k">{item.name}<div className="small-muted" style={{ fontWeight: 400 }}>{item.desc}</div></span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`status ${item.connected ? 'priority-low' : 'priority-medium'}`}>{item.connected ? 'Connected' : 'Not connected'}</span>
                    <button className="btn btn-sm" onClick={() => toggleChannel(item)}>{item.enabled ? 'Disable' : 'Enable'}</button>
                    <button className="btn btn-sm btn-primary" onClick={() => openConfigure(item)}>Configure →</button>
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {configuring && (
        <div className="card section">
          <h3>{configuring.name}</h3>
          <div className="small-muted" style={{ marginBottom: 10 }}>{configuring.desc}</div>
          {configError && <div className="error-text">{configError}</div>}
          <div className="grid-2">
            {configuring.fields.map((f) => (
              <label className="field" key={f.label}>
                <span>{f.label}</span>
                <input value={configValues[f.label] || ''} onChange={(e) => setConfigValues({ ...configValues, [f.label]: e.target.value })} />
              </label>
            ))}
          </div>
          <div className="small-muted" style={{ fontStyle: 'italic', margin: '8px 0' }}>Configuration only — this prototype never contacts the provider.</div>
          <button className="btn btn-sm" onClick={() => setConfiguring(null)}>Cancel</button>{' '}
          <button className="btn btn-sm btn-primary" onClick={saveConfigure}>Save & Connect</button>
        </div>
      )}
    </div>
  );
}
