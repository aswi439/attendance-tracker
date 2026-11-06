import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

function LiveCounter() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i += Math.ceil(Math.random() * 3);
      if (i > 47) {
        setCount(47);
        clearInterval(interval);
        return;
      }
      setCount(i);
    }, 40);
    return () => clearInterval(interval);
  }, []);
  return <span className="live-count dot-matrix-stat">{count}</span>;
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

export default function Landing({ me, setMe }) {
  const { dark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // If already logged in, redirect directly to portal
  useEffect(() => {
    if (me === 'admin') navigate('/admin', { replace: true });
    if (me === 'supervisor') navigate('/supervisor', { replace: true });
  }, [me, navigate]);

  const [activePortal, setActivePortal] = useState(null); // 'admin' | 'supervisor' | null
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function openPortalLogin(portalKey) {
    setActivePortal(portalKey);
    setError('');
    setUsername(PORTALS[portalKey].demoUser);
    setPassword(PORTALS[portalKey].demoPass);
  }

  function closePortalLogin() {
    setActivePortal(null);
    setError('');
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    if (!activePortal) return;
    setBusy(true);
    setError('');
    try {
      await api.login(activePortal, username, password);
      if (setMe) setMe(activePortal);
      navigate(activePortal === 'admin' ? '/admin' : '/supervisor', { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed. Please check credentials.');
      setBusy(false);
    }
  }

  const p = activePortal ? PORTALS[activePortal] : null;

  return (
    <div className="landing-premium has-video-bg">
      <BackgroundVideo />

      {/* In-page Glassmorphism Login Card or Main Hero */}
      {activePortal && p ? (
        <div className="landing-login-wrap">
          <div className="landing-glass-card">
            <div className="landing-glass-header">
              <button
                type="button"
                className="landing-glass-back"
                onClick={closePortalLogin}
              >
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
              </button>

              <div className="portal-badge-pill">
                <span>{p.icon}</span> {activePortal.toUpperCase()}
              </div>
            </div>

            {/* Quick switcher between Admin and Supervisor */}
            <div className="portal-switch-tabs">
              <button
                type="button"
                className={`portal-tab ${activePortal === 'admin' ? 'active' : ''}`}
                onClick={() => openPortalLogin('admin')}
              >
                Admin Login
              </button>
              <button
                type="button"
                className={`portal-tab ${activePortal === 'supervisor' ? 'active' : ''}`}
                onClick={() => openPortalLogin('supervisor')}
              >
                Supervisor Login
              </button>
            </div>

            <h2>{p.title}</h2>
            <div className="landing-glass-sub">{p.sub}</div>

            {error && <div className="glass-error-msg">{error}</div>}

            <form onSubmit={handleLoginSubmit}>
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
      ) : (
        <section className="hero-section">
          {/* Smart India Hackathon badge removed per blue marking */}

          <h1 className="hero-title editorial-title reveal" style={{ animationDelay: '200ms' }}>
            <span className="headline-line headline-line-1">Employee attendance,</span>
            <span className="headline-line headline-line-2"><em>tracked</em> properly.</span>
          </h1>

          <div className="hero-cta reveal" style={{ animationDelay: '350ms' }}>
            <button
              type="button"
              className="cta-btn primary"
              onClick={() => openPortalLogin('supervisor')}
            >
              <span>Supervisor Portal</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3 8h10M9 4l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              className="cta-btn secondary"
              onClick={() => openPortalLogin('admin')}
            >
              <span>Admin Portal</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3 8h10M9 4l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </section>
      )}

      {/* Bottom spacer for vertical balance */}
      <div className="landing-bottom-spacer" />
    </div>
  );
}
