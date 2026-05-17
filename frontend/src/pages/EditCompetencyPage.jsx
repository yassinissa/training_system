import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/client.js';
import DataState from '../components/DataState.jsx';

export default function EditCompetencyPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [removePdf, setRemovePdf] = useState(false);
  const imageInputRef = useRef();
  const pdfInputRef = useRef();

  useEffect(() => {
    api.get(`/training/competencies/${id}/`)
      .then(res => setForm(res.data))
      .catch(() => setError('Failed to load competency'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        // Don't send image/pdf_file as empty/null
        if (k === 'image' || k === 'pdf_file') return;
        if (v !== '' && v !== null && v !== undefined) fd.append(k, v);
      });
      // Only append image/pdf_file if uploading a new file
      if (imageFile) {
        fd.append('image', imageFile);
      }
      if (pdfFile) {
        fd.append('pdf_file', pdfFile);
      }
      // Always send removal flags if set, even if no new file
      if (removeImage === true) {
        fd.append('remove_image', 'true');
      }
      if (removePdf === true) {
        fd.append('remove_pdf_file', 'true');
      }
      await api.patch(`/training/competencies/${id}/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      navigate(-1);
    } catch {
      setError('Failed to update competency');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this competency? This cannot be undone.')) return;
    setLoading(true);
    setError('');
    try {
      await api.delete(`/training/competencies/${id}/`);
      // /manager/competencies is not a real route; ManagerDashboard hosts the
      // competencies section. Bounce back to the manager dashboard instead.
      navigate('/manager');
    } catch {
      setError('Failed to delete competency');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h2>Edit Competency</h2>
      <DataState loading={loading} error={error} isEmpty={!form}>
        {form && (
          <form className="form" onSubmit={handleSubmit} style={{ maxWidth: 520 }}>
            <div className="field">
              <label>Reference Number</label>
              <input name="reference_number" value={form.reference_number || ''} onChange={handleChange} />
            </div>
            <div className="field">
              <label>Title</label>
              <input name="title" value={form.title || ''} onChange={handleChange} />
            </div>
            <div className="field">
              <label>Frequency</label>
              <select name="frequency" value={form.frequency || ''} onChange={handleChange}>
                <option value="ONE_TIME">ONE_TIME</option>
                <option value="YEARLY">YEARLY</option>
                <option value="NEW_HIRE">NEW_HIRE</option>
                <option value="PROMOTION">PROMOTION</option>
                <option value="OTHER">OTHER</option>
              </select>
            </div>
            <div className="field">
              <label>Priority Points</label>
              <input name="priority_points" type="number" value={form.priority_points || 0} onChange={handleChange} />
            </div>
            <div className="field">
              <label>Requires Exam</label>
              <input name="requires_exam" type="checkbox" checked={!!form.requires_exam} onChange={handleChange} />
            </div>
            <div className="field">
              <label>Duration</label>
              <input name="duration" value={form.duration || ''} onChange={handleChange} />
            </div>
            <div className="field">
              <label>Competency Area</label>
              <input name="competency_area" value={form.competency_area || ''} onChange={handleChange} />
            </div>
            <div className="field">
              <label>Brand</label>
              <input name="brand" value={form.brand || ''} onChange={handleChange} />
            </div>
            <div className="field">
              <label>External Link</label>
              <input name="external_link" value={form.external_link || ''} onChange={handleChange} />
            </div>
            <div className="field">
              <label>Description</label>
              <textarea name="description" value={form.description || ''} onChange={handleChange} />
            </div>
            <div className="field">
              <label>Content / Notes</label>
              <textarea name="content" value={form.content || ''} onChange={handleChange} />
            </div>
            <div className="field">
              <label>Image</label>
              {form.image && !removeImage && (
                <div style={{marginBottom:8, display:'flex', alignItems:'center', gap:8}}>
                  <img src={form.image} alt="Current" style={{maxWidth:120, maxHeight:120, borderRadius:8}} />
                  <button type="button" className="btn danger" onClick={() => { setRemoveImage(true); setImageFile(null); }}>Remove</button>
                </div>
              )}
              {!form.image || removeImage ? (
                <input
                  type="file"
                  accept="image/*"
                  ref={imageInputRef}
                  onChange={e => setImageFile(e.target.files?.[0] || null)}
                />
              ) : null}
              {removeImage && <span style={{color:'#c00'}}>Image will be removed</span>}
            </div>
            <div className="field">
              <label>PDF File</label>
              {form.pdf_file && !removePdf && (
                <div style={{marginBottom:8, display:'flex', alignItems:'center', gap:8}}>
                  <a href={form.pdf_file} target="_blank" rel="noopener noreferrer">View current PDF</a>
                  <button type="button" className="btn danger" onClick={() => { setRemovePdf(true); setPdfFile(null); }}>Remove</button>
                </div>
              )}
              {!form.pdf_file || removePdf ? (
                <input
                  type="file"
                  accept="application/pdf"
                  ref={pdfInputRef}
                  onChange={e => setPdfFile(e.target.files?.[0] || null)}
                />
              ) : null}
              {removePdf && <span style={{color:'#c00'}}>PDF will be removed</span>}
            </div>
            <div className="row" style={{ gap: 8, marginTop: 16 }}>
              <button className="btn primary" type="submit">Save</button>
              <button className="btn danger" type="button" onClick={handleDelete}>Delete</button>
              <button className="btn" type="button" onClick={() => navigate(-1)}>Cancel</button>
            </div>
          </form>
        )}
      </DataState>
    </div>
  );
}
