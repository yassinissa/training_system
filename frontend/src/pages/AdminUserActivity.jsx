import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client.js'
import { useAuth } from '../hooks/auth-context.jsx'

function Pill({ children }) {
  return <span className="pill" style={{marginRight:8}}>{children}</span>
}

function toCSV(rows, headers) {
  const headerLine = headers.map((h) => '"' + h.label + '"').join(',')
  const dataLines = (rows || []).map((r) => headers.map((h) => '"' + String(h.get(r) ?? '') + '"').join(',')).join('\n')
  return headerLine + '\n' + dataLines
}

export default function AdminUserActivity() {
  const { id } = useParams() 
  const navigate = useNavigate()
  const { user: authUser } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const managerBranchIds = useMemo(() => {
    if (authUser?.role !== 'MANAGER') return []
    const detailIds = (authUser.manager_branches_detail || []).map((b) => Number(b.id)).filter(Boolean)
    const flatIds = (authUser.manager_branch_ids || []).map((id) => Number(id)).filter(Boolean)
    const merged = [...detailIds, ...flatIds]
    return Array.from(new Set(merged))
  }, [authUser])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get(`/training/employee/activity/?id=${encodeURIComponent(id)}`)

      // Managers can only view employees in their branches; admins can view all
      setData(res.data)
    } catch (e) {
      setError(e?.response?.data || 'Failed to load activity')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id, authUser?.role, managerBranchIds])

  const exportRecordsCSV = () => {
    const headers = [
      { label: 'id', get: (r) => r.id },
      { label: 'competency', get: (r) => (typeof r.competency === 'object' ? (r.competency?.title ?? r.competency?.id ?? '') : (r.competency ?? '')) },
      { label: 'status', get: (r) => r.status },
      { label: 'score', get: (r) => r.score },
      { label: 'points_earned', get: (r) => r.points_earned },
      { label: 'date_completed', get: (r) => r.date_completed },
      { label: 'quarter', get: (r) => r.quarter },
    ]
    const csv = toCSV(data?.records || [], headers)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'employee_records.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportSessionsCSV = () => {
    const headers = [
      { label: 'id', get: (s) => s.id },
      { label: 'exam', get: (s) => (typeof s.exam === 'object' ? (s.exam?.title ?? s.exam?.id ?? '') : (s.exam ?? '')) },
      { label: 'status', get: (s) => s.status },
      { label: 'started_at', get: (s) => s.started_at },
      { label: 'submitted_at', get: (s) => s.submitted_at || '' },
      { label: 'score', get: (s) => s.score ?? '' },
    ]
    const csv = toCSV(data?.sessions || [], headers)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'employee_sessions.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const levelColor = useMemo(() => {
    const lvl = data?.totals?.competency_level
    if (lvl === 'CL4') return 'green'
    if (lvl === 'CL3') return 'green'
    if (lvl === 'CL2') return 'yellow'
    return 'red'
  }, [data?.totals?.competency_level])

  return (
    <div className="container">
      <div className="row" style={{justifyContent:'space-between'}}>
        <h1 style={{margin:0}}>Employee Activity</h1>
        <div className="row">
          <button className="btn" onClick={() => navigate(-1)}>Back</button>
        </div>
      </div>

      {loading && <div className="card">Loading…</div>}
      {error && <div className="card"><div className="error">{String(error)}</div></div>}

      {data && (
        <>
          <div className="card">
            <h3>Profile</h3>
            <div className="row" style={{flexWrap:'wrap'}}>
              <Pill>ID: {data.user?.id}</Pill>
              <Pill>Username: {data.user?.username}</Pill>
              <Pill>Employee #: {data.user?.employee_number || '—'}</Pill>
              <Pill>Role: {data.user?.role}</Pill>
              <Pill>Branch: {typeof data.user?.employee_branch === 'object' ? (data.user.employee_branch?.name ?? data.user.employee_branch?.id ?? '—') : (data.user?.employee_branch ?? '—')}</Pill>
              <Pill>Position: {typeof data.user?.position === 'object' ? (data.user.position?.name ?? data.user.position?.id ?? '—') : (data.user?.position ?? '—')}</Pill>
            </div>
          </div>

          <div className="card-grid">
            <div className="card">
              <h3>Totals</h3>
              <div className="row" style={{alignItems:'center', gap:12}}>
                <span className={`dot ${levelColor}`} />
                <div className="metric">{data.totals?.competency_level || 'CL0'}</div>
              </div>
              <div className="helper">Total Points: {data.totals?.total_points ?? 0}</div>
              {data.totals?.min_required_level && (
                <div className="helper">Min Required: {data.totals.min_required_level} {data.totals?.below_min_level ? '(below)' : ''}</div>
              )}
            </div>
            <div className="card">
              <h3>Sessions by Status</h3>
              {data.sessions_by_status?.length ? (
                <table className="table"><thead><tr><th>Status</th><th>Count</th></tr></thead><tbody>
                  {data.sessions_by_status.map((s, idx) => (
                    <tr key={s.status + '_' + idx}><td>{s.status}</td><td>{s.count}</td></tr>
                  ))}
                </tbody></table>
              ) : <div className="helper">No sessions</div>}
            </div>
            <div className="card">
              <h3>Records by Status</h3>
              {data.records_by_status?.length ? (
                <table className="table"><thead><tr><th>Status</th><th>Count</th></tr></thead><tbody>
                  {data.records_by_status.map((r, idx) => (
                    <tr key={r.status + '_' + idx}><td>{r.status}</td><td>{r.count}</td></tr>
                  ))}
                </tbody></table>
              ) : <div className="helper">No records</div>}
            </div>
          </div>

          {Boolean((data.missing_competencies || []).length) && (
            <div className="card">
              <h3>Missing Required Competencies</h3>
              <table className="table">
                <thead><tr><th>Title</th><th>Ref</th></tr></thead>
                <tbody>
                  {(data.missing_competencies || []).map((m) => (
                    <tr key={m.id}><td>{m.title}</td><td>{m.reference_number || '—'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="card">
            <div className="row" style={{justifyContent:'space-between'}}>
              <h3>Competency Records</h3>
              <button className="btn" onClick={exportRecordsCSV}>Export CSV</button>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Competency</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Score</th>
                  <th>Points</th>
                </tr>
              </thead>
              <tbody>
                {(data.records || []).map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{typeof r.competency === 'object' ? (r.competency?.title ?? r.competency?.id ?? '—') : (r.competency ?? '—')}</td>
                    <td>{r.status}</td>
                    <td>{r.date_completed || '—'}</td>
                    <td>{r.score ?? '—'}</td>
                    <td>{r.points_earned ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="row" style={{justifyContent:'space-between'}}>
              <h3>Exam Sessions</h3>
              <button className="btn" onClick={exportSessionsCSV}>Export CSV</button>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Exam</th>
                  <th>Status</th>
                  <th>Started</th>
                  <th>Submitted</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {(data.sessions || []).map((s) => (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>{typeof s.exam === 'object' ? (s.exam?.title ?? s.exam?.id ?? '—') : (s.exam ?? '—')}</td>
                    <td>{s.status}</td>
                    <td>{s.started_at}</td>
                    <td>{s.submitted_at || '—'}</td>
                    <td>{s.score ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
