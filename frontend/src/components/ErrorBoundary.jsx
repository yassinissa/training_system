import React from 'react';

/**
 * Top-level safety net.
 *
 * If any descendant page throws an uncaught render error, React unmounts
 * the whole tree and shows a blank screen - extremely confusing for users.
 * This component catches it and renders a friendly card with a Reload
 * button instead. Errors are logged to the console (and Sentry later if
 * we add it) so we can still debug.
 *
 * Has to be a class component - React's error boundary API only works on
 * class components, not hooks.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Keep this lightweight - no external services yet.
    // eslint-disable-next-line no-console
    console.error('UI crashed:', error, info?.componentStack);
  }

  handleReload = () => {
    // Hard reload so any stale state / service-worker cache is cleared.
    window.location.reload();
  };

  handleHome = () => {
    window.location.href = '/';
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: 'var(--bg, #0b1020)',
          color: 'var(--text, #e8eeff)',
        }}
      >
        <div
          style={{
            maxWidth: 480,
            width: '100%',
            background: 'var(--panel, #121a33)',
            border: '1px solid var(--card-border, rgba(255,255,255,0.06))',
            borderRadius: 16,
            padding: 28,
            boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 42, marginBottom: 10 }}>⚠️</div>
          <h2 style={{ margin: '0 0 10px', fontSize: 22 }}>Something went wrong</h2>
          <p style={{ margin: '0 0 18px', color: 'var(--muted, #8ea0c0)', lineHeight: 1.5 }}>
            The page hit an unexpected error. Reloading usually fixes it. If it
            keeps happening, let your admin know.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn primary" onClick={this.handleReload}>Reload page</button>
            <button className="btn" onClick={this.handleHome}>Go home</button>
          </div>
        </div>
      </div>
    );
  }
}
