import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../context/AuthContext.jsx';
import { downloadCsv } from '../../utils/csv.js';

const HR_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANT_MANAGER', 'STL', 'TL'];

function Stat({ n, l, to }) {
  const body = <><div className="n">{n}</div><div className="l">{l}</div></>;
  return to
    ? <Link className="statitem" to={to} style={{ textDecoration: 'none' }}>{body}</Link>
    : <div className="statitem">{body}</div>;
}

function SectionLabel({ children }) {
  return <div className="page-sub" style={{ fontWeight: 700, margin: '16px 0 6px' }}>{children}</div>;
}

// The HR/manager view: every tile, panel and the CSV export are computed by
// /api/hrms/dashboard against the same filtered employee set.
function HrDashboard() {
  const [filters, setFilters] = useState({ department: '', location: '', status: '', manager: '' });
  const [data, setData] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams();
    Object.keys(filters).forEach((k) => { if (filters[k]) params.set(k, filters[k]); });
    api.get(`/hrms/dashboard?${params.toString()}`).then((res) => setData(res.data));
  }, [filters]);

  function exportCsv() {
    downloadCsv(
      'hrms-dashboard-export.csv',
      ['Employee ID', 'Name', 'Department', 'Designation', 'Status'],
      data.exportRows.map((r) => [r.employeeCode, r.name, r.department, r.designation, r.status])
    );
  }

  if (!data) return <div className="small-muted">Loading…</div>;
  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const anyFilter = Object.values(filters).some(Boolean);
  const o = data.filterOptions;

  return (
    <div>
      <div className="filter-row">
        <select value={filters.department} onChange={(e) => set('department', e.target.value)}>
          <option value="">All Departments</option>
          {o.departments.map((d) => <option key={d}>{d}</option>)}
        </select>
        <select value={filters.location} onChange={(e) => set('location', e.target.value)}>
          <option value="">All Locations</option>
          {o.locations.map((l) => <option key={l}>{l}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => set('status', e.target.value)}>
          <option value="">All Employee Statuses</option>
          {o.statuses.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={filters.manager} onChange={(e) => set('manager', e.target.value)}>
          <option value="">All Reporting Managers</option>
          {o.managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        {anyFilter && <button className="btn btn-sm" onClick={() => setFilters({ department: '', location: '', status: '', manager: '' })}>Clear Filters</button>}
        <button className="btn btn-sm btn-primary" onClick={exportCsv}>Export</button>
      </div>

      {data.employeeOverview.total === 0 && (
        <div className="small-muted">No employee records match these filters — the counts below are genuinely zero, not placeholders.</div>
      )}

      <SectionLabel>Employee Overview</SectionLabel>
      <div className="statbar">
        <Stat n={data.employeeOverview.total} l="Total Employees" to="/employees" />
        <Stat n={data.employeeOverview.active} l="Active" />
        <Stat n={data.employeeOverview.newJoiners30d} l="New Joiners (30d)" />
        <Stat n={data.employeeOverview.onLeaveToday} l="On Leave Today" to="/leave" />
        <Stat n={data.employeeOverview.servingNotice} l="Serving Notice" />
        <Stat n={data.employeeOverview.exitProcess} l="Exit Process" />
        <Stat n={data.employeeOverview.relieved} l="Relieved" />
      </div>

      <SectionLabel>Attendance Overview (Today)</SectionLabel>
      <div className="statbar">
        <Stat n={data.attendanceOverview.present} l="Present" to="/attendance" />
        <Stat n={data.attendanceOverview.absent} l="Absent" to="/attendance" />
        <Stat n={data.attendanceOverview.late} l="Late" to="/attendance" />
        <Stat n={data.attendanceOverview.halfDay} l="Half Day" to="/attendance" />
        <Stat n={data.attendanceOverview.missingPunch} l="Missing Punch" to="/attendance" />
        <Stat n={data.attendanceOverview.regularizationPending} l="Regularization Pending" to="/attendance" />
      </div>

      <SectionLabel>Leave Overview</SectionLabel>
      <div className="statbar">
        <Stat n={data.leaveOverview.total} l="Leave Requests" to="/leave" />
        <Stat n={data.leaveOverview.pending} l="Pending Approvals" to="/leave" />
        <Stat n={data.leaveOverview.approved} l="Approved" to="/leave" />
        <Stat n={data.leaveOverview.rejected} l="Rejected" to="/leave" />
        <Stat n={data.leaveOverview.upcoming} l="Upcoming Leaves" to="/leave" />
      </div>

      <SectionLabel>Pending Tasks & Approvals</SectionLabel>
      <div className="statbar">
        <Stat n={data.pendingTasks.leaveApprovals} l="Leave Approvals" to="/leave" />
        <Stat n={data.pendingTasks.attendanceRegularization} l="Attendance Regularization" to="/attendance" />
        <Stat n={data.pendingTasks.assetsAssigned} l="Assets Assigned" to="/employee-services" />
        <Stat n={data.pendingTasks.trainingPending} l="Training Pending" to="/performance" />
        <Stat n={data.pendingTasks.openTargets} l="Open Targets" to="/performance" />
        <Stat n={data.pendingTasks.openTickets} l="Open Tickets" to="/employee-services" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <div className="card">
          <h3 style={{ fontSize: 13, marginBottom: 8 }}>Headcount by Department</h3>
          {data.headcountByDepartment.map((d) => (
            <div className="kv" key={d.department}><span className="k">{d.department}</span><span>{d.employees} employee(s)</span></div>
          ))}
          {data.headcountByDepartment.length === 0 && <div className="small-muted">No employees in scope.</div>}
        </div>
        <div className="card">
          <h3 style={{ fontSize: 13, marginBottom: 8 }}>Birthdays & Anniversaries (next 30 days)</h3>
          {data.celebrations.map((c) => (
            <div className="kv" key={`${c.name}-${c.kind}`}>
              <span className="k">{c.name} <span className="small-muted">— {c.kind}</span></span>
              <span className="small-muted">{String(c.date).slice(0, 10)}</span>
            </div>
          ))}
          {data.celebrations.length === 0 && <div className="small-muted">None in the next 30 days.</div>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <div className="card">
          <h3 style={{ fontSize: 13, marginBottom: 8 }}>Announcements</h3>
          {data.announcements.map((a) => (
            <div className="kv" key={a.id}><span className="k">{a.title} <span className="small-muted">— {a.category || 'General'}</span></span><span className="small-muted">{a.date}</span></div>
          ))}
          {data.announcements.length === 0 && <div className="small-muted">No announcements posted.</div>}
        </div>
        <div className="card">
          <h3 style={{ fontSize: 13, marginBottom: 8 }}>Upcoming Holidays</h3>
          {data.upcomingHolidays.map((h) => (
            <div className="kv" key={h.id}><span className="k">{h.name} <span className="small-muted">— {h.type || 'Holiday'}</span></span><span className="small-muted">{h.date}</span></div>
          ))}
          {data.upcomingHolidays.length === 0 && <div className="small-muted">No upcoming holidays configured.</div>}
        </div>
      </div>
    </div>
  );
}

// The self-service view for employees, who can't read company-wide aggregates.
function MyDashboard() {
  const [attendance, setAttendance] = useState([]);
  const [leave, setLeave] = useState([]);
  const [balances, setBalances] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    api.get('/attendance').then((res) => setAttendance(res.data));
    api.get('/leave').then((res) => setLeave(res.data));
    api.get('/leave/balances').then((res) => setBalances(res.data)).catch(() => setBalances(null));
    api.get('/leave/holidays').then((res) => setHolidays(res.data));
    api.get('/announcements').then((res) => setAnnouncements(res.data));
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const todayRecord = attendance.find((a) => a.date === today);
  const myBalances = balances?.rows?.[0]?.balances || [];

  return (
    <div>
      <SectionLabel>My Day</SectionLabel>
      <div className="statbar">
        <Stat n={todayRecord?.status || 'Not marked'} l="Today's Attendance" to="/attendance" />
        <Stat n={leave.filter((l) => l.status === 'Pending').length} l="Leave Pending" to="/leave" />
        <Stat n={leave.filter((l) => l.status === 'Approved').length} l="Leave Approved" to="/leave" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <div className="card">
          <h3 style={{ fontSize: 13, marginBottom: 8 }}>My Leave Balances</h3>
          {myBalances.map((b) => (
            <div className="kv" key={b.code}><span className="k">{b.type}</span><span>{b.total == null ? '—' : `${b.remaining} / ${b.total}`}</span></div>
          ))}
          {myBalances.length === 0 && <div className="small-muted">No balances configured yet.</div>}
        </div>
        <div className="card">
          <h3 style={{ fontSize: 13, marginBottom: 8 }}>Upcoming Holidays</h3>
          {holidays.filter((h) => h.date >= today).slice(0, 4).map((h) => (
            <div className="kv" key={h.id}><span className="k">{h.name}</span><span className="small-muted">{h.date}</span></div>
          ))}
          {holidays.filter((h) => h.date >= today).length === 0 && <div className="small-muted">None configured.</div>}
        </div>
      </div>

      <div className="card section" style={{ marginTop: 16 }}>
        <h3 style={{ fontSize: 13, marginBottom: 8 }}>Announcements</h3>
        {announcements.slice(0, 3).map((a) => <div className="kv" key={a.id}><span className="k">{a.title}</span><span className="small-muted">{a.date}</span></div>)}
        {announcements.length === 0 && <div className="small-muted">No announcements posted.</div>}
      </div>
    </div>
  );
}

export default function HrmsDashboard() {
  const { user } = useAuth();
  const isHR = HR_ROLES.includes(user?.role);

  return (
    <div>
      <div className="page-head"><div><h1>HRMS Dashboard</h1><div className="page-sub">Employee & workforce management at a glance</div></div></div>

      {isHR ? <HrDashboard /> : <MyDashboard />}

      <div className="card section" style={{ marginTop: 16 }}>
        <h3 style={{ fontSize: 14, marginBottom: 10 }}>Quick Actions</h3>
        <div className="qa-row">
          <Link className="btn btn-sm" to="/attendance">Attendance & Time</Link>
          <Link className="btn btn-sm" to="/leave">Leave & Holidays</Link>
          <Link className="btn btn-sm" to="/payroll">Payroll & Compensation</Link>
          <Link className="btn btn-sm" to="/performance">Performance & Development</Link>
          <Link className="btn btn-sm" to="/employee-services">Employee Services</Link>
          {isHR && <Link className="btn btn-sm" to="/employees">Employee Management</Link>}
          {!isHR && <Link className="btn btn-sm" to="/my-profile">My Profile</Link>}
        </div>
      </div>
    </div>
  );
}
