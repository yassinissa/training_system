import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";

const EmployeeExamDashboard = () => {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    setError("");
    api.get("/training/exams/list/")
      .then((res) => {
        setExams(res.data || []);
      })
      .catch((err) => {
        setError("Failed to load exams.");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container py-5">
      <h1 className="mb-4 text-center text-primary fw-bold">Employee Exam Dashboard</h1>
      {loading && <div className="card">Loading exams…</div>}
      {error && <div className="alert alert-danger">{error}</div>}
      {!loading && !error && exams.length === 0 && (
        <div className="card">No exams assigned to you.</div>
      )}
      {!loading && !error && exams.length > 0 && (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Description</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {exams.map((exam) => (
                <tr key={exam.id}>
                  <td>{exam.title}</td>
                  <td>{exam.description}</td>
                  <td>
                    <button
                      className="btn btn-primary"
                      onClick={() => navigate(`/web/exams/exam/${exam.id}`)}
                    >
                      Take Exam
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default EmployeeExamDashboard;
