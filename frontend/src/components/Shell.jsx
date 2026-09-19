import { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { atsRoleLabel } from '../atsVocab';

// ---------------------------------------------------------------------------
// Nav structure is the prototype's, verbatim: SECTION_LABEL (line 2065) and
// SUBNAV (line 2176) from teamlink-enterprise_69.html. Only the `to` paths are
// this app's React Router paths — labels, grouping and ordering are the
// prototype's. Entries marked `extra` are screens this app has that the
// prototype's nav lacks; they are appended to the group they belong to rather
// than orphaned.
// ---------------------------------------------------------------------------
const SECTION_LABEL = {
  dashboard: 'Dashboard', hrms: 'HRMS', ats: 'ATS',
  accounts: 'Accounts', admin: 'Administration', reports: 'Reports',
};

const HR_MANAGE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANT_MANAGER', 'STL', 'TL'];
const TEAM_LEAD_ROLES = ['MANAGER', 'ASSISTANT_MANAGER', 'STL', 'TL'];
const ATS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANT_MANAGER', 'STL', 'TL', 'RECRUITER', 'BDE', 'CLIENT'];
const ACCOUNTS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'CLIENT'];
const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];
const REPORTS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];

const HRMS_ITEMS = [
  ['/hrms', 'HRMS Dashboard'],
  ['/attendance', 'Attendance & Time'],
  ['/leave', 'Leave & Holidays'],
  ['/payroll', 'Payroll & Compensation'],
  ['/performance', 'Performance & Development'],
  ['/employee-services', 'Employee Services'],
];
// Employees (and the leads who are also employees) keep their own fill-in
// profile link — a main-only screen the prototype's sidebar has no slot for.
const HRMS_ITEMS_EMPLOYEE = [
  ['/hrms', 'HRMS Dashboard'],
  ['/my-profile', 'My Profile'],
  ...HRMS_ITEMS.slice(1),
];

const ATS_ITEMS = [
  ['/ats/dashboard', 'Dashboard'],
  ['/requirements', 'Jobs / Requirements'],
  ['/clients', 'Clients'],
  ['/candidates', 'Candidates & Pipeline'],
  ['/ats/team', 'Recruiter & BDE'],
  ['/ats/calendar', 'Interview Calendar'],
];

const ACCOUNTS_ITEMS = [
  ['/accounts/dashboard', 'Dashboard'],
  ['/office', 'Office / Business'],
  ['/invoices', 'Invoices'],
  ['/bank', 'Bank & Reconciliation'],
];

const ADMIN_ITEMS = [
  ['/admin/company', 'Company Setup'],
  // main-only: Departments & Teams admin (kept — it is the backing data for
  // the department-scoped guards).
  ['/admin/departments', 'Departments & Teams'],
  ['/employees', 'Employee Management'],
  ['/admin/users', 'Users'],
  ['/admin/roles', 'Role Catalog'],
  ['/admin/integrations', 'Integrations'],
  ['/admin/org-structure', 'Organization Structure'],
  ['/admin/notifications', 'Notifications'],
  ['/admin/audit', 'Audit Logs'],
  ['/admin/profile', 'Profile'],
];

const REPORTS_ITEMS = [
  ['/reports/ats', 'ATS Reports'],
  ['/reports/job-portal', 'Job Portal Reports'],
  ['/reports/accounts', 'Accounts Reports'],
];

// Group render order is the prototype's sidebarHtml() order (line 2100):
// HRMS, ATS, Accounts, Reports, Administration.
function groupsForRole(role) {
  const groups = [];
  if (TEAM_LEAD_ROLES.includes(role) || role === 'EMPLOYEE') {
    groups.push(['hrms', 'HRMS', HRMS_ITEMS_EMPLOYEE]);
  } else if (HR_MANAGE_ROLES.includes(role)) {
    groups.push(['hrms', 'HRMS', HRMS_ITEMS]);
  }
  if (ATS_ROLES.includes(role)) groups.push(['ats', 'ATS', ATS_ITEMS]);
  if (ACCOUNTS_ROLES.includes(role)) groups.push(['accounts', 'Accounts', ACCOUNTS_ITEMS]);
  if (REPORTS_ROLES.includes(role)) groups.push(['reports', 'Reports', REPORTS_ITEMS]);
  if (ADMIN_ROLES.includes(role)) {
    groups.push(['admin', 'Administration', ADMIN_ITEMS]);
  } else {
    // Non-admins still receive notifications and still own a profile — the
    // prototype gives them nothing, so they get the two-item slice.
    groups.push(['admin', 'Administration', [
      ['/admin/notifications', 'Notifications'],
      ['/admin/profile', 'Profile'],
    ]]);
  }
  return groups;
}

// Which sidebar section a URL belongs to, so the group opens and the topbar
// title / breadcrumb name the right section.
const SECTION_OF_PATH = [
  [/^\/(hrms|attendance|leave|payroll|performance|employee-services|my-profile)/, 'hrms'],
  [/^\/(ats|requirements|clients|candidates)/, 'ats'],
  [/^\/(accounts|invoices|bank|office)/, 'accounts'],
  [/^\/reports/, 'reports'],
  [/^\/(admin|employees)/, 'admin'],
];
function sectionOf(pathname) {
  const hit = SECTION_OF_PATH.find(([re]) => re.test(pathname));
  return hit ? hit[1] : 'dashboard';
}

function initials(name) {
  if (!name) return '?';
  return name.replace(/\(.*\)/, '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export default function Shell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);           // mobile sidebar
  const [manual, setManual] = useState({});          // prototype's sidebarManualToggle
  const [unread, setUnread] = useState(0);

  const groups = useMemo(() => groupsForRole(user?.role), [user?.role]);
  const section = sectionOf(pathname);

  useEffect(() => {
    api.get('/admin/notifications')
      .then((res) => setUnread(res.data.filter((n) => !n.read).length))
      .catch(() => setUnread(0));
  }, [pathname]);

  // isGroupOpen (prototype line 2067): the current section's group is open
  // unless the user has toggled it by hand.
  const isGroupOpen = (s) => (s in manual ? manual[s] : section === s);

  function toggleGroup(s, firstPath) {
    if (section === s) {
      setManual({ ...manual, [s]: !isGroupOpen(s) });
    } else {
      setManual({});
      closeSidebar();
      navigate(firstPath);
    }
  }
  function navTo(path) { closeSidebar(); navigate(path); }
  function closeSidebar() { setOpen(false); }

  function onSearch(e) {
    e.preventDefault();
    if (!q.trim()) return;
    navigate(`/ats/search?q=${encodeURIComponent(q)}`);
  }

  // Breadcrumb: section, then the nav item whose path this page sits under.
  const allItems = groups.flatMap(([, , items]) => items);
  const current = allItems
    .filter(([to]) => pathname === to || pathname.startsWith(to + '/'))
    .sort((a, b) => b[0].length - a[0].length)[0];

  return (
    <div className="app-shell">
      <aside className={'sidebar' + (open ? ' open' : '')} id="sidebar">
        <div className="sidebar-brand">
          <div>
            <div className="b1">TeamLink Consultants</div>
            <div className="b2">TeamLink.Enterprise</div>
          </div>
          <button className="sidebar-close" onClick={closeSidebar} aria-label="Close menu">✕</button>
        </div>
        <nav className="sidebar-nav">
          <div
            className={'sb-item' + (section === 'dashboard' ? ' top-active' : '')}
            onClick={() => navTo('/')}
          >
            Dashboard
          </div>
          {groups.map(([s, label, items]) => (
            <div className={'sb-group' + (isGroupOpen(s) ? ' open' : '')} key={s}>
              <div className="sb-group-head" onClick={() => toggleGroup(s, items[0][0])}>
                <span>{label}</span><span className="chev">▸</span>
              </div>
              <div className="sb-sub">
                {items.map(([to, l]) => (
                  <div
                    key={to}
                    className={'sb-sub-item' + (current && current[0] === to ? ' active' : '')}
                    onClick={() => navTo(to)}
                  >
                    {l}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="sb-group">
            <a className="sb-item" href="/careers" target="_blank" rel="noreferrer">Job Portal (public) ↗</a>
          </div>
        </nav>
      </aside>
      <div className={'sidebar-overlay' + (open ? ' show' : '')} onClick={closeSidebar} />

      <div className="content-col">
        <div className="topbar">
          <button className="hamburger" onClick={() => setOpen(true)} title="Menu">☰</button>
          <div className="topbar-title">{SECTION_LABEL[section] || 'Dashboard'}</div>
          <form className="gsearch" onSubmit={onSearch}>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search candidates, clients, requirements…"
            />
          </form>
          <div className="topbar-right">
            <span className="rolechip">{atsRoleLabel(user?.role)}</span>
            <span className="rolechip" style={{ cursor: 'pointer' }} onClick={() => navTo('/admin/notifications')}>🔔 {unread}</span>
            <div className="avatar">{initials(user?.name)}</div>
            <button className="btn btn-ghost btn-sm" onClick={logout}>Sign Out</button>
          </div>
        </div>

        <div className="breadcrumb">
          {section === 'dashboard' ? (
            <span className="bc-current">Dashboard</span>
          ) : (
            <>
              <span className="bc-current">{SECTION_LABEL[section]}</span>
              {current && (
                <>
                  <span className="bc-sep">/</span>
                  {pathname === current[0]
                    ? <span className="bc-current">{current[1]}</span>
                    : <Link className="bc-link" to={current[0]}>{current[1]}</Link>}
                </>
              )}
              {current && pathname !== current[0] && (
                <>
                  <span className="bc-sep">/</span>
                  <span className="bc-current">{decodeURIComponent(pathname.slice(current[0].length + 1))}</span>
                </>
              )}
            </>
          )}
        </div>

        <main>
          <Outlet />
        </main>

        <footer>
          TeamLink.Enterprise — HRMS + ATS + Accounts in one login · connected to the TeamLink Job Portal
        </footer>
      </div>
    </div>
  );
}
