import React, { useEffect, useState, useRef, useCallback } from 'react';
import { api, todayStr, daysAgoStr } from '../api.js';
import { useTheme } from '../App.jsx';
import { GlassFold } from '@/components/ui/glass-fold';

const LEAVES = [
  ['ml', 'Medical Leave (ML)', '🏥'],
  ['emergency', 'Emergency Leave', '🚨'],
  ['work_related', 'Work-related', '🛠️'],
  ['casual', 'Casual Leave', '🌴'],
  ['unpaid', 'Unpaid Leave', '📄'],
  ['unspecified', 'Unspecified', '•'],
];

const STATUS_FILTERS = [
  ['all', 'All'],
  ['unmarked', 'Unmarked'],
  ['present', 'Present'],
  ['late', 'Late'],
  ['absent', 'Absent'],
];

function getCurrentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function Toast({ msg, err, onUndo }) {
  if (!msg) return null;
  return (
    <div className={`toast ${err ? 'err' : ''}`}>
      {msg}
      {onUndo && <button className="undo-btn" onClick={onUndo}>Undo</button>}
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="roster">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="skeleton-row">
          <div className="skeleton-line wide" />
          <div className="skeleton-line medium" />
          <div className="skeleton-line narrow" />
        </div>
      ))}
    </div>
  );
}

export default function Supervisor({ me, onSignOut }) {
  const { dark, toggleTheme } = useTheme();
  const [date, setDate] = useState(todayStr());
  const [workers, setWorkers] = useState([]);
  const [marks, setMarks] = useState({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modal, setModal] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [closing, setClosing] = useState(false);
  const [clockingOut, setClockingOut] = useState(null);
  const [shiftConfig, setShiftConfig] = useState({ shift_start: '09:00', shift_end: '18:00', work_hours: 8, lunch_hours: 1 });
  const [editingShift, setEditingShift] = useState(false);
  const [shiftForm, setShiftForm] = useState({ shift_start: '09:00', shift_end: '18:00', work_hours: '8', lunch_hours: '1' });
  const [shiftSaving, setShiftSaving] = useState(false);
  const [closed, setClosed] = useState(false);
  const [closedAt, setClosedAt] = useState(null);
  const [busyIds, setBusyIds] = useState(new Set());
  const [justMarkedIds, setJustMarkedIds] = useState(new Set());
  const [toast, setToast] = useState(null);
  const [todayHoliday, setTodayHoliday] = useState(null);
  const [canAddWorker, setCanAddWorker] = useState(false);
  const toastTimer = useRef();
  const undoRef = useRef(null);

  function showToast(msg, err = false, undoFn = null) {
    undoRef.current = undoFn;
    setToast({ msg, err, hasUndo: !!undoFn });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      setToast(null);
      undoRef.current = null;
    }, undoFn ? 5000 : 2200);
  }

  function handleUndo() {
    if (undoRef.current) {
      undoRef.current();
      undoRef.current = null;
      setToast(null);
      clearTimeout(toastTimer.current);
    }
  }

  // Escape key handler
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        if (modal) setModal(null);
        else if (adding) setAdding(false);
        else if (closing) setClosing(false);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [modal, adding, closing]);

  useEffect(() => {
    api.getSetting('supervisor_can_add_workers')
      .then(d => setCanAddWorker(d.value === 'true'))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const yr = date.slice(0, 4);
    Promise.all([api.workers(), api.attendance(date), api.closed(date), api.holidays(yr).catch(() => ({ holidays: [] })), api.shiftConfig().catch(() => ({ config: null }))])
      .then(([w, a, c, h, sc]) => {
        if (!alive) return;
        setWorkers(w.workers);
        const m = {};
        for (const r of a.records) m[r.worker_id] = r;
        setMarks(m);
        setClosed(c.closed);
        setClosedAt(c.closedAt);
        const hol = (h.holidays || []).find((x) => x.date === date);
        setTodayHoliday(hol || null);
        if (sc.config) {
          setShiftConfig(sc.config);
          setShiftForm({ shift_start: sc.config.shift_start || '09:00', shift_end: sc.config.shift_end || '18:00', work_hours: String(sc.config.work_hours || 8), lunch_hours: String(sc.config.lunch_hours || 1) });
        }
        setLoading(false);
      })
      .catch((e) => { showToast(e.message, true); setLoading(false); });
    return () => { alive = false; };
  }, [date]);

  const addBusy = useCallback((id) => setBusyIds((s) => new Set(s).add(id)), []);
  const removeBusy = useCallback((id) => setBusyIds((s) => { const n = new Set(s); n.delete(id); return n; }), []);

  function triggerAnimation(id) {
    setJustMarkedIds((s) => new Set(s).add(id));
    setTimeout(() => setJustMarkedIds((s) => { const n = new Set(s); n.delete(id); return n; }), 600);
  }

  async function save(worker, status, leaveType = null, notes = null, isLate = false) {
    if (closed) return;
    const prevMark = marks[worker.id] || null;
    const timeIn = status === 'present' ? getCurrentTime() : null;
    addBusy(worker.id);
    try {
      await api.mark({ workerId: worker.id, date, status, leaveType, notes, isLate, timeIn, today: todayStr() });
      const now = new Date().toISOString();
      const newMark = { worker_id: worker.id, status, leave_type: leaveType, notes, is_late: isLate ? 1 : 0, recorded_at: now, time_in: timeIn, time_out: null };
      setMarks((m) => ({ ...m, [worker.id]: newMark }));
      triggerAnimation(worker.id);

      const undoFn = prevMark
        ? () => {
            api.mark({
              workerId: worker.id, date,
              status: prevMark.status,
              leaveType: prevMark.leave_type,
              notes: prevMark.notes,
              isLate: prevMark.is_late,
              today: todayStr(),
            }).then(() => {
              setMarks((m) => ({ ...m, [worker.id]: prevMark }));
              showToast(`Reverted ${worker.name}`);
            }).catch(() => {});
          }
        : null;

      const label = status === 'present'
        ? (isLate ? `⏰ ${worker.name} marked late present` : `✓ ${worker.name} marked present`)
        : `✕ ${worker.name} marked absent — ${LEAVES.find((l) => l[0] === leaveType)?.[1] || ''}`;
      showToast(label, false, undoFn);
    } catch (e) {
      showToast(e.message, true);
    } finally {
      removeBusy(worker.id);
    }
  }

  async function markAllPresent() {
    if (closed) return;
    const unmarked = workers.filter((w) => !marks[w.id]);
    if (unmarked.length === 0) return showToast('Everyone is already marked');
    for (const w of unmarked) addBusy(w.id);
    try {
      const bulkTimeIn = getCurrentTime();
      await Promise.all(unmarked.map((w) => api.mark({ workerId: w.id, date, status: 'present', timeIn: bulkTimeIn, today: todayStr() })));
      const now = new Date().toISOString();
      const m = {};
      for (const w of unmarked) {
        m[w.id] = { worker_id: w.id, status: 'present', leave_type: null, notes: null, recorded_at: now, time_in: bulkTimeIn, time_out: null };
        triggerAnimation(w.id);
      }
      setMarks((prev) => ({ ...prev, ...m }));
      showToast(`✓ Marked ${unmarked.length} worker${unmarked.length > 1 ? 's' : ''} present`);
    } catch (e) {
      showToast(e.message, true);
    } finally {
      for (const w of unmarked) removeBusy(w.id);
    }
  }

  const marked = Object.keys(marks).length;
  const present = Object.values(marks).filter((r) => r.status === 'present').length;
  const late = Object.values(marks).filter((r) => r.status === 'present' && r.is_late).length;
  const absent = marked - present;
  const unmarkedWorkersList = workers.filter((w) => !marks[w.id]);
  const lateWorkersList = workers.filter((w) => marks[w.id]?.status === 'present' && marks[w.id]?.is_late);
  const absentWorkersList = workers.filter((w) => marks[w.id]?.status === 'absent');
  const byType = {};
  for (const r of Object.values(marks)) {
    if (r.status === 'absent') byType[r.leave_type || 'unspecified'] = (byType[r.leave_type || 'unspecified'] || 0) + 1;
  }

  const departments = ['all', ...Array.from(new Set(workers.map((w) => w.department || '').filter(Boolean))).sort()];

  const workerTypeFilter = deptFilter;
  const filtered = workers.filter((w) => {
    if (q && !w.name.toLowerCase().includes(q.toLowerCase()) && !(w.department || '').toLowerCase().includes(q.toLowerCase())) return false;
    if (workerTypeFilter === 'workers' && w.department === 'Ext. Manpower') return false;
    if (workerTypeFilter === 'ext' && w.department !== 'Ext. Manpower') return false;
    return true;
  });

  const anyBusy = busyIds.size > 0;

  const hour = new Date().getHours();
  const getGreeting = () => hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="page dash-premium sv-page">
      <div className="dash-bg" aria-hidden="true">
        <GlassFold
          color1="#1e3cc8"
          color2="#06081e"
          color3="#96d7ff"
          speed={0.4}
          scale={1}
          noise={0.08}
          className="dash-canvas"
        />
      </div>

      {/* Permanent Top-Right Sign Out Button */}
      <button className="top-signout-btn" onClick={onSignOut} title="Sign out of portal">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        <span>Sign out</span>
      </button>

      {/* Floating glass header */}
      <header className="sv-header">
        <div className="sv-header-left">
          <div className="sv-logo">✓</div>
          <div>
            <div className="sv-header-title">Supervisor Portal</div>
            <div className="sv-header-sub">Daily Attendance</div>
          </div>
        </div>
        <div className="sv-header-actions">
          <button className="theme-toggle" onClick={toggleTheme} title={dark ? 'Light mode' : 'Dark mode'}>{dark ? '☀' : '🌙'}</button>
        </div>
      </header>

      {/* Welcome + date section */}
      <div className="sv-welcome">
        <div>
          <h1 className="sv-greeting">{getGreeting()}, <span className="gradient-text">Supervisor</span></h1>
          <p className="sv-date-label">{new Date(date + 'T00:00:00Z').toLocaleDateString('en-AE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}</p>
        </div>
        <input className="sv-date-pick" type="date" value={date} min={daysAgoStr(14)} max={todayStr()} onChange={(e) => e.target.value && setDate(e.target.value)} />
      </div>

      {/* Holiday banner */}
      {todayHoliday && (
        <div className={`sv-holiday ${todayHoliday.type === 'company' ? 'company' : ''}`}>
          <span>{todayHoliday.type === 'company' ? '🏢' : '🎉'}</span>
          {todayHoliday.type === 'company' ? 'Company Off Day' : 'Government Holiday'}: <strong>{todayHoliday.name}</strong>
        </div>
      )}

      {/* Closed banner */}
      {closed && (
        <div className="sv-closed">
          <span>🔒</span>
          Attendance closed for {new Date(date + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}
          {closedAt && <span className="sv-closed-time"> · {new Date(closedAt).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })}</span>}
        </div>
      )}

      {/* Shift info bar — editable */}
      <div className="sv-shift-bar">
        {!editingShift ? (
          <>
            <span>Shift: <strong>{shiftConfig.shift_start} – {shiftConfig.shift_end}</strong></span>
            <span className="sv-shift-sep">|</span>
            <span>Work: <strong>{shiftConfig.work_hours}h/day</strong></span>
            <span className="sv-shift-sep">|</span>
            <span>Lunch: <strong>{shiftConfig.lunch_hours}h</strong></span>
            <button className="sv-shift-edit-btn" onClick={() => setEditingShift(true)}>Edit</button>
          </>
        ) : (
          <form className="sv-shift-form" onSubmit={async (e) => {
            e.preventDefault();
            setShiftSaving(true);
            try {
              const res = await api.updateShiftConfig({ shift_start: shiftForm.shift_start, shift_end: shiftForm.shift_end, work_hours: Number(shiftForm.work_hours) || 8, lunch_hours: Number(shiftForm.lunch_hours) || 1 });
              setShiftConfig(res.config);
              setEditingShift(false);
              showToast('Shift config updated');
            } catch (err) { showToast(err.message, true); }
            finally { setShiftSaving(false); }
          }}>
            <label>Start <input type="time" value={shiftForm.shift_start} onChange={(e) => setShiftForm((f) => ({ ...f, shift_start: e.target.value }))} /></label>
            <label>End <input type="time" value={shiftForm.shift_end} onChange={(e) => setShiftForm((f) => ({ ...f, shift_end: e.target.value }))} /></label>
            <label>Work hrs <input type="number" min="1" max="24" step="0.5" value={shiftForm.work_hours} onChange={(e) => setShiftForm((f) => ({ ...f, work_hours: e.target.value }))} /></label>
            <label>Lunch hrs <input type="number" min="0" max="4" step="0.25" value={shiftForm.lunch_hours} onChange={(e) => setShiftForm((f) => ({ ...f, lunch_hours: e.target.value }))} /></label>
            <button type="submit" className="sv-shift-save" disabled={shiftSaving}>{shiftSaving ? '…' : 'Save'}</button>
            <button type="button" className="sv-shift-cancel" onClick={() => setEditingShift(false)}>Cancel</button>
          </form>
        )}
      </div>

      {/* Bento stat cards */}
      <div className="sv-stats">
        <div className="sv-stat sv-stat-primary">
          <div className="sv-stat-icon">📋</div>
          <div className="sv-stat-num">{marked}<span>/{workers.length}</span></div>
          <div className="sv-stat-label">Marked</div>
        </div>
        <div className="sv-stat sv-stat-success">
          <div className="sv-stat-icon">✓</div>
          <div className="sv-stat-num">{present}</div>
          <div className="sv-stat-label">Present</div>
        </div>
        <div className="sv-stat sv-stat-warn">
          <div className="sv-stat-icon">⏰</div>
          <div className="sv-stat-num">{late}</div>
          <div className="sv-stat-label">Late</div>
        </div>
        <div className="sv-stat sv-stat-danger">
          <div className="sv-stat-icon">✕</div>
          <div className="sv-stat-num">{absent}</div>
          <div className="sv-stat-label">Absent</div>
        </div>
      </div>

      {/* Main roster card with shiny borders realism wrapper */}
      <div className="sv-roster-wrapper">
        <div className="sv-roster-border-glow" aria-hidden="true" />
        <div className="sv-roster-card">
          <div className="sv-roster-shine-line" aria-hidden="true" />
          <div className="sv-roster-corner-blob" aria-hidden="true" />
          <div className="sv-roster-head">
          <div>
            <h2 className="sv-roster-title">Daily Roster</h2>
            <p className="sv-roster-sub">{closed ? 'This day has been closed. No further changes can be made.' : 'Tap Present, Late or Absent for each worker.'}</p>
          </div>
          {!closed && (
            <div className="sv-roster-actions">
              {canAddWorker && <button className="sv-btn" onClick={() => setAdding(true)}>+ Add worker</button>}
              <button className="sv-btn sv-btn-primary" onClick={markAllPresent} disabled={anyBusy}><span className="sv-btn-primary-inner">Mark all present</span></button>
              <button className="sv-btn sv-btn-danger" onClick={() => setClosing(true)} disabled={anyBusy || workers.length === 0}>Close day</button>
            </div>
          )}
        </div>

        {/* Search + filters */}
        <div className="sv-filters">
          <div className="sv-search-wrap">
            <svg className="sv-search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/><path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            <input className="sv-search" placeholder="Search worker or department…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          <div className="sv-chips">
            <button className={`sv-chip${deptFilter === 'all' ? ' active' : ''}`} onClick={() => setDeptFilter('all')}>All ({workers.length})</button>
            <button className={`sv-chip${deptFilter === 'workers' ? ' active' : ''}`} onClick={() => setDeptFilter('workers')}>Workers ({workers.filter(w => w.department !== 'Ext. Manpower').length})</button>
            <button className={`sv-chip${deptFilter === 'ext' ? ' active' : ''}`} onClick={() => setDeptFilter('ext')}>Ext. Workers ({workers.filter(w => w.department === 'Ext. Manpower').length})</button>
          </div>
        </div>

        {/* Worker list */}
        {loading ? <SkeletonRows /> : (
          <div className="sv-list">
            {filtered.map((w) => {
              const m = marks[w.id];
              const isBusy = busyIds.has(w.id);
              const justMarked = justMarkedIds.has(w.id);
              return (
                <div className={`sv-row${closed ? ' locked' : ''}${justMarked ? ' just-marked' : ''}`} key={w.id}>
                  <div className="sv-row-left">
                    <div className="sv-avatar" aria-hidden="true">
                      {w.name ? w.name.trim().charAt(0).toUpperCase() : 'W'}
                    </div>
                    <div className="sv-row-info">
                      <div className="sv-row-name">
                        <span className="sv-name-text">{w.name}</span>
                      </div>
                      <div className="sv-row-meta">
                        <span className="sv-dept-tag">{w.department}</span>
                        <span className="sv-id-tag">ID: {w.id}</span>
                        {w.designation && <span className="sv-desig-tag">{w.designation}</span>}
                      </div>
                      {m && (
                        <span className={`sv-mark ${m.status}${m.is_late ? ' late' : ''}`}>
                          {m.status === 'present'
                            ? (m.is_late ? '⏰ Late Present' : '✓ Present')
                            : `✕ ${LEAVES.find((l) => l[0] === (m.leave_type || 'unspecified'))?.[1] || 'Absent'}`}
                        </span>
                      )}
                      {m && m.status === 'present' && (
                        <div className="sv-time-row">
                          {m.time_out ? (
                            <>
                              <span className="sv-time-badge hrs">{m.duty_hours || 0}h duty</span>
                              {Number(m.overtime_hours) > 0 && <span className="sv-time-badge ot">+{m.overtime_hours}h OT</span>}
                              {(Number(m.daily_wage) > 0 || Number(m.overtime_wage) > 0) && (
                                <span className="sv-time-badge wage">AED {((Number(m.daily_wage) || 0) + (Number(m.overtime_wage) || 0)).toFixed(2)}</span>
                              )}
                            </>
                          ) : (
                            !closed && <button className="sv-clockout-btn" onClick={() => setClockingOut({ worker: w, mark: m })}>Clock Out</button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="sv-time-cols">
                    <div className="sv-time-col">
                      <span className="sv-time-label">IN</span>
                      <span className={`sv-time-val${m?.time_in ? ' filled' : ''}`}>{m?.time_in || '—'}</span>
                    </div>
                    <div className="sv-time-col">
                      <span className="sv-time-label">OUT</span>
                      <span className={`sv-time-val${m?.time_out ? ' filled' : ''}`}>{m?.time_out || '—'}</span>
                    </div>
                  </div>
                  {!closed && (
                    <div className="sv-seg">
                      <button className={m?.status === 'present' && !m?.is_late ? 'on-p' : ''} onClick={() => !(m?.status === 'present' && !m?.is_late) && save(w, 'present')} disabled={isBusy}>Present</button>
                      <button className={m?.status === 'present' && m?.is_late ? 'on-l' : ''} onClick={() => !(m?.status === 'present' && m?.is_late) && save(w, 'present', null, null, true)} disabled={isBusy}>Late</button>
                      <button className={m?.status === 'absent' ? 'on-a' : ''} onClick={() => setModal({ worker: w })} disabled={isBusy}>Absent</button>
                    </div>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 && !loading && (
              <div className="sv-empty">
                {workers.length === 0 ? 'No workers yet.' : 'No workers match your filters.'}
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* Modals — unchanged */}
      {modal && <AbsentModal
        worker={modal.worker}
        current={marks[modal.worker.id]}
        onClose={() => setModal(null)}
        onSave={(lt, notes) => { save(modal.worker, 'absent', lt, notes); setModal(null); }}
      />}

      {clockingOut && <ClockOutModal
        worker={clockingOut.worker}
        mark={clockingOut.mark}
        date={date}
        shiftConfig={shiftConfig}
        onClose={() => setClockingOut(null)}
        onSaved={(res) => {
          setMarks((prev) => ({
            ...prev,
            [clockingOut.worker.id]: {
              ...prev[clockingOut.worker.id],
              time_out: res.timeOut,
              total_hours: res.hours.total,
              lunch_hours: res.hours.lunch,
              duty_hours: res.hours.duty,
              overtime_hours: res.hours.overtime,
              daily_wage: res.wages.dailyWage,
              overtime_wage: res.wages.overtimeWage,
            },
          }));
          setClockingOut(null);
          showToast(`${clockingOut.worker.name} clocked out — ${res.hours.duty}h duty${res.hours.overtime > 0 ? `, ${res.hours.overtime}h OT` : ''}`);
        }}
      />}

      {editing && <EditWorkerModal worker={editing} onClose={() => setEditing(null)} onSaved={(updated) => {
        setWorkers((ws) => ws.map((w) => w.id === updated.id ? { ...w, ...updated } : w));
        setEditing(null);
        showToast(`${updated.name} updated`);
      }} />}

      {adding && <AddWorkerModal onClose={() => setAdding(false)} onSaved={(worker) => {
        setWorkers((ws) => [...ws, worker].sort((a, b) => a.name.localeCompare(b.name)));
        setAdding(false);
        showToast(`${worker.name} added to the roster`);
      }} />}

      {closing && <CloseDayModal
        date={date}
        workers={workers}
        unmarkedWorkers={unmarkedWorkersList}
        lateWorkers={lateWorkersList}
        absentWorkers={absentWorkersList}
        onClose={() => setClosing(false)}
        onClosed={(result) => {
          setClosing(false);
          setClosed(true);
          setClosedAt(result.closedAt);
          if (result.autoMarkedAbsent > 0) {
            const now = new Date().toISOString();
            const newMarks = {};
            for (const w of unmarkedWorkersList) {
              newMarks[w.id] = { worker_id: w.id, status: 'absent', leave_type: 'unspecified', notes: 'Auto-marked on day close', is_late: false, recorded_at: now };
            }
            setMarks((prev) => ({ ...prev, ...newMarks }));
          }
          showToast(`Day closed — ${result.totalAbsent} absent, ${result.totalLate} late, ${result.emailsQueued} emails queued`);
        }}
        showToast={showToast}
      />}

      <Toast msg={toast?.msg} err={toast?.err} onUndo={toast?.hasUndo ? handleUndo : null} />
    </div>
  );
}

function CloseDayModal({ date, workers, unmarkedWorkers, lateWorkers, absentWorkers, onClose, onClosed, showToast }) {
  const [busy, setBusy] = useState(false);
  const fmtDate = new Date(date + 'T00:00:00Z').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });

  async function handleClose() {
    setBusy(true);
    try {
      const result = await api.closeDay(date);
      onClosed(result);
    } catch (e) {
      showToast(e.message, true);
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal close-modal" onClick={(e) => e.stopPropagation()}>
        <div className="close-modal-icon">🔒</div>
        <h3>Close attendance for the day</h3>
        <div className="msub">{fmtDate}</div>

        <div className="close-summary">
          <div className="close-summary-row">
            <span className="close-label">Total workers</span>
            <span className="close-value">{workers.length}</span>
          </div>
          {unmarkedWorkers.length > 0 && (
            <div className="close-summary-row warn">
              <span className="close-label">Unmarked (will be auto-marked absent)</span>
              <span className="close-value">{unmarkedWorkers.length}</span>
            </div>
          )}
          {absentWorkers.length > 0 && (
            <div className="close-summary-row">
              <span className="close-label">Already marked absent</span>
              <span className="close-value">{absentWorkers.length}</span>
            </div>
          )}
          {lateWorkers.length > 0 && (
            <div className="close-summary-row late">
              <span className="close-label">Late arrivals</span>
              <span className="close-value">{lateWorkers.length}</span>
            </div>
          )}
        </div>

        {(unmarkedWorkers.length > 0 || absentWorkers.length > 0 || lateWorkers.length > 0) && (
          <div className="close-notify-info">
            All absent and late workers with email addresses will receive a notification.
          </div>
        )}

        {unmarkedWorkers.length > 0 && (
          <div className="close-names">
            <div className="close-names-label">Will be auto-marked absent:</div>
            <div className="close-names-list">
              {unmarkedWorkers.map((w) => (
                <span key={w.id} className="close-name-chip">{w.name}</span>
              ))}
            </div>
          </div>
        )}

        <div className="close-warning">
          This action cannot be undone. No further attendance changes can be made for this day.
        </div>

        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn close-day" onClick={handleClose} disabled={busy}>
            {busy ? 'Closing…' : 'Close attendance'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddWorkerModal({ onClose, onSaved }) {
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [workerType, setWorkerType] = useState('company');
  const [basicSalary, setBasicSalary] = useState('');
  const [allowance, setAllowance] = useState('');
  const [otRate, setOtRate] = useState('');
  const [dutyRateHr, setDutyRateHr] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const d = await api.addWorker({
        name, department, designation, email, phone,
        workerType,
        basicSalary: Number(basicSalary) || 0,
        allowance: Number(allowance) || 0,
        otRate: Number(otRate) || 0,
        dutyRateHr: Number(dutyRateHr) || 0,
      });
      onSaved(d.worker);
    } catch (err) {
      setError(err.message || 'Could not add worker');
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Add worker</h3>
        <div className="msub">Enter worker details and salary info.</div>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label>Full name *</label>
            <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ahmed Hassan" required />
          </div>
          <div className="field">
            <label>Worker type</label>
            <select className="input" value={workerType} onChange={(e) => setWorkerType(e.target.value)}>
              <option value="company">Company (salaried)</option>
              <option value="contract">Contract (hourly)</option>
            </select>
          </div>
          <div className="field">
            <label>Designation</label>
            <input className="input" value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Electrician" />
          </div>
          <div className="field">
            <label>Department</label>
            <input className="input" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Electrical" />
          </div>
          <div className="field">
            <label>Email (for notifications)</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="worker@company.com" />
          </div>
          <div className="field">
            <label>Phone</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+971 50 123 4567" />
          </div>
          {workerType === 'company' ? (
            <div className="sv-salary-grid">
              <div className="field">
                <label>Basic salary (AED/mo)</label>
                <input className="input" type="number" min="0" step="50" value={basicSalary} onChange={(e) => setBasicSalary(e.target.value)} placeholder="e.g. 1500" />
              </div>
              <div className="field">
                <label>Allowance (AED/mo)</label>
                <input className="input" type="number" min="0" step="50" value={allowance} onChange={(e) => setAllowance(e.target.value)} placeholder="e.g. 500" />
              </div>
              <div className="field">
                <label>OT rate (AED/hr)</label>
                <input className="input" type="number" min="0" step="0.5" value={otRate} onChange={(e) => setOtRate(e.target.value)} placeholder="Auto from basic" />
              </div>
            </div>
          ) : (
            <div className="sv-salary-grid">
              <div className="field">
                <label>Duty rate (AED/hr)</label>
                <input className="input" type="number" min="0" step="0.5" value={dutyRateHr} onChange={(e) => setDutyRateHr(e.target.value)} placeholder="e.g. 8.50" />
              </div>
              <div className="field">
                <label>OT rate (AED/hr)</label>
                <input className="input" type="number" min="0" step="0.5" value={otRate} onChange={(e) => setOtRate(e.target.value)} placeholder="Same as duty if blank" />
              </div>
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Add worker'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditWorkerModal({ worker, onClose, onSaved }) {
  const [name, setName] = useState(worker.name);
  const [department, setDepartment] = useState(worker.department || '');
  const [email, setEmail] = useState(worker.email || '');
  const [phone, setPhone] = useState(worker.phone || '');
  const [designation, setDesignation] = useState(worker.designation || '');
  const [workerType, setWorkerType] = useState(worker.worker_type || 'company');
  const [basicSalary, setBasicSalary] = useState(String(worker.basic_salary || ''));
  const [allowance, setAllowance] = useState(String(worker.allowance || ''));
  const [otRate, setOtRate] = useState(String(worker.ot_rate || ''));
  const [dutyRateHr, setDutyRateHr] = useState(String(worker.duty_rate_hr || ''));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const d = await api.updateWorker(worker.id, {
        name, department, email, phone, designation,
        workerType,
        basicSalary: Number(basicSalary) || 0,
        allowance: Number(allowance) || 0,
        otRate: Number(otRate) || 0,
        dutyRateHr: Number(dutyRateHr) || 0,
      });
      onSaved(d.worker);
    } catch (err) {
      setError(err.message || 'Could not update worker');
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Edit worker — {worker.id}</h3>
        <div className="msub">Update details and salary info.</div>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label>Full name *</label>
            <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label>Worker type</label>
            <select className="input" value={workerType} onChange={(e) => setWorkerType(e.target.value)}>
              <option value="company">Company (salaried)</option>
              <option value="contract">Contract (hourly)</option>
            </select>
          </div>
          <div className="field">
            <label>Designation</label>
            <input className="input" value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Electrician" />
          </div>
          <div className="field">
            <label>Department</label>
            <input className="input" value={department} onChange={(e) => setDepartment(e.target.value)} />
          </div>
          <div className="field">
            <label>Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label>Phone</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          {workerType === 'company' ? (
            <div className="sv-salary-grid">
              <div className="field">
                <label>Basic salary (AED/mo)</label>
                <input className="input" type="number" min="0" step="50" value={basicSalary} onChange={(e) => setBasicSalary(e.target.value)} placeholder="e.g. 1500" />
              </div>
              <div className="field">
                <label>Allowance (AED/mo)</label>
                <input className="input" type="number" min="0" step="50" value={allowance} onChange={(e) => setAllowance(e.target.value)} placeholder="e.g. 500" />
              </div>
              <div className="field">
                <label>OT rate (AED/hr)</label>
                <input className="input" type="number" min="0" step="0.5" value={otRate} onChange={(e) => setOtRate(e.target.value)} placeholder="Auto from basic" />
              </div>
            </div>
          ) : (
            <div className="sv-salary-grid">
              <div className="field">
                <label>Duty rate (AED/hr)</label>
                <input className="input" type="number" min="0" step="0.5" value={dutyRateHr} onChange={(e) => setDutyRateHr(e.target.value)} placeholder="e.g. 8.50" />
              </div>
              <div className="field">
                <label>OT rate (AED/hr)</label>
                <input className="input" type="number" min="0" step="0.5" value={otRate} onChange={(e) => setOtRate(e.target.value)} placeholder="Same as duty if blank" />
              </div>
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ClockOutModal({ worker, mark, date, shiftConfig, onClose, onSaved }) {
  const hasTimeIn = !!mark.time_in;
  const [timeIn, setTimeIn] = useState(mark.time_in || shiftConfig?.shift_start || '09:00');
  const [timeOut, setTimeOut] = useState(getCurrentTime());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.clockOut(worker.id, date, timeOut, hasTimeIn ? undefined : timeIn);
      onSaved({ ...res, timeOut });
    } catch (err) {
      setError(err.message || 'Could not clock out');
      setBusy(false);
    }
  }

  const inMins = (() => { const [h,m] = timeIn.split(':').map(Number); return h*60+(m||0); })();
  const outMins = (() => { const [h,m] = timeOut.split(':').map(Number); return h*60+(m||0); })();
  const previewTotal = outMins > inMins ? ((outMins - inMins) / 60).toFixed(1) : '—';

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Clock Out — {worker.name}</h3>
        <div className="msub">{hasTimeIn ? <>Clocked in at <strong>{mark.time_in}</strong>.</> : 'No clock-in recorded — enter the in-time below.'} System will calculate duty hours, overtime, and wages automatically.</div>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={submit}>
          {!hasTimeIn && (
            <div className="field">
              <label>In time *</label>
              <input className="input" type="time" value={timeIn} onChange={(e) => setTimeIn(e.target.value)} required />
            </div>
          )}
          <div className="field">
            <label>Out time *</label>
            <input className="input" type="time" value={timeOut} onChange={(e) => setTimeOut(e.target.value)} required />
          </div>
          {previewTotal !== '—' && (
            <div className="sv-clockout-preview">
              Total: {previewTotal}h (lunch deducted on save)
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Clock Out'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AbsentModal({ worker, current, onClose, onSave }) {
  const [lt, setLt] = useState(current?.status === 'absent' ? current.leave_type || 'unspecified' : 'emergency');
  const [notes, setNotes] = useState(current?.notes || '');
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Mark {worker.name} absent</h3>
        <div className="msub">Select the type of leave. This is what the admin reports will categorize.</div>
        <div className="leave-grid">
          {LEAVES.map(([v, label, icon]) => (
            <div key={v} className={`leave-opt ${lt === v ? 'on' : ''}`} onClick={() => setLt(v)}>
              {icon} {label}
            </div>
          ))}
        </div>
        <div className="field">
          <label>Note (optional)</label>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. hospitalized, family emergency…" />
        </div>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn warn" onClick={() => onSave(lt, notes.trim() || null)}>Save absence</button>
        </div>
      </div>
    </div>
  );
}
