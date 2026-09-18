import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const HR_MANAGE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANT_MANAGER', 'STL', 'TL'];
const ATS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANT_MANAGER', 'STL', 'TL', 'RECRUITER', 'BDE', 'CLIENT'];
const ACCOUNTS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'CLIENT'];
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];
const REPORTS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];

const HR_MANAGE_ITEMS = [
  { to: '/employees', label: 'Employees' },
  { to: '/attendance', label: 'Attendance' },
  { to: '/leave', label: 'Leave' },
  { to: '/payroll', label: 'Payroll' },
  { to: '/performance', label: 'Performance' },
  { to: '/lms', label: 'Learning (LMS)' },
  { to: '/hrms/kt', label: 'Knowledge Transfer' },
  { to: '/hrms/targets', label: 'Targets' },
  { to: '/hrms/resignation', label: 'Resignation' },
  { to: '/hrms/org-structure', label: 'Org Structure' },
  { to: '/hrms/recognition', label: 'Recognition' },
  { to: '/projects', label: 'Projects' },
  { to: '/hrms/disciplinary', label: 'Disciplinary' },
  { to: '/surveys', label: 'Surveys' },
  { to: '/documents', label: 'Documents' },
  { to: '/hrms/shift-roster', label: 'Shift Roster' },
  { to: '/hrms/timesheet', label: 'Timesheet' },
  { to: '/hrms/assets', label: 'Assets' },
  { to: '/hrms/expenses', label: 'Expenses' },
  { to: '/hrms/helpdesk', label: 'Helpdesk' },
  { to: '/hrms/access-management', label: 'Access Management' },
  { to: '/announcements', label: 'Announcements' },
  { to: '/hrms/weekly-ideas', label: 'Weekly Ideas' },
];

const HR_SELF_SERVICE_ITEMS = [
  { to: '/attendance', label: 'Attendance' },
  { to: '/leave', label: 'Leave' },
  { to: '/payroll', label: 'Payroll / Payslips' },
  { to: '/performance', label: 'Performance' },
  { to: '/lms', label: 'Learning (LMS)' },
  { to: '/hrms/kt', label: 'Knowledge Transfer' },
  { to: '/hrms/targets', label: 'Targets' },
  { to: '/hrms/resignation', label: 'Resignation' },
  { to: '/hrms/recognition', label: 'Recognition' },
  { to: '/surveys', label: 'Surveys' },
  { to: '/documents', label: 'Documents' },
  { to: '/hrms/shift-roster', label: 'Shift Roster' },
  { to: '/hrms/timesheet', label: 'Timesheet' },
  { to: '/hrms/assets', label: 'My Assets' },
  { to: '/hrms/expenses', label: 'Expense Claims' },
  { to: '/hrms/helpdesk', label: 'Helpdesk' },
  { to: '/hrms/access-management', label: 'Access Requests' },
  { to: '/announcements', label: 'Announcements' },
  { to: '/hrms/weekly-ideas', label: 'Weekly Ideas' },
];

function groupsForRole(role) {
  const groups = [];
  if (HR_MANAGE_ROLES.includes(role)) {
    groups.push({ label: 'HRMS', items: HR_MANAGE_ITEMS });
  } else if (role === 'EMPLOYEE') {
    groups.push({ label: 'HRMS', items: HR_SELF_SERVICE_ITEMS });
  }
  if (ATS_ROLES.includes(role)) {
    groups.push({
      label: 'ATS',
      items: [
        { to: '/requirements', label: 'Requirements' },
        { to: '/clients', label: 'Clients' },
        { to: '/candidates', label: 'Candidates' },
        { to: '/ats/team', label: 'Recruiter & BDE' },
        { to: '/ats/calendar', label: 'Interview Calendar' },
      ],
    });
  }
  if (ACCOUNTS_ROLES.includes(role)) {
    groups.push({
      label: 'Accounts',
      items: [
        { to: '/invoices', label: 'Invoices' },
        { to: '/office', label: 'Office / Business' },
        { to: '/bank', label: 'Bank & Reconciliation' },
      ],
    });
  }
  if (REPORTS_ROLES.includes(role)) {
    groups.push({
      label: 'Reports',
      items: [
        { to: '/reports/ats', label: 'ATS Reports' },
        { to: '/reports/job-portal', label: 'Job Portal Reports' },
        { to: '/reports/accounts', label: 'Accounts Reports' },
      ],
    });
  }
  if (ADMIN_ROLES.includes(role)) {
    groups.push({
      label: 'Administration',
      items: [
        { to: '/admin/company', label: 'Company Setup' },
        { to: '/admin/users', label: 'Users' },
        { to: '/admin/roles', label: 'Role Catalog' },
        { to: '/admin/integrations', label: 'Integrations' },
        { to: '/admin/notifications', label: 'Notifications' },
        { to: '/admin/audit', label: 'Audit Logs' },
        { to: '/admin/profile', label: 'Profile' },
      ],
    });
  } else {
    groups.push({ label: 'Account', items: [{ to: '/admin/profile', label: 'Profile' }] });
  }
  return groups;
}

export default function Shell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const groups = groupsForRole(user?.role);
  const [q, setQ] = useState('');

  function onSearch(e) {
    e.preventDefault();
    if (!q.trim()) return;
    navigate(`/ats/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="b1">TeamLink Consultants</div>
          <div className="b2">TeamLink.Enterprise</div>
        </div>
        <nav>
          <NavLink to="/" end className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
            Dashboard
          </NavLink>
          {groups.map((g) => (
            <div className="nav-group" key={g.label}>
              <div className="nav-group-label">{g.label}</div>
              {g.items.map((item) => (
                <NavLink key={item.to} to={item.to} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
          <div className="nav-group">
            <a className="nav-item" href="/careers" target="_blank" rel="noreferrer">Job Portal (public) ↗</a>
          </div>
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="topbar-title">TeamLink.Enterprise</div>
          <form className="gsearch" onSubmit={onSearch}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search candidates, clients, requirements…" />
          </form>
          <div className="topbar-right">
            <span className="rolechip">{user?.role}</span>
            <span>{user?.name}</span>
            <button className="btn btn-ghost" onClick={logout}>Sign Out</button>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
