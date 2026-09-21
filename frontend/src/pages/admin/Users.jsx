import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import Modal from '../../components/Modal.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { ATS_ROLE_LABELS, atsRoleLabel, DEPTS } from '../../atsVocab';

// Users / Employee Management (the prototype's usersView, line 9893).
//
// One employee = one user = one login. Granting access never creates a second
// identity: the "Create login" form picks an employee who has none yet and
// attaches a login to that same record.
//
// ROLE MODEL — READ THIS BEFORE EXTENDING.
// The prototype gives each login THREE independent product roles on the same
// account (hrmsRole / atsRole / accountsRole) and renders three inline selects
// per row. Main carries a single User.role, and splitting it touches every
// guard, route and screen, so it is deliberately deferred. Here, therefore:
//   * the one editable select per row is `role`;
//   * the HRMS / ATS / Accounts columns are DERIVED and read-only, computed by
//     backend/src/utils/roleAccess.js (PRODUCT_ACCESS).
// When the three-role split lands, replace the single <select> below with three
// (one per product, calling changeRole with the matching field) and drop the
// derived `productAccess` columns — the rest of this screen is unaffected.

const ROLES = Object.keys(ATS_ROLE_LABELS);
const STATUSES = ['Active', 'Inactive', 'Suspended'];

const EMPTY_FORM = {
  employeeId: '', name: '', email: '', username: '', password: '',
  role: 'EMPLOYEE', atsDepartment: '', branch: '', team: '', status: 'Active', clientId: '',
};

function statusClass(status) {
  if (status === 'Active') return 'priority-low';
  if (status === 'Suspended') return 'priority-high';
  return 'priority-medium';
}

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [freeEmployees, setFreeEmployees] = useState([]);
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [filters, setFilters] = useState({ q: '', role: '', status: '', department: '' });
  const [resetFor, setResetFor] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  // Branch / team / scope are read-only text in the table (as in the prototype);
  // this modal is where main's inline editing of them moved to.
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  function load() {
    api.get('/admin/users').then((res) => setUsers(res.data)).catch(() => setError('Could not load users.'));
    api.get('/admin/users/employees-without-login').then((res) => setFreeEmployees(res.data)).catch(() => setFreeEmployees([]));
  }
  useEffect(() => {
    load();
    api.get('/clients').then((res) => setClients(res.data)).catch(() => setClients([]));
  }, []);

  const rows = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return users.filter((u) => {
      if (filters.role && u.role !== filters.role) return false;
      if (filters.status && u.status !== filters.status) return false;
      if (filters.department && u.department !== filters.department) return false;
      if (q && !`${u.name} ${u.email} ${u.employeeId || ''} ${u.username || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [users, filters]);

  async function run(fn, successMessage) {
    setError(''); setNotice('');
    try {
      await fn();
      if (successMessage) setNotice(successMessage);
      load();
      return true;
    } catch (err) {
      setError(err.response?.data?.error || 'That change could not be saved.');
      return false;
    }
  }

  function changeRole(u, role) {
    // The change lands on the user's next login — it never creates a second account.
    run(() => api.put(`/admin/users/${u.id}`, { role }),
      `${u.name} — role: ${atsRoleLabel(u.role)} → ${atsRoleLabel(role)} (same login, no new account).`);
  }

  async function saveEditing() {
    const ok = await run(
      () => api.put(`/admin/users/${editing.id}`, { branch: editing.branch, team: editing.team, atsDepartment: editing.atsDepartment || null }),
      `${editing.name} updated.`,
    );
    if (ok) setEditing(null);
  }

  function toggleStatus(u) {
    run(() => api.post(`/admin/users/${u.id}/toggle-status`),
      `${u.name} — login ${u.status === 'Active' ? 'disabled' : 'enabled'}.`);
  }

  async function submitReset(e) {
    e.preventDefault();
    const ok = await run(() => api.post(`/admin/users/${resetFor.id}/reset-password`, { password: resetPassword }),
      `Password reset for ${resetFor.name}. Share it with them out of band — it is never shown again.`);
    if (ok) { setResetFor(null); setResetPassword(''); }
  }

  // Picking the employee fills their details; this form only decides what they
  // can reach — the prototype's auFill().
  function pickEmployee(id) {
    const emp = freeEmployees.find((e) => e.id === id);
    if (!emp) { set({ employeeId: '' }); return; }
    set({
      employeeId: id,
      name: emp.name,
      email: emp.email || '',
      username: emp.email || emp.name.toLowerCase().replace(/[^a-z]+/g, '.'),
      atsDepartment: emp.department || '',
      branch: emp.branch || emp.location || '',
      team: emp.team || '',
    });
  }

  async function createUser(e) {
    e.preventDefault();
    const ok = await run(
      () => api.post('/admin/users', { ...form, clientId: form.role === 'CLIENT' ? form.clientId : undefined }),
      `${form.name} — login created with the ${atsRoleLabel(form.role)} role.`,
    );
    if (ok) { setForm(EMPTY_FORM); setShowForm(false); }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Users</h1>
          <div className="page-sub">
            One employee = one user = one login. HRMS, ATS and Accounts roles are independent on the same account.
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancel' : 'Add User'}
        </button>
      </div>

      {error && <div className="error-text">{error}</div>}
      {notice && <div className="card section" style={{ marginBottom: 14 }}>{notice}</div>}

      {showForm && (
        <form className="card section" onSubmit={createUser}>
          <h3>Grant access to an existing employee</h3>
          <div className="small-muted" style={{ marginBottom: 12 }}>
            {freeEmployees.length
              ? 'Access for an existing employee — no second login is created.'
              : 'Every employee already has a login. You can still create a standalone login (e.g. a client contact) below.'}
          </div>
          <div className="grid-2">
            <label className="field"><span>Employee</span>
              <select value={form.employeeId} onChange={(e) => pickEmployee(e.target.value)}>
                <option value="">— standalone login (no employee record) —</option>
                {freeEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name} — {emp.employeeCode}</option>
                ))}
              </select></label>
            <label className="field"><span>Full name *</span>
              <input required value={form.name} onChange={(e) => set({ name: e.target.value })} /></label>
            <label className="field"><span>Email *</span>
              <input required type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} /></label>
            <label className="field"><span>Username</span>
              <input value={form.username} onChange={(e) => set({ username: e.target.value })} placeholder="filled from the email" /></label>
            <label className="field"><span>Temporary password *</span>
              <input required type="password" minLength="6" value={form.password} onChange={(e) => set({ password: e.target.value })} /></label>
            <label className="field"><span>Role *</span>
              <select value={form.role} onChange={(e) => set({ role: e.target.value })}>
                {ROLES.map((r) => <option key={r} value={r}>{atsRoleLabel(r)}</option>)}
              </select></label>
            <label className="field"><span>Department scope</span>
              <select value={form.atsDepartment} onChange={(e) => set({ atsDepartment: e.target.value })}>
                <option value="">All departments</option>
                {DEPTS.map((d) => <option key={d}>{d}</option>)}
              </select></label>
            <label className="field"><span>Branch</span>
              <input value={form.branch} onChange={(e) => set({ branch: e.target.value })} /></label>
            <label className="field"><span>Team</span>
              <input value={form.team} onChange={(e) => set({ team: e.target.value })} placeholder="e.g. Section A" /></label>
            <label className="field"><span>Status</span>
              <select value={form.status} onChange={(e) => set({ status: e.target.value })}>
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select></label>
            {form.role === 'CLIENT' && (
              <label className="field"><span>Client *</span>
                <select required value={form.clientId} onChange={(e) => set({ clientId: e.target.value })}>
                  <option value="">—</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <span className="small-muted">A Client login sees only this company.</span></label>
            )}
          </div>
          <button className="btn btn-primary btn-sm" type="submit">Grant access</button>
        </form>
      )}

      {resetFor && (
        <form className="card section" onSubmit={submitReset}>
          <h3>Reset password — {resetFor.name}</h3>
          <div className="grid-2">
            <label className="field"><span>New password *</span>
              <input required type="password" minLength="6" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} /></label>
          </div>
          <div className="small-muted" style={{ marginBottom: 10 }}>
            The password is stored hashed and never shown again — pass it to the user yourself.
          </div>
          <button className="btn btn-primary btn-sm" type="submit">Reset password</button>{' '}
          <button className="btn btn-sm" type="button" onClick={() => { setResetFor(null); setResetPassword(''); }}>Cancel</button>
        </form>
      )}

      <div className="filter-row" style={{ flexWrap: 'wrap' }}>
        <input
          type="text" placeholder="Search name, email, employee ID…"
          value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
        />
        <select value={filters.role} onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value }))}>
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{atsRoleLabel(r)}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={filters.department} onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value }))}>
          <option value="">All departments</option>
          {DEPTS.map((d) => <option key={d}>{d}</option>)}
        </select>
        <button className="btn btn-sm" onClick={() => setFilters({ q: '', role: '', status: '', department: '' })}>Clear</button>
        <span className="small-muted">{rows.length} login(s)</span>
      </div>

      <div className="tbl-wrap">
        <table>
          <thead>
            {/* The prototype's fifteen columns, in its order (usersView, line
                9911). Username, Role and Actions are main-only and appended. */}
            <tr>
              <th>User ID</th><th>Employee ID</th><th>Employee Name</th>
              <th>Department</th><th>Branch</th><th>Team</th>
              <th>HRMS Role</th><th>ATS Role</th><th>Accounts Role</th>
              <th>Status</th><th>Scope</th><th>Assigned Clients</th>
              <th>Assigned Requirements</th><th>Assigned Team</th><th>Last Login</th>
              <th>Username</th><th>Role</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td><b>{u.id.slice(-6).toUpperCase()}</b></td>
                <td className="small-muted">{u.employeeId || '—'}</td>
                <td className="row-link">
                  {u.employeeRecordId
                    ? <Link to={`/employees/${u.employeeRecordId}`}>{u.name}</Link>
                    : u.name}
                  <div className="small-muted" style={{ fontSize: 11 }}>{u.email}</div>
                </td>
                <td className="cell-muted">{u.department || '—'}</td>
                <td className="cell-muted">{u.branch || '—'}</td>
                <td className="cell-muted">{u.team || '—'}</td>
                {/* The prototype has three editable selects here. Main stores one
                    role, so these three show its derived product access and the
                    editable select is the appended "Role" column. */}
                <td><select style={{ minWidth: 120 }} value={u.productAccess?.hrms || 'No Access'} disabled readOnly><option>{u.productAccess?.hrms || 'No Access'}</option></select></td>
                <td><select style={{ minWidth: 120 }} value={u.productAccess?.ats || 'No Access'} disabled readOnly><option>{u.productAccess?.ats || 'No Access'}</option></select></td>
                <td><select style={{ minWidth: 120 }} value={u.productAccess?.accounts || 'No Access'} disabled readOnly><option>{u.productAccess?.accounts || 'No Access'}</option></select></td>
                <td><span className={'status ' + statusClass(u.status)}>{u.status}</span></td>
                <td className="cell-muted">{u.scope}</td>
                <td className="cell-muted">{u.assignedClients?.length ? u.assignedClients.join(', ') : '—'}</td>
                <td className="cell-muted">{u.assignedRequirements}</td>
                <td className="cell-muted">{u.team || u.atsDepartment || '—'}</td>
                <td className="cell-muted">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '—'}</td>
                <td className="cell-muted">{u.username || '—'}</td>
                <td>
                  <select style={{ minWidth: 130 }} value={u.role} onChange={(e) => changeRole(u, e.target.value)}>
                    {ROLES.map((r) => <option key={r} value={r}>{atsRoleLabel(r)}</option>)}
                  </select>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn btn-sm" onClick={() => setEditing({ id: u.id, name: u.name, branch: u.branch || '', team: u.team || '', atsDepartment: u.atsDepartment || '' })}>Edit</button>{' '}
                  <button className="btn btn-sm" disabled={u.id === me?.id} onClick={() => toggleStatus(u)}>
                    {u.status === 'Active' ? 'Disable' : 'Enable'}
                  </button>{' '}
                  <button className="btn btn-sm btn-ghost" onClick={() => { setResetFor(u); setResetPassword(''); }}>
                    Reset password
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="18" className="small-muted" style={{ padding: 16 }}>No logins match these filters.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="notice" style={{ marginTop: 14 }}>
        Changing a role here takes effect on that user&apos;s next login — it never creates a second account.
        An employee created in HRMS is linked to a user automatically; assigning an ATS or Accounts role adds
        product access to that same login. HRMS, ATS and Accounts are shown here derived from the single stored
        role; they become independently editable when the three-role split lands.
      </div>

      {editing && (
        <Modal
          title={`Edit — ${editing.name}`}
          onClose={() => setEditing(null)}
          foot={<>
            <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveEditing}>Save</button>
          </>}
        >
          <div className="field"><label>Branch</label>
            <input value={editing.branch} onChange={(e) => setEditing({ ...editing, branch: e.target.value })} /></div>
          <div className="field"><label>Assigned team</label>
            <input value={editing.team} onChange={(e) => setEditing({ ...editing, team: e.target.value })} placeholder="e.g. Section A" /></div>
          <div className="field"><label>ATS department scope</label>
            <select value={editing.atsDepartment} onChange={(e) => setEditing({ ...editing, atsDepartment: e.target.value })}>
              <option value="">All departments</option>
              {DEPTS.map((d) => <option key={d}>{d}</option>)}
            </select></div>
        </Modal>
      )}
    </div>
  );
}
