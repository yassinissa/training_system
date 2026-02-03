import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client.js'
import { useAuth } from '../hooks/auth-context.jsx'
import { useToast } from '../hooks/useToast.jsx'

export default function Login() {
  const [mode, setMode] = useState('employee')
  const [username, setUsername] = useState('')
  const [employeeNumber, setEmployeeNumber] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const navigate = useNavigate()
  const { login } = useAuth()
  const { success, error: toastError } = useToast()

  // Helper to extract error messages from API responses
  function extractErrorMessages(err) {
    const data = err?.response?.data;
    if (!data) return 'Login failed';
    if (typeof data === 'string') return data;
    if (typeof data === 'object') {
      if (data.detail) return data.detail;
      // Flatten all error arrays (e.g. {non_field_errors: [..], ...})
      return Object.values(data)
        .flat()
        .join(' ');
    }
    return 'Login failed';
  }

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload =
        mode === 'admin'
          ? { username, password }
          : { employee_number: employeeNumber, password };
      const { data } = await api.post('/auth/login/', payload);
      login({ access: data.access, refresh: data.refresh, user: data.user });
      const role = data.user?.role;
      const target =
        role === 'ADMIN'
          ? '/admin'
          : role === 'MANAGER'
          ? '/manager'
          : '/';
      navigate(target, { replace: true });
      success('Logged in successfully');
    } catch (err) {
      const msg = extractErrorMessages(err);
      setError(msg);
      toastError(msg);
    } finally {
      setLoading(false);
    }
  }

  const onPasswordKeyUp = (e) => {
    setCapsLock(e.getModifierState?.('CapsLock'))
  }

  const canSubmit = () => {
    if (loading) return false
    if (mode === 'admin') return username.trim() && password.length > 0
    return employeeNumber.trim() && password.length > 0
  }

  return (
    <div
      className="container"
      style={{
        display: 'grid',
        placeItems: 'center',
        minHeight: '70vh',
        animation: 'fadeIn 0.4s ease'
      }}
    >
      <form
        className="form card"
        onSubmit={submit}
        style={{
          maxWidth: 440,
          padding: '32px 28px',
          position: 'relative',
          transition: '0.3s ease',
          boxShadow: loading
            ? '0 0 20px rgba(46,125,50,0.25)'
            : '0 2px 10px rgba(0,0,0,0.08)'
        }}
      >
        {/* Dark glass loading overlay */}
        {loading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.35)',
              backdropFilter: 'blur(3px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 12,
              zIndex: 10,
              animation: 'fadeIn 0.25s ease'
            }}
          >
            <div className="spinner" />
          </div>
        )}

        <div className="row" style={{ justifyContent: 'center', marginBottom: 12 }}>
          <img
            src="/green-hills-logo.png"
            alt="Green Hills"
            onError={(e) => {
              e.currentTarget.onerror = null
              e.currentTarget.src = '/green-hills-logo.svg'
            }}
            style={{ height: 48, width: 'auto' }}
          />
        </div>

        <h1 style={{ marginBottom: 6 }}>Welcome back</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Sign in to access your dashboard
        </p>

        <div className="field">
          <label>Login Mode</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            disabled={loading}
          >
            <option value="employee">Employee / Manager (employee number)</option>
            <option value="admin">Admin (username)</option>
          </select>
        </div>

        {mode === 'admin' ? (
          <div className="field">
            <label>Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              disabled={loading}
            />
          </div>
        ) : (
          <div className="field">
            <label>Employee Number</label>
            <input
              value={employeeNumber}
              onChange={(e) => setEmployeeNumber(e.target.value)}
              placeholder="e.g. 12345"
              disabled={loading}
            />
            <span className="helper">For employees and managers, use employee number</span>
          </div>
        )}

        <div className="field">
          <label>Password</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyUp={onPasswordKeyUp}
              placeholder="Enter password"
              disabled={loading}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="btn"
              onClick={() => setShowPassword((v) => !v)}
              disabled={loading}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>

          {capsLock && (
            <span className="helper" style={{ color: '#ffb86b' }}>
              Caps Lock is ON
            </span>
          )}
        </div>

        {error && (
          <div
            className="error"
            style={{
              animation: 'shake 0.3s ease',
              marginTop: 4
            }}
          >
            {Array.isArray(error)
              ? error.map((msg, i) => <div key={i}>{msg}</div>)
              : String(error)}
          </div>
        )}

        <div
          className="row"
          style={{ justifyContent: 'space-between', alignItems: 'center' }}
        >
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              disabled={loading}
            />
            Remember me
          </label>

          <a
            href="#"
            className="muted"
            onClick={(e) => e.preventDefault()}
            style={{ opacity: loading ? 0.5 : 1 }}
          >
            Forgot password?
          </a>
        </div>

        <div className="spacer" />

        <button
          className="btn primary"
          disabled={!canSubmit()}
          style={{
            opacity: canSubmit() ? 1 : 0.6,
            transition: '0.2s ease',
            position: 'relative'
          }}
        >
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="btn-spinner" />
              Signing in…
            </span>
          ) : (
            'Sign In'
          )}
        </button>
      </form>
    </div>
  )
}
