// The prototype's openModal() renders `.overlay.show > .modal[.wide|.xwide]`
// with a `.modal-head` / `.modal-body` / `.modal-foot` stack. Every Add / Edit
// form in the ATS module is one of these, so the markup lives here once.
export default function Modal({ title, size, onClose, children, footer, bodyStyle }) {
  return (
    <div
      className="overlay show"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className={`modal${size ? ` ${size}` : ''}`}>
        <div className="modal-head">
          <h3 style={{ fontSize: 15 }}>{title}</h3>
          <button type="button" className="close-x" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={bodyStyle}>{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
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
