
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/client";
import { FaTrash, FaPencilAlt } from "react-icons/fa";

export default function AdminUserProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [editPic, setEditPic] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // New: analytics state
  const [activity, setActivity] = useState(null);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    api.get(`/accounts/employee/${id}/`)
      .then((res) => {
        setUser(res.data);
        // Fetch activity if employee_number is available
        if (res.data?.employee_number) {
          setActivityLoading(true);
          setActivityError("");
          api.get(`/training/employee/activity/?employee_number=${encodeURIComponent(res.data.employee_number)}`)
            .then((ares) => setActivity(ares.data))
            .catch(() => setActivityError("Failed to load exam sessions and analytics."))
            .finally(() => setActivityLoading(false));
        } else {
          setActivityLoading(false);
        }
      })
      .catch(() => setError("Failed to load user info."))
      .finally(() => setLoading(false));
  }, [id]);

  const handlePictureChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    const formData = new FormData();
    formData.append("profile_picture", file);
    api.post(`/accounts/me/profile-picture/`, formData, {
      headers: { "Content-Type": "multipart/form-data" }
    })
      .then((res) => setUser((prev) => ({ ...prev, profile_picture: res.data.profile_picture })))
      .catch(() => setUploadError("Failed to upload profile picture."))
      .finally(() => setUploading(false));
  };

  const handleRemovePicture = () => {
    setUploading(true);
    setUploadError("");
    api.post(`/accounts/me/profile-picture/remove/`)
      .then(() => setUser((prev) => ({ ...prev, profile_picture: null })))
      .catch(() => setUploadError("Failed to remove profile picture."))
      .finally(() => setUploading(false));
  };

  const handleDeleteUser = () => {
    if (!window.confirm("Are you sure you want to delete this user? This cannot be undone.")) return;
    setDeleting(true);
    api.delete(`/accounts/employee/${id}/`)
      .then(() => {
        navigate("/admin");
      })
      .catch(() => setError("Failed to delete user."))
      .finally(() => setDeleting(false));
  };

  if (loading) return <div className="card p-4">Loading profile…</div>;
  if (error) return <div className="card p-4" style={{color: '#c62828'}}>{error}</div>;
  if (!user) return <div className="card p-4">No user info found.</div>;

  return (
    <div style={{maxWidth: 800, margin: '0 auto'}}>
      <div className="card p-4" style={{background: '#22305a', color: '#fff', borderRadius: 16, boxShadow: '0 2px 16px rgba(0,32,64,0.12)'}}>
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
        <div style={{marginBottom: 10}}><b>Branch:</b> {typeof user.employee_branch === 'object' && user.employee_branch !== null ? `${user.employee_branch.name}${user.employee_branch.location ? ' (' + user.employee_branch.location + ')' : ''}` : (user.employee_branch || '-')}</div>
        <div style={{marginBottom: 10}}><b>Role:</b> {user.role || '-'}</div>
        <div style={{marginBottom: 10}}><b>Competency Level:</b> {user.current_competency_level || '-'}</div>
        <div style={{marginBottom: 10}}><b>Total Points:</b> {user.total_competency_points || '-'}</div>
        <button className="btn danger" onClick={handleDeleteUser} disabled={deleting} style={{marginTop: 24}}>
          <FaTrash style={{marginRight: 8}} /> Delete Profile
        </button>
      </div>

      {/* Exam Sessions & Analytics Section */}
      <div className="card p-4" style={{marginTop: 32, background: '#18223a', color: '#fff', borderRadius: 16}}>
        <h3 style={{marginBottom: 18}}>Exam Sessions</h3>
        {activityLoading ? (
          <div>Loading exam sessions…</div>
        ) : activityError ? (
          <div style={{color: '#ff5252'}}>{activityError}</div>
        ) : activity?.sessions && activity.sessions.length > 0 ? (
          <div style={{overflowX: 'auto'}}>
            <table className="table" style={{width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '1rem', background: '#22305a', borderRadius: '12px', overflow: 'hidden'}}>
              <thead>
                <tr style={{background: '#22305a', color: '#fff', fontWeight: 700}}>
                  <th>Session Name</th>
                  <th>Status</th>
                  <th>Result</th>
                  <th>Score</th>
                  <th>Max Score</th>
                  <th style={{maxWidth: 180, minWidth: 120}}>Competency</th>
                  <th>Started At</th>
                  <th>Submitted At</th>
                </tr>
              </thead>
              <tbody>
                {activity.sessions.map((s, idx) => (
                  <tr key={s.id} style={{background: idx % 2 === 0 ? '#22305a' : '#18223a', color: '#fff'}}>
                    <td style={{padding: '13px', textAlign: 'left', border: 'none', wordBreak: 'break-word', whiteSpace: 'normal', maxWidth: 120}}>{s.exam?.title || '-'}</td>
                    <td style={{padding: '13px', textAlign: 'center', border: 'none'}}>{s.status}</td>
                    <td style={{padding: '13px', textAlign: 'center', border: 'none'}}>{s.status === 'GRADED' ? ((s.score / s.max_score) * 100 >= 60 ? 'Passed' : 'Failed') : ''}</td>
                    <td style={{padding: '13px', textAlign: 'center', border: 'none'}}>{s.status === 'GRADED' && s.score != null ? s.score : '-'}</td>
                    <td style={{padding: '13px', textAlign: 'center', border: 'none'}}>{s.status === 'GRADED' && s.max_score != null ? s.max_score : '-'}</td>
                    <td style={{padding: '13px', textAlign: 'left', border: 'none', wordBreak: 'break-word', whiteSpace: 'normal', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis'}}>{typeof s.exam?.competency === 'object' ? s.exam.competency.title : '-'}</td>
                    <td style={{padding: '13px', textAlign: 'center', border: 'none'}}>{s.started_at ? new Date(s.started_at).toLocaleString() : '-'}</td>
                    <td style={{padding: '13px', textAlign: 'center', border: 'none'}}>{s.submitted_at ? new Date(s.submitted_at).toLocaleString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{color:'#888'}}>No sessions found.</div>
        )}
      </div>

      <div className="card p-4" style={{marginTop: 24, background: '#18223a', color: '#fff', borderRadius: 16}}>
        <h3 style={{marginBottom: 18}}>Competencies</h3>
        {activityLoading ? (
          <div>Loading competencies…</div>
        ) : activityError ? (
          <div style={{color: '#ff5252'}}>{activityError}</div>
        ) : activity?.competencies && activity.competencies.length > 0 ? (
          <ul>
            {activity.competencies.map((c) => (
              <li key={c.id}><b>{c.title}</b> ({c.reference_number}) - {c.description}</li>
            ))}
          </ul>
        ) : (
          <div style={{color:'#888'}}>No competencies assigned.</div>
        )}
      </div>
    </div>
  );
}
