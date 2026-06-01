import { useNavigate } from 'react-router-dom';

/**
 * Real 404 page. Replaces the previous silent redirect-to-home/login
 * catch-all so users actually know when a deep link is invalid (e.g.
 * a deleted competency, a typo'd URL, an old bookmark).
 */
export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="container" style={{ paddingTop: 60 }}>
      <div
        className="card"
        style={{
          maxWidth: 520,
          margin: '0 auto',
          textAlign: 'center',
          padding: '32px 26px',
        }}
      >
        <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1, marginBottom: 6 }}>
          404
        </div>
        <h2 style={{ margin: '0 0 10px', fontSize: 22 }}>Page not found</h2>
        <p style={{ margin: '0 0 22px', color: 'var(--muted)', lineHeight: 1.5 }}>
          The page you&rsquo;re looking for doesn&rsquo;t exist, or it may have been
          moved or deleted.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn primary" onClick={() => navigate('/')}>
            Go to dashboard
          </button>
          <button className="btn" onClick={() => navigate(-1)}>
            Go back
          </button>
        </div>
      </div>
    </div>
  );
}
