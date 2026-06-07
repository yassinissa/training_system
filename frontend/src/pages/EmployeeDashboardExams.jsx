import React from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { fetchUserExamSessions } from "../api/examSessionUtils";

export default function EmployeeDashboardExams() {
  const [exams, setExams] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [examSessionStatus, setExamSessionStatus] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([
      api.get("/training/exams/list/"),
      fetchUserExamSessions(),
      // Manager-assigned exams (filtered to the logged-in user on the server)
      api.get("/training/exam-assignments/mine/").catch(() => ({ data: [] })),
    ])
      .then(([examsRes, sessionMap, asgRes]) => {
        setExams(examsRes.data || []);
        setExamSessionStatus(sessionMap);
        const list = Array.isArray(asgRes.data) ? asgRes.data : [];
        // Show only OPEN assignments (ASSIGNED or STARTED).
        setAssignments(list.filter(
          (a) => a.status === 'ASSIGNED' || a.status === 'STARTED'
        ));
      })
      .catch(() => setError("Failed to load assessments."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="card p-4">
      {/* ---- Manager-assigned exams (priority block) ---- */}
      {!loading && assignments.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontWeight: 700, fontSize: '1.5rem', marginBottom: 8 }}>
            Assigned to you
          </h2>
          <div style={{ color: '#555', fontSize: 14, marginBottom: 14 }}>
            Exams a manager assigned to you personally. These should be taken first.
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 20,
          }}>
            {assignments.map((a) => {
              const overdue = a.due_date && new Date(a.due_date) < new Date();
              const inProgress = a.status === 'STARTED';
              return (
                <div
                  key={a.id}
                  style={{
                    background: '#fff',
                    border: '2px solid #1976d2',
                    borderRadius: 14,
                    boxShadow: '0 4px 14px rgba(25,118,210,0.18)',
                    padding: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    wordBreak: 'break-word',
                  }}
                >
                  <span style={{
                    background: '#1976d2',
                    color: '#fff',
                    padding: '2px 10px',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 700,
                    marginBottom: 8,
                  }}>
                    {inProgress ? 'IN PROGRESS' : 'ASSIGNED'}
                  </span>
                  <div style={{ fontWeight: 600, fontSize: 18, color: '#1976d2', marginBottom: 6 }}>
                    {a.exam_title || `Exam #${a.exam}`}
                  </div>
                  {a.competency_title && (
                    <div style={{ color: '#444', fontSize: 14, marginBottom: 6 }}>
                      {a.competency_title}
                    </div>
                  )}
                  {a.notes && (
                    <div style={{ color: '#666', fontSize: 13, marginBottom: 6 }}>
                      {a.notes}
                    </div>
                  )}
                  {a.due_date && (
                    <div style={{
                      color: overdue ? '#c62828' : '#888',
                      fontSize: 13,
                      marginBottom: 10,
                      fontWeight: overdue ? 700 : 400,
                    }}>
                      {overdue ? 'Overdue — ' : 'Due '}{a.due_date}
                    </div>
                  )}
                  <button
                    style={{
                      marginTop: 'auto',
                      background: '#1976d2',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      padding: '10px 20px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                    onClick={() => navigate(`/assessment/${a.exam}`)}
                  >
                    {inProgress ? 'Resume exam' : 'Start exam'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <h2 style={{fontWeight:700, fontSize: "1.5rem", marginBottom: 18}}>Available Assessments</h2>
      {loading && <div style={{color: '#1976d2', fontSize: 18}}>Loading…</div>}
      {error && <div style={{color: '#c62828', fontSize: 16}}>{error}</div>}
      {!loading && !error && exams.length === 0 && assignments.length === 0 && (
        <div style={{color: '#888', fontSize: 16}}>No assessments available.</div>
      )}
      {!loading && !error && exams.length === 0 && assignments.length > 0 && (
        <div style={{color: '#888', fontSize: 14, fontStyle: 'italic'}}>
          Nothing else open right now — focus on the assigned exam above.
        </div>
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
