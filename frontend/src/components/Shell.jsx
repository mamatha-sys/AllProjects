import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/requirements', label: 'Requirements' },
  { to: '/clients', label: 'Clients' },
  { to: '/candidates', label: 'Candidates' },
];

export default function Shell() {
  const { user, logout } = useAuth();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="b1">TeamLink Consultants</div>
          <div className="b2">TeamLink.Enterprise</div>
        </div>
        <nav>
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="topbar-title">ATS</div>
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
