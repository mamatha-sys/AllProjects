import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const HR_MANAGE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANT_MANAGER', 'STL', 'TL'];
const ATS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANT_MANAGER', 'STL', 'TL', 'RECRUITER', 'BDE', 'CLIENT'];
const ACCOUNTS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'CLIENT'];
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];
const REPORTS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];

// Matches the prototype's HRMS sidebar exactly — six items. Everything else
// (targets, recognition, KT, disciplinary, LMS, org structure, projects,
// help desk, assets, announcements, surveys, resignation, documents, shift
// roster, timesheet, expenses, access management, weekly ideas) lives as
// tabs inside Performance & Development or Employee Services.
const HR_ITEMS = [
  { to: '/hrms', label: 'HRMS Dashboard', icon: '📊' },
  { to: '/attendance', label: 'Attendance & Time', icon: '⏱️' },
  { to: '/leave', label: 'Leave & Holidays', icon: '🌴' },
  { to: '/payroll', label: 'Payroll & Compensation', icon: '💰' },
  { to: '/performance', label: 'Performance & Development', icon: '🎯' },
  { to: '/employee-services', label: 'Employee Services', icon: '🛎️' },
];

function groupsForRole(role) {
  const groups = [];
  if (HR_MANAGE_ROLES.includes(role) || role === 'EMPLOYEE') {
    groups.push({ label: 'HRMS', items: HR_ITEMS });
  }
  if (ATS_ROLES.includes(role)) {
    groups.push({
      label: 'ATS',
      items: [
        { to: '/requirements', label: 'Requirements', icon: '📋' },
        { to: '/clients', label: 'Clients', icon: '🏢' },
        { to: '/candidates', label: 'Candidates', icon: '👤' },
        { to: '/ats/team', label: 'Recruiter & BDE', icon: '🤝' },
        { to: '/ats/calendar', label: 'Interview Calendar', icon: '📅' },
      ],
    });
  }
  if (ACCOUNTS_ROLES.includes(role)) {
    groups.push({
      label: 'Accounts',
      items: [
        { to: '/invoices', label: 'Invoices', icon: '🧾' },
        { to: '/office', label: 'Office / Business', icon: '🏬' },
        { to: '/bank', label: 'Bank & Reconciliation', icon: '🏦' },
      ],
    });
  }
  if (REPORTS_ROLES.includes(role)) {
    groups.push({
      label: 'Reports',
      items: [
        { to: '/reports/ats', label: 'ATS Reports', icon: '📈' },
        { to: '/reports/job-portal', label: 'Job Portal Reports', icon: '🌐' },
        { to: '/reports/accounts', label: 'Accounts Reports', icon: '💹' },
      ],
    });
  }
  if (ADMIN_ROLES.includes(role)) {
    groups.push({
      label: 'Administration',
      items: [
        { to: '/admin/company', label: 'Company Setup', icon: '⚙️' },
        { to: '/admin/users', label: 'Users', icon: '👥' },
        { to: '/admin/roles', label: 'Role Catalog', icon: '🔐' },
        { to: '/admin/integrations', label: 'Integrations', icon: '🔌' },
        { to: '/admin/notifications', label: 'Notifications', icon: '🔔' },
        { to: '/admin/audit', label: 'Audit Logs', icon: '📜' },
        { to: '/admin/profile', label: 'Profile', icon: '🙍' },
      ],
    });
  } else {
    groups.push({ label: 'Account', items: [{ to: '/admin/profile', label: 'Profile', icon: '🙍' }] });
  }
  return groups;
}

function initials(name) {
  if (!name) return '?';
  return name.replace(/\(.*\)/, '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
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
          <div className="mark">TL</div>
          <div>
            <div className="b1">TeamLink Consultants</div>
            <div className="b2">TeamLink.Enterprise</div>
          </div>
        </div>
        <nav>
          <NavLink to="/" end className={({ isActive }) => 'nav-item top-item' + (isActive ? ' active' : '')}>
            <span className="nav-ico">🏠</span>Dashboard
          </NavLink>
          {groups.map((g) => (
            <div className="nav-group" key={g.label}>
              <div className="nav-group-label">{g.label}</div>
              {g.items.map((item) => (
                <NavLink key={item.to} to={item.to} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
                  <span className="nav-ico">{item.icon}</span>{item.label}
                </NavLink>
              ))}
            </div>
          ))}
          <div className="nav-group">
            <a className="nav-item" href="/careers" target="_blank" rel="noreferrer">
              <span className="nav-ico">🚀</span>Job Portal (public) ↗
            </a>
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
            <div className="avatar">{initials(user?.name)}</div>
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
