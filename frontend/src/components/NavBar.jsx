import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/auth-context.jsx'

export default function NavBar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  return (
    <div className="navbar">
      <div className="nav-inner">
        <div className="brand" onClick={() => navigate('/') } style={{cursor:'pointer'}}>
          <img src="/green-hills-logo.png" alt="Green Hills" onError={(e)=>{ e.currentTarget.onerror=null; e.currentTarget.src='/green-hills-logo.svg' }} style={{height:22, width:'auto', display:'inline-block'}} />
          <span style={{marginLeft:10, fontWeight:700}}>Green Hills</span>
        </div>
        <div className="nav-actions">
          {user && (<span className="pill">Role: {user.role}</span>)}
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
    </div>
  )
}
