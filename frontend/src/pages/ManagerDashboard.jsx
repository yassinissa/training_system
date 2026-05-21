import { useEffect, useMemo, useState } from 'react';
import Modal from '../components/Modal.jsx';
import { useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import Tabs from '../components/Tabs.jsx';
import DataState from '../components/DataState.jsx';
import { useAuth } from '../hooks/auth-context.jsx';
import { useToast } from '../hooks/useToast.jsx';


export default function ManagerDashboard() {
    // Finalize grading for the session
    const finalizeSessionGrade = async (sessionId) => {
      setGradingLoading(true);
      setGradingError('');
      try {
        // Persist every answer's points to the backend BEFORE asking the
        // server to compute the final score. Without this step, the final
        // score is 0 because the answer rows still have points_awarded=NULL.
        for (const a of gradingAnswers) {
          const ok = await submitAnswerGrade(a.id, a.points_awarded, a.manager_comment);
          if (!ok) { setGradingLoading(false); return; }
        }
        await gradeSession(sessionId);
        setGradingSession(null);
        setGradingAnswers([]);
        loadQueueOnly();
        success('Session graded');
      } catch (e) {
        setGradingError(toMessage(e?.response?.data, 'Failed to finalize grading'));
        toastError('Failed to finalize grading');
      } finally {
        setGradingLoading(false);
      }
    };
  const navigate = useNavigate()
  const [gradingSession, setGradingSession] = useState(null);
  const [gradingAnswers, setGradingAnswers] = useState([]);
  const [gradingLoading, setGradingLoading] = useState(false);
  const [gradingError, setGradingError] = useState('');

  // Fetch answers for a session for grading
  const openGradingModal = async (sessionId) => {
    setGradingSession({ id: sessionId });
    setGradingLoading(true);
    setGradingError('');
    try {
      const res = await api.get(`/training/exam/sessions/${sessionId}/`);
      setGradingSession(res.data);
      setGradingAnswers(res.data.answers.map(a => ({ ...a, points_awarded: a.points_awarded ?? '' })));
    } catch (e) {
      setGradingError(toMessage(e?.response?.data, 'Failed to load answers'));
    } finally {
      setGradingLoading(false);
    }
  };
  const { user, setUser } = useAuth()
  const { success, error: toastError } = useToast()

  const frequencyOptions = ['ONE_TIME', 'YEARLY', 'NEW_HIRE', 'PROMOTION', 'OTHER']

  const toMessage = (val, fallback) => {
    if (!val) return fallback
    if (typeof val === 'string') {
      // Django's debug 500 page is HTML; try to extract the exception line
      const exMatch = val.match(/<pre class="exception_value">([\s\S]*?)<\/pre>/i)
      if (exMatch) return exMatch[1].replace(/&#x27;/g, "'").replace(/&quot;/g, '"').trim()
      if (/<html|<!doctype/i.test(val)) return fallback + ' (server error - check Django console)'
      return val
    }
    if (val?.detail) return String(val.detail)
    try { return JSON.stringify(val) } catch { return fallback }
  }

  const normalizeUrl = (val) => {
    const v = (val || '').trim()
    if (!v) return ''
    if (/^https?:\/\//i.test(v)) return v
    return `https://${v}`
  } 

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [branches, setBranches] = useState([])
  const [positions, setPositions] = useState([])
  const [competencies, setCompetencies] = useState([])
  const [requirements, setRequirements] = useState([])
  const [exams, setExams] = useState([])
  const [gradingQueue, setGradingQueue] = useState([])
  const [sessions, setSessions] = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [expiringSoon, setExpiringSoon] = useState([])
  const [overdue, setOverdue] = useState([])
  const [levelDeficient, setLevelDeficient] = useState([])
  const [levelDeficientLoading, setLevelDeficientLoading] = useState(false)

  const [publishForm, setPublishForm] = useState({ branch: '', competency: '', positions: [], frequency: '', priority_points: '', required: true })
  const [reqForm, setReqForm] = useState({ branch: '', position: '', competency: '', frequency: '', priority_points: '', required: true })
  const [reqEdits, setReqEdits] = useState({})
  const [compForm, setCompForm] = useState({ reference_number: '', title: '', frequency: 'ONE_TIME', priority_points: 0, requires_exam: false, duration: '', competency_area: '', brand: '', external_link: '', description: '', content: '', imageFile: null, pdfFile: null })
  const [assignForm, setAssignForm] = useState({ employee_number: '', branch: '', competency: '', frequency: '', priority_points: '', required: true })
  const [assignEmployee, setAssignEmployee] = useState(null)
  const [examForm, setExamForm] = useState({ title: '', description: '', competency: '', position: '', time_limit_minutes: '', is_active: true, branches: [] })
  const [promotionForm, setPromotionForm] = useState({ position_id: '' })

  const [empForm, setEmpForm] = useState({ employee_number: '', username: '', password: '', position: '', branch: '' })
  const [sessionFilters, setSessionFilters] = useState({ branch: '', status: '' })
  const [lookupNumber, setLookupNumber] = useState('')
  const [lookupResult, setLookupResult] = useState(null)

  const managerBranchIds = useMemo(() => {
    const detail = (user?.manager_branches_detail || []).map((b) => Number(b.id)).filter(Boolean)
    const flat = (user?.manager_branch_ids || []).map((b) => Number(b)).filter(Boolean)
    // Fallback: some manager users only carry employee_branch_id
    // (e.g. their own working branch), not manager_branches.
    const own = user?.employee_branch_id ? [Number(user.employee_branch_id)] : []
    return Array.from(new Set([...detail, ...flat, ...own])).filter(Boolean)
  }, [user])

  const managerBranches = useMemo(() => {
    if (!managerBranchIds.length) return []
    return (branches || []).filter((b) => managerBranchIds.includes(Number(b.id)))
  }, [branches, managerBranchIds])

  useEffect(() => {
    loadAll()
    // Refresh the cached user from the server so manager_branch_ids /
    // manager_branches_detail / employee_branch_id reflect the latest
    // backend state (older sessions may be missing these).
    api.get('/accounts/me/')
      .then((res) => { if (res?.data && setUser) setUser(res.data) })
      .catch(() => {})
    // setUser is stable from context; safe to omit from deps for one-shot fetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { fetchLevelDeficient() }, [])

  const loadAll = async () => {
    setLoading(true)
    setError('')
    try {
      const [bRes, pRes, cRes, reqRes, exRes, queueRes, expRes] = await Promise.all([
        api.get('/branches/'),
        api.get('/positions/'),
        api.get('/training/competencies/'),
        api.get('/training/position-requirements/list/'),
        api.get('/training/exams/list/'),
        api.get('/training/exam/grading-queue/'),
        api.get('/training/expiring/'),
      ])
      setBranches(bRes.data || [])
      setPositions(pRes.data || [])
      setCompetencies(cRes.data || [])
      setRequirements(reqRes.data || [])
      setExams(exRes.data || [])
      setGradingQueue(queueRes.data?.results || queueRes.data || [])
      setExpiringSoon(expRes.data?.expiring || [])
      setOverdue(expRes.data?.overdue || [])
      fetchSessions(sessionFilters)
    } catch (e) {
      setError(toMessage(e?.response?.data, 'Failed to load manager data'))
      toastError('Failed to load manager data')
    } finally {
      setLoading(false)
    }
  }

  const fetchLevelDeficient = async () => {
    setLevelDeficientLoading(true)
    try {
      const res = await api.get('/training/reports/level-deficient/')
      setLevelDeficient(res.data?.results || [])
    } catch (e) {
      toastError(toMessage(e?.response?.data, 'Failed to load level-deficient list'))
    } finally {
      setLevelDeficientLoading(false)
    }
  }

  const publishRequirements = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const payload = {
        branch_id: publishForm.branch ? Number(publishForm.branch) : null,
        competency_id: publishForm.competency ? Number(publishForm.competency) : null,
        position_ids: (publishForm.positions || []).filter(Boolean).map((p) => Number(p)),
        frequency: publishForm.frequency || undefined,
        priority_points: publishForm.priority_points === '' ? undefined : Number(publishForm.priority_points),
        required: publishForm.required,
      }
      await api.post('/training/requirements/publish/', payload)
      success('Requirements published')
      loadAll()
    } catch (e) {
      setError(toMessage(e?.response?.data, 'Failed to publish requirements'))
      toastError('Failed to publish requirements')
    }
  }

  const createRequirement = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const payload = {
        branch_id: reqForm.branch ? Number(reqForm.branch) : null,
        position_id: reqForm.position ? Number(reqForm.position) : null,
        competency_id: reqForm.competency ? Number(reqForm.competency) : null,
        frequency: reqForm.frequency || undefined,
        priority_points: reqForm.priority_points === '' ? undefined : Number(reqForm.priority_points || 0),
        required: reqForm.required,
      }
      await api.post('/training/position-requirements/', payload)
      success('Requirement added')
      setReqForm({ branch: '', position: '', competency: '', frequency: '', priority_points: '', required: true })
      loadAll()
    } catch (e) {
      setError(toMessage(e?.response?.data, 'Failed to add requirement'))
      toastError('Failed to add requirement')
    }
  }

  const updateRequirement = async (reqId, changes) => {
    setError('')
    try {
      await api.patch(`/training/position-requirements/${reqId}/`, changes)
      success('Requirement updated')
      setReqEdits((prev) => { const next = { ...prev }; delete next[reqId]; return next })
      loadAll()
    } catch (e) {
      setError(toMessage(e?.response?.data, 'Failed to update requirement'))
      toastError('Failed to update requirement')
    }
  }

  const deleteRequirement = async (reqId) => {
    setError('')
    try {
      await api.delete(`/training/position-requirements/${reqId}/`)
      success('Requirement removed')
      loadAll()
    } catch (e) {
      setError(toMessage(e?.response?.data, 'Failed to delete requirement'))
      toastError('Failed to delete requirement')
    }
  }

  const createCompetency = async (e) => {
    e.preventDefault()
    setError('')

    // Required-field validation up front so we can show a clear message.
    const ref = (compForm.reference_number || '').trim()
    const title = (compForm.title || '').trim()
    if (!ref) {
      const msg = 'Reference number is required'
      setError(msg); toastError(msg); return
    }
    if (!title) {
      const msg = 'Title is required'
      setError(msg); toastError(msg); return
    }
    const points = Number(compForm.priority_points || 0)
    if (!Number.isFinite(points) || points < 0) {
      const msg = 'Priority points must be a non-negative number'
      setError(msg); toastError(msg); return
    }

    try {
      const fd = new FormData()
      const entries = {
        reference_number: ref,
        title: title,
        frequency: compForm.frequency || 'ONE_TIME',
        priority_points: points,
        requires_exam: !!compForm.requires_exam,
        duration: compForm.duration || '',
        competency_area: compForm.competency_area || '',
        brand: compForm.brand || '',
        external_link: normalizeUrl(compForm.external_link),
        description: compForm.description || '',
        content: compForm.content || '',
      }
      Object.entries(entries).forEach(([k, v]) => {
        // FormData -> serialize booleans/numbers as strings; skip empty
        if (v === '' || v === null || v === undefined) return
        fd.append(k, typeof v === 'boolean' ? (v ? 'true' : 'false') : v)
      })
      if (compForm.imageFile) fd.append('image', compForm.imageFile)
      if (compForm.pdfFile) fd.append('pdf_file', compForm.pdfFile)

      await api.post('/training/competencies/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      success('Competency created')
      setCompForm({ reference_number: '', title: '', frequency: 'ONE_TIME', priority_points: 0, requires_exam: false, duration: '', competency_area: '', brand: '', external_link: '', description: '', content: '', imageFile: null, pdfFile: null })
      loadAll()
    } catch (e) {
      // Surface the real backend reason (e.g. duplicate reference_number)
      const msg = toMessage(e?.response?.data, 'Failed to create competency')
      setError(msg)
      toastError(msg)
    }
  }

  const deleteCompetency = async (c) => {
    if (!c?.id) return
    if (!window.confirm(`Delete competency "${c.title}"? This cannot be undone.`)) return
    try {
      await api.delete(`/training/competencies/${c.id}/`)
      success('Competency deleted')
      loadAll()
    } catch (e) {
      const msg = toMessage(e?.response?.data, 'Failed to delete competency')
      setError(msg)
      toastError(msg)
    }
  }

  const assignCompetency = async (e) => {
    e.preventDefault()
    setError('')
    if (!assignEmployee?.id) {
      setError('Lookup an employee first')
      return
    }
    const employeeBranchId = assignEmployee?.employee_branch?.id || null
    if (!employeeBranchId) {
      setError('Employee has no branch set')
      return
    }
    try {
      const payload = {
        employee_id: assignEmployee.id,
        competency_id: assignForm.competency ? Number(assignForm.competency) : null,
        branch_id: employeeBranchId,
        frequency: assignForm.frequency || undefined,
        priority_points: assignForm.priority_points === '' ? undefined : Number(assignForm.priority_points || 0),
        required: assignForm.required,
      }
      await api.post('/training/employee/requirements/', payload)
      success('Competency assigned')
      setAssignForm((f) => ({ ...f, competency: '', frequency: '', priority_points: '' }))
      loadAll()
    } catch (e) {
      setError(toMessage(e?.response?.data, 'Failed to assign competency'))
      toastError('Failed to assign competency')
    }
  }

  const createExam = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const payload = {
        title: examForm.title,
        description: examForm.description || undefined,
        competency: examForm.competency ? Number(examForm.competency) : null,
        position: examForm.position ? Number(examForm.position) : null,
        time_limit_seconds: examForm.time_limit_minutes ? Math.max(1, Math.round(Number(examForm.time_limit_minutes) * 60)) : null,
        is_active: examForm.is_active,
        branch_ids: (examForm.branches || []).filter(Boolean).map(Number),
      }
      await api.post('/training/exams/', payload)
      success('Exam created')
      setExamForm({ title: '', description: '', competency: '', position: '', time_limit_minutes: '', is_active: true, branches: [] })
      loadAll()
    } catch (e) {
      setError(toMessage(e?.response?.data, 'Failed to create exam'))
      toastError('Failed to create exam')
    }
  }

  const promoteEmployee = async (e) => {
    e.preventDefault()
    if (!assignEmployee?.id) {
      setError('Lookup an employee first')
      return
    }
    setError('')
    try {
      const payload = {
        employee_id: assignEmployee.id,
        position_id: promotionForm.position_id ? Number(promotionForm.position_id) : null,
      }
      await api.post('/accounts/promote/', payload)
      success('Employee promoted')
      setPromotionForm({ position_id: '' })
      loadAll()
    } catch (e) {
      setError(toMessage(e?.response?.data, 'Failed to promote employee'))
      toastError('Failed to promote employee')
    }
  }

  const fetchSessions = async (filters = sessionFilters) => {
    setSessionsLoading(true)
    setError('')
    try {
      const q = new URLSearchParams()
      if (filters.branch) q.append('branch', filters.branch)
      if (filters.status) q.append('status', filters.status)
      const res = await api.get(`/training/exam/sessions/manage/${q.toString() ? `?${q.toString()}` : ''}`)
      const data = res.data
      setSessions(Array.isArray(data) ? data : data?.results || [])
    } catch (e) {
      setError(toMessage(e?.response?.data, 'Failed to load sessions'))
      toastError('Failed to load sessions')
    } finally {
      setSessionsLoading(false)
    }
  }

  const addEmployee = async (e) => {
    e.preventDefault()
    setError('')

    // If the manager has exactly one branch, use it automatically.
    // Otherwise require an explicit pick from the dropdown.
    const resolvedBranchId =
      empForm.branch
        ? Number(empForm.branch)
        : (managerBranches.length === 1 ? Number(managerBranches[0].id) : null)

    const employeeNumber = (empForm.employee_number || '').trim()
    if (!employeeNumber) {
      const msg = 'Employee number is required'
      setError(msg); toastError(msg); return
    }
    if (!resolvedBranchId) {
      const msg = 'Please select a branch'
      setError(msg); toastError(msg); return
    }
    if (!empForm.position) {
      const msg = 'Please select a position'
      setError(msg); toastError(msg); return
    }

    try {
      const payload = {
        username: (empForm.username || '').trim() || employeeNumber,
        password: empForm.password || employeeNumber,
        employee_number: employeeNumber,
        position: Number(empForm.position),
        employee_branch: resolvedBranchId,
      }
      await api.post('/register/employee/', payload)
      success('Employee created')
      setEmpForm({ employee_number: '', username: '', password: '', position: '', branch: '' })
    } catch (e) {
      // Surface the real backend error (duplicate employee number, etc.)
      const msg = toMessage(e?.response?.data, 'Failed to create employee')
      setError(msg)
      toastError(msg)
    }
  }

  const submitAnswerGrade = async (answerId, points, comment) => {
    // Persist a single answer's grade to the backend. Used by the per-row
    // "Save" button in the grading modal, AND batched by finalizeSessionGrade.
    if (points === '' || points === null || points === undefined) {
      toastError('Please enter points before saving');
      return false;
    }
    try {
      await api.post('/training/exam/answer/grade/', {
        answer_id: answerId,
        points_awarded: Number(points),
        manager_comment: comment || '',
      });
      return true;
    } catch (e) {
      const msg = toMessage(e?.response?.data, 'Failed to save grade');
      setGradingError(msg);
      toastError(msg);
      return false;
    }
  };

  const gradeSession = async (sessionId, status) => {
    try {
      await api.post(`/training/exam/grade/${sessionId}/`, status ? { status } : {})
      success('Session graded')
      fetchSessions()
      loadQueueOnly()
    } catch (e) {
      setError(toMessage(e?.response?.data, 'Failed to grade session'))
      toastError('Failed to grade session')
    }
  }

  const allowRetake = async (sessionId) => {
    if (!window.confirm('Allow this employee to retake the exam? The failed attempt will stay in history.')) return
    try {
      await api.post(`/training/exam/sessions/${sessionId}/allow-retake/`)
      success('Retake granted - employee can now retake the exam.')
      fetchSessions()
      // Also refresh the lookup view if the same employee is on screen.
      if (lookupNumber) {
        try {
          const res = await api.get(`/training/employee/activity/?employee_number=${encodeURIComponent(lookupNumber)}`)
          setLookupResult(res.data)
        } catch (_) { /* silent */ }
      }
    } catch (e) {
      const msg = toMessage(e?.response?.data, 'Failed to allow retake')
      setError(msg)
      toastError(msg)
    }
  }

  const loadQueueOnly = async () => {
    try {
      const res = await api.get('/training/exam/grading-queue/')
      setGradingQueue(res.data?.results || res.data || [])
    } catch (e) {
      // keep silent
    }
  }

  const lookupEmployee = async (e) => {
    e.preventDefault()
    setLookupResult(null)
    setError('')
    if (!lookupNumber) return
    try {
      const res = await api.get(`/training/employee/activity/?employee_number=${encodeURIComponent(lookupNumber)}`)
      setLookupResult(res.data)
      setAssignEmployee(res.data?.user || null)
      setAssignForm((f) => ({
        ...f,
        employee_number: lookupNumber,
      }))
    } catch (e) {
      setError(toMessage(e?.response?.data, 'Lookup failed'))
      toastError('Lookup failed')
    }
  }

  const filteredRequirements = useMemo(() => {
    if (!managerBranchIds.length) return requirements
    return (requirements || []).filter((r) => managerBranchIds.includes(Number(r.branch?.id || r.branch)))
  }, [requirements, managerBranchIds])

  const filteredGradingQueue = useMemo(() => {
    if (!managerBranchIds.length) return gradingQueue
    return (gradingQueue || []).filter((s) => managerBranchIds.includes(Number(s.branch?.id || s.branch)))
  }, [gradingQueue, managerBranchIds])

  const AddEmployeeTab = (
    <div className="card">
      <h3>Add Employee</h3>
      <form className="form" onSubmit={addEmployee} style={{ maxWidth: 520 }}>
        <div className="field">
          <label>Employee Number</label>
          <input value={empForm.employee_number} onChange={(e) => setEmpForm((f) => ({ ...f, employee_number: e.target.value }))} />
        </div>
        <div className="row">
          <input placeholder="Username (optional)" value={empForm.username} onChange={(e) => setEmpForm((f) => ({ ...f, username: e.target.value }))} />
          <input placeholder="Password (optional)" value={empForm.password} onChange={(e) => setEmpForm((f) => ({ ...f, password: e.target.value }))} />
        </div>
        <div className="row">
          <select value={empForm.position} onChange={(e) => setEmpForm((f) => ({ ...f, position: e.target.value }))}>
            <option value="">Select position</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {managerBranches.length > 1 ? (
            <select value={empForm.branch} onChange={(e) => setEmpForm((f) => ({ ...f, branch: e.target.value }))}>
              <option value="">Select branch</option>
              {managerBranches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          ) : (
            <span className="pill" title="Employee will be added to your branch">
              Branch: {managerBranches[0]?.name || '-'}
            </span>
          )}
        </div>
        <button className="btn primary">Create</button>
      </form>
    </div>
  )

  const RequirementsTab = (
    <div className="card">
      <h3>Requirements</h3>

      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <form className="card" onSubmit={publishRequirements} style={{ minWidth: 320, flex: 1 }}>
          <h4>Publish to Positions</h4>
          <div className="row" style={{ gap: 8 }}>
            <select value={publishForm.branch} onChange={(e) => setPublishForm((f) => ({ ...f, branch: e.target.value }))}>
              <option value="">Select branch</option>
              {managerBranches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select value={publishForm.competency} onChange={(e) => setPublishForm((f) => ({ ...f, competency: e.target.value }))}>
              <option value="">Select competency</option>
              {competencies.map((c) => <option key={c.id} value={c.id}>{c.reference_number} - {c.title}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Positions (multi)</label>
            <select multiple value={publishForm.positions} onChange={(e) => setPublishForm((f) => ({ ...f, positions: Array.from(e.target.selectedOptions).map((o) => o.value) }))}>
              {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <select value={publishForm.frequency} onChange={(e) => setPublishForm((f) => ({ ...f, frequency: e.target.value }))}>
              <option value="">Frequency (optional)</option>
              {frequencyOptions.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <input type="number" placeholder="Priority" value={publishForm.priority_points} onChange={(e) => setPublishForm((f) => ({ ...f, priority_points: e.target.value }))} />
          </div>
          <label className="row" style={{ gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={publishForm.required} onChange={(e) => setPublishForm((f) => ({ ...f, required: e.target.checked }))} />
            <span>Required</span>
          </label>
          <button className="btn primary" style={{ marginTop: 8 }}>Publish</button>
        </form>

      </div>

      <div className="scroll-x">
        <DataState
          loading={loading}
          error={error}
          isEmpty={!loading && (filteredRequirements || []).length === 0}
          emptyMessage="No requirements for your branches."
        >
          <table className="table">
            <thead><tr><th>Branch</th><th>Position</th><th>Competency</th><th>Frequency</th><th>Priority</th><th>Required</th><th>Actions</th></tr></thead>
            <tbody>
              {(filteredRequirements || []).map((r) => (
                <tr key={r.id}>
                  <td>{r.branch?.name || r.branch}</td>
                  <td>{r.position?.name || r.position}</td>
                  <td>{r.competency?.title || r.competency}</td>
                  <td>
                    <select value={(reqEdits[r.id]?.frequency ?? r.frequency) || ''} onChange={(e) => setReqEdits((prev) => ({ ...prev, [r.id]: { ...prev[r.id], frequency: e.target.value } }))}>
                      <option value="">—</option>
                      {frequencyOptions.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </td>
                  <td><input type="number" style={{ width: 90 }} value={reqEdits[r.id]?.priority_points ?? r.priority_points ?? ''} onChange={(e) => setReqEdits((prev) => ({ ...prev, [r.id]: { ...prev[r.id], priority_points: e.target.value } }))} /></td>
                  <td>
                    <label className="row" style={{ gap: 4, alignItems: 'center' }}>
                      <input type="checkbox" checked={reqEdits[r.id]?.required ?? r.required} onChange={(e) => setReqEdits((prev) => ({ ...prev, [r.id]: { ...prev[r.id], required: e.target.checked } }))} />
                      <span>{(reqEdits[r.id]?.required ?? r.required) ? 'Yes' : 'No'}</span>
                    </label>
                  </td>
                  <td>
                    <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                      <button
                        className="btn"
                        onClick={() => {
                          const draft = reqEdits[r.id] || {}
                          const payload = {}
                          if ('frequency' in draft) payload.frequency = draft.frequency || null
                          if ('priority_points' in draft) payload.priority_points = draft.priority_points === '' ? null : Number(draft.priority_points)
                          if ('required' in draft) payload.required = draft.required
                          if (!Object.keys(payload).length) return
                          updateRequirement(r.id, payload)
                        }}
                      >Save</button>
                      <button className="btn" onClick={() => deleteRequirement(r.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>
    </div>
  )

  const CompetenciesTab = (
    <div className="card">
      <h3>Competencies</h3>
      <form className="card" onSubmit={createCompetency} style={{ marginBottom: 12 }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input placeholder="Reference" value={compForm.reference_number} onChange={(e) => setCompForm((f) => ({ ...f, reference_number: e.target.value }))} />
          <input placeholder="Title" value={compForm.title} onChange={(e) => setCompForm((f) => ({ ...f, title: e.target.value }))} />
          <input placeholder="Duration" value={compForm.duration} onChange={(e) => setCompForm((f) => ({ ...f, duration: e.target.value }))} />
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <select value={compForm.frequency} onChange={(e) => setCompForm((f) => ({ ...f, frequency: e.target.value }))}>
            {frequencyOptions.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <input type="number" placeholder="Priority" value={compForm.priority_points} onChange={(e) => setCompForm((f) => ({ ...f, priority_points: e.target.value }))} />
          <label className="row" style={{ gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={compForm.requires_exam} onChange={(e) => setCompForm((f) => ({ ...f, requires_exam: e.target.checked }))} />
            <span>Requires Exam</span>
          </label>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input placeholder="Area" value={compForm.competency_area} onChange={(e) => setCompForm((f) => ({ ...f, competency_area: e.target.value }))} />
          <input placeholder="Brand" value={compForm.brand} onChange={(e) => setCompForm((f) => ({ ...f, brand: e.target.value }))} />
          <input placeholder="External link" value={compForm.external_link} onChange={(e) => setCompForm((f) => ({ ...f, external_link: e.target.value }))} />
        </div>
        <textarea placeholder="Description" value={compForm.description || ''} onChange={(e) => setCompForm((f) => ({ ...f, description: e.target.value }))} />
        <textarea placeholder="Content / notes" value={compForm.content || ''} onChange={(e) => setCompForm((f) => ({ ...f, content: e.target.value }))} />
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input type="file" accept="image/*" onChange={(e) => setCompForm((f) => ({ ...f, imageFile: e.target.files?.[0] || null }))} />
          <input type="file" accept="application/pdf" onChange={(e) => setCompForm((f) => ({ ...f, pdfFile: e.target.files?.[0] || null }))} />
        </div>
        <button className="btn primary" style={{ marginTop: 8 }}>Create Competency</button>
      </form>
      <div className="scroll-x">
        <DataState
          loading={loading}
          error={error}
          isEmpty={!loading && (competencies || []).length === 0}
          emptyMessage="No competencies found."
        >
          <table className="table">
            <thead><tr><th>Reference</th><th>Title</th><th>Frequency</th><th>Priority</th><th>Requires Exam</th><th>Actions</th></tr></thead>
            <tbody>
              {(competencies || []).map((c) => (
                <tr key={c.id}>
                  <td>{c.reference_number}</td>
                  <td>{c.title}</td>
                  <td>{c.frequency}</td>
                  <td>{c.priority_points}</td>
                  <td>{c.requires_exam ? 'Yes' : 'No'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button
                      className="btn"
                      onClick={() => navigate(`/manager/competencies/${c.id}/edit`)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn"
                      style={{ marginLeft: 6, background: '#dc2626', color: '#fff', borderColor: '#dc2626' }}
                      onClick={() => deleteCompetency(c)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>
    </div>
  )

  const ExamsTab = (
    <div className="card">
      <h3>Exams</h3>
      <form className="card" onSubmit={createExam} style={{ marginBottom: 12 }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input placeholder="Title" value={examForm.title} onChange={(e) => setExamForm((f) => ({ ...f, title: e.target.value }))} />
          <input placeholder="Time limit (minutes)" type="number" min="1" value={examForm.time_limit_minutes} onChange={(e) => setExamForm((f) => ({ ...f, time_limit_minutes: e.target.value }))} />
          <label className="row" style={{ gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={examForm.is_active} onChange={(e) => setExamForm((f) => ({ ...f, is_active: e.target.checked }))} />
            <span>Active</span>
          </label>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <select value={examForm.competency} onChange={(e) => setExamForm((f) => ({ ...f, competency: e.target.value, position: '' }))}>
            <option value="">Select competency</option>
            {competencies.map((c) => <option key={c.id} value={c.id}>{c.reference_number} - {c.title}</option>)}
          </select>
          <select value={examForm.position} onChange={(e) => setExamForm((f) => ({ ...f, position: e.target.value }))}>
            <option value="">Select position (optional)</option>
            {/* Position is informational metadata on the exam template -
                no need to gate it on having a published requirement yet. */}
            {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select multiple value={examForm.branches} onChange={e => setExamForm(f => ({ ...f, branches: Array.from(e.target.selectedOptions).map(o => o.value) }))}>
            <option value="" disabled>Select branches</option>
            {managerBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <textarea placeholder="Description" value={examForm.description} onChange={(e) => setExamForm((f) => ({ ...f, description: e.target.value }))} />
        <button className="btn primary" style={{ marginTop: 8 }}>Create Exam</button>
      </form>
      <div className="scroll-x">
        <DataState
          loading={loading}
          error={error}
          isEmpty={!loading && (exams || []).length === 0}
          emptyMessage="No exams yet."
        >
          <table className="table">
            <thead><tr><th>Title</th><th>Competency</th><th>Active</th><th>Action</th></tr></thead>
            <tbody>
              {(exams || []).map((ex) => (
                <tr key={ex.id}>
                  <td>{ex.title}</td>
                  <td>{typeof ex.competency === 'object' ? (ex.competency?.title ?? ex.competency?.id ?? '—') : (ex.competency ?? '—')}</td>
                  <td>{ex.is_active ? 'Yes' : 'No'}</td>
                  <td>
                    <button className="btn" onClick={() => navigate(`/manager/exams/${ex.id}/questions`)}>Manage</button>
                    <button className="btn" style={{marginLeft:8}} onClick={() => navigate(`/web/exams/exam/${ex.id}`)}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>
    </div>
  )

  const SessionsTab = (
    <div className="card">
      <div className="toolbar">
        <div className="left"><h3>Sessions</h3></div>
        <div className="right">
          <select value={sessionFilters.branch} onChange={(e) => { const next = { ...sessionFilters, branch: e.target.value }; setSessionFilters(next); fetchSessions(next) }}>
            <option value="">All branches</option>
            {managerBranches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
          </select>
          <select value={sessionFilters.status} onChange={(e) => { const next = { ...sessionFilters, status: e.target.value }; setSessionFilters(next); fetchSessions(next) }}>
            <option value="">All statuses</option>
            {['IN_PROGRESS','SUBMITTED','GRADED','EXPIRED'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="scroll-x">
        <DataState
          loading={sessionsLoading}
          error={error}
          isEmpty={!sessionsLoading && (sessions || []).length === 0}
          emptyMessage="No sessions for current filters."
        >
          <table className="table">
            <thead><tr><th>ID</th><th>Employee</th><th>Exam</th><th>Status</th><th>Result</th><th>Score</th><th>Started</th><th>Submitted</th><th>Action</th></tr></thead>
            <tbody>
              {(sessions || []).map((s) => {
                const pct = (s.status === 'GRADED' && s.max_score)
                  ? (Number(s.score || 0) / Number(s.max_score)) * 100 : null
                const isFailed = s.status === 'GRADED' && pct !== null && pct < 60
                const canRetake = isFailed && !s.retake_allowed
                return (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>{typeof s.employee === 'object' ? (s.employee?.username ?? s.employee?.employee_number ?? s.employee?.id ?? '—') : (s.employee ?? '—')}</td>
                    <td>{typeof s.exam === 'object' ? (s.exam?.title ?? s.exam?.id ?? '—') : (s.exam ?? '—')}</td>
                    <td>{s.status}</td>
                    <td>{pct === null ? '—' : (pct >= 60 ? 'Passed' : 'Failed')}</td>
                    <td>{s.score ?? '—'}{s.max_score ? ` / ${s.max_score}` : ''}</td>
                    <td>{s.started_at || '—'}</td>
                    <td>{s.submitted_at || '—'}</td>
                    <td>
                      {canRetake && (
                        <button className="btn primary" onClick={() => allowRetake(s.id)}>
                          Allow Retake
                        </button>
                      )}
                      {isFailed && s.retake_allowed && (
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>Retake granted</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </DataState>
      </div>
    </div>
  )

  const GradingQueueTab = (
    <div className="card">
      <div className="toolbar">
        <div className="left"><h3>Grading Queue</h3></div>
        <div className="right"><button className="btn" onClick={loadQueueOnly}>Refresh</button></div>
      </div>
      <div className="scroll-x">
        <DataState
          loading={loading}
          error={error}
          isEmpty={!loading && (filteredGradingQueue || []).length === 0}
          emptyMessage="Queue is empty."
        >
          <table className="table">
            <thead><tr><th>ID</th><th>Employee</th><th>Branch</th><th>Exam</th><th>Submitted</th><th>Type</th><th>Action</th></tr></thead>
            <tbody>
              {(filteredGradingQueue || []).map((s) => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>{typeof s.employee === 'object' ? (s.employee?.username ?? s.employee?.employee_number ?? s.employee?.id ?? '—') : (s.employee ?? '—')}</td>
                  <td>{s.branch?.name || s.branch || '—'}</td>
                  <td>{typeof s.exam === 'object' ? (s.exam?.title ?? s.exam?.id ?? '—') : (s.exam ?? '—')}</td>
                  <td>{s.submitted_at || '—'}</td>
                  <td>{s.manual_needed ? 'Manual' : 'Auto-only'}</td>
                  <td>
                    <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                      <button className="btn" onClick={() => navigate(`/manager/exams/${s.exam?.id || ''}/questions`)}>Open Exam</button>
                      {s.manual_needed && (
                        <button className="btn primary" onClick={() => openGradingModal(s.id)}>Grade</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Grading Modal (rendered once, outside table) */}
          {gradingSession && (
            <Modal open={!!gradingSession} onClose={() => setGradingSession(null)}>
              <div style={{ width: '100%', maxWidth: 600, color: '#0f1c34' }}>
                <h3 style={{ margin: '0 0 12px', color: '#0f1c34' }}>
                  Grade Exam: {gradingSession.exam?.title || gradingSession.id}
                </h3>
                {gradingLoading && <div>Loading...</div>}
                {gradingError && <div className="error" style={{ color: '#c62828', marginBottom: 8 }}>{gradingError}</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {gradingAnswers.map((a, idx) => (
                    <div
                      key={a.id}
                      style={{
                        background: '#f8fafd',
                        border: '1px solid #e3eafc',
                        borderRadius: 10,
                        padding: 12,
                        color: '#0f1c34',
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: 6, wordBreak: 'break-word' }}>
                        Q{idx + 1}: {a.question?.text}
                      </div>
                      <div style={{ fontSize: 14, marginBottom: 10, wordBreak: 'break-word' }}>
                        <b>Employee Answer:</b>{' '}
                        {a.text_answer || (a.selected_choices?.map(c => c.text).join(', ') || '—')}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                          Points:
                          <input
                            type="number"
                            min={0}
                            max={a.question?.max_points || 1}
                            step="any"
                            value={a.points_awarded}
                            onChange={e => setGradingAnswers(prev => prev.map(ans => ans.id === a.id ? { ...ans, points_awarded: e.target.value } : ans))}
                            style={{ width: 70, padding: '6px 8px', border: '1px solid #c8d3e8', borderRadius: 6 }}
                          />
                          <span style={{ color: '#647187' }}>/ {a.question?.max_points}</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Manager comment (optional)"
                          value={a.manager_comment || ''}
                          onChange={e => setGradingAnswers(prev => prev.map(ans => ans.id === a.id ? { ...ans, manager_comment: e.target.value } : ans))}
                          style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #c8d3e8', borderRadius: 6 }}
                        />
                        <button
                          className="btn"
                          style={{ alignSelf: 'flex-end' }}
                          onClick={() => submitAnswerGrade(a.id, a.points_awarded, a.manager_comment)}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button className="btn" onClick={() => setGradingSession(null)}>Close</button>
                  <button
                    className="btn primary"
                    disabled={gradingAnswers.some(a => a.points_awarded === '' || a.points_awarded === null || a.points_awarded === undefined)}
                    onClick={() => finalizeSessionGrade(gradingSession.id)}
                  >
                    Finalize Grade
                  </button>
                </div>
              </div>
            </Modal>
          )}
        </DataState>
      </div>
    </div>
  )

  const ExpiringTab = (
    <div className="card">
      <h3>Expiring Competencies</h3>
      <div className="scroll-x">
        <DataState
          loading={loading}
          error={error}
          isEmpty={!loading && (expiringSoon || []).length === 0}
          emptyMessage="No expiring competencies."
        >
          <table className="table">
            <thead><tr><th>Employee</th><th>Competency</th><th>Branch</th><th>Position</th><th>Expiry</th><th>Days</th></tr></thead>
            <tbody>
              {(expiringSoon || []).map((item) => (
                <tr key={`${item.employee?.id}-${item.competency?.id}`}>
                  <td>{item.employee?.username} ({item.employee?.employee_number || '—'})</td>
                  <td>{item.competency?.title}</td>
                  <td>{item.branch?.name || '—'}</td>
                  <td>{item.position?.name || '—'}</td>
                  <td>{item.expiry_date || '—'}</td>
                  <td>{item.days_remaining ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>
      <div className="spacer" />
      <h3>Overdue / Not Completed</h3>
      <div className="scroll-x">
        <DataState
          loading={loading}
          error={error}
          isEmpty={!loading && (overdue || []).length === 0}
          emptyMessage="Nothing overdue."
        >
          <table className="table">
            <thead><tr><th>Employee</th><th>Competency</th><th>Branch</th><th>Position</th><th>Status</th></tr></thead>
            <tbody>
              {(overdue || []).map((item) => (
                <tr key={`o-${item.employee?.id}-${item.competency?.id}`}>
                  <td>{item.employee?.username} ({item.employee?.employee_number || '—'})</td>
                  <td>{item.competency?.title}</td>
                  <td>{item.branch?.name || '—'}</td>
                  <td>{item.position?.name || '—'}</td>
                  <td>{item.status || 'OVERDUE'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>
    </div>
  )

  const LookupTab = (
    <div className="card">
      <h3>Employee Lookup</h3>
      <form className="form" onSubmit={lookupEmployee} style={{ maxWidth: 520 }}>
        <div className="field">
          <label>Employee Number</label>
          <input value={lookupNumber} onChange={(e) => setLookupNumber(e.target.value)} />
          <button className="btn" type="submit">Lookup</button>
        </div>
      </form>
      {assignEmployee && (
        <>
          <div className="card" style={{marginTop:16, background:'#22305a', color:'#fff', borderRadius:16, boxShadow:'0 2px 16px rgba(0,32,64,0.12)'}}>
            <div style={{display:'flex', alignItems:'center', gap:24, marginBottom:24, position:'relative'}}>
              <div style={{position:'relative', width:80, height:80}}>
                <img src={assignEmployee.profile_picture || 'https://ui-avatars.com/api/?name=' + assignEmployee.username} alt="Profile" style={{width:80, height:80, borderRadius:'50%', objectFit:'cover', border:'3px solid #1976d2'}} />
              </div>
              <div>
                <div style={{fontSize:'1.5rem', fontWeight:700}}>{assignEmployee.username}</div>
                <div style={{fontSize:'1.1rem', color:'#e3eafc'}}>{assignEmployee.position?.name || '-'}</div>
              </div>
            </div>
            <div style={{marginBottom:10}}><b>Employee Number:</b> {assignEmployee.employee_number || '-'}</div>
            <div style={{marginBottom:10}}><b>Branch:</b> {assignEmployee.employee_branch?.name || '-'}</div>
            <div style={{marginBottom:10}}><b>Role:</b> {assignEmployee.role || '-'}</div>
            <div style={{marginBottom:10}}><b>Competency Level:</b> {assignEmployee.current_competency_level || '-'}</div>
            <div style={{marginBottom:10}}><b>Total Points:</b> {assignEmployee.total_competency_points || '-'}</div>
            <button className="btn danger" onClick={async () => {
              if (!window.confirm('Are you sure you want to delete this user? This cannot be undone.')) return;
              try {
                await api.delete(`/accounts/employee/${assignEmployee.id}/`);
                setAssignEmployee(null);
                setLookupNumber('');
                setLookupResult(null);
                success('Employee deleted');
              } catch {
                setError('Failed to delete user.');
                toastError('Failed to delete user.');
              }
            }} style={{marginTop:24}}>
              Delete Profile
            </button>
          </div>
          {/* Full employee actions/results/info below profile */}
          <div className="card" style={{marginTop:24}}>
            <h4>Exam Sessions</h4>
            {lookupResult?.sessions && lookupResult.sessions.length > 0 ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Session Name</th>
                    <th>Status</th>
                    <th>Result</th>
                    <th>Score</th>
                    <th>Max Score</th>
                    <th>Competency</th>
                    <th>Started At</th>
                    <th>Submitted At</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {lookupResult.sessions.map((s, idx) => {
                    const pct = s.status === 'GRADED' && s.max_score
                      ? (Number(s.score || 0) / Number(s.max_score)) * 100
                      : null
                    const isFailed = s.status === 'GRADED' && pct !== null && pct < 60
                    const canRetake = isFailed && !s.retake_allowed
                    return (
                      <tr key={s.id}>
                        <td>{s.exam?.title || '-'}</td>
                        <td>{s.status}</td>
                        <td>{pct === null ? '' : (pct >= 60 ? 'Passed' : 'Failed')}</td>
                        <td>{s.status === 'GRADED' && s.score != null ? s.score : '-'}</td>
                        <td>{s.status === 'GRADED' && s.max_score != null ? s.max_score : '-'}</td>
                        <td>{typeof s.exam?.competency === 'object' ? s.exam.competency.title : '-'}</td>
                        <td>{s.started_at ? new Date(s.started_at).toLocaleString() : '-'}</td>
                        <td>{s.submitted_at ? new Date(s.submitted_at).toLocaleString() : '-'}</td>
                        <td>
                          {canRetake && (
                            <button className="btn primary" onClick={() => allowRetake(s.id)}>
                              Allow Retake
                            </button>
                          )}
                          {isFailed && s.retake_allowed && (
                            <span style={{ color: '#16a34a', fontWeight: 600 }}>Retake granted</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <div style={{color:'#888'}}>No sessions found.</div>
            )}
          </div>
          <div className="card" style={{marginTop:24}}>
            <h4>Competencies</h4>
            {lookupResult?.competencies && lookupResult.competencies.length > 0 ? (
              <ul>
                {lookupResult.competencies.map((c) => (
                  <li key={c.id}><b>{c.title}</b> ({c.reference_number}) - {c.description}</li>
                ))}
              </ul>
            ) : (
              <div style={{color:'#888'}}>No competencies assigned.</div>
            )}
          </div>
        </>
      )}
    </div>
  )

  const LevelDeficientTab = (
    <div className="card">
      <div className="toolbar" style={{ marginBottom: 12 }}>
        <div className="left"><h3 style={{margin:0}}>Below Required Level</h3></div>
        <div className="right">
          <button className="btn" onClick={fetchLevelDeficient} disabled={levelDeficientLoading}>
            {levelDeficientLoading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>
      <div style={{fontSize:13, color:'#9bb0e0', marginBottom:10}}>
        Employees whose current competency level is below the minimum required by their position.
      </div>
      <div className="scroll-x">
        <table className="table">
          <thead>
            <tr>
              <th>Employee</th><th>Emp #</th><th>Position</th><th>Branch</th>
              <th>Current</th><th>Required</th><th>Points</th><th>Need</th><th>Short by</th>
            </tr>
          </thead>
          <tbody>
            {(levelDeficient || []).length === 0 ? (
              <tr><td colSpan={9} style={{opacity:0.7}}>No deficiencies. Everyone meets their required level.</td></tr>
            ) : levelDeficient.map((r) => (
              <tr key={r.employee_id} onClick={() => navigate(`/manager/user/${r.employee_id}`)} style={{cursor:'pointer'}}>
                <td>{r.username}</td>
                <td>{r.employee_number || '-'}</td>
                <td>{r.position || '-'}</td>
                <td>{r.branch || '-'}</td>
                <td style={{color:'#ffb4b4', fontWeight:700}}>{r.current_level}</td>
                <td style={{color:'#7be1a1', fontWeight:700}}>{r.required_level}</td>
                <td>{r.total_points}</td>
                <td>{r.required_points}</td>
                <td style={{fontWeight:700}}>{r.points_short}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  const tabs = [
    { key: 'add-employee', label: 'Add Employee', content: AddEmployeeTab },
    { key: 'employee-lookup', label: 'Employee Lookup', content: LookupTab },
    { key: 'requirements', label: 'Requirements', content: RequirementsTab },
    { key: 'competencies', label: 'Competencies', content: CompetenciesTab },
    { key: 'exams', label: 'Exams', content: ExamsTab },
    { key: 'sessions', label: 'Sessions', content: SessionsTab },
    { key: 'grading-queue', label: 'Grading Queue', content: GradingQueueTab },
    { key: 'level-deficient', label: 'Below Required Level', content: LevelDeficientTab },
  ]

  return (
    <div className="container">
      <div className="toolbar" style={{ marginBottom: 12 }}>
        <div className="left"><h2>Manager Dashboard</h2></div>
        <div className="right"><button className="btn" onClick={loadAll} disabled={loading}>Reload</button></div>
      </div>
      <DataState loading={loading} error={error} isEmpty={false}>
        <Tabs tabs={tabs} initial="add-employee" />
      </DataState>
    </div>
  )
}
