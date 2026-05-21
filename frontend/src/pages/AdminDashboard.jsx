import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client.js'
import Tabs from '../components/Tabs.jsx'
import CountUp from '../components/CountUp.jsx'
import DataState from '../components/DataState.jsx'
import { useToast } from '../hooks/useToast.jsx'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { success, error: toastError, warning } = useToast()
  const [branches, setBranches] = useState([])
  const [positions, setPositions] = useState([])
  const [competencies, setCompetencies] = useState([])
  const [levelThresholds, setLevelThresholds] = useState({ cl1_min_points: 0, cl2_min_points: 0, cl3_min_points: 0, cl4_min_points: 0 })
  const [newPosition, setNewPosition] = useState({ name: '', min_required_level: 'CL1', department: '' })
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [userLoading, setUserLoading] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)

  // Filters for user listing
  const [filters, setFilters] = useState({ role: 'EMPLOYEE', employee_number: '', position: '', branch: '' })

  // Reports: sessions & compliance
  const [reportFilters, setReportFilters] = useState({ branch: '', position: '', status: '' })
  const [nonCompliance, setNonCompliance] = useState(null)
  const [sessions, setSessions] = useState([])
  const [levelDeficient, setLevelDeficient] = useState(null)

  // Create form
  const [createForm, setCreateForm] = useState({ name: '', location: '', target: 0 })

  // Manager registration (removed; handled by Create User form)
  const [promoMsg, setPromoMsg] = useState('')

  // Promote employee
  const [promo, setPromo] = useState({ employee_number: '', position_id: '', competency_ids: [], competency_meta: {}, required: true, frequency: '' })
  const selectedPromoCompetencies = useMemo(() => {
    const ids = new Set((promo.competency_ids || []).map(String))
    return (competencies || []).filter((c) => ids.has(String(c.id)))
  }, [competencies, promo.competency_ids])
  const togglePromoCompetency = (id) => {
    setPromo((f) => {
      const next = new Set((f.competency_ids || []).map(String))
      const key = String(id)
      if (next.has(key)) {
        next.delete(key)
        const newMeta = { ...(f.competency_meta || {}) }
        delete newMeta[key]
        return { ...f, competency_ids: Array.from(next), competency_meta: newMeta }
      } else {
        next.add(key)
        return { ...f, competency_ids: Array.from(next) }
      }
    })
  }
  const setCompetencyFrequency = (id, freq) => {
    const key = String(id)
    setPromo((f) => ({
      ...f,
      competency_meta: {
        ...(f.competency_meta || {}),
        [key]: { ...(f.competency_meta?.[key] || {}), frequency: freq },
      },
    }))
  }
  const setCompetencyRequired = (id, req) => {
    const key = String(id)
    setPromo((f) => ({
      ...f,
      competency_meta: {
        ...(f.competency_meta || {}),
        [key]: { ...(f.competency_meta?.[key] || {}), required: req },
      },
    }))
  }

  // Employee lookup for the Promote tab - figures out who the promotion is for
  // so we can filter the competency picker to only those NOT already passed.
  const [promoEmployee, setPromoEmployee] = useState(null)
  const [promoPassedIds, setPromoPassedIds] = useState([])
  const [promoLookupErr, setPromoLookupErr] = useState('')

  useEffect(() => {
    const empNum = (promo.employee_number || '').trim()
    if (!empNum) {
      setPromoEmployee(null); setPromoPassedIds([]); setPromoLookupErr(''); return
    }
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const ures = await api.get(`/accounts/admin/users/?employee_number=${encodeURIComponent(empNum)}`)
        const u = (ures.data?.results || [])[0]
        if (cancelled) return
        if (!u) {
          setPromoEmployee(null); setPromoPassedIds([]); setPromoLookupErr('No employee with that number'); return
        }
        setPromoEmployee(u); setPromoLookupErr('')
        const rres = await api.get(`/training/records/?employee=${u.id}&status=PASSED`)
        const recs = Array.isArray(rres.data) ? rres.data : (rres.data?.results || [])
        const ids = recs
          .map((r) => (typeof r.competency === 'object' ? r.competency?.id : r.competency))
          .filter((x) => x != null)
          .map(Number)
        if (!cancelled) setPromoPassedIds(ids)
      } catch {
        if (cancelled) return
        setPromoEmployee(null); setPromoPassedIds([]); setPromoLookupErr('Failed to look up employee')
      }
    }, 350)
    return () => { cancelled = true; clearTimeout(t) }
  }, [promo.employee_number])

  // Competencies the employee has NOT yet passed - safer to assign on a promotion.
  const availablePromoCompetencies = useMemo(() => {
    if (!promoPassedIds.length) return competencies || []
    const done = new Set(promoPassedIds.map(Number))
    return (competencies || []).filter((c) => !done.has(Number(c.id)))
  }, [competencies, promoPassedIds])

  // Admin user edit
  const [editUser, setEditUser] = useState({ employee_number: '', role: '', position_id: '', employee_branch_id: '', manager_branch_ids: [] })

  // Create user (admin-side)
  const [newUser, setNewUser] = useState({
    role: 'EMPLOYEE',
    username: '',
    password: '',
    employee_number: '',
    position_id: '',
    employee_branch_id: '',
    manager_branch_ids: [],
  })

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [bRes, pRes, cRes, lvlRes] = await Promise.all([
        api.get('/branches/'),
        api.get('/positions/'),
        api.get('/training/competencies/'),
        api.get('/training/levels/thresholds/'),
      ])
      setBranches(bRes.data || [])
      setPositions(pRes.data || [])
      setCompetencies(cRes.data || [])
      if (lvlRes?.data) setLevelThresholds({
        cl1_min_points: Number(lvlRes.data.cl1_min_points) || 0,
        cl2_min_points: Number(lvlRes.data.cl2_min_points) || 0,
        cl3_min_points: Number(lvlRes.data.cl3_min_points) || 0,
        cl4_min_points: Number(lvlRes.data.cl4_min_points) || 0,
      })
      await fetchUsers()
    } catch (e) {
      setError(e?.response?.data || 'Failed to load admin data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const fetchUsers = async () => {
    setUserLoading(true)
    const q = new URLSearchParams()
    if (filters.role) q.append('role', filters.role)
    if (filters.employee_number) q.append('employee_number', filters.employee_number)
    if (filters.position) q.append('position', filters.position)
    if (filters.branch) q.append('branch', filters.branch)
    try {
      const uRes = await api.get(`/accounts/admin/users/?${q.toString()}`)
      setUsers((uRes.data && uRes.data.results) || [])
    } catch (e) {
      const msg = e?.response?.data || 'Failed to load users'
      setError(msg)
      toastError('Failed to load users')
    } finally {
      setUserLoading(false)
    }
  }

  const exportUsersCSV = () => {
    const headers = [
      { label: 'id', get: (u) => u.id },
      { label: 'username', get: (u) => u.username },
      { label: 'employee_number', get: (u) => u.employee_number || '' },
      { label: 'role', get: (u) => u.role },
      { label: 'position', get: (u) => (typeof u.position === 'object' ? (u.position?.name ?? u.position?.id ?? '') : (u.position ?? '')) },
      { label: 'employee_branch', get: (u) => (typeof u.employee_branch === 'object' ? (u.employee_branch?.name ?? u.employee_branch?.id ?? '') : (u.employee_branch ?? '')) },
      { label: 'manager_branch_ids', get: (u) => (u.manager_branch_ids || []).join('|') },
    ]
    const headerLine = headers.map((h) => '"' + h.label + '"').join(',')
    const dataLines = (users || []).map((r) => headers.map((h) => '"' + String(h.get(r) ?? '') + '"').join(',')).join('\n')
    const csv = headerLine + '\n' + dataLines
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'users.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const runDashboardReports = async () => {
    setReportLoading(true)
    setError('')
    try {
      const q = new URLSearchParams()
      if (reportFilters.branch) q.append('branch', reportFilters.branch)
      if (reportFilters.position) q.append('position', reportFilters.position)
      const ncRes = await api.get(`/training/compliance/missing/?${q.toString()}`)
      setNonCompliance(ncRes.data)
      try {
        const ldRes = await api.get(`/training/reports/level-deficient/?${q.toString()}`)
        setLevelDeficient(ldRes.data)
      } catch { setLevelDeficient(null) }
      const sessQ = new URLSearchParams()
      if (reportFilters.branch) sessQ.append('branch', reportFilters.branch)
      if (reportFilters.status) sessQ.append('status', reportFilters.status)
      const sessRes = await api.get(`/training/exam/sessions/manage/${sessQ.toString() ? `?${sessQ.toString()}` : ''}`)
      const sessData = sessRes.data
      setSessions(Array.isArray(sessData) ? sessData : (sessData?.results || []))
    } catch (e) {
      const msg = e?.response?.data || 'Failed to load reports'
      setError(msg)
      toastError('Failed to load reports')
    } finally {
      setReportLoading(false)
    }
  }

  const allowRetake = async (sessionId) => {
    if (!window.confirm('Allow this employee to retake the exam? The failed attempt will stay in history.')) return
    try {
      await api.post(`/training/exam/sessions/${sessionId}/allow-retake/`)
      success('Retake granted - employee can now retake the exam.')
      runDashboardReports()
    } catch (e) {
      const msg = e?.response?.data || 'Failed to allow retake'
      setError(msg)
      toastError('Failed to allow retake')
    }
  }

  const exportSessionsCSV = () => {
    const headers = [
      { label: 'id', get: (s) => s.id },
      { label: 'employee', get: (s) => (typeof s.employee === 'object' ? (s.employee?.username ?? s.employee?.employee_number ?? s.employee?.id ?? '') : (s.employee ?? '')) },
      { label: 'exam', get: (s) => (typeof s.exam === 'object' ? (s.exam?.title ?? s.exam?.id ?? '') : (s.exam ?? '')) },
      { label: 'status', get: (s) => s.status },
      { label: 'started_at', get: (s) => s.started_at },
      { label: 'submitted_at', get: (s) => s.submitted_at || '' },
      { label: 'score', get: (s) => s.score ?? '' },
    ]
    const headerLine = headers.map((h) => '"' + h.label + '"').join(',')
    const dataLines = (sessions || []).map((r) => headers.map((h) => '"' + String(h.get(r) ?? '') + '"').join(',')).join('\n')
    const csv = headerLine + '\n' + dataLines
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sessions.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const createBranch = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const body = { name: createForm.name, location: createForm.location, target_compliance_percent: Number(createForm.target) || 0 }
      await api.post('/branches/', body)
      setCreateForm({ name: '', location: '', target: 0 })
      load()
      success('Branch created')
    } catch (e) {
      setError(e?.response?.data || 'Failed to create branch')
      toastError('Failed to create branch')
    }
  }

  const updateBranch = async (b) => {
    try {
      const body = { name: b.name, location: b.location, target_compliance_percent: Number(b.target_compliance_percent) || 0 }
      await api.put(`/branches/${b.id}/`, body)
      load()
      success('Branch updated')
    } catch (e) {
      setError(e?.response?.data || 'Failed to update branch')
      toastError('Failed to update branch')
    }
  }

  const deleteBranch = async (b) => {
    try { await api.delete(`/branches/${b.id}/`); load(); warning('Branch deleted') } catch (e) { setError(e?.response?.data || 'Failed to delete branch'); toastError('Failed to delete branch') }
  }

  // registerManager removed (covered by Create User form)

  const promote = async (e) => {
    e.preventDefault()
    setPromoMsg('')
    setError('')
    try {
      const res = await api.get(`/accounts/admin/users/?employee_number=${encodeURIComponent(promo.employee_number)}`)
      const u = (res.data.results || [])[0]
      if (!u) throw new Error('Employee not found')
      const body = { employee_id: u.id, position_id: Number(promo.position_id) }
      const resp = await api.post('/accounts/promote/', body)
      const msg = resp.data.message || 'Employee promoted'
      setPromoMsg(msg)
      success(msg)

      if ((promo.competency_ids || []).length) {
        try {
          const normalizeBranch = (val) => {
            const num = Number(val)
            return Number.isFinite(num) ? num : undefined
          }
          const branchId = normalizeBranch((resp.data?.employee?.employee_branch?.id || resp.data?.employee?.employee_branch) ?? u.employee_branch?.id ?? u.employee_branch)
          const assignments = (promo.competency_ids || []).map((cid) => {
            const key = String(cid)
            const meta = promo.competency_meta?.[key] || {}
            return {
              competency_id: Number(cid),
              frequency: meta.frequency || promo.frequency || undefined,
              required: meta.required ?? promo.required,
              branch_id: branchId,
            }
          })
          const assignPayload = {
            employee_id: resp.data?.employee?.id || u.id,
            assignments,
            branch_id: branchId,
          }
          await api.post('/training/employee/requirements/', assignPayload)
          success('Competency assigned to employee')
        } catch (assignErr) {
          const msg = assignErr?.response?.data ? JSON.stringify(assignErr.response.data) : 'Promoted but failed to assign competency'
          setError(msg)
          toastError(msg)
        }
      }

      setPromo({ employee_number: '', position_id: '', competency_ids: [], competency_meta: {}, required: true, frequency: '' })
    } catch (e) {
      setError(e?.response?.data || 'Failed to promote employee')
      toastError('Failed to promote employee')
    }
  }

  const createUser = async (e) => {
    e.preventDefault()
    setError('')
    try {
      if (!newUser.username || !newUser.password) { toastError('Username and password are required'); return }
      if (newUser.role === 'ADMIN') {
        await api.post('/register/admin/', { username: newUser.username, password: newUser.password, role: 'ADMIN' })
        success('Admin created')
      } else if (newUser.role === 'MANAGER') {
        const payload = {
          username: newUser.username,
          password: newUser.password,
          role: 'MANAGER',
          employee_number: newUser.employee_number,
          position: newUser.position_id ? Number(newUser.position_id) : null,
          manager_branches: (newUser.manager_branch_ids || []).map((id) => Number(id)),
        }
        await api.post('/register/manager/', payload)
        success('Manager created')
      } else {
        const payload = {
          username: newUser.username,
          password: newUser.password,
          employee_number: newUser.employee_number,
          position: newUser.position_id ? Number(newUser.position_id) : null,
          employee_branch: newUser.employee_branch_id ? Number(newUser.employee_branch_id) : null,
        }
        await api.post('/register/employee/', payload)
        success('Employee created')
      }
      setNewUser({ role: 'EMPLOYEE', username: '', password: '', employee_number: '', position_id: '', employee_branch_id: '', manager_branch_ids: [] })
      await fetchUsers()
    } catch (e) {
      setError(e?.response?.data || 'Failed to create user')
      toastError('Failed to create user')
    }
  }

  const savePosition = async (p) => {
    try {
      const body = {
        name: (p.name || '').trim(),
        department: p.department || '',
        min_required_level: p.min_required_level || 'CL1',
        cl1_min_points: Number(p.cl1_min_points) || 0,
        cl2_min_points: Number(p.cl2_min_points) || 0,
        cl3_min_points: Number(p.cl3_min_points) || 0,
        cl4_min_points: Number(p.cl4_min_points) || 0,
      }

      // Validate monotonic thresholds: CL1 ≤ CL2 ≤ CL3 ≤ CL4
      const { cl1_min_points: cl1, cl2_min_points: cl2, cl3_min_points: cl3, cl4_min_points: cl4 } = body
      if (cl1 < 0 || cl2 < 0 || cl3 < 0 || cl4 < 0) {
        toastError('Points must be non-negative')
        return
      }
      if (!(cl1 <= cl2 && cl2 <= cl3 && cl3 <= cl4)) {
        toastError('Ensure CL1 ≤ CL2 ≤ CL3 ≤ CL4')
        return
      }

      await api.put(`/positions/${p.id}/`, body)
      load()
      success('Position policy saved')
    } catch (e) {
      setError(e?.response?.data || 'Failed to save position policy')
      toastError('Failed to save position policy')
    }
  }

  const createPosition = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const body = {
        name: (newPosition.name || '').trim(),
        department: (newPosition.department || '').trim() || null,
        min_required_level: newPosition.min_required_level || 'CL1',
        // initialize thresholds to zero; managed globally in Levels tab
        cl1_min_points: 0,
        cl2_min_points: 0,
        cl3_min_points: 0,
        cl4_min_points: 0,
      }
      if (!body.name) { toastError('Position name is required'); return }
      await api.post('/positions/', body)
      setNewPosition({ name: '', min_required_level: 'CL1', department: '' })
      await load()
      success('Position created')
    } catch (e) {
      setError(e?.response?.data || 'Failed to create position')
      toastError('Failed to create position')
    }
  }

  const saveGlobalLevels = async () => {
    try {
      const body = {
        cl1_min_points: Number(levelThresholds.cl1_min_points) || 0,
        cl2_min_points: Number(levelThresholds.cl2_min_points) || 0,
        cl3_min_points: Number(levelThresholds.cl3_min_points) || 0,
        cl4_min_points: Number(levelThresholds.cl4_min_points) || 0,
      }
      const { cl1_min_points: cl1, cl2_min_points: cl2, cl3_min_points: cl3, cl4_min_points: cl4 } = body
      if (cl1 < 0 || cl2 < 0 || cl3 < 0 || cl4 < 0) { toastError('Points must be non-negative'); return }
      if (!(cl1 <= cl2 && cl2 <= cl3 && cl3 <= cl4)) { toastError('Ensure CL1 ≤ CL2 ≤ CL3 ≤ CL4'); return }
      await api.post('/training/levels/thresholds/', body)
      success('Global level thresholds saved')
      await load()
    } catch (e) {
      setError(e?.response?.data || 'Failed to save global levels')
      toastError('Failed to save global levels')
    }
  }

  const fetchUser = async () => {
    if (!editUser.employee_number) return
    try {
      const res = await api.get(`/accounts/admin/users/?employee_number=${encodeURIComponent(editUser.employee_number)}`)
      const u = (res.data.results || [])[0]
      if (u) {
        setEditUser((f) => ({
          ...f,
          role: u.role,
          position_id: u.position?.id || '',
          employee_branch_id: u.employee_branch_id || '',
          manager_branch_ids: u.manager_branch_ids || [],
        }))
      }
    } catch (e) {
      setError(e?.response?.data || 'Failed to fetch user')
    }
  }

  const saveUser = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const payload = {
        employee_number: editUser.employee_number,
        role: editUser.role,
        position_id: editUser.position_id || null,
        employee_branch_id: editUser.employee_branch_id || null,
        manager_branch_ids: editUser.manager_branch_ids || [],
      }
      const res = await api.post('/accounts/admin/users/update/', payload)
      const msg = res.data.message || 'User updated.'
      success(msg)
    } catch (e) {
      setError(e?.response?.data || 'Failed to update user')
      toastError('Failed to update user')
    }
  }

  // Users sorting & pagination
  const [userSort, setUserSort] = useState({ key: 'id', dir: 'asc' })
  const [userPage, setUserPage] = useState(1)
  const [userPageSize, setUserPageSize] = useState(10)
  const toggleSort = (key) => setUserSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
  const getVal = (u, key) => {
    if (key === 'position') return typeof u.position === 'object' ? (u.position?.name ?? u.position?.id ?? '') : (u.position ?? '')
    if (key === 'employee_branch') return typeof u.employee_branch === 'object' ? (u.employee_branch?.name ?? u.employee_branch?.id ?? '') : (u.employee_branch ?? '')
    return u[key]
  }
  const sortedUsers = useMemo(() => {
    const arr = [...(users || [])]
    const { key, dir } = userSort
    arr.sort((a, b) => {
      const va = String(getVal(a, key) ?? '')
      const vb = String(getVal(b, key) ?? '')
      return dir === 'asc' ? va.localeCompare(vb, undefined, { numeric: true }) : vb.localeCompare(va, undefined, { numeric: true })
    })
    return arr
  }, [users, userSort])
  const pagedUsers = useMemo(() => {
    const start = (userPage - 1) * userPageSize
    return sortedUsers.slice(start, start + userPageSize)
  }, [sortedUsers, userPage, userPageSize])
  const totalPages = Math.max(1, Math.ceil((users || []).length / userPageSize))

  // Tabs content
  const UsersTab = (
    <div className="grid-2">
      <div className="card">
        <div className="toolbar">
          <div className="left"><h3>Users</h3></div>
          <div className="right"><button className="btn" onClick={exportUsersCSV}>Export CSV</button></div>
        </div>
        <div className="row" style={{flexWrap:'wrap', gap:8}}>
          <select value={filters.role} onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value }))}>
            <option value="">All roles</option>
            <option value="ADMIN">ADMIN</option>
            <option value="MANAGER">MANAGER</option>
            <option value="EMPLOYEE">EMPLOYEE</option>
          </select>
          <select value={filters.position} onChange={(e) => setFilters((f) => ({ ...f, position: e.target.value }))}>
            <option value="">All positions</option>
            {positions.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
          <select value={filters.branch} onChange={(e) => setFilters((f) => ({ ...f, branch: e.target.value }))}>
            <option value="">All branches</option>
            {branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
          </select>
          <input placeholder="Employee #" value={filters.employee_number} onChange={(e) => setFilters((f) => ({ ...f, employee_number: e.target.value }))} />
          <button className="btn" onClick={() => { setUserPage(1); fetchUsers() }}>Search</button>
        </div>
        <div className="row" style={{justifyContent:'space-between', marginTop:8, flexWrap:'wrap', gap:8}}>
          <div className="row" style={{gap:8}}>
            <label className="muted">Sort</label>
            <select value={`${userSort.key}:${userSort.dir}`} onChange={(e) => { const [key, dir] = e.target.value.split(':'); setUserSort({ key, dir }) }}>
              {['id','username','employee_number','role','position','employee_branch'].flatMap(k => [
                <option key={`${k}:asc`} value={`${k}:asc`}>{k} ↑</option>,
                <option key={`${k}:desc`} value={`${k}:desc`}>{k} ↓</option>
              ])}
            </select>
          </div>
          <div className="row" style={{gap:8}}>
            <label className="muted">Rows</label>
            <select value={userPageSize} onChange={(e) => { setUserPageSize(Number(e.target.value)); setUserPage(1) }}>
              {[10,20,50,100].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <DataState
          loading={userLoading}
          error={error}
          isEmpty={!userLoading && (pagedUsers || []).length === 0}
          emptyMessage="No users found. Adjust filters and search again."
        >
          <>
            <table className="table">
              <thead>
                <tr>
                  {[
                    {k:'id', l:'ID'},
                    {k:'username', l:'Username'},
                    {k:'employee_number', l:'Employee #'},
                    {k:'role', l:'Role'},
                    {k:'position', l:'Position'},
                    {k:'employee_branch', l:'Employee Branch'},
                    {k:'manager_branches', l:'Manager Branches', nosort:true},
                  ].map(col => (
                    <th key={col.k} onClick={() => !col.nosort && toggleSort(col.k)} style={{cursor: col.nosort ? 'default' : 'pointer'}}>
                      {col.l}{!col.nosort && (userSort.key === col.k ? (userSort.dir === 'asc' ? ' ↑' : ' ↓') : '')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(pagedUsers || []).map((u) => (
                  <tr key={u.id} onClick={() => navigate(`/admin/user-profile/${u.id}`)} style={{cursor:'pointer'}}>
                    <td>{u.id}</td>
                    <td>{u.username}</td>
                    <td>{u.employee_number || '—'}</td>
                    <td>{u.role}</td>
                    <td>{typeof u.position === 'object' ? (u.position?.name ?? u.position?.id ?? '—') : (u.position ?? '—')}</td>
                    <td>{typeof u.employee_branch === 'object' ? (u.employee_branch?.name ?? u.employee_branch?.id ?? '—') : (u.employee_branch ?? '—')}</td>
                    <td>{(u.manager_branches_detail || []).map((b) => b.name).join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="row" style={{justifyContent:'space-between', marginTop:10, flexWrap:'wrap', gap:8}}>
              <div className="muted">Page {userPage} of {totalPages} • {(users || []).length} total</div>
              <div className="row" style={{gap:8}}>
                <button className="btn" disabled={userPage<=1} onClick={() => setUserPage(p => Math.max(1, p-1))}>Prev</button>
                <button className="btn" disabled={userPage>=totalPages} onClick={() => setUserPage(p => Math.min(totalPages, p+1))}>Next</button>
              </div>
            </div>
          </>
        </DataState>
      </div>

      <div className="card">
        <h3>Edit User</h3>
        <form className="form" onSubmit={saveUser}>
          <div className="field">
            <label>Employee Number</label>
            <div className="row">
              <input value={editUser.employee_number} onChange={(e) => setEditUser((f) => ({ ...f, employee_number: e.target.value }))} />
              <button type="button" className="btn" onClick={fetchUser}>Load</button>
            </div>
          </div>
          <div className="field">
            <label>Role</label>
            <select value={editUser.role} onChange={(e) => setEditUser((f) => ({ ...f, role: e.target.value }))}>
              <option value="">Select role</option>
              <option value="ADMIN">ADMIN</option>
              <option value="MANAGER">MANAGER</option>
              <option value="EMPLOYEE">EMPLOYEE</option>
            </select>
          </div>
          {/* Conditionally render fields based on role */}
          {(editUser.role === 'MANAGER' || editUser.role === 'EMPLOYEE') && (
            <div className="field">
              <label>Position</label>
              <select value={editUser.position_id} onChange={(e) => setEditUser((f) => ({ ...f, position_id: e.target.value }))}>
                <option value="">Select position</option>
                {positions.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
            </div>
          )}
          {editUser.role === 'EMPLOYEE' && (
            <div className="field">
              <label>Employee Branch</label>
              <select value={editUser.employee_branch_id} onChange={(e) => setEditUser((f) => ({ ...f, employee_branch_id: e.target.value }))}>
                <option value="">Select branch</option>
                {branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
              </select>
            </div>
          )}
          {editUser.role === 'MANAGER' && (
            <div className="field">
              <label>Manager Branches</label>
              <div className="row" style={{flexWrap:'wrap'}}>
                {branches.map((b) => (
                  <label key={b.id} style={{display:'inline-flex', alignItems:'center', gap:8}}>
                    <input type="checkbox" checked={editUser.manager_branch_ids.includes(b.id)} onChange={(e) => {
                      setEditUser((f) => ({ ...f, manager_branch_ids: e.target.checked ? [...f.manager_branch_ids, b.id] : f.manager_branch_ids.filter((x) => x !== b.id) }))
                    }} />
                    {b.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          <button className="btn primary">Save User</button>
        </form>
      </div>

      <div className="card">
        <h3>Create User</h3>
        <form className="form" onSubmit={createUser}>
          <div className="field">
            <label>Role</label>
            <select value={newUser.role} onChange={(e) => setNewUser((s) => ({ ...s, role: e.target.value }))}>
              <option value="ADMIN">ADMIN</option>
              <option value="MANAGER">MANAGER</option>
              <option value="EMPLOYEE">EMPLOYEE</option>
            </select>
          </div>
          <div className="field">
            <label>Username</label>
            <input value={newUser.username} onChange={(e) => setNewUser((s) => ({ ...s, username: e.target.value }))} />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={newUser.password} onChange={(e) => setNewUser((s) => ({ ...s, password: e.target.value }))} />
          </div>
          {newUser.role !== 'ADMIN' && (
            <>
              <div className="field">
                <label>Employee Number</label>
                <input value={newUser.employee_number} onChange={(e) => setNewUser((s) => ({ ...s, employee_number: e.target.value }))} />
              </div>
              <div className="field">
                <label>Position</label>
                <select value={newUser.position_id} onChange={(e) => setNewUser((s) => ({ ...s, position_id: e.target.value }))}>
                  <option value="">Select position</option>
                  {positions.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                </select>
              </div>
            </>
          )}
          {newUser.role === 'EMPLOYEE' && (
            <div className="field">
              <label>Employee Branch</label>
              <select value={newUser.employee_branch_id} onChange={(e) => setNewUser((s) => ({ ...s, employee_branch_id: e.target.value }))}>
                <option value="">Select branch</option>
                {branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
              </select>
            </div>
          )}
          {newUser.role === 'MANAGER' && (
            <div className="field">
              <label>Manager Branches</label>
              <div className="row" style={{flexWrap:'wrap'}}>
                {branches.map((b) => (
                  <label key={b.id} style={{display:'inline-flex', alignItems:'center', gap:8}}>
                    <input type="checkbox" checked={newUser.manager_branch_ids.includes(String(b.id)) || newUser.manager_branch_ids.includes(b.id)} onChange={(e) => {
                      const id = String(b.id)
                      setNewUser((s) => ({ ...s, manager_branch_ids: e.target.checked ? [...s.manager_branch_ids, id] : s.manager_branch_ids.filter((x) => String(x) !== id) }))
                    }} />
                    {b.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          <button className="btn primary">Create</button>
        </form>
      </div>
    </div>
  )

  const InsightsTab = (
    <div>
      <div className="card">
        <div className="toolbar">
          <div className="left"><h3>Competencies & Sessions</h3></div>
          <div className="right">
            <button className="btn" onClick={exportSessionsCSV}>Export Sessions CSV</button>
            <button className="btn" onClick={runDashboardReports}>Run</button>
          </div>
        </div>
        <div className="row" style={{flexWrap:'wrap'}}>
          <select value={reportFilters.branch} onChange={(e) => setReportFilters((f) => ({ ...f, branch: e.target.value }))}>
            <option value="">All branches</option>
            {branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
          </select>
          <select value={reportFilters.position} onChange={(e) => setReportFilters((f) => ({ ...f, position: e.target.value }))}>
            <option value="">All positions</option>
            {positions.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
          <select value={reportFilters.status} onChange={(e) => setReportFilters((f) => ({ ...f, status: e.target.value }))}>
            <option value="">All statuses</option>
            {['PENDING','IN_PROGRESS','COMPLETED','FAILED'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {nonCompliance && (<div className="spacer" />)}
        {nonCompliance && (
          <div className="card" style={{background:'transparent', border:'none', padding:0}}>
            <h3>Non-Compliance Snapshot</h3>
            <div className="row" style={{alignItems:'center', gap:12, flexWrap:'wrap'}}>
              <span className="pill">Checked: <CountUp to={Number(nonCompliance.total_employees_checked||0)} /></span>
              <span className="pill">Non-compliant: <CountUp to={Number(nonCompliance.non_compliant_count||0)} /></span>
              {(() => { const checked=Number(nonCompliance.total_employees_checked||0); const non=Number(nonCompliance.non_compliant_count||0); const comp=Math.max(0, checked - non); const pct=checked?Math.round((comp/checked)*100):0; return (
                <span className="pill">Compliance: <strong>{pct}%</strong></span>
              )})()}
            </div>
            {(() => { const checked=Number(nonCompliance.total_employees_checked||0); const non=Number(nonCompliance.non_compliant_count||0); const comp=Math.max(0, checked - non); const pct=checked?Math.round((comp/checked)*100):0; return (
              <div className="progress" style={{margin:'10px 0'}}><div className="progress-bar" style={{ width: pct + '%', '--to': `${pct}%` }}></div></div>
            )})()}
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Position</th>
                  <th>Branch</th>
                  <th>Below Min</th>
                  <th>Missing</th>
                </tr>
              </thead>
              <tbody>
                {(nonCompliance.non_compliant || []).slice(0, 20).map((r) => (
                  <tr key={r.employee_id}>
                    <td>{r.username}</td>
                    <td>{typeof r.position === 'object' ? (r.position?.name ?? r.position?.id ?? '—') : (r.position ?? '—')}</td>
                    <td>{typeof r.branch === 'object' ? (r.branch?.name ?? r.branch?.id ?? '—') : (r.branch ?? '—')}</td>
                    <td>{r.below_min_level ? 'Yes' : 'No'}</td>
                    <td>{(r.missing_competencies || []).map((m) => m.title).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {levelDeficient && (
          <>
            <div className="spacer" />
            <div className="card">
              <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
                <h3>Below Required Level</h3>
                <span className="pill">{levelDeficient.count || 0} employees</span>
              </div>
              <div className="muted" style={{fontSize:13, marginTop:4, marginBottom:8}}>
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
                    {(levelDeficient.results || []).length === 0 ? (
                      <tr><td colSpan={9} style={{opacity:0.7}}>Everyone meets their required level.</td></tr>
                    ) : (levelDeficient.results || []).map((r) => (
                      <tr key={r.employee_id} onClick={() => navigate(`/admin/user-profile/${r.employee_id}`)} style={{cursor:'pointer'}}>
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
            </div>
          </>
        )}

        <div className="spacer" />
        <div className="card" style={{background:'transparent', border:'none', padding:0}}>
          <h3>Sessions</h3>
          <DataState
            loading={reportLoading}
            error={error}
            isEmpty={!reportLoading && (sessions || []).length === 0}
            emptyMessage="No sessions for the selected filters."
          >
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
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {(sessions || []).map((s) => {
                  const pct = s.status === 'GRADED' && s.max_score
                    ? (Number(s.score || 0) / Number(s.max_score)) * 100
                    : null
                  const isFailed = s.status === 'GRADED' && pct !== null && pct < 60
                  const canRetake = isFailed && !s.retake_allowed
                  return (
                    <tr key={s.id}>
                      <td>{s.id}</td>
                      <td>{typeof s.employee === 'object' ? (s.employee?.username ?? s.employee?.employee_number ?? s.employee?.id ?? '—') : (s.employee ?? '—')}</td>
                      <td>{typeof s.exam === 'object' ? (s.exam?.title ?? s.exam?.id ?? '—') : (s.exam ?? '—')}</td>
                      <td>{s.status}</td>
                      <td>{s.started_at}</td>
                      <td>{s.submitted_at || '—'}</td>
                      <td>{s.score ?? '—'}</td>
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
    </div>
  )

  const BranchesTab = (
    <div>
      <div className="card">
        <h3>Create Branch</h3>
        <form className="row" onSubmit={createBranch}>
          <input placeholder="Name" value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} />
          <input placeholder="Location" value={createForm.location} onChange={(e) => setCreateForm((f) => ({ ...f, location: e.target.value }))} />
          <input placeholder="Target %" type="number" min="0" max="100" value={createForm.target} onChange={(e) => setCreateForm((f) => ({ ...f, target: e.target.value }))} />
          <button className="btn primary">Create</button>
        </form>
      </div>
      <div className="card">
        <h3>Branches</h3>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Location</th>
              <th>Target %</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {branches.map((b) => (
              <tr key={b.id}>
                <td>{b.id}</td>
                <td><input value={b.name} onChange={(e) => { b.name = e.target.value; setBranches([...branches]) }} /></td>
                <td><input value={b.location || ''} onChange={(e) => { b.location = e.target.value; setBranches([...branches]) }} /></td>
                <td><input type="number" min="0" max="100" value={b.target_compliance_percent ?? 0} onChange={(e) => { b.target_compliance_percent = Number(e.target.value); setBranches([...branches]) }} /></td>
                <td className="row">
                  <button className="btn" onClick={() => updateBranch(b)}>Save</button>
                  <button className="btn danger" onClick={() => deleteBranch(b)}>Delete</button>
                </td>
              </tr>
            ))}
            {(!branches || branches.length === 0) && (
              <tr><td colSpan={5} className="muted">No branches yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

  // ManagersTab removed (creation handled in Users → Create User)

  const PositionsTab = (
    <div className="card">
      <h3>Position Policies</h3>
      <div className="helper" style={{marginBottom:12}}>
        Assign the minimum competency level required for each position (CL1–CL4). Point thresholds are managed separately under the Levels tab.
      </div>
      <form className="row" onSubmit={createPosition} style={{gap:8, marginBottom:12, flexWrap:'wrap'}}>
        <input placeholder="New position name" value={newPosition.name} onChange={(e) => setNewPosition((s) => ({ ...s, name: e.target.value }))} />
        <select value={newPosition.min_required_level} onChange={(e) => setNewPosition((s) => ({ ...s, min_required_level: e.target.value }))}>
          {['CL0','CL1','CL2','CL3','CL4'].map((lvl) => <option key={lvl} value={lvl}>{lvl}</option>)}
        </select>
        <input placeholder="Department (optional)" value={newPosition.department} onChange={(e) => setNewPosition((s) => ({ ...s, department: e.target.value }))} />
        <button className="btn primary">Add Position</button>
      </form>
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Min Level</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => (
            <tr key={p.id}>
              <td><input value={p.name} onChange={(e) => { p.name = e.target.value; setPositions([...positions]) }} /></td>
              <td>
                <select value={p.min_required_level || 'CL1'} onChange={(e) => { p.min_required_level = e.target.value; setPositions([...positions]) }}>
                  {['CL0','CL1','CL2','CL3','CL4'].map((lvl) => <option key={lvl} value={lvl}>{lvl}</option>)}
                </select>
              </td>
              <td><button className="btn" onClick={() => savePosition(p)}>Save</button></td>
            </tr>
          ))}
          {(!positions || positions.length === 0) && (
            <tr><td colSpan={3} className="muted">No positions yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )

  const LevelsTab = (
    <div className="card">
      <h3>Levels</h3>
      <div className="helper" style={{marginBottom:12}}>
        Define global point thresholds for each level. Employees earn points from passed exams weighted by competency priority for the position, but levels are assigned by these global ranges. Ensure CL1 ≤ CL2 ≤ CL3 ≤ CL4.
      </div>
      <div className="scroll-x">
      <table className="table">
        <thead>
          <tr>
            <th>CL1 Min</th>
            <th>CL2 Min</th>
            <th>CL3 Min</th>
            <th>CL4 Min</th>
            <th>Ranges (computed)</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {(() => {
            const cl1 = Number(levelThresholds.cl1_min_points || 0)
            const cl2 = Number(levelThresholds.cl2_min_points || 0)
            const cl3 = Number(levelThresholds.cl3_min_points || 0)
            const cl4 = Number(levelThresholds.cl4_min_points || 0)
            const ranges = [
              `CL1: ${cl1} – ${Math.max(0, cl2 - 1)}`,
              `CL2: ${cl2} – ${Math.max(cl2, cl3 - 1)}`,
              `CL3: ${cl3} – ${Math.max(cl3, cl4 - 1)}`,
              `CL4: ${cl4}+`,
            ]
            return (
              <tr>
                <td><input type="number" min="0" step="1" value={levelThresholds.cl1_min_points} onChange={(e) => setLevelThresholds((s) => ({ ...s, cl1_min_points: Number(e.target.value) }))} /></td>
                <td><input type="number" min="0" step="1" value={levelThresholds.cl2_min_points} onChange={(e) => setLevelThresholds((s) => ({ ...s, cl2_min_points: Number(e.target.value) }))} /></td>
                <td><input type="number" min="0" step="1" value={levelThresholds.cl3_min_points} onChange={(e) => setLevelThresholds((s) => ({ ...s, cl3_min_points: Number(e.target.value) }))} /></td>
                <td><input type="number" min="0" step="1" value={levelThresholds.cl4_min_points} onChange={(e) => setLevelThresholds((s) => ({ ...s, cl4_min_points: Number(e.target.value) }))} /></td>
                <td className="muted wrap">{ranges.join(' | ')}</td>
                <td><button className="btn" onClick={saveGlobalLevels}>Save</button></td>
              </tr>
            )
          })()}
        </tbody>
      </table>
      </div>
    </div>
  )

  const PromoteTab = (
    <div className="card">
      <h3>Promote Employee</h3>
      <form className="form" onSubmit={promote}>
        <div className="field">
          <label>Employee Number</label>
          <input value={promo.employee_number} onChange={(e) => setPromo((f) => ({ ...f, employee_number: e.target.value }))} />
        </div>
        <div className="field">
          <label>New Position</label>
          <select value={promo.position_id} onChange={(e) => setPromo((f) => ({ ...f, position_id: e.target.value }))}>
            <option value="">Select position</option>
            {positions.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
        </div>
        <div className="field">
          <label>Assign competencies (optional)</label>
          <div className="row" style={{justifyContent:'space-between', alignItems:'center', marginBottom:6, gap:8}}>
            <div className="muted">Select the competencies to attach to this promotion.</div>
            <div className="pill" style={{background:'#e9efff', color:'#102347', border:'1px solid #c5d4ff'}}>
              {(promo.competency_ids || []).length} selected
            </div>
          </div>
          {/* Employee snapshot so the admin knows what's filtered out */}
          {promo.employee_number && (
            <div className="card" style={{padding:10, marginBottom:8, background:'#0f1c33', border:'1px solid #233455'}}>
              {promoLookupErr ? (
                <span style={{color:'#ffb4b4'}}>{promoLookupErr}</span>
              ) : promoEmployee ? (
                <span>
                  Lookup: <b>{promoEmployee.username}</b>
                  {promoEmployee.position?.name ? ` (current: ${promoEmployee.position.name})` : ''}
                  {' — '}{promoPassedIds.length} competenc{promoPassedIds.length === 1 ? 'y' : 'ies'} already passed
                  {' — '}showing {availablePromoCompetencies.length} new option{availablePromoCompetencies.length === 1 ? '' : 's'}.
                </span>
              ) : (
                <span className="muted">Looking up employee…</span>
              )}
            </div>
          )}
          <div role="listbox" aria-multiselectable="true" className="card" style={{padding:10, borderRadius:10, background:'#14233b', border:'1px solid #233455', maxHeight:260, overflowY:'auto', display:'grid', gap:8}}>
            {availablePromoCompetencies.length === 0 && (
              <div className="muted">
                {promoEmployee
                  ? 'This employee has already passed every competency in the system.'
                  : 'No competencies available'}
              </div>
            )}
            {availablePromoCompetencies.map((c) => {
              const checked = (promo.competency_ids || []).some((x) => String(x) === String(c.id))
              return (
                <label key={c.id} className="row" style={{gap:10, alignItems:'flex-start', padding:'10px 12px', borderRadius:10, border:'1px solid ' + (checked ? '#8fb1ff' : '#2b3f61'), background: checked ? '#f3f6ff' : '#1c2f4f', cursor:'pointer', boxShadow: checked ? '0 6px 14px rgba(30,60,114,0.16)' : 'none'}}>
                  <input type="checkbox" checked={checked} onChange={() => togglePromoCompetency(c.id)} style={{marginTop:3}} />
                  <div style={{flex:1}}>
                    <div style={{fontWeight:650, color: checked ? '#0f1f3a' : '#f1f5ff'}}>{c.reference_number}</div>
                    <div className="muted" style={{marginTop:2, color: checked ? '#334462' : '#c9d6f2'}}>{c.title}</div>
                  </div>
                </label>
              )
            })}
          </div>
          {selectedPromoCompetencies.length > 0 && (
            <div className="card" style={{marginTop:10, padding:10, borderRadius:10, background:'#0f1627', border:'1px solid #223455', display:'grid', gap:10}}>
              <div className="muted" style={{fontWeight:600}}>Per-competency settings</div>
              {selectedPromoCompetencies.map((c) => {
                const key = String(c.id)
                const meta = promo.competency_meta?.[key] || {}
                return (
                  <div key={c.id} className="row" style={{gap:10, alignItems:'center', flexWrap:'wrap', background:'#16233b', border:'1px solid #213558', borderRadius:10, padding:'10px 12px'}}>
                    <div style={{minWidth:160, fontWeight:650, color:'#e9efff'}}>{c.reference_number}</div>
                    <div className="muted" style={{flex:1, color:'#c6d4ef'}}>{c.title}</div>
                    <select value={meta.frequency || ''} onChange={(e) => setCompetencyFrequency(c.id, e.target.value)} style={{minWidth:140}}>
                      <option value="">Frequency (default)</option>
                      {['ONE_TIME','YEARLY','NEW_HIRE','PROMOTION','OTHER'].map((x) => <option key={x} value={x}>{x}</option>)}
                    </select>
                    <label className="row" style={{alignItems:'center', gap:6}}>
                      <input type="checkbox" checked={meta.required ?? promo.required} onChange={(e) => setCompetencyRequired(c.id, e.target.checked)} /> Required
                    </label>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div className="row" style={{gap:12, flexWrap:'wrap'}}>
          <div className="field" style={{minWidth:220}}>
            <label>Frequency (optional)</label>
            <select value={promo.frequency} onChange={(e) => setPromo((f) => ({ ...f, frequency: e.target.value }))}>
              <option value="">(default)</option>
              {['ONE_TIME','YEARLY','NEW_HIRE','PROMOTION','OTHER'].map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          <label style={{display:'inline-flex', alignItems:'center', gap:8}}>
            <input type="checkbox" checked={!!promo.required} onChange={(e) => setPromo((f) => ({ ...f, required: e.target.checked }))} /> Required
          </label>
        </div>
        {promoMsg && <div className="helper flash">{promoMsg}</div>}
        <button className="btn primary">Promote</button>
      </form>
    </div>
  )

  const tabs = [
    { key: 'users', label: 'Users', content: UsersTab },
    { key: 'insights', label: 'Insights', content: InsightsTab },
    { key: 'branches', label: 'Branches', content: BranchesTab },
    { key: 'positions', label: 'Positions', content: PositionsTab },
    { key: 'levels', label: 'Levels', content: LevelsTab },
    { key: 'promote', label: 'Promote', content: PromoteTab },
  ]

  return (
    <div className="container">
      <h1>Admin Dashboard</h1>
      {loading && (
        <div>
          <div className="card">
            <div className="toolbar"><div className="left"><h3>Users</h3></div></div>
            <div className="skeleton-line skeleton"></div>
            <div className="skeleton-line skeleton"></div>
            <div className="skeleton-table">
              {Array.from({length:6}).map((_,i) => (<div key={i} className="skeleton-row skeleton" />))}
            </div>
          </div>
          <div className="card">
            <div className="toolbar"><div className="left"><h3>Insights</h3></div></div>
            <div className="skeleton-line skeleton"></div>
            <div className="skeleton-line skeleton"></div>
            <div className="skeleton-table">
              {Array.from({length:5}).map((_,i) => (<div key={i} className="skeleton-row skeleton" />))}
            </div>
          </div>
        </div>
      )}
      {error && <div className="card"><div className="error">{String(error)}</div></div>}
      {!loading && <Tabs tabs={tabs} initial="users" />}
    </div>
  )
}
// Set-Location "C:\Users\yassi\OneDrive\Desktop\training_system\frontend"