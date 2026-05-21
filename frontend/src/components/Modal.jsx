import React from 'react'

/**
 * Centered modal. On mobile we shrink padding and use up to 95vw / 95vh
 * so the scroll inside stays usable. The inner content is forced into
 * overflowY:auto with -webkit-overflow-scrolling for iOS momentum scroll.
 */
export default function Modal({ open, onClose, children }) {
  if (!open) return null
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
      }}
      onClick={onClose}
    >
      <div
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
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
