import { useEffect, useState } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext.jsx';

const HR_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ASSISTANT_MANAGER', 'STL', 'TL'];

export default function Documents() {
  const { user } = useAuth();
  const isHR = HR_ROLES.includes(user?.role);
  const [documents, setDocuments] = useState([]);
  const [form, setForm] = useState({ title: '', category: 'Policy', mandatory: true, target: 'All Employees', uploadedDate: new Date().toISOString().slice(0, 10) });

  function load() {
    api.get('/documents').then((res) => setDocuments(res.data));
  }
  useEffect(load, []);

  async function publish(e) {
    e.preventDefault();
    await api.post('/documents', form);
    setForm({ ...form, title: '' });
    load();
  }

  async function acknowledge(id) {
    await api.post(`/documents/${id}/acknowledge`);
    load();
  }

  return (
    <div>
      <div className="page-head"><h1>Documents</h1></div>

      {isHR && (
        <form className="card section" onSubmit={publish}>
          <h3>Publish document</h3>
          <div className="grid-2">
            <label className="field"><span>Title</span><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label className="field">
              <span>Category</span>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option>Policy</option>
                <option>Compliance</option>
              </select>
            </label>
          </div>
          <button className="btn btn-primary btn-sm" type="submit">Publish</button>
        </form>
      )}

      <div className="tbl-wrap">
        <table>
          <thead><tr><th>Title</th><th>Category</th><th>Mandatory</th><th>Target</th><th>Uploaded</th><th>Acknowledged by</th>{!isHR && <th></th>}</tr></thead>
          <tbody>
            {documents.map((d) => (
              <tr key={d.id}>
                <td>{d.title}</td>
                <td>{d.category}</td>
                <td>{d.mandatory ? 'Yes' : 'No'}</td>
                <td>{d.target}</td>
                <td>{d.uploadedDate}</td>
                <td>{d.acknowledgments.length}</td>
                {!isHR && <td><button className="btn btn-sm" onClick={() => acknowledge(d.id)}>Acknowledge</button></td>}
              </tr>
            ))}
            {documents.length === 0 && <tr><td colSpan={isHR ? 6 : 7} className="small-muted">No documents yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
