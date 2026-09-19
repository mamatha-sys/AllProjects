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
  const [regularizations, setRegularizations] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    if (isHR) api.get('/employees').then((res) => setEmployees(res.data));
    api.get('/attendance').then((res) => setAttendance(res.data));
    api.get('/leave').then((res) => setLeave(res.data));
    api.get('/attendance/regularizations?status=Pending').then((res) => setRegularizations(res.data));
    api.get('/leave/holidays').then((res) => setHolidays(res.data));
    api.get('/announcements').then((res) => setAnnouncements(res.data));
  }, [isHR]);

  const today = new Date().toISOString().slice(0, 10);
  const todayAttendance = attendance.filter((a) => a.date === today);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const newJoiners = employees.filter((e) => e.dateOfJoining && new Date(e.dateOfJoining) >= thirtyDaysAgo).length;
  const upcomingHolidays = holidays.filter((h) => h.date >= today).slice(0, 4);

  const deptCounts = {};
  employees.forEach((e) => { if (e.department) deptCounts[e.department] = (deptCounts[e.department] || 0) + 1; });

  return (
    <div>
      <div className="page-head"><div><h1>HRMS Dashboard</h1><div className="page-sub">People, attendance, leave and payroll at a glance</div></div></div>

      {isHR && (
        <>
          <div className="page-sub" style={{ fontWeight: 700, marginBottom: 6 }}>Employee Overview</div>
          <div className="statbar">
            <Stat n={employees.length} l="Total Employees" />
            <Stat n={employees.filter((e) => e.employmentStatus === 'Active').length} l="Active" />
            <Stat n={newJoiners} l="New Joiners (30d)" />
            <Stat n={employees.filter((e) => e.employmentStatus === 'Notice Period').length} l="Serving Notice" />
            <Stat n={employees.filter((e) => e.employmentStatus === 'Exit Process').length} l="Exit Process" />
            <Stat n={employees.filter((e) => e.employmentStatus === 'Relieved').length} l="Relieved" />
          </div>
        </>
      )}

      <div className="page-sub" style={{ fontWeight: 700, marginBottom: 6 }}>Attendance Overview (Today)</div>
      <div className="statbar">
        <Stat n={todayAttendance.filter((a) => a.status === 'Present').length} l="Present Today" />
        <Stat n={todayAttendance.filter((a) => a.status === 'Absent').length} l="Absent Today" />
        <Stat n={todayAttendance.filter((a) => a.status === 'Late').length} l="Late Today" />
        <Stat n={regularizations.length} l="Regularization Pending" />
      </div>

      <div className="page-sub" style={{ fontWeight: 700, marginBottom: 6 }}>Leave Overview</div>
      <div className="statbar">
        <Stat n={leave.filter((l) => l.status === 'Pending').length} l="Pending Leave" />
        <Stat n={leave.filter((l) => l.status === 'Approved').length} l="Approved" />
        <Stat n={leave.filter((l) => l.status === 'Cancellation Requested').length} l="Cancellation Requests" />
      </div>

      {isHR && (
        <div className="two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
          <div className="card">
            <h3 style={{ fontSize: 13, marginBottom: 8 }}>Headcount by Department</h3>
            {Object.keys(deptCounts).sort((a, b) => deptCounts[b] - deptCounts[a]).map((d) => (
              <div className="kv" key={d}><span className="k">{d}</span><span>{deptCounts[d]} employee(s)</span></div>
            ))}
            {Object.keys(deptCounts).length === 0 && <div className="small-muted">No employees in scope.</div>}
          </div>
          <div className="card">
            <h3 style={{ fontSize: 13, marginBottom: 8 }}>Upcoming Holidays</h3>
            {upcomingHolidays.map((h) => <div className="kv" key={h.id}><span className="k">{h.name}</span><span>{h.date}</span></div>)}
            {upcomingHolidays.length === 0 && <div className="small-muted">None configured.</div>}
          </div>
        </div>
      )}

      <div className="card section" style={{ marginTop: 16 }}>
        <h3 style={{ fontSize: 13, marginBottom: 8 }}>Announcements</h3>
        {announcements.slice(0, 3).map((a) => <div className="kv" key={a.id}><span className="k">{a.title}</span><span className="small-muted">{a.date}</span></div>)}
        {announcements.length === 0 && <div className="small-muted">No announcements posted.</div>}
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
          {!isHR && <Link className="btn btn-sm" to="/my-profile">My Profile</Link>}
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
