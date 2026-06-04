import { useEffect, useRef, useState } from 'react';
import api from '../api/client.js';

/**
 * Files (photos, signed score sheets, IDs, etc.) attached to an employee's
 * profile by managers and admins. Audit-only - employees never see these.
 *
 * Props:
 *   employeeId  - numeric ID of the User the attachments belong to.
 *   compact     - optional bool, slightly tighter spacing.
 *
 * Endpoints used:
 *   GET    /api/accounts/employees/<id>/attachments/
 *   POST   /api/accounts/employees/<id>/attachments/   (multipart, 'files')
 *   DELETE /api/accounts/employee-attachments/<id>/
 */
export default function EmployeeAttachments({ employeeId, compact = false }) {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [picked, setPicked] = useState([]);
  const [caption, setCaption] = useState('');
  const [kind, setKind] = useState('SIGNED_SCORE');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  // ---- load ----
  useEffect(() => {
    let live = true;
    if (!employeeId) return;
    setLoading(true);
    setError('');
    api.get(`/accounts/employees/${employeeId}/attachments/`)
      .then((res) => { if (live) setAttachments(Array.isArray(res.data) ? res.data : []); })
      .catch(() => { if (live) setError('Failed to load attachments'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [employeeId]);

  // ---- upload ----
  const upload = async () => {
    if (!picked.length) return;
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      for (const f of picked) fd.append('files', f);
      if (caption.trim()) fd.append('caption', caption.trim());
      if (kind) fd.append('kind', kind);
      const res = await api.post(
        `/accounts/employees/${employeeId}/attachments/`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      const added = Array.isArray(res.data) ? res.data : [];
      setAttachments((prev) => [...added, ...prev]);
      setPicked([]);
      setCaption('');
      if (fileRef.current) fileRef.current.value = '';
    } catch {
      setError('Failed to upload one or more files');
    } finally {
      setUploading(false);
    }
  };

  // ---- delete ----
  const remove = async (att) => {
    if (!window.confirm('Delete this attachment? This cannot be undone.')) return;
    try {
      await api.delete(`/accounts/employee-attachments/${att.id}/`);
      setAttachments((prev) => prev.filter((a) => a.id !== att.id));
    } catch {
      setError('Failed to delete attachment');
    }
  };

  // ---- helpers ----
  const isImage = (att) => {
    if (att.kind === 'PHOTO') return true;
    const name = String(att.file || '').toLowerCase();
    return /\.(png|jpe?g|gif|webp|bmp|heic)(\?|$)/.test(name);
  };
  const fileName = (att) =>
    String(att.file || '').split('?')[0].split('/').pop() || `attachment-${att.id}`;

  const kindLabel = {
    SIGNED_SCORE: 'Signed score sheet',
    PHOTO: 'Photo',
    ID: 'ID / document',
    OTHER: 'Other',
  };

  return (
    <div
      className="card"
      style={{
        marginTop: compact ? 16 : 24,
        background: '#22305a',
        color: '#fff',
      }}
    >
      <h4 style={{ marginTop: 0, marginBottom: 4 }}>Profile Attachments</h4>
      <div style={{ fontSize: 12, color: '#9bb0e0', marginBottom: 12 }}>
        Internal documents (signed score sheets, photos, IDs). Visible only to managers and admins.
      </div>

      {/* Existing files */}
      {loading ? (
        <div style={{ color: '#9bb0e0' }}>Loading…</div>
      ) : attachments.length === 0 ? (
        <div style={{ color: '#9bb0e0', fontStyle: 'italic', marginBottom: 12 }}>
          No attachments yet.
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 14px' }}>
          {attachments.map((att) => (
            <li
              key={att.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                marginBottom: 6,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8,
              }}
            >
              {isImage(att) ? (
                <a href={att.file} target="_blank" rel="noreferrer">
                  <img
                    src={att.file}
                    alt={att.caption || fileName(att)}
                    style={{
                      width: 52, height: 52,
                      objectFit: 'cover', borderRadius: 6,
                    }}
                  />
                </a>
              ) : (
                <span
                  style={{
                    width: 52, height: 52,
                    display: 'inline-flex',
                    alignItems: 'center', justifyContent: 'center',
                    background: '#3a1b1b', color: '#ffb4b4',
                    borderRadius: 6, fontWeight: 700, fontSize: 11,
                  }}
                >
                  {att.kind === 'ID' ? 'ID' : 'FILE'}
                </span>
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <a
                  href={att.file}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    color: '#cfe1ff',
                    fontWeight: 600,
                    wordBreak: 'break-all',
                  }}
                >
                  {fileName(att)}
                </a>
                <div style={{ fontSize: 12, color: '#9bb0e0', marginTop: 2 }}>
                  {kindLabel[att.kind] || att.kind}
                  {att.caption ? ` · ${att.caption}` : ''}
                </div>
                <div style={{ fontSize: 11, color: '#7a8db8', marginTop: 2 }}>
                  {att.uploaded_by_username ? `by ${att.uploaded_by_username}` : 'by —'}
                  {att.uploaded_at ? ` · ${new Date(att.uploaded_at).toLocaleString()}` : ''}
                </div>
              </div>

              <button
                type="button"
                className="btn danger"
                onClick={() => remove(att)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Upload row */}
      <div
        style={{
          padding: '10px 12px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px dashed rgba(255,255,255,0.15)',
          borderRadius: 8,
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            style={{ minWidth: 160 }}
          >
            <option value="SIGNED_SCORE">Signed score sheet</option>
            <option value="PHOTO">Photo</option>
            <option value="ID">ID / document</option>
            <option value="OTHER">Other</option>
          </select>
          <input
            type="text"
            placeholder="Caption (optional)"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            style={{ flex: '1 1 200px' }}
          />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,application/pdf"
            onChange={(e) => setPicked(Array.from(e.target.files || []))}
          />
          <button
            type="button"
            className="btn primary"
            onClick={upload}
            disabled={!picked.length || uploading}
          >
            {uploading
              ? 'Uploading…'
              : picked.length
                ? `Upload ${picked.length} file${picked.length > 1 ? 's' : ''}`
                : 'Upload'}
          </button>
        </div>
        {error && (
          <div style={{ color: '#ffb4b4', marginTop: 8 }}>{error}</div>
        )}
      </div>
    </div>
  );
}
