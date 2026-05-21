import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/auth-context.jsx'

export default function ProtectedRoute({ children, roles }) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (roles && roles.length && user.role && !roles.includes(user.role)) {
    return <Navigate to="/" replace state={{ from: location, reason: 'unauthorized' }} />
  }

  return children
}
