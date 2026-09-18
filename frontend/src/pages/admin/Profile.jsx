import { useState } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext.jsx';

export default function Profile() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [password, setPassword] = useState('');
  const [saved, setSaved] = useState(false);

  async function save(e) {
    e.preventDefault();
    const payload = { name };
    if (password) payload.password = password;
    await api.put('/auth/me', payload);
    setPassword('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <div className="page-head"><h1>Profile</h1></div>
      <form className="card section" onSubmit={save} style={{ maxWidth: 380 }}>
        <label className="field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="field" style={{ marginTop: 8 }}><span>Email</span><input value={user?.email || ''} disabled /></label>
        <label className="field" style={{ marginTop: 8 }}><span>New password (optional)</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <label className="field" style={{ marginTop: 8 }}><span>Role</span><input value={user?.role || ''} disabled /></label>
        <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} type="submit">Save</button>
        {saved && <span className="small-muted" style={{ marginLeft: 10 }}>Saved.</span>}
      </form>
    </div>
  );
}
