// Utility to fetch user's exam sessions and map examId to status info.
import api from "../api/client";

// Status priority - a SUBMITTED/GRADED session wins over an IN_PROGRESS
// one when the same examId appears more than once.
const STATUS_RANK = { IN_PROGRESS: 0, EXPIRED: 0, SUBMITTED: 1, GRADED: 2 };

// Returns a map keyed by examId. Each entry is an object:
//   { status, retakeAllowed, sessionId, canStart }
// `canStart` is the simple flag the UI should look at to decide whether
// to surface a "Start Assessment" / "Retake Exam" button. It is true if
// the employee currently has no terminal session for this exam, OR the
// most recent terminal session is GRADED+failed AND the manager has
// flipped retake_allowed.
export async function fetchUserExamSessions() {
  const res = await api.get("/training/exam/sessions/");
  // Returns array of {id, exam: {id,...}, status, score, max_score, retake_allowed,...}
  const byExam = {};
  (res.data || []).forEach((session) => {
    const examId = session.exam && session.exam.id;
    if (!examId) return;
    if (!byExam[examId]) byExam[examId] = [];
    byExam[examId].push(session);
  });

  const map = {};
  Object.entries(byExam).forEach(([examId, sessions]) => {
    // Pick the highest-priority terminal session (SUBMITTED/GRADED)
    let terminal = null;
    let inProgress = null;
    for (const s of sessions) {
      if (s.status === "IN_PROGRESS") {
        if (!inProgress || new Date(s.started_at) > new Date(inProgress.started_at)) {
          inProgress = s;
        }
      } else if (s.status === "SUBMITTED" || s.status === "GRADED") {
        const rank = STATUS_RANK[s.status] ?? 0;
        const prevRank = terminal ? (STATUS_RANK[terminal.status] ?? 0) : -1;
        if (rank > prevRank || (rank === prevRank && new Date(s.started_at) > new Date(terminal.started_at))) {
          terminal = s;
        }
      }
    }

    let status = "NONE";
    let retakeAllowed = false;
    let sessionId = null;
    let canStart = true; // No session yet → user can start

    if (inProgress) {
      status = "IN_PROGRESS";
      sessionId = inProgress.id;
      canStart = true; // resume
    } else if (terminal) {
      status = terminal.status;
      sessionId = terminal.id;
      retakeAllowed = !!terminal.retake_allowed;
      if (terminal.status === "GRADED") {
        const pct = terminal.max_score
          ? (Number(terminal.score || 0) / Number(terminal.max_score)) * 100
          : 0;
        const failed = pct < 60;
        // Retake is offered only when the manager has unlocked it.
        canStart = failed && retakeAllowed;
      } else {
        // SUBMITTED but not yet graded - employee shouldn't restart.
        canStart = false;
      }
    }
    map[examId] = { status, retakeAllowed, sessionId, canStart };
  });
  return map;
}
