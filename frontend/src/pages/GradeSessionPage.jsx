import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/client.js';
import { useToast } from '../hooks/useToast.jsx';

/**
 * Dedicated grading page (replaces the popup modal).
 *
 * Route: /manager/grade/:sessionId
 *
 * Mobile-first layout:
 *   - Sticky header with Back + session title
 *   - Scrollable body with one card per answer
 *   - Sticky action bar (Cancel + Finalize Grade) anchored to the
 *     bottom, always reachable even with the keyboard open
 *
 * Behaviour matches the old in-modal logic:
 *   - Loads /training/exam/sessions/<id>/
 *   - Save persists one answer's grade
 *   - Finalize Grade saves every answer then calls grade/<id>/
 */
export default function GradeSessionPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const [session, setSession] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  // -------- helpers ----------------------------------------------------
  const toMessage = (val, fallback) => {
    if (!val) return fallback;
    if (typeof val === 'string') return val;
    if (val?.detail) return String(val.detail);
    try { return JSON.stringify(val); } catch { return fallback; }
  };

  // -------- load session ----------------------------------------------
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    api.get(`/training/exam/sessions/${sessionId}/`)
      .then((res) => {
        if (!live) return;
        setSession(res.data);
        setAnswers((res.data.answers || []).map((a) => ({
          ...a,
          points_awarded: a.points_awarded ?? '',
        })));
      })
      .catch((e) => {
        if (!live) return;
        setError(toMessage(e?.response?.data, 'Failed to load session'));
      })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [sessionId]);

  // -------- per-answer save -------------------------------------------
  const submitAnswerGrade = async (answerId, points, comment) => {
    if (points === '' || points === null || points === undefined) {
      toastError('Please enter points before saving');
      return false;
    }
    try {
      await api.post('/training/exam/answer/grade/', {
        answer_id: answerId,
        points_awarded: Number(points),
        manager_comment: comment || '',
      });
      success('Answer saved');
      return true;
    } catch (e) {
      const msg = toMessage(e?.response?.data, 'Failed to save grade');
      setError(msg);
      toastError(msg);
      return false;
    }
  };

  // -------- finalize whole session ------------------------------------
  const finalize = async () => {
    setWorking(true);
    setError('');
    try {
      for (const a of answers) {
        const ok = await submitAnswerGrade(a.id, a.points_awarded, a.manager_comment);
        if (!ok) { setWorking(false); return; }
      }
      await api.post(`/training/exam/grade/${sessionId}/`, {});
      success('Session graded');
      navigate(-1);
    } catch (e) {
      const msg = toMessage(e?.response?.data, 'Failed to finalize grading');
      setError(msg);
      toastError(msg);
    } finally {
      setWorking(false);
    }
  };

  // -------- header content --------------------------------------------
  const title = session?.exam?.title || `Session #${sessionId}`;
  const employee =
    session?.employee?.username ||
    session?.employee?.employee_number ||
    '';

  const allHavePoints = answers.length > 0
    && answers.every((a) => a.points_awarded !== '' && a.points_awarded !== null && a.points_awarded !== undefined);

  return (
    <div className="grade-page">
      {/* Light-theme overrides scoped to this page so the global dark
          inputs / buttons don't leak in. */}
      <style>{`
        .grade-page {
          min-height: 100vh;
          background: #f0f4fa;
          color: #0f1c34;
          display: flex;
          flex-direction: column;
        }
        .grade-page input,
        .grade-page textarea {
          background: #fff !important;
          color: #0f1c34 !important;
          border: 1px solid #c8d3e8 !important;
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 16px; /* prevents iOS auto-zoom */
          box-sizing: border-box;
        }
        .grade-page input::placeholder,
        .grade-page textarea::placeholder { color: #8b9ab8 !important; }
        .grade-page .btn {
          background: #fff !important;
          color: #0f1c34 !important;
          border: 1px solid #c8d3e8 !important;
          padding: 9px 16px;
          min-height: 40px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
        }
        .grade-page .btn:hover { background: #f1f3f8 !important; }
        .grade-page .btn.primary {
          background: linear-gradient(135deg,#5b8cff,#6aa0ff) !important;
          color: #fff !important;
          border: 1px solid #5b8cff !important;
        }
        .grade-page .btn.primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .grade-page .btn.ghost {
          background: transparent !important;
          color: #fff !important;
          border: 1px solid rgba(255,255,255,0.4) !important;
        }
        .grade-page .grade-card {
          background: #fff;
          border: 1px solid #e3eafc;
          border-radius: 12px;
          padding: 16px;
          margin: 0 0 12px;
        }
      `}</style>

      {/* -------- STICKY HEADER -------- */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'linear-gradient(135deg,#1f2a52,#2b3d7a)',
          color: '#fff',
          padding: '12px 14px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <button
          type="button"
          className="btn ghost"
          onClick={() => navigate(-1)}
          aria-label="Back"
          title="Back"
          style={{
            minHeight: 40,
            padding: '6px 12px',
            fontWeight: 600,
          }}
        >
          ← Back
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontWeight: 800,
              fontSize: 16,
              lineHeight: 1.2,
              wordBreak: 'break-word',
            }}
          >
            Grade: {title}
          </div>
          {employee && (
            <div
              style={{
                fontSize: 12,
                color: '#cfe1ff',
                marginTop: 2,
                wordBreak: 'break-word',
              }}
            >
              Employee: {employee}
            </div>
          )}
        </div>
      </div>

      {/* -------- BODY -------- */}
      <div style={{ flex: 1, padding: 14, paddingBottom: 96 }}>
        {loading && <div style={{ color: '#1976d2', padding: 8 }}>Loading…</div>}
        {error && (
          <div
            style={{
              background: '#fde8e8',
              color: '#b1100d',
              border: '1px solid #f5b7b6',
              borderRadius: 10,
              padding: 10,
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        {!loading && answers.length === 0 && !error && (
          <div className="grade-card" style={{ color: '#5c6b85', fontStyle: 'italic' }}>
            No answers on this session.
          </div>
        )}

        {answers.map((a, idx) => (
          <div key={a.id} className="grade-card">
            <div
              style={{
                fontWeight: 700,
                marginBottom: 6,
                wordBreak: 'break-word',
                fontSize: 15,
              }}
            >
              Q{idx + 1}: {a.question?.text}
            </div>
            <div
              style={{
                fontSize: 14,
                marginBottom: 12,
                wordBreak: 'break-word',
                color: '#37466b',
              }}
            >
              <b>Employee Answer:</b>{' '}
              {a.text_answer ||
                (a.selected_choices?.map((c) => c.text).join(', ') || '—')}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 14,
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontWeight: 600 }}>Points:</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={a.question?.max_points || 1}
                  step="any"
                  value={a.points_awarded}
                  onChange={(e) =>
                    setAnswers((prev) =>
                      prev.map((ans) =>
                        ans.id === a.id ? { ...ans, points_awarded: e.target.value } : ans
                      )
                    )
                  }
                  style={{ width: 100 }}
                />
                <span style={{ color: '#647187' }}>/ {a.question?.max_points}</span>
              </label>

              <input
                type="text"
                placeholder="Manager comment (optional)"
                value={a.manager_comment || ''}
                onChange={(e) =>
                  setAnswers((prev) =>
                    prev.map((ans) =>
                      ans.id === a.id ? { ...ans, manager_comment: e.target.value } : ans
                    )
                  )
                }
                style={{ width: '100%' }}
              />

              <button
                className="btn"
                style={{ alignSelf: 'flex-end' }}
                onClick={() =>
                  submitAnswerGrade(a.id, a.points_awarded, a.manager_comment)
                }
              >
                Save answer
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* -------- STICKY FOOTER -------- */}
      <div
        style={{
          position: 'sticky',
          bottom: 0,
          zIndex: 10,
          background: '#fff',
          borderTop: '1px solid #e3eafc',
          padding: '12px 14px',
          display: 'flex',
          gap: 10,
          justifyContent: 'flex-end',
          flexWrap: 'wrap',
          boxShadow: '0 -8px 20px -10px rgba(0,0,0,0.12)',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <button className="btn" onClick={() => navigate(-1)}>
          Cancel
        </button>
        <button
          className="btn primary"
          disabled={!allHavePoints || working}
          onClick={finalize}
        >
          {working ? 'Finalizing…' : 'Finalize Grade'}
        </button>
      </div>
    </div>
  );
}
