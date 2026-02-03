// Utility to fetch user's exam sessions and map examId to status
import api from "../api/client";

export async function fetchUserExamSessions() {
  const res = await api.get("/training/exam/sessions/");
  // Returns array of {id, exam: {id, ...}, status, ...}
  const map = {};
  (res.data || []).forEach(session => {
    if (session.exam && session.exam.id) {
      map[session.exam.id] = session.status;
    }
  });
  return map;
}
