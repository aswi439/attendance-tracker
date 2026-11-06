import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { sign, verify } from 'hono/jwt';
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Phase 1 credentials (hardcoded per plan — change these anytime)
// ---------------------------------------------------------------------------
const ADMIN_CREDS = { username: 'admin', password: 'admin123' };

const SECRET = 'attendance-tracker-phase1-secret';
const SESSION_TTL = 12 * 60 * 60; // 12h
const BACKFILL_LIMIT_DAYS = 14;

export const LEAVE_TYPES = ['ml', 'emergency', 'work_related', 'casual', 'unpaid', 'unspecified'];
export const LEAVE_LABELS = {
  ml: 'Medical Leave (ML)',
  emergency: 'Emergency Leave',
  work_related: 'Work-related',
  casual: 'Casual Leave',
  unpaid: 'Unpaid Leave',
  unspecified: 'Unspecified',
};

// ---------------------------------------------------------------------------
export const app = new Hono();

export function getEnv(c) {
  const env = c?.env || {};
  return {
    SUPABASE_URL: env.SUPABASE_URL || (typeof process !== 'undefined' ? process.env?.SUPABASE_URL : undefined),
    SUPABASE_KEY: env.SUPABASE_KEY || (typeof process !== 'undefined' ? process.env?.SUPABASE_KEY : undefined),
    RESEND_API_KEY: env.RESEND_API_KEY || (typeof process !== 'undefined' ? process.env?.RESEND_API_KEY : undefined),
    RESEND_FROM: env.RESEND_FROM || (typeof process !== 'undefined' ? process.env?.RESEND_FROM : undefined),
    ASSETS: env.ASSETS,
  };
}

function getSupabase(cOrEnv) {
  const env = cOrEnv?.env ? getEnv(cOrEnv) : (cOrEnv?.SUPABASE_URL ? cOrEnv : getEnv(null));
  return createClient(env.SUPABASE_URL, env.SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// --- seed (safe to run repeatedly via meta marker) -------------------------
let seedPromise = null;
function ensureSeeded(sb) {
  if (!seedPromise) {
    seedPromise = checkAndSeed(sb).catch((e) => {
      seedPromise = null;
      throw e;
    });
  }
  return seedPromise;
}

const UAE_HOLIDAYS = [
  ['01-01', "New Year's Day"],
  ['03-20', "Isra'a Wal Mi'raj"],
  ['03-30', 'Eid Al Fitr (Day 1)'],
  ['03-31', 'Eid Al Fitr (Day 2)'],
  ['04-01', 'Eid Al Fitr (Day 3)'],
  ['06-05', 'Arafat Day (Haj)'],
  ['06-06', 'Eid Al Adha (Day 1)'],
  ['06-07', 'Eid Al Adha (Day 2)'],
  ['06-08', 'Eid Al Adha (Day 3)'],
  ['06-26', 'Al Hijra (Islamic New Year)'],
  ['09-04', "Prophet Muhammad's Birthday"],
  ['11-30', 'Commemoration Day'],
  ['12-02', 'UAE National Day'],
  ['12-03', 'UAE National Day (Day 2)'],
];

async function checkAndSeed(sb) {
  const { data: marker } = await sb.from('meta').select('value').eq('key', 'seed').single();
  if (!marker || marker.value !== 'v12') await seed(sb);
  await sb.from('supervisors').upsert({
    username: 'supervisor',
    password: 'supervisor123',
    name: 'Default Supervisor',
    email: null, phone: null,
    active: true,
    created_at: new Date().toISOString(),
  }, { onConflict: 'username', ignoreDuplicates: true });

  const { data: migMarker } = await sb.from('meta').select('value').eq('key', 'holidays_uae').single();
  if (!migMarker) {
    await sb.from('holidays').delete().neq('id', 0);
    const year = new Date().getUTCFullYear();
    const rows = UAE_HOLIDAYS.map(([md, name]) => ({
      date: `${year}-${md}`, name, type: 'government',
    }));
    await sb.from('holidays').upsert(rows, { onConflict: 'date', ignoreDuplicates: true });
    await sb.from('meta').upsert({ key: 'holidays_uae', value: 'v1' });
  }
}

async function seed(sb) {
  const now = new Date().toISOString();
  const WORKERS = [
    { id: 'W001', name: 'Shahed Ahmed Siraj',          department: 'Ext. Manpower', type: 'contract', basic: 0, allowance: 0, otRate: 8.5,  dutyRateHr: 8.5,  designation: null, rovMonth: 550, transportMonth: 300, otherExpHr: 3.66 },
    { id: 'W002', name: 'Ahmad Habib',                  department: 'Ext. Manpower', type: 'contract', basic: 0, allowance: 0, otRate: 8.5,  dutyRateHr: 8.5,  designation: null, rovMonth: 550, transportMonth: 300, otherExpHr: 3.66 },
    { id: 'W003', name: 'Nascon Buse',                  department: 'Ext. Manpower', type: 'contract', basic: 0, allowance: 0, otRate: 15,   dutyRateHr: 15,   designation: null, rovMonth: 550, transportMonth: 300, otherExpHr: 3.66 },
    { id: 'W004', name: 'Usaman Transport',             department: 'Ext. Manpower', type: 'contract', basic: 0, allowance: 0, otRate: 10,   dutyRateHr: 10,   designation: null, rovMonth: 550, transportMonth: 300, otherExpHr: 3.66 },
    { id: 'W005', name: 'Sulthan Abdul Kadar',          department: 'Electrical',    type: 'company',  basic: 1500, allowance: 2000, otRate: 0, dutyRateHr: 0, designation: 'Electrical Engineer', doj: '2023-05-01', rovMonth: 1050, transportMonth: 300, otherExpHr: 5.82 },
    { id: 'W006', name: 'Alli Radha',                   department: 'General',       type: 'company',  basic: 1300, allowance: 700,  otRate: 0, dutyRateHr: 0, designation: 'Oner', doj: '2022-01-27', rovMonth: 1050, transportMonth: 300, otherExpHr: 5.82 },
    { id: 'W007', name: 'Prabakaran Selvarasu',         department: 'Electrical',    type: 'company',  basic: 600,  allowance: 300,  otRate: 0, dutyRateHr: 0, designation: 'Electrician Assistant', doj: '2023-06-16', rovMonth: 1050, transportMonth: 300, otherExpHr: 5.82 },
    { id: 'W008', name: 'Ganagasabai Subramanian',      department: 'Plumbing',      type: 'company',  basic: 800,  allowance: 400,  otRate: 0, dutyRateHr: 0, designation: 'Plumber', doj: '2023-06-16', rovMonth: 1050, transportMonth: 300, otherExpHr: 5.82 },
    { id: 'W009', name: 'Aravindran Rajendran',         department: 'Electrical',    type: 'company',  basic: 1000, allowance: 500,  otRate: 0, dutyRateHr: 0, designation: 'Electrician Assistant', doj: '2023-03-28', rovMonth: 1050, transportMonth: 300, otherExpHr: 5.82 },
    { id: 'W010', name: 'Arulazhagan Goplakrishnan',    department: 'Masonry',       type: 'company',  basic: 1000, allowance: 600,  otRate: 0, dutyRateHr: 0, designation: 'Brick Layer', doj: '2022-05-14', rovMonth: 1050, transportMonth: 300, otherExpHr: 5.82 },
    { id: 'W011', name: 'Rajiv Nallathampi',            department: 'Admin',         type: 'company',  basic: 600,  allowance: 300,  otRate: 0, dutyRateHr: 0, designation: 'Data Entry Clerk', doj: '2022-05-14', rovMonth: 1050, transportMonth: 300, otherExpHr: 5.82 },
    { id: 'W012', name: 'Krishna Samy',                 department: 'HVAC',          type: 'company',  basic: 1300, allowance: 500,  otRate: 0, dutyRateHr: 0, designation: 'A/C Mechanic', doj: '2022-05-14', rovMonth: 1050, transportMonth: 300, otherExpHr: 5.82 },
    { id: 'W013', name: 'Krishnarasu Kaliyaperumal',    department: 'Mechanical',    type: 'company',  basic: 900,  allowance: 300,  otRate: 0, dutyRateHr: 0, designation: 'Mechanic Assistant', doj: '2023-04-17', rovMonth: 1050, transportMonth: 300, otherExpHr: 5.82 },
    { id: 'W014', name: 'Moorthy Krishnamoorthy',       department: 'General',       type: 'company',  basic: 600,  allowance: 300,  otRate: 0, dutyRateHr: 0, designation: null, rovMonth: 1050, transportMonth: 300, otherExpHr: 5.82 },
    { id: 'W015', name: 'Muppudathi Periyasamy',        department: 'Tiling',        type: 'company',  basic: 800,  allowance: 500,  otRate: 0, dutyRateHr: 0, designation: 'Tile Layer Assistant', doj: '2023-12-03', rovMonth: 1050, transportMonth: 300, otherExpHr: 5.82 },
    { id: 'W016', name: 'Michael Kumarimannan',         department: 'Masonry',       type: 'company',  basic: 900,  allowance: 300,  otRate: 0, dutyRateHr: 0, designation: 'Brick Layer', doj: '2022-05-21', rovMonth: 1050, transportMonth: 300, otherExpHr: 5.82 },
  ];

  await sb.from('attendance').delete().neq('worker_id', '');
  await sb.from('workers').delete().neq('id', '');

  for (const w of WORKERS) {
    const full = {
      id: w.id, name: w.name, department: w.department,
      daily_rate: 0, basic_salary: w.basic, allowance: w.allowance,
      ot_rate: w.otRate, designation: w.designation,
      active: true, created_at: now,
    };
    let { error } = await sb.from('workers').upsert(full, { onConflict: 'id' });
    if (error) {
      await sb.from('workers').upsert({
        id: w.id, name: w.name, department: w.department,
        daily_rate: 0, active: true, created_at: now,
      }, { onConflict: 'id' });
    }
    await sb.from('meta').upsert({
      key: `worker_extra:${w.id}`,
      value: JSON.stringify({
        worker_type: w.type,
        duty_rate_hr: w.dutyRateHr,
        basic_salary: w.basic,
        allowance: w.allowance,
        ot_rate: w.otRate,
        designation: w.designation || null,
        doj: w.doj || null,
        rov_monthly: w.rovMonth || 0,
        transport_monthly: w.transportMonth || 0,
        other_expense_hr: w.otherExpHr || 0,
      }),
    }, { onConflict: 'key' });
  }

  const WORK_HRS = 8;
  const LUNCH_HRS = 1;

  const pad = (n) => String(n).padStart(2, '0');
  const midnight = new Date();
  midnight.setUTCHours(0, 0, 0, 0);
  const end = midnight.getTime();
  const start = end - 60 * 864e5;
  const attRows = [];
  const timeRows = [];

  function seedCalcWages(w, dutyHrs, otHrs, dateStr) {
    const [y, m] = dateStr.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const basic = w.basic || 0;
    const allow = w.allowance || 0;
    const isContract = w.type === 'contract';
    let hourlyRate, otRate;
    if (isContract) {
      const fixedRate = w.dutyRateHr || w.otRate || 0;
      hourlyRate = fixedRate;
      otRate = w.otRate || fixedRate;
    } else {
      hourlyRate = (basic + allow) > 0
        ? (basic + allow) / (daysInMonth * WORK_HRS)
        : 0;
      otRate = w.otRate || (basic > 0 ? basic / (daysInMonth * WORK_HRS) : 0);
    }
    return {
      dailyWage: Math.round(dutyHrs * hourlyRate * 100) / 100,
      overtimeWage: Math.round(otHrs * otRate * 100) / 100,
      hourlyRate: Math.round(hourlyRate * 100) / 100,
      otRate: Math.round(otRate * 100) / 100,
    };
  }

  for (let t = start; t < end; t += 864e5) {
    const d = new Date(t);
    const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    if (d.getUTCDay() === 0) continue;
    for (const w of WORKERS) {
      const r = Math.random();
      const inH = 7 + Math.floor(Math.random() * 2);
      const inM = Math.floor(Math.random() * 30);
      const timeIn = `${pad(inH)}:${pad(inM)}`;
      const ts = `${date}T${timeIn}:00Z`;

      if (r < 0.85) {
        const outH = w.type === 'contract'
          ? 15 + Math.floor(Math.random() * 7)
          : 17 + Math.floor(Math.random() * 5);
        const outM = Math.floor(Math.random() * 60);
        const timeOut = `${pad(Math.min(outH, 23))}:${pad(outM)}`;
        const totalHrs = (parseTimeToMins(timeOut) - parseTimeToMins(timeIn)) / 60;
        const netHrs = Math.max(0, totalHrs - LUNCH_HRS);
        const dutyHrs = Math.min(netHrs, WORK_HRS);
        const otHrs = Math.max(0, netHrs - WORK_HRS);
        const wages = seedCalcWages(w, dutyHrs, otHrs, date);
        const isLate = inH >= 10 || (inH === 9 && inM > 30);

        attRows.push({ worker_id: w.id, date, status: 'present', leave_type: null, notes: null, recorded_by: 'demo-data', recorded_at: ts, updated_at: ts, is_late: isLate });
        timeRows.push({
          key: `time:${w.id}:${date}`,
          value: JSON.stringify({
            time_in: timeIn,
            time_out: timeOut,
            total_hours: Math.round(totalHrs * 100) / 100,
            lunch_hours: LUNCH_HRS,
            duty_hours: Math.round(dutyHrs * 100) / 100,
            overtime_hours: Math.round(otHrs * 100) / 100,
            daily_wage: wages.dailyWage,
            overtime_wage: wages.overtimeWage,
          }),
        });
      } else {
        const lr = Math.random();
        const lt =
          lr < 0.32 ? 'ml' : lr < 0.52 ? 'emergency' : lr < 0.72 ? 'casual' :
          lr < 0.87 ? 'work_related' : lr < 0.95 ? 'unpaid' : 'unspecified';
        attRows.push({ worker_id: w.id, date, status: 'absent', leave_type: lt, notes: null, recorded_by: 'demo-data', recorded_at: ts, updated_at: ts, is_late: false });
      }
    }
  }

  for (let i = 0; i < attRows.length; i += 500) {
    await sb.from('attendance').upsert(attRows.slice(i, i + 500), { onConflict: 'worker_id,date', ignoreDuplicates: true });
  }
  for (let i = 0; i < timeRows.length; i += 500) {
    await sb.from('meta').upsert(timeRows.slice(i, i + 500), { onConflict: 'key' });
  }

  await sb.from('supervisors').upsert({
    username: 'supervisor',
    password: 'supervisor123',
    name: 'Default Supervisor',
    email: null,
    phone: null,
    active: true,
    created_at: new Date().toISOString(),
  }, { onConflict: 'username', ignoreDuplicates: true });

  await sb.from('meta').upsert({ key: 'seed', value: 'v12' });
}

// --- auth helpers -----------------------------------------------------------
async function makeToken(role) {
  return sign({ role, exp: Math.floor(Date.now() / 1000) + SESSION_TTL }, SECRET);
}

async function getRole(c) {
  const token = getCookie(c, 'at_session');
  if (!token) return null;
  try {
    return (await verify(token, SECRET, 'HS256')).role;
  } catch {
    return null;
  }
}

async function requireRole(c, role) {
  const r = await getRole(c);
  if (r !== role) return c.json({ error: 'unauthorized' }, 401);
  return null;
}

const validDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
const validTime = (s) => /^\d{1,2}:\d{2}$/.test(s || '');

function parseTimeToMins(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function getDaysInMonth(dateStr) {
  const [y, m] = dateStr.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function calcWages(worker, dutyHrs, otHrs, dateStr, workHoursPerDay) {
  const daysInMonth = getDaysInMonth(dateStr);
  const basic = Number(worker.basic_salary) || 0;
  const allow = Number(worker.allowance) || 0;
  const isContract = worker.worker_type === 'contract';

  let hourlyRate, otRate;
  if (isContract) {
    // Contract workers: fixed hourly rate for both duty and OT
    // If duty_rate_hr is set use it, otherwise fall back to ot_rate (same value)
    const fixedRate = Number(worker.duty_rate_hr) || Number(worker.ot_rate) || 0;
    hourlyRate = fixedRate;
    otRate = Number(worker.ot_rate) || fixedRate;
  } else {
    // Company workers: calculated from basic + allowance / (days_in_month * work_hours)
    hourlyRate = (basic + allow) > 0
      ? (basic + allow) / (daysInMonth * workHoursPerDay)
      : (Number(worker.daily_rate) || 0) / workHoursPerDay;
    otRate = Number(worker.ot_rate) || (basic > 0 ? basic / (daysInMonth * workHoursPerDay) : 0);
  }
  return {
    dailyWage: Math.round(dutyHrs * hourlyRate * 100) / 100,
    overtimeWage: Math.round(otHrs * otRate * 100) / 100,
    hourlyRate: Math.round(hourlyRate * 100) / 100,
    otRate: Math.round(otRate * 100) / 100,
  };
}

// --- middleware: init supabase + seed check ---------------------------------
app.use('/api/*', async (c, next) => {
  const sb = getSupabase(c);
  c.set('sb', sb);
  await ensureSeeded(sb);
  await next();
});

// --- session ----------------------------------------------------------------
app.post('/api/login', async (c) => {
  const { portal, username, password } = await c.req.json();
  const sb = c.get('sb');

  if (portal === 'admin') {
    if (username !== ADMIN_CREDS.username || password !== ADMIN_CREDS.password) {
      return c.json({ error: 'Invalid username or password' }, 401);
    }
  } else if (portal === 'supervisor') {
    const { data: sup } = await sb
      .from('supervisors')
      .select('id, active')
      .eq('username', username)
      .eq('password', password)
      .single();
    if (!sup) return c.json({ error: 'Invalid username or password' }, 401);
    if (!sup.active) return c.json({ error: 'This supervisor account has been deactivated' }, 403);
  } else {
    return c.json({ error: 'Unknown portal' }, 400);
  }

  const token = await makeToken(portal);
  setCookie(c, 'at_session', token, {
    path: '/', httpOnly: true, sameSite: 'Lax', maxAge: SESSION_TTL,
  });
  return c.json({ ok: true, role: portal });
});

app.post('/api/logout', (c) => {
  deleteCookie(c, 'at_session', { path: '/' });
  return c.json({ ok: true });
});

app.get('/api/me', async (c) => {
  try {
    const role = await getRole(c);
    return c.json({ role: role || null });
  } catch {
    return c.json({ role: null });
  }
});

// --- supervisor APIs ----------------------------------------------------------
app.use('/api/workers', async (c, next) => {
  const denied = await requireRole(c, 'supervisor');
  if (denied) return denied;
  await next();
});
app.use('/api/attendance*', async (c, next) => {
  const denied = await requireRole(c, 'supervisor');
  if (denied) return denied;
  await next();
});

app.get('/api/workers', async (c) => {
  const sb = c.get('sb');
  let { data, error } = await sb.from('workers')
    .select('id, name, department, email, phone, daily_rate, basic_salary, allowance, ot_rate, designation')
    .eq('active', true).order('name');
  if (error) {
    ({ data, error } = await sb.from('workers')
      .select('id, name, department, email, phone, daily_rate')
      .eq('active', true).order('name'));
  }
  if (error) return c.json({ error: error.message }, 500);

  const { data: extras } = await sb.from('meta').select('key, value').like('key', 'worker_extra:%');
  const extraMap = {};
  for (const e of extras || []) {
    const wid = e.key.replace('worker_extra:', '');
    try { extraMap[wid] = JSON.parse(e.value); } catch {}
  }
  for (const w of data || []) {
    const ex = extraMap[w.id];
    if (ex) { w.worker_type = ex.worker_type || 'company'; w.duty_rate_hr = ex.duty_rate_hr || 0; }
    else { w.worker_type = 'company'; w.duty_rate_hr = 0; }
  }

  return c.json({ workers: data });
});

app.post('/api/workers', async (c) => {
  const sb = c.get('sb');
  const body = await c.req.json();
  const name = (body.name || '').trim();
  const department = (body.department || '').trim();
  const email = (body.email || '').trim().toLowerCase();
  const phone = (body.phone || '').trim();
  const dailyRate = Math.max(0, Number(body.dailyRate) || 0);

  if (!name || name.length > 120) return c.json({ error: 'Worker name is required' }, 400);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: 'Invalid email address' }, 400);
  }
  if (phone && !/^[+\d\-()\s]{5,20}$/.test(phone)) {
    return c.json({ error: 'Invalid phone number' }, 400);
  }

  const { data: maxRow } = await sb
    .from('workers')
    .select('id')
    .like('id', 'W%')
    .order('id', { ascending: false })
    .limit(1)
    .single();

  let workerId;
  const m = maxRow && /^W(\d{3,4})$/.exec(maxRow.id);
  if (m) {
    const n = Number(m[1]) + 1;
    workerId = `W${String(n).padStart(m[1].length, '0')}`;
  } else {
    workerId = `W${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  }

  const basicSalary = Math.max(0, Number(body.basicSalary) || 0);
  const allowanceAmt = Math.max(0, Number(body.allowance) || 0);
  const otRateVal = Math.max(0, Number(body.otRate) || 0);
  const designation = (body.designation || '').trim() || null;

  let { error } = await sb.from('workers').insert({
    id: workerId, name, department,
    email: email || null, phone: phone || null,
    daily_rate: dailyRate, basic_salary: basicSalary, allowance: allowanceAmt,
    ot_rate: otRateVal, designation,
    active: true, created_at: new Date().toISOString(),
  });
  if (error) {
    ({ error } = await sb.from('workers').insert({
      id: workerId, name, department,
      email: email || null, phone: phone || null,
      daily_rate: dailyRate, active: true, created_at: new Date().toISOString(),
    }));
  }
  if (error) return c.json({ error: error.message }, 500);

  const workerType = body.workerType === 'contract' ? 'contract' : 'company';
  const dutyRateHr = Math.max(0, Number(body.dutyRateHr) || 0);
  await sb.from('meta').upsert({ key: `worker_extra:${workerId}`, value: JSON.stringify({
    worker_type: workerType, duty_rate_hr: dutyRateHr,
    basic_salary: basicSalary, allowance: allowanceAmt, ot_rate: otRateVal, designation,
    doj: body.doj || null,
    rov_monthly: Math.max(0, Number(body.rovMonthly) || 0),
    transport_monthly: Math.max(0, Number(body.transportMonthly) || 0),
    other_expense_hr: Math.max(0, Number(body.otherExpenseHr) || 0),
  }) });

  return c.json({ ok: true, worker: { id: workerId, name, department, email: email || null, phone: phone || null, daily_rate: dailyRate, basic_salary: basicSalary, allowance: allowanceAmt, ot_rate: otRateVal, designation, worker_type: workerType, duty_rate_hr: dutyRateHr } });
});

app.patch('/api/workers/:id', async (c) => {
  const sb = c.get('sb');
  const id = c.req.param('id');
  const body = await c.req.json();
  const updates = {};

  if ('name' in body && body.name?.trim()) updates.name = body.name.trim();
  if ('department' in body) updates.department = (body.department || '').trim();
  if ('email' in body) {
    const em = (body.email || '').trim().toLowerCase();
    if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return c.json({ error: 'Invalid email address' }, 400);
    updates.email = em || null;
  }
  if ('phone' in body) {
    const ph = (body.phone || '').trim();
    if (ph && !/^[+\d\-()\s]{5,20}$/.test(ph)) return c.json({ error: 'Invalid phone number' }, 400);
    updates.phone = ph || null;
  }
  if ('dailyRate' in body) updates.daily_rate = Math.max(0, Number(body.dailyRate) || 0);
  if ('basicSalary' in body) updates.basic_salary = Math.max(0, Number(body.basicSalary) || 0);
  if ('allowance' in body) updates.allowance = Math.max(0, Number(body.allowance) || 0);
  if ('otRate' in body) updates.ot_rate = Math.max(0, Number(body.otRate) || 0);
  if ('designation' in body) updates.designation = (body.designation || '').trim() || null;

  if (Object.keys(updates).length === 0) return c.json({ error: 'No valid fields to update' }, 400);

  let { data, error } = await sb.from('workers').update(updates).eq('id', id)
    .select('id, name, department, email, phone, daily_rate, basic_salary, allowance, ot_rate, designation').single();
  if (error) {
    const safeUpdates = {};
    for (const k of ['name', 'department', 'email', 'phone', 'daily_rate']) {
      if (k in updates) safeUpdates[k] = updates[k];
    }
    if (Object.keys(safeUpdates).length > 0) {
      ({ data, error } = await sb.from('workers').update(safeUpdates).eq('id', id)
        .select('id, name, department, email, phone, daily_rate').single());
    }
  }
  if (error) return c.json({ error: error.message }, 500);
  if (!data) return c.json({ error: 'Worker not found' }, 404);

  {
    const metaKey = `worker_extra:${id}`;
    const { data: existing } = await sb.from('meta').select('value').eq('key', metaKey).single();
    let extra = {};
    if (existing?.value) try { extra = JSON.parse(existing.value); } catch {}
    if ('workerType' in body) extra.worker_type = body.workerType === 'contract' ? 'contract' : 'company';
    if ('dutyRateHr' in body) extra.duty_rate_hr = Math.max(0, Number(body.dutyRateHr) || 0);
    if ('basicSalary' in body) extra.basic_salary = Math.max(0, Number(body.basicSalary) || 0);
    if ('allowance' in body) extra.allowance = Math.max(0, Number(body.allowance) || 0);
    if ('otRate' in body) extra.ot_rate = Math.max(0, Number(body.otRate) || 0);
    if ('designation' in body) extra.designation = (body.designation || '').trim() || null;
    if ('doj' in body) extra.doj = body.doj || null;
    if ('rovMonthly' in body) extra.rov_monthly = Math.max(0, Number(body.rovMonthly) || 0);
    if ('transportMonthly' in body) extra.transport_monthly = Math.max(0, Number(body.transportMonthly) || 0);
    if ('otherExpenseHr' in body) extra.other_expense_hr = Math.max(0, Number(body.otherExpenseHr) || 0);
    await sb.from('meta').upsert({ key: metaKey, value: JSON.stringify(extra) });
    Object.assign(data, extra);
  }

  return c.json({ ok: true, worker: data });
});

app.get('/api/attendance', async (c) => {
  const date = c.req.query('date');
  if (!validDate(date)) return c.json({ error: 'bad date' }, 400);
  const sb = c.get('sb');
  let { data, error } = await sb.from('attendance')
    .select('worker_id, status, leave_type, notes, is_late, recorded_at, time_in, time_out, total_hours, lunch_hours, duty_hours, overtime_hours, daily_wage, overtime_wage')
    .eq('date', date);
  if (error) {
    ({ data, error } = await sb.from('attendance')
      .select('worker_id, status, leave_type, notes, is_late, recorded_at')
      .eq('date', date));
  }
  if (error) return c.json({ error: error.message }, 500);

  const { data: timeEntries } = await sb.from('meta').select('key, value').like('key', `time:%:${date}`);
  const timeMap = {};
  for (const t of timeEntries || []) {
    const wid = t.key.split(':')[1];
    try { timeMap[wid] = JSON.parse(t.value); } catch {}
  }
  for (const r of data || []) {
    const td = timeMap[r.worker_id];
    if (td) {
      if (!r.time_in) r.time_in = td.time_in || null;
      if (!r.time_out) r.time_out = td.time_out || null;
      if (!r.duty_hours && td.duty_hours) r.duty_hours = td.duty_hours;
      if (!r.overtime_hours && td.overtime_hours) r.overtime_hours = td.overtime_hours;
      if (!r.daily_wage && td.daily_wage) r.daily_wage = td.daily_wage;
      if (!r.overtime_wage && td.overtime_wage) r.overtime_wage = td.overtime_wage;
    }
  }
  return c.json({ records: data });
});

app.post('/api/attendance', async (c) => {
  const sb = c.get('sb');
  const body = await c.req.json();
  const { workerId, date, status } = body;
  const leaveType = status === 'absent' ? (body.leaveType || 'unspecified') : null;
  const notes = body.notes ? String(body.notes).slice(0, 300) : null;
  const isLate = status === 'present' && body.isLate ? true : false;

  if (!validDate(date) || !['present', 'absent'].includes(status)) {
    return c.json({ error: 'bad input' }, 400);
  }
  if (status === 'absent' && !LEAVE_TYPES.includes(leaveType)) {
    return c.json({ error: 'bad leave type' }, 400);
  }

  const today = validDate(body.today) ? body.today : new Date().toISOString().slice(0, 10);
  const limit = new Date(new Date(today + 'T00:00:00Z').getTime() - BACKFILL_LIMIT_DAYS * 864e5)
    .toISOString().slice(0, 10);
  if (date > today || date < limit) {
    return c.json({ error: `Date must be between ${limit} and ${today}` }, 400);
  }

  const { data: worker } = await sb
    .from('workers')
    .select('id, name, email')
    .eq('id', workerId).eq('active', true)
    .single();
  if (!worker) return c.json({ error: 'unknown worker' }, 404);

  const { data: prior } = await sb
    .from('attendance')
    .select('status')
    .eq('worker_id', workerId).eq('date', date)
    .single();
  const justMarkedAbsent = status === 'absent' && (!prior || prior.status === 'present');

  const timeIn = status === 'present' && validTime(body.timeIn) ? body.timeIn : null;

  const now = new Date().toISOString();
  const row = {
    worker_id: workerId, date, status,
    leave_type: leaveType, notes,
    recorded_by: 'supervisor', recorded_at: now, updated_at: now,
    is_late: isLate,
  };
  if (timeIn) row.time_in = timeIn;
  if (status === 'absent') {
    row.time_in = null; row.time_out = null; row.total_hours = null;
    row.lunch_hours = 0; row.duty_hours = 0; row.overtime_hours = 0;
    row.daily_wage = 0; row.overtime_wage = 0;
  }

  let { error } = await sb.from('attendance').upsert(row, { onConflict: 'worker_id,date' });
  if (error) {
    const basic = { worker_id: workerId, date, status, leave_type: leaveType, notes, recorded_by: 'supervisor', recorded_at: now, updated_at: now, is_late: isLate };
    ({ error } = await sb.from('attendance').upsert(basic, { onConflict: 'worker_id,date' }));
  }
  if (error) return c.json({ error: error.message }, 500);

  if (timeIn) {
    await sb.from('meta').upsert({ key: `time:${workerId}:${date}`, value: JSON.stringify({ time_in: timeIn }) });
  }
  if (status === 'absent') {
    await sb.from('meta').delete().eq('key', `time:${workerId}:${date}`);
  }

  let emailSent = false;
  const env = getEnv(c);
  if (justMarkedAbsent && worker.email && env.RESEND_API_KEY) {
    try {
      await sendAbsenceEmail(env, worker, date, leaveType, notes);
      emailSent = true;
    } catch {}
  }

  return c.json({ ok: true, emailSent });
});

// --- absence notification email ----------------------------------------------
async function sendAbsenceEmail(env, worker, date, leaveType, notes) {
  if (!env.RESEND_API_KEY || !worker.email) return;
  const label = LEAVE_LABELS[leaveType || 'unspecified'] || 'Unspecified';
  const fmt = new Date(date + 'T00:00:00Z').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.RESEND_FROM || 'WorkTrack Attendance <onboarding@resend.dev>',
      to: [worker.email],
      subject: `Absence recorded — ${fmt}`,
      text:
        `Hello ${worker.name},\n\n` +
        `You have been marked ABSENT on ${fmt}.\n` +
        `Type of leave: ${label}\n` +
        (notes ? `Note from supervisor: ${notes}\n` : '') +
        `\nIf you believe this is a mistake, please contact your supervisor.`,
      html:
        `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;` +
        `background:#0b132b;color:#e8edf7;border-radius:12px">` +
        `<h2 style="color:#f4d6b0;margin:0 0 4px">Absence recorded</h2>` +
        `<p style="color:#9db0cd;margin:0 0 18px">WorkTrack Attendance System</p>` +
        `<p>Hello <strong>${worker.name}</strong>,</p>` +
        `<p>You have been marked <strong style="color:#d97706">ABSENT</strong> on ` +
        `<strong>${fmt}</strong>.</p>` +
        `<p style="background:#3a506b66;padding:10px 16px;border-radius:8px">Type of leave: <strong>${label}</strong></p>` +
        (notes ? `<p style="background:#3a506b66;padding:10px 16px;border-radius:8px">Note from supervisor: ${notes}</p>` : '') +
        `<p style="color:#9db0cd">If you believe this is a mistake, please contact your supervisor.</p>` +
        `</div>`,
    }),
  });
}

// --- shift config (stored in meta table — no migration needed) ----------------
const SHIFT_DEFAULTS = { shift_start: '09:00', shift_end: '18:00', work_hours: 8, lunch_hours: 1 };

async function getShiftConfig(sb) {
  const { data } = await sb.from('meta').select('value').eq('key', 'shift_config').single();
  if (data?.value) try { return { ...SHIFT_DEFAULTS, ...JSON.parse(data.value) }; } catch {}
  return { ...SHIFT_DEFAULTS };
}

// --- clock out (record out time + calculate wages) ---------------------------
app.post('/api/attendance/clock-out', async (c) => {
  const sb = c.get('sb');
  const body = await c.req.json();
  const { workerId, date } = body;
  const timeOut = body.timeOut;
  const timeInOverride = body.timeIn;

  if (!validDate(date) || !validTime(timeOut)) return c.json({ error: 'bad input' }, 400);

  let { data: rec } = await sb.from('attendance')
    .select('worker_id, status')
    .eq('worker_id', workerId).eq('date', date).single();
  if (!rec) return c.json({ error: 'No attendance record for this date' }, 404);
  if (rec.status !== 'present') return c.json({ error: 'Worker is not marked present' }, 400);

  const metaKey = `time:${workerId}:${date}`;
  const { data: timeMeta } = await sb.from('meta').select('value').eq('key', metaKey).single();
  let timeData = {};
  if (timeMeta?.value) try { timeData = JSON.parse(timeMeta.value); } catch {}

  const shiftCfg = await getShiftConfig(sb);
  const workHrs = Number(shiftCfg.work_hours) || 8;
  const lunchHrs = Number(shiftCfg.lunch_hours) || 1;

  const timeIn = timeInOverride || timeData.time_in || shiftCfg.shift_start;
  if (!validTime(timeIn)) return c.json({ error: 'No clock-in time available' }, 400);

  let { data: worker } = await sb.from('workers')
    .select('basic_salary, allowance, ot_rate, daily_rate')
    .eq('id', workerId).single();
  if (!worker) {
    ({ data: worker } = await sb.from('workers').select('daily_rate').eq('id', workerId).single());
  }
  const { data: wExtra } = await sb.from('meta').select('value').eq('key', `worker_extra:${workerId}`).single();
  if (wExtra?.value) { try { Object.assign(worker, JSON.parse(wExtra.value)); } catch {} }
  if (!worker.worker_type) worker.worker_type = 'company';

  const inMins = parseTimeToMins(timeIn);
  const outMins = parseTimeToMins(timeOut);
  if (outMins <= inMins) return c.json({ error: 'Out time must be after in time' }, 400);

  const totalHrs = (outMins - inMins) / 60;
  const netHrs = Math.max(0, totalHrs - lunchHrs);
  const dutyHrs = Math.min(netHrs, workHrs);
  const otHrs = Math.max(0, netHrs - workHrs);

  const wages = calcWages(worker, dutyHrs, otHrs, date, workHrs);

  await sb.from('meta').upsert({
    key: metaKey,
    value: JSON.stringify({
      time_in: timeIn,
      time_out: timeOut,
      total_hours: Math.round(totalHrs * 100) / 100,
      lunch_hours: lunchHrs,
      duty_hours: Math.round(dutyHrs * 100) / 100,
      overtime_hours: Math.round(otHrs * 100) / 100,
      daily_wage: wages.dailyWage,
      overtime_wage: wages.overtimeWage,
    }),
  });

  return c.json({
    ok: true,
    hours: { total: totalHrs, lunch: lunchHrs, duty: dutyHrs, overtime: otHrs },
    wages,
  });
});

app.get('/api/shift-config', async (c) => {
  return c.json({ config: await getShiftConfig(c.get('sb')) });
});

app.patch('/api/shift-config', async (c) => {
  const sb = c.get('sb');
  const role = await getRole(c);
  if (!role) return c.json({ error: 'unauthorized' }, 401);

  const body = await c.req.json();
  const current = await getShiftConfig(sb);
  if (body.shift_start && validTime(body.shift_start)) current.shift_start = body.shift_start;
  if (body.shift_end && validTime(body.shift_end)) current.shift_end = body.shift_end;
  if (body.work_hours != null) current.work_hours = Math.max(1, Math.min(24, Number(body.work_hours) || 8));
  if (body.lunch_hours != null) current.lunch_hours = Math.max(0, Math.min(4, Number(body.lunch_hours) || 0));

  const { error } = await sb.from('meta').upsert({ key: 'shift_config', value: JSON.stringify(current) });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true, config: current });
});

// --- close day (auto-mark unmarked as absent, notify absent + late) -----------
app.get('/api/attendance/closed', async (c) => {
  const date = c.req.query('date');
  if (!validDate(date)) return c.json({ error: 'bad date' }, 400);
  const sb = c.get('sb');
  const { data: marker } = await sb.from('meta').select('value').eq('key', `closed:${date}`).single();
  return c.json({ closed: !!marker, closedAt: marker?.value || null });
});

app.post('/api/attendance/close', async (c) => {
  const sb = c.get('sb');
  const body = await c.req.json();
  const date = body.date;
  if (!validDate(date)) return c.json({ error: 'bad date' }, 400);

  const { data: already } = await sb.from('meta').select('value').eq('key', `closed:${date}`).single();
  if (already) return c.json({ error: 'This day is already closed' }, 409);

  const { data: allWorkers } = await sb
    .from('workers')
    .select('id, name, email')
    .eq('active', true);

  const { data: existing } = await sb
    .from('attendance')
    .select('worker_id, status, is_late')
    .eq('date', date);

  const markedIds = new Set((existing || []).map((r) => r.worker_id));
  const unmarked = allWorkers.filter((w) => !markedIds.has(w.id));

  const now = new Date().toISOString();
  if (unmarked.length > 0) {
    const rows = unmarked.map((w) => ({
      worker_id: w.id, date, status: 'absent',
      leave_type: 'unspecified', notes: 'Auto-marked on day close',
      recorded_by: 'day-close', recorded_at: now, updated_at: now, is_late: false,
    }));
    for (let i = 0; i < rows.length; i += 500) {
      await sb.from('attendance').upsert(rows.slice(i, i + 500), { onConflict: 'worker_id,date' });
    }
  }

  await sb.from('meta').upsert({ key: `closed:${date}`, value: now });

  const absentWorkers = [
    ...(existing || []).filter((r) => r.status === 'absent'),
    ...unmarked.map((w) => ({ worker_id: w.id, status: 'absent', is_late: false })),
  ];
  const lateWorkers = (existing || []).filter((r) => r.status === 'present' && r.is_late);

  const workerMap = {};
  for (const w of allWorkers) workerMap[w.id] = w;

  const toNotify = [];
  for (const r of absentWorkers) {
    const w = workerMap[r.worker_id];
    if (w) toNotify.push({ ...w, reason: 'absent' });
  }
  for (const r of lateWorkers) {
    const w = workerMap[r.worker_id];
    if (w) toNotify.push({ ...w, reason: 'late' });
  }

  let emailsSent = 0;
  const withEmail = toNotify.filter((w) => w.email);
  const env = getEnv(c);
  if (env.RESEND_API_KEY && withEmail.length > 0) {
    const results = await Promise.allSettled(
      withEmail.map((w) => sendCloseNotification(env, w, date, w.reason)),
    );
    emailsSent = results.filter((r) => r.status === 'fulfilled').length;
  }

  return c.json({
    ok: true,
    closedAt: now,
    autoMarkedAbsent: unmarked.length,
    totalAbsent: absentWorkers.length,
    totalLate: lateWorkers.length,
    emailsSent,
    emailsQueued: withEmail.length,
  });
});

async function sendCloseNotification(env, worker, date, reason) {
  if (!env.RESEND_API_KEY || !worker.email) return;
  const fmt = new Date(date + 'T00:00:00Z').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
  const isLate = reason === 'late';
  const statusLabel = isLate ? 'LATE PRESENT' : 'ABSENT';
  const statusColor = isLate ? '#F59E0B' : '#d97706';
  const subject = isLate
    ? `Late attendance recorded — ${fmt}`
    : `Absence recorded — ${fmt}`;
  const bodyText = isLate
    ? `You were marked as arriving LATE on ${fmt}.`
    : `You have been marked ABSENT on ${fmt}.`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.RESEND_FROM || 'WorkTrack Attendance <onboarding@resend.dev>',
      to: [worker.email],
      subject,
      text:
        `Hello ${worker.name},\n\n${bodyText}\n\n` +
        `Attendance for this day has been finalized by the supervisor.\n` +
        `If you believe this is a mistake, please contact your supervisor.`,
      html:
        `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;` +
        `background:#0b132b;color:#e8edf7;border-radius:12px">` +
        `<h2 style="color:#f4d6b0;margin:0 0 4px">${isLate ? 'Late Attendance' : 'Absence'} Notification</h2>` +
        `<p style="color:#9db0cd;margin:0 0 18px">WorkTrack — Day Closed</p>` +
        `<p>Hello <strong>${worker.name}</strong>,</p>` +
        `<p>You have been marked <strong style="color:${statusColor}">${statusLabel}</strong> on ` +
        `<strong>${fmt}</strong>.</p>` +
        `<p style="background:#3a506b66;padding:10px 16px;border-radius:8px">` +
        `Attendance for this day has been finalized by the supervisor.</p>` +
        `<p style="color:#9db0cd">If you believe this is a mistake, please contact your supervisor.</p>` +
        `</div>`,
    }),
  });
}

// --- holidays (accessible by both roles) ----------------------------------------
app.get('/api/holidays', async (c) => {
  const sb = c.get('sb');
  const year = c.req.query('year') || String(new Date().getUTCFullYear());
  const { data, error } = await sb
    .from('holidays')
    .select('id, date, name, type')
    .gte('date', `${year}-01-01`).lte('date', `${year}-12-31`)
    .order('date');
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ holidays: data || [] });
});

// --- admin APIs ----------------------------------------------------------------
app.use('/api/admin/*', async (c, next) => {
  const denied = await requireRole(c, 'admin');
  if (denied) return denied;
  await next();
});

app.post('/api/admin/holidays', async (c) => {
  const sb = c.get('sb');
  const { date, name, type } = await c.req.json();
  if (!validDate(date) || !name?.trim()) return c.json({ error: 'Date and name required' }, 400);
  const holType = type === 'company' ? 'company' : 'government';
  const { data, error } = await sb.from('holidays').insert({ date, name: name.trim(), type: holType }).select().single();
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true, holiday: data });
});

app.delete('/api/admin/holidays/:id', async (c) => {
  const sb = c.get('sb');
  const id = c.req.param('id');
  const { error } = await sb.from('holidays').delete().eq('id', id);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true });
});

// --- supervisor management (admin only) ----------------------------------------
app.get('/api/admin/supervisors', async (c) => {
  const sb = c.get('sb');
  const { data, error } = await sb
    .from('supervisors')
    .select('id, username, name, email, phone, active, created_at')
    .order('created_at', { ascending: false });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ supervisors: data || [] });
});

app.post('/api/admin/supervisors', async (c) => {
  const sb = c.get('sb');
  const body = await c.req.json();
  const username = (body.username || '').trim().toLowerCase();
  const password = (body.password || '').trim();
  const name = (body.name || '').trim();
  const email = (body.email || '').trim().toLowerCase();
  const phone = (body.phone || '').trim();

  if (!username || username.length < 3 || username.length > 50) {
    return c.json({ error: 'Username must be 3-50 characters' }, 400);
  }
  if (!/^[a-z0-9._-]+$/.test(username)) {
    return c.json({ error: 'Username can only contain letters, numbers, dots, hyphens and underscores' }, 400);
  }
  if (!password || password.length < 6) {
    return c.json({ error: 'Password must be at least 6 characters' }, 400);
  }
  if (!name || name.length > 120) {
    return c.json({ error: 'Full name is required' }, 400);
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ error: 'Invalid email address' }, 400);
  }

  const { data: existing } = await sb.from('supervisors').select('id').eq('username', username).single();
  if (existing) return c.json({ error: 'A supervisor with this username already exists' }, 409);

  const { data, error } = await sb.from('supervisors').insert({
    username, password, name,
    email: email || null, phone: phone || null,
    active: true, created_at: new Date().toISOString(),
  }).select('id, username, name, email, phone, active, created_at').single();
  if (error) return c.json({ error: error.message }, 500);

  return c.json({ ok: true, supervisor: data });
});

app.patch('/api/admin/supervisors/:id', async (c) => {
  const sb = c.get('sb');
  const id = c.req.param('id');
  const body = await c.req.json();
  const updates = {};

  if ('active' in body) updates.active = !!body.active;
  if ('name' in body && body.name?.trim()) updates.name = body.name.trim();
  if ('email' in body) updates.email = body.email?.trim().toLowerCase() || null;
  if ('phone' in body) updates.phone = body.phone?.trim() || null;
  if ('password' in body && body.password?.trim().length >= 6) updates.password = body.password.trim();

  if (Object.keys(updates).length === 0) {
    return c.json({ error: 'No valid fields to update' }, 400);
  }

  const { data, error } = await sb
    .from('supervisors')
    .update(updates)
    .eq('id', id)
    .select('id, username, name, email, phone, active, created_at')
    .single();
  if (error) return c.json({ error: error.message }, 500);
  if (!data) return c.json({ error: 'Supervisor not found' }, 404);

  return c.json({ ok: true, supervisor: data });
});

app.get('/api/settings/:key', async (c) => {
  const sb = c.get('sb');
  const key = c.req.param('key');
  const { data } = await sb.from('meta').select('value').eq('key', `setting:${key}`).single();
  return c.json({ key, value: data?.value ?? null });
});

app.patch('/api/settings/:key', async (c) => {
  const sb = c.get('sb');
  const denied = await requireRole(c, 'admin');
  if (denied) return denied;
  const key = c.req.param('key');
  const { value } = await c.req.json();
  const { error } = await sb.from('meta').upsert({ key: `setting:${key}`, value: String(value) });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ ok: true, key, value: String(value) });
});

app.get('/api/admin/overview', async (c) => {
  const sb = c.get('sb');
  const year = (c.req.query('year') || String(new Date().getUTCFullYear())).slice(0, 4);
  const month = c.req.query('month') ? c.req.query('month').slice(0, 2) : '';
  const today = validDate(c.req.query('today')) ? c.req.query('today') : '';

  const dateStart = month ? `${year}-${month}-01` : `${year}-01-01`;
  const dateEnd = month ? `${year}-${month}-31` : `${year}-12-31`;

  const { data: workers } = await sb
    .from('workers')
    .select('id, name, department')
    .eq('active', true)
    .order('name');

  const { data: records } = await sb
    .from('attendance')
    .select('worker_id, status, leave_type, is_late')
    .gte('date', dateStart).lte('date', dateEnd);

  const byWorker = {};
  for (const w of workers) byWorker[w.id] = { ...w, presentDays: 0, lateDays: 0, absentDays: 0, ml: 0, emergency: 0, workRelated: 0, casual: 0, unpaid: 0, unspecified: 0 };
  for (const r of records || []) {
    const w = byWorker[r.worker_id];
    if (!w) continue;
    if (r.status === 'present') {
      w.presentDays++;
      if (r.is_late) w.lateDays++;
    } else {
      w.absentDays++;
      const lt = r.leave_type || 'unspecified';
      const key = lt === 'work_related' ? 'workRelated' : lt;
      if (key in w) w[key]++;
    }
  }

  const { data: extraMeta } = await sb.from('meta').select('key, value').like('key', 'worker_extra:%');
  const extraMap = {};
  for (const e of extraMeta || []) {
    const wid = e.key.replace('worker_extra:', '');
    try { extraMap[wid] = JSON.parse(e.value); } catch {}
  }

  const { data: timeMeta } = await sb.from('meta').select('key, value').like('key', 'time:%');
  const wageMap = {};
  for (const t of timeMeta || []) {
    const parts = t.key.split(':');
    const wid = parts[1], date = parts[2];
    if (date < dateStart || date > dateEnd) continue;
    try {
      const tv = JSON.parse(t.value);
      if (!wageMap[wid]) wageMap[wid] = { totalDutyHours: 0, totalOvertimeHours: 0, totalDailyWage: 0, totalOvertimeWage: 0 };
      wageMap[wid].totalDutyHours += tv.duty_hours || 0;
      wageMap[wid].totalOvertimeHours += tv.overtime_hours || 0;
      wageMap[wid].totalDailyWage += tv.daily_wage || 0;
      wageMap[wid].totalOvertimeWage += tv.overtime_wage || 0;
    } catch {}
  }

  const rows = Object.values(byWorker).map((r) => {
    const extra = extraMap[r.id] || {};
    const wages = wageMap[r.id] || {};
    return {
      ...r,
      ...extra,
      totalDutyHours: Math.round((wages.totalDutyHours || 0) * 100) / 100,
      totalOvertimeHours: Math.round((wages.totalOvertimeHours || 0) * 100) / 100,
      totalDailyWage: Math.round((wages.totalDailyWage || 0) * 100) / 100,
      totalOvertimeWage: Math.round((wages.totalOvertimeWage || 0) * 100) / 100,
      totalWage: Math.round(((wages.totalDailyWage || 0) + (wages.totalOvertimeWage || 0)) * 100) / 100,
      pct: r.presentDays + r.absentDays > 0
        ? Math.round((r.presentDays / (r.presentDays + r.absentDays)) * 1000) / 10
        : null,
    };
  });

  let todayStats = null;
  if (today) {
    const { data: tRecs } = await sb.from('attendance').select('status, is_late').eq('date', today);
    const present = (tRecs || []).filter((r) => r.status === 'present').length;
    const late = (tRecs || []).filter((r) => r.status === 'present' && r.is_late).length;
    todayStats = { marked: (tRecs || []).length, present, late, totalWorkers: workers.length };
  }

  const sumPresent = rows.reduce((s, r) => s + r.presentDays, 0);
  const sumAbsent = rows.reduce((s, r) => s + r.absentDays, 0);
  const period = month ? `${year}-${month}` : year;
  return c.json({
    year, month,
    todayStats,
    rows,
    overall: {
      presentDays: sumPresent,
      absentDays: sumAbsent,
      pct: sumPresent + sumAbsent > 0
        ? Math.round((sumPresent / (sumPresent + sumAbsent)) * 1000) / 10
        : null,
    },
  });
});

app.get('/api/admin/worker/:id', async (c) => {
  const sb = c.get('sb');
  const id = c.req.param('id');
  const year = (c.req.query('year') || String(new Date().getUTCFullYear())).slice(0, 4);

  let { data: worker } = await sb.from('workers')
    .select('id, name, department, daily_rate, basic_salary, allowance, ot_rate, designation, active, created_at')
    .eq('id', id).single();
  if (!worker) {
    ({ data: worker } = await sb.from('workers')
      .select('id, name, department, daily_rate, active, created_at')
      .eq('id', id).single());
  }
  if (!worker) return c.json({ error: 'unknown worker' }, 404);

  const { data: wExtra } = await sb.from('meta').select('value').eq('key', `worker_extra:${id}`).single();
  if (wExtra?.value) { try { Object.assign(worker, JSON.parse(wExtra.value)); } catch {} }
  if (!worker.worker_type) worker.worker_type = 'company';

  const dateStart = `${year}-01-01`;
  const dateEnd = `${year}-12-31`;

  let { data: records } = await sb.from('attendance')
    .select('date, status, leave_type, notes, recorded_by, recorded_at, updated_at, is_late, time_in, time_out, duty_hours, overtime_hours, daily_wage, overtime_wage')
    .eq('worker_id', id).gte('date', dateStart).lte('date', dateEnd).order('date');
  if (!records) {
    ({ data: records } = await sb.from('attendance')
      .select('date, status, leave_type, notes, recorded_by, recorded_at, updated_at, is_late')
      .eq('worker_id', id).gte('date', dateStart).lte('date', dateEnd).order('date'));
  }

  const { data: timeEntries } = await sb.from('meta').select('key, value').like('key', `time:${id}:%`);
  const timeMap = {};
  for (const t of timeEntries || []) {
    const d = t.key.split(':')[2];
    try { timeMap[d] = JSON.parse(t.value); } catch {}
  }
  for (const r of records || []) {
    const td = timeMap[r.date];
    if (td) {
      if (!r.time_in) r.time_in = td.time_in || null;
      if (!r.time_out) r.time_out = td.time_out || null;
      if (!r.duty_hours && td.duty_hours) r.duty_hours = td.duty_hours;
      if (!r.overtime_hours && td.overtime_hours) r.overtime_hours = td.overtime_hours;
      if (!r.daily_wage && td.daily_wage) r.daily_wage = td.daily_wage;
      if (!r.overtime_wage && td.overtime_wage) r.overtime_wage = td.overtime_wage;
    }
  }

  const monthMap = {};
  for (const r of records || []) {
    const m = r.date.slice(5, 7);
    if (!monthMap[m]) monthMap[m] = { month: m, presentDays: 0, lateDays: 0, absentDays: 0, ml: 0, emergency: 0, workRelated: 0, casual: 0, unpaid: 0, unspecified: 0, totalDutyHours: 0, totalOvertimeHours: 0, totalDailyWage: 0, totalOvertimeWage: 0 };
    const mm = monthMap[m];
    if (r.status === 'present') {
      mm.presentDays++;
      if (r.is_late) mm.lateDays++;
      mm.totalDutyHours += Number(r.duty_hours) || 0;
      mm.totalOvertimeHours += Number(r.overtime_hours) || 0;
      mm.totalDailyWage += Number(r.daily_wage) || 0;
      mm.totalOvertimeWage += Number(r.overtime_wage) || 0;
    } else {
      mm.absentDays++;
      const lt = r.leave_type || 'unspecified';
      const key = lt === 'work_related' ? 'workRelated' : lt;
      if (key in mm) mm[key]++;
    }
  }
  for (const mm of Object.values(monthMap)) {
    mm.totalDutyHours = Math.round(mm.totalDutyHours * 100) / 100;
    mm.totalOvertimeHours = Math.round(mm.totalOvertimeHours * 100) / 100;
    mm.totalDailyWage = Math.round(mm.totalDailyWage * 100) / 100;
    mm.totalOvertimeWage = Math.round(mm.totalOvertimeWage * 100) / 100;
    mm.totalWage = mm.totalDailyWage + mm.totalOvertimeWage;
  }
  const monthly = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month));

  let payroll = null;
  const dailyRate = worker.daily_rate || 0;
  const hasSalaryInfo = dailyRate > 0 || (worker.basic_salary || 0) > 0;
  if (hasSalaryInfo) {
    const paidLeaves = ['ml', 'casual', 'emergency', 'work_related'];
    let paidDays = 0;
    let unpaidDays = 0;
    let totalDutyHours = 0;
    let totalOvertimeHours = 0;
    let totalDailyWage = 0;
    let totalOvertimeWage = 0;
    for (const r of records || []) {
      if (r.status === 'present') {
        paidDays++;
        totalDutyHours += Number(r.duty_hours) || 0;
        totalOvertimeHours += Number(r.overtime_hours) || 0;
        totalDailyWage += Number(r.daily_wage) || 0;
        totalOvertimeWage += Number(r.overtime_wage) || 0;
      }
      else if (r.status === 'absent' && paidLeaves.includes(r.leave_type)) paidDays++;
      else unpaidDays++;
    }
    payroll = {
      dailyRate, basicSalary: worker.basic_salary || 0, allowance: worker.allowance || 0,
      otRate: worker.ot_rate || 0,
      paidDays, unpaidDays, totalDays: paidDays + unpaidDays,
      totalDutyHours: Math.round(totalDutyHours * 100) / 100,
      totalOvertimeHours: Math.round(totalOvertimeHours * 100) / 100,
      totalDailyWage: Math.round(totalDailyWage * 100) / 100,
      totalOvertimeWage: Math.round(totalOvertimeWage * 100) / 100,
      net: Math.round((totalDailyWage + totalOvertimeWage) * 100) / 100,
    };
  }

  return c.json({ worker, year, monthly, records: records || [], payroll });
});

// --- pay slip data ----------------------------------------------------------
app.get('/api/admin/worker/:id/payslip', async (c) => {
  const sb = c.get('sb');
  const id = c.req.param('id');
  const month = c.req.query('month');
  const year = c.req.query('year') || String(new Date().getUTCFullYear());
  if (!month || !/^\d{2}$/.test(month)) return c.json({ error: 'month required (01-12)' }, 400);

  let { data: worker } = await sb.from('workers')
    .select('id, name, department, daily_rate, basic_salary, allowance, ot_rate, designation, created_at')
    .eq('id', id).single();
  if (!worker) {
    ({ data: worker } = await sb.from('workers')
      .select('id, name, department, daily_rate, created_at')
      .eq('id', id).single());
  }
  if (!worker) return c.json({ error: 'unknown worker' }, 404);

  const { data: wExtra } = await sb.from('meta').select('value').eq('key', `worker_extra:${id}`).single();
  if (wExtra?.value) { try { Object.assign(worker, JSON.parse(wExtra.value)); } catch {} }
  if (!worker.worker_type) worker.worker_type = 'company';

  const dateStart = `${year}-${month}-01`;
  const dateEnd = `${year}-${month}-31`;
  const daysInMonth = getDaysInMonth(`${year}-${month}-01`);

  let { data: records } = await sb.from('attendance')
    .select('date, status, leave_type, is_late')
    .eq('worker_id', id).gte('date', dateStart).lte('date', dateEnd).order('date');
  if (!records) records = [];

  const { data: timeEntries } = await sb.from('meta').select('key, value').like('key', `time:${id}:${year}-${month}-%`);
  const timeMap = {};
  for (const t of timeEntries || []) {
    const d = t.key.split(':')[2];
    try { timeMap[d] = JSON.parse(t.value); } catch {}
  }

  const shiftCfg = await getShiftConfig(sb);
  const workHrs = Number(shiftCfg.work_hours) || 8;

  let presentDays = 0, absentDays = 0, lateDays = 0;
  let totalDutyHours = 0, totalOvertimeHours = 0;
  let totalDutyWage = 0, totalOvertimeWage = 0;

  for (const r of records) {
    const td = timeMap[r.date] || {};
    if (r.status === 'present') {
      presentDays++;
      if (r.is_late) lateDays++;
      totalDutyHours += Number(td.duty_hours) || 0;
      totalOvertimeHours += Number(td.overtime_hours) || 0;
      totalDutyWage += Number(td.daily_wage) || 0;
      totalOvertimeWage += Number(td.overtime_wage) || 0;
    } else {
      absentDays++;
    }
  }

  const basic = Number(worker.basic_salary) || 0;
  const allow = Number(worker.allowance) || 0;
  const isContract = worker.worker_type === 'contract';

  let hourlyRate, otRateVal;
  if (isContract) {
    hourlyRate = Number(worker.duty_rate_hr) || Number(worker.ot_rate) || 0;
    otRateVal = Number(worker.ot_rate) || hourlyRate;
  } else {
    hourlyRate = (basic + allow) > 0 ? (basic + allow) / (daysInMonth * workHrs) : 0;
    otRateVal = Number(worker.ot_rate) || (basic > 0 ? basic / (daysInMonth * workHrs) : 0);
  }

  const totalSalary = Math.round((totalDutyWage + totalOvertimeWage) * 100) / 100;

  return c.json({
    worker: {
      id: worker.id, name: worker.name, department: worker.department,
      designation: worker.designation || '', worker_type: worker.worker_type,
      doj: worker.doj || (worker.created_at ? worker.created_at.split('T')[0] : ''),
    },
    month, year, daysInMonth,
    salary: {
      basic, allowance: allow,
      hourlyRate: Math.round(hourlyRate * 100) / 100,
      otRate: Math.round(otRateVal * 100) / 100,
      presentDays, absentDays, lateDays,
      totalDutyHours: Math.round(totalDutyHours * 100) / 100,
      totalOvertimeHours: Math.round(totalOvertimeHours * 100) / 100,
      dutyWage: Math.round(totalDutyWage * 100) / 100,
      overtimeWage: Math.round(totalOvertimeWage * 100) / 100,
      totalSalary,
    },
  });
});

// --- CSV reports ------------------------------------------------------------
function csvEscape(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

app.get('/api/admin/report/all.csv', async (c) => {
  const sb = c.get('sb');
  const year = (c.req.query('year') || String(new Date().getUTCFullYear())).slice(0, 4);
  const month = c.req.query('month') ? c.req.query('month').slice(0, 2) : '';
  const period = month ? `${year}-${month}` : year;

  const dateStart = month ? `${year}-${month}-01` : `${year}-01-01`;
  const dateEnd = month ? `${year}-${month}-31` : `${year}-12-31`;

  const { data: workers } = await sb.from('workers').select('id, name, department').eq('active', true).order('name');
  const { data: records } = await sb.from('attendance').select('worker_id, status, leave_type').gte('date', dateStart).lte('date', dateEnd);

  const byWorker = {};
  for (const w of workers) byWorker[w.id] = { ...w, presentDays: 0, absentDays: 0, ml: 0, emergency: 0, workRelated: 0, casual: 0, unpaid: 0, unspecified: 0 };
  for (const r of records || []) {
    const w = byWorker[r.worker_id];
    if (!w) continue;
    if (r.status === 'present') w.presentDays++;
    else {
      w.absentDays++;
      const lt = r.leave_type || 'unspecified';
      const key = lt === 'work_related' ? 'workRelated' : lt;
      if (key in w) w[key]++;
    }
  }

  const rows = Object.values(byWorker).map((r) => ({
    ...r,
    pct: r.presentDays + r.absentDays > 0
      ? Math.round((r.presentDays / (r.presentDays + r.absentDays)) * 1000) / 10
      : null,
  }));

  const lines = [
    `Attendance Summary - ${period}`,
    `Worker ID,Worker Name,Department,Present Days,Absent Days,ML,Emergency,Work-related,Casual,Unpaid,Unspecified,Attendance %`,
    ...rows.map((r) =>
      [r.id, r.name, r.department, r.presentDays, r.absentDays, r.ml, r.emergency,
       r.workRelated, r.casual, r.unpaid, r.unspecified, r.pct ?? ''].map(csvEscape).join(',')),
  ];
  return csvResponse(c, lines.join('\n'), `attendance-summary-${period}.csv`);
});

app.get('/api/admin/report/worker/:id', async (c) => {
  const sb = c.get('sb');
  const id = c.req.param('id');
  const year = (c.req.query('year') || String(new Date().getUTCFullYear())).slice(0, 4);

  const { data: worker } = await sb.from('workers').select('*').eq('id', id).single();
  if (!worker) return c.json({ error: 'unknown worker' }, 404);

  const { data: records } = await sb
    .from('attendance')
    .select('date, status, leave_type, notes, recorded_by')
    .eq('worker_id', id)
    .gte('date', `${year}-01-01`).lte('date', `${year}-12-31`)
    .order('date');

  const dow = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const lines = [
    `Attendance Record - ${worker.name} (${worker.id}, ${worker.department}) - ${year}`,
    `Date,Day,Status,Leave Type,Notes,Marked By`,
    ...(records || []).map((r) =>
      [r.date,
       dow[new Date(r.date + 'T00:00:00Z').getUTCDay()],
       r.status, r.leave_type ? LEAVE_LABELS[r.leave_type] : '',
       r.notes || '', r.recorded_by || ''].map(csvEscape).join(',')),
  ];

  const byMonth = {};
  for (const r of records || []) {
    const m = r.date.slice(5, 7);
    if (!byMonth[m]) byMonth[m] = { p: 0, a: 0 };
    byMonth[m][r.status === 'present' ? 'p' : 'a']++;
  }
  lines.push('');
  lines.push('Month,Present Days,Absent Days,Attendance %');
  for (const m of Object.keys(byMonth).sort()) {
    const { p, a } = byMonth[m];
    lines.push([m, p, a, p + a ? Math.round((p / (p + a)) * 1000) / 10 : ''].join(','));
  }
  return csvResponse(c, lines.join('\n'), `attendance-${worker.id}-${year}.csv`);
});

function csvResponse(c, text, filename) {
  return new Response('﻿' + text, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

// --- SPA fallback -------------------------------------------------------------
app.all('*', (c) => {
  const env = getEnv(c);
  if (env.ASSETS?.fetch) {
    return env.ASSETS.fetch(c.req.raw);
  }
  return c.text('Not found', 404);
});

export default {
  fetch: (req, env, ctx) => app.fetch(req, env, ctx),
};
