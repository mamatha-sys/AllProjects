import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api';

export default function EmployeeDetail() {
  const { id } = useParams();
  const [employee, setEmployee] = useState(null);

  useEffect(() => {
    api.get(`/employees/${id}`).then((res) => setEmployee(res.data));
  }, [id]);

  if (!employee) return <div className="small-muted">Loading…</div>;

  return (
    <div>
      <Link className="small-muted" to="/employees">← Back to employees</Link>
      <div className="page-head" style={{ marginTop: 10 }}>
        <h1>{employee.name}</h1>
        <span className="status">{employee.employmentStatus}</span>
      </div>
      <div className="card">
        <div className="kv"><span className="k">Employee Code</span><span>{employee.employeeCode}</span></div>
        <div className="kv"><span className="k">Email</span><span>{employee.email || '—'}</span></div>
        <div className="kv"><span className="k">Phone</span><span>{employee.phone || '—'}</span></div>
        <div className="kv"><span className="k">Department</span><span>{employee.department || '—'}</span></div>
        <div className="kv"><span className="k">Designation</span><span>{employee.designation || '—'}</span></div>
        <div className="kv"><span className="k">Location</span><span>{employee.location || '—'}</span></div>
        <div className="kv"><span className="k">Date of Joining</span><span>{employee.dateOfJoining ? new Date(employee.dateOfJoining).toLocaleDateString() : '—'}</span></div>
      </div>
    </div>
  );
}
