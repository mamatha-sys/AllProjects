import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import {
  agreementStatusLabel, DEPTS, LOCS, INDIAN_STATES, CLIENT_INDUSTRIES, CLIENT_STATUSES,
  CLIENT_TYPES, CLIENT_PRIORITIES, COMM_MODES, BUSINESS_TYPES, PAYMENT_TERMS,
  INVOICE_TRIGGERS, AGREEMENT_TEMPLATES, RISK_FLAGS, COMM_CHANNELS,
} from '../atsVocab';
import { Modal, Tabs, SecHead, agreementBadgeClass } from './ats/atsUi';

// The prototype's Add Client modal (openAddClientModal, line 7296) is five
// tabs; switchAddClientTab() names them in this order.
const TABS = [
  ['basic', 'Basic Info'],
  ['legal', 'Legal & Finance'],
  ['agreement', 'Agreement'],
  ['ownership', 'Ownership & Communication'],
  ['risk', 'Risk Monitoring'],
];

const today = () => new Date().toISOString().slice(0, 10);
const nextYear = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
};

const EMPTY = {
  name: '', legalName: '', website: '', industry: '', ownerDepartment: 'IT',
  yearEstablished: '', landline: '', status: 'Active', activeDate: today(),
  contactName: '', contactDesignation: '', contactPhone: '', contactEmail: '', contactWhatsApp: '',
  secondaryContactName: '', secondaryContactDesignation: '', secondaryContactPhone: '', secondaryContactEmail: '',
  houseNumber: '', street: '', landmark: '', area: '', pincode: '', country: 'India',
  state: '', location: LOCS[0],
  clientType: '', priority: 'High', commPrimary: '', commSecondary: '',
  gst: '', pan: '', tan: '', businessType: 'Private Limited',
  agreementFeePercent: 8.33, tdsPercent: 10, paymentTerms: PAYMENT_TERMS[0],
  guaranteePeriod: '30 Days', gstPercent: 18, invoiceTrigger: 'Candidate Joining',
  paymentDue: '6 days after invoice', commercialNotes: '',
  accountManager: '', bdeOwner: '',
  agreementRequired: 'Yes', agreementTemplate: AGREEMENT_TEMPLATES[0],
  agreementStart: today(), agreementEnd: nextYear(),
  commChannels: 'Email,WhatsApp',
  riskFlag: 'None', riskNotes: '',
};

export default function Clients() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [tab, setTab] = useState('basic');
  const [showForm, setShowForm] = useState(false);
  const [agreementPreview, setAgreementPreview] = useState('');
  const [error, setError] = useState('');

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  function load() {
    api.get('/clients').then((res) => setClients(res.data));
  }
  useEffect(() => {
    load();
    api.get('/requirements').then((res) => setRequirements(res.data)).catch(() => setRequirements([]));
  }, []);

  // refreshAgreementPreview(): the template pane on the right of the modal
  // fills in live from the fields on the left.
  useEffect(() => {
    if (!showForm) return undefined;
    const t = setTimeout(() => {
      api.post('/clients/preview-agreement', {
        name: form.name, legalName: form.legalName, industry: form.industry,
        location: form.location, agreementFeePercent: form.agreementFeePercent,
      })
        .then((res) => setAgreementPreview(res.data.document))
        .catch(() => setAgreementPreview(''));
    }, 250);
    return () => clearTimeout(t);
  }, [showForm, form.name, form.legalName, form.industry, form.location, form.agreementFeePercent]);

  const openCount = (clientId) =>
    requirements.filter((r) => r.clientId === clientId && r.status === 'OPEN').length;

  function closeForm() {
    setForm(EMPTY);
    setTab('basic');
    setShowForm(false);
    setError('');
  }

  async function save(createAgreement) {
    setError('');
    try {
      await api.post('/clients', { ...form, createAgreement, asDraft: !createAgreement });
    } catch (err) {
      return setError(err.response?.data?.error || 'Could not save this client');
    }
    closeForm();
    load();
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Clients</h1>
          <div className="page-sub">{clients.length} client accounts</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>Add Client</button>
      </div>

      {showForm && (
        <Modal
          title="Add Client"
          size="xwide"
          onClose={closeForm}
          footer={(
            <>
              <button type="button" className="btn" onClick={closeForm}>Cancel</button>
              <button type="button" className="btn" onClick={() => save(false)}>Save</button>
              <button type="button" className="btn btn-primary" onClick={() => save(true)}>Save &amp; Create Agreement</button>
            </>
          )}
        >
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 320 }}>
          <Tabs tabs={TABS} value={tab} onChange={setTab} style={{ marginBottom: 12 }} />

          {tab === 'basic' && (
            <>
              <div className="grid-2">
                <label className="field">
                  <span>Company Name *</span>
                  <input required value={form.name} onChange={(e) => set({ name: e.target.value })} />
                </label>
                <label className="field">
                  <span>Legal Company Name *</span>
                  <input value={form.legalName} onChange={(e) => set({ legalName: e.target.value })} />
                </label>
                <label className="field">
                  <span>Company Website</span>
                  <input placeholder="https://…" value={form.website} onChange={(e) => set({ website: e.target.value })} />
                </label>
                <label className="field">
                  <span>Industry</span>
                  <select value={form.industry} onChange={(e) => set({ industry: e.target.value })}>
                    <option value="">— Select —</option>
                    {CLIENT_INDUSTRIES.map((x) => <option key={x}>{x}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Owner Department</span>
                  <select value={form.ownerDepartment} onChange={(e) => set({ ownerDepartment: e.target.value })}>
                    {DEPTS.map((x) => <option key={x}>{x}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Year of Establishment</span>
                  <input placeholder="e.g. 2014" value={form.yearEstablished} onChange={(e) => set({ yearEstablished: e.target.value })} />
                </label>
                <label className="field">
                  <span>Landline Number</span>
                  <input value={form.landline} onChange={(e) => set({ landline: e.target.value })} />
                </label>
                <label className="field">
                  <span>Status</span>
                  <select value={form.status} onChange={(e) => set({ status: e.target.value })}>
                    {CLIENT_STATUSES.map((x) => <option key={x}>{x}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Active date (added on) *</span>
                  <input type="date" value={form.activeDate} onChange={(e) => set({ activeDate: e.target.value })} />
                </label>
              </div>

              <SecHead>Primary Contact</SecHead>
              <div className="grid-2">
                <label className="field">
                  <span>Primary Name *</span>
                  <input value={form.contactName} onChange={(e) => set({ contactName: e.target.value })} />
                </label>
                <label className="field">
                  <span>Primary Designation</span>
                  <input placeholder="e.g. HR Manager" value={form.contactDesignation} onChange={(e) => set({ contactDesignation: e.target.value })} />
                </label>
                <label className="field">
                  <span>Primary Contact (Phone) *</span>
                  <input value={form.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} />
                </label>
                <label className="field">
                  <span>Primary Mail *</span>
                  <input value={form.contactEmail} onChange={(e) => set({ contactEmail: e.target.value })} />
                </label>
                <label className="field">
                  <span>Primary WhatsApp</span>
                  <input value={form.contactWhatsApp} onChange={(e) => set({ contactWhatsApp: e.target.value })} />
                </label>
              </div>

              <SecHead>Secondary Contact</SecHead>
              <div className="grid-2">
                <label className="field">
                  <span>Secondary Name</span>
                  <input value={form.secondaryContactName} onChange={(e) => set({ secondaryContactName: e.target.value })} />
                </label>
                <label className="field">
                  <span>Secondary Designation</span>
                  <input value={form.secondaryContactDesignation} onChange={(e) => set({ secondaryContactDesignation: e.target.value })} />
                </label>
                <label className="field">
                  <span>Secondary Contact</span>
                  <input value={form.secondaryContactPhone} onChange={(e) => set({ secondaryContactPhone: e.target.value })} />
                </label>
                <label className="field">
                  <span>Secondary Mail</span>
                  <input value={form.secondaryContactEmail} onChange={(e) => set({ secondaryContactEmail: e.target.value })} />
                </label>
              </div>

              <SecHead>Client Address</SecHead>
              <div className="grid-2">
                <label className="field">
                  <span>House Number</span>
                  <input value={form.houseNumber} onChange={(e) => set({ houseNumber: e.target.value })} />
                </label>
                <label className="field">
                  <span>Street</span>
                  <input value={form.street} onChange={(e) => set({ street: e.target.value })} />
                </label>
                <label className="field">
                  <span>Landmark</span>
                  <input value={form.landmark} onChange={(e) => set({ landmark: e.target.value })} />
                </label>
                <label className="field">
                  <span>Area</span>
                  <input value={form.area} onChange={(e) => set({ area: e.target.value })} />
                </label>
                <label className="field">
                  <span>Pin code</span>
                  <input value={form.pincode} onChange={(e) => set({ pincode: e.target.value })} />
                </label>
                <label className="field">
                  <span>Country</span>
                  <input value={form.country} onChange={(e) => set({ country: e.target.value })} />
                </label>
                <label className="field">
                  <span>State *</span>
                  <select value={form.state} onChange={(e) => set({ state: e.target.value })}>
                    <option value="">State</option>
                    {INDIAN_STATES.map((x) => <option key={x}>{x}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>City *</span>
                  <select value={form.location} onChange={(e) => set({ location: e.target.value })}>
                    {LOCS.map((x) => <option key={x}>{x}</option>)}
                  </select>
                </label>
              </div>

              <SecHead>Classification &amp; Communication</SecHead>
              <div className="grid-2">
                <label className="field">
                  <span>Client Type</span>
                  <select value={form.clientType} onChange={(e) => set({ clientType: e.target.value })}>
                    <option value="">— Select —</option>
                    {CLIENT_TYPES.map((x) => <option key={x}>{x}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Client Priority</span>
                  <select value={form.priority} onChange={(e) => set({ priority: e.target.value })}>
                    {CLIENT_PRIORITIES.map((x) => <option key={x}>{x}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Primary Comm Mode</span>
                  <select value={form.commPrimary} onChange={(e) => set({ commPrimary: e.target.value })}>
                    <option value="">— Select —</option>
                    {COMM_MODES.map((x) => <option key={x}>{x}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Secondary Comm Mode</span>
                  <select value={form.commSecondary} onChange={(e) => set({ commSecondary: e.target.value })}>
                    <option value="">— Select —</option>
                    {COMM_MODES.map((x) => <option key={x}>{x}</option>)}
                  </select>
                </label>
              </div>
            </>
          )}

          {tab === 'legal' && (
            <>
              <div className="grid-2">
                <label className="field">
                  <span>GSTIN</span>
                  <input placeholder="36AAAAA0000A1Z5" value={form.gst} onChange={(e) => set({ gst: e.target.value })} />
                </label>
                <label className="field">
                  <span>PAN</span>
                  <input placeholder="AAAAA0000A" value={form.pan} onChange={(e) => set({ pan: e.target.value })} />
                </label>
                <label className="field">
                  <span>TAN</span>
                  <input value={form.tan} onChange={(e) => set({ tan: e.target.value })} />
                </label>
                <label className="field">
                  <span>Business Type</span>
                  <select value={form.businessType} onChange={(e) => set({ businessType: e.target.value })}>
                    {BUSINESS_TYPES.map((x) => <option key={x}>{x}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Recruitment Fee % *</span>
                  <input type="number" step="0.01" value={form.agreementFeePercent} onChange={(e) => set({ agreementFeePercent: e.target.value })} />
                </label>
                <label className="field">
                  <span>TDS %</span>
                  <input type="number" step="0.01" value={form.tdsPercent} onChange={(e) => set({ tdsPercent: e.target.value })} />
                </label>
                <label className="field">
                  <span>Payment Terms</span>
                  <select value={form.paymentTerms} onChange={(e) => set({ paymentTerms: e.target.value })}>
                    {PAYMENT_TERMS.map((x) => <option key={x}>{x}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Replacement / Guarantee Period</span>
                  <input value={form.guaranteePeriod} onChange={(e) => set({ guaranteePeriod: e.target.value })} />
                </label>
                <label className="field">
                  <span>GST %</span>
                  <input type="number" step="0.01" value={form.gstPercent} onChange={(e) => set({ gstPercent: e.target.value })} />
                </label>
                <label className="field">
                  <span>Invoice Trigger</span>
                  <select value={form.invoiceTrigger} onChange={(e) => set({ invoiceTrigger: e.target.value })}>
                    {INVOICE_TRIGGERS.map((x) => <option key={x}>{x}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Payment Due</span>
                  <input value={form.paymentDue} onChange={(e) => set({ paymentDue: e.target.value })} />
                </label>
              </div>
              <label className="field">
                <span>Commercial Terms / Notes</span>
                <textarea rows="2" placeholder="Any additional commercial terms agreed with this client" value={form.commercialNotes} onChange={(e) => set({ commercialNotes: e.target.value })} />
              </label>
            </>
          )}

          {tab === 'agreement' && (
            <>
            <div className="grid-2">
              <label className="field">
                <span>Agreement Required</span>
                <select value={form.agreementRequired} onChange={(e) => set({ agreementRequired: e.target.value })}>
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </label>
              <label className="field">
                <span>Agreement Template</span>
                <select value={form.agreementTemplate} onChange={(e) => set({ agreementTemplate: e.target.value })}>
                  {AGREEMENT_TEMPLATES.map((x) => <option key={x}>{x}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Agreement Start Date</span>
                <input type="date" value={form.agreementStart} onChange={(e) => set({ agreementStart: e.target.value })} />
              </label>
              <label className="field">
                <span>Agreement End Date</span>
                <input type="date" value={form.agreementEnd} onChange={(e) => set({ agreementEnd: e.target.value })} />
              </label>
              <label className="field">
                <span>Agreement Status</span>
                <input disabled value="Draft (until generated and signed)" />
              </label>
            </div>
            <div className="notice">
              &quot;Save &amp; Create Agreement&quot; generates the agreement document from the commercial terms on
              the Legal &amp; Finance tab. It stays <b>Draft</b> until it is sent and signed — a client
              requirement cannot be posted before the agreement is Active.
            </div>
            </>
          )}

          {tab === 'ownership' && (
            <>
              <SecHead first>Ownership</SecHead>
              <div className="grid-2">
                <label className="field">
                  <span>BDE / Client Owner</span>
                  <input value={form.bdeOwner} onChange={(e) => set({ bdeOwner: e.target.value })} />
                </label>
                <label className="field">
                  <span>Account Manager</span>
                  <input value={form.accountManager} onChange={(e) => set({ accountManager: e.target.value })} />
                </label>
              </div>
              <SecHead>Communication Preferences</SecHead>
              <div className="cell-muted" style={{ fontSize: 12, marginBottom: 8 }}>
                Which channels this client is contacted on.
              </div>
              {COMM_CHANNELS.map((ch) => {
                const on = form.commChannels.split(',').map((x) => x.trim()).filter(Boolean).includes(ch);
                return (
                  <label key={ch} style={{ display: 'flex', gap: 9, alignItems: 'center', padding: '5px 0', fontSize: 13, fontWeight: 400 }}>
                    <input
                      type="checkbox"
                      style={{ width: 'auto' }}
                      checked={on}
                      onChange={() => {
                        const list = form.commChannels.split(',').map((x) => x.trim()).filter(Boolean);
                        set({ commChannels: (on ? list.filter((x) => x !== ch) : [...list, ch]).join(',') });
                      }}
                    />
                    {' '}{ch}
                  </label>
                );
              })}
            </>
          )}

          {tab === 'risk' && (
            <>
              <label className="field">
                <span>Payment Risk Flag</span>
                <select value={form.riskFlag} onChange={(e) => set({ riskFlag: e.target.value })}>
                  {RISK_FLAGS.map((x) => <option key={x}>{x}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Risk Notes</span>
                <textarea rows="3" placeholder="Any credit/collections history worth flagging" value={form.riskNotes} onChange={(e) => set({ riskNotes: e.target.value })} />
              </label>
            </>
          )}

          {error && <div className="notice red">{error}</div>}
          </div>

          <div style={{
            flex: 1,
            minWidth: 320,
            background: 'var(--paper)',
            border: '1px solid var(--line)',
            borderRadius: 8,
            padding: 14,
            maxHeight: 520,
            overflowY: 'auto',
          }}
          >
            <h4 style={{ fontSize: 13, marginBottom: 4 }}>Agreement Template Preview</h4>
            <div className="small-muted" style={{ fontSize: 11, marginBottom: 10 }}>
              Updates live from the fields on the left — same master template used everywhere, just filled
              with this client&apos;s values.
            </div>
            <div className="small-muted" style={{ whiteSpace: 'pre-line', fontSize: 10.5, lineHeight: 1.5 }}>
              {agreementPreview || 'Enter a company name to see the agreement fill in.'}
            </div>
          </div>
          </div>
        </Modal>
      )}

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Client</th><th>Industry</th><th>Location</th>
              <th>Account Manager</th><th>Agreement</th><th>Open Requirements</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} className="row-link" onClick={() => navigate(`/clients/${c.id}`)}>
                <td>{c.name}</td>
                <td>{c.industry || '—'}</td>
                <td>{c.location || '—'}</td>
                <td>{c.accountManager || '—'}</td>
                <td>
                  <span className={`status ${agreementBadgeClass(c.agreementStatus)}`}>
                    {agreementStatusLabel(c.agreementStatus)}
                  </span>
                </td>
                <td>{openCount(c.id)}</td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr><td colSpan="6" className="small-muted" style={{ padding: 16 }}>No clients in your scope.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
