import { useEffect, useState } from 'react';
import api from '../api/client.js';

/**
 * Manager-side form for submitting a verbal-assessment award for one
 * employee. Lives inside the Employee Lookup tab and stacks below any
 * existing awards already submitted for the same employee.
 *
 * Props:
 *   employeeId       - numeric ID of the employee being awarded
 *   employeeName     - display name (for the heading)
 *   competencies     - array of competency objects (id, reference_number, title)
 *   onAfterSubmit?   - optional callback fired after a successful submit
 */
export default function ManualAwardForm({
  employeeId,
  employeeName,
  competencies = [],
  onAfterSubmit,
}) {
  const [form, setForm] = useState({
    competency_id: '',
    score: '',
    max_score: '100',
    level: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const refreshHistory = async () => {
    if (!employeeId) return;
    try {
      const res = await api.get('/training/manual-awards/');
      const all = Array.isArray(res.data) ? res.data : [];
      setHistory(all.filter((a) => Number(a.employee) === Number(employeeId)));
    } catch {
      // silent - history is non-critical
    }
  };

  useEffect(() => {
    let live = true;
    setLoading(true);
    refreshHistory().finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const change = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.competency_id) { setError('Pick a competency.'); return; }
    if (form.score === '' || isNaN(Number(form.score))) { setError('Enter a numeric score.'); return; }

    setSubmitting(true);
    try {
      await api.post('/training/manual-awards/', {
        employee_id: employeeId,
        competency_id: Number(form.competency_id),
        score: Number(form.score),
        max_score: Number(form.max_score || 100),
        level: form.level || undefined,
        notes: form.notes || '',
      });
      setForm({ competency_id: '', score: '', max_score: '100', level: '', notes: '' });
      await refreshHistory();
      if (onAfterSubmit) onAfterSubmit();
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.response?.data || 'Submit failed';
      setError(typeof detail === 'string' ? detail : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = (s) => {
    const colors = {
      PENDING:  { bg: '#3b3015', fg: '#ffd97a', label: 'Pending' },
      APPROVED: { bg: '#143b22', fg: '#7be1a1', label: 'Approved' },
      REJECTED: { bg: '#3b1414', fg: '#ffb4b4', label: 'Rejected' },
    };
    const c = colors[s] || { bg: '#333', fg: '#fff', label: s };
    return (
      <span style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 999,
        background: c.bg,
        color: c.fg,
        fontSize: 11,
        fontWeight: 700,
      }}>{c.label}</span>
    );
  };

  return (
    <div
      className="card"
      style={{ marginTop: 24, background: '#22305a', color: '#fff' }}
    >
      <h4 style={{ marginTop: 0, marginBottom: 4 }}>
        Manual Award (verbal assessment)
      </h4>
      <div style={{ fontSize: 12, color: '#9bb0e0', marginBottom: 12 }}>
        Submit a score and (optionally) a level for {employeeName || 'this employee'}.
        An admin must approve before it counts toward their record.
      </div>

      <form onSubmit={submit}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <select
            name="competency_id"
            value={form.competency_id}
            onChange={change}
            style={{ minWidth: 220, flex: '1 1 220px' }}
          >
            <option value="">Select competency…</option>
            {competencies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.reference_number ? `${c.reference_number} — ` : ''}{c.title}
              </option>
            ))}
          </select>
        </div>

        <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <input
            type="number"
            step="any"
            min="0"
            name="score"
            placeholder="Score"
            value={form.score}
            onChange={change}
            style={{ width: 120 }}
          />
          <input
            type="number"
            step="any"
            min="1"
            name="max_score"
            placeholder="Max"
            value={form.max_score}
            onChange={change}
            style={{ width: 120 }}
          />
          <select
            name="level"
            value={form.level}
            onChange={change}
            style={{ minWidth: 140 }}
          >
            <option value="">Level (optional)</option>
            <option value="CL0">CL0 — None</option>
            <option value="CL1">CL1 — Awareness</option>
            <option value="CL2">CL2 — Knowledge</option>
            <option value="CL3">CL3 — Skill</option>
            <option value="CL4">CL4 — Master</option>
          </select>
        </div>

        <textarea
          name="notes"
          placeholder="Notes (optional) — e.g. verbal assessment performed on 2026-06-04"
          value={form.notes}
          onChange={change}
          style={{ width: '100%', minHeight: 64, marginBottom: 8 }}
        />

        {error && (
          <div style={{ color: '#ffb4b4', marginBottom: 8 }}>{error}</div>
        )}

        <button
          type="submit"
          className="btn primary"
          disabled={submitting}
        >
          {submitting ? 'Submitting…' : 'Submit for admin approval'}
        </button>
      </form>

      {/* History for this employee */}
      <div style={{ marginTop: 16, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>
          Recent awards for this employee
        </div>
        {loading ? (
          <div style={{ color: '#9bb0e0' }}>Loading…</div>
        ) : history.length === 0 ? (
          <div style={{ color: '#9bb0e0', fontStyle: 'italic' }}>None yet.</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {history.slice(0, 5).map((a) => (
              <li
                key={a.id}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 10,
                  alignItems: 'center',
                  padding: '8px 10px',
                  marginBottom: 6,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8,
                }}
              >
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>
                    {a.competency_title || `Competency #${a.competency}`}
                  </div>
                  <div style={{ fontSize: 12, color: '#9bb0e0' }}>
                    Score {a.score}/{a.max_score}
                    {a.level ? ` · Level ${a.level}` : ''}
                    {a.requested_at ? ` · ${new Date(a.requested_at).toLocaleString()}` : ''}
                  </div>
                  {a.status === 'REJECTED' && a.rejection_reason && (
                    <div style={{ fontSize: 12, color: '#ffb4b4', marginTop: 2 }}>
                      Reason: {a.rejection_reason}
                    </div>
                  )}
                </div>
                <div>{statusBadge(a.status)}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
