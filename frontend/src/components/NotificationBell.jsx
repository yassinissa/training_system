import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { FaBell } from 'react-icons/fa'
import api from '../api/client.js'

/**
 * Bell icon with unread badge + dropdown panel.
 *
 * - Polls /api/accounts/notifications/ every 30s.
 * - Click bell -> toggles the dropdown.
 * - Click a notification -> marks it read and (if it has a link) navigates.
 * - "Mark all read" button clears the badge.
 */
export default function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const panelRef = useRef(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get('/accounts/notifications/')
      setItems(res.data?.results || [])
      setUnread(res.data?.unread_count || 0)
    } catch {
      // ignore - the bell is non-critical
    }
  }, [])

  // initial load + polling
  useEffect(() => {
    fetchNotifications()
    const id = setInterval(fetchNotifications, 30000)
    return () => clearInterval(id)
  }, [fetchNotifications])

  // click-outside to close
  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const markRead = async (n) => {
    if (!n.is_read) {
      try {
        await api.post(`/accounts/notifications/${n.id}/read/`)
        setItems((arr) => arr.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)))
        setUnread((c) => Math.max(0, c - 1))
      } catch { /* ignore */ }
    }
    if (n.link) {
      setOpen(false)
      navigate(n.link)
    }
  }

  const [marking, setMarking] = useState(false)
  const markAllRead = async () => {
    if (marking || unread === 0) return
    setMarking(true)
    // Optimistic UI: clear the badge and grey out the rows immediately.
    const prevItems = items
    const prevUnread = unread
    setItems((arr) => arr.map((x) => ({ ...x, is_read: true })))
    setUnread(0)

    // 1) Try the bulk endpoint.
    let bulkOk = false
    try {
      await api.post('/accounts/notifications/read-all/')
      bulkOk = true
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('read-all failed, falling back to per-row mark', e?.response?.status, e?.response?.data || e?.message)
    }

    // 2) Fallback: hit /notifications/<id>/read/ for each unread one in parallel.
    if (!bulkOk) {
      const unreadIds = prevItems.filter((x) => !x.is_read).map((x) => x.id)
      try {
        await Promise.all(
          unreadIds.map((id) => api.post(`/accounts/notifications/${id}/read/`))
        )
        bulkOk = true
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('per-row mark fallback also failed', e?.response?.status, e?.response?.data || e?.message)
      }
    }

    if (bulkOk) {
      // Re-sync with the server so the count + items reflect reality.
      try { await fetchNotifications() } catch { /* ignore */ }
    } else {
      // Roll back so the user sees the failure.
      setItems(prevItems)
      setUnread(prevUnread)
      alert('Could not mark all as read. Please try again.')
    }
    setMarking(false)
  }

  const fmt = (iso) => {
    try {
      const d = new Date(iso)
      return d.toLocaleString()
    } catch { return iso }
  }

  return (
    <div ref={panelRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Notifications"
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: '#1a2236', position: 'relative', padding: 6, fontSize: 20,
        }}
      >
        <FaBell />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 0, right: 0,
            background: '#e53935', color: '#fff', borderRadius: 999,
            fontSize: 11, fontWeight: 700, padding: '2px 5px', minWidth: 18,
            textAlign: 'center', lineHeight: 1.1,
          }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '110%', zIndex: 200,
          width: 340, maxHeight: 420, overflowY: 'auto',
          background: '#fff', color: '#1a2236',
          border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', borderBottom: '1px solid #eee', fontWeight: 700,
          }}>
            <span>Notifications</span>
            <button
              onClick={markAllRead}
              disabled={unread === 0 || marking}
              style={{
                background: 'transparent', border: 'none',
                color: (unread === 0 || marking) ? '#bbb' : '#1976d2',
                cursor: (unread === 0 || marking) ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 600,
              }}
            >{marking ? 'Marking…' : 'Mark all read'}</button>
          </div>

          {items.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>
              No notifications yet
            </div>
          ) : (
            items.map((n) => (
              <div
                key={n.id}
                onClick={() => markRead(n)}
                style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid #f1f1f1',
                  cursor: 'pointer',
                  background: n.is_read ? '#fff' : '#f5f9ff',
                }}
              >
                <div style={{
                  fontWeight: n.is_read ? 500 : 700,
                  color: n.kind === 'EXAM_PASSED' ? '#2e7d32'
                       : n.kind === 'EXAM_FAILED' ? '#c62828'
                       : '#1a2236',
                  marginBottom: 3, fontSize: 14,
                }}>
                  {n.title}
                </div>
                {n.body && (
                  <div style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>
                    {n.body}
                  </div>
                )}
                <div style={{ fontSize: 11, color: '#888' }}>{fmt(n.created_at)}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
