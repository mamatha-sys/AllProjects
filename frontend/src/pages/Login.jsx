import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@teamlink.test');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
          <img src="/brand/teamlink-logo.png" alt="TeamLink Consultants" className="login-logo" />
          <div className="small-muted">TeamLink.Enterprise</div>
        </div>
        <label className="field">
          <span>Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </label>
        <label className="field">
          <span>Password</span>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        </label>
        {error && <div className="error-text">{error}</div>}
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '10px 15px', fontSize: 14 }} type="submit" disabled={busy}>
          {busy ? 'Logging in…' : 'Log In'}
        </button>
        <div className="small-muted" style={{ marginTop: 10 }}>
          Seeded demo logins (password: password123): admin@teamlink.test, recruiter@teamlink.test, bde@teamlink.test, tl@teamlink.test, client@teamlink.test
        </div>
      </form>
    </div>
  );
}
