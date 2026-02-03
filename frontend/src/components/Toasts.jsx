import React from 'react'
import { useToast } from '../hooks/useToast.jsx'

export default function Toasts() {
  const { toasts, remove } = useToast()
  return (
    <div className="toasts" aria-live="polite" aria-atomic="true">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`} role="status">
          <div className="toast-content">{t.message}</div>
          <button className="toast-close" aria-label="Close" onClick={() => remove(t.id)}>×</button>
        </div>
      ))}
    </div>
  )
}
