
import React, { useState } from 'react';
import './LoginModern.css';
import api from '../api/client.js';
import { useAuth } from '../hooks/auth-context.jsx';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../hooks/useToast.jsx';

export default function LoginModern() {
  const [loginMode, setLoginMode] = useState('employee');
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  function extractErrorMessages(err) {
    const data = err?.response?.data;
    if (!data) return 'Login failed';
    if (typeof data === 'string') return data;
    if (typeof data === 'object') {
      if (data.detail) return data.detail;
      return Object.values(data).flat().join(' ');
    }
    return 'Login failed';
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload =
        loginMode === 'admin'
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
  };

  return (
    <div className="login-bg">
      <div className="login-card">
        <img src="/logo-green-hills.png" alt="Green Hills" className="login-logo" />
        <h2>Welcome back</h2>
        <p className="login-sub">Sign in to access your dashboard</p>
        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label>Login Mode</label>
            <select value={loginMode} onChange={e => setLoginMode(e.target.value)}>
              <option value="employee">Employee / Manager (employee number)</option>
              <option value="admin">Admin (username)</option>
            </select>
          </div>
          {loginMode === 'employee' ? (
            <div className="login-field">
              <label>Employee Number</label>
              <input type="text" value={employeeNumber} onChange={e => setEmployeeNumber(e.target.value)} placeholder="Employee Number" required disabled={loading} />
              <small>For employees and managers, use employee number</small>
            </div>
          ) : (
            <div className="login-field">
              <label>Username</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Admin Username" required disabled={loading} />
              <small>For admins, use your username</small>
            </div>
          )}
          <div className="login-field">
            <label>Password</label>
            <div className="login-password-row">
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required />
              <button type="button" className="show-btn" onClick={() => setShowPassword(s => !s)}>{showPassword ? 'Hide' : 'Show'}</button>
            </div>
          </div>
          {error && (
            <div className="error" style={{ color: '#ffbaba', marginBottom: 10, textAlign: 'center' }}>{error}</div>
          )}
          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
