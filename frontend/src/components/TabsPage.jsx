import { useState } from 'react';

// `embedded` drops the page head so a tabbed screen can sit inside another
// tabbed screen (e.g. Helpdesk and Resignation inside Employee Services) without
// stacking two <h1>s.
export default function TabsPage({ title, subtitle, tabs, embedded = false }) {
  const [active, setActive] = useState(tabs[0]?.key);
  const ActiveComponent = tabs.find((t) => t.key === active)?.element;

  return (
    <div>
      {!embedded && <div className="page-head"><div><h1>{title}</h1>{subtitle && <div className="page-sub">{subtitle}</div>}</div></div>}
      {embedded && subtitle && <div className="page-sub" style={{ marginBottom: 8 }}>{subtitle}</div>}
      <div className="tabbar">
        {tabs.map((t) => (
          <button key={t.key} className={'tab-btn' + (active === t.key ? ' active' : '')} onClick={() => setActive(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="tab-content">{ActiveComponent}</div>
    </div>
  );
}
