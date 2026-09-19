import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import TabsPage from '../components/TabsPage.jsx';
import { downloadCsv } from '../utils/csv.js';

const HR_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANT_MANAGER', 'STL', 'TL'];
const today = () => new Date().toISOString().slice(0, 10);

function StatusPill({ status }) {
  const cls = status === 'Approved' ? 'priority-low' : status === 'Rejected' ? 'priority-high' : '';
  return <span className={`status ${cls}`}>{status}</span>;
}

function Stat({ n, l }) {
  return <div className="statitem"><div className="n">{n}</div><div className="l">{l}</div></div>;
}

function DashboardTab({ isHR, canEditPolicy }) {
  const [requests, setRequests] = useState([]);
  const [types, setTypes] = useState([]);
  const [reasons, setReasons] = useState([]);
  const [caps, setCaps] = useState(null);
  const [onLeave, setOnLeave] = useState(null);
  const [filters, setFilters] = useState({ department: '', type: '' });
  const [form, setForm] = useState({ type: '', fromDate: '', toDate: '', reason: '' });
  const [error, setError] = useState('');

  function load() {
    api.get('/leave').then((res) => setRequests(res.data));
    api.get('/leave/types').then((res) => setTypes(res.data));
    api.get('/leave/reasons').then((res) => setReasons(res.data));
    api.get('/leave/concurrency-policy').then((res) => setCaps(res.data));
    if (isHR) api.get('/leave/on-leave-today').then((res) => setOnLeave(res.data)).catch(() => setOnLeave(null));
  }
  useEffect(load, [isHR]);

  async function submitLeave(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/leave', form);
      setForm({ type: '', fromDate: '', toDate: '', reason: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not submit request');
    }
  }

  async function saveCaps(patch) {
    const res = await api.put('/leave/concurrency-policy', patch);
    setCaps(res.data);
  }

  // Approvals of leaveReasonThresholdDays or more need one of the configured
  // reasons; the server tells us which ones when it rejects the first attempt.
  async function decide(request, status) {
    setError('');
    const body = { status };
    if (status === 'Rejected') {
      const why = prompt(`Reject ${request.employee?.name || 'this'} leave request — reason:`, '');
      if (why === null) return;
      if (!why.trim()) { setError('A rejection reason is required.'); return; }
      body.rejectReason = why.trim();
    }
    if (status === 'Approved') {
      const days = request.days || 1;
      const active = reasons.filter((r) => r.active);
      if (caps && days >= caps.leaveReasonThresholdDays && active.length) {
        const list = active.map((r, i) => `${i + 1}. ${r.label}`).join('\n');
        const pick = prompt(`${days}-day leave — pick an approval reason:\n${list}`, '1');
        if (pick === null) return;
        body.approvalReason = (active[(Number(pick) || 1) - 1] || active[0]).label;
      }
    }
    try {
      await api.patch(`/leave/${request.id}/decision`, body);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not record the decision');
    }
  }

  async function requestCancel(id) {
    await api.patch(`/leave/${id}/cancel-request`);
    load();
  }

  async function editCap(type) {
    const v = prompt(`Annual/monthly cap for ${type.name} (${type.unit})`, type.cap);
    if (v === null) return;
    await api.put(`/leave/types/${type.id}`, { cap: Number(v) || 0 });
    load();
  }

  async function toggleType(type) {
    await api.put(`/leave/types/${type.id}`, { active: !type.active });
    load();
  }

  async function addReason() {
    const label = prompt('New approval reason:');
    if (!label || !label.trim()) return;
    await api.post('/leave/reasons', { label: label.trim() });
    load();
  }

  async function toggleReason(reason) {
    await api.put(`/leave/reasons/${reason.id}`, { active: !reason.active });
    load();
  }

  const activeTypes = types.filter((t) => t.active);
  const scoped = requests.filter((r) => (
    (!filters.department || r.employee?.department === filters.department)
    && (!filters.type || r.type === filters.type)
  ));
  const pending = scoped.filter((r) => r.status === 'Pending');
  const approved = scoped.filter((r) => r.status === 'Approved');
  const rejected = scoped.filter((r) => r.status === 'Rejected');
  const cancellations = scoped.filter((r) => r.status === 'Cancellation Requested');
  const onLeaveToday = approved.filter((r) => r.fromDate <= today() && (r.toDate || r.fromDate) >= today());
  const departments = [...new Set(requests.map((r) => r.employee?.department).filter(Boolean))].sort();

  function exportRequests() {
    downloadCsv(
      'leave-requests.csv',
      ['Employee', 'Department', 'Type', 'From', 'To', 'Days', 'Status', 'Reason'],
      scoped.map((r) => [r.employee?.name || '', r.employee?.department || '', r.type, r.fromDate, r.toDate, r.days ?? 1, r.status, r.reason || ''])
    );
  }

  return (
    <div>
      {isHR && (
        <div className="filter-row">
          <select value={filters.department} onChange={(e) => setFilters({ ...filters, department: e.target.value })}>
            <option value="">All Departments</option>
            {departments.map((d) => <option key={d}>{d}</option>)}
          </select>
          <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
            <option value="">All types</option>
            {types.map((t) => <option key={t.id} value={t.name}>{t.name} ({t.code})</option>)}
          </select>
          <button className="btn btn-sm btn-primary" onClick={exportRequests}>Export</button>
        </div>
      )}

      <div className="statbar">
        <Stat n={pending.length} l="Pending Requests" />
        <Stat n={approved.length} l="Approved" />
        <Stat n={rejected.length} l="Rejected" />
        <Stat n={onLeaveToday.length} l="Employees on Leave Today" />
        <Stat n={cancellations.length} l="Cancellation Requests" />
      </div>

      <form className="card section" onSubmit={submitLeave}>
        <h3>Apply Leave</h3>
        <div className="grid-2">
          <label className="field">
            <span>Type</span>
            <select required value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="">Select type</option>
              {activeTypes.map((t) => <option key={t.id} value={t.name}>{t.name} ({t.code})</option>)}
            </select>
          </label>
          <label className="field"><span>From</span><input type="date" required value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} /></label>
          <label className="field"><span>To</span><input type="date" required value={form.toDate} onChange={(e) => setForm({ ...form, toDate: e.target.value })} /></label>
          <label className="field"><span>Reason</span><input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></label>
        </div>
        {error && <div className="error-text">{error}</div>}
        <button className="btn btn-primary btn-sm" type="submit">Submit request</button>
      </form>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <h3 style={{ fontSize: 13, marginBottom: 4 }}>Leave Approval Chain</h3>
          <div className="small-muted" style={{ marginBottom: 8 }}>Team Lead (TL) → Assistant Manager → Super Admin</div>
          {pending.slice(0, 8).map((r) => (
            <div className="kv" key={r.id}>
              <span className="k">
                <b>{r.employee?.name || 'You'}</b>
                <span className="small-muted"> {r.type} · {r.fromDate}{r.toDate && r.toDate !== r.fromDate ? ` → ${r.toDate}` : ''} · {r.days ?? 1} day(s)</span>
              </span>
              {isHR && (
                <span>
                  <button className="btn btn-sm" onClick={() => decide(r, 'Approved')}>Approve</button>{' '}
                  <button className="btn btn-sm" onClick={() => decide(r, 'Rejected')}>Reject</button>
                </span>
              )}
            </div>
          ))}
          {pending.length === 0 && <div className="small-muted">No pending requests.</div>}
        </div>

        <div className="card">
          <h3 style={{ fontSize: 13, marginBottom: 8 }}>Leave Types & Policy</h3>
          {types.map((t) => (
            <div className="kv" key={t.id} style={{ opacity: t.active ? 1 : 0.55 }}>
              <span className="k">
                {t.name} ({t.code}){' '}
                {t.carries && <span className="status priority-low">Carries forward</span>}
                {!t.active && <span className="status">Paused</span>}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="small-muted">{t.unit === 'unpaid' ? 'Unpaid' : `${t.cap}/${t.unit}`}</span>
                {canEditPolicy && <button className="btn btn-sm" onClick={() => editCap(t)}>Edit</button>}
                {canEditPolicy && <button className="btn btn-sm" onClick={() => toggleType(t)}>{t.active ? 'Pause' : 'Resume'}</button>}
              </span>
            </div>
          ))}
          {caps && (
            <>
              <div className="kv">
                <span className="k">Concurrent Leave Cap <span className="small-muted">— max % of a department on leave at once</span></span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <b>{caps.concurrentLeaveCapPct}%</b>
                  {canEditPolicy && <button className="btn btn-sm" onClick={() => { const v = prompt('Concurrent leave cap (%)', caps.concurrentLeaveCapPct); if (v !== null) saveCaps({ concurrentLeaveCapPct: Number(v) || 0 }); }}>Edit</button>}
                </span>
              </div>
              <div className="kv">
                <span className="k">Concurrent Leave Cap — Flat Headcount</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <b>{caps.concurrentLeaveCapFlat}</b>
                  {canEditPolicy && <button className="btn btn-sm" onClick={() => { const v = prompt('Flat headcount cap', caps.concurrentLeaveCapFlat); if (v !== null) saveCaps({ concurrentLeaveCapFlat: Number(v) || 0 }); }}>Edit</button>}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ fontSize: 13, flex: 1 }}>Leave Approval Reasons</h3>
            {canEditPolicy && <button className="btn btn-sm" onClick={addReason}>+ Add</button>}
          </div>
          <div className="small-muted" style={{ margin: '4px 0 8px' }}>
            Shown as options when approving a leave request of {caps?.leaveReasonThresholdDays ?? 4}+ days.
          </div>
          {reasons.map((r) => (
            <div className="kv" key={r.id} style={{ opacity: r.active ? 1 : 0.55 }}>
              <span className="k">{r.label} {!r.active && <span className="status">Paused</span>}</span>
              {canEditPolicy && <button className="btn btn-sm" onClick={() => toggleReason(r)}>{r.active ? 'Pause' : 'Resume'}</button>}
            </div>
          ))}
          {reasons.length === 0 && <div className="small-muted">No approval reasons configured.</div>}
        </div>

        <div className="card">
          <h3 style={{ fontSize: 13, marginBottom: 8 }}>Employees on Leave — Department Wise</h3>
          {onLeave?.total === 0 && <div className="small-muted" style={{ marginBottom: 6 }}>No one on leave today.</div>}
          {(onLeave?.departments || []).map((d) => (
            <div className="kv" key={d.department}>
              <span className="k">{d.department}</span>
              <span className={`status ${d.onLeave > 0 ? 'priority-medium' : 'priority-low'}`}>{d.onLeave} on leave</span>
            </div>
          ))}
          {!onLeave && <div className="small-muted">Not available for your role.</div>}
        </div>
      </div>

      <div className="tbl-wrap" style={{ marginTop: 16 }}>
        <table>
          <thead><tr>{isHR && <th>Employee</th>}<th>Type</th><th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Status</th><th>Decision</th><th></th></tr></thead>
          <tbody>
            {scoped.map((r) => (
              <tr key={r.id}>
                {isHR && <td>{r.employee?.name}</td>}
                <td>{r.type}</td>
                <td>{r.fromDate}</td>
                <td>{r.toDate}</td>
                <td>{r.days ?? 1}</td>
                <td>{r.reason || '—'}</td>
                <td><StatusPill status={r.status} /></td>
                <td className="small-muted">{r.approvalReason || r.rejectReason || '—'}{r.decidedBy ? ` · ${r.decidedBy}` : ''}</td>
                <td>
                  {isHR && ['Pending', 'Cancellation Requested'].includes(r.status) && (
                    <>
                      <button className="btn btn-sm" onClick={() => decide(r, r.status === 'Cancellation Requested' ? 'Cancelled' : 'Approved')}>{r.status === 'Cancellation Requested' ? 'Confirm Cancel' : 'Approve'}</button>{' '}
                      <button className="btn btn-sm" onClick={() => decide(r, 'Rejected')}>Reject</button>
                    </>
                  )}
                  {!isHR && r.status === 'Approved' && <button className="btn btn-sm" onClick={() => requestCancel(r.id)}>Request Cancellation</button>}
                </td>
              </tr>
            ))}
            {scoped.length === 0 && <tr><td colSpan={isHR ? 9 : 8} className="small-muted">No leave requests yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Reports: the filterable request log plus the remaining/total balance grid.
function ReportsTab() {
  const [requests, setRequests] = useState([]);
  const [balances, setBalances] = useState(null);
  const [filters, setFilters] = useState({ code: '', name: '', department: '' });

  useEffect(() => {
    api.get('/leave').then((res) => setRequests(res.data));
    api.get('/leave/balances').then((res) => setBalances(res.data));
  }, []);

  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const matches = (emp) => (
    (!filters.code || (emp?.employeeCode || '').toLowerCase().includes(filters.code.toLowerCase()))
    && (!filters.name || (emp?.name || '').toLowerCase().includes(filters.name.toLowerCase()))
    && (!filters.department || emp?.department === filters.department)
  );
  const scoped = requests.filter((r) => matches(r.employee));
  const balanceRows = (balances?.rows || []).filter((r) => matches(r));
  const departments = [...new Set(requests.map((r) => r.employee?.department).filter(Boolean))].sort();

  function exportRequests() {
    downloadCsv(
      'leave-requests.csv',
      ['Code', 'Employee', 'Department', 'Type', 'From', 'To', 'Days', 'Status', 'Reason'],
      scoped.map((r) => [r.employee?.employeeCode || '', r.employee?.name || '', r.employee?.department || '', r.type, r.fromDate, r.toDate, r.days ?? 1, r.status, r.reason || ''])
    );
  }

  return (
    <div>
      <div className="filter-row">
        <input placeholder="Employee ID…" value={filters.code} onChange={(e) => set('code', e.target.value)} />
        <input placeholder="Employee name…" value={filters.name} onChange={(e) => set('name', e.target.value)} />
        <select value={filters.department} onChange={(e) => set('department', e.target.value)}>
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d}>{d}</option>)}
        </select>
        <span className="small-muted">{scoped.length} of {requests.length}</span>
        <button className="btn btn-sm btn-primary" onClick={exportRequests}>Export (Excel)</button>
      </div>

      <div className="card section">
        <h3>Leave Requests Report</h3>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Code</th><th>Employee</th><th>Department</th><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Status</th></tr></thead>
            <tbody>
              {scoped.map((r) => (
                <tr key={r.id}>
                  <td>{r.employee?.employeeCode || '—'}</td><td>{r.employee?.name}</td><td>{r.employee?.department || '—'}</td>
                  <td>{r.type}</td><td>{r.fromDate}</td><td>{r.toDate || r.fromDate}</td><td>{r.days ?? 1}</td>
                  <td><StatusPill status={r.status} /></td>
                </tr>
              ))}
              {scoped.length === 0 && <tr><td colSpan="8" className="small-muted">No leave requests yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card section">
        <h3>Leave Balances</h3>
        <div className="small-muted" style={{ marginBottom: 8 }}>Remaining / total — paused leave types are hidden.</div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th><th>Employee</th><th>Department</th>
                {(balances?.types || []).map((t) => <th key={t.code} title={t.name}>{t.code}</th>)}
              </tr>
            </thead>
            <tbody>
              {balanceRows.map((r) => (
                <tr key={r.employeeId}>
                  <td>{r.employeeCode}</td><td>{r.name}</td><td>{r.department || '—'}</td>
                  {r.balances.map((b) => <td key={b.code}>{b.total == null ? '—' : `${b.remaining} / ${b.total}`}</td>)}
                </tr>
              ))}
              {balanceRows.length === 0 && <tr><td colSpan={3 + (balances?.types.length || 0)} className="small-muted">No balances yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function HolidaysTab({ canManage }) {
  const [holidays, setHolidays] = useState([]);
  const [form, setForm] = useState({ name: '', date: '', type: 'Festival' });

  function load() {
    api.get('/leave/holidays').then((res) => setHolidays(res.data));
  }
  useEffect(load, []);

  async function add(e) {
    e.preventDefault();
    await api.post('/leave/holidays', form);
    setForm({ name: '', date: '', type: 'Festival' });
    load();
  }

  async function remove(id) {
    await api.delete(`/leave/holidays/${id}`);
    load();
  }

  const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div>
      {canManage && (
        <form className="filter-row" onSubmit={add}>
          <input required placeholder="Holiday name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option>Festival</option><option>National Holiday</option><option>Optional</option>
          </select>
          <button className="btn btn-sm btn-primary" type="submit">Add holiday</button>
        </form>
      )}
      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Date</th><th>Holiday</th><th>Type</th>{canManage && <th></th>}</tr></thead>
          <tbody>
            {sorted.map((h) => (
              <tr key={h.id}>
                <td>
                  {h.date}{' '}
                  {h.date === today() && <span className="status priority-low">Today</span>}
                  {h.date < today() && <span className="status">Past</span>}
                </td>
                <td>{h.name}</td>
                <td>{h.type || '—'}</td>
                {canManage && <td><button className="btn btn-sm" onClick={() => remove(h.id)}>Remove</button></td>}
              </tr>
            ))}
            {holidays.length === 0 && <tr><td colSpan={canManage ? 4 : 3} className="small-muted">No holidays added yet — add the company holiday calendar for the year.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Leave() {
  const { user } = useAuth();
  const isHR = HR_ROLES.includes(user?.role);
  const canEditPolicy = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role);

  return (
    <TabsPage
      title="Leave & Holidays"
      subtitle="Requests, approvals, balances, leave policy and the holiday calendar"
      tabs={[
        { key: 'dashboard', label: 'Dashboard', element: <DashboardTab isHR={isHR} canEditPolicy={canEditPolicy} /> },
        { key: 'reports', label: 'Reports', element: <ReportsTab /> },
        { key: 'holidays', label: 'Holidays', element: <HolidaysTab canManage={isHR} /> },
      ]}
    />
  );
}
