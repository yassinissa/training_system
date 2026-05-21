import React, { useState } from "react";
import { FaPencilAlt, FaTrash } from "react-icons/fa";
import { FaUserCircle, FaBookOpen, FaClipboardList, FaCertificate, FaHistory } from "react-icons/fa";
import api from "../api/client";
import CompetenciesSection from "./EmployeeDashboardCompetencies.jsx";
import { useNavigate } from "react-router-dom";
import EmployeeDashboardExams from "./EmployeeDashboardExams.jsx";

const ExamsSection = EmployeeDashboardExams;
const ResultsSection = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  React.useEffect(() => {
    setLoading(true);
    setError("");
    api.get("/training/exam/sessions/")
      .then((res) => {
        setSessions(res.data || []);
      })
      .catch(() => setError("Failed to load sessions."))
      .finally(() => setLoading(false));
  }, []);

  // Helper to determine result
  const getResult = (session) => {
    if (session.status !== 'GRADED') return '';
    if (session.score == null || session.max_score == null) return '-';
    // Consider pass if score >= 60% of max_score
    const percent = (session.score / session.max_score) * 100;
    return percent >= 60 ? 'Passed' : 'Failed';
  };

  return (
    <div className="card p-4">
      <h3 className="mb-3">Progress & History</h3>
      {loading && <div>Loading sessions…</div>}
      {error && <div style={{color: '#c62828'}}>{error}</div>}
      {!loading && !error && (
        <div style={{overflowX: 'auto'}}>
          <table className="table table-bordered table-hover" style={{width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontFamily: 'Segoe UI, Arial, sans-serif', fontSize: '1rem', background: '#18223a', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,32,64,0.12)'}}>
            <thead>
              <tr style={{background: '#22305a', color: '#fff', fontWeight: 700, letterSpacing: '0.02em'}}>
                <th style={{padding: '14px', minWidth: 120, textAlign: 'left', border: 'none'}}>Session Name</th>
                <th style={{padding: '14px', minWidth: 110, textAlign: 'center', border: 'none'}}>Status</th>
                <th style={{padding: '14px', minWidth: 90, textAlign: 'center', border: 'none'}}>Result</th>
                <th style={{padding: '14px', minWidth: 80, textAlign: 'center', border: 'none'}}>Score</th>
                <th style={{padding: '14px', minWidth: 100, textAlign: 'center', border: 'none'}}>Max Score</th>
                <th style={{padding: '14px', minWidth: 160, textAlign: 'left', border: 'none'}}>Competency</th>
                <th style={{padding: '14px', minWidth: 160, textAlign: 'center', border: 'none'}}>Started At</th>
                <th style={{padding: '14px', minWidth: 160, textAlign: 'center', border: 'none'}}>Submitted At</th>
                <th style={{padding: '14px', minWidth: 100, textAlign: 'center', border: 'none'}}>Review</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr><td colSpan={9} style={{textAlign: 'center', padding: '18px', color: '#fff', background: '#22305a'}}>No sessions found.</td></tr>
              ) : (
                sessions.map((s, idx) => (
                  <tr key={s.id} style={{background: idx % 2 === 0 ? '#22305a' : '#18223a', color: '#fff', transition: 'background 0.2s'}}>
                    <td style={{padding: '13px', textAlign: 'left', border: 'none', borderRadius: '8px', wordBreak: 'break-word', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160}}>{s.exam?.title || '-'}</td>
                    <td style={{padding: '13px', textAlign: 'center', border: 'none', borderRadius: '8px', wordBreak: 'break-word', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110}}>{s.status}</td>
                    <td style={{padding: '13px', textAlign: 'center', border: 'none', borderRadius: '8px', wordBreak: 'break-word', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 90}}>{getResult(s)}</td>
                    <td style={{padding: '13px', textAlign: 'center', border: 'none', borderRadius: '8px', wordBreak: 'break-word', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 80}}>{s.status === 'GRADED' && s.score != null ? s.score : '-'}</td>
                    <td style={{padding: '13px', textAlign: 'center', border: 'none', borderRadius: '8px', wordBreak: 'break-word', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100}}>{s.status === 'GRADED' && s.max_score != null ? s.max_score : '-'}</td>
                    <td style={{padding: '13px', textAlign: 'left', border: 'none', borderRadius: '8px', wordBreak: 'break-word', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160}}>{typeof s.exam?.competency === 'object' ? s.exam.competency.title : '-'}</td>
                    <td style={{padding: '13px', textAlign: 'center', border: 'none', borderRadius: '8px', wordBreak: 'break-word', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160}}>{s.started_at ? new Date(s.started_at).toLocaleString() : '-'}</td>
                    <td style={{padding: '13px', textAlign: 'center', border: 'none', borderRadius: '8px', wordBreak: 'break-word', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160}}>{s.submitted_at ? new Date(s.submitted_at).toLocaleString() : '-'}</td>
                    <td style={{padding: '13px', textAlign: 'center', border: 'none'}}>
                      {s.status === 'GRADED' ? (
                        <div style={{display:'flex',flexDirection:'column',gap:6,alignItems:'center'}}>
                          <button
                            onClick={() => navigate(`/exam/review/${s.id}`)}
                            style={{background:'#1976d2',color:'#fff',border:'none',borderRadius:6,padding:'6px 14px',fontWeight:600,cursor:'pointer'}}
                          >Review</button>
                          {getResult(s) === 'Failed' && s.retake_allowed && (
                            <button
                              onClick={() => navigate(`/assessment/${s.exam?.id}`)}
                              style={{background:'#16a34a',color:'#fff',border:'none',borderRadius:6,padding:'6px 14px',fontWeight:600,cursor:'pointer'}}
                            >Retake</button>
                          )}
                        </div>
                      ) : (
                        <span style={{color:'#888'}}>-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
const ProfileSection = () => {

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [editPic, setEditPic] = useState(false);

  React.useEffect(() => {
    setLoading(true);
    setError("");
    api.get("/accounts/me/")
      .then((res) => {
        setUser(res.data);
      })
      .catch(() => setError("Failed to load user info."))
      .finally(() => setLoading(false));
  }, []);


  const handlePictureChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    const formData = new FormData();
    formData.append("profile_picture", file);
    api.post("/accounts/me/profile-picture/", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    })
      .then((res) => {
        setUser((prev) => ({ ...prev, profile_picture: res.data.profile_picture }));
        setEditPic(false);
      })
      .catch(() => setUploadError("Failed to upload profile picture."))
      .finally(() => setUploading(false));
  };

  const handleRemovePicture = () => {
    setUploading(true);
    setUploadError("");
    api.post("/accounts/me/profile-picture/remove/")
      .then(() => {
        setUser((prev) => ({ ...prev, profile_picture: null }));
        setEditPic(false);
      })
      .catch(() => setUploadError("Failed to remove profile picture."))
      .finally(() => setUploading(false));
  };

  if (loading) return <div className="card p-4">Loading profile…</div>;
  if (error) return <div className="card p-4" style={{color: '#c62828'}}>{error}</div>;
  if (!user) return <div className="card p-4">No user info found.</div>;

  return (
    <div className="card p-4" style={{maxWidth: 480, margin: '0 auto', background: '#22305a', color: '#fff', borderRadius: 16, boxShadow: '0 2px 16px rgba(0,32,64,0.12)'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 24, marginBottom: 24, position: 'relative'}}>
        <div style={{position: 'relative', width: 80, height: 80}}>
          <img src={user.profile_picture || 'https://ui-avatars.com/api/?name=' + user.username} alt="Profile" style={{width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid #1976d2'}} />
          <button
            style={{position: 'absolute', right: 0, bottom: 0, background: '#1976d2', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.12)'}}
            onClick={() => setEditPic((v) => !v)}
            title="Edit profile picture"
          >
            <FaPencilAlt color="#fff" size={16} />
          </button>
        </div>
        <div>
          <div style={{fontSize: '1.5rem', fontWeight: 700}}>{user.username}</div>
          <div style={{fontSize: '1.1rem', color: '#e3eafc'}}>{user.position?.name || '-'}</div>
        </div>
      </div>
      {editPic && (
        <div style={{margin: '18px 0', background: '#18223a', padding: 16, borderRadius: 12}}>
          <label htmlFor="profilePicUpload" style={{fontWeight: 500, color: '#e3eafc'}}>Upload Profile Picture:</label><br />
          <input id="profilePicUpload" type="file" accept="image/*" onChange={handlePictureChange} disabled={uploading} style={{marginTop: 8}} />
          {user.profile_picture && (
            <button
              onClick={handleRemovePicture}
              style={{marginLeft: 16, background: '#ff5252', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontWeight: 500}}
              disabled={uploading}
            >
              <FaTrash style={{marginRight: 6}} /> Remove
            </button>
          )}
          {uploading && <span style={{marginLeft: 12, color: '#e3eafc'}}>Uploading…</span>}
          {uploadError && <div style={{color: '#ff5252', marginTop: 8}}>{uploadError}</div>}
        </div>
      )}
      <div style={{marginBottom: 10}}><b>Employee Number:</b> {user.employee_number || '-'}</div>
      <div style={{marginBottom: 10}}>
        <b>Branch:</b> {user.employee_branch && user.employee_branch.name ? `${user.employee_branch.name}${user.employee_branch.location ? ' (' + user.employee_branch.location + ')' : ''}` : '-'}
      </div>
      <div style={{marginBottom: 10}}><b>Role:</b> {user.role || '-'}</div>

      {/* ---- Competency level & points panel ---- */}
      <CompetencyLevelPanel user={user} />
    </div>
  );
};

// Compact panel showing current CL, total points, required CL (from position),
// and a progress bar towards the next level threshold.
function CompetencyLevelPanel({ user }) {
  const total = Number(user.total_competency_points || 0);
  const current = user.current_competency_level || 'CL0';
  const required = user.min_required_level || null;
  const t = user.competency_level_thresholds || {};
  const order = ['CL1', 'CL2', 'CL3', 'CL4'];
  // Find the next threshold the employee has not yet reached
  const nextLevel = order.find((lvl) => Number(t[lvl] || 0) > total);
  const nextThreshold = nextLevel ? Number(t[nextLevel] || 0) : null;
  // Find the previous threshold (current level base) so progress is relative
  const prevLevel = nextLevel
    ? order[Math.max(0, order.indexOf(nextLevel) - 1)]
    : 'CL4';
  const prevThreshold = nextLevel && order.indexOf(nextLevel) > 0
    ? Number(t[prevLevel] || 0)
    : 0;
  const span = (nextThreshold || 0) - prevThreshold;
  const filled = span > 0 ? Math.min(1, Math.max(0, (total - prevThreshold) / span)) : 1;

  const meetsRequired = (() => {
    if (!required) return null;
    const rank = { CL0: 0, CL1: 1, CL2: 2, CL3: 3, CL4: 4 };
    return rank[current] >= rank[required];
  })();

  return (
    <div style={{background: '#18223a', borderRadius: 12, padding: 16, marginTop: 12}}>
      <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8}}>
        <div>
          <div style={{fontSize: 12, color: '#9bb0e0'}}>Current Level</div>
          <div style={{fontSize: 22, fontWeight: 800}}>{current}</div>
        </div>
        <div style={{textAlign: 'right'}}>
          <div style={{fontSize: 12, color: '#9bb0e0'}}>Total Points</div>
          <div style={{fontSize: 22, fontWeight: 800}}>{total}</div>
        </div>
      </div>

      {required && (
        <div style={{fontSize: 13, marginBottom: 12, color: meetsRequired ? '#7be1a1' : '#ffb4b4'}}>
          {meetsRequired
            ? `Meets required level for your position (${required}).`
            : `Position requires ${required}. You\'re at ${current}.`}
        </div>
      )}

      {nextLevel ? (
        <>
          <div style={{fontSize: 12, color: '#9bb0e0', marginBottom: 4}}>
            {nextThreshold - total} pt{(nextThreshold - total) === 1 ? '' : 's'} to {nextLevel}
          </div>
          <div style={{height: 10, background: '#0e1530', borderRadius: 999, overflow: 'hidden'}}>
            <div style={{height: '100%', width: `${Math.round(filled * 100)}%`, background: 'linear-gradient(90deg, #5b8cff, #57b3ff)', transition: 'width 300ms ease'}} />
          </div>
        </>
      ) : (
        <div style={{fontSize: 13, color: '#7be1a1'}}>Top level reached (CL4). 🏆</div>
      )}

      <div style={{marginTop: 10, fontSize: 11, color: '#7c8dbb'}}>
        Thresholds: CL1 {t.CL1 ?? '-'} · CL2 {t.CL2 ?? '-'} · CL3 {t.CL3 ?? '-'} · CL4 {t.CL4 ?? '-'}{' '}
        ({t.source === 'position' ? 'per-position' : 'global'})
      </div>
    </div>
  );
}
const ArchiveSection = () => {
  const [records, setRecords] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  React.useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get('/training/records/'),
      api.get('/accounts/me/'),
    ])
      .then(([r, u]) => {
        setRecords(r.data?.results || r.data || []);
        setUser(u.data);
      })
      .catch(() => setError('Failed to load archive.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="card p-4">Loading archive…</div>;
  if (error) return <div className="card p-4" style={{color:'#c62828'}}>{error}</div>;

  const passed = records.filter((r) => r.status === 'PASSED');
  const total = passed.reduce((s, r) => s + Number(r.points_earned || 0), 0);

  return (
    <div className="card p-4" style={{background:'#22305a', color:'#fff', borderRadius:16}}>
      <h3 style={{marginTop:0}}>Competency Archive</h3>
      <div style={{fontSize:14, color:'#9bb0e0', marginBottom:12}}>
        Every competency you've passed contributes its priority points to your total.
      </div>

      {user && <CompetencyLevelPanel user={user} />}

      <div style={{marginTop:18, overflowX:'auto'}}>
        <table style={{width:'100%', borderCollapse:'collapse', fontSize:14}}>
          <thead>
            <tr style={{background:'#18223a'}}>
              <th style={{textAlign:'left', padding:'10px 12px'}}>Competency</th>
              <th style={{textAlign:'center', padding:'10px 12px'}}>Status</th>
              <th style={{textAlign:'right', padding:'10px 12px'}}>Points Earned</th>
              <th style={{textAlign:'center', padding:'10px 12px'}}>Completed</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr><td colSpan={4} style={{textAlign:'center', padding:14, color:'#9bb0e0'}}>No competency records yet.</td></tr>
            ) : records.map((r, idx) => (
              <tr key={r.id} style={{background: idx % 2 ? '#18223a' : '#22305a'}}>
                <td style={{padding:'10px 12px'}}>{r.competency?.title || '-'}</td>
                <td style={{padding:'10px 12px', textAlign:'center', fontWeight:600, color: r.status === 'PASSED' ? '#7be1a1' : r.status === 'FAILED' ? '#ffb4b4' : '#9bb0e0'}}>{r.status}</td>
                <td style={{padding:'10px 12px', textAlign:'right', fontWeight:700}}>{r.status === 'PASSED' ? r.points_earned : '-'}</td>
                <td style={{padding:'10px 12px', textAlign:'center', color:'#9bb0e0'}}>{r.date_completed || '-'}</td>
              </tr>
            ))}
          </tbody>
          {passed.length > 0 && (
            <tfoot>
              <tr style={{background:'#0e1530', fontWeight:700}}>
                <td style={{padding:'10px 12px'}} colSpan={2}>Total from {passed.length} passed competenc{passed.length === 1 ? 'y' : 'ies'}</td>
                <td style={{padding:'10px 12px', textAlign:'right'}}>{total}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

const CertificateSection = () => <div className="card p-4">Certificate request coming soon…</div>;

const tabs = [
  { key: "competencies", label: "My Competencies", icon: <FaBookOpen /> },
  { key: "exams", label: "Assessments", icon: <FaClipboardList /> },
  { key: "results", label: "Progress & History", icon: <FaHistory /> },
  { key: "archive", label: "Archive", icon: <FaHistory /> },
  { key: "profile", label: "My Profile", icon: <FaUserCircle /> },
  { key: "certificate", label: "Certificates", icon: <FaCertificate /> },
];

const bgStyle = {
  minHeight: "100vh",
  background: "linear-gradient(120deg, #e0eafc 0%, #cfdef3 100%)",
  paddingBottom: 60,
};

const heroBgUrl = "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80"; // Example hospitality image

const heroStyle = {
  position: "relative",
  borderRadius: "18px",
  marginBottom: "32px",
  minHeight: 260,
  overflow: "hidden",
  boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

const heroOverlay = {
  position: "absolute",
  inset: 0,
  background: "rgba(0, 32, 64, 0.55)",
  zIndex: 1
};

const heroContent = {
  position: "relative",
  zIndex: 2,
  color: "#fff",
  textAlign: "center",
  padding: "48px 24px"
};

const navBarStyle = {
  display: "flex",
  gap: "18px",
  justifyContent: "center",
  alignItems: "center",
  flexWrap: "nowrap",
  overflowX: "auto",
  padding: "18px 0 18px 0",
  margin: "-48px auto 40px auto",
  borderRadius: 40,
  background: "rgba(255,255,255,0.85)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 1.5px 0 #e3eafc inset",
  maxWidth: 980,
  minHeight: 72,
  position: "relative",
  border: "1.5px solid #e3eafc",
  backdropFilter: "blur(8px)",
  zIndex: 10,
};
const navDividerStyle = {
  width: "100%",
  height: 2,
  background: "#e3eafc",
  margin: "0 0 32px 0",
  border: 0,
};

const simpleTabBarStyle = {
  display: "flex",
  gap: "0",
  justifyContent: "center",
  alignItems: "center",
  background: "#fff",
  borderRadius: "0 0 18px 18px",
  boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
  borderBottom: "2.5px solid #e3eafc",
  maxWidth: 980,
  margin: "0 auto 32px auto",
  padding: "0 0 0 0",
  position: "relative",
  minHeight: 56,
  flexWrap: "wrap",
  overflowX: "auto"
};
const simpleTabStyle = (active) => ({
  flex: 1,
  border: "none",
  background: "none",
  color: active ? "#1976d2" : "#222",
  fontWeight: active ? 700 : 500,
  fontSize: "1.08rem",
  padding: "18px 0 14px 0",
  borderBottom: active ? "3px solid #1976d2" : "3px solid transparent",
  outline: "none",
  cursor: "pointer",
  transition: "color 0.18s, border-bottom 0.18s",
  letterSpacing: "0.01em",
  backgroundColor: "transparent",
  minWidth: 120,
  textOverflow: "ellipsis",
  overflow: "hidden",
  whiteSpace: "nowrap"
});

export default function EmployeeDashboardModern() {
  const [tab, setTab] = useState("competencies");
  const [competencies, setCompetencies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // Fetch competencies on mount
  React.useEffect(() => {
    setLoading(true);
    setError("");
    api.get("/training/my-competencies/")
      .then((res) => {
        // Extract .competency from each record
        const comps = (res.data || []).map(rec => rec.competency).filter(Boolean);
        setCompetencies(comps);
      })
      .catch(() => setError("Failed to load competencies."))
      .finally(() => setLoading(false));
  }, []);

  // Handler for opening a competency
  const handleOpenCompetency = (comp) => {
    navigate(`/competency/${comp.id}`);
  };

  return (
    <div style={bgStyle}>
      <div className="container py-5">
        <div style={heroStyle} className="hero-banner mb-4">
          <img src={heroBgUrl} alt="Hospitality" style={{position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0}} />
          <div style={heroOverlay} />
          <div style={heroContent}>
            <h1 className="fw-bold mb-2 hero-title" style={{fontSize: "2.8rem", letterSpacing: "-1px", textShadow: "0 2px 16px rgba(0,0,0,0.25)"}}>Welcome to Your Training Dashboard</h1>
            <p style={{fontSize: "1.25rem", maxWidth: 700, margin: "0 auto", textShadow: "0 2px 8px rgba(0,0,0,0.18)"}}>
              Track your competencies, take exams, view your results, and manage your professional profile—all in one place.
            </p>
          </div>
        </div>
        <div className="dashboard-tabs-bar" style={simpleTabBarStyle}>
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              className="dashboard-tab-btn"
              style={simpleTabStyle(tab === key)}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <hr style={navDividerStyle} />
        <div className="fade-in">
          {tab === "competencies" && (
            <>
              {loading && <div style={{textAlign: 'center', color: '#1976d2', fontSize: 20, margin: '32px 0'}}>Loading competencies…</div>}
              {error && <div style={{textAlign: 'center', color: '#c62828', fontSize: 18, margin: '32px 0'}}>{error}</div>}
              {!loading && !error && (
                <CompetenciesSection competencies={competencies} onOpen={handleOpenCompetency} />
              )}
            </>
          )}
          {tab === "exams" && <ExamsSection />}
          {tab === "results" && <ResultsSection />}
          {tab === "archive" && <ArchiveSection />}
          {tab === "profile" && <ProfileSection />}
          {tab === "certificate" && <CertificateSection />}
        </div>
      </div>
      <style>{`
        .fade-in { animation: fadeInHero 0.7s; }
        @keyframes fadeInHero {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: none; }
        }
        @media (max-width: 700px) {
          .dashboard-tabs-bar {
            flex-direction: column !important;
            align-items: stretch !important;
            border-radius: 0 0 18px 18px !important;
            min-width: 0 !important;
            max-width: 100vw !important;
            margin: 0 0 24px 0 !important;
            box-shadow: 0 2px 12px rgba(0,0,0,0.06);
          }
          .dashboard-tab-btn {
            border-radius: 0 !important;
            border-bottom: 1.5px solid #e3eafc !important;
            min-width: 0 !important;
            font-size: 1.05rem !important;
            padding: 16px 0 12px 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
