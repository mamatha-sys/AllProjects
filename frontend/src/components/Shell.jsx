import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api';

// Every logged-in role in this standalone ATS build is ATS-scoped — Client
// sees only their own requirements/candidates (enforced server-side), the
// rest see the full pipeline (department-scoped for Manager/Assistant
// Manager/STL/TL — see backend/src/middleware/auth.js's isDeptScopedRole).
const ATS_ITEMS = [
  { to: '/requirements', label: 'Requirements', icon: '📋' },
  { to: '/clients', label: 'Clients', icon: '🏢' },
  { to: '/candidates', label: 'Candidates', icon: '👤' },
  { to: '/ats/team', label: 'Recruiter & BDE', icon: '🤝' },
  { to: '/ats/calendar', label: 'Interview Calendar', icon: '📅' },
  { to: '/reports/ats', label: 'ATS Reports', icon: '📈' },
];

function initials(name) {
  if (!name) return '?';
  return name.replace(/\(.*\)/, '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export default function Shell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    api.get('/notifications').then((res) => setUnread(res.data.filter((n) => !n.read).length)).catch(() => {});
  }, []);

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
            <div className="b2">ATS</div>
          </div>
        </div>
        <nav>
          <NavLink to="/" end className={({ isActive }) => 'nav-item top-item' + (isActive ? ' active' : '')}>
            <span className="nav-ico">🏠</span>Dashboard
          </NavLink>
          <div className="nav-group">
            <div className="nav-group-label">ATS</div>
            {ATS_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
                <span className="nav-ico">{item.icon}</span>{item.label}
              </NavLink>
            ))}
          </div>
          <div className="nav-group">
            <NavLink to="/notifications" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
              <span className="nav-ico">🔔</span>Notifications{unread > 0 ? ` (${unread})` : ''}
            </NavLink>
            <a className="nav-item" href="/careers" target="_blank" rel="noreferrer">
              <span className="nav-ico">🚀</span>Job Portal (public) ↗
            </a>
          </div>
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="topbar-title">TeamLink ATS</div>
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
