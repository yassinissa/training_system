import { useLocation, useNavigate } from 'react-router-dom'

export default function Tabs({ tabs, initial }) {
  const location = useLocation();
  const navigate = useNavigate();
  // Use URL hash for tab state, fallback to initial or first tab
  const hash = location.hash.replace('#', '');
  const active = tabs.some(t => t.key === hash) ? hash : (initial || tabs[0]?.key);
  const current = tabs.find(t => t.key === active) || tabs[0];
  const handleTabClick = (key) => {
    if (key !== active) navigate({ ...location, hash: `#${key}` });
  };
  return (
    <div className="tabs">
      <div className="tablist" role="tablist" aria-label="Sections">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={active === t.key}
            aria-controls={`panel-${t.key}`}
            id={`tab-${t.key}`}
            className={`tab ${active === t.key ? 'active' : ''}`}
            onClick={() => handleTabClick(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="tabpanel" role="tabpanel" id={`panel-${current.key}`} aria-labelledby={`tab-${current.key}`}>
        {current?.content}
      </div>
    </div>
  );
}
