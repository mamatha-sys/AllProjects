import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';

export default function Employees() {
  const { user } = useAuth();
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({ employeeCode: '', name: '', email: '', department: '', designation: '', role: '', password: '' });
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('');
  const [error, setError] = useState('');

  function load() {
    api.get('/employees').then((res) => setEmployees(res.data)).catch(() => setError("Employees isn't included in your role's permissions"));
  }
  useEffect(load, []);

  async function createEmployee(e) {
    e.preventDefault();
    await api.post('/employees', form);
    setForm({ employeeCode: '', name: '', email: '', department: '', designation: '', role: '', password: '' });
    setShowForm(false);
    load();
  }

  async function transfer(id, currentDept) {
    const department = prompt('Transfer to which department?', currentDept || '');
    if (!department) return;
    const reason = prompt('Reason (optional)') || '';
    await api.post(`/employees/${id}/transfer`, { department, reason });
    load();
  }

  async function toggleLock(id) {
    await api.patch(`/employees/${id}/toggle-lock`);
    load();
  }

  async function togglePause(id) {
    await api.patch(`/employees/${id}/toggle-pause`);
    load();
  }

  async function deleteEmployee(id, name) {
    if (!confirm(`Permanently delete ${name}? This removes their attendance, leave, payslip and other records too. This can't be undone.`)) return;
    await api.delete(`/employees/${id}`);
    load();
  }

  function parseCsv(text) {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (!lines.length) return [];
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    return lines.slice(1).map((line) => {
      const cells = line.split(',');
      const row = {};
      headers.forEach((h, i) => { row[h] = (cells[i] || '').trim(); });
      return row;
    });
  }

  async function runImport() {
    const rows = parseCsv(csvText);
    if (!rows.length) return;
    const res = await api.post('/employees/bulk-import', { rows });
    setImportResult(res.data);
    setCsvText('');
    load();
  }

  const departments = useMemo(() => [...new Set(employees.map((e) => e.department).filter(Boolean))], [employees]);
  const filtered = employees.filter((e) => (!search || e.name.toLowerCase().includes(search.toLowerCase())) && (!dept || e.department === dept));

  const active = employees.filter((e) => e.employmentStatus === 'Active').length;
  const probation = employees.filter((e) => e.employmentStatus === 'On Probation').length;
  const exited = employees.filter((e) => ['Exited', 'Relieved'].includes(e.employmentStatus)).length;
  const avgCompletion = employees.length ? Math.round(employees.reduce((t, e) => t + (e.profileCompletionPct || 0), 0) / employees.length) : 0;

  return (
    <div>
      <div className="page-head">
        <div><h1>Employee Management</h1><div className="page-sub">{employees.length} employees on record</div></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => setShowImport((s) => !s)}>Bulk Import</button>
          <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>{showForm ? 'Cancel' : 'Add Employee'}</button>
        </div>
      </div>

      {error && <div className="error-text">{error}</div>}

      <div className="statbar">
        <div className="statitem"><div className="n">{employees.length}</div><div className="l">Total Employees</div></div>
        <div className="statitem"><div className="n">{active}</div><div className="l">Active</div></div>
        <div className="statitem"><div className="n">{probation}</div><div className="l">On Probation</div></div>
        <div className="statitem"><div className="n">{exited}</div><div className="l">Exited / Relieved</div></div>
        <div className="statitem"><div className="n">{avgCompletion}%</div><div className="l">Avg. Profile Completion</div></div>
      </div>

      {showImport && (
        <div className="card section">
          <h3>Bulk import (CSV)</h3>
          <div className="small-muted" style={{ marginBottom: 8 }}>Header row required. Recognized columns: name, email, phone, department, designation, location. Rows matching an existing employee's email are skipped as duplicates.</div>
          <textarea rows="5" style={{ width: '100%', padding: 8, borderRadius: 7, border: '1px solid var(--line)', fontFamily: 'monospace', fontSize: 12.5 }}
            placeholder={'name,email,phone,department,designation,location\nAsha Rao,asha.rao@example.com,9876543210,IT,Software Engineer,Hyderabad'}
            value={csvText} onChange={(e) => setCsvText(e.target.value)} />
          <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={runImport}>Import</button>
          {importResult && <div className="small-muted" style={{ marginTop: 8 }}>Imported {importResult.imported}, skipped {importResult.skipped} duplicate/invalid row(s).</div>}
        </div>
      )}

      {showForm && (
        <form className="card section" onSubmit={createEmployee}>
          <div className="small-muted" style={{ marginBottom: 10 }}>
            Creates just their login. The employee signs in and fills in the rest of their own profile (personal, address, bank, education) — HR then reviews and approves it.
          </div>
          <div className="grid-2">
            <label className="field"><span>Employee ID (optional — auto if blank)</span><input value={form.employeeCode} onChange={(e) => setForm({ ...form, employeeCode: e.target.value })} /></label>
            <label className="field"><span>Full Name</span><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="field"><span>Department</span><input required value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></label>
            <label className="field">
              <span>Role</span>
              <select required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value, designation: e.target.options[e.target.selectedIndex].text })}>
                <option value="">Select role</option>
                <option value="SUPER_ADMIN">Super Admin</option>
                <option value="ADMIN">HR Admin</option>
                <option value="MANAGER">Manager</option>
                <option value="ASSISTANT_MANAGER">Assistant Manager</option>
                <option value="STL">Senior Team Lead (STL)</option>
                <option value="TL">Team Lead (TL)</option>
                <option value="EMPLOYEE">Employee (Self-Service)</option>
                <option value="ACCOUNTANT">Accountant</option>
              </select>
            </label>
            <label className="field"><span>Email</span><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label className="field"><span>Password</span><input required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
          </div>
          <button className="btn btn-primary btn-sm" type="submit">Create Employee</button>
        </form>
      )}

      <div className="filter-row">
        <input placeholder="Search name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="">All departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Employee</th><th>Code</th><th>Department</th><th>Designation</th><th>Status</th><th>Profile Stage</th><th>Completion</th><th></th></tr></thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} className="row-link">
                <td><Link to={`/employees/${e.id}`}>{e.name}</Link></td>
                <td>{e.employeeCode}</td>
                <td>{e.department || '—'}</td>
                <td>{e.designation || '—'}</td>
                <td><span className={`status ${e.employmentStatus === 'Active' ? 'priority-low' : ['Exited', 'Relieved'].includes(e.employmentStatus) ? 'priority-high' : ''}`}>{e.employmentStatus}</span></td>
                <td><span className={`status ${e.profileStage === 'Locked' ? 'priority-low' : e.profileStage === 'Pending Review' ? 'priority-medium' : ''}`}>{e.profileStage === 'Locked' ? '🔒 Locked' : e.profileStage}</span></td>
                <td>{e.profileCompletionPct}%</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {isAdmin ? (
                    <>
                      {!['Exited', 'Relieved'].includes(e.employmentStatus) && (
                        <>
                          <Link className="btn btn-sm" to={`/employees/${e.id}`}>Edit</Link>{' '}
                          <button className="btn btn-sm" onClick={() => togglePause(e.id)}>{e.employmentStatus === 'On Probation' ? 'Resume' : 'Pause'}</button>{' '}
                          <button className="btn btn-sm" onClick={() => toggleLock(e.id)}>{e.isLocked ? 'Unlock' : 'Lock'}</button>{' '}
                          <button className="btn btn-sm" onClick={() => transfer(e.id, e.department)}>Transfer</button>{' '}
                        </>
                      )}
                      <button className="btn btn-sm" onClick={() => deleteEmployee(e.id, e.name)}>Delete</button>
                    </>
                  ) : (
                    <Link className="btn btn-sm" to={`/employees/${e.id}`}>View</Link>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan="8" className="small-muted">No employees match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
