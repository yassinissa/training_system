import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/auth-context.jsx'
import NotificationBell from './NotificationBell.jsx'

export default function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  // Helper that closes the mobile menu and navigates in one step.
  // Used by every action button so the panel collapses after a tap.
  const go = (to) => {
    setMenuOpen(false);
    navigate(to);
  };

  return (
    <div className="navbar">
      <div className="nav-inner">
        <div className="brand" onClick={() => go('/')} style={{ cursor: 'pointer' }}>
          <img src="/logo-green-hills.png" alt="Green Hills" onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ height: 28, width: 'auto', display: 'inline-block' }} />
          <span style={{ marginLeft: 10, fontWeight: 700, fontSize: 18 }}>Green Hills</span>
        </div>

        {/* Status indicators stay visible on mobile (not collapsed) */}
        <div className="nav-status">
          {user && (<span className="pill">Role: {user.role}</span>)}
          {user && <NotificationBell />}
          <button
            type="button"
            className="nav-hamburger"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span /><span /><span />
          </button>
        </div>

        {/* The action buttons: row on desktop, slide-down panel on mobile */}
        <div className={`nav-actions ${menuOpen ? 'is-open' : ''}`}>
          <button className="btn" onClick={() => go('/')}>Dashboard</button>
          {user?.role === 'ADMIN' && (
            <>
              <button className="btn" onClick={() => go('/admin')}>Admin</button>
              <button className="btn" onClick={() => go('/admin/reports')}>Reports</button>
            </>
          )}
          {user?.role === 'MANAGER' && (
            <button className="btn" onClick={() => go('/manager')}>Manager</button>
          )}
          <button
            className="btn danger"
            onClick={() => { setMenuOpen(false); logout(); navigate('/login', { replace: true }); }}
          >Logout</button>
        </div>
      </div>

      <style>{`
        /* All rules below are scoped under .navbar so they cannot leak
           and override the global .btn / .pill styles in styles/global.css. */

        .navbar {
          width: 100%;
          background: rgba(30,40,80,0.13);
          box-shadow: 0 2px 8px rgba(30,40,80,0.07);
          position: sticky;
          top: 0;
          z-index: 100;
        }
        .navbar .nav-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          max-width: 1200px;
          margin: 0 auto;
          padding: 0.5rem 1.2rem;
          gap: 12px;
          flex-wrap: nowrap;
        }
        .navbar .brand {
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }
        .navbar .nav-status {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          order: 3;
          margin-left: auto;
        }
        .navbar .nav-actions {
          display: flex;
          align-items: center;
          gap: 0.7rem;
          order: 2;
          flex-wrap: wrap;
        }
        .navbar .btn {
          background: rgba(255,255,255,0.18);
          border: 1.5px solid #fff;
          color: #1a2236;
          border-radius: 6px;
          font-weight: 600;
          padding: 0.45rem 1.1rem;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .navbar .btn:hover {
          background: #fff;
          color: #263159;
        }
        .navbar .btn.danger {
          border: 1.5px solid #e57373;
          color: #e57373;
          background: transparent;
        }
        .navbar .btn.danger:hover {
          background: #e57373;
          color: #fff;
        }
        .navbar .pill {
          background: #263159;
          color: #fff;
          border-radius: 12px;
          padding: 0.3rem 0.9rem;
          font-size: 1rem;
          font-weight: 500;
          border: none;
        }

        /* Hamburger button: hidden on desktop, shown on mobile */
        .navbar .nav-hamburger {
          display: none;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.35);
          border-radius: 8px;
          width: 38px;
          height: 38px;
          padding: 0;
          cursor: pointer;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
        }
        .navbar .nav-hamburger span {
          display: block;
          width: 18px;
          height: 2px;
          background: #fff;
          border-radius: 2px;
        }
@media (max-width: 820px) {
          .navbar { padding: 0.4rem 0.3rem; }
          .navbar .nav-inner {
            padding: 0.45rem 0.6rem;
            gap: 8px;
            flex-wrap: wrap;
            align-items: flex-start;
          }
          .navbar .nav-status {
            gap: 0.75rem;
            order: 1;
            width: auto;
            margin-left: 0;
          }
          /* role pill: never wrap, smaller text on phone */
          .navbar .pill {
            white-space: nowrap;
            font-size: 0.78rem;
            padding: 0.25rem 0.65rem;
            min-width: 0;
          }
          .navbar .nav-hamburger {
            display: flex;
            order: 2;
          }
          /* Collapsed by default; expand into a panel that pushes content down */
          .navbar .nav-actions {
            order: 4;
            flex-basis: 100%;
            flex-direction: column;
            align-items: stretch;
            gap: 0.5rem;
            max-height: 0;
            overflow: hidden;
            transition: max-height 220ms ease, padding 220ms ease, margin 220ms ease;
            padding: 0;
            margin: 0;
            width: 100%;
          }
          .navbar .nav-actions.is-open {
            max-height: 999px;
            padding: 0.5rem 0.2rem 0.2rem;
            margin-top: 0.2rem;
            border-top: 1px solid rgba(255,255,255,0.12);
          }
          .navbar .nav-actions .btn {
            width: 100%;
            text-align: center;
            padding: 0.6rem 0.8rem;
            font-size: 0.95rem;
          }
        }
      `}</style>
    </div>
  );
}
