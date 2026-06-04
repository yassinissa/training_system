import { useEffect, useState } from 'react';
import api from '../api/client.js';

/**
 * Admin-only queue of pending manual awards. Lives in its own tab on
 * AdminDashboard. Each row has Approve / Reject actions; rejection
 * collects an optional reason that's surfaced back to the manager.
 *
 * Endpoints:
 *   GET  /api/training/manual-awards/pending/
 *   POST /api/training/manual-awards/<id>/approve/
 *   POST /api/training/manual-awards/<id>/reject/   body: { reason }
 *   GET  /api/training/manual-awards/?status=APPROVED|REJECTED  (history)
 */
export default function ManualAwardsAdminQueue() {
  const [pending, setPending] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actingId, setActingId] = useState(null);

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const [pRes, rRes] = await Promise.all([
        api.get('/training/manual-awards/pending/'),
        api.get('/training/manual-awards/'),
      ]);
      setPending(Array.isArray(pRes.data) ? pRes.data : []);
      // Most-recent first, only the decisions
      const all = Array.isArray(rRes.data) ? rRes.data : [];
      setRecent(all.filter((a) => a.status !== 'PENDING').slice(0, 25));
    } catch (e) {
      setError('Failed to load manual awards.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const approve = async (award) => {
    if (!window.confirm(
      `Approve this award for ${award.employee_username} on "${award.competency_title}"?\n\n` +
      `Score ${award.score}/${award.max_score}` +
      (award.level ? ` · Level ${award.level}` : '') + '.'
    )) return;
    setActingId(award.id);
    try {
      await api.post(`/training/manual-awards/${award.id}/approve/`);
      await refresh();
    } catch {
      setError('Failed to approve.');
    } finally {
      setActingId(null);
    }
  };

  const reject = async (award) => {
    const reason = window.prompt(
      `Reject this award for ${award.employee_username}? Reason (optional, shown to the manager):`,
      ''
    );
    if (reason === null) return;  // user cancelled
    setActingId(award.id);
    try {
      await api.post(`/training/manual-awards/${award.id}/reject/`, { reason });
      await refresh();
    } catch {
      setError('Failed to reject.');
    } finally {
      setActingId(null);
    }
  };

  const statusBadge = (s) => {
    const colors = {
      PENDING:  { bg: '#3b3015', fg: '#ffd97a' },
      APPROVED: { bg: '#143b22', fg: '#7be1a1' },
      REJECTED: { bg: '#3b1414', fg: '#ffb4b4' },
    };
    const c = colors[s] || { bg: '#333', fg: '#fff' };
    return (
      <span style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 999,
        background: c.bg,
        color: c.fg,
        fontSize: 11,
        fontWeight: 700,
      }}>{s}</span>
    );
  };

  return (
    <div className="card">
      <div className="toolbar" style={{ marginBottom: 12 }}>
        <div className="left"><h3 style={{ margin: 0 }}>Manual Awards</h3></div>
        <div className="right">
          <button className="btn" onClick={refresh} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      <div style={{ fontSize: 13, color: '#9bb0e0', marginBottom: 12 }}>
        Verbal-assessment scores submitted by managers. Approve to create a
        competency record and (if a level was set) apply that level to the
        employee. Reject with an optional reason that's sent back to the manager.
      </div>

      {error && (
        <div style={{ color: '#ffb4b4', marginBottom: 8 }}>{error}</div>
      )}

      {/* Pending */}
      <h4 style={{ margin: '12px 0 6px' }}>Pending ({pending.length})</h4>
      <div className="scroll-x">
        <table className="table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Competency</th>
              <th>Score</th>
              <th>Level</th>
              <th>Manager</th>
              <th>Submitted</th>
              <th>Notes</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {pending.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ color: '#9bb0e0', fontStyle: 'italic' }}>
                  Nothing waiting for review.
                </td>
              </tr>
            ) : pending.map((a) => (
              <tr key={a.id}>
                <td>
                  {a.employee_username}
                  {a.employee_number ? ` (${a.employee_number})` : ''}
                </td>
                <td>
                  {a.competency_reference ? `${a.competency_reference} — ` : ''}
                  {a.competency_title}
                </td>
                <td>
                  {a.score}/{a.max_score}
                  {a.percentage != null && (
                    <span style={{ color: '#9bb0e0', marginLeft: 6, fontSize: 12 }}>
                      ({Math.round(a.percentage)}%)
                    </span>
                  )}
                </td>
                <td>{a.level || '—'}</td>
                <td>{a.requested_by_username || '—'}</td>
                <td>{a.requested_at ? new Date(a.requested_at).toLocaleString() : '—'}</td>
                <td style={{ maxWidth: 240, wordBreak: 'break-word' }}>
                  {a.notes || '—'}
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button
                    className="btn primary"
                    onClick={() => approve(a)}
                    disabled={actingId === a.id}
                    style={{ marginRight: 6 }}
                  >
                    Approve
                  </button>
                  <button
                    className="btn danger"
                    onClick={() => reject(a)}
                    disabled={actingId === a.id}
                  >
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recent history */}
      <h4 style={{ margin: '18px 0 6px' }}>Recent decisions</h4>
      <div className="scroll-x">
        <table className="table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Employee</th>
              <th>Competency</th>
              <th>Score</th>
              <th>Level</th>
              <th>Manager</th>
              <th>Reviewed by</th>
              <th>Reviewed at</th>
              <th>Reason (if rejected)</th>
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ color: '#9bb0e0', fontStyle: 'italic' }}>
                  No decisions yet.
                </td>
              </tr>
            ) : recent.map((a) => (
              <tr key={a.id}>
                <td>{statusBadge(a.status)}</td>
                <td>{a.employee_username}</td>
                <td>{a.competency_title}</td>
                <td>{a.score}/{a.max_score}</td>
                <td>{a.level || '—'}</td>
                <td>{a.requested_by_username || '—'}</td>
                <td>{a.reviewed_by_username || '—'}</td>
                <td>{a.reviewed_at ? new Date(a.reviewed_at).toLocaleString() : '—'}</td>
                <td style={{ maxWidth: 240, wordBreak: 'break-word', color: '#ffb4b4' }}>
                  {a.rejection_reason || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
