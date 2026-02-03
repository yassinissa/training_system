import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/client";
import { FaFilePdf, FaImage, FaExternalLinkAlt, FaTag } from "react-icons/fa";

const resourceStyle = {
  display: "flex",
  gap: "16px",
  flexWrap: "wrap",
  alignItems: "center",
  marginTop: "12px"
};

const heroStyle = {
  background: "linear-gradient(90deg, #0072ff 0%, #00c6ff 100%)",
  color: "#fff",
  borderRadius: "18px",
  padding: "32px 24px 24px 24px",
  marginBottom: "32px",
  boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
  position: "relative",
  overflow: "hidden",
  animation: "fadeInHero 0.7s ease"
};

const galleryStyle = {
  display: "flex",
  gap: "24px",
  flexWrap: "wrap",
  marginTop: "18px"
};

const tagStyle = {
  display: "inline-flex",
  alignItems: "center",
  background: "#e3f2fd",
  color: "#1976d2",
  borderRadius: "16px",
  padding: "4px 12px",
  marginRight: "8px",
  fontSize: "0.95rem",
  fontWeight: 500
};

const CompetencyPage = () => {
  const { id } = useParams();
  const [competency, setCompetency] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const navigate = useNavigate();

  React.useEffect(() => {
    setLoading(true);
    setError("");
    api.get(`/training/competencies/${id}/`)
      .then((res) => setCompetency(res.data))
      .catch(() => setError("Failed to load competency."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="container py-5"><div className="card">Loading…</div></div>;
  if (error) return <div className="container py-5"><div className="alert alert-danger">{error}</div></div>;
  if (!competency) return <div className="container py-5"><div className="card">Competency not found.</div></div>;

  // Example tags (replace with real tags if available)
  const tags = competency.tags || ["Core", "Level 2", "Required"];

  return (
    <div className="container py-5">
      <div className="mb-4">
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>&larr; Back</button>
      </div>
      <div style={heroStyle}>
        <h2 className="fw-bold mb-2" style={{fontSize: "2.5rem", letterSpacing: "-1px"}}>{competency.title}</h2>
        <div className="mb-3">
          {tags.map((tag, idx) => (
            <span key={idx} style={tagStyle}><FaTag style={{marginRight: 6}} /> {tag}</span>
          ))}
        </div>
        <p
          className="mb-2"
          style={{
            fontSize: "1.15rem",
            maxWidth: 700,
            wordBreak: "break-word",
            overflowWrap: "anywhere",
            whiteSpace: "pre-line"
          }}
        >
          {competency.description || <span className="text-light">No description</span>}
        </p>
        {competency.image && (
          <div className="mt-4 text-center">
            <img src={competency.image} alt="Competency" style={{maxWidth: "100%", maxHeight: 320, borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.12)"}} />
          </div>
        )}
        <div style={{position: "absolute", right: -40, bottom: -40, opacity: 0.12, fontSize: 180, pointerEvents: "none"}}>
          <FaTag />
        </div>
      </div>
      <div className="card shadow-lg p-4 mb-4">
        <strong className="mb-2 d-block fs-5">Resource Gallery</strong>
        <div style={galleryStyle}>
          {competency.pdf_file && (
            <a href={competency.pdf_file} target="_blank" rel="noreferrer" className="btn btn-outline-danger d-flex align-items-center gap-2">
              <FaFilePdf style={{fontSize: 28}} /> PDF Document
            </a>
          )}
          {competency.image && (
            <a href={competency.image} target="_blank" rel="noreferrer" className="btn btn-outline-info d-flex align-items-center gap-2">
              <FaImage style={{fontSize: 28}} /> Image Preview
            </a>
          )}
          {competency.external_link && (
            <a href={competency.external_link} target="_blank" rel="noreferrer" className="btn btn-outline-primary d-flex align-items-center gap-2">
              <FaExternalLinkAlt style={{fontSize: 28}} /> External Link
            </a>
          )}
          {!(competency.pdf_file || competency.image || competency.external_link) && (
            <span className="text-muted">No resources available</span>
          )}
        </div>
      </div>
      {/* Subtle fade-in animation for hero */}
      <style>{`
        @keyframes fadeInHero {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
};

export default CompetencyPage;
