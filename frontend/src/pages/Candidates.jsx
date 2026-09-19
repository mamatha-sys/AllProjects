import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';
import {
  ALL_STAGE_CODES, stageLabel, LIFE_STATUSES, DEPTS, LOCS,
  CANDIDATE_SOURCES, CANDIDATE_FIRST_SOURCES, CANDIDATE_FILTER_SOURCES, APPLICATION_METHODS,
  CANDIDATE_GENDERS, CANDIDATE_NOTICE_PERIODS, CANDIDATE_AVAILABILITY, CANDIDATE_JOB_PREFERENCES,
  CANDIDATE_EMPLOYMENT_TYPES, CANDIDATE_WORK_MODES, CANDIDATE_EDUCATION,
} from '../atsVocab';
import {
  Modal, SecHead, Tabs, Avatar, StatusBadge, LifeBadge, aiClass, KV, fmtDate,
} from './ats/atsUi';

// The prototype's Add Candidate modal (openAddCandidateModal, line 8150),
// section by section: A Personal, B Professional, C Education, D Skills,
// E Resume, F Source, G Requirement.
const EMPTY = {
  firstName: '', lastName: '', phone: '', email: '', dob: '', gender: '',
  location: LOCS[0], preferredLocation: '',
  currentCompany: '', currentDesignation: '', experienceYears: '', relevantExperienceYears: '',
  currentSalary: '', expectedSalary: '', noticePeriod: '30 Days',
  availability: 'Available after notice period', jobPreference: 'Permanent',
  preferredEmploymentType: 'Full Time', preferredWorkMode: 'Hybrid',
  education: 'B.Tech', specialization: '', institute: '', passingYear: '',
  skills: '', goodToHaveSkills: '', technicalSkills: '', softSkills: '',
  resumeName: '', source: 'Direct', firstSource: '', sourceCampaign: '',
  applicationMethod: 'Manual', requirementId: '',
};

const EMPTY_FILTERS = {
  search: '', department: '', clientId: '', requirementId: '', recruiter: '',
  tl: '', bde: '', location: '', source: '', stage: '', status: '', appliedOn: '',
};

export default function Candidates() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [candidates, setCandidates] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [team, setTeam] = useState([]);
  const [form, setForm] = useState(EMPTY);
  // ?stage= deep-links from the ATS dashboard's "Pipeline by stage" rows.
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS, stage: params.get('stage') || '' });
  const [view, setView] = useState('pipeline');
  const [showForm, setShowForm] = useState(false);
  const [duplicate, setDuplicate] = useState(null);
  const [preview, setPreview] = useState(null);
  const [resumePanel, setResumePanel] = useState(null);
  const [error, setError] = useState('');

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setFilter = (patch) => setFilters((f) => ({ ...f, ...patch }));

  function load() {
    api.get('/candidates').then((res) => setCandidates(res.data));
  }
  useEffect(() => {
    load();
    api.get('/requirements').then((res) => setRequirements(res.data)).catch(() => setRequirements([]));
    api.get('/ats/team').then((res) => setTeam(res.data)).catch(() => setTeam([]));
  }, []);

  const clientOptions = useMemo(() => {
    const seen = new Map();
    requirements.forEach((r) => { if (r.client) seen.set(r.client.id, r.client.name); });
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [requirements]);

  // Requirement-derived filters match if ANY of the candidate's applications
  // match — the prototype's renderCandidateList().
  const rows = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return candidates.filter((c) => {
      if (q && !(`${c.name} ${c.skills || ''}`.toLowerCase().includes(q))) return false;
      if (filters.location && c.location !== filters.location) return false;
      if (filters.source && c.source !== filters.source) return false;
      if (filters.stage && c.currentStage !== filters.stage) return false;
      if (filters.status && c.lifeStatus !== filters.status) return false;

      const apps = c.applications || [];
      const any = (pred) => apps.length > 0 && apps.some(pred);
      if (filters.department && !any((a) => a.requirement?.department === filters.department)) return false;
      if (filters.clientId && !any((a) => a.requirement?.clientId === filters.clientId)) return false;
      if (filters.requirementId && !any((a) => a.requirementId === filters.requirementId)) return false;
      if (filters.recruiter && !any((a) => a.requirement?.recruiter?.name === filters.recruiter)) return false;
      if (filters.tl && !any((a) => a.requirement?.tl === filters.tl)) return false;
      if (filters.bde && !any((a) => a.requirement?.bde?.name === filters.bde)) return false;
      if (filters.appliedOn && !any((a) => String(a.createdAt || '').slice(0, 10) === filters.appliedOn)) return false;
      return true;
    });
  }, [candidates, filters]);

  // rejectedRows() — rejection never removes the Candidate Master record;
  // these rows are joins onto applications that carry a rejection.
  const rejected = useMemo(() => {
    const out = [];
    candidates.forEach((c) => (c.applications || []).forEach((a) => {
      if (a.stage === 'REJECTED') out.push({ candidate: c, app: a });
    }));
    return out;
  }, [candidates]);

  // sourceAnalyticsHtml() — computed live from the candidate and application
  // records, first source vs latest source tracked per candidate.
  const sourceRows = useMemo(() => {
    const by = {};
    const bucket = (k) => {
      by[k] = by[k] || { first: 0, latest: 0, apps: 0, auto: 0, manual: 0 };
      return by[k];
    };
    candidates.forEach((c) => {
      const first = c.firstSource || c.source || 'Unknown';
      const latest = c.source || first;
      bucket(first).first += 1;
      bucket(latest).latest += 1;
    });
    let auto = 0; let manual = 0; let autoPending = 0;
    candidates.forEach((c) => (c.applications || []).forEach((a) => {
      const b = bucket(a.source || 'Unknown');
      b.apps += 1;
      if ((a.applicationMethod || 'Manual') === 'Auto-Apply') {
        b.auto += 1; auto += 1;
        if (a.stage === 'NEW') autoPending += 1;
      } else { b.manual += 1; manual += 1; }
    }));
    const autoOk = candidates.reduce((n, c) => n + (c.applications || [])
      .filter((a) => a.applicationMethod === 'Auto-Apply' && a.stage !== 'REJECTED').length, 0);
    const keys = Object.keys(by).sort((x, y) => by[y].latest - by[x].latest);
    return { by, keys, auto, manual, autoOk, autoPending };
  }, [candidates]);

  async function checkDuplicate() {
    if (!form.email && !form.phone) return setDuplicate(null);
    const res = await api.get('/candidates/check-duplicate', { params: { email: form.email, phone: form.phone } });
    setDuplicate(res.data.duplicate ? res.data.matches[0] : null);
  }

  // The prototype's acComputePreview(): a deterministic match against the
  // selected requirement, shown before the record is saved.
  async function calculateMatch() {
    setPreview(null);
    if (!form.requirementId) {
      return setPreview({ warn: 'Select a requirement first to calculate a match score.' });
    }
    if (!form.skills.trim()) {
      return setPreview({ warn: 'Enter at least one mandatory skill — no score is shown without it.' });
    }
    try {
      const res = await api.post('/requirements/preview-match', {
        requirementId: form.requirementId,
        candidate: { ...form, experienceYears: form.experienceYears },
      });
      setPreview({ ...res.data, requirementTitle: requirements.find((r) => r.id === form.requirementId)?.title });
    } catch {
      setPreview({ warn: 'Could not calculate a match score right now.' });
    }
  }

  async function createCandidate(e) {
    e.preventDefault();
    setError('');
    const body = {
      ...form,
      name: `${form.firstName} ${form.lastName}`.trim(),
      preferredLocation: form.preferredLocation || form.location,
      firstSource: form.firstSource || form.source,
      allowDuplicate: Boolean(duplicate),
    };
    try {
      await api.post('/candidates', body);
    } catch (err) {
      if (err.response?.status === 409) {
        return setDuplicate(err.response.data.matches?.[0] || { name: err.response.data.error });
      }
      return setError(err.response?.data?.error || 'Could not save this candidate');
    }
    closeForm();
    load();
  }

  function closeForm() {
    setForm(EMPTY);
    setDuplicate(null);
    setPreview(null);
    setResumePanel(null);
    setError('');
    setShowForm(false);
  }

  // acResumePicked(): a labelled simulation — the panel only echoes what the
  // form already holds, and no score is invented without a resume.
  function resumePicked(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) { setResumePanel(null); set({ resumeName: '' }); return; }
    set({ resumeName: file.name });
    const skills = form.skills.split(',').map((s) => s.trim()).filter(Boolean);
    const exp = parseFloat(form.experienceYears) || 0;
    const score = skills.length ? Math.round(Math.min(95, 55 + skills.length * 6 + exp * 2)) : null;
    setResumePanel({ name: file.name, score, skills, exp: form.experienceYears });
  }

  const tlNames = [...new Set(requirements.map((r) => r.tl).filter(Boolean))];
  const pickedReq = requirements.find((r) => r.id === form.requirementId);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Candidates &amp; Pipeline</h1>
          <div className="page-sub">{candidates.length} candidates in the database</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>Add Candidate</button>
      </div>

      {showForm && (
        <Modal
          title="Add Candidate"
          size="xwide"
          onClose={closeForm}
          footer={(
            <>
              <button type="button" className="btn" onClick={closeForm}>Cancel</button>
              <button type="button" className="btn" onClick={calculateMatch}>Calculate Match</button>
              <button type="submit" form="addCandidateForm" className="btn btn-primary">Save Candidate</button>
            </>
          )}
        >
          <form id="addCandidateForm" onSubmit={createCandidate}>
            <SecHead letter="A" first>Personal</SecHead>
            <div className="grid-2">
              <div className="field">
                <label>First Name *</label>
                <input required value={form.firstName} onChange={(e) => set({ firstName: e.target.value })} />
              </div>
              <div className="field">
                <label>Last Name</label>
                <input value={form.lastName} onChange={(e) => set({ lastName: e.target.value })} />
              </div>
              <div className="field">
                <label>Mobile *</label>
                <input required placeholder="10-digit mobile" value={form.phone} onBlur={checkDuplicate} onChange={(e) => set({ phone: e.target.value })} />
              </div>
              <div className="field">
                <label>Email *</label>
                <input required value={form.email} onBlur={checkDuplicate} onChange={(e) => set({ email: e.target.value })} />
              </div>
              <div className="field">
                <label>Date of Birth</label>
                <input type="date" value={form.dob} onChange={(e) => set({ dob: e.target.value })} />
              </div>
              <div className="field">
                <label>Gender</label>
                <select value={form.gender} onChange={(e) => set({ gender: e.target.value })}>
                  {CANDIDATE_GENDERS.map((g) => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Current Location</label>
                <select value={form.location} onChange={(e) => set({ location: e.target.value })}>
                  {LOCS.map((l) => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Preferred Location</label>
                <select value={form.preferredLocation} onChange={(e) => set({ preferredLocation: e.target.value })}>
                  <option value="">Same as current</option>
                  {LOCS.map((l) => <option key={l}>{l}</option>)}
                </select>
              </div>
            </div>

            {/* The prototype writes its duplicate warning into #acDupWarning — an
                element its modal never renders, so the warning is dead code
                there. The intent is implemented here: the warning appears in the
                modal, with both of the prototype's follow-up actions. */}
            {duplicate && (
              <div className="notice amber">
                Candidate already exists — <strong>{duplicate.name}</strong>{duplicate.id ? ` (${duplicate.id})` : ''}.
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  {duplicate.id && (
                    <button type="button" className="btn btn-sm" onClick={() => { closeForm(); navigate(`/candidates/${duplicate.id}`); }}>
                      Open Existing Profile
                    </button>
                  )}
                  <button type="submit" form="addCandidateForm" className="btn btn-sm btn-primary">
                    Add New Application to This Candidate
                  </button>
                </div>
              </div>
            )}

            <SecHead letter="B">Professional</SecHead>
            <div className="grid-2">
              <div className="field">
                <label>Current Company</label>
                <input value={form.currentCompany} onChange={(e) => set({ currentCompany: e.target.value })} />
              </div>
              <div className="field">
                <label>Current Designation</label>
                <input value={form.currentDesignation} onChange={(e) => set({ currentDesignation: e.target.value })} />
              </div>
              <div className="field">
                <label>Total Experience (yrs)</label>
                <input type="number" step="0.5" value={form.experienceYears} onChange={(e) => set({ experienceYears: e.target.value })} />
              </div>
              <div className="field">
                <label>Relevant Experience (yrs)</label>
                <input type="number" step="0.5" value={form.relevantExperienceYears} onChange={(e) => set({ relevantExperienceYears: e.target.value })} />
              </div>
              <div className="field">
                <label>Current Salary (₹L)</label>
                <input placeholder="e.g. 12L" value={form.currentSalary} onChange={(e) => set({ currentSalary: e.target.value })} />
              </div>
              <div className="field">
                <label>Expected Salary (₹L)</label>
                <input placeholder="e.g. 18L" value={form.expectedSalary} onChange={(e) => set({ expectedSalary: e.target.value })} />
              </div>
              <div className="field">
                <label>Notice Period</label>
                <select value={form.noticePeriod} onChange={(e) => set({ noticePeriod: e.target.value })}>
                  {CANDIDATE_NOTICE_PERIODS.map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Availability</label>
                <select value={form.availability} onChange={(e) => set({ availability: e.target.value })}>
                  {CANDIDATE_AVAILABILITY.map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Job Preference</label>
                <select value={form.jobPreference} onChange={(e) => set({ jobPreference: e.target.value })}>
                  {CANDIDATE_JOB_PREFERENCES.map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Employment Type</label>
                <select value={form.preferredEmploymentType} onChange={(e) => set({ preferredEmploymentType: e.target.value })}>
                  {CANDIDATE_EMPLOYMENT_TYPES.map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Preferred Work Mode</label>
                <select value={form.preferredWorkMode} onChange={(e) => set({ preferredWorkMode: e.target.value })}>
                  {CANDIDATE_WORK_MODES.map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
            </div>

            <SecHead letter="C">Education</SecHead>
            <div className="grid-2">
              <div className="field">
                <label>Highest Qualification</label>
                <select value={form.education} onChange={(e) => set({ education: e.target.value })}>
                  {CANDIDATE_EDUCATION.map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Specialization</label>
                <input placeholder="e.g. Computer Science" value={form.specialization} onChange={(e) => set({ specialization: e.target.value })} />
              </div>
              <div className="field">
                <label>Institute</label>
                <input value={form.institute} onChange={(e) => set({ institute: e.target.value })} />
              </div>
              <div className="field">
                <label>Passing Year</label>
                <input type="number" placeholder="2019" value={form.passingYear} onChange={(e) => set({ passingYear: e.target.value })} />
              </div>
            </div>

            <SecHead letter="D">Skills</SecHead>
            <div className="field">
              <label>Mandatory Skills * (comma separated)</label>
              <input required placeholder="Java, Spring Boot, SQL" value={form.skills} onChange={(e) => set({ skills: e.target.value })} />
            </div>
            <div className="grid-2">
              <div className="field">
                <label>Good-to-have Skills</label>
                <input placeholder="AWS, Docker" value={form.goodToHaveSkills} onChange={(e) => set({ goodToHaveSkills: e.target.value })} />
              </div>
              <div className="field">
                <label>Technical Skills</label>
                <input placeholder="Git, Jenkins" value={form.technicalSkills} onChange={(e) => set({ technicalSkills: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>Soft Skills</label>
              <input placeholder="Communication, Stakeholder management" value={form.softSkills} onChange={(e) => set({ softSkills: e.target.value })} />
            </div>

            <SecHead letter="E">Resume</SecHead>
            <div className="grid-2">
              <div className="field">
                <label>Upload Resume</label>
                <input type="file" onChange={resumePicked} />
              </div>
              <div className="field">
                <label>Resume Name</label>
                <input readOnly placeholder="No file chosen" value={form.resumeName} />
              </div>
            </div>
            {resumePanel ? (
              <div>
                <div className="notice">
                  Resume attached — <b>{resumePanel.name}</b>. <span className="status pending">AI parsing: Simulated</span>
                </div>
                <KV k="Resume Score">{resumePanel.score != null ? `${resumePanel.score}%` : '— (add skills to compute)'}</KV>
                <KV k="AI-parsed skills">{resumePanel.skills.length ? resumePanel.skills.join(', ') : '—'}</KV>
                <KV k="AI-parsed experience">{resumePanel.exp ? `${resumePanel.exp} yrs` : '—'}</KV>
                <div className="cell-muted" style={{ fontSize: 11.5, fontStyle: 'italic' }}>
                  Parsed values mirror what you entered — this prototype does not read the file contents.
                </div>
              </div>
            ) : (
              <div className="cell-muted" style={{ fontSize: 12 }}>
                Resume Score and AI-parsed fields appear only after a resume is attached — no score is shown for a candidate without one.
              </div>
            )}

            <SecHead letter="F">Source</SecHead>
            <div className="grid-2">
              <div className="field">
                <label>Source</label>
                <select value={form.source} onChange={(e) => set({ source: e.target.value })}>
                  {CANDIDATE_SOURCES.map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
              <div className="field">
                <label>First Source</label>
                <select value={form.firstSource} onChange={(e) => set({ firstSource: e.target.value })}>
                  <option value="">Same as source</option>
                  {CANDIDATE_FIRST_SOURCES.map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Source Campaign</label>
                <input placeholder="e.g. Sep-2026 Java drive" value={form.sourceCampaign} onChange={(e) => set({ sourceCampaign: e.target.value })} />
              </div>
              <div className="field">
                <label>Application Method</label>
                <select value={form.applicationMethod} onChange={(e) => set({ applicationMethod: e.target.value })}>
                  {APPLICATION_METHODS.map((x) => <option key={x}>{x}</option>)}
                </select>
              </div>
            </div>

            <SecHead letter="G">Requirement</SecHead>
            <div className="grid-2">
              <div className="field">
                <label>Apply to Requirement</label>
                <select value={form.requirementId} onChange={(e) => set({ requirementId: e.target.value })}>
                  <option value="">None — add to database only</option>
                  {requirements.filter((r) => r.status !== 'CLOSED').map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title} — {r.internal ? 'TeamLink Internal' : r.client?.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Requirement ID / Client</label>
                <input
                  readOnly
                  placeholder="—"
                  value={pickedReq ? `${pickedReq.id} · ${pickedReq.internal ? 'TeamLink Internal' : pickedReq.client?.name || '—'}` : ''}
                />
              </div>
            </div>
            {preview ? (
              preview.warn
                ? <div className="notice amber">{preview.warn}</div>
                : (
                  <div>
                    <KV k="AI Match Score"><span style={{ fontWeight: 600 }}>{preview.overall}%</span></KV>
                    <KV k="Matched mandatory skills">{(preview.matchedSkills || []).join(', ') || 'none'}</KV>
                    <KV k="Missing mandatory skills">{(preview.missingSkills || []).join(', ') || 'none'}</KV>
                    <KV k="AI Interview"><span className="status pending">Required</span></KV>
                    <div className="cell-muted" style={{ fontSize: 11.5 }}>
                      Deterministic score against {preview.requirementTitle}.
                    </div>
                  </div>
                )
            ) : (
              <div className="cell-muted" style={{ fontSize: 12 }}>
                AI Match Score is calculated against the selected requirement once mandatory skills and
                experience are filled in. AI Interview status starts as <b>Required</b>.
              </div>
            )}
            {error && <div className="notice red">{error}</div>}
          </form>
        </Modal>
      )}

      <div className="filter-row">
        <input type="text" placeholder="Search name or skill…" value={filters.search} onChange={(e) => setFilter({ search: e.target.value })} />
        <select value={filters.department} onChange={(e) => setFilter({ department: e.target.value })}>
          <option value="">All departments</option>
          {DEPTS.map((d) => <option key={d}>{d}</option>)}
        </select>
        <select value={filters.clientId} onChange={(e) => setFilter({ clientId: e.target.value })}>
          <option value="">All clients</option>
          {clientOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select value={filters.requirementId} onChange={(e) => setFilter({ requirementId: e.target.value })}>
          <option value="">All requirements</option>
          {requirements.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
        </select>
        <select value={filters.recruiter} onChange={(e) => setFilter({ recruiter: e.target.value })}>
          <option value="">All recruiters</option>
          {team.filter((t) => t.role === 'RECRUITER').map((t) => <option key={t.id}>{t.name}</option>)}
        </select>
        <select value={filters.tl} onChange={(e) => setFilter({ tl: e.target.value })}>
          <option value="">All TLs</option>
          {tlNames.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select value={filters.bde} onChange={(e) => setFilter({ bde: e.target.value })}>
          <option value="">All BDEs</option>
          {team.filter((t) => t.role === 'BDE').map((t) => <option key={t.id}>{t.name}</option>)}
        </select>
        <select value={filters.location} onChange={(e) => setFilter({ location: e.target.value })}>
          <option value="">All locations</option>
          {LOCS.map((l) => <option key={l}>{l}</option>)}
        </select>
        <select value={filters.source} onChange={(e) => setFilter({ source: e.target.value })}>
          <option value="">All sources</option>
          {CANDIDATE_FILTER_SOURCES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={filters.stage} onChange={(e) => setFilter({ stage: e.target.value })}>
          <option value="">All stages</option>
          {ALL_STAGE_CODES.map((s) => <option key={s} value={s}>{stageLabel(s)}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => setFilter({ status: e.target.value })}>
          <option value="">All statuses</option>
          {LIFE_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <input type="date" title="Applied on" value={filters.appliedOn} onChange={(e) => setFilter({ appliedOn: e.target.value })} />
        <button className="btn btn-sm" onClick={() => setFilters(EMPTY_FILTERS)}>Clear</button>
      </div>

      <Tabs
        style={{ marginBottom: 12 }}
        value={view}
        onChange={setView}
        tabs={[
          ['pipeline', 'Pipeline'],
          ['rejected', `Rejected (${rejected.length})`],
          ['sources', 'Source Analytics'],
        ]}
      />

      {view === 'pipeline' && (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Candidate</th><th>ID</th><th>Current Stage</th><th>Owner</th><th>Next Action</th>
                <th>Due Date</th><th>Match Score</th><th>Status</th><th>AI Interview</th><th>Follow-up</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="row-link" onClick={() => navigate(`/candidates/${c.id}`)}>
                  <td><Avatar name={c.name} />{c.name}</td>
                  <td>{c.id}</td>
                  <td><StatusBadge stage={c.currentStage} label={c.currentStageLabel} /></td>
                  <td className="cell-muted">{c.owner || '—'}</td>
                  <td className="cell-muted">{c.nextAction || '—'}</td>
                  <td className="cell-muted">
                    {fmtDate(c.dueDate)}
                    {c.overdue && <> <span className="status rejected">Overdue</span></>}
                  </td>
                  <td>{c.matchScore != null ? `${c.matchScore}%` : '—'}</td>
                  <td><LifeBadge status={c.lifeStatus} /></td>
                  <td>
                    {c.currentStage
                      ? <span className={`status ${aiClass(c.aiInterviewStatus)}`}>{c.aiInterviewStatus}</span>
                      : <span className="cell-muted">—</span>}
                  </td>
                  {/* Follow-up logging is not implemented yet — the column is the
                      prototype's, the action behind it is still to come. */}
                  <td className="cell-muted">—</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan="10" className="small-muted" style={{ padding: 16 }}>No candidates match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {view === 'rejected' && (
        <>
          <div className="cell-muted" style={{ fontSize: 12, marginBottom: 8 }}>
            Rejected candidates stay in the Candidate Master and remain searchable and matchable for other
            requirements. Internal rejection reasoning is never shown to client users.
          </div>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Candidate</th><th>Candidate ID</th><th>Requirement</th><th>Client</th><th>Previous Stage</th>
                  <th>Rejected By</th><th>Rejected Side</th><th>Reason</th><th>Detailed Reason</th>
                  <th>Rejected Date</th><th>Recruiter</th><th>BDE</th><th>TL</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rejected.map(({ candidate, app }) => (
                  <tr key={app.id}>
                    <td>{candidate.name}</td>
                    <td className="cell-muted">{candidate.id}</td>
                    <td>{app.requirement?.title || '—'}</td>
                    <td className="cell-muted">{app.requirement?.client?.name || '—'}</td>
                    <td className="cell-muted">—</td>
                    <td className="cell-muted">—</td>
                    <td className="cell-muted">—</td>
                    <td className="cell-muted">—</td>
                    <td>—</td>
                    <td className="cell-muted">{fmtDate(app.updatedAt)}</td>
                    <td className="cell-muted">{app.requirement?.recruiter?.name || '—'}</td>
                    <td className="cell-muted">{app.requirement?.bde?.name || '—'}</td>
                    <td className="cell-muted">{app.requirement?.tl || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn btn-sm" onClick={() => navigate(`/candidates/${candidate.id}`)}>View Profile</button>{' '}
                      <button className="btn btn-sm" onClick={() => navigate(`/candidates/${candidate.id}?tab=rejection`)}>Rejection History</button>{' '}
                      <button className="btn btn-sm" onClick={() => navigate(`/candidates/${candidate.id}?tab=matching`)}>Other Matches</button>
                    </td>
                  </tr>
                ))}
                {rejected.length === 0 && (
                  <tr><td colSpan="14" className="small-muted" style={{ padding: 16 }}>No rejected candidates in your scope.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {view === 'sources' && (
        <>
          <div className="section-label">Auto-apply</div>
          <div className="cell-muted" style={{ fontSize: 12.5, marginBottom: 10 }}>
            Total auto-apply: <b>{sourceRows.auto}</b> · Successful: <b>{sourceRows.autoOk}</b>
            {' '}· Pending: <b>{sourceRows.autoPending}</b> · Manual applications: <b>{sourceRows.manual}</b>
          </div>
          <div className="section-label">Source-wise candidates</div>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Source</th><th>Candidates (latest source)</th><th>Candidates (first source)</th>
                  <th>Applications</th><th>Auto-apply</th><th>Manual</th>
                </tr>
              </thead>
              <tbody>
                {sourceRows.keys.map((k) => (
                  <tr
                    key={k}
                    className="row-link"
                    onClick={() => { setView('pipeline'); setFilter({ source: k }); }}
                  >
                    <td><b>{k}</b></td>
                    <td>{sourceRows.by[k].latest}</td>
                    <td className="cell-muted">{sourceRows.by[k].first}</td>
                    <td className="cell-muted">{sourceRows.by[k].apps}</td>
                    <td className="cell-muted">{sourceRows.by[k].auto}</td>
                    <td className="cell-muted">{sourceRows.by[k].manual}</td>
                  </tr>
                ))}
                {sourceRows.keys.length === 0 && (
                  <tr><td colSpan="6" className="small-muted" style={{ padding: 16 }}>No source data yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="cell-muted" style={{ fontSize: 11.5, marginTop: 8 }}>
            Counts are computed live from the candidate and application records — a candidate arriving from a
            second source updates their latest source, it never creates a duplicate master record.
          </div>
        </>
      )}
    </div>
  );
}
