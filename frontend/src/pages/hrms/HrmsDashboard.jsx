import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../context/AuthContext.jsx';

const HR_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANT_MANAGER', 'STL', 'TL'];

export default function HrmsDashboard() {
  const { user } = useAuth();
  const isHR = HR_ROLES.includes(user?.role);
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [leave, setLeave] = useState([]);

  useEffect(() => {
    if (isHR) api.get('/employees').then((res) => setEmployees(res.data));
    api.get('/attendance').then((res) => setAttendance(res.data));
    api.get('/leave').then((res) => setLeave(res.data));
  }, [isHR]);

  const today = new Date().toISOString().slice(0, 10);
  const todayAttendance = attendance.filter((a) => a.date === today);

  return (
    <div>
      <div className="page-head"><div><h1>HRMS Dashboard</h1><div className="page-sub">People, attendance, leave and payroll at a glance</div></div></div>

      {isHR && (
        <div className="statbar">
          <Stat n={employees.length} l="Total Employees" />
          <Stat n={employees.filter((e) => e.employmentStatus === 'Active').length} l="Active" />
          <Stat n={employees.filter((e) => e.employmentStatus === 'Notice Period').length} l="Notice Period" />
          <Stat n={employees.filter((e) => e.employmentStatus === 'Exit Process').length} l="Exit Process" />
          <Stat n={employees.filter((e) => e.employmentStatus === 'Relieved').length} l="Relieved" />
        </div>
      )}

      <div className="statbar">
        <Stat n={todayAttendance.filter((a) => a.status === 'Present').length} l="Present Today" />
        <Stat n={todayAttendance.filter((a) => a.status === 'Absent').length} l="Absent Today" />
        <Stat n={todayAttendance.filter((a) => a.status === 'Late').length} l="Late Today" />
        <Stat n={leave.filter((l) => l.status === 'Pending').length} l="Pending Leave" />
      </div>

      <div className="card section">
        <h3 style={{ fontSize: 14, marginBottom: 10 }}>Quick Actions</h3>
        <div className="qa-row">
          <Link className="btn btn-sm" to="/attendance">Attendance & Time</Link>
          <Link className="btn btn-sm" to="/leave">Leave & Holidays</Link>
          <Link className="btn btn-sm" to="/payroll">Payroll & Compensation</Link>
          <Link className="btn btn-sm" to="/performance">Performance & Development</Link>
          <Link className="btn btn-sm" to="/employee-services">Employee Services</Link>
          {isHR && <Link className="btn btn-sm" to="/employees">Employee Directory</Link>}
        </div>
      </div>
    </div>
  );
}

function Stat({ n, l }) {
  return (
    <div className="statitem">
      <div className="n">{n}</div>
      <div className="l">{l}</div>
    </div>
  );
}
