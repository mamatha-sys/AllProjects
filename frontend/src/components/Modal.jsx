// The prototype's openModal() markup as a component: .overlay.show > .modal
// (optionally .wide / .xwide) > .modal-head / .modal-body / .modal-foot.
// See teamlink-enterprise_69.html openModal(), and .overlay in styles.css.
export default function Modal({ title, note, size, onClose, children, foot }) {
  return (
    <div className="overlay show" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal${size ? ` ${size}` : ''}`}>
        <div className="modal-head">
          <h3 style={{ fontSize: 15 }}>{title}</h3>
          {note && <div className="cell-muted" style={{ fontSize: 11.5, marginLeft: 'auto', marginRight: 10 }}>{note}</div>}
          <button className="close-x" type="button" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{children}</div>
        {foot && <div className="modal-foot">{foot}</div>}
      </div>
    </div>
  );
}
