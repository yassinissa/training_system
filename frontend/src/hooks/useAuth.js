import { useEffect, useState } from 'react'


function getStoredUser() {
  try {
    const rawSession = sessionStorage.getItem('user')
    return rawSession ? JSON.parse(rawSession) : null
  } catch {
    return null
  }
}

export function useAuth() {
  const [user, setUser] = useState(getStoredUser)


  useEffect(() => {
    // Always keep user in sessionStorage only
    try {
      if (user) sessionStorage.setItem('user', JSON.stringify(user))
      else sessionStorage.removeItem('user')
    } catch {}
  }, [user])


  const login = ({ access, refresh, user }) => {
    // Always use sessionStorage for authentication
    sessionStorage.setItem('access', access)
    sessionStorage.setItem('refresh', refresh)
    sessionStorage.setItem('user', JSON.stringify(user))
    // Remove from localStorage just in case
    localStorage.removeItem('access')
    localStorage.removeItem('refresh')
    localStorage.removeItem('user')
    setUser(user)
  }


  const logout = () => {
    try {
      sessionStorage.removeItem('access')
      sessionStorage.removeItem('refresh')
      sessionStorage.removeItem('user')
      localStorage.removeItem('access')
      localStorage.removeItem('refresh')
      localStorage.removeItem('user')
    } finally {
      setUser(null)
    }
  }

  return { user, setUser, login, logout }
}
