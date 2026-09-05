/* ===== Store: state, persistence, domain ===== */
const DEFAULT_THEMES = [
  { id: 'calculo', name: 'Calculation', color: '#e06b6b' },
  { id: 'sparring', name: 'Sparring', color: '#6e8ef0' },
  { id: 'positional', name: 'Positional Play', color: '#6cbf63' },
  { id: 'endgame', name: 'Endgame', color: '#4db6ac' },
  { id: 'opening', name: 'Opening', color: '#e8964e' },
  { id: 'blitz', name: 'Blitz Training', color: '#d9c94b' },
  { id: 'video', name: 'Video Lesson', color: '#a875e6' },
  { id: 'analyze', name: 'Analyze Game', color: '#dba145' },
  { id: 'coach', name: 'Lesson with Coach', color: '#d86ab0' },
];
const DEFAULT_SETTINGS = {
  name: '', themes: DEFAULT_THEMES.map((x) => ({ ...x })), last_theme: 'calculo',
  break_every_min: 25, pause_autostop_min: 60, streak_min_min: 25, default_len_min: 60, snap_min: 15, target_min: null,
  focus_anim: 'aurora', sound: true, updated_at: null,
};
let state = { v: 2, settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), sessions: [], missions: [] };
let storageKey = 'csp:v2:local';
const Store = { onDirty: null }; // set by Sync: (kind, id) => void

const listeners = {};
function on(evt, fn) { (listeners[evt] ||= []).push(fn); return () => { listeners[evt] = listeners[evt].filter((f) => f !== fn); }; }
function emit(evt, data) { (listeners[evt] || []).slice().forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } }); }

function setStorageUser(userId) { storageKey = `csp:v2:${userId || 'local'}`; }
function resetState() { state = { v: 2, settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), sessions: [], missions: [] }; }
function loadState() {
  resetState();
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const p = JSON.parse(raw);
      state.settings = { ...state.settings, ...(p.settings || {}) };
      if (!Array.isArray(state.settings.themes) || !state.settings.themes.length) state.settings.themes = DEFAULT_THEMES.map((x) => ({ ...x }));
      state.sessions = Array.isArray(p.sessions) ? p.sessions : []; state.missions = Array.isArray(p.missions) ? p.missions : [];
    }
  } catch (e) { console.error('load failed', e); }
  return state;
}
function persist() { try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch (e) { console.error('persist failed', e); } }
function clearLocalCache() { try { localStorage.removeItem(storageKey); } catch { /* */ } }
function commit(evt = 'change', data) { persist(); emit(evt, data); if (evt !== 'change') emit('change', data); }
function dirty(kind, id) { if (Store.onDirty) Store.onDirty(kind, id); }

/* ===== Settings ===== */
function updateSettings(patch) { Object.assign(state.settings, patch, { updated_at: iso(Date.now()) }); dirty('settings', 'settings'); commit('settings'); }
const themes = () => state.settings.themes;
const themeById = (id) => themes().find((x) => x.id === id) || null;
const themeName = (id) => themeById(id)?.name || 'No theme';
const themeColor = (id) => themeById(id)?.color || '#8a9bb3';
function upsertTheme(th) {
  const list = themes().slice(); const i = list.findIndex((x) => x.id === th.id);
  if (i >= 0) list[i] = { ...list[i], ...th }; else list.push({ id: th.id || uid().slice(0, 8), name: th.name, color: th.color });
  updateSettings({ themes: list });
}
function removeTheme(id) { if (themes().length <= 1) return false; updateSettings({ themes: themes().filter((x) => x.id !== id) }); return true; }

/* ===== Undo ===== */
const undoStack = [];
function pushUndo(entry) { undoStack.push(entry); if (undoStack.length > 50) undoStack.shift(); }
function undoLast() {
  const e = undoStack.pop(); if (!e) return false;
  if (e.type === 'session') {
    const idx = state.sessions.findIndex((s) => s.id === e.id);
    if (e.before) { const restored = { ...e.before, updated_at: iso(Date.now()) }; if (idx >= 0) state.sessions[idx] = restored; else state.sessions.push(restored); }
    else if (idx >= 0) { state.sessions[idx].deleted_at = iso(Date.now()); state.sessions[idx].updated_at = state.sessions[idx].deleted_at; }
    dirty('session', e.id); commit('sessions', { id: e.id });
    return true;
  }
  return false;
}

/* ===== Sessions ===== */
const snapshot = (o) => JSON.parse(JSON.stringify(o));
const isLive = (s) => !s.deleted_at;
const activeSessions = () => state.sessions.filter((s) => isLive(s) && s.ended_at);
const runningSession = () => state.sessions.find((s) => isLive(s) && !s.ended_at) || null;
const sessionById = (id) => state.sessions.find((s) => s.id === id) || null;

function normPauses(s, end) { return (s.pauses || []).map((p) => ({ s: ms(p.start), e: p.end ? ms(p.end) : end })).filter((p) => p.e > p.s); }
function sessionTimes(s, now = nowMs()) {
  const start = ms(s.started_at), end = s.ended_at ? ms(s.ended_at) : now;
  const pauses = normPauses(s, end);
  const pauseMs = pauses.reduce((a, p) => a + Math.max(0, Math.min(p.e, end) - Math.max(p.s, start)), 0);
  const gross = Math.max(0, end - start);
  return { start, end, gross, pauseMs: Math.max(0, Math.min(pauseMs, gross)), net: Math.max(0, gross - pauseMs), pauses };
}
const netMin = (s) => sessionTimes(s).net / MIN;
const openPause = (s) => (s.pauses || []).find((p) => !p.end) || null;
function overlapMs(a1, a2, b1, b2) { return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1)); }

/* split a session into per-calendar-day slices: [{day, start, end, gross, net, session}] */
function sliceSession(s, now = nowMs()) {
  const { start, end, pauses } = sessionTimes(s, now);
  const out = []; let cur = start, guard = 0;
  while (cur < end && guard++ < 40) {
    const day = dayKeyOf(cur); const dayEnd = dayMs(addDays(day, 1), 0); const segEnd = Math.min(end, dayEnd);
    if (segEnd <= cur) break;
    const gross = segEnd - cur; const pz = pauses.reduce((a, p) => a + overlapMs(p.s, p.e, cur, segEnd), 0);
    out.push({ day, start: cur, end: segEnd, gross, net: Math.max(0, gross - pz), session: s });
    cur = segEnd;
  }
  return out;
}
function findOverlap(startMs, endMs, excludeId) {
  const now = nowMs();
  for (const s of state.sessions) {
    if (!isLive(s) || s.id === excludeId) continue;
    const st = ms(s.started_at), en = s.ended_at ? ms(s.ended_at) : now;
    if (st < endMs && en > startMs) return s;
  }
  return null;
}
function validateSession(data, excludeId) {
  const errs = [];
  const st = ms(data.started_at), en = data.ended_at ? ms(data.ended_at) : null;
  if (Number.isNaN(st)) errs.push({ code: 'start', message: 'Invalid start time.' });
  if (en != null) {
    if (!(en > st)) errs.push({ code: 'end', message: 'End must be after the start.' });
    else if (en - st > 16 * HOUR) errs.push({ code: 'long', message: 'Session longer than 16 h. Split it in two.' });
    const pz = normPauses({ pauses: data.pauses }, en).reduce((a, p) => a + (p.e - p.s), 0);
    if (pz > en - st) errs.push({ code: 'pause', message: 'Breaks cannot be longer than the session.' });
  }
  if ((data.note_md || '').length > 20000) errs.push({ code: 'note', message: 'The note exceeds 20,000 characters.' });
  if (en != null && en > st) {
    const c = findOverlap(st, en, excludeId);
    if (c) errs.push({ code: 'overlap', message: `Overlaps another block (${fmtDayShort(dayKeyOf(ms(c.started_at)))} ${fmtRange(ms(c.started_at), c.ended_at ? ms(c.ended_at) : nowMs())}).`, conflict: c });
  }
  return errs;
}
function newSessionObj(data) {
  const now = iso(Date.now());
  return { id: uid(), theme: data.theme || null, started_at: data.started_at, ended_at: data.ended_at || null, pauses: data.pauses || [], source: data.source || 'manual', note_md: data.note_md || '', meta: data.meta || {}, created_at: now, updated_at: now, deleted_at: null };
}
function createSession(data, { undoable = true } = {}) {
  const s = newSessionObj(data); state.sessions.push(s);
  if (s.theme) state.settings.last_theme = s.theme;
  if (undoable) pushUndo({ type: 'session', id: s.id, before: null, after: snapshot(s) });
  dirty('session', s.id); commit('sessions', { id: s.id }); return s;
}
function updateSession(id, patch, { undoable = true, silent = false } = {}) {
  const s = sessionById(id); if (!s) return null;
  const before = snapshot(s);
  Object.assign(s, patch, { updated_at: iso(Date.now()) });
  if (undoable) pushUndo({ type: 'session', id, before, after: snapshot(s) });
  dirty('session', id);
  if (!silent) commit('sessions', { id }); else persist();
  return s;
}
function deleteSession(id, { undoable = true } = {}) {
  const s = sessionById(id); if (!s) return;
  const before = snapshot(s);
  s.deleted_at = iso(Date.now()); s.updated_at = s.deleted_at;
  if (undoable) pushUndo({ type: 'session', id, before, after: snapshot(s) });
  dirty('session', id); commit('sessions', { id });
}
function duplicateSessionTomorrow(id) {
  const s = sessionById(id); if (!s || !s.ended_at) return null;
  const st = ms(s.started_at) + DAY, en = ms(s.ended_at) + DAY;
  const pauses = (s.pauses || []).map((p) => ({ start: iso(ms(p.start) + DAY), end: p.end ? iso(ms(p.end) + DAY) : null }));
  const data = { theme: s.theme, started_at: iso(st), ended_at: iso(en), pauses, source: 'manual', note_md: s.note_md };
  const errs = validateSession(data); if (errs.length) return { errors: errs };
  return { session: createSession(data) };
}

/* ===== Missions (meta de horas por tema com prazo) ===== */
const missionById = (id) => state.missions.find((m) => m.id === id) || null;
const activeMissions = () => state.missions.filter((m) => !m.deleted_at).sort((a, b) => (a.deadline || '').localeCompare(b.deadline || '') || a.created_at.localeCompare(b.created_at));
function createMission(data) {
  const now = iso(Date.now());
  const m = { id: uid(), name: (data.name || '').trim().slice(0, 80) || themeName(data.theme), theme: data.theme, goal_hours: +data.goal_hours || 50, deadline: data.deadline || null, start_date: data.start_date || todayKey(), status: 'active', created_at: now, updated_at: now, deleted_at: null };
  state.missions.push(m); dirty('mission', m.id); commit('missions', { id: m.id }); return m;
}
function updateMission(id, patch) { const m = missionById(id); if (!m) return null; Object.assign(m, patch, { updated_at: iso(Date.now()) }); dirty('mission', id); commit('missions', { id }); return m; }
function deleteMission(id) { const m = missionById(id); if (!m) return; m.deleted_at = iso(Date.now()); m.updated_at = m.deleted_at; dirty('mission', id); commit('missions', { id }); }
function restoreMission(id) { const m = missionById(id); if (!m) return; m.deleted_at = null; m.updated_at = iso(Date.now()); dirty('mission', id); commit('missions', { id }); }
function missionStats(m) {
  const from = m.start_date || dayKeyOf(ms(m.created_at));
  const done = sumRange(from, null, (s) => s.theme === m.theme).netMin; // minutes since start (includes running)
  const goalMin = (m.goal_hours || 0) * 60;
  const tk = todayKey();
  const daysLeft = m.deadline ? daysBetween(tk, m.deadline) : null;
  const remaining = Math.max(0, goalMin - done);
  const perDay = daysLeft != null && daysLeft > 0 ? remaining / daysLeft : null;
  return { done, goalMin, progress: goalMin ? clamp(done / goalMin, 0, 1) : 0, daysLeft, remaining, perDay, complete: done >= goalMin && goalMin > 0, overdue: daysLeft != null && daysLeft < 0 && done < goalMin };
}

/* ===== Aggregations ===== */
/* Map dayKey -> {net, gross, count, ids, byTheme} over live sessions (running included, clipped at now) */
function netByDay(fromKey, toKey, filter) {
  const map = new Map(); const now = nowMs();
  const fromMs = fromKey ? dayMs(fromKey, 0) : -Infinity, toMs = toKey ? dayMs(addDays(toKey, 1), 0) : Infinity;
  for (const s of state.sessions) {
    if (!isLive(s) || (filter && !filter(s))) continue;
    const st = ms(s.started_at), en = s.ended_at ? ms(s.ended_at) : now;
    if (en <= fromMs || st >= toMs || st >= now) continue; // planned (future) blocks don't count yet
    for (const sl of sliceSession(s, now)) {
      if ((fromKey && sl.day < fromKey) || (toKey && sl.day > toKey) || sl.start >= now) continue;
      const frac = Math.min(sl.end, now) - sl.start > 0 ? (Math.min(sl.end, now) - sl.start) / (sl.end - sl.start) : 0;
      const e = map.get(sl.day) || { net: 0, gross: 0, count: 0, ids: new Set(), byTheme: new Map() };
      e.net += sl.net * frac; e.gross += sl.gross * frac; if (!e.ids.has(s.id)) { e.ids.add(s.id); e.count++; }
      const k = s.theme || '__none'; e.byTheme.set(k, (e.byTheme.get(k) || 0) + sl.net * frac);
      map.set(sl.day, e);
    }
  }
  return map;
}
function sumRange(fromKey, toKey, filter) {
  let net = 0; const ids = new Set(); const byTheme = new Map();
  for (const [, v] of netByDay(fromKey, toKey, filter)) { net += v.net; v.ids.forEach((i) => ids.add(i)); for (const [k, m] of v.byTheme) byTheme.set(k, (byTheme.get(k) || 0) + m); }
  return { netMin: net / MIN, count: ids.size, byTheme: new Map(Array.from(byTheme.entries()).map(([k, v]) => [k, v / MIN])) };
}
function periodRange(preset) { // last N days ending today
  const tk = todayKey();
  if (preset === 'week') return [addDays(tk, -6), tk];
  if (preset === 'month') return [addDays(tk, -29), tk];
  if (preset === 'quarter') return [addDays(tk, -89), tk];
  return [null, null];
}
function streakInfo() {
  const minMs = (state.settings.streak_min_min || 25) * MIN;
  const map = netByDay(null, null); const tk = todayKey();
  let current = 0, day = tk;
  const todayOk = (map.get(tk)?.net || 0) >= minMs;
  if (!todayOk) day = addDays(tk, -1);
  while ((map.get(day)?.net || 0) >= minMs) { current++; day = addDays(day, -1); }
  const keys = Array.from(map.keys()).filter((k) => map.get(k).net >= minMs).sort();
  let best = 0, run = 0, prev = null;
  for (const k of keys) { run = prev && addDays(prev, 1) === k ? run + 1 : 1; best = Math.max(best, run); prev = k; }
  return { current, best: Math.max(best, current), todayOk, todayMin: (map.get(tk)?.net || 0) / MIN };
}
/* last n months: [{key:'YYYY-MM', label, total(min), byTheme: Map}] ending this month */
function monthlyTotals(n) {
  const now = new Date(nowMs()); const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = addMonths(now, -i); const from = ymd(d), to = ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    const r = sumRange(from, to); out.push({ key: from.slice(0, 7), label: MON[d.getMonth()], year: d.getFullYear(), total: r.netMin, byTheme: r.byTheme });
  }
  return out;
}
