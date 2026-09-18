import { useState } from 'react';

export default function TabsPage({ title, subtitle, tabs }) {
  const [active, setActive] = useState(tabs[0]?.key);
  const ActiveComponent = tabs.find((t) => t.key === active)?.element;

  return (
    <div>
      <div className="page-head"><div><h1>{title}</h1>{subtitle && <div className="page-sub">{subtitle}</div>}</div></div>
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
