import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/auth-context.jsx'
import NotificationBell from './NotificationBell.jsx'

export default function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="navbar">
      <div className="nav-inner">
        <div className="brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <img src="/logo-green-hills.png" alt="Green Hills" onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ height: 28, width: 'auto', display: 'inline-block' }} />
          <span style={{ marginLeft: 10, fontWeight: 700, fontSize: 18 }}>Green Hills</span>
        </div>
        <div className="nav-actions">
          {user && (<span className="pill">Role: {user.role}</span>)}
          {user && <NotificationBell />}
          <button className="btn" onClick={() => navigate('/')}>Dashboard</button>
          {user?.role === 'ADMIN' && (
            <>
              <button className="btn" onClick={() => navigate('/admin')}>Admin</button>
              <button className="btn" onClick={() => navigate('/admin/reports')}>Reports</button>
            </>
          )}
          {user?.role === 'MANAGER' && (
            <button className="btn" onClick={() => navigate('/manager')}>Manager</button>
          )}
          <button className="btn danger" onClick={() => { logout(); navigate('/login', { replace: true }) }}>Logout</button>
        </div>
      </div>
      <style>{`
        @media (max-width: 700px) {
          .navbar {
            padding: 0.5rem 0.2rem;
          }
          .nav-inner {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
          }
          .brand {
            margin-bottom: 0.3rem;
          }
          .nav-actions {
            flex-wrap: wrap;
            gap: 0.4rem;
          }
          .btn, .pill {
            font-size: 1rem;
            padding: 0.5rem 0.7rem;
            min-width: 90px;
          }
        }
        .navbar {
          width: 100vw;
          background: rgba(30,40,80,0.13);
          box-shadow: 0 2px 8px rgba(30,40,80,0.07);
          position: sticky;
          top: 0;
          z-index: 100;
        }
        .nav-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          max-width: 1200px;
          margin: 0 auto;
          padding: 0.5rem 1.2rem;
        }
        .brand {
          display: flex;
          align-items: center;
        }
        .nav-actions {
          display: flex;
          align-items: center;
          gap: 0.7rem;
        }
        .btn {
          background: rgba(255,255,255,0.18);
          border: 1.5px solid #fff;
          color: #1a2236;
          border-radius: 6px;
          font-weight: 600;
          padding: 0.45rem 1.1rem;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .btn:hover {
          background: #fff;
          color: #263159;
        }
        .btn.danger {
          border: 1.5px solid #e57373;
          color: #e57373;
        }
        .btn.danger:hover {
          background: #e57373;
          color: #fff;
        }
        .pill {
          background: #263159;
          color: #fff;
          border-radius: 12px;
          padding: 0.3rem 0.9rem;
          font-size: 1rem;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}
