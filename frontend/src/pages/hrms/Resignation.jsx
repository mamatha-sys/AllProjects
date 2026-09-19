import { useEffect, useState } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext.jsx';

const HR_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANT_MANAGER', 'STL', 'TL'];
const TERMINAL = ['Relieved', 'Withdrawn'];

function StatusPill({ status }) {
  const cls = status === 'Relieved' ? 'priority-low' : status === 'Withdrawn' ? 'priority-high' : 'priority-medium';
  return <span className={`status ${cls}`}>{status}</span>;
}

function Stat({ n, l }) {
  return <div className="statitem"><div className="n">{n}</div><div className="l">{l}</div></div>;
}

export default function Resignation() {
  const { user } = useAuth();
  const isHR = HR_ROLES.includes(user?.role);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({ employeeId: '', title: '', detail: '', resignationDate: new Date().toISOString().slice(0, 10) });
  const [error, setError] = useState('');

  function load() {
    api.get('/resignations').then((res) => setRows(res.data));
    if (isHR) {
      api.get('/resignations/summary').then((res) => setSummary(res.data)).catch(() => setSummary(null));
      api.get('/employees').then((res) => setEmployees(res.data)).catch(() => setEmployees([]));
    }
  }
  useEffect(load, [isHR]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      const payload = { title: form.title, detail: form.detail, resignationDate: form.resignationDate };
      if (isHR) payload.employeeId = form.employeeId;
      await api.post('/resignations', payload);
      setForm({ ...form, title: '', detail: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not record the resignation');
    }
  }

  async function setStatus(record, status) {
    setError('');
    try {
      await api.patch(`/resignations/${record.id}/status`, { status });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not change the status');
    }
  }

  // Early release or an extension — HR agrees a different last working day.
  async function editLastWorkingDay(record) {
    const v = prompt('Agreed last working day (YYYY-MM-DD)', record.lastWorkingDate || '');
    if (v === null) return;
    await api.patch(`/resignations/${record.id}`, { date: v });
    load();
  }

  const noticeDays = summary?.noticePeriodDays ?? rows[0]?.noticePeriodDays ?? 45;

  return (
    <div>
      <div className="page-sub" style={{ marginBottom: 8 }}>Notice period, last working day, exit checklist and relieving.</div>

      {isHR && summary && (
        <div className="statbar">
          <Stat n={summary.servingNotice} l="Serving Notice" />
          <Stat n={summary.relieved} l="Relieved" />
          <Stat n={summary.withdrawn} l="Withdrawn" />
          <Stat n={summary.noticePeriodDays} l="Notice Period (days)" />
        </div>
      )}

      <form className="card section" onSubmit={submit}>
        <h3>Record a resignation</h3>
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
          <label className="field"><span>Reason</span><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label className="field"><span>Notes</span><input value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} /></label>
          <label className="field"><span>Resignation date</span><input type="date" value={form.resignationDate} onChange={(e) => setForm({ ...form, resignationDate: e.target.value })} /></label>
        </div>
        <div className="small-muted">
          The last working day is the resignation date plus the {noticeDays}-day notice period. HR can agree a different date afterwards.
        </div>
        {error && <div className="error-text">{error}</div>}
        <button className="btn btn-primary btn-sm" type="submit">Record resignation</button>
      </form>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div className="card">
          <h3 style={{ fontSize: 13, marginBottom: 8 }}>Resignations</h3>
          <div className="small-muted" style={{ marginBottom: 8 }}>
            Resigning never disables the login on its own — payslips and documents stay available until HR pauses the account.
          </div>
          <div className="tbl-wrap">
            <table>
              <thead><tr>{isHR && <th>Employee</th>}<th>Reason</th><th>Submitted</th><th>Last Working Day</th><th>Days Left</th><th>Status</th>{isHR && <th></th>}</tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    {isHR && <td>{r.employee?.name}<div className="small-muted">{r.employee?.department || '—'}</div></td>}
                    <td>{r.reason}<div className="small-muted">{r.notes || '—'}</div></td>
                    <td>{r.submittedAt ? String(r.submittedAt).slice(0, 10) : '—'}</td>
                    <td>{r.lastWorkingDate || '—'}</td>
                    <td>{r.daysLeft == null ? '—' : r.daysLeft >= 0 ? `${r.daysLeft} day(s)` : 'past'}</td>
                    <td><StatusPill status={r.status} /></td>
                    {isHR && (
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {r.status === 'Notice Period' && <><button className="btn btn-sm" onClick={() => setStatus(r, 'Accepted')}>Accept</button>{' '}</>}
                        {!TERMINAL.includes(r.status) && <><button className="btn btn-sm" onClick={() => setStatus(r, 'Relieved')}>Relieve</button>{' '}</>}
                        {!TERMINAL.includes(r.status) && <><button className="btn btn-sm" onClick={() => setStatus(r, 'Withdrawn')}>Withdraw</button>{' '}</>}
                        {!TERMINAL.includes(r.status) && <button className="btn btn-sm" onClick={() => editLastWorkingDay(r)}>Edit LWD</button>}
                      </td>
                    )}
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={isHR ? 7 : 5} className="small-muted">No resignations on file.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: 13, marginBottom: 8 }}>Exit Checklist</h3>
          {(summary?.exitChecklist || ['Exit interview scheduled', 'Assets returned', 'Access revoked', 'Full & final settlement processed', 'Experience letter issued']).map((item) => (
            <div className="kv" key={item}><span className="k">{item}</span><span className="small-muted">per exit</span></div>
          ))}
          <div className="small-muted" style={{ marginTop: 8 }}>
            The same checklist drives the offboarding tracker on each employee's record. Relieving raises the Full &amp; Final settlement request on the Payroll screen.
          </div>
        </div>
      </div>
    </div>
  );
}
