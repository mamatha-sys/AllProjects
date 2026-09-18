import { useEffect, useState } from 'react';
import api from '../../api';

export default function OrgStructure() {
  const [employees, setEmployees] = useState([]);
  const [saving, setSaving] = useState(null);

  function load() {
    api.get('/employees').then((res) => setEmployees(res.data));
  }
  useEffect(load, []);

  async function setManager(id, reportingManagerId) {
    setSaving(id);
    await api.put(`/employees/${id}/manager`, { reportingManagerId: reportingManagerId || null });
    setSaving(null);
    load();
  }

  const roots = employees.filter((e) => !e.reportingManagerId);
  const childrenOf = (id) => employees.filter((e) => e.reportingManagerId === id);

  function renderNode(emp, depth) {
    return (
      <div key={emp.id}>
        <div className="kv" style={{ paddingLeft: depth * 20 }}>
          <span className="k">{'— '.repeat(depth > 0 ? 1 : 0)}{emp.name} <span className="small-muted">({emp.designation || emp.department || '—'})</span></span>
          <select
            value={emp.reportingManagerId || ''}
            onChange={(e) => setManager(emp.id, e.target.value)}
            disabled={saving === emp.id}
          >
            <option value="">No manager (top level)</option>
            {employees.filter((m) => m.id !== emp.id).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        {childrenOf(emp.id).map((child) => renderNode(child, depth + 1))}
      </div>
    );
  }

  return (
    <div>
      <div className="page-head"><h1>Org Structure</h1></div>
      <div className="card">
        {roots.map((r) => renderNode(r, 0))}
        {employees.length === 0 && <div className="small-muted">No employees yet.</div>}
      </div>
    </div>
  );
}
