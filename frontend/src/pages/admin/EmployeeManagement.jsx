import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';

const STATUSES = ['Active', 'On Probation', 'Notice Period', 'Exit Process', 'Relieved', 'Exited'];

const emptyAddForm = { employeeCode: '', name: '', department: '', role: '', email: '', password: '' };

export default function EmployeeManagement() {
  const [employees, setEmployees] = useState([]);
  const [users, setUsers] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(emptyAddForm);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [error, setError] = useState('');

  function load() {
    const params = new URLSearchParams();
    if (filterDept) params.set('department', filterDept);
    if (filterStatus) params.set('employmentStatus', filterStatus);
    api.get(`/employees?${params.toString()}`).then((res) => setEmployees(res.data));
  }
  useEffect(load, [filterDept, filterStatus]);
  useEffect(() => {
    api.get('/admin/users').then((res) => setUsers(res.data));
  }, []);

  async function createEmployee(e) {
    e.preventDefault();
    await api.post('/employees', { ...addForm, designation: addForm.role ? roleLabel(addForm.role) : undefined });
    setAddForm(emptyAddForm);
    setShowAdd(false);
    load();
  }

  function roleLabel(value) {
    const map = { SUPER_ADMIN: 'Super Admin', ADMIN: 'HR Admin', MANAGER: 'Manager', ASSISTANT_MANAGER: 'Assistant Manager', STL: 'Senior Team Lead (STL)', TL: 'Team Lead (TL)', EMPLOYEE: 'Employee (Self-Service)', ACCOUNTANT: 'Accountant' };
    return map[value] || value;
  }

  function startEdit(emp) {
    setEditingId(emp.id);
    setEditForm({
      name: emp.name, email: emp.email || '', phone: emp.phone || '',
      department: emp.department || '', designation: emp.designation || '', location: emp.location || '',
      employmentStatus: emp.employmentStatus, reportingManagerId: emp.reportingManagerId || '', userId: emp.userId || '',
    });
  }

  async function saveEdit(id) {
    setError('');
    try {
      await api.put(`/employees/${id}`, editForm);
      await api.put(`/employees/${id}/manager`, { reportingManagerId: editForm.reportingManagerId || null });
      await api.put(`/employees/${id}/link-user`, { userId: editForm.userId || null });
      setEditingId(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save changes');
    }
  }

  const departments = [...new Set(employees.map((e) => e.department).filter(Boolean))];
  const linkedUserIds = new Set(employees.map((e) => e.userId).filter(Boolean));
  const needsAttention = (emp) => !!emp.pendingChanges || emp.unlockRequestStatus === 'Pending';

  return (
    <div>
      <div className="page-head">
        <div><h1>Employee Management</h1><div className="page-sub">Full employee records, status, reporting lines and login access</div></div>
        <button className="btn btn-primary" onClick={() => setShowAdd((s) => !s)}>{showAdd ? 'Cancel' : 'Add Employee'}</button>
      </div>

      <div className="filter-row">
        <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
          <option value="">All departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      {showAdd && (
        <form className="card section" onSubmit={createEmployee}>
          <h3>New employee</h3>
          <div className="small-muted" style={{ marginBottom: 10 }}>
            Creates just their login. The employee signs in and fills in the rest of their own profile — HR then reviews and approves it.
          </div>
          <div className="grid-2">
            <label className="field"><span>Employee ID (optional — auto if blank)</span><input value={addForm.employeeCode} onChange={(e) => setAddForm({ ...addForm, employeeCode: e.target.value })} /></label>
            <label className="field"><span>Name</span><input required value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} /></label>
            <label className="field"><span>Department</span><input required value={addForm.department} onChange={(e) => setAddForm({ ...addForm, department: e.target.value })} /></label>
            <label className="field">
              <span>Role</span>
              <select required value={addForm.role} onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}>
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
            <label className="field"><span>Email</span><input required type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} /></label>
            <label className="field"><span>Password</span><input required type="password" value={addForm.password} onChange={(e) => setAddForm({ ...addForm, password: e.target.value })} /></label>
          </div>
          <button className="btn btn-primary btn-sm" type="submit">Save</button>
        </form>
      )}

      {error && <div className="error-text">{error}</div>}

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr><th>Code</th><th>Name</th><th>Department</th><th>Designation</th><th>Status</th><th>Profile Stage</th><th>Reports To</th><th>Login Account</th><th></th></tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              editingId === emp.id ? (
                <tr key={emp.id}>
                  <td colSpan="9">
                    <div className="grid-2" style={{ margin: '8px 0' }}>
                      <label className="field"><span>Name</span><input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></label>
                      <label className="field"><span>Email</span><input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /></label>
                      <label className="field"><span>Phone</span><input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></label>
                      <label className="field"><span>Department</span><input value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })} /></label>
                      <label className="field"><span>Designation</span><input value={editForm.designation} onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })} /></label>
                      <label className="field"><span>Location</span><input value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} /></label>
                      <label className="field">
                        <span>Employment Status</span>
                        <select value={editForm.employmentStatus} onChange={(e) => setEditForm({ ...editForm, employmentStatus: e.target.value })}>
                          {STATUSES.map((s) => <option key={s}>{s}</option>)}
                        </select>
                      </label>
                      <label className="field">
                        <span>Reporting Manager</span>
                        <select value={editForm.reportingManagerId} onChange={(e) => setEditForm({ ...editForm, reportingManagerId: e.target.value })}>
                          <option value="">No manager</option>
                          {employees.filter((m) => m.id !== emp.id).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      </label>
                      <label className="field">
                        <span>Login Account</span>
                        <select value={editForm.userId} onChange={(e) => setEditForm({ ...editForm, userId: e.target.value })}>
                          <option value="">No login linked</option>
                          {users.filter((u) => !linkedUserIds.has(u.id) || u.id === emp.userId).map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                        </select>
                      </label>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => saveEdit(emp.id)}>Save</button>{' '}
                    <button className="btn btn-sm btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
                  </td>
                </tr>
              ) : (
                <tr key={emp.id}>
                  <td>{emp.employeeCode}</td>
                  <td><Link to={`/employees/${emp.id}`}>{emp.name}</Link></td>
                  <td>{emp.department || '—'}</td>
                  <td>{emp.designation || '—'}</td>
                  <td><span className={`status ${emp.employmentStatus === 'Active' ? 'priority-low' : ['Exited', 'Relieved'].includes(emp.employmentStatus) ? 'priority-high' : ''}`}>{emp.employmentStatus}</span></td>
                  <td>
                    <span className={`status ${emp.profileStage === 'Locked' ? 'priority-low' : emp.profileStage === 'Pending Review' ? 'priority-medium' : ''}`}>
                      {emp.profileStage === 'Locked' ? '🔒 Locked' : emp.profileStage}
                    </span>
                    {emp.unlockRequestStatus === 'Pending' && <div className="small-muted" style={{ marginTop: 2 }}>Edit access requested</div>}
                  </td>
                  <td>{emp.reportingManager?.name || '—'}</td>
                  <td>{emp.userId ? <span className="status priority-low">Linked</span> : <span className="small-muted">None</span>}</td>
                  <td>
                    {needsAttention(emp)
                      ? <Link className="btn btn-sm btn-primary" to={`/employees/${emp.id}`}>Review</Link>
                      : <button className="btn btn-sm" onClick={() => startEdit(emp)}>Edit</button>}
                  </td>
                </tr>
              )
            ))}
            {employees.length === 0 && <tr><td colSpan="9" className="small-muted">No employees match this filter.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
