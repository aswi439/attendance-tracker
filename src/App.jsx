import React, { useEffect, useState, createContext, useContext } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { api } from './api.js';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Supervisor from './pages/Supervisor.jsx';
import Admin from './pages/Admin.jsx';
import WorkerDetail from './pages/WorkerDetail.jsx';

const ThemeContext = createContext();
export function useTheme() { return useContext(ThemeContext); }

export function useAuth() {
  const [me, setMe] = useState(undefined);
  useEffect(() => {
    api.me()
      .then((d) => setMe(d.role))
      .catch(() => setMe(null));
  }, []);
  const signOut = () => api.logout().finally(() => setMe(null));
  return { me, setMe, signOut };
}

function Guard({ role, me, children }) {
  if (me === undefined) return <div className="spin" />;
  if (!me) return <Navigate to={`/login/${role}`} replace />;
  if (me !== role) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { me, setMe, signOut } = useAuth();
  const [dark, setDark] = useState(() => localStorage.getItem('wt-theme') === 'dark');
  const toggleTheme = () => setDark((d) => { const v = !d; localStorage.setItem('wt-theme', v ? 'dark' : 'light'); return v; });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <ThemeContext.Provider value={{ dark, toggleTheme }}>
      <Routes>
        <Route path="/" element={<Landing me={me} setMe={setMe} />} />
        <Route path="/login/:portal" element={<Login me={me} setMe={setMe} />} />
        <Route path="/supervisor" element={<Guard role="supervisor" me={me}><Supervisor me={me} onSignOut={signOut} /></Guard>} />
        <Route path="/admin" element={<Guard role="admin" me={me}><Admin me={me} onSignOut={signOut} /></Guard>} />
        <Route path="/admin/worker/:id" element={<Guard role="admin" me={me}><WorkerDetail me={me} onSignOut={signOut} /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ThemeContext.Provider>
  );
}
