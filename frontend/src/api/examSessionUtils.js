// Utility to fetch user's exam sessions and map examId to status
import api from "../api/client";

// Status priority - a SUBMITTED/GRADED session wins over an IN_PROGRESS
// one when the same examId appears more than once.
const STATUS_RANK = { IN_PROGRESS: 0, EXPIRED: 0, SUBMITTED: 1, GRADED: 2 };

export async function fetchUserExamSessions() {
  const res = await api.get("/training/exam/sessions/");
  // Returns array of {id, exam: {id, ...}, status, ...}
  const map = {};
  (res.data || []).forEach(session => {
    const examId = session.exam && session.exam.id;
    if (!examId) return;
    const prev = map[examId];
    const prevRank = prev ? (STATUS_RANK[prev] ?? 0) : -1;
    const curRank = STATUS_RANK[session.status] ?? 0;
    if (curRank >= prevRank) {
      map[examId] = session.status;
    }
  });
  return map;
}
