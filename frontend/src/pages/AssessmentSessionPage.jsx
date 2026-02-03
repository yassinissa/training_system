import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/client";
import AssessmentQuestionCard from "../components/AssessmentQuestionCard.jsx";
import { fetchUserExamSessions } from "../api/examSessionUtils";

export default function AssessmentSessionPage() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError("");
    fetchUserExamSessions().then((sessionMap) => {
      if (sessionMap[examId] === "SUBMITTED") {
        if (isMounted) {
          setAlreadySubmitted(true);
          setLoading(false);
        }
      } else {
        api.post("/training/exam/start/", { exam_id: examId })
          .then((res) => isMounted && setSession(res.data))
          .catch(() => isMounted && setError("Failed to start assessment session."))
          .finally(() => isMounted && setLoading(false));
      }
    });
    return () => { isMounted = false; };
  }, [examId]);

  if (loading) return <div className="card p-4">Starting assessment…</div>;
  if (alreadySubmitted) return <div className="card p-4" style={{color:'#c62828', fontWeight:600}}>You have already submitted this assessment. You cannot retake it.</div>;
  if (error) return <div className="card p-4" style={{color:'#c62828'}}>{error}</div>;
  if (!session) return null;

  const questions = session.exam?.questions || [];
  const handleAnswer = (qid, value) => {
    setAnswers(a => ({ ...a, [qid]: value }));
  };
  const handleSubmit = () => {
    setSubmitting(true);
    setSubmitError("");
    // Prepare answers for backend
    const payload = {
      session_id: session.id,
      answers: questions.map(q => ({
        question: q.id,
        selected_choices: q.type === "MCQ_SINGLE" || q.type === "TRUE_FALSE" ? [answers[q.id]] : [],
        text_answer: q.type === "SHORT_TEXT" ? (answers[q.id] || "") : "",
      }))
    };
    api.post("/training/exam/submit/", payload)
      .then(() => window.location.reload())
      .catch(() => setSubmitError("Failed to submit answers."))
      .finally(() => setSubmitting(false));
  };

  return (
    <div style={{
      background: '#fff',
      borderRadius: 16,
      boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
      padding: 32,
      maxWidth: 700,
      margin: '40px auto',
      color: '#222',
    }}>
      <h2 style={{fontWeight:700, fontSize: "1.7rem", marginBottom: 18, color: '#1976d2'}}>Assessment: {session.exam?.title}</h2>
      <div style={{marginBottom: 18, color: '#1976d2', fontWeight: 500}}>Session ID: {session.id} | Status: {session.status.replace('_', ' ')}</div>
      {questions.map(q => (
        <AssessmentQuestionCard
          key={q.id}
          question={q}
          answer={answers[q.id]}
          onAnswer={val => handleAnswer(q.id, val)}
        />
      ))}
      {submitError && <div style={{color:'#c62828',marginBottom:10, fontWeight:600}}>{submitError}</div>}
      <div style={{display:'flex', gap:16, marginTop:24}}>
        <button
          onClick={handleSubmit}
          style={{background:'#1976d2',color:'#fff',border:'none',borderRadius:8,padding:'12px 32px',fontWeight:700,fontSize:17,cursor:'pointer', boxShadow:'0 2px 8px rgba(25,118,210,0.08)'}}
          disabled={submitting}
        >
          {submitting ? 'Submitting…' : 'Submit Answers'}
        </button>
        <button onClick={() => navigate(-1)} style={{background:'#f5f6fa',color:'#1976d2',border:'1.5px solid #e3eafc',borderRadius:8,padding:'12px 24px',fontWeight:600,cursor:'pointer'}}>Back</button>
      </div>
    </div>
  );
}
