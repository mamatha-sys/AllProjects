import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import {
  DEPTS, LOCS, PRIORITIES, REQUIREMENT_TYPES, EDUCATION_LEVELS, EMPLOYMENT_TYPES, WORK_MODES,
  JOINING_TIMELINES, NOTICE_PERIODS_MAX, JOB_PREFERENCES, SALARY_TYPES, CURRENCIES,
  requirementStatusLabel, agreementStatusLabel,
} from '../atsVocab';
import { Modal, SecHead, Tabs, priorityClass, fmtDate } from './ats/atsUi';

// The prototype's "G. Job Posting" checkbox list (POSTING_SOURCES).
const POSTING_SOURCES = [
  'TeamLink Job Portal', 'Naukri', 'LinkedIn', 'Indeed', 'Shine', 'Company Website',
];

// The prototype's Create Requirement modal (openAddRequirementModal, line 6956)
// in its section order: A Basic Information, B Client Information,
// C Job Description, D Job Conditions, E Compensation, F Assignment,
// G Job Posting.
const EMPTY = {
  type: 'Client Requirement',
  title: '',
  clientId: '',
  department: DEPTS[0],
  openings: 1,
  priority: 'Medium',
  closingDate: '',
  jobDescription: '',
  responsibilities: '',
  qualifications: '',
  education: 'Any Degree',
  skills: '',
  goodToHaveSkills: '',
  employmentType: 'Full Time',
  workMode: 'Work From Office',
  location: LOCS[0],
  preferredLocation: '',
  expMin: 2,
  expMax: 6,
  relevantExperience: 2,
  joiningTimeline: 'Within 15 Days',
  noticePeriodMax: '30 Days',
  jobPreference: 'Permanent',
  salaryType: 'Annual CTC',
  currency: 'INR',
  salaryMin: '',
  salaryMax: '',
  recruiterId: '',
  bdeId: '',
  tl: '',
  stl: '',
  postingSources: [],
};

export default function Requirements() {
  const navigate = useNavigate();
  const [requirements, setRequirements] = useState([]);
  const [clients, setClients] = useState([]);
  const [team, setTeam] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [view, setView] = useState('all');
  // The prototype's All Requirements filter row: search, client, status.
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  // …and the Open Requirements tab's own four filters (openReqFilters).
  const [openFilters, setOpenFilters] = useState({ dept: '', client: '', recruiter: '', priority: '' });

  const internal = form.type === 'Internal Requirement';
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  function load() {
    api.get('/requirements').then((res) => setRequirements(res.data));
  }
  useEffect(() => {
    load();
    api.get('/clients').then((res) => setClients(res.data));
    api.get('/ats/team').then((res) => setTeam(res.data)).catch(() => setTeam([]));
  }, []);

  const selectedClient = clients.find((c) => c.id === form.clientId);
  const recruiters = team.filter((t) => t.role === 'RECRUITER');
  const bdes = team.filter((t) => t.role === 'BDE');

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requirements.filter((r) => {
      if (q && !(`${r.title} ${r.skills || ''}`.toLowerCase().includes(q))) return false;
      if (clientFilter && r.clientId !== clientFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      return true;
    });
  }, [requirements, search, clientFilter, statusFilter]);

  const openRows = useMemo(() => requirements.filter((r) => {
    if (r.status !== 'OPEN') return false;
    if (openFilters.dept && r.department !== openFilters.dept) return false;
    if (openFilters.client && (r.client?.name || '') !== openFilters.client) return false;
    if (openFilters.recruiter && (r.recruiter?.name || '') !== openFilters.recruiter) return false;
    if (openFilters.priority && r.priority !== openFilters.priority) return false;
    return true;
  }), [requirements, openFilters]);

  const openClientNames = useMemo(
    () => [...new Set(requirements.map((r) => r.client?.name).filter(Boolean))].sort(),
    [requirements],
  );

  // agreementMonthReport() — agreement counts by month, computed from each
  // client's own agreement dates. Months with no activity are not shown.
  const agreementMonths = useMemo(() => {
    const months = {};
    const bump = (value, key) => {
      if (!value) return;
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return;
      const k = d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
      months[k] = months[k] || { created: 0, signed: 0, active: 0, expired: 0, pending: 0, _d: d };
      months[k][key] += 1;
    };
    clients.forEach((c) => {
      bump(c.agreementStart || c.createdAt, 'created');
      if (c.agreementSignedAt) bump(c.agreementSignedAt, 'signed');
      if (c.agreementStatus === 'ACTIVE') bump(c.agreementActivatedAt || c.agreementSignedAt || c.agreementStart, 'active');
      if (c.agreementStatus === 'EXPIRED') bump(c.agreementEnd, 'expired');
      if (['DRAFT', 'SENT'].includes(c.agreementStatus)) bump(c.agreementStart || c.createdAt, 'pending');
    });
    const keys = Object.keys(months).sort((a, b) => months[a]._d - months[b]._d);
    return { months, keys };
  }, [clients]);

  function payload(status) {
    return {
      ...form,
      status,
      internal,
      clientId: form.clientId,
      experience: `${form.expMin}-${form.expMax} yrs`,
      relevantExperience: `${form.relevantExperience} yrs`,
      preferredLocation: form.preferredLocation || 'Any',
      salary: form.salaryMin && form.salaryMax ? `₹${form.salaryMin}L - ₹${form.salaryMax}L` : '—',
      bdeId: internal ? '' : form.bdeId,
      description: form.jobDescription,
      postingSources: form.postingSources.join(','),
    };
  }

  async function save(status) {
    setError('');
    if (!form.title.trim()) return setError('Job Title is required.');
    if (!internal && !form.clientId) return setError('Select a client for a client requirement.');
    try {
      await api.post('/requirements', payload(status));
    } catch (err) {
      return setError(err.response?.data?.error || 'Could not save this requirement');
    }
    closeForm();
    load();
  }

  function closeForm() {
    setForm(EMPTY);
    setPreview(null);
    setError('');
    setShowForm(false);
  }

  const toggleSource = (s) => set({
    postingSources: form.postingSources.includes(s)
      ? form.postingSources.filter((x) => x !== s)
      : [...form.postingSources, s],
  });

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Jobs / Requirements</h1>
          <div className="page-sub">{requirements.length} requirements</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>Add Requirement</button>
      </div>

      {showForm && (
        <Modal
          title="Create Requirement"
          size="xwide"
          onClose={closeForm}
          footer={(
            <>
              <button type="button" className="btn" onClick={closeForm}>Cancel</button>
              <button type="button" className="btn" onClick={() => setPreview(payload('DRAFT'))}>Preview</button>
              <button type="button" className="btn" onClick={() => save('DRAFT')}>Save Draft</button>
              <button type="button" className="btn" onClick={() => save('OPEN')}>Save &amp; Activate</button>
              <button type="button" className="btn btn-primary" onClick={() => save('OPEN')}>Save &amp; Post</button>
            </>
          )}
        >
          <SecHead letter="A" first>Basic Information</SecHead>
          <div className="grid-2">
            <div className="field">
              <label>Requirement ID</label>
              <input disabled value="(auto — assigned on save)" />
            </div>
            <div className="field">
              <label>Requirement Type *</label>
              <select value={form.type} onChange={(e) => set({ type: e.target.value })}>
                {REQUIREMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Job Title *</label>
              <input value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Senior Java Developer" />
            </div>
            <div className="field">
              <label>Department *</label>
              <select value={form.department} onChange={(e) => set({ department: e.target.value })}>
                {DEPTS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Number of Openings *</label>
              <input type="number" min="1" value={form.openings} onChange={(e) => set({ openings: e.target.value })} />
            </div>
            <div className="field">
              <label>Priority *</label>
              <select value={form.priority} onChange={(e) => set({ priority: e.target.value })}>
                {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Requirement Status</label>
              <input disabled value="Draft (until activated)" />
            </div>
            <div className="field">
              <label>Closing Date</label>
              <input type="date" value={form.closingDate} onChange={(e) => set({ closingDate: e.target.value })} />
            </div>
          </div>

          {!internal && (
            <>
              <SecHead letter="B">Client Information</SecHead>
              <div className="grid-2">
                <div className="field">
                  <label>Client *</label>
                  <select value={form.clientId} onChange={(e) => set({ clientId: e.target.value })}>
                    <option value="">Select client</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Agreement</label>
                  <input disabled value={selectedClient?.agreementId || ''} />
                </div>
                <div className="field">
                  <label>Agreement Status</label>
                  <input disabled value={selectedClient ? agreementStatusLabel(selectedClient.agreementStatus) : ''} />
                </div>
                <div className="field">
                  <label>Client Contact</label>
                  <input
                    disabled
                    value={selectedClient
                      ? [selectedClient.contactName, selectedClient.contactPhone].filter(Boolean).join(' · ')
                      : ''}
                  />
                </div>
              </div>
              {selectedClient && (
                selectedClient.agreementStatus === 'ACTIVE'
                  ? <div className="notice">Agreement is Active — this requirement can be activated and posted.</div>
                  : (
                    <div className="notice amber">
                      Agreement is <b>{agreementStatusLabel(selectedClient.agreementStatus)}</b>. You can save this
                      requirement as Draft, but it cannot be activated or posted until the agreement is Active.
                    </div>
                  )
              )}
            </>
          )}

          <SecHead letter="C">Job Description</SecHead>
          <div className="field">
            <label>Full Job Description *</label>
            <textarea rows="3" value={form.jobDescription} onChange={(e) => set({ jobDescription: e.target.value })} />
          </div>
          <div className="field">
            <label>Responsibilities</label>
            <textarea rows="2" placeholder="One per line" value={form.responsibilities} onChange={(e) => set({ responsibilities: e.target.value })} />
          </div>
          <div className="field">
            <label>Qualifications</label>
            <textarea rows="2" value={form.qualifications} onChange={(e) => set({ qualifications: e.target.value })} />
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Education</label>
              <select value={form.education} onChange={(e) => set({ education: e.target.value })}>
                {EDUCATION_LEVELS.map((x) => <option key={x}>{x}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Mandatory Skills * (comma separated)</label>
              <input value={form.skills} placeholder="Java, Spring Boot, SQL" onChange={(e) => set({ skills: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>Good-to-have Skills (comma separated)</label>
            <input value={form.goodToHaveSkills} placeholder="AWS, Docker" onChange={(e) => set({ goodToHaveSkills: e.target.value })} />
          </div>

          <SecHead letter="D">Job Conditions</SecHead>
          <div className="grid-2">
            <div className="field">
              <label>Employment Type *</label>
              <select value={form.employmentType} onChange={(e) => set({ employmentType: e.target.value })}>
                {EMPLOYMENT_TYPES.map((x) => <option key={x}>{x}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Work Mode *</label>
              <select value={form.workMode} onChange={(e) => set({ workMode: e.target.value })}>
                {WORK_MODES.map((x) => <option key={x}>{x}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Work Location *</label>
              <select value={form.location} onChange={(e) => set({ location: e.target.value })}>
                {LOCS.map((x) => <option key={x}>{x}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Preferred Location</label>
              <select value={form.preferredLocation} onChange={(e) => set({ preferredLocation: e.target.value })}>
                <option value="">Any</option>
                {LOCS.map((x) => <option key={x}>{x}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Minimum Experience (yrs) *</label>
              <input type="number" min="0" value={form.expMin} onChange={(e) => set({ expMin: e.target.value })} />
            </div>
            <div className="field">
              <label>Maximum Experience (yrs)</label>
              <input type="number" min="0" value={form.expMax} onChange={(e) => set({ expMax: e.target.value })} />
            </div>
            <div className="field">
              <label>Relevant Experience (yrs)</label>
              <input type="number" min="0" value={form.relevantExperience} onChange={(e) => set({ relevantExperience: e.target.value })} />
            </div>
            <div className="field">
              <label>Joining Timeline *</label>
              <select value={form.joiningTimeline} onChange={(e) => set({ joiningTimeline: e.target.value })}>
                {JOINING_TIMELINES.map((x) => <option key={x}>{x}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Maximum Notice Period</label>
              <select value={form.noticePeriodMax} onChange={(e) => set({ noticePeriodMax: e.target.value })}>
                {NOTICE_PERIODS_MAX.map((x) => <option key={x}>{x}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Job Preference</label>
              <select value={form.jobPreference} onChange={(e) => set({ jobPreference: e.target.value })}>
                {JOB_PREFERENCES.map((x) => <option key={x}>{x}</option>)}
              </select>
            </div>
          </div>

          <SecHead letter="E">Compensation</SecHead>
          <div className="grid-2">
            <div className="field">
              <label>Salary Type</label>
              <select value={form.salaryType} onChange={(e) => set({ salaryType: e.target.value })}>
                {SALARY_TYPES.map((x) => <option key={x}>{x}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Currency</label>
              <select value={form.currency} onChange={(e) => set({ currency: e.target.value })}>
                {CURRENCIES.map((x) => <option key={x}>{x}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Minimum Salary (₹L)</label>
              <input type="number" step="0.5" placeholder="10" value={form.salaryMin} onChange={(e) => set({ salaryMin: e.target.value })} />
            </div>
            <div className="field">
              <label>Maximum Salary (₹L)</label>
              <input type="number" step="0.5" placeholder="15" value={form.salaryMax} onChange={(e) => set({ salaryMax: e.target.value })} />
            </div>
          </div>

          <SecHead letter="F">Assignment</SecHead>
          <div className="grid-2">
            <div className="field">
              <label>Recruiter *</label>
              <select value={form.recruiterId} onChange={(e) => set({ recruiterId: e.target.value })}>
                <option value="">— Not assigned —</option>
                {recruiters.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>TL</label>
              <input value={form.tl} onChange={(e) => set({ tl: e.target.value })} />
            </div>
            <div className="field">
              <label>STL</label>
              <input value={form.stl} onChange={(e) => set({ stl: e.target.value })} />
            </div>
            {!internal && (
              <div className="field">
                <label>BDE</label>
                <select value={form.bdeId} onChange={(e) => set({ bdeId: e.target.value })}>
                  <option value="">— Not assigned —</option>
                  {bdes.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}
          </div>

          <SecHead letter="G">Job Posting</SecHead>
          <div className="field">
            <label>Posting Sources</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
              {POSTING_SOURCES.map((s) => (
                <label key={s} style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 400, fontSize: 12.5 }}>
                  <input
                    type="checkbox"
                    style={{ width: 'auto' }}
                    checked={form.postingSources.includes(s)}
                    onChange={() => toggleSource(s)}
                  />
                  {' '}{s}
                </label>
              ))}
            </div>
          </div>
          <div className="cell-muted" style={{ fontSize: 11.5 }}>
            Posting Status, External Job ID and External URL are managed by the existing Job Posting lifecycle
            (Draft → Ready to Post → Posted / Partially Posted / Failed → Paused → Closed) on the requirement
            page after saving.
          </div>

          {preview && (
            <div className="notice" style={{ marginTop: 12, display: 'block' }}>
              <b>{preview.title || '(untitled)'}</b> — {internal ? 'TeamLink Internal' : selectedClient?.name || '(no client)'}
              {' · '}{preview.location} · {preview.experience} · {preview.salary}
              <div className="small-muted" style={{ marginTop: 6, whiteSpace: 'pre-line' }}>{preview.jobDescription || 'No job description entered yet.'}</div>
            </div>
          )}
          {error && <div className="notice red">{error}</div>}
        </Modal>
      )}

      <Tabs
        style={{ marginBottom: 12 }}
        value={view}
        onChange={setView}
        tabs={[
          ['all', 'All Requirements'],
          ['open', 'Open Requirements'],
          ['agreements', 'Agreement Report'],
        ]}
      />

      {view === 'all' && (
        <>
          <div className="filter-row">
            <input type="text" placeholder="Search title or skill…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
              <option value="">All clients</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="OPEN">Open</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Requirement</th><th>Client</th><th>Location</th><th>Experience</th>
                  <th>Priority</th><th>Openings</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="row-link" onClick={() => navigate(`/requirements/${r.id}`)}>
                    <td>{r.title}</td>
                    <td>{r.internal ? 'TeamLink Internal' : r.client?.name}</td>
                    <td>{r.location || '—'}</td>
                    <td>{r.experience || '—'}</td>
                    <td><span className={`status ${priorityClass(r.priority)}`}>{r.priority}</span></td>
                    <td>{r.openings}</td>
                    <td><span className="status active">{requirementStatusLabel(r.status)}</span></td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan="7" className="small-muted" style={{ padding: 16 }}>No requirements match.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {view === 'open' && (
        <>
          <div className="filter-row">
            <select value={openFilters.dept} onChange={(e) => setOpenFilters((f) => ({ ...f, dept: e.target.value }))}>
              <option value="">All departments</option>
              {DEPTS.map((d) => <option key={d}>{d}</option>)}
            </select>
            <select value={openFilters.client} onChange={(e) => setOpenFilters((f) => ({ ...f, client: e.target.value }))}>
              <option value="">All clients</option>
              {openClientNames.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select value={openFilters.recruiter} onChange={(e) => setOpenFilters((f) => ({ ...f, recruiter: e.target.value }))}>
              <option value="">All recruiters</option>
              {team.filter((t) => t.role === 'RECRUITER').map((t) => <option key={t.id}>{t.name}</option>)}
            </select>
            <select value={openFilters.priority} onChange={(e) => setOpenFilters((f) => ({ ...f, priority: e.target.value }))}>
              <option value="">All priorities</option>
              {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
            </select>
            <span className="cell-muted" style={{ alignSelf: 'center', fontSize: 12 }}>
              {openRows.length} open requirement(s)
            </span>
          </div>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Requirement ID</th><th>Job Title</th><th>Client / Internal</th><th>Department</th>
                  <th>Location</th><th>Openings</th><th>Filled</th><th>Remaining</th><th>Matching</th>
                  <th>Recruiter</th><th>TL</th><th>BDE</th><th>Priority</th><th>Created</th>
                  <th>Closing</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {openRows.map((r) => (
                  <tr key={r.id} className="row-link" onClick={() => navigate(`/requirements/${r.id}`)}>
                    <td><b>{r.id}</b></td>
                    <td>{r.title}</td>
                    <td className="cell-muted">{r.internal ? 'Internal' : r.client?.name || '—'}</td>
                    <td className="cell-muted">{r.department || '—'}</td>
                    <td className="cell-muted">{r.location || '—'}</td>
                    <td className="cell-muted">{r.openings || 1}</td>
                    <td className="cell-muted">{r.filled ?? 0}</td>
                    <td><b>{r.remaining ?? r.openings}</b></td>
                    <td><span className="link-btn">{r.matchingCandidates ?? 0}</span></td>
                    <td className="cell-muted">{r.recruiter?.name || '—'}</td>
                    <td className="cell-muted">{r.tl || '—'}</td>
                    <td className="cell-muted">{r.bde?.name || '—'}</td>
                    <td className="cell-muted">{r.priority || '—'}</td>
                    <td className="cell-muted">{fmtDate(r.createdAt)}</td>
                    <td className="cell-muted">{fmtDate(r.closingDate)}</td>
                    <td><span className="status active">{requirementStatusLabel(r.status)}</span></td>
                  </tr>
                ))}
                {openRows.length === 0 && (
                  <tr>
                    <td colSpan="16" className="small-muted" style={{ padding: 16 }}>
                      No open requirements in your scope.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {view === 'agreements' && (
        agreementMonths.keys.length === 0
          ? <div className="empty-mini">No agreement activity recorded yet.</div>
          : (
            <>
              <div className="tbl-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Month</th><th>Agreements Created</th><th>Signed</th>
                      <th>Active</th><th>Expired</th><th>Pending</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agreementMonths.keys.map((k) => (
                      <tr key={k}>
                        <td><b>{k}</b></td>
                        <td>{agreementMonths.months[k].created}</td>
                        <td className="cell-muted">{agreementMonths.months[k].signed}</td>
                        <td className="cell-muted">{agreementMonths.months[k].active}</td>
                        <td className="cell-muted">{agreementMonths.months[k].expired}</td>
                        <td className="cell-muted">{agreementMonths.months[k].pending}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="cell-muted" style={{ fontSize: 11.5, marginTop: 6 }}>
                Computed from each client&apos;s agreement history — months with no activity are not shown.
              </div>
            </>
          )
      )}
    </div>
  );
}
