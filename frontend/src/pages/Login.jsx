import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// The prototype's login (renderLogin, line 1997) is a passwordless role picker.
// This repo is public, so the look is reproduced exactly — the same
// login-shell / login-card / logo-lockup / role-opt markup, the same twelve
// roles and roleDesc() copy, the same conditional Client and Candidate
// pickers — but a real password field and the existing JWT flow sit behind it.
// Picking a role only prefills that role's demo email.
const ROLES = ['Super Admin', 'Admin', 'Manager', 'Assistant Manager', 'STL', 'TL',
  'Recruiter', 'BDE', 'Client', 'Accountant', 'Employee', 'Candidate'];

// roleDesc(), prototype line 2022 — verbatim.
const ROLE_DESC = {
  'Super Admin': 'Full access', Admin: 'Full access', Manager: 'Cross-module oversight',
  'Assistant Manager': 'Team oversight', STL: 'Senior TL scope', TL: 'Team scope',
  Recruiter: 'ATS recruiting', BDE: 'Client-facing sales', Client: 'Own requirements only',
  Accountant: 'Accounts only', Employee: 'HRMS self-service',
  Candidate: 'Own profile & applications only',
};

// Seeded demo logins (backend/prisma/seed.js). Roles with no seeded login
// leave the email box alone so you can type a real one.
const ROLE_EMAIL = {
  'Super Admin': 'admin@teamlink.test',
  Admin: 'admin@teamlink.test',
  TL: 'tl@teamlink.test',
  Recruiter: 'recruiter@teamlink.test',
  BDE: 'bde@teamlink.test',
  Client: 'client@teamlink.test',
  Accountant: 'accountant@teamlink.test',
  Employee: 'employee@teamlink.test',
};

// The prototype's client picker lists every client in its mock state. Here the
// client you sign in as is whichever client login you use, so the picker lists
// the seeded client logins.
const CLIENT_LOGINS = [
  { email: 'client@teamlink.test', label: 'Orbit Software Solutions (CLI-001)' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState('Admin');
  const [clientEmail, setClientEmail] = useState(CLIENT_LOGINS[0].email);
  const [email, setEmail] = useState('admin@teamlink.test');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function selectRole(r) {
    setRole(r);
    if (ROLE_EMAIL[r]) setEmail(r === 'Client' ? clientEmail : ROLE_EMAIL[r]);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="logo-lockup">
          <div className="mark">TL</div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>TeamLink Consultants</div>
          <div className="small-muted">TeamLink.Enterprise</div>
        </div>
        <div className="small-muted" style={{ marginBottom: 12 }}>
          Pick a role to prefill its demo login, then enter your password. One login covers HRMS, ATS and Accounts.
        </div>
        <div id="roleList">
          {ROLES.map((r) => (
            <div
              key={r}
              className={'role-opt' + (role === r ? ' sel' : '')}
              data-role={r}
              onClick={() => selectRole(r)}
            >
              <span>{r}</span>
              <span className="small-muted">{ROLE_DESC[r]}</span>
            </div>
          ))}
        </div>

        {role === 'Client' && (
          <div id="clientPickerWrap" style={{ marginTop: 10 }}>
            <label>Which client?</label>
            <select
              id="clientPicker"
              value={clientEmail}
              onChange={(e) => { setClientEmail(e.target.value); setEmail(e.target.value); }}
            >
              {CLIENT_LOGINS.map((c) => <option key={c.email} value={c.email}>{c.label}</option>)}
            </select>
          </div>
        )}

        {role === 'Candidate' && (
          <div id="candPickerWrap" style={{ marginTop: 10 }}>
            <label>Which candidate?</label>
            <div className="small-muted">
              Candidates do not sign in here — applications and status live on the{' '}
              <Link className="link-btn" to="/careers">public Job Portal</Link>.
            </div>
          </div>
        )}

        <div style={{ marginTop: 10 }}>
          <label htmlFor="loginEmail">Email</label>
          <input id="loginEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div style={{ marginTop: 10 }}>
          <label htmlFor="loginPassword">Password</label>
          <input
            id="loginPassword"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        {error && <div className="error-text">{error}</div>}

        <button
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
          type="submit"
          disabled={busy}
        >
          {busy ? 'Logging in…' : 'Log In'}
        </button>
      </form>
    </div>
  );
}
