import { useEffect, useState } from 'react';
import api from '../../api';

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANT_MANAGER', 'STL', 'TL', 'RECRUITER', 'BDE', 'CLIENT', 'ACCOUNTANT', 'EMPLOYEE'];

export default function Users() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'EMPLOYEE' });
  const [showForm, setShowForm] = useState(false);

  function load() {
    api.get('/admin/users').then((res) => setUsers(res.data));
  }
  useEffect(load, []);

  async function createUser(e) {
    e.preventDefault();
    await api.post('/admin/users', form);
    setForm({ name: '', email: '', password: '', role: 'EMPLOYEE' });
    setShowForm(false);
    load();
  }

  async function changeRole(id, role) {
    await api.put(`/admin/users/${id}`, { role });
    load();
  }

  return (
    <div>
      <div className="page-head">
        <h1>Users</h1>
        <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>{showForm ? 'Cancel' : 'Add User'}</button>
      </div>

      {showForm && (
        <form className="card section" onSubmit={createUser}>
          <div className="grid-2">
            <label className="field"><span>Name</span><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="field"><span>Email</span><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label className="field"><span>Password</span><input required type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
            <label className="field">
              <span>Role</span>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => <option key={r}>{r}</option>)}
              </select>
            </label>
          </div>
          <button className="btn btn-primary btn-sm" type="submit">Create user</button>
        </form>
      )}

      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <select value={u.role} onChange={(e) => changeRole(u.id, e.target.value)}>
                    {ROLES.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan="3" className="small-muted">No users yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
