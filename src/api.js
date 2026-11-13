async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  me: () => request('/api/me'),
  login: (portal, username, password) => request('/api/login', { method: 'POST', body: { portal, username, password } }),
  logout: () => request('/api/logout', { method: 'POST' }),
  workers: () => request('/api/workers'),
  addWorker: (payload) => request('/api/workers', { method: 'POST', body: payload }),
  updateWorker: (id, payload) => request(`/api/workers/${id}`, { method: 'PATCH', body: payload }),
  attendance: (date) => request(`/api/attendance?date=${date}`),
  mark: (payload) => request('/api/attendance', { method: 'POST', body: payload }),
  markLeaveRange: (payload) => request('/api/attendance/leave-range', { method: 'POST', body: payload }),
  closed: (date) => request(`/api/attendance/closed?date=${date}`),
  clockOut: (workerId, date, timeOut, timeIn, otType) => request('/api/attendance/clock-out', { method: 'POST', body: { workerId, date, timeOut, ...(timeIn ? { timeIn } : {}), ...(otType ? { otType } : {}) } }),
  closeDay: (date) => request('/api/attendance/close', { method: 'POST', body: { date } }),
  shiftConfig: () => request('/api/shift-config'),
  updateShiftConfig: (payload) => request('/api/shift-config', { method: 'PATCH', body: payload }),
  overview: (year, month, today) =>
    request(`/api/admin/overview?year=${year}${month ? `&month=${month}` : ''}${today ? `&today=${today}` : ''}`),
  worker: (id, year) => request(`/api/admin/worker/${id}?year=${year}`),
  payslip: (id, year, month) => request(`/api/admin/worker/${id}/payslip?year=${year}&month=${month}`),
  holidays: (year) => request(`/api/holidays?year=${year}`),
  addHoliday: (date, name, type) => request('/api/admin/holidays', { method: 'POST', body: { date, name, type } }),
  deleteHoliday: (id) => request(`/api/admin/holidays/${id}`, { method: 'DELETE' }),
  getSetting: (key) => request(`/api/settings/${key}`),
  updateSetting: (key, value) => request(`/api/settings/${key}`, { method: 'PATCH', body: { value } }),
  supervisors: () => request('/api/admin/supervisors'),
  addSupervisor: (payload) => request('/api/admin/supervisors', { method: 'POST', body: payload }),
  updateSupervisor: (id, payload) => request(`/api/admin/supervisors/${id}`, { method: 'PATCH', body: payload }),
  companies: (all = false) => request(`/api/companies${all ? '?all=1' : ''}`),
  addCompany: (payload) => request('/api/admin/companies', { method: 'POST', body: payload }),
  updateCompany: (id, payload) => request(`/api/admin/companies/${id}`, { method: 'PATCH', body: payload }),
  deleteCompany: (id) => request(`/api/admin/companies/${id}`, { method: 'DELETE' }),
  updateAttendanceSite: (payload) => request('/api/attendance/site', { method: 'POST', body: payload }),
};

export function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function daysAgoStr(days) {
  return todayStrFrom(new Date(Date.now() - days * 864e5));
}

function todayStrFrom(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fmtDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

export function formatExperience(doj, workerType, dept) {
  if (!doj) return '—';
  const type = workerType || '';
  if (type === 'contract' || dept === 'Ext. Manpower') return '—';

  const start = new Date(doj.includes('T') ? doj : doj + 'T00:00:00');
  if (isNaN(start.getTime())) return '—';

  const now = new Date();
  if (now < start) return '0 yrs';

  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  if (now.getDate() < start.getDate()) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years === 0 && months === 0) return '< 1 mo';
  if (years === 0) return `${months} mo${months === 1 ? '' : 's'}`;
  if (months === 0) return `${years} yr${years === 1 ? '' : 's'}`;
  return `${years} yr${years === 1 ? '' : 's'} ${months} mo${months === 1 ? '' : 's'}`;
}
