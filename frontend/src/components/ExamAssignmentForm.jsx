import { useEffect, useState } from 'react';
import api from '../api/client.js';

/**
 * Manager-side form for assigning an exam to one specific employee.
 * Lives inside the Manager Employee Lookup tab, just under the manual
 * award form. Shows recent assignments for the same employee with
 * Cancel buttons for ones still in the ASSIGNED state.
 *
 * Props:
 *   employeeId    - numeric ID of the employee being assigned to
 *   employeeName  - display name (for the heading)
 *   exams         - array of ExamTemplate objects { id, title, competency? }
 *   onAfterSubmit?- optional callback fired after a successful create
 */
export default function ExamAssignmentForm({
  employeeId,
  employeeName,
  exams = [],
  onAfterSubmit,
}) {
  const [form, setForm] = useState({
    exam_id: '',
    due_date: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState(null);

  const refresh = async () => {
    if (!employeeId) return;
    try {
      const res = await api.get(`/training/exam-assignments/?employee=${employeeId}`);
      setHistory(Array.isArray(res.data) ? res.data : []);
    } catch {
      // silent - history is non-critical
    }
  };

  useEffect(() => {
    let live = true;
    setLoading(true);
    refresh().finally(() => { if (live) setLoading(false); });
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
    if (!form.exam_id) { setError('Pick an exam to assign.'); return; }

    setSubmitting(true);
    try {
      await api.post('/training/exam-assignments/', {
        employee_id: employeeId,
        exam_id: Number(form.exam_id),
        due_date: form.due_date || undefined,
        notes: form.notes || '',
      });
      setForm({ exam_id: '', due_date: '', notes: '' });
      await refresh();
      if (onAfterSubmit) onAfterSubmit();
    } catch (err) {
      const data = err?.response?.data;
      const detail = (data && (data.detail || data)) || 'Assignment failed';
      setError(typeof detail === 'string' ? detail : 'Assignment failed');
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async (a) => {
    if (!window.confirm(
      `Cancel the assignment of "${a.exam_title}" for ${a.employee_username}?\n\n` +
      `This only works while the assignment is still ASSIGNED ` +
      `(not yet started).`
    )) return;
    setActingId(a.id);
    try {
      await api.post(`/training/exam-assignments/${a.id}/cancel/`);
      await refresh();
    } catch (err) {
      const data = err?.response?.data;
      const detail = (data && (data.detail || data)) || 'Cancel failed';
      setError(typeof detail === 'string' ? detail : 'Cancel failed');
    } finally {
      setActingId(null);
    }
  };

  const statusBadge = (s) => {
    const colors = {
      ASSIGNED:  { bg: '#15293b', fg: '#7ab9ff', label: 'Assigned' },
      STARTED:   { bg: '#3b3015', fg: '#ffd97a', label: 'In progress' },
      COMPLETED: { bg: '#143b22', fg: '#7be1a1', label: 'Completed' },
      CANCELLED: { bg: '#3b1414', fg: '#ffb4b4', label: 'Cancelled' },
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
        Assign Exam
      </h4>
      <div style={{ fontSize: 12, color: '#9bb0e0', marginBottom: 12 }}>
        Publish an exam personally to {employeeName || 'this employee'}.
        Each assignment is shuffled per employee so two people taking the
        same exam see different question orders.
      </div>

      <form onSubmit={submit}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <select
            name="exam_id"
            value={form.exam_id}
            onChange={change}
            style={{ minWidth: 220, flex: '1 1 220px' }}
          >
            <option value="">Select exam…</option>
            {exams.map((ex) => {
              const compTitle = typeof ex.competency === 'object'
                ? ex.competency?.title
                : null;
              return (
                <option key={ex.id} value={ex.id}>
                  {ex.title}{compTitle ? ` — ${compTitle}` : ''}
                </option>
              );
            })}
          </select>
          <input
            type="date"
            name="due_date"
            value={form.due_date}
            onChange={change}
            style={{ minWidth: 160 }}
            title="Optional due date"
          />
        </div>

        <textarea
          name="notes"
          placeholder="Notes (optional) — e.g. 'Yearly recertification 2026'"
          value={form.notes}
          onChange={change}
          style={{ width: '100%', minHeight: 56, marginBottom: 8 }}
        />

        {error && (
          <div style={{ color: '#ffb4b4', marginBottom: 8 }}>{error}</div>
        )}

        <button
          type="submit"
          className="btn primary"
          disabled={submitting}
        >
          {submitting ? 'Assigning…' : 'Assign exam to this employee'}
        </button>
      </form>

      {/* History for this employee */}
      <div style={{ marginTop: 16, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>
          Recent assignments
        </div>
        {loading ? (
          <div style={{ color: '#9bb0e0' }}>Loading…</div>
        ) : history.length === 0 ? (
          <div style={{ color: '#9bb0e0', fontStyle: 'italic' }}>
            No assignments yet.
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {history.slice(0, 8).map((a) => (
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
                <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>
                    {a.exam_title || `Exam #${a.exam}`}
                  </div>
                  <div style={{ fontSize: 12, color: '#9bb0e0' }}>
                    {a.competency_title ? `${a.competency_title} · ` : ''}
                    Assigned {a.assigned_at ? new Date(a.assigned_at).toLocaleString() : '—'}
                    {a.due_date ? ` · due ${a.due_date}` : ''}
                  </div>
                  {a.notes && (
                    <div style={{ fontSize: 12, color: '#cfe1ff', marginTop: 2 }}>
                      {a.notes}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {statusBadge(a.status)}
                  {a.status === 'ASSIGNED' && (
                    <button
                      type="button"
                      className="btn danger"
                      onClick={() => cancel(a)}
                      disabled={actingId === a.id}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
