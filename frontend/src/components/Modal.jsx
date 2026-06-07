import React, { useEffect, useRef } from 'react'

/**
 * A predictable centered modal.
 *
 * The card is a vertical flex container that fills available height
 * with `overflow: hidden`. Children can structure themselves as
 * sticky header / scrollable body / sticky footer using flex.
 *
 * Behaviour:
 *   - Locks body scroll while open.
 *   - ESC closes.
 *   - Tap/click ON THE BACKDROP closes; tap inside the card does not.
 *     We detect that by checking `e.target === backdropRef.current`,
 *     so a drag-scroll inside the card that releases on the backdrop
 *     does not trigger close (no more "blinking").
 *   - On phones (<=640px) the card goes truly full-screen so long
 *     forms stay usable when the keyboard pushes the viewport up.
 */
export default function Modal({ open, onClose, children }) {
  const backdropRef = useRef(null)

  // Lock background scroll while open.
  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original }
  }, [open])

  // ESC closes.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const handleBackdropClick = (e) => {
    // Only close if the click landed on the backdrop itself,
    // not on the card or any of its children.
    if (e.target === backdropRef.current) onClose?.()
  }

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
      }}
    >
      <div
        data-modal-card
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          color: '#0f1c34',
          borderRadius: 16,
          width: '100%',
          maxWidth: 720,
          maxHeight: 'calc(100vh - 24px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 48px -12px rgba(0,0,0,0.45)',
        }}
      >
        {children}
      </div>

      {/* Full-screen on phones so the keyboard doesn't push content off. */}
      <style>{`
        @media (max-width: 640px) {
          [data-modal-card] {
            border-radius: 0 !important;
            max-height: 100vh !important;
            height: 100vh !important;
          }
        }
      `}</style>
    </div>
  )
}
