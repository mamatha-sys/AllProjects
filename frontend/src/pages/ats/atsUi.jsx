// Shared presentation helpers for the ATS screens, ported from the prototype
// (teamlink-enterprise_69.html) so every ATS page renders the same chips,
// modals and section headings as the reference HTML.
//
// Nothing here is business logic — it is the prototype's markup vocabulary
// expressed as React, using only classes the ported stylesheet already
// defines (.status.*, .modal, .tabs/.tab, .avatarsm, .skillpill, …).

import { stageLabel } from '../../atsVocab';

/* --- statusBadge() (prototype line 6164) ---------------------------------
   The prototype keys its map on the stage *label*; this app stores stage
   codes, so the same mapping is expressed against the codes. Stages the
   prototype's map does not name fall through to 'new', exactly as it does. */
const STAGE_BADGE = {
  NEW: 'new',
  AI_INTERVIEW_REQUIRED: 'new',
  AI_INTERVIEW_SCHEDULED: 'new',
  AI_INTERVIEW_COMPLETED: 'new',
  RECRUITER_REVIEW: 'review',
  RECRUITER_APPROVED: 'approved',
  WITH_BDE: 'review',
  BDE_APPROVED: 'approved',
  SHARED_WITH_CLIENT: 'review',
  CLIENT_REVIEW: 'review',
  CLIENT_SHORTLISTED: 'shortlist',
  INTERVIEW_SCHEDULED: 'interview',
  INTERVIEW_COMPLETED: 'interview',
  SELECTED: 'selected',
  OFFER: 'offer',
  OFFER_ACCEPTED: 'offer',
  JOINED: 'joined',
  HIRED: 'joined',
  REJECTED: 'rejected',
  HOLD: 'hold',
};

export function stageBadgeClass(code) {
  return STAGE_BADGE[code] || 'new';
}

export function StatusBadge({ stage, label }) {
  if (!stage) return <span className="small-muted">No application</span>;
  return <span className={`status ${stageBadgeClass(stage)}`}>{label || stageLabel(stage)}</span>;
}

/* Life status chip — the prototype's inline ternary in renderCandidateList(). */
export function lifeClass(status) {
  if (status === 'Active') return 'active';
  if (status === 'On Hold') return 'pending';
  if (status === 'Rejected') return 'rejected';
  return 'review';
}
export function LifeBadge({ status }) {
  if (!status) return <span className="cell-muted">—</span>;
  return <span className={`status ${lifeClass(status)}`}>{status}</span>;
}

/* AI interview chip — aiStatusOf() + the list's inline class choice. */
export function aiClass(status) {
  if (status === 'Completed') return 'active';
  if (status === 'Expired') return 'rejected';
  return 'pending';
}

/* Requirement priority chip — renderRequirementList() maps
   High→rejected, Medium→review, everything else→applied. */
export function priorityClass(priority) {
  if (priority === 'High' || priority === 'Urgent') return 'rejected';
  if (priority === 'Medium') return 'review';
  return 'applied';
}

/* agreementBadgeClass() (prototype line 6297). */
export function agreementBadgeClass(status) {
  if (status === 'ACTIVE' || status === 'Active') return 'active';
  if (['CANCELLED', 'EXPIRED', 'Cancelled', 'Expired'].includes(status)) return 'rejected';
  return 'pending';
}

/* initials() (prototype line 2165) — feeds the .avatarsm circle the
   candidate list puts before every name. */
export function initials(name) {
  return String(name || '')
    .replace(/\(.*\)/, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase();
}

export function Avatar({ name }) {
  return <span className="avatarsm">{initials(name)}</span>;
}

/* --- Modal ---------------------------------------------------------------
   The prototype's openModal(html, wide): a fixed .overlay.show wrapping a
   .modal / .modal.wide / .modal.xwide, with .modal-head / .modal-body /
   .modal-foot inside. Clicking the backdrop closes it, as openModal() does. */
export function Modal({ title, size = '', onClose, children, footer }) {
  const cls = size === 'xwide' ? 'modal xwide' : size === 'wide' ? 'modal wide' : 'modal';
  return (
    <div className="overlay show" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={cls}>
        <div className="modal-head">
          <h3 style={{ fontSize: 15 }}>{title}</h3>
          <button type="button" className="close-x" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* Lettered section heading inside the Add Candidate / Create Requirement
   modals. The prototype writes these as a small uppercase muted <h4>. */
export function SecHead({ letter, children, first }) {
  return (
    <h4 style={{
      fontSize: 12,
      color: 'var(--ink-soft)',
      margin: first ? '0 0 8px' : '16px 0 8px',
      letterSpacing: '.4px',
      textTransform: 'uppercase',
      fontWeight: 600,
    }}
    >
      {letter ? `${letter}. ` : ''}{children}
    </h4>
  );
}

/* The prototype's .tabs / .tab bar (a div, not a button row) so the tab
   underline and spacing are identical across the ATS screens. */
export function Tabs({ tabs, value, onChange, style }) {
  return (
    <div className="tabs" style={style}>
      {tabs.map(([key, label]) => (
        <div
          key={key}
          className={`tab${value === key ? ' active' : ''}`}
          onClick={() => onChange(key)}
        >
          {label}
        </div>
      ))}
    </div>
  );
}

/* Comma-separated skill strings rendered as the prototype's pills. */
export function SkillPills({ value, variant = '', empty = '—' }) {
  const list = Array.isArray(value)
    ? value
    : String(value || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) return <span className="cell-muted">{empty}</span>;
  return list.map((s) => (
    <span key={s} className={`skillpill${variant ? ` ${variant}` : ''}`}>{s}</span>
  ));
}

/* The prototype prints every date as en-GB "02 Oct 2026" (appDueDate,
   line 348). The API hands these over as ISO strings, so the ATS screens
   format for display rather than showing 2026-10-02. */
export function fmtDate(value) {
  if (!value) return '—';
  const d = new Date(String(value).length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function KV({ k, children }) {
  return <div className="kv"><span className="k">{k}</span><span>{children}</span></div>;
}
