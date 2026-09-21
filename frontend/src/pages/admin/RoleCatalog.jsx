import { useEffect, useState } from 'react';
import api from '../../api';
import Modal from '../../components/Modal.jsx';
import { atsRoleLabel } from '../../atsVocab';

// Role Catalog (the prototype's roleCatalogView + openEditAccess +
// openConfigureFeatures, lines 10098-10210).
//
// WHICH PERMISSION MATRIX: the prototype carries two that were never reconciled.
// `state.rolePermissions` covers four modules only (candidates, requirements,
// clients, invoices) with no HRMS and no Accounts at all. `state.roleAccess` /
// roleAccessFor() covers ten modules x 4-8 named features x 7 actions. The Role
// Catalog UI reads and writes the SECOND one, and it is the only one that can
// describe this app, so that is what this screen and
// backend/src/utils/roleAccess.js implement.
//
// Role list -> Edit Access (module toggles) -> Configure (feature x action grid).

export default function RoleCatalog() {
  const [roles, setRoles] = useState([]);
  const [editing, setEditing] = useState(null); // { role, scope, actions, modules[] }
  const [configuring, setConfiguring] = useState(null); // moduleId
  const [draft, setDraft] = useState({}); // unsaved feature grid for `configuring`
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function load() {
    api.get('/admin/role-catalog').then((res) => setRoles(res.data)).catch(() => setError('Could not load the role catalog.'));
  }
  useEffect(load, []);

  async function openEditAccess(role) {
    setError(''); setNotice(''); setConfiguring(null);
    try {
      const res = await api.get(`/admin/role-catalog/${role}/access`);
      setEditing(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not open that role.');
    }
  }

  // Toggling a module is saved immediately — the prototype does the same.
  async function toggleModule(moduleId, enabled) {
    setError(''); setNotice('');
    try {
      const res = await api.put(`/admin/role-catalog/${editing.role}/modules/${moduleId}`, { enabled });
      setEditing((e) => ({
        ...e,
        modules: e.modules.map((m) => (m.id === moduleId ? { ...m, moduleEnabled: res.data.moduleEnabled } : m)),
      }));
      setNotice(`${res.data.label} ${enabled ? 'enabled' : 'disabled'} for ${atsRoleLabel(editing.role)}.`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'That toggle could not be saved.');
    }
  }

  function openConfigure(moduleId) {
    const mod = editing.modules.find((m) => m.id === moduleId);
    // Deep-copy so ticking boxes doesn't mutate state before Save.
    setDraft(JSON.parse(JSON.stringify(mod.features)));
    setConfiguring(moduleId);
    setNotice('');
  }

  function toggleAction(feature, action) {
    setDraft((d) => ({ ...d, [feature]: { ...d[feature], [action]: !d[feature]?.[action] } }));
  }

  function toggleFeatureRow(feature, value) {
    setDraft((d) => {
      const next = { ...d[feature] };
      editing.actions.forEach((a) => { next[a] = value; });
      return { ...d, [feature]: next };
    });
  }

  async function saveFeatures() {
    setError(''); setNotice('');
    const mod = editing.modules.find((m) => m.id === configuring);
    try {
      const res = await api.put(`/admin/role-catalog/${editing.role}/modules/${configuring}/features`, { features: draft });
      setEditing((e) => ({
        ...e,
        modules: e.modules.map((m) => (m.id === configuring ? { ...m, features: res.data.features } : m)),
      }));
      setConfiguring(null);
      setNotice(`Feature permissions saved for ${atsRoleLabel(editing.role)} — ${mod.label}.`);
    } catch (err) {
      setError(err.response?.data?.error || 'Those permissions could not be saved.');
    }
  }

  const mod = configuring && editing ? editing.modules.find((m) => m.id === configuring) : null;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Role Catalog</h1>
          <div className="page-sub">Real user counts per role. Click Edit Access to configure a role&apos;s page access.</div>
        </div>
      </div>

      {error && <div className="error-text">{error}</div>}
      {notice && <div className="notice" style={{ marginBottom: 12 }}>{notice}</div>}

      <div className="panel">
        {roles.map((r) => (
          <div className="assign-row" key={r.role}>
            <span>
              <b>{atsRoleLabel(r.role)} · {r.users} user{r.users === 1 ? '' : 's'}</b>
              <br />
              <span className="cell-muted" style={{ fontSize: 12 }}>{r.scope || '—'}</span>
            </span>
            <button className="btn btn-sm" onClick={() => openEditAccess(r.role)}>Edit Access</button>
          </div>
        ))}
        {roles.length === 0 && <div className="empty-mini">No roles.</div>}
      </div>

      <div className="notice" style={{ marginTop: 12 }}>
        Page access is stored per role and edited here. NOTE: it is not yet enforced — no route or navigation
        reads it. Enforcement is entangled with the deferred three-role split and lands with it.
      </div>

      {editing && !configuring && (
        <Modal
          title={`Edit Access — ${atsRoleLabel(editing.role)}`}
          size="xwide"
          onClose={() => setEditing(null)}
          foot={<button className="btn btn-primary" onClick={() => setEditing(null)}>Done</button>}
        >
          <div className="cell-muted" style={{ fontSize: 12.5, marginBottom: 12 }}>
            Toggle module access, or click Configure for feature-level detail.
          </div>
          {editing.modules.map((m) => (
            <div className="assign-row" key={m.id}>
              <label style={{ display: 'flex', gap: 9, alignItems: 'center', flex: 1, cursor: 'pointer' }}>
                <input
                  type="checkbox" style={{ width: 'auto' }}
                  checked={!!m.moduleEnabled}
                  onChange={(e) => toggleModule(m.id, e.target.checked)}
                />
                {m.label}
              </label>
              <button className="btn btn-sm" onClick={() => openConfigure(m.id)}>Configure →</button>
            </div>
          ))}
        </Modal>
      )}

      {editing && mod && (
        <Modal
          title={`Configure — ${mod.label}`}
          size="xwide"
          onClose={() => setConfiguring(null)}
          foot={<>
            <button className="btn" onClick={() => setConfiguring(null)}>← Back to modules</button>
            <button className="btn btn-primary" onClick={saveFeatures}>Save changes</button>
          </>}
        >
          <div className="cell-muted" style={{ fontSize: 12.5, marginBottom: 10 }}>
            {mod.featureNames.length} feature(s) · {atsRoleLabel(editing.role)}
          </div>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Feature</th>
                  {editing.actions.map((a) => <th key={a} style={{ textAlign: 'center' }}>{a.toUpperCase()}</th>)}
                  {/* main-only: a row-level all/none shortcut over the prototype's seven boxes. */}
                  <th style={{ textAlign: 'center' }}>ALL</th>
                </tr>
              </thead>
              <tbody>
                {mod.featureNames.map((f) => {
                  const rec = draft[f] || {};
                  const all = editing.actions.every((a) => rec[a]);
                  return (
                    <tr key={f}>
                      <td><b>{f}</b></td>
                      {editing.actions.map((a) => (
                        <td key={a} style={{ textAlign: 'center' }}>
                          <input type="checkbox" style={{ width: 'auto' }} checked={!!rec[a]} onChange={() => toggleAction(f, a)} />
                        </td>
                      ))}
                      <td style={{ textAlign: 'center' }}>
                        <button className="btn btn-sm btn-ghost" type="button" onClick={() => toggleFeatureRow(f, !all)}>
                          {all ? 'None' : 'All'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
}
