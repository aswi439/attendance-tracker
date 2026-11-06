import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate, Navigate } from 'react-router-dom';
import { api } from '../api.js';
import { useTheme } from '../App.jsx';

function BackgroundVideo() {
  return (
    <div className="bg" aria-hidden="true">
      <video className="bg-video" autoPlay muted loop playsInline>
        <source
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260809_012548_ef22562c-c0ae-4816-ad9d-f8922af4e6a7.mp4"
          type="video/mp4"
        />
      </video>
      <div className="bg-overlay" />
    </div>
  );
}

const PORTALS = {
  admin: {
    title: 'Admin Portal Login',
    sub: 'Sign in to view reports and attendance analytics.',
    demoUser: 'admin',
    demoPass: 'admin123',
    icon: '▦',
  },
  supervisor: {
    title: 'Supervisor Portal Login',
    sub: "Sign in to mark and manage today's attendance.",
    demoUser: 'supervisor',
    demoPass: 'supervisor123',
    icon: '✓',
  },
};

export default function Login({ me, setMe }) {
  const { portal: routePortal } = useParams();
  const navigate = useNavigate();
  const { dark, toggleTheme } = useTheme();

  const currentPortal = (routePortal === 'admin' || routePortal === 'supervisor') ? routePortal : 'supervisor';
  const p = PORTALS[currentPortal];

  const [username, setUsername] = useState(p.demoUser);
  const [password, setPassword] = useState(p.demoPass);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setUsername(p.demoUser);
    setPassword(p.demoPass);
    setError('');
  }, [currentPortal]);

  if (me === currentPortal) {
    return <Navigate to={currentPortal === 'admin' ? '/admin' : '/supervisor'} replace />;
  }

  function switchPortal(newPortal) {
    navigate(`/login/${newPortal}`, { replace: true });
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.login(currentPortal, username, password);
      if (setMe) setMe(currentPortal);
      navigate(currentPortal === 'admin' ? '/admin' : '/supervisor', { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed. Please check credentials.');
      setBusy(false);
    }
  }

  return (
    <div className="landing-premium has-video-bg">
      <BackgroundVideo />

      {/* Top navigation */}
      <nav className="landing-nav reveal" style={{ animationDelay: '100ms' }}>
        <div className="nav-spacer" />
        <div className="nav-actions">
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={dark ? 'Light mode' : 'Dark mode'}
          >
            {dark ? '☀' : '🌙'}
          </button>
        </div>
      </nav>

      {/* Premium Glassmorphism Login Card */}
      <div className="landing-login-wrap">
        <div className="landing-glass-card">
          <div className="landing-glass-header">
            <Link to="/" className="landing-glass-back">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d="M13 8H3M7 4L3 8l4 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Back</span>
            </Link>

            <div className="portal-badge-pill">
              <span>{p.icon}</span> {currentPortal.toUpperCase()}
            </div>
          </div>

          {/* Quick switcher between Admin and Supervisor */}
          <div className="portal-switch-tabs">
            <button
              type="button"
              className={`portal-tab ${currentPortal === 'admin' ? 'active' : ''}`}
              onClick={() => switchPortal('admin')}
            >
              Admin Login
            </button>
            <button
              type="button"
              className={`portal-tab ${currentPortal === 'supervisor' ? 'active' : ''}`}
              onClick={() => switchPortal('supervisor')}
            >
              Supervisor Login
            </button>
          </div>

          <h2>{p.title}</h2>
          <div className="landing-glass-sub">{p.sub}</div>

          {error && <div className="glass-error-msg">{error}</div>}

          <form onSubmit={submit}>
            <div className="glass-field">
              <label>Username</label>
              <input
                className="glass-input"
                type="text"
                autoFocus
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
              />
            </div>

            <div className="glass-field">
              <label>Password</label>
              <input
                className="glass-input"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
              />
            </div>

            <button
              type="submit"
              className="glass-submit-btn"
              disabled={busy}
            >
              <span>{busy ? 'Signing in…' : 'Sign in'}</span>
              {!busy && (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M3 8h10M9 4l4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          </form>

          <div className="glass-hint">
            Demo credentials: <code>{p.demoUser}</code> / <code>{p.demoPass}</code>
          </div>
        </div>
      </div>
    </div>
  );
}
