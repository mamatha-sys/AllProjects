import { useEffect, useState } from 'react';
import api from '../../api';

export default function CompanySetup() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '' });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/admin/company').then((res) => setForm(res.data));
  }, []);

  async function save(e) {
    e.preventDefault();
    await api.put('/admin/company', form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <div className="page-head"><h1>Company Setup</h1></div>
      <form className="card section" onSubmit={save} style={{ maxWidth: 480 }}>
        <div className="grid-2">
          <label className="field"><span>Company Name</span><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="field"><span>Contact Email</span><input value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label className="field"><span>Contact Phone</span><input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          <label className="field"><span>Address</span><input value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
        </div>
        <button className="btn btn-primary btn-sm" type="submit">Save</button>
        {saved && <span className="small-muted" style={{ marginLeft: 10 }}>Saved.</span>}
      </form>
    </div>
  );
}
