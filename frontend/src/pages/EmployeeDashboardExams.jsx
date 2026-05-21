import React from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { fetchUserExamSessions } from "../api/examSessionUtils";

export default function EmployeeDashboardExams() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [examSessionStatus, setExamSessionStatus] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([
      api.get("/training/exams/list/"),
      fetchUserExamSessions()
    ])
      .then(([examsRes, sessionMap]) => {
        setExams(examsRes.data || []);
        setExamSessionStatus(sessionMap);
      })
      .catch(() => setError("Failed to load assessments."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="card p-4">
      <h2 style={{fontWeight:700, fontSize: "1.5rem", marginBottom: 18}}>Available Assessments</h2>
      {loading && <div style={{color: '#1976d2', fontSize: 18}}>Loading…</div>}
      {error && <div style={{color: '#c62828', fontSize: 16}}>{error}</div>}
      {!loading && !error && exams.length === 0 && (
        <div style={{color: '#888', fontSize: 16}}>No assessments available.</div>
      )}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20}}>
        {exams.map((exam) => {
          const info = examSessionStatus[exam.id] || { status: "NONE", canStart: true };
          const isRetake = info.status === "GRADED" && info.retakeAllowed && info.canStart;
          const blocked = !info.canStart;
          // Determine label
          let label = "Start Assessment";
          if (blocked) label = "Open Assessment";
          else if (isRetake) label = "Retake Exam";
          else if (info.status === "IN_PROGRESS") label = "Resume Assessment";
          return (
            <div key={exam.id} style={{background: '#fff', borderRadius: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.07)', padding: 20, marginBottom: 10, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', wordBreak: 'break-word'}}>
              <div style={{fontWeight: 600, fontSize: 18, color: '#1976d2', marginBottom: 6}}>{exam.title}</div>
              <div style={{color: '#444', fontSize: 15, marginBottom: 8}}>{exam.description || 'No description'}</div>
              <div style={{color: '#888', fontSize: 13, marginBottom: 8}}>Time Limit: {exam.time_limit_seconds ? (exam.time_limit_seconds/60)+" min" : 'N/A'}</div>
              {isRetake && (
                <div style={{color: '#16a34a', fontSize: 13, fontWeight: 600, marginBottom: 6}}>
                  Retake unlocked by manager - your previous attempt remains in history.
                </div>
              )}
              <button
                style={{
                  marginTop: 'auto',
                  background: blocked ? '#e0e0e0' : (isRetake ? '#16a34a' : '#1976d2'),
                  color: blocked ? '#888' : '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 18px',
                  fontWeight: 600,
                  cursor: blocked ? 'not-allowed' : 'pointer'
                }}
                onClick={() => {
                  if (blocked) {
                    window.alert('You have already submitted this assessment.');
                  } else {
                    navigate(`/assessment/${exam.id}`);
                  }
                }}
                disabled={false}
              >
                {label}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
