import React, { createContext, useContext, useState, useEffect } from 'react'

function getStoredUser() {
  try {
    const rawSession = sessionStorage.getItem('user')
    return rawSession ? JSON.parse(rawSession) : null
  } catch {
    return null
  }
}

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser)

  useEffect(() => {
    try {
      if (user) sessionStorage.setItem('user', JSON.stringify(user))
      else sessionStorage.removeItem('user')
    } catch {}
  }, [user])

  const login = ({ access, refresh, user }) => {
    sessionStorage.setItem('access', access)
    sessionStorage.setItem('refresh', refresh)
    sessionStorage.setItem('user', JSON.stringify(user))
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

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
