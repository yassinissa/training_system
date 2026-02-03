import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/client";
// DEBUG: Print current access token
console.log("[ExamPage] access token:", localStorage.getItem('access') || sessionStorage.getItem('access'));


const ExamPage = () => {
	const { id: examId } = useParams();
	const navigate = useNavigate();
	const [exam, setExam] = useState(null);
	const [answers, setAnswers] = useState({});
	const [sessionId, setSessionId] = useState(null);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState(null);
	const timeoutRef = useRef(null);

	// Force redirect to login if no access token
	useEffect(() => {
		const access = localStorage.getItem('access') || sessionStorage.getItem('access');
		if (!access) {
			window.location.href = '/login';
			return;
		}
		api.post(`/training/exam/start/`, { exam_id: examId })
			.then(res => {
				console.log('[ExamPage] Start session API response:', res);
				setSessionId(res.data.session_id || res.data.id);
				// Use res.data.exam for the exam object
				setExam(res.data.exam);
			})
			.catch(err => {
				console.log("[ExamPage] Error starting exam session:", err);
				let msg = "Failed to start exam session.";
				if (err.response && err.response.data) {
					msg += "\n[Backend error data]:\n" + JSON.stringify(err.response.data, null, 2);
				} else if (err.request) {
					msg += "\nNetwork error: No response received from backend. Check if backend is running and accessible at /api/training/exam/start/.";
				} else if (err.message) {
					msg += `\n${err.message}`;
				}
				setError(msg);
			});
		timeoutRef.current = setTimeout(() => {
			if (!sessionId && !error) {
				setError("No response from backend. Please check your login status and backend logs.");
			}
		}, 5000);
		return () => clearTimeout(timeoutRef.current);
	}, [examId]);

	const handleChange = (questionId, value) => {
		setAnswers((prev) => ({ ...prev, [questionId]: value }));
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setSubmitting(true);
		setError(null);
		try {
			const payload = {
				session_id: sessionId,
				answers: exam.questions.map((q) => {
					if (q.type === "MCQ_MULTI") {
						return {
							question: q.id,
							selected_choices: Array.isArray(answers[q.id]) ? answers[q.id] : [],
							text_answer: ""
						};
					} else if (q.type === "MCQ_SINGLE" || q.type === "TRUE_FALSE") {
						return {
							question: q.id,
							selected_choices: answers[q.id] ? [answers[q.id]] : [],
							text_answer: ""
						};
					} else {
						return {
							question: q.id,
							selected_choices: [],
							text_answer: answers[q.id] || ""
						};
					}
				})
			};
			await api.post(`/training/exam/submit/`, payload);
			navigate("/dashboard");
		} catch (err) {
			setError("Failed to submit exam. Please try again.");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="container py-5 d-flex flex-column align-items-center justify-content-center" style={{ minHeight: "80vh" }}>
			<div className="bg-dark rounded shadow p-4 w-100" style={{ maxWidth: 650 }}>
				<h1 className="mb-3 text-center text-primary fw-bold" style={{ letterSpacing: 1 }}>Exam Dashboard</h1>
				<div className="mb-2 text-center text-light fs-5">Please answer all questions below and submit your exam.</div>
				{!sessionId && !error ? (
					<div className="text-center text-warning my-5">
						<div className="spinner-border text-warning mb-3" role="status">
							<span className="visually-hidden">Loading...</span>
						</div>
						<div>Preparing your exam session. Please wait...</div>
					</div>
				) : error ? (
					<div className="alert alert-danger text-center my-5" style={{whiteSpace:'pre-wrap'}}>{error}</div>
				) : exam && (
					<>
						<h2 className="mb-2 text-center">{exam.title}</h2>
						<div className="mb-4 text-muted text-center">{exam.description}</div>
						<form onSubmit={handleSubmit}>
							{exam.questions.map((q, idx) => (
								<div key={q.id} className="mb-4 pb-3 border-bottom">
									<div className="mb-2 fw-bold fs-5">
										Q{idx + 1}. {q.text}
									</div>
									{(q.type === "MCQ_SINGLE" || q.type === "MCQ_MULTI" || q.type === "TRUE_FALSE") ? (
										<div className="ms-3">
											{(q.choices && q.choices.length > 0) ? q.choices.map((choice) => (
												<div className="form-check mb-1" key={choice.id}>
													<input
														className="form-check-input"
														type={q.type === "MCQ_MULTI" ? "checkbox" : "radio"}
														name={`q_${q.id}${q.type === "MCQ_MULTI" ? `[]` : ''}`}
														id={`q_${q.id}_c_${choice.id}`}
														value={choice.id}
														checked={q.type === "MCQ_MULTI" ? (Array.isArray(answers[q.id]) && answers[q.id].includes(choice.id)) : answers[q.id] === choice.id}
														onChange={q.type === "MCQ_MULTI"
															? (e) => {
																const prev = Array.isArray(answers[q.id]) ? answers[q.id] : [];
																if (e.target.checked) {
																	handleChange(q.id, [...prev, choice.id]);
																} else {
																	handleChange(q.id, prev.filter((id) => id !== choice.id));
																}
															}
															: () => handleChange(q.id, choice.id)
														}
													/>
													<label className="form-check-label" htmlFor={`q_${q.id}_c_${choice.id}`}>
														{choice.text}
													</label>
												</div>
											)) : (
												<div className="text-danger">No choices available.</div>
											)}
										</div>
									) : (q.type === "SHORT_TEXT" || q.type === "LONG_TEXT") ? (
										<div className="ms-3">
											<textarea
												className="form-control"
												rows={q.type === "LONG_TEXT" ? 4 : 2}
												value={answers[q.id] || ""}
												onChange={(e) => handleChange(q.id, e.target.value)}
												placeholder="Your answer"
											/>
										</div>
									) : (
										<div className="ms-3">
											<textarea
												className="form-control"
												rows={2}
												value={answers[q.id] || ""}
												onChange={(e) => handleChange(q.id, e.target.value)}
												placeholder="Your answer"
											/>
										</div>
									)}
								</div>
							))}
							<div className="d-flex justify-content-center mt-4">
								<button type="submit" className="btn btn-primary px-4" disabled={submitting || !sessionId}>
									{submitting ? "Submitting..." : "Submit Exam"}
								</button>
							</div>
						</form>
					</>
				)}
			</div>
		</div>
	);
};

export default ExamPage;
