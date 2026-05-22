import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/client";
import {
  FaFilePdf,
  FaImage,
  FaExternalLinkAlt,
  FaTag,
  FaArrowLeft,
  FaClock,
  FaStar,
  FaSyncAlt,
  FaCheckCircle,
} from "react-icons/fa";

/**
 * Lesson-style competency view.
 *
 * Goals:
 *  - Big, readable hero with all metadata at a glance.
 *  - Comfortable typography for long prose (`description` + `content`).
 *  - Hero image and inline image with click-to-enlarge.
 *  - PDF embedded inline (iframe) with download fallback.
 *  - External link rendered as a clear card.
 *  - "Take Exam" CTA when the competency has an active exam.
 *  - Mobile-friendly: hero shrinks, sections stack, buttons stretch.
 */
const FREQ_LABEL = {
  ONE_TIME: "One-time",
  YEARLY: "Yearly",
  NEW_HIRE: "New hire",
  PROMOTION: "Promotion",
  OTHER: "Other",
};

export default function CompetencyPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [competency, setCompetency] = useState(null);
  const [exam, setExam] = useState(null);          // active exam linked to this competency
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [imgZoom, setImgZoom] = useState(false);   // simple lightbox toggle

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");

    Promise.all([
      api.get(`/training/competencies/${id}/`),
      api.get(`/training/exams/list/?competency=${id}`).catch(() => ({ data: [] })),
    ])
      .then(([cRes, eRes]) => {
        if (!live) return;
        setCompetency(cRes.data);
        const exams = Array.isArray(eRes.data) ? eRes.data : eRes.data?.results || [];
        const active = exams.find((x) => x.is_active);
        setExam(active || null);
      })
      .catch(() => live && setError("Failed to load competency."))
      .finally(() => live && setLoading(false));

    return () => { live = false; };
  }, [id]);

  if (loading)
    return (
      <div className="container" style={{ padding: 24 }}>
        <div className="card">Loading lesson…</div>
      </div>
    );
  if (error)
    return (
      <div className="container" style={{ padding: 24 }}>
        <div className="card" style={{ color: "#c62828" }}>{error}</div>
      </div>
    );
  if (!competency) return null;

  const tags = [
    competency.competency_area && { icon: <FaTag />, label: competency.competency_area },
    competency.brand && { icon: <FaTag />, label: competency.brand },
    competency.duration && { icon: <FaClock />, label: competency.duration },
    competency.frequency && {
      icon: <FaSyncAlt />,
      label: FREQ_LABEL[competency.frequency] || competency.frequency,
    },
    competency.priority_points != null && {
      icon: <FaStar />,
      label: `${competency.priority_points} pts`,
    },
    competency.requires_exam && {
      icon: <FaCheckCircle />,
      label: "Requires exam",
    },
  ].filter(Boolean);

  const paragraphs = (text) =>
    String(text || "")
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);

  return (
    <div className="lesson-wrap">
      {/* ---- Back ---- */}
      <button className="btn" onClick={() => navigate(-1)} style={{ marginBottom: 14 }}>
        <FaArrowLeft style={{ marginRight: 6 }} /> Back
      </button>

      {/* ---- HERO ---- */}
      <header className="lesson-hero">
        <div className="lesson-hero-content">
          {competency.reference_number && (
            <div className="lesson-ref">{competency.reference_number}</div>
          )}
          <h1 className="lesson-title">{competency.title}</h1>
          {paragraphs(competency.description).length > 0 && (
            <p className="lesson-subtitle">{competency.description}</p>
          )}
          {tags.length > 0 && (
            <div className="lesson-tags">
              {tags.map((t, i) => (
                <span key={i} className="lesson-tag">
                  {t.icon}
                  <span>{t.label}</span>
                </span>
              ))}
            </div>
          )}
          {competency.requires_exam && exam && (
            <button
              className="lesson-cta"
              onClick={() => navigate(`/assessment/${exam.id}`)}
              title="Start the exam linked to this competency"
            >
              Take the Exam →
            </button>
          )}
        </div>

        {competency.image && (
          <div className="lesson-hero-image" onClick={() => setImgZoom(true)}>
            <img src={competency.image} alt={competency.title} />
          </div>
        )}
      </header>

      {/* ---- BODY: long-form content ---- */}
      {paragraphs(competency.content).length > 0 && (
        <article className="lesson-body">
          {paragraphs(competency.content).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </article>
      )}

      {/* ---- INLINE IMAGE (also shown larger when in the article) ---- */}
      {competency.image && (
        <figure className="lesson-figure" onClick={() => setImgZoom(true)}>
          <img src={competency.image} alt={competency.title} />
          <figcaption>Tap the image to enlarge.</figcaption>
        </figure>
      )}

      {/* ---- EMBEDDED PDF ---- */}
      {competency.pdf_file && (
        <section className="lesson-pdf">
          <header className="lesson-section-header">
            <FaFilePdf style={{ color: "#c62828" }} />
            <h3>Course Document</h3>
            <a
              href={competency.pdf_file}
              target="_blank"
              rel="noreferrer"
              className="btn"
              style={{ marginLeft: "auto" }}
            >
              Open / Download
            </a>
          </header>
          <iframe
            src={competency.pdf_file}
            title="Competency PDF"
            className="lesson-pdf-iframe"
          />
        </section>
      )}

      {/* ---- EXTERNAL LINK ---- */}
      {competency.external_link && (
        <section className="lesson-external">
          <header className="lesson-section-header">
            <FaExternalLinkAlt style={{ color: "#1976d2" }} />
            <h3>External Resource</h3>
          </header>
          <a
            href={competency.external_link}
            target="_blank"
            rel="noreferrer"
            className="lesson-external-link"
          >
            <span>{competency.external_link}</span>
            <FaExternalLinkAlt />
          </a>
        </section>
      )}

      {/* ---- BOTTOM CTA ---- */}
      {competency.requires_exam && exam && (
        <div className="lesson-bottom-cta">
          <button className="lesson-cta" onClick={() => navigate(`/assessment/${exam.id}`)}>
            Take the Exam →
          </button>
          <div style={{ color: "#9bb0e0", fontSize: 13, marginTop: 8 }}>
            Make sure you've read the material above before starting.
          </div>
        </div>
      )}

      {/* ---- LIGHTBOX ---- */}
      {imgZoom && competency.image && (
        <div className="lesson-lightbox" onClick={() => setImgZoom(false)}>
          <img src={competency.image} alt={competency.title} />
          <div className="lesson-lightbox-hint">Tap anywhere to close</div>
        </div>
      )}

      {/* ---- Page-scoped styles ---- */}
      <style>{`
        .lesson-wrap {
          max-width: 900px;
          margin: 24px auto;
          padding: 0 16px 64px;
          color: var(--text);
        }

        /* Hero */
        .lesson-hero {
          display: grid;
          grid-template-columns: 1.4fr 1fr;
          gap: 24px;
          align-items: center;
          background: linear-gradient(135deg, #1f2a52 0%, #2b3d7a 50%, #5b8cff 100%);
          border-radius: 22px;
          padding: 30px;
          margin-bottom: 28px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.18);
        }
        .lesson-hero-content { min-width: 0; }
        .lesson-ref {
          display: inline-block;
          background: rgba(255,255,255,0.13);
          color: #d0deff;
          padding: 4px 10px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.06em;
          border-radius: 999px;
          margin-bottom: 10px;
          text-transform: uppercase;
        }
        .lesson-title {
          margin: 0;
          font-size: 2rem;
          line-height: 1.15;
          color: #fff;
          letter-spacing: -0.5px;
          word-break: break-word;
        }
        .lesson-subtitle {
          margin: 12px 0 16px;
          font-size: 1.05rem;
          color: #d6e0ff;
          line-height: 1.5;
        }
        .lesson-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 18px;
        }
        .lesson-tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: rgba(255,255,255,0.12);
          border-radius: 999px;
          font-size: 13px;
          color: #eef3ff;
          backdrop-filter: blur(6px);
        }
        .lesson-cta {
          background: #fff;
          color: #1f2a52;
          border: none;
          padding: 12px 22px;
          border-radius: 12px;
          font-weight: 800;
          font-size: 15px;
          cursor: pointer;
          box-shadow: 0 4px 18px rgba(0,0,0,0.18);
          transition: transform 120ms ease, filter 120ms ease;
        }
        .lesson-cta:hover { transform: translateY(-1px); filter: brightness(0.97); }

        .lesson-hero-image {
          border-radius: 16px;
          overflow: hidden;
          aspect-ratio: 16/11;
          background: rgba(255,255,255,0.05);
          box-shadow: 0 10px 28px rgba(0,0,0,0.22);
          cursor: zoom-in;
        }
        .lesson-hero-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        /* Body */
        .lesson-body {
          background: var(--panel);
          border: 1px solid var(--card-border);
          border-radius: 16px;
          padding: 28px 30px;
          margin-bottom: 22px;
          font-size: 16.5px;
          line-height: 1.75;
        }
        .lesson-body p {
          margin: 0 0 14px;
          color: var(--text);
        }
        .lesson-body p:last-child { margin-bottom: 0; }

        /* Inline figure */
        .lesson-figure {
          margin: 22px 0;
          padding: 0;
          cursor: zoom-in;
        }
        .lesson-figure img {
          width: 100%;
          border-radius: 14px;
          display: block;
          box-shadow: 0 6px 20px rgba(0,0,0,0.18);
        }
        .lesson-figure figcaption {
          margin-top: 6px;
          font-size: 13px;
          color: var(--muted);
          text-align: center;
        }

        /* Section header */
        .lesson-section-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 14px;
        }
        .lesson-section-header h3 {
          margin: 0;
          font-size: 18px;
          color: var(--text);
        }

        /* PDF */
        .lesson-pdf {
          background: var(--panel);
          border: 1px solid var(--card-border);
          border-radius: 16px;
          padding: 22px;
          margin-bottom: 22px;
        }
        .lesson-pdf-iframe {
          width: 100%;
          height: 720px;
          border: 1px solid var(--card-border);
          border-radius: 12px;
          background: #fff;
        }

        /* External link */
        .lesson-external {
          background: var(--panel);
          border: 1px solid var(--card-border);
          border-radius: 16px;
          padding: 22px;
          margin-bottom: 22px;
        }
        .lesson-external-link {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 14px 18px;
          border-radius: 12px;
          background: rgba(91,140,255,0.10);
          border: 1px solid rgba(91,140,255,0.35);
          color: var(--accent);
          text-decoration: none;
          word-break: break-all;
        }
        .lesson-external-link:hover { background: rgba(91,140,255,0.18); }

        /* Bottom CTA block */
        .lesson-bottom-cta {
          text-align: center;
          margin-top: 32px;
          padding: 22px;
          background: linear-gradient(135deg, rgba(91,140,255,0.10), rgba(87,179,255,0.10));
          border-radius: 16px;
          border: 1px solid var(--card-border);
        }
        .lesson-bottom-cta .lesson-cta {
          background: linear-gradient(135deg, var(--primary-400), var(--primary-500));
          color: #081025;
        }

        /* Lightbox */
        .lesson-lightbox {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          z-index: 1000;
          cursor: zoom-out;
          padding: 24px;
        }
        .lesson-lightbox img {
          max-width: 96vw;
          max-height: 85vh;
          border-radius: 10px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        }
        .lesson-lightbox-hint {
          margin-top: 14px;
          color: rgba(255,255,255,0.7);
          font-size: 13px;
        }

        /* Mobile */
        @media (max-width: 820px) {
          .lesson-hero {
            grid-template-columns: 1fr;
            padding: 22px;
          }
          .lesson-hero-image { aspect-ratio: 16/9; }
          .lesson-title { font-size: 1.6rem; }
          .lesson-subtitle { font-size: 1rem; }
          .lesson-body { padding: 20px; font-size: 16px; line-height: 1.7; }
          .lesson-pdf-iframe { height: 520px; }
        }
        @media (max-width: 480px) {
          .lesson-wrap { padding: 0 10px 48px; }
          .lesson-hero { padding: 18px; border-radius: 16px; }
          .lesson-title { font-size: 1.35rem; }
          .lesson-subtitle { font-size: 0.95rem; }
          .lesson-cta { width: 100%; padding: 14px 18px; }
          .lesson-body { padding: 16px; font-size: 15.5px; }
          .lesson-pdf, .lesson-external { padding: 16px; }
          .lesson-pdf-iframe { height: 420px; }
        }
      `}</style>
    </div>
  );
}
