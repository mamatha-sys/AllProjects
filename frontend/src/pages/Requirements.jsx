import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import {
  DEPTS, LOCS, PRIORITIES, REQUIREMENT_TYPES, EDUCATION_LEVELS, EMPLOYMENT_TYPES, WORK_MODES,
  JOINING_TIMELINES, NOTICE_PERIODS_MAX, JOB_PREFERENCES, SALARY_TYPES, CURRENCIES,
  requirementStatusLabel, agreementStatusLabel,
} from '../atsVocab';

// The prototype's Create Requirement modal (openAddRequirementModal, line 6956)
// in its section order: A Basic Information, B Client Information,
// C Job Description, D Job Conditions, E Compensation, F Assignment.
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
};

function priorityClass(priority) {
  if (priority === 'Urgent' || priority === 'High') return 'priority-high';
  if (priority === 'Medium') return 'priority-medium';
  return 'priority-low';
}

export default function Requirements() {
  const [requirements, setRequirements] = useState([]);
  const [clients, setClients] = useState([]);
  const [team, setTeam] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  // The prototype's filter row: search, client, status.
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

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
    };
  }

  async function save(status) {
    setError('');
    try {
      await api.post('/requirements', payload(status));
    } catch (err) {
      return setError(err.response?.data?.error || 'Could not save this requirement');
    }
    setForm(EMPTY);
    setShowForm(false);
    load();
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Jobs / Requirements</h1>
          <div className="page-sub">{requirements.length} requirements</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancel' : 'Add Requirement'}
        </button>
      </div>

      {showForm && (
        <form className="card section" onSubmit={(e) => { e.preventDefault(); save('OPEN'); }}>
          <h3>A. Basic Information</h3>
          <div className="grid-2">
            <label className="field">
              <span>Requirement Type *</span>
              <select value={form.type} onChange={(e) => set({ type: e.target.value })}>
                {REQUIREMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Job Title *</span>
              <input required value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Senior Java Developer" />
            </label>
            <label className="field">
              <span>Department *</span>
              <select value={form.department} onChange={(e) => set({ department: e.target.value })}>
                {DEPTS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Number of Openings *</span>
              <input type="number" min="1" value={form.openings} onChange={(e) => set({ openings: e.target.value })} />
            </label>
            <label className="field">
              <span>Priority *</span>
              <select value={form.priority} onChange={(e) => set({ priority: e.target.value })}>
                {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Closing Date</span>
              <input type="date" value={form.closingDate} onChange={(e) => set({ closingDate: e.target.value })} />
            </label>
          </div>

          {!internal && (
            <>
              <h3>B. Client Information</h3>
              <div className="grid-2">
                <label className="field">
                  <span>Client *</span>
                  <select required value={form.clientId} onChange={(e) => set({ clientId: e.target.value })}>
                    <option value="">Select client</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Agreement Status</span>
                  <input disabled value={selectedClient ? agreementStatusLabel(selectedClient.agreementStatus) : ''} />
                </label>
              </div>
              {selectedClient && selectedClient.agreementStatus !== 'ACTIVE' && (
                <div className="error-text">
                  Agreement is {agreementStatusLabel(selectedClient.agreementStatus)}. You can save this requirement as Draft, but it
                  cannot be activated or posted until the agreement is Active.
                </div>
              )}
            </>
          )}

          <h3>C. Job Description</h3>
          <label className="field">
            <span>Full Job Description *</span>
            <textarea rows="3" value={form.jobDescription} onChange={(e) => set({ jobDescription: e.target.value })} />
          </label>
          <label className="field">
            <span>Responsibilities</span>
            <textarea rows="2" placeholder="One per line" value={form.responsibilities} onChange={(e) => set({ responsibilities: e.target.value })} />
          </label>
          <label className="field">
            <span>Qualifications</span>
            <textarea rows="2" value={form.qualifications} onChange={(e) => set({ qualifications: e.target.value })} />
          </label>
          <div className="grid-2">
            <label className="field">
              <span>Education</span>
              <select value={form.education} onChange={(e) => set({ education: e.target.value })}>
                {EDUCATION_LEVELS.map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Mandatory Skills * (comma separated)</span>
              <input value={form.skills} placeholder="Java, Spring Boot, SQL" onChange={(e) => set({ skills: e.target.value })} />
            </label>
          </div>
          <label className="field">
            <span>Good-to-have Skills (comma separated)</span>
            <input value={form.goodToHaveSkills} placeholder="AWS, Docker" onChange={(e) => set({ goodToHaveSkills: e.target.value })} />
          </label>

          <h3>D. Job Conditions</h3>
          <div className="grid-2">
            <label className="field">
              <span>Employment Type *</span>
              <select value={form.employmentType} onChange={(e) => set({ employmentType: e.target.value })}>
                {EMPLOYMENT_TYPES.map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Work Mode *</span>
              <select value={form.workMode} onChange={(e) => set({ workMode: e.target.value })}>
                {WORK_MODES.map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Work Location *</span>
              <select value={form.location} onChange={(e) => set({ location: e.target.value })}>
                {LOCS.map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Preferred Location</span>
              <select value={form.preferredLocation} onChange={(e) => set({ preferredLocation: e.target.value })}>
                <option value="">Any</option>
                {LOCS.map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Minimum Experience (yrs) *</span>
              <input type="number" min="0" value={form.expMin} onChange={(e) => set({ expMin: e.target.value })} />
            </label>
            <label className="field">
              <span>Maximum Experience (yrs)</span>
              <input type="number" min="0" value={form.expMax} onChange={(e) => set({ expMax: e.target.value })} />
            </label>
            <label className="field">
              <span>Relevant Experience (yrs)</span>
              <input type="number" min="0" value={form.relevantExperience} onChange={(e) => set({ relevantExperience: e.target.value })} />
            </label>
            <label className="field">
              <span>Joining Timeline *</span>
              <select value={form.joiningTimeline} onChange={(e) => set({ joiningTimeline: e.target.value })}>
                {JOINING_TIMELINES.map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Maximum Notice Period</span>
              <select value={form.noticePeriodMax} onChange={(e) => set({ noticePeriodMax: e.target.value })}>
                {NOTICE_PERIODS_MAX.map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Job Preference</span>
              <select value={form.jobPreference} onChange={(e) => set({ jobPreference: e.target.value })}>
                {JOB_PREFERENCES.map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>
          </div>

          <h3>E. Compensation</h3>
          <div className="grid-2">
            <label className="field">
              <span>Salary Type</span>
              <select value={form.salaryType} onChange={(e) => set({ salaryType: e.target.value })}>
                {SALARY_TYPES.map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Currency</span>
              <select value={form.currency} onChange={(e) => set({ currency: e.target.value })}>
                {CURRENCIES.map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Minimum Salary (₹L)</span>
              <input type="number" step="0.5" placeholder="10" value={form.salaryMin} onChange={(e) => set({ salaryMin: e.target.value })} />
            </label>
            <label className="field">
              <span>Maximum Salary (₹L)</span>
              <input type="number" step="0.5" placeholder="15" value={form.salaryMax} onChange={(e) => set({ salaryMax: e.target.value })} />
            </label>
          </div>

          <h3>F. Assignment</h3>
          <div className="grid-2">
            <label className="field">
              <span>Recruiter *</span>
              <select value={form.recruiterId} onChange={(e) => set({ recruiterId: e.target.value })}>
                <option value="">— Not assigned —</option>
                {recruiters.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span>TL</span>
              <input value={form.tl} onChange={(e) => set({ tl: e.target.value })} />
            </label>
            <label className="field">
              <span>STL</span>
              <input value={form.stl} onChange={(e) => set({ stl: e.target.value })} />
            </label>
            {!internal && (
              <label className="field">
                <span>BDE</span>
                <select value={form.bdeId} onChange={(e) => set({ bdeId: e.target.value })}>
                  <option value="">— Not assigned —</option>
                  {bdes.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
            )}
          </div>

          {error && <div className="error-text">{error}</div>}
          <div className="qa-row">
            <button className="btn btn-sm" type="button" onClick={() => save('DRAFT')}>Save Draft</button>
            <button className="btn btn-primary btn-sm" type="submit">Save &amp; Activate</button>
          </div>
        </form>
      )}

      <div className="filter-row">
        <input
          type="text"
          placeholder="Search title or skill…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
          <option value="">All clients</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="OPEN">Open</option>
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
              <tr key={r.id} className="row-link">
                <td><Link to={`/requirements/${r.id}`}>{r.title}</Link></td>
                <td>{r.internal ? 'TeamLink Internal' : r.client?.name}</td>
                <td>{r.location || '—'}</td>
                <td>{r.experience || '—'}</td>
                <td><span className={`status ${priorityClass(r.priority)}`}>{r.priority}</span></td>
                <td>{r.openings}</td>
                <td><span className="status">{requirementStatusLabel(r.status)}</span></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="7" className="small-muted">No requirements match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
