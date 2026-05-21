import { useEffect, useState } from 'react'
import api from '../api/client.js'

function toCSV(rows, headers) {
  const headerLine = headers.map((h) => '"' + h.label + '"').join(',')
  const dataLines = rows.map((r) => headers.map((h) => '"' + String(h.get(r) ?? '') + '"').join(',')).join('\n')
  return headerLine + '\n' + dataLines
}

export default function AdminReports() {
  const [branches, setBranches] = useState([])
  const [positions, setPositions] = useState([])
  const [filters, setFilters] = useState({ branch: '', position: '' })
  const [nonCompliance, setNonCompliance] = useState(null)
  const [sessions, setSessions] = useState([])
  const [levelDeficient, setLevelDeficient] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api.get('/branches/'), api.get('/positions/')]).then(([b, p]) => {
      setBranches(b.data || [])
      setPositions(p.data || [])
    })
  }, [])

  const runReports = async () => {
    setLoading(true)
    setError('')
    try {
      const q = new URLSearchParams()
      if (filters.branch) q.append('branch', filters.branch)
      if (filters.position) q.append('position', filters.position)

      const [ncRes, sessRes, ldRes] = await Promise.all([
        api.get(`/training/compliance/missing/?${q.toString()}`),
        api.get(`/training/exam/sessions/manage/${filters.branch ? `?branch=${filters.branch}` : ''}`),
        api.get(`/training/reports/level-deficient/?${q.toString()}`),
      ])
      setNonCompliance(ncRes.data)
      const sessData = sessRes.data
      setSessions(Array.isArray(sessData) ? sessData : (sessData?.results || []))
      setLevelDeficient(ldRes.data)
    } catch (e) {
      setError(e?.response?.data || 'Failed to load reports')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { runReports() }, [])

  const exportComplianceCSV = () => {
    if (!nonCompliance) return
    const headers = [
      { label: 'employee_id', get: (r) => r.employee_id },
      { label: 'username', get: (r) => r.username },
      { label: 'position', get: (r) => r.position },
      { label: 'branch', get: (r) => r.branch },
      { label: 'below_min_level', get: (r) => r.below_min_level },
      { label: 'missing_titles', get: (r) => (r.missing_competencies || []).map((m) => m.title).join('|') },
    ]
    const csv = toCSV(nonCompliance.non_compliant || [], headers)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'non_compliance.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportSessionsCSV = () => {
    const headers = [
      { label: 'id', get: (s) => s.id },
      { label: 'employee_id', get: (s) => s.employee },
      { label: 'exam_id', get: (s) => s.exam },
      { label: 'status', get: (s) => s.status },
      { label: 'started_at', get: (s) => s.started_at },
      { label: 'submitted_at', get: (s) => s.submitted_at },
      { label: 'score', get: (s) => s.score },
    ]
    const csv = toCSV(sessions || [], headers)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sessions.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="container">
      <h1>Admin Reports</h1>
      <div className="card">
        <h3>Filters</h3>
        <div className="row">
          <select value={filters.branch} onChange={(e) => setFilters((f) => ({ ...f, branch: e.target.value }))}>
            <option value="">All branches</option>
            {branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
          </select>
          <select value={filters.position} onChange={(e) => setFilters((f) => ({ ...f, position: e.target.value }))}>
            <option value="">All positions</option>
            {positions.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
          <button className="btn" onClick={runReports}>Run</button>
        </div>
      </div>

      {loading && <div className="card">Loading…</div>}
      {error && <div className="card"><div className="error">{String(error)}</div></div>}

      {nonCompliance && (
        <div className="card">
          <div className="row" style={{justifyContent:'space-between'}}>
            <h3>Non-Compliance</h3>
            <button className="btn" onClick={exportComplianceCSV}>Export CSV</button>
          </div>
          <div className="row">
            <span className="pill">Checked: {nonCompliance.total_employees_checked}</span>
            <span className="pill">Non-compliant: {nonCompliance.non_compliant_count}</span>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Position</th>
                <th>Branch</th>
                <th>Below Min Level</th>
                <th>Missing</th>
              </tr>
            </thead>
            <tbody>
              {(nonCompliance.non_compliant || []).map((r) => (
                <tr key={r.employee_id}>
                  <td>{r.username}</td>
                  <td>{
                    (typeof r.position === 'object')
                      ? (r.position?.name ?? r.position?.id ?? '—')
                      : (r.position ?? '—')
                  }</td>
                  <td>{
                    (typeof r.branch === 'object')
                      ? (r.branch?.name ?? r.branch?.id ?? '—')
                      : (r.branch ?? '—')
                  }</td>
                  <td>{r.below_min_level ? 'Yes' : 'No'}</td>
                  <td>{(r.missing_competencies || []).map((m) => m.title).join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {levelDeficient && (
        <div className="card">
          <div className="row" style={{justifyContent:'space-between'}}>
            <h3>Below Required Level</h3>
            <span className="pill">{levelDeficient.count || 0} employees</span>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th><th>Emp #</th><th>Position</th><th>Branch</th>
                <th>Current</th><th>Required</th><th>Points</th><th>Need</th><th>Short by</th>
              </tr>
            </thead>
            <tbody>
              {(levelDeficient.results || []).length === 0 ? (
                <tr><td colSpan={9} style={{opacity:0.7}}>Everyone meets their required level.</td></tr>
              ) : (levelDeficient.results || []).map((r) => (
                <tr key={r.employee_id}>
                  <td>{r.username}</td>
                  <td>{r.employee_number || '-'}</td>
                  <td>{r.position || '-'}</td>
                  <td>{r.branch || '-'}</td>
                  <td style={{color:'#ef4444', fontWeight:700}}>{r.current_level}</td>
                  <td style={{color:'#19c37d', fontWeight:700}}>{r.required_level}</td>
                  <td>{r.total_points}</td>
                  <td>{r.required_points}</td>
                  <td style={{fontWeight:700}}>{r.points_short}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <div className="row" style={{justifyContent:'space-between'}}>
          <h3>Sessions</h3>
          <button className="btn" onClick={exportSessionsCSV}>Export CSV</button>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Employee</th>
              <th>Exam</th>
              <th>Status</th>
              <th>Started</th>
              <th>Submitted</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {(sessions || []).map((s) => (
              <tr key={s.id}>
                <td>{s.id}</td>
                  <td>{
                    (typeof s.employee === 'object')
                      ? (s.employee?.username ?? s.employee?.employee_number ?? s.employee?.id ?? '—')
                      : (s.employee ?? '—')
                  }</td>
                  <td>{
                    (typeof s.exam === 'object')
                      ? (s.exam?.title ?? s.exam?.id ?? '—')
                      : (s.exam ?? '—')
                  }</td>
                <td>{s.status}</td>
                <td>{s.started_at}</td>
                <td>{s.submitted_at || '—'}</td>
                <td>{s.score ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
