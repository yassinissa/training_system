import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client.js'
import { useAuth } from '../hooks/auth-context.jsx'

// Backend base URL for opening exam pages
const backendBase = "http://localhost:8000";

function StatCard({ title, value, hint, progress }) {
  const pct = typeof progress === 'number' ? Math.max(0, Math.min(progress, 100)) : null
  return (
    <div className="card">
      <h3>{title}</h3>
      <div className="metric">{value}</div>
      {hint && <div className="helper">{hint}</div>}
      {pct !== null && (
        <div style={{marginTop:8, height:8, background:'rgba(255,255,255,0.08)', borderRadius:999}}>
          <div style={{height:'100%', width:`${pct}%`, background:'#5b8cff', borderRadius:999}} />
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  const meta = {
    NOT_STARTED: { label: 'Not started', bg: 'rgba(255,255,255,0.05)', color: '#8ea0c0' },
    IN_PROGRESS: { label: 'In progress', bg: 'rgba(91,140,255,0.15)', color: '#9fc1ff' },
    PASSED: { label: 'Passed', bg: 'rgba(25,195,125,0.18)', color: '#7fefc0' },
    FAILED: { label: 'Failed', bg: 'rgba(239,68,68,0.18)', color: '#ffc2c2' },
    RETRAIN: { label: 'Retrain', bg: 'rgba(245,165,36,0.2)', color: '#ffd79a' },
    SUBMITTED: { label: 'Submitted', bg: 'rgba(91,140,255,0.14)', color: '#b6cbff' },
    GRADED: { label: 'Graded', bg: 'rgba(25,195,125,0.18)', color: '#7fefc0' },
    EXPIRED: { label: 'Expired', bg: 'rgba(239,68,68,0.18)', color: '#ffc2c2' },
  }[status] || { label: status || 'Unknown', bg: 'rgba(255,255,255,0.08)', color: '#e8eeff' }
  return <span className="pill" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Summary (unchanged)
  const [summary, setSummary] = useState(null)
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [error, setError] = useState('')

  // Employee-specific data
  const [reqs, setReqs] = useState([])
  const [recordsMap, setRecordsMap] = useState({})
  const [examsByComp, setExamsByComp] = useState({})
  const [sessions, setSessions] = useState([])
  const [sessionStatusFilter, setSessionStatusFilter] = useState('ALL')
  const [sessionSearch, setSessionSearch] = useState('')
  const [empLoading, setEmpLoading] = useState(false)
  const [activeComp, setActiveComp] = useState(null)

  const role = user?.role
  const isEmployee = role === 'EMPLOYEE'

  // Early return for admin/manager: show a simple admin/manager dashboard or redirect
  if (role === 'ADMIN') {
    return (
      <div className="container">
        <h1>Admin Dashboard</h1>
        {/* You can add more admin-specific content here */}
      </div>
    );
  }
  if (role === 'MANAGER') {
    return (
      <div className="container">
        <h1>Manager Dashboard</h1>
        {/* You can add more manager-specific content here */}
      </div>
    );
  }

  useEffect(() => {
    let mounted = true
    setLoadingSummary(true)
    api.get('/training/dashboard/summary/')
      .then(({ data }) => { if (mounted) setSummary(data) })
      .catch((err) => setError(err?.response?.data || 'Failed to load'))
      .finally(() => mounted && setLoadingSummary(false))
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!isEmployee || !user?.id) return
    let mounted = true
    const load = async () => {
      setEmpLoading(true)
      setError('')
      try {
        const posId = user?.position?.id
        const branchId = user?.employee_branch_id ?? user?.employee_branch?.id
        const qs = new URLSearchParams()
        if (posId) qs.append('position', posId)
        if (branchId) qs.append('branch', branchId)

        const [posReqRes, empReqRes, recordsRes, examsRes, sessionsRes] = await Promise.all([
          api.get(`/training/position-requirements/list/${qs.toString() ? `?${qs.toString()}` : ''}`),
          api.get(`/training/employee/requirements/?employee_id=${user.id}`),
          api.get('/training/my-competencies/'),
          api.get('/training/exams/list/'),
          api.get('/training/exam/sessions/'),
        ])

        const normalizeReq = (r, source) => ({
          id: r.id,
          source,
          competency: r.competency,
          branch: r.branch,
          position: r.position,
          frequency: r.frequency || r.competency?.frequency,
          priority_points: r.priority_points ?? r.competency?.priority_points ?? 0,
          required: r.required,
        })

        const merged = {}
        ;(empReqRes.data?.results || []).forEach((r) => {
          const compId = r?.competency?.id
          if (compId) merged[compId] = normalizeReq(r, 'employee')
        })
        ;(posReqRes.data || []).forEach((r) => {
          const compId = r?.competency?.id
          if (compId && !merged[compId]) merged[compId] = normalizeReq(r, 'position')
        })
        if (mounted) setReqs(Object.values(merged))

        const recMap = {}
        ;(recordsRes.data || []).forEach((rec) => {
          const compId = rec?.competency?.id
          if (compId) recMap[compId] = rec
        })
        if (mounted) setRecordsMap(recMap)

        const examsMap = {}
        ;(examsRes.data || []).forEach((exam) => {
          const compId = typeof exam?.competency === 'object' ? exam.competency?.id : exam?.competency
          if (!compId) return
          examsMap[compId] = examsMap[compId] || []
          examsMap[compId].push(exam)
        })
        if (mounted) setExamsByComp(examsMap)

        if (mounted) setSessions(sessionsRes.data || [])
      } catch (e) {
        if (mounted) setError(e?.response?.data || 'Failed to load employee dashboard')
      } finally {
        if (mounted) setEmpLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [isEmployee, user?.id, user?.position?.id, user?.employee_branch_id, user?.employee_branch])

  const title = useMemo(() => {
    if (role === 'ADMIN') return 'Admin Dashboard'
    if (role === 'MANAGER') return 'Manager Dashboard'
    return 'Employee Dashboard'
  }, [role])

  const computeExpiry = (completedIso, freq) => {
    if (!completedIso || freq !== 'YEARLY') return { expiryDate: null, daysRemaining: null }
    const completed = new Date(completedIso)
    if (Number.isNaN(completed.getTime())) return { expiryDate: null, daysRemaining: null }
    const expiry = new Date(completed)
    expiry.setDate(expiry.getDate() + 365)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const daysRemaining = Math.floor((expiry - today) / (1000 * 60 * 60 * 24))
    return { expiryDate: expiry.toISOString(), daysRemaining }
  }

  const requiredRows = useMemo(() => {
    return (reqs || []).map((r) => {
      const comp = r.competency || {}
      const compId = comp.id
      const record = compId ? recordsMap[compId] : null
      const exams = compId ? examsByComp[compId] || [] : []
      const primaryExam = exams[0]
      const { expiryDate, daysRemaining } = computeExpiry(record?.date_completed, r.frequency || comp.frequency)
      return {
        ...r,
        comp,
        compId,
        record,
        exams,
        primaryExam,
        expiryDate,
        daysRemaining,
      }
    }).sort((a, b) => (b.priority_points || 0) - (a.priority_points || 0))
  }, [reqs, recordsMap, examsByComp])

  const compliance = useMemo(() => {
    const total = requiredRows.length
    const passed = requiredRows.filter((r) => r.record?.status === 'PASSED').length
    const pct = total ? Math.round((passed / total) * 100) : 0
    return { total, passed, pct }
  }, [requiredRows])

  const renderAttachmentLinks = (comp) => {
    if (!comp) return null
    const toUrl = (u) => {
      if (!u) return null
      if (u.startsWith('http://') || u.startsWith('https://')) return u
      return `${mediaBase}${u}`
    }
    const links = []
    const pdfUrl = toUrl(comp.pdf_file)
    const imgUrl = toUrl(comp.image)
    if (pdfUrl) links.push(<a key="pdf" href={pdfUrl} target="_blank" rel="noreferrer">Open PDF</a>)
    if (imgUrl) links.push(<a key="img" href={imgUrl} target="_blank" rel="noreferrer">Open image</a>)
    if (comp.external_link) links.push(<a key="ext" href={comp.external_link} target="_blank" rel="noreferrer">External link</a>)
    return links.length ? <div className="row" style={{gap:10, flexWrap:'wrap'}}>{links}</div> : <span className="helper">No attachments</span>
  }

  const formatDate = (iso) => {
    if (!iso) return '—'
    try { return new Date(iso).toLocaleString() } catch { return '—' }
  }

  const sessionCompetencyTitle = (s) => {
    const compVal = s?.exam?.competency
    if (compVal && typeof compVal === 'object') return compVal.title || '—'
    const match = requiredRows.find((r) => r.compId === compVal)
    return match?.comp?.title || '—'
  }

  const exportSessionsCsv = () => {
    const headers = ['Exam', 'Competency', 'Status', 'Score', 'Max Score', 'Started']
    const rows = filteredSessions.map((s) => ([
      s.exam?.title || '',
      sessionCompetencyTitle(s) || '',
      s.status || '',
      s.score ?? '',
      s.max_score ?? '',
      s.started_at || '',
    ]))
    const csv = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'sessions.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const renderExpiryPill = (row) => {
    const { daysRemaining } = row
    if (daysRemaining === null) return <span className="pill" style={{background:'rgba(255,255,255,0.05)', color:'#cfd8ea'}}>No expiry</span>
    if (daysRemaining < 0) return <span className="pill" style={{background:'rgba(239,68,68,0.18)', color:'#ffc2c2'}}>Overdue {Math.abs(daysRemaining)}d</span>
    if (daysRemaining <= 30) return <span className="pill" style={{background:'rgba(245,165,36,0.2)', color:'#ffd79a'}}>Due {daysRemaining}d</span>
    return <span className="pill" style={{background:'rgba(91,140,255,0.14)', color:'#b6cbff'}}>In {daysRemaining}d</span>
  }

  const nextExpiring = useMemo(() => {
    const candidates = requiredRows
      .filter((r) => r.expiryDate && r.daysRemaining !== null)
      .sort((a, b) => (a.daysRemaining ?? 99999) - (b.daysRemaining ?? 99999))
    return candidates[0] || null
  }, [requiredRows])

  const topPriorityExam = useMemo(() => {
    const candidates = requiredRows
      .filter((r) => r.primaryExam)
      .sort((a, b) => (b.priority_points || 0) - (a.priority_points || 0))
    return candidates[0] || null
  }, [requiredRows])

  const filteredSessions = useMemo(() => {
    const term = sessionSearch.trim().toLowerCase()
    return (sessions || []).filter((s) => {
      if (sessionStatusFilter !== 'ALL' && s.status !== sessionStatusFilter) return false
      if (!term) return true
      const examTitle = s.exam?.title || ''
      const compTitle = sessionCompetencyTitle(s) || ''
      return `${examTitle} ${compTitle}`.toLowerCase().includes(term)
    })
  }, [sessions, sessionStatusFilter, sessionSearch, requiredRows])

  const closeActiveComp = () => setActiveComp(null)

  const renderActiveCompOverlay = () => {
    if (!activeComp) return null
    const comp = activeComp.comp || {}
    return (
      <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', display:'flex', justifyContent:'center', alignItems:'center', padding:12, zIndex:2000}}>
        <div
          className="card"
          style={{
            width:'100%',
            maxWidth:1100,
            maxHeight:'92vh',
            overflow:'auto',
            padding:20,
            display:'grid',
            gap:12,
            gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))',
          }}
        >
          <div style={{display:'grid', gap:12}}>
            <div className="row" style={{justifyContent:'space-between', alignItems:'center', gap:8, flexWrap:'wrap'}}>
              <strong style={{fontSize:18}}>{comp.title || 'Competency'}</strong>
              <button className="btn" style={{width:'auto'}} onClick={closeActiveComp}>Close</button>
            </div>
            <div className="row" style={{gap:8, flexWrap:'wrap'}}>
              <span className="pill">{comp.competency_area || 'General'}</span>
              <span className="pill">{comp.brand || 'All brands'}</span>
              <span className="pill">{activeComp.frequency || comp.frequency || 'No frequency'}</span>
              {activeComp.priority_points != null && <span className="pill">{activeComp.priority_points} pts</span>}
            </div>
            {comp.description && (
              <div>
                <div className="helper" style={{opacity:0.8, marginBottom:4}}>Overview</div>
                <div style={{whiteSpace:'pre-wrap', lineHeight:1.5}}>{comp.description}</div>
              </div>
            )}
            {comp.content && (
              <div>
                <div className="helper" style={{opacity:0.8, marginBottom:4}}>What to know</div>
                <div style={{whiteSpace:'pre-wrap', lineHeight:1.5}}>{comp.content}</div>
              </div>
            )}
            {!comp.description && !comp.content && (
              <div className="helper">No description provided.</div>
            )}
          </div>

          <div className="frame" style={{display:'grid', gap:10}}>
            <div className="row" style={{justifyContent:'space-between', alignItems:'center', gap:8, flexWrap:'wrap'}}>
              <strong>Materials</strong>
              <span className="pill">Study space</span>
            </div>
            {renderAttachmentLinks(comp)}
            {activeComp.primaryExam ? (
              <div className="row" style={{gap:8, flexWrap:'wrap'}}>
                <button className="btn primary" style={{width:'100%'}} onClick={() => navigate(`/web/exams/exam/${activeComp.primaryExam.id}`)}>Open exam page</button>
              </div>
            ) : (
              <div className="helper">Exam not published yet.</div>
            )}
            <div className="frame" style={{background:'rgba(255,255,255,0.03)'}}>
              <div className="helper">Status</div>
              <div className="row" style={{gap:8, alignItems:'center', flexWrap:'wrap'}}>
                <StatusBadge status={activeComp.record?.status || 'NOT_STARTED'} />
                {activeComp.daysRemaining !== null && <span className="pill">{activeComp.daysRemaining < 0 ? `${Math.abs(activeComp.daysRemaining)}d overdue` : `${activeComp.daysRemaining}d left`}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="row" style={{justifyContent:'space-between'}}>
        <div className="row" style={{alignItems:'center', gap:12}}>
          <button className="btn" onClick={() => window.history.back()}>Back</button>
          <h1 style={{margin:0}}>{title}</h1>
        </div>
        <span className="pill">Signed in as {user?.username || user?.employee_number}</span>
      </div>

      <div className="spacer" />

      {(loadingSummary || empLoading) && <div className="card">Loading…</div>}
      {error && <div className="card"><div className="error">{String(error)}</div></div>}
      {!loadingSummary && !empLoading && !error && !summary && (
        <div className="card"><div className="helper">No dashboard data available yet.</div></div>
      )}

      {summary && (role === 'ADMIN' || role === 'MANAGER') && (
        <div className="card-grid">
          <StatCard title="Active Exams" value={summary.exams_active_count ?? 0} />
          <StatCard title="Competencies" value={summary.competencies_count ?? 0} />
          <StatCard title="Sessions" value={summary.sessions_by_status?.reduce((a, b) => a + (b.count || 0), 0) ?? 0} hint="All statuses" />
          <StatCard title="Records" value={summary.records_by_status?.reduce((a, b) => a + (b.count || 0), 0) ?? 0} hint="All statuses" />

          <div className="card">
            <h3>Sessions by status</h3>
            {summary.sessions_by_status?.length ? (
              <table className="table">
                <thead><tr><th>Status</th><th>Count</th></tr></thead>
                <tbody>
                  {summary.sessions_by_status.map((s) => (
                    <tr key={s.status}><td>{s.status}</td><td>{s.count}</td></tr>
                  ))}
                </tbody>
              </table>
            ) : <div className="helper">No sessions yet.</div>}
          </div>

          <div className="card">
            <h3>Records by status</h3>
            {summary.records_by_status?.length ? (
              <table className="table">
                <thead><tr><th>Status</th><th>Count</th></tr></thead>
                <tbody>
                  {summary.records_by_status.map((s) => (
                    <tr key={s.status}><td>{s.status}</td><td>{s.count}</td></tr>
                  ))}
                </tbody>
              </table>
            ) : <div className="helper">No competency records yet.</div>}
          </div>
        </div>
      )}

      {isEmployee && (
        <div className="card-grid">
          <StatCard title="Total Points" value={summary?.total_points ?? 0} />
          <StatCard title="Competency Level" value={summary?.competency_level ?? 'CL0'} />
          <StatCard
            title="Compliance"
            value={`${compliance.pct}%`}
            hint={`${compliance.passed}/${compliance.total} passed`}
            progress={compliance.pct}
          />

          <div className="card" style={{gridColumn:'1 / -1'}}>
            <h3 style={{marginTop:0}}>Reminders</h3>
            <div className="row" style={{gap:12, flexWrap:'wrap'}}>
              <div className="frame" style={{minWidth:260, flex:1}}>
                <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
                  <strong>Next expiring</strong>
                  {nextExpiring && nextExpiring.daysRemaining !== null && (
                    <span className="pill" style={{background:'rgba(245,165,36,0.2)', color:'#ffd79a'}}>
                      {nextExpiring.daysRemaining < 0 ? `${Math.abs(nextExpiring.daysRemaining)} days overdue` : `${nextExpiring.daysRemaining} days left`}
                    </span>
                  )}
                </div>
                {nextExpiring ? (
                  <div style={{marginTop:6}}>
                    <div>{nextExpiring.comp?.title || 'Competency'}</div>
                    <div className="helper">
                      {nextExpiring.expiryDate ? `Expires on ${new Date(nextExpiring.expiryDate).toLocaleDateString()}` : 'Not completed yet'}
                    </div>
                    <div className="helper">Status: {nextExpiring.record?.status || 'NOT_STARTED'}</div>
                  </div>
                ) : (
                  <div className="helper">No expiring items detected.</div>
                )}
              </div>

              <div className="frame" style={{minWidth:260, flex:1}}>
                <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
                  <strong>Top priority exam</strong>
                  {topPriorityExam && <span className="pill">{topPriorityExam.priority_points ?? 0} pts</span>}
                </div>
                {topPriorityExam ? (
                  <div style={{marginTop:6}}>
                    <div>{topPriorityExam.comp?.title || 'Competency'}</div>
                    <div className="helper">Exam: {topPriorityExam.primaryExam?.title || 'Published exam'}</div>
                    <div className="row" style={{gap:8, marginTop:6, flexWrap:'wrap'}}>
                      <button className="btn primary" onClick={() => navigate(`/web/exams/exam/${topPriorityExam.primaryExam.id}`)}>Open exam</button>
                    </div>
                  </div>
                ) : (
                  <div className="helper">No published exams yet.</div>
                )}
              </div>
            </div>
          </div>

          <div className="card" style={{gridColumn:'1 / -1'}}>
            <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
              <h3 style={{margin:0}}>Required Competencies</h3>
              <span className="helper">Branch/position filtered</span>
            </div>
            {requiredRows.length === 0 ? (
              <div className="helper">No requirements found for your position/branch.</div>
            ) : (
              <div className="scroll-x">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Title</th>
                      <th>Frequency</th>
                      <th>Priority</th>
                      <th>Expiry</th>
                      <th>Requires Exam</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requiredRows.map((row) => (
                      <Fragment key={row.compId}>
                        <tr>
                          <td>{row.comp?.reference_number || '—'}</td>
                          <td>{row.comp?.title || '—'}</td>
                          <td>{row.frequency || row.comp?.frequency || '—'}</td>
                          <td>{row.priority_points ?? 0}</td>
                          <td>{renderExpiryPill(row)}</td>
                          <td>{row.comp?.requires_exam ? 'Yes' : 'No'}</td>
                          <td><StatusBadge status={row.record?.status || 'NOT_STARTED'} /></td>
                          <td>
                            <div className="row" style={{gap:8, flexWrap:'wrap'}}>
                              <button className="btn" onClick={() => setActiveComp(row)}>Open</button>
                              {row.primaryExam && (
                                <>
                                  <button className="btn" onClick={() => navigate(`/employee/exams/${row.primaryExam.id}/questions`)}>View Questions</button>
                                  {(() => {
                                    const status = row.record?.status
                                    const dueSoon = row.daysRemaining !== null && row.daysRemaining <= 30
                                    const overdue = row.daysRemaining !== null && row.daysRemaining < 0
                                    const canRenew = status !== 'PASSED' || dueSoon || overdue
                                    if (!canRenew) {
                                      return <span className="helper">Up to date</span>
                                    }
                                    const label = status === 'PASSED' ? 'Renew Exam' : 'Take Exam'
                                    return (
                                      <button className="btn primary" onClick={() => navigate(`/web/exams/exam/${row.primaryExam.id}`)}>{label}</button>
                                    )
                                  })()}
                                </>
                              )}
                              {!row.primaryExam && row.comp?.requires_exam && (
                                <span className="helper">Requires exam – awaiting publish</span>
                              )}
                              {!row.comp?.requires_exam && !row.primaryExam && (
                                <span className="helper">No exam required</span>
                              )}
                            </div>
                          </td>
                        </tr>
                        {/* Detail panel handled by activeComp overlay */}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card" style={{gridColumn:'1 / -1'}}>
            <div className="row" style={{justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10}}>
              <h3 style={{marginTop:0, marginBottom:0}}>Recent Sessions</h3>
              <div className="row" style={{gap:8, flexWrap:'wrap'}}>
                <input
                  value={sessionSearch}
                  onChange={(e) => setSessionSearch(e.target.value)}
                  placeholder="Search exam or competency"
                  style={{minWidth:220}}
                />
                <select value={sessionStatusFilter} onChange={(e) => setSessionStatusFilter(e.target.value)}>
                  <option value="ALL">All statuses</option>
                  <option value="IN_PROGRESS">In progress</option>
                  <option value="SUBMITTED">Submitted</option>
                  <option value="GRADED">Graded</option>
                  <option value="FAILED">Failed</option>
                  <option value="EXPIRED">Expired</option>
                </select>
                <button className="btn" onClick={exportSessionsCsv}>Export CSV</button>
              </div>
            </div>

            <div className="helper">{filteredSessions.length} of {sessions.length} shown</div>

            {filteredSessions.length === 0 ? (
              <div className="helper">No sessions match your filters.</div>
            ) : (
              <div className="scroll-x">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Exam</th>
                      <th>Competency</th>
                      <th>Status</th>
                      <th>Score</th>
                      <th>Started</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSessions.map((s) => (
                      <tr key={s.id}>
                        <td>{s.exam?.title || '—'}</td>
                        <td>{sessionCompetencyTitle(s)}</td>
                        <td><StatusBadge status={s.status} /></td>
                        <td>{(s.score ?? '-')}{s.max_score ? ` / ${s.max_score}` : ''}</td>
                        <td>{formatDate(s.started_at)}</td>
                        <td>
                          {s.status === 'IN_PROGRESS' && (
                            <button className="btn primary" onClick={() => navigate(`/web/exams/exam/${s.exam?.id}`)}>Resume</button>
                          )}
                          {(s.status === 'SUBMITTED' || s.status === 'GRADED') && (
                            <button className="btn" onClick={() => navigate(`/web/exams/exam/result/${s.id}`)}>View Result</button>
                          )}
                          {s.status === 'EXPIRED' && <span className="helper">Expired</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      {renderActiveCompOverlay()}
    </div>
  )
}
