import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const HR_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANT_MANAGER', 'STL', 'TL', 'EMPLOYEE'];
const ATS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANT_MANAGER', 'STL', 'TL', 'RECRUITER', 'BDE', 'CLIENT'];
const ACCOUNTS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'CLIENT'];

function groupsForRole(role) {
  const groups = [];
  if (HR_ROLES.includes(role)) {
    groups.push({
      label: 'HRMS',
      items: [
        { to: '/employees', label: 'Employees' },
        { to: '/attendance', label: 'Attendance' },
        { to: '/leave', label: 'Leave' },
        { to: '/payroll', label: 'Payroll' },
      ],
    });
  }
  if (ATS_ROLES.includes(role)) {
    groups.push({
      label: 'ATS',
      items: [
        { to: '/requirements', label: 'Requirements' },
        { to: '/clients', label: 'Clients' },
        { to: '/candidates', label: 'Candidates' },
      ],
    });
  }
  if (ACCOUNTS_ROLES.includes(role)) {
    groups.push({
      label: 'Accounts',
      items: [
        { to: '/invoices', label: 'Invoices' },
        { to: '/bank', label: 'Bank & Reconciliation' },
      ],
    });
  }
  return groups;
}

export default function Shell() {
  const { user, logout } = useAuth();
  const groups = groupsForRole(user?.role);

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
