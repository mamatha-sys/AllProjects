import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({ employeeCode: '', name: '', email: '', phone: '', department: '', designation: '', location: '' });
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  function load() {
    api.get('/employees').then((res) => setEmployees(res.data)).catch(() => setError("Employees isn't included in your role's permissions"));
  }
  useEffect(load, []);

  async function createEmployee(e) {
    e.preventDefault();
    await api.post('/employees', form);
    setForm({ employeeCode: '', name: '', email: '', phone: '', department: '', designation: '', location: '' });
    setShowForm(false);
    load();
  }

  return (
    <div>
      <div className="page-head">
        <h1>Employees</h1>
        <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancel' : 'Add Employee'}
        </button>
      </div>

      {error && <div className="error-text">{error}</div>}

      {showForm && (
        <form className="card section" onSubmit={createEmployee}>
          <div className="grid-2">
            <label className="field"><span>Employee Code</span><input required value={form.employeeCode} onChange={(e) => setForm({ ...form, employeeCode: e.target.value })} /></label>
            <label className="field"><span>Name</span><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="field"><span>Email</span><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label className="field"><span>Phone</span><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            <label className="field"><span>Department</span><input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></label>
            <label className="field"><span>Designation</span><input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></label>
            <label className="field"><span>Location</span><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></label>
          </div>
          <button className="btn btn-primary btn-sm" type="submit">Save</button>
        </form>
      )}

      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Code</th><th>Name</th><th>Department</th><th>Designation</th><th>Status</th></tr></thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id} className="row-link">
                <td>{e.employeeCode}</td>
                <td><Link to={`/employees/${e.id}`}>{e.name}</Link></td>
                <td>{e.department || '—'}</td>
                <td>{e.designation || '—'}</td>
                <td><span className="status">{e.employmentStatus}</span></td>
              </tr>
            ))}
            {employees.length === 0 && <tr><td colSpan="5" className="small-muted">No employees yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
