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
 *
 * On mobile the dropdown is `position: fixed` and anchored to the viewport's
 * top-right with safe padding so it never overflows off-screen like a tooltip.
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

  useEffect(() => {
    fetchNotifications()
    const id = setInterval(fetchNotifications, 30000)
    return () => clearInterval(id)
  }, [fetchNotifications])

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
    const prevItems = items
    const prevUnread = unread
    setItems((arr) => arr.map((x) => ({ ...x, is_read: true })))
    setUnread(0)

    let bulkOk = false
    try {
      await api.post('/accounts/notifications/read-all/')
      bulkOk = true
    } catch (e) {
      console.warn('read-all failed, falling back to per-row mark', e?.response?.status, e?.response?.data || e?.message)
    }

    if (!bulkOk) {
      const unreadIds = prevItems.filter((x) => !x.is_read).map((x) => x.id)
      try {
        await Promise.all(unreadIds.map((id) => api.post(`/accounts/notifications/${id}/read/`)))
        bulkOk = true
      } catch (e) {
        console.warn('per-row mark fallback also failed', e?.response?.status, e?.response?.data || e?.message)
      }
    }

    if (bulkOk) {
      try { await fetchNotifications() } catch { /* ignore */ }
    } else {
      setItems(prevItems)
      setUnread(prevUnread)
      alert('Could not mark all as read. Please try again.')
    }
    setMarking(false)
  }

  const fmt = (iso) => {
    try { return new Date(iso).toLocaleString() }
    catch { return iso }
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
          position: 'fixed',
          right: 12,
          left: 12,
          top: 64,
          maxWidth: 360,
          marginLeft: 'auto',
          zIndex: 1500,
          maxHeight: '70vh',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          background: '#fff', color: '#1a2236',
          border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12,
          boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderBottom: '1px solid #eee', fontWeight: 700,
            position: 'sticky', top: 0, background: '#fff', zIndex: 1,
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
                  padding: '12px 16px',
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
                  marginBottom: 4, fontSize: 14,
                  wordBreak: 'break-word',
                }}>
                  {n.title}
                </div>
                {n.body && (
                  <div style={{ fontSize: 13, color: '#555', marginBottom: 4, wordBreak: 'break-word' }}>
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
