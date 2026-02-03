import React from "react";
import { FaHome, FaBook, FaHistory, FaUser, FaClipboardList, FaSignOutAlt } from "react-icons/fa";
import { useLocation, useNavigate } from "react-router-dom";

export const defaultMenu = [
  { label: "Dashboard", icon: <FaHome />, path: "/dashboard" },
  { label: "Exams", icon: <FaClipboardList />, path: "/exams" },
  { label: "Competencies", icon: <FaBook />, path: "/competencies" },
  { label: "Sessions History", icon: <FaHistory />, path: "/sessions-history" },
  { label: "Profile", icon: <FaUser />, path: "/profile" },
  { label: "Logout", icon: <FaSignOutAlt />, path: "/logout", danger: true },
];

export default function Sidebar({ menu = defaultMenu, username = "User" }) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <aside
      style={{
        width: 220,
        minHeight: "100vh",
        background: "#fff",
        borderRight: "1.5px solid #e3eafc",
        boxShadow: "2px 0 16px 0 rgba(30,60,90,0.04)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "32px 0 0 0",
        position: "fixed",
        left: 0,
        top: 0,
        zIndex: 10,
      }}
    >
      <div style={{ marginBottom: 36, textAlign: "center" }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #eaf6ff 0%, #6bb6ff 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 36,
            color: "#1976d2",
            margin: "0 auto 10px auto",
          }}
        >
          <FaUser />
        </div>
        <div style={{ fontWeight: 700, fontSize: 18, color: "#222", wordBreak: "break-word" }}>{username}</div>
      </div>
      <nav style={{ width: "100%" }}>
        {menu.map((item) => {
          const active = location.pathname === item.path;
          return (
            <div
              key={item.label}
              onClick={() => navigate(item.path)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "12px 32px",
                margin: "8px 0",
                borderRadius: 12,
                cursor: "pointer",
                background: active ? "linear-gradient(90deg, #eaf6ff 0%, #6bb6ff 100%)" : "none",
                color: item.danger ? "#c62828" : active ? "#1976d2" : "#444",
                fontWeight: active ? 700 : 500,
                fontSize: 16,
                transition: "background 0.2s, color 0.2s",
              }}
            >
              <span style={{ fontSize: 22 }}>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
