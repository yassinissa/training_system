import React, { useEffect, useRef } from 'react'

/**
 * Centered modal with:
 *  - Locked body scroll while open (prevents the page behind from scrolling
 *    under your finger on iOS).
 *  - ESC key closes.
 *  - Backdrop click closes ONLY if the press started on the backdrop itself.
 *    A drag/scroll inside the card that releases on the backdrop won't close.
 *  - Full-screen on phones with a sticky close button so long forms remain
 *    usable when the keyboard is open.
 */
export default function Modal({ open, onClose, children }) {
  const downOnBackdropRef = useRef(false)
  const backdropRef = useRef(null)

  // ----- lock body scroll while open -----
  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original }
  }, [open])

  // ----- ESC key closes -----
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  // Backdrop close pattern: require mouseDown AND mouseUp to BOTH happen
  // on the backdrop. Stops accidental closes when you drag-scroll inside
  // and release outside, which was the source of the "blinking" bug.
  const handleMouseDown = (e) => {
    downOnBackdropRef.current = e.target === backdropRef.current
  }
  const handleMouseUp = (e) => {
    if (downOnBackdropRef.current && e.target === backdropRef.current) {
      onClose?.()
    }
    downOnBackdropRef.current = false
  }

  return (
    <div
      ref={backdropRef}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        overflow: 'hidden',
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onTouchStart={handleMouseDown}
      onTouchEnd={handleMouseUp}
    >
      <div
        data-modal-card
        style={{
          background: '#fff',
          color: '#0f1c34',
          borderRadius: 12,
          padding: 20,
          width: '100%',
          maxWidth: 680,
          maxHeight: '92vh',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          boxShadow: '0 24px 48px -12px rgba(0,0,0,0.45)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
      >
        {/* X close button - always visible top-right */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          title="Close"
          style={{
            position: 'sticky',
            top: 0,
            float: 'right',
            marginLeft: 8,
            marginBottom: 4,
            background: '#f1f3f8',
            color: '#0f1c34',
            border: 'none',
            borderRadius: '50%',
            width: 32,
            height: 32,
            fontSize: 18,
            cursor: 'pointer',
            lineHeight: 1,
            zIndex: 2,
          }}
        >
          ×
        </button>
        {children}
      </div>

      {/* Mobile sizing tweaks */}
      <style>{`
        @media (max-width: 640px) {
          /* On phones we want the modal to take most of the screen so the
             form is usable when the keyboard opens. */
          [data-modal-card] {
            max-width: 100% !important;
            max-height: calc(100vh - 24px) !important;
            padding: 16px !important;
            border-radius: 14px !important;
          }
        }
      `}</style>
    </div>
  )
}
