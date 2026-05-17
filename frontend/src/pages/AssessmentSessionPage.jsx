import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/client";
import AssessmentQuestionCard from "../components/AssessmentQuestionCard.jsx";
import { fetchUserExamSessions } from "../api/examSessionUtils";

/**
 * Paginated exam-taking experience.
 *
 * - Shows ONE question at a time so big exams stay focused and mobile-friendly.
 * - Top bar: title, timer, progress bar, "Q N of M, X answered".
 * - Bottom bar: Previous / Next / Submit Exam.
 * - Question navigator grid: tap any number to jump there. Answered questions
 *   are highlighted; the current one is outlined.
 * - Submit asks for confirmation if some questions are unanswered.
 * - Timer expires -> auto-submit + redirect (unchanged from previous version).
 */
export default function AssessmentSessionPage() {
  const { examId } = useParams();
  const navigate = useNavigate();

  // session + loading
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  // answers and current page
  const [answers, setAnswers] = useState({});
  const [currentIdx, setCurrentIdx] = useState(0);

  // submit
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // timer
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [timeUp, setTimeUp] = useState(false);

  // refs the timer callback uses (don't recreate it every render)
  const answersRef = useRef(answers);
  useEffect(() => { answersRef.current = answers; }, [answers]);
  const sessionRef = useRef(session);
  useEffect(() => { sessionRef.current = session; }, [session]);
  const submittedRef = useRef(false);
  const topRef = useRef(null);

  // ---- Start / resume session ----
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    fetchUserExamSessions().then((sessionMap) => {
      const finished = sessionMap[examId] === "SUBMITTED" || sessionMap[examId] === "GRADED";
      if (finished) {
        if (live) { setAlreadySubmitted(true); setLoading(false); }
        return;
      }
      api.post("/training/exam/start/", { exam_id: examId })
        .then((res) => live && setSession(res.data))
        .catch((e) => {
          if (!live) return;
          const msg = e?.response?.data?.detail
            || e?.response?.data?.exam_id?.[0]
            || "Failed to start assessment session.";
          setError(msg);
        })
        .finally(() => live && setLoading(false));
    });
    return () => { live = false; };
  }, [examId]);

  // ---- Countdown ticker ----
  useEffect(() => {
    if (!session) return;
    const limit = Number(session.exam?.time_limit_seconds || 0);
    if (!limit) { setSecondsLeft(null); return; }
    const startedAt = new Date(session.started_at).getTime();
    const deadline = startedAt + limit * 1000;
    const tick = () => {
      const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0) setTimeUp(true);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session]);

  // ---- Auto-submit on timer expiry ----
  useEffect(() => {
    if (timeUp && !submittedRef.current) submit(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeUp]);

  // ---- Memoized question list + answered counter ----
  const questions = useMemo(() => session?.exam?.questions || [], [session]);
  const total = questions.length;
  const safeIdx = total > 0 ? Math.min(Math.max(0, currentIdx), total - 1) : 0;
  const currentQ = total > 0 ? questions[safeIdx] : null;

  const isAnswered = (q) => {
    const a = answers[q.id];
    if (!q) return false;
    if (q.type === "MCQ_MULTI") return Array.isArray(a) && a.length > 0;
    if (q.type === "MCQ_SINGLE" || q.type === "TRUE_FALSE") return a !== undefined && a !== null;
    return typeof a === "string" && a.trim().length > 0;
  };
  const answeredCount = questions.reduce((n, q) => n + (isAnswered(q) ? 1 : 0), 0);
  const unansweredIdxs = questions.map((q, i) => (isAnswered(q) ? -1 : i)).filter((i) => i >= 0);

  // ---- Build the submit payload ----
  const buildPayload = () => {
    const liveAnswers = answersRef.current || {};
    return {
      session_id: sessionRef.current.id,
      answers: questions.map((q) => {
        const a = liveAnswers[q.id];
        if (q.type === "MCQ_MULTI") {
          return { question: q.id, selected_choices: Array.isArray(a) ? a : [], text_answer: "" };
        }
        if (q.type === "MCQ_SINGLE" || q.type === "TRUE_FALSE") {
          return { question: q.id, selected_choices: a ? [a] : [], text_answer: "" };
        }
        return { question: q.id, selected_choices: [], text_answer: a || "" };
      }),
    };
  };

  const submit = (auto = false) => {
    if (submittedRef.current) return;
    if (!sessionRef.current) return;

    // Manual submit warns if some questions are unanswered.
    if (!auto && unansweredIdxs.length > 0) {
      const ok = window.confirm(
        `You have ${unansweredIdxs.length} unanswered question${unansweredIdxs.length === 1 ? '' : 's'}. Submit anyway?`
      );
      if (!ok) return;
    }

    submittedRef.current = true;
    setSubmitting(true);
    setSubmitError("");

    api.post("/training/exam/submit/", buildPayload())
      .then(() => {
        if (auto) setTimeout(() => navigate("/", { replace: true }), 1200);
        else navigate("/", { replace: true });
      })
      .catch(() => {
        if (!auto) submittedRef.current = false;
        setSubmitError("Failed to submit answers.");
      })
      .finally(() => setSubmitting(false));
  };

  // Handle answer changes
  const handleAnswer = (qid, value) => {
    if (timeUp) return;
    setAnswers((a) => ({ ...a, [qid]: value }));
  };

  // Helpers to move through questions and scroll to top
  const goto = (idx) => {
    if (idx < 0 || idx >= total) return;
    setCurrentIdx(idx);
    if (topRef.current) topRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const next = () => goto(safeIdx + 1);
  const prev = () => goto(safeIdx - 1);

  // ---- Render gating ----
  if (loading)
    return <div className="card" style={{ margin: 24, padding: 20 }}>Starting assessment…</div>;
  if (alreadySubmitted)
    return (
      <div className="card" style={{ margin: 24, padding: 20, color: '#c62828', fontWeight: 600 }}>
        You have already submitted this assessment. You cannot retake it.
      </div>
    );
  if (error)
    return <div className="card" style={{ margin: 24, padding: 20, color: '#c62828' }}>{error}</div>;
  if (!session) return null;
  if (total === 0)
    return <div className="card" style={{ margin: 24, padding: 20 }}>This exam has no questions yet.</div>;

  const pct = total > 0 ? Math.round((answeredCount / total) * 100) : 0;
  const minutesStr = secondsLeft != null ? String(Math.floor(secondsLeft / 60)).padStart(2, '0') : null;
  const secondsStr = secondsLeft != null ? String(secondsLeft % 60).padStart(2, '0') : null;
  const timerWarn = secondsLeft != null && secondsLeft <= 60;
  const timerCrit = secondsLeft != null && secondsLeft <= 10;

  // -------------------------- VIEW --------------------------
  return (
    <div
      ref={topRef}
      className="assessment-card"
      style={{
        background: '#fff',
        borderRadius: 16,
        boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
        padding: 28,
        maxWidth: 760,
        margin: '24px auto',
        color: '#222',
      }}
    >
      {/* ---- HEADER: title + timer ---- */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ fontWeight: 700, fontSize: '1.4rem', margin: 0, color: '#1976d2' }}>
          {session.exam?.title}
        </h2>
        {secondsLeft != null && (
          <div
            title="Time remaining"
            style={{
              background: timerCrit ? '#c62828' : timerWarn ? '#ef6c00' : '#1976d2',
              color: '#fff',
              padding: '8px 14px',
              borderRadius: 999,
              fontWeight: 700,
              fontFamily: 'monospace',
              fontSize: 16,
              minWidth: 90,
              textAlign: 'center',
            }}
          >
            ⏱ {minutesStr}:{secondsStr}
          </div>
        )}
      </div>

      {/* ---- PROGRESS ---- */}
      <div style={{ marginTop: 14, marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <span style={{ fontSize: 14, color: '#444', fontWeight: 600 }}>
            Question {safeIdx + 1} of {total}
          </span>
          <span style={{ fontSize: 13, color: '#666' }}>
            {answeredCount} of {total} answered ({pct}%)
          </span>
        </div>
        <div style={{ height: 8, background: '#e3eafc', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #5b8cff, #57b3ff)',
            transition: 'width 280ms ease',
          }} />
        </div>
      </div>

      {/* ---- TIME-UP BANNER ---- */}
      {timeUp && (
        <div style={{
          background: '#ffebee',
          border: '1px solid #c62828',
          color: '#b71c1c',
          padding: 14,
          borderRadius: 8,
          fontWeight: 700,
          marginBottom: 16,
        }}>
          Time is up. Submitting your answers…
        </div>
      )}

      {/* ---- ONE QUESTION ---- */}
      {currentQ && (
        <AssessmentQuestionCard
          key={currentQ.id}
          question={currentQ}
          answer={answers[currentQ.id]}
          onAnswer={(val) => handleAnswer(currentQ.id, val)}
        />
      )}

      {/* ---- NAV BUTTONS ---- */}
      <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
        <button
          onClick={prev}
          disabled={safeIdx === 0 || timeUp || submitting}
          style={{
            background: '#f5f6fa', color: '#1976d2',
            border: '1.5px solid #e3eafc', borderRadius: 8,
            padding: '12px 24px', fontWeight: 600,
            cursor: safeIdx === 0 || timeUp || submitting ? 'not-allowed' : 'pointer',
            opacity: safeIdx === 0 || timeUp || submitting ? 0.5 : 1,
            flex: '1 1 120px',
          }}
        >
          ← Previous
        </button>
        {safeIdx < total - 1 ? (
          <button
            onClick={next}
            disabled={timeUp || submitting}
            style={{
              background: '#1976d2', color: '#fff', border: 'none', borderRadius: 8,
              padding: '12px 24px', fontWeight: 700, fontSize: 15,
              cursor: timeUp || submitting ? 'not-allowed' : 'pointer',
              opacity: timeUp || submitting ? 0.7 : 1,
              flex: '1 1 120px',
            }}
          >
            Next →
          </button>
        ) : (
          <button
            onClick={() => submit(false)}
            disabled={timeUp || submitting}
            style={{
              background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 8,
              padding: '12px 24px', fontWeight: 700, fontSize: 15,
              cursor: timeUp || submitting ? 'not-allowed' : 'pointer',
              opacity: timeUp || submitting ? 0.7 : 1,
              flex: '1 1 160px',
            }}
          >
            {submitting ? 'Submitting…' : 'Submit Exam'}
          </button>
        )}
      </div>

      {submitError && (
        <div style={{ color: '#c62828', marginTop: 12, fontWeight: 600 }}>{submitError}</div>
      )}

      {/* ---- JUMP-TO GRID ---- */}
      <div style={{
        marginTop: 28,
        padding: 14,
        background: '#f5f8ff',
        borderRadius: 10,
        border: '1px solid #e3eafc',
      }}>
        <div style={{ fontSize: 13, color: '#444', fontWeight: 600, marginBottom: 8 }}>
          Jump to a question:
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(40px, 1fr))',
          gap: 6,
        }}>
          {questions.map((q, idx) => {
            const ans = isAnswered(q);
            const isCurr = idx === safeIdx;
            return (
              <button
                key={q.id}
                onClick={() => goto(idx)}
                disabled={timeUp || submitting}
                title={ans ? 'Answered' : 'Not answered'}
                style={{
                  padding: '8px 0',
                  borderRadius: 6,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: timeUp || submitting ? 'not-allowed' : 'pointer',
                  border: isCurr ? '2px solid #1976d2' : '1px solid #c8d3e8',
                  background: ans ? '#2e7d32' : '#fff',
                  color: ans ? '#fff' : '#444',
                  minHeight: 36,
                }}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
        {unansweredIdxs.length > 0 && !timeUp && (
          <div style={{ marginTop: 10, fontSize: 12, color: '#666' }}>
            {unansweredIdxs.length} unanswered. Make sure to review before submit.
          </div>
        )}
      </div>

      {/* ---- FINAL SUBMIT FALLBACK (always visible) ---- */}
      {safeIdx !== total - 1 && (
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <button
            onClick={() => submit(false)}
            disabled={timeUp || submitting}
            style={{
              background: 'transparent',
              color: '#2e7d32',
              border: '1.5px solid #2e7d32',
              borderRadius: 8,
              padding: '10px 18px',
              fontWeight: 700,
              cursor: timeUp || submitting ? 'not-allowed' : 'pointer',
              opacity: timeUp || submitting ? 0.5 : 1,
            }}
            title="Submit the entire exam now"
          >
            Submit Exam Early
          </button>
        </div>
      )}
    </div>
  );
}
