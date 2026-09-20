import { useState } from 'react';

// Financial-year-aware period picker (Current FY / Previous FY / Quarter /
// Half Year / Custom Date / All time), matching the reference Accounts app's
// fyPicker. `value` is {mode, fy, q, h, from, to}; `onChange` receives the
// same shape plus a resolved `label`.
const MODES = [
  ['FYC', 'Current Financial Year'],
  ['FYP', 'Previous Financial Year'],
  ['Q', 'Quarter'],
  ['H', 'Half Year'],
  ['C', 'Custom Date'],
  ['ALL', 'All time'],
];
const QUARTERS = [[1, 'Q1 · Apr – Jun'], [2, 'Q2 · Jul – Sep'], [3, 'Q3 · Oct – Dec'], [4, 'Q4 · Jan – Mar']];
const HALVES = [[1, 'First Half · Apr – Sep'], [2, 'Second Half · Oct – Mar']];

export default function PeriodPicker({ value, onChange, label }) {
  const [open, setOpen] = useState(false);
  const v = value || { mode: 'FYC' };

  function set(patch) {
    onChange({ ...v, ...patch });
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" className="btn btn-sm" onClick={() => setOpen((o) => !o)}>
        📅 {label || 'Period'}
      </button>
      {open && (
        <div className="card" style={{ position: 'absolute', top: '110%', left: 0, zIndex: 20, width: 320, padding: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {MODES.map(([m, l]) => (
              <button key={m} type="button" className={`btn btn-sm ${v.mode === m ? 'btn-primary' : ''}`} onClick={() => set({ mode: m })}>{l}</button>
            ))}
          </div>
          {v.mode === 'Q' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {QUARTERS.map(([q, l]) => (
                <button key={q} type="button" className={`btn btn-sm ${Number(v.q) === q ? 'btn-primary' : ''}`} onClick={() => set({ q })}>{l}</button>
              ))}
            </div>
          )}
          {v.mode === 'H' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {HALVES.map(([h, l]) => (
                <button key={h} type="button" className={`btn btn-sm ${Number(v.h) === h ? 'btn-primary' : ''}`} onClick={() => set({ h })}>{l}</button>
              ))}
            </div>
          )}
          {v.mode === 'C' && (
            <div className="grid-2" style={{ marginBottom: 10 }}>
              <label className="field"><span>From</span><input type="date" value={v.from || ''} onChange={(e) => set({ from: e.target.value })} /></label>
              <label className="field"><span>To</span><input type="date" value={v.to || ''} onChange={(e) => set({ to: e.target.value })} /></label>
            </div>
          )}
          <button className="btn btn-sm btn-primary" onClick={() => setOpen(false)}>Apply</button>{' '}
          <button className="btn btn-sm" onClick={() => { onChange({ mode: 'ALL' }); setOpen(false); }}>Clear</button>
        </div>
      )}
    </div>
  );
}
