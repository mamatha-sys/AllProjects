// Role Catalog — the module / feature / action matrix the "Edit Access" modal
// edits.
//
// The reference prototype carries TWO permission structures that were never
// reconciled with each other:
//
//   * `state.rolePermissions` (buildDefaultPermissions, prototype line 406) —
//     four modules only (candidates, requirements, clients, invoices). It has no
//     HRMS and no Accounts module at all, so it cannot describe this app.
//   * `state.roleAccess` / `roleAccessFor()` (prototype line 10073) — ten modules,
//     each with 4-8 named features, each feature carrying seven actions. This is
//     what the Role Catalog's Edit Access -> Configure screens actually read and
//     write.
//
// We follow `roleAccessFor`, because it is the one the Role Catalog UI edits and
// the only one that covers every module this app ships. The lists below are the
// prototype's verbatim (ROLE_ACCESS_MODULES / ROLE_FEATURE_ACTIONS).

const ROLE_FEATURE_ACTIONS = ['view', 'create', 'edit', 'delete', 'approve', 'export', 'assign'];

const ROLE_ACCESS_MODULES = [
  { id: 'dashboard', label: 'Dashboard', features: ['KPI Overview', 'Department Strength', 'Pending Approvals', 'Alerts & Notifications', 'Upcoming Interviews', 'Quick Actions', 'Recruiter Leaderboard', 'Role & User Management'] },
  { id: 'requirements', label: 'Jobs / Requirements', features: ['Requirement List', 'Create Requirement', 'Requirement Detail', 'Job Posting', 'Matching Candidates', 'Requirement Pipeline'] },
  { id: 'clients', label: 'Clients', features: ['Client List', 'Add Client', 'Client Detail', 'Agreement Lifecycle', 'Commercial Terms', 'Client Requirements'] },
  { id: 'candidates', label: 'Candidates & Pipeline', features: ['Candidate List', 'Add Candidate', 'Candidate Master', 'Applications', 'Pipeline Stages', 'Rejection & Hold', 'Resume & Scores'] },
  { id: 'recruiterbde', label: 'Recruiter & BDE', features: ['Recruiter Workload', 'BDE Workload', 'Team View', 'Pending Actions'] },
  { id: 'interviews', label: 'Interview Calendar', features: ['Calendar View', 'Schedule Interview', 'AI Interview', 'Interview Feedback'] },
  { id: 'hrms', label: 'HRMS', features: ['HRMS Dashboard', 'Attendance & Time', 'Leave & Holidays', 'Payroll & Compensation', 'Performance & Development', 'Employee Services'] },
  { id: 'accounts', label: 'Accounts', features: ['Accounts Dashboard', 'Office & Expenses', 'Invoices', 'Bank & Reconciliation', 'Payments'] },
  { id: 'reports', label: 'Reports', features: ['ATS Reports', 'Job Portal Reports', 'Accounts Reports'] },
  { id: 'administration', label: 'Administration', features: ['Company Setup', 'Users', 'Role Catalog', 'Integrations', 'Organization Structure', 'Notifications', 'Audit Logs'] },
];

// Roles this app actually issues, in the prototype's seniority order.
const CATALOG_ROLES = [
  'SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANT_MANAGER', 'STL', 'TL',
  'RECRUITER', 'BDE', 'CLIENT', 'ACCOUNTANT', 'EMPLOYEE',
];

// The prototype's ROLE_SCOPE_DESC, mapped onto this app's role codes.
const ROLE_SCOPE_DESC = {
  SUPER_ADMIN: 'Company-wide (all departments, full access)',
  ADMIN: 'Company-wide (all departments, full access)',
  MANAGER: 'All departments, cross-department oversight',
  ASSISTANT_MANAGER: 'All departments, cross-department oversight (restricted admin settings)',
  STL: 'All departments, cross-department oversight — single STL',
  TL: 'Single department — own team only',
  RECRUITER: 'Own assigned candidates only',
  BDE: 'BDE department workflow',
  CLIENT: 'Own company only',
  ACCOUNTANT: 'Payrolls, invoices and expenses only',
  EMPLOYEE: 'Own record only',
};

// Which modules a role reaches before anyone edits its access — the seed the
// prototype's roleAccessFor() derives from role seniority. Super Admin and Admin
// get everything (modules on, every action ticked); everyone else starts with
// the modules their role already navigates to, view-only.
const DEFAULT_MODULES = {
  SUPER_ADMIN: ROLE_ACCESS_MODULES.map((m) => m.id),
  ADMIN: ROLE_ACCESS_MODULES.map((m) => m.id),
  MANAGER: ['dashboard', 'requirements', 'clients', 'candidates', 'recruiterbde', 'interviews', 'hrms', 'accounts', 'reports'],
  ASSISTANT_MANAGER: ['dashboard', 'requirements', 'clients', 'candidates', 'recruiterbde', 'interviews', 'hrms', 'reports'],
  STL: ['dashboard', 'requirements', 'clients', 'candidates', 'recruiterbde', 'interviews', 'hrms', 'reports'],
  TL: ['dashboard', 'requirements', 'candidates', 'recruiterbde', 'interviews', 'hrms'],
  RECRUITER: ['dashboard', 'requirements', 'candidates', 'interviews'],
  BDE: ['dashboard', 'requirements', 'clients', 'candidates', 'recruiterbde'],
  CLIENT: ['dashboard', 'requirements', 'candidates', 'interviews', 'accounts'],
  ACCOUNTANT: ['dashboard', 'accounts', 'reports'],
  EMPLOYEE: ['dashboard', 'hrms'],
};

// Derived, read-only product access for the Users screen. Main carries ONE
// User.role; the prototype gives each login three independent product roles.
// Until that split lands (see the note on User.role in schema.prisma), the
// Users screen shows each login's HRMS / ATS / Accounts reach derived from its
// single role rather than pretending three selects exist.
const PRODUCT_ACCESS = {
  SUPER_ADMIN: { hrms: 'Super Admin', ats: 'Super Admin', accounts: 'Super Admin' },
  ADMIN: { hrms: 'Admin', ats: 'Admin', accounts: 'Admin' },
  MANAGER: { hrms: 'Manager', ats: 'Manager', accounts: 'Manager' },
  ASSISTANT_MANAGER: { hrms: 'Assistant Manager', ats: 'Assistant Manager', accounts: 'No Access' },
  STL: { hrms: 'STL', ats: 'STL', accounts: 'No Access' },
  TL: { hrms: 'TL', ats: 'TL', accounts: 'No Access' },
  RECRUITER: { hrms: 'Employee', ats: 'Recruiter', accounts: 'No Access' },
  BDE: { hrms: 'Employee', ats: 'BDE', accounts: 'No Access' },
  CLIENT: { hrms: 'No Access', ats: 'Client', accounts: 'Accounts Viewer' },
  ACCOUNTANT: { hrms: 'Employee', ats: 'No Access', accounts: 'Accountant' },
  EMPLOYEE: { hrms: 'Employee', ats: 'No Access', accounts: 'No Access' },
};

function moduleById(id) {
  return ROLE_ACCESS_MODULES.find((m) => m.id === id) || null;
}

function emptyActions(value = false) {
  const out = {};
  ROLE_FEATURE_ACTIONS.forEach((a) => { out[a] = value; });
  return out;
}

// The access a role has before anything is persisted for it.
function defaultAccessForRole(role, moduleId) {
  const full = ['SUPER_ADMIN', 'ADMIN'].includes(role);
  const enabled = full || (DEFAULT_MODULES[role] || []).includes(moduleId);
  const mod = moduleById(moduleId);
  const features = {};
  (mod ? mod.features : []).forEach((f) => {
    features[f] = full ? emptyActions(true) : { ...emptyActions(false), view: enabled };
  });
  return { moduleEnabled: enabled, features };
}

// Merge a persisted RoleAccess row (if any) over the defaults, so a module added
// to the catalog later still shows up for roles saved before it existed.
function mergeAccess(role, moduleId, row) {
  const base = defaultAccessForRole(role, moduleId);
  if (!row) return base;
  let saved = {};
  try { saved = row.features ? JSON.parse(row.features) : {}; } catch { saved = {}; }
  const mod = moduleById(moduleId);
  const features = {};
  (mod ? mod.features : []).forEach((f) => {
    features[f] = { ...base.features[f], ...(saved[f] || {}) };
  });
  return { moduleEnabled: !!row.moduleEnabled, features };
}

// Normalise an incoming feature payload down to known features and actions, so
// the client cannot write arbitrary keys into the stored JSON.
function sanitizeFeatures(moduleId, incoming) {
  const mod = moduleById(moduleId);
  if (!mod) return {};
  const out = {};
  mod.features.forEach((f) => {
    const given = (incoming && incoming[f]) || {};
    out[f] = {};
    ROLE_FEATURE_ACTIONS.forEach((a) => { out[f][a] = !!given[a]; });
  });
  return out;
}

module.exports = {
  ROLE_FEATURE_ACTIONS,
  ROLE_ACCESS_MODULES,
  CATALOG_ROLES,
  ROLE_SCOPE_DESC,
  PRODUCT_ACCESS,
  moduleById,
  defaultAccessForRole,
  mergeAccess,
  sanitizeFeatures,
};
