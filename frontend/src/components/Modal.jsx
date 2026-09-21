// The prototype's openModal() markup as a component: .overlay.show > .modal
// (optionally .wide / .xwide) > .modal-head / .modal-body / .modal-foot.
// See teamlink-enterprise_69.html openModal(), and .overlay in styles.css.
// `footer` and `foot` are the same slot under two names — the ATS and
// Administration screens were written against different ones.
export default function Modal({ title, note, size, onClose, children, footer, foot, bodyStyle }) {
  const footContent = footer ?? foot;
  return (
    <div
      className="overlay show"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className={`modal${size ? ` ${size}` : ''}`}>
        <div className="modal-head">
          <h3 style={{ fontSize: 15 }}>{title}</h3>
          {note && <div className="cell-muted" style={{ fontSize: 11.5, marginLeft: 'auto', marginRight: 10 }}>{note}</div>}
          <button type="button" className="close-x" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={bodyStyle}>{children}</div>
        {footContent && <div className="modal-foot">{footContent}</div>}
      </div>
    </div>
  );
}

// The prototype's lettered section heading inside a modal body:
//   <h4 style="font-size:12px;color:var(--ink-soft);margin:14px 0 8px">A. Basic Information</h4>
export function SectionHead({ children, first, caps }) {
  return (
    <h4 style={{
      fontSize: 12,
      color: 'var(--ink-soft)',
      margin: first ? '0 0 8px' : '14px 0 8px',
      letterSpacing: caps ? '.4px' : undefined,
      textTransform: caps ? 'uppercase' : undefined,
    }}
    >
      {children}
    </h4>
  );
}
