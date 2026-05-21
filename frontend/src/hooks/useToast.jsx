import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(1)

  const remove = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const push = useCallback((payload) => {
    const id = idRef.current++
    const t = { id, type: payload.type || 'info', message: payload.message || '', duration: payload.duration ?? 2800 }
    setToasts((arr) => [...arr, t])
    if (t.duration > 0) {
      setTimeout(() => remove(id), t.duration)
    }
    return id
  }, [remove])

  const api = useMemo(() => ({
    success: (message, duration) => push({ type: 'success', message, duration }),
    error: (message, duration) => push({ type: 'error', message, duration }),
    info: (message, duration) => push({ type: 'info', message, duration }),
    warning: (message, duration) => push({ type: 'warning', message, duration }),
    remove,
  }), [push, remove])

  const value = useMemo(() => ({ toasts, ...api }), [toasts, api])

  return (
    <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
