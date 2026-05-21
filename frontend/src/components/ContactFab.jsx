import React, { useEffect, useRef, useState } from "react";
import { FaHeadset, FaWhatsapp, FaTimes, FaRegCopy } from "react-icons/fa";
import { SiGmail } from "react-icons/si";

/**
 * Floating Contact / Help button.
 * Mounted from App.jsx; visible bottom-right on every page when logged in.
 *
 * EDIT THESE TWO CONSTANTS TO POINT THE BUTTON ELSEWHERE:
 */
const WHATSAPP_NUMBER = "96566244364";          // international format, NO + or spaces
const SUPPORT_EMAIL   = "yassinissa479@gmail.com";

const WHATSAPP_DEFAULT_MESSAGE = "Hi, I need help with the training system.";
const EMAIL_DEFAULT_SUBJECT    = "Training System - Help request";

export default function ContactFab() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const waUrl = `https://wa.me/${encodeURIComponent(WHATSAPP_NUMBER)}?text=${encodeURIComponent(WHATSAPP_DEFAULT_MESSAGE)}`;
  // Gmail web compose - reliably opens in a new tab regardless of OS mail handler.
  const gmailUrl =
    `https://mail.google.com/mail/?view=cm&fs=1` +
    `&to=${encodeURIComponent(SUPPORT_EMAIL)}` +
    `&su=${encodeURIComponent(EMAIL_DEFAULT_SUBJECT)}`;

  const copyEmail = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      alert(`Email copied: ${SUPPORT_EMAIL}`);
    } catch {
      window.prompt("Copy this email:", SUPPORT_EMAIL);
    }
  };

  const primaryRow = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 10,
    textDecoration: "none",
    fontWeight: 600,
    fontSize: 14,
    border: "1px solid",
  };

  const secondaryBtn = {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "8px 6px",
    borderRadius: 8,
    background: "#f4f6fb",
    color: "#1a2236",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 600,
    border: "1px solid #d4dbe7",
    cursor: "pointer",
  };

  return (
    <div ref={panelRef} style={{
      position: "fixed", right: 22, bottom: 22, zIndex: 900,
      display: "flex", flexDirection: "column", alignItems: "flex-end",
      gap: 10, pointerEvents: "none",
    }}>
      {open && (
        <div style={{
          pointerEvents: "auto",
          background: "#fff", color: "#1a2236",
          borderRadius: 14, boxShadow: "0 12px 28px rgba(0,0,0,0.25)",
          padding: 14, width: 270, animation: "fab-pop 160ms ease",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Need help?</div>
            <button
              onClick={() => setOpen(false)}
              style={{ background: "transparent", border: "none", cursor: "pointer", color: "#888", fontSize: 16, padding: 4 }}
              title="Close"
              aria-label="Close contact panel"
            ><FaTimes /></button>
          </div>

          <div style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
            Pick a channel to reach support.
          </div>

          <a
            href={waUrl}
            target="_blank"
            rel="noreferrer"
            style={{ ...primaryRow, background: "#e8f7ed", color: "#1b5e20", borderColor: "#b9ead0", marginBottom: 8 }}
          >
            <FaWhatsapp style={{ fontSize: 18, color: "#25d366" }} /> WhatsApp
          </a>

          <a
            href={gmailUrl}
            target="_blank"
            rel="noreferrer"
            style={{ ...primaryRow, background: "#fde8e8", color: "#b1100d", borderColor: "#f5b7b6", marginBottom: 8 }}
          >
            <SiGmail style={{ fontSize: 18, color: "#ea4335" }} /> Gmail
          </a>

          <button onClick={copyEmail} style={secondaryBtn} title="Copy the email address to clipboard">
            <FaRegCopy style={{ fontSize: 14 }} /> Copy address
          </button>

          <div style={{ marginTop: 10, fontSize: 11, color: "#888", textAlign: "right" }}>
            {SUPPORT_EMAIL}
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        title={open ? "Close contact panel" : "Contact support"}
        aria-label="Contact support"
        style={{
          pointerEvents: "auto",
          width: 54, height: 54, borderRadius: "50%",
          background: open
            ? "linear-gradient(135deg, #c62828, #e53935)"
            : "linear-gradient(135deg, #1976d2, #1565c0)",
          color: "#fff", border: "none",
          boxShadow: "0 10px 22px rgba(0,0,0,0.30)",
          cursor: "pointer", fontSize: 22,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "transform 140ms ease, background 200ms ease",
        }}
      >
        {open ? <FaTimes /> : <FaHeadset />}
      </button>

      <style>{`
        @keyframes fab-pop {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
