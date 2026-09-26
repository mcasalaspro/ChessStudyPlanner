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
  { id: 'meditation', name: 'Meditation', color: '#7dd3fc' },
];
const DEFAULT_SETTINGS = {
  name: '', themes: DEFAULT_THEMES.map((x) => ({ ...x })), last_theme: 'calculo',
  break_every_min: 25, break_len_min: 15, pause_autostop_min: 60, streak_min_min: 25, default_len_min: 60, snap_min: 15, target_min: null,
  focus_anim: 'aurora', sound: true, bg_strength: 'strong', bg_source: 'folder', bg_query: 'chess dark moody', unsplash_key: '', late_from: '23:00', guided_breaks: true, locked_days: [], med_reminder: true, med_goal_days: 5, med_pattern: '46', med_minutes: 5, wh_rounds: 3, wh_breaths: 30, wh_pace: 'normal', weekly_goal_hours: 0, books: [], achievements: {}, ach_feedback: true, updated_at: null,
};
/* Per-user documents besides the settings: closed days and the study room. */
const emptyDays = () => ({ entries: {}, since: null, updated_at: null });
const emptyRoom = () => ({ owned: [], placed: {}, style: {}, updated_at: null });
let state = { v: 2, settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), sessions: [], missions: [], days: emptyDays(), room: emptyRoom() };
let storageKey = 'csp:v2:local';
/* version goes up on every data event, so derived numbers can be cached safely */
const Store = { onDirty: null, version: 0, full: false }; // onDirty is set by Sync: (kind, id) => void

const listeners = {};
const QUIET_EVENTS = new Set(['tick', 'sync', 'drawer', 'select', 'storage']);
function on(evt, fn) { (listeners[evt] ||= []).push(fn); return () => { listeners[evt] = listeners[evt].filter((f) => f !== fn); }; }
function emit(evt, data) { if (!QUIET_EVENTS.has(evt)) Store.version++; (listeners[evt] || []).slice().forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } }); }

function setStorageUser(userId) { storageKey = `csp:v2:${userId || 'local'}`; }
function resetState() { state = { v: 2, settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), sessions: [], missions: [], days: emptyDays(), room: emptyRoom() }; }
function loadState() {
  resetState();
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const p = JSON.parse(raw);
      state.settings = { ...state.settings, ...(p.settings || {}) };
      if (!Array.isArray(state.settings.themes) || !state.settings.themes.length) state.settings.themes = DEFAULT_THEMES.map((x) => ({ ...x }));
      state.sessions = Array.isArray(p.sessions) ? p.sessions : []; state.missions = Array.isArray(p.missions) ? p.missions : [];
      if (p.days && typeof p.days === 'object') state.days = { ...emptyDays(), ...p.days, entries: { ...(p.days.entries || {}) } };
      if (p.room && typeof p.room === 'object') state.room = { ...emptyRoom(), ...p.room };
    }
  } catch (e) { console.error('load failed', e); }
  Store.version++;
  return state;
}
/* The offline copy. When the browser runs out of space the data still goes online, but the person is told. */
function persist() {
  const data = JSON.stringify(state);
  try { localStorage.setItem(storageKey, data); if (Store.full) { Store.full = false; emit('storage', { full: false }); } }
  catch (e) {
    try { // make room from caches that can be rebuilt, then try once more
      Object.keys(localStorage).filter((k) => /^csp:v2:(bg|unsplash)/.test(k)).forEach((k) => localStorage.removeItem(k));
      localStorage.setItem(storageKey, data); return;
    } catch { /* still full */ }
    console.error('persist failed', e);
    if (!Store.full) { Store.full = true; emit('storage', { full: true }); }
  }
}
function clearLocalCache() { try { localStorage.removeItem(storageKey); } catch { /* */ } }
function commit(evt = 'change', data) { persist(); emit(evt, data); if (evt !== 'change') emit('change', data); }
/* keys = the settings fields that changed here (they win over the server copy until they are pushed) */
function dirty(kind, id, keys) { if (Store.onDirty) Store.onDirty(kind, id, keys); }
/* This browser's id: a running block is kept alive (heartbeat, automatic stops) only by the device that started it. */
const DEVICE_ID = (() => { try { let d = localStorage.getItem('csp:v2:device'); if (!d) { d = uid().slice(0, 12); localStorage.setItem('csp:v2:device', d); } return d; } catch { return 'nodevice'; } })();
const ownsRun = (s) => !!s && (!s.meta?.device || s.meta.device === DEVICE_ID);

/* ===== Settings ===== */
function updateSettings(patch) { Object.assign(state.settings, patch, { updated_at: iso(Date.now()) }); dirty('settings', 'settings', Object.keys(patch)); commit('settings'); }
const themes = () => state.settings.themes;
/* Tournaments are not a study theme, but their hours count: they get a fixed colour in every chart. */
const TOURNAMENT_THEME = { id: 'tournament', name: 'Tournament', color: '#b98cf0' };
const themeById = (id) => themes().find((x) => x.id === id) || (id === 'tournament' ? TOURNAMENT_THEME : null);
const themeName = (id) => themeById(id)?.name || 'No theme';
const themeColor = (id) => themeById(id)?.color || '#8a9bb3';
function upsertTheme(th) {
  const list = themes().slice(); const i = list.findIndex((x) => x.id === th.id);
  if (i >= 0) list[i] = { ...list[i], ...th }; else list.push({ id: th.id || uid().slice(0, 8), name: th.name, color: th.color });
  updateSettings({ themes: list });
}
function removeTheme(id) { if (themes().length <= 1) return false; updateSettings({ themes: themes().filter((x) => x.id !== id) }); return true; }

/* ===== Days: closed (protected from moves and deletes), and what kind of day it was ===== */
/* Rest, travel and recovery days neither add to the streak nor break it. */
const DAY_TYPES = [['rest', 'Rest'], ['travel', 'Travel'], ['recovery', 'Recovery'], ['skipped', 'Skipped']];
const NEUTRAL_DAYS = new Set(['rest', 'travel', 'recovery']);
const dayEntry = (key) => state.days.entries[key] || null;
function setDayEntry(key, patch, { silent = false } = {}) {
  const now = iso(Date.now());
  state.days.entries[key] = { ...(state.days.entries[key] || {}), ...patch, updated_at: now };
  state.days.updated_at = now;
  dirty('settings', 'days');
  if (silent) persist(); else commit('days', { key });
}
/* Closed days used to live in the settings: an entry of its own always wins over that old list. */
const isDayLocked = (key) => { const e = dayEntry(key); return e ? e.status === 'closed' : (state.settings.locked_days || []).includes(key); };
function setDayLocked(key, on) { setDayEntry(key, on ? { status: 'closed', closed_at: iso(Date.now()) } : { status: 'open', closed_at: null }); }
const dayType = (key) => dayEntry(key)?.type || null;
const sessionLocked = (s) => !!s && isDayLocked(dayKeyOf(ms(s.started_at)));

/* ===== Undo ===== */
const undoStack = [];
function pushUndo(entry) { undoStack.push(entry); if (undoStack.length > 50) undoStack.shift(); }
function undoLast() {
  const e = undoStack.pop(); if (!e) return false;
  if (e.type === 'batch') {
    for (const item of e.entries) {
      const idx = state.sessions.findIndex((x) => x.id === item.id);
      if (item.before) { const restored = { ...item.before, updated_at: iso(Date.now()) }; if (idx >= 0) state.sessions[idx] = restored; else state.sessions.push(restored); }
      else if (idx >= 0) { state.sessions[idx].deleted_at = iso(Date.now()); state.sessions[idx].updated_at = state.sessions[idx].deleted_at; }
      dirty('session', item.id);
    }
    commit('sessions');
    return true;
  }
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
const isTournament = (s) => s.meta?.type === 'tournament';
const activeSessions = () => state.sessions.filter((s) => isLive(s) && s.ended_at && !isTournament(s));
const tournamentDays = () => state.sessions.filter((s) => isLive(s) && isTournament(s));
/* A tournament is logged like any block: its hours count and the day keeps the streak. */
function createTournament({ start, end, name }) {
  const s = newSessionObj({ theme: null, started_at: iso(start), ended_at: iso(end), source: 'manual', meta: { type: 'tournament', tournament_name: name || '', locked: true } });
  state.sessions.push(s); dirty('session', s.id); commit('sessions', { id: s.id });
  Achievements.check('TOURNAMENT_DAY_CREATED');
  return s;
}
const runningSession = () => state.sessions.find((s) => isLive(s) && !s.ended_at && !isTournament(s)) || null;
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
/* Tournaments take part too: two records of the same minutes would count that time twice. */
function findOverlap(startMs, endMs, excludeId) {
  const now = nowMs();
  for (const s of state.sessions) {
    if (!isLive(s) || s.id === excludeId) continue;
    const st = ms(s.started_at), en = s.ended_at ? ms(s.ended_at) : now;
    if (st < endMs && en > startMs) return s;
  }
  return null;
}
/* The app records what happened: nothing may start or end in the future (one minute of slack for clocks). */
const FUTURE_MSG = 'Blocks record time that already happened — this one would go into the future.';
function validateSession(data, excludeId) {
  const errs = [];
  const st = ms(data.started_at), en = data.ended_at ? ms(data.ended_at) : null;
  if (Number.isNaN(st)) errs.push({ code: 'start', message: 'Invalid start time.' });
  const limit = nowMs() + MIN;
  if (st > limit || (en != null && en > limit)) errs.push({ code: 'future', message: FUTURE_MSG });
  if (en != null) {
    if (!(en > st)) errs.push({ code: 'end', message: 'End must be after the start.' });
    else if (en - st > 16 * HOUR) errs.push({ code: 'long', message: 'Session longer than 16 h. Split it in two.' });
    const pz = normPauses({ pauses: data.pauses }, en).reduce((a, p) => a + (p.e - p.s), 0);
    if (pz > en - st) errs.push({ code: 'pause', message: 'Breaks cannot be longer than the session.' });
  }
  if ((data.note_md || '').length > 20000) errs.push({ code: 'note', message: 'The note exceeds 20,000 characters.' });
  if (en != null && en > st) {
    const c = findOverlap(st, en, excludeId);
    if (c) errs.push({ code: 'overlap', message: `Overlaps ${isTournament(c) ? 'a tournament' : 'another block'} (${fmtDayShort(dayKeyOf(ms(c.started_at)))} ${fmtRange(ms(c.started_at), c.ended_at ? ms(c.ended_at) : nowMs())}).`, conflict: c });
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
/* Apply several session changes as one step (used by push and merge) */
function applyBatch(changes, { undoable = true } = {}) {
  const entries = [];
  for (const ch of changes) {
    const s = sessionById(ch.id); if (!s) continue;
    entries.push({ id: ch.id, before: snapshot(s) });
    if (ch.remove) { s.deleted_at = iso(Date.now()); s.updated_at = s.deleted_at; }
    else Object.assign(s, ch.patch, { updated_at: iso(Date.now()) });
    dirty('session', ch.id);
  }
  if (undoable && entries.length) pushUndo({ type: 'batch', entries });
  commit('sessions');
  return entries.length;
}
/* Shift a whole chain of neighbours so a block can grow/move without a conflict.
   Returns the moves needed, or null when the chain hits a wall (tournament, closed day, day edge). */
function planPush(startMs, endMs, excludeId, dir) {
  const moves = []; const seen = new Set(excludeId ? [excludeId] : []);
  const dayEnd = dayMs(addDays(dayKeyOf(startMs), 1), 0), dayStart = dayMs(dayKeyOf(startMs), 0);
  let curStart = startMs, curEnd = endMs, guard = 0;
  while (guard++ < 12) {
    const hit = state.sessions.find((s) => isLive(s) && !seen.has(s.id) && ms(s.started_at) < curEnd && (s.ended_at ? ms(s.ended_at) : nowMs()) > curStart);
    if (!hit) return moves;
    if (isTournament(hit) || sessionLocked(hit) || !hit.ended_at) return null; // walls
    const hs = ms(hit.started_at), he = ms(hit.ended_at);
    const shift = dir > 0 ? curEnd - hs : curStart - he;
    const ns = hs + shift, ne = he + shift;
    if (ne > dayEnd || ns < dayStart) return null;
    if (ne > nowMs() + MIN) return null; // a neighbour cannot be pushed into the future
    seen.add(hit.id); moves.push({ id: hit.id, shift, start: ns, end: ne });
    curStart = ns; curEnd = ne;
  }
  return null;
}
function pushMoves(moves) {
  return moves.map((mv) => {
    const s = sessionById(mv.id);
    return { id: mv.id, patch: { started_at: iso(mv.start), ended_at: iso(mv.end), pauses: (s.pauses || []).map((p) => ({ start: iso(ms(p.start) + mv.shift), end: p.end ? iso(ms(p.end) + mv.shift) : null })) } };
  });
}
/* Two blocks of the same theme close together: merging keeps the total time (the gap becomes a break). */
function mergeCandidate(id, maxGapMin = 90) {
  const a = sessionById(id); if (!a || !a.ended_at || isTournament(a) || sessionLocked(a)) return null;
  const aS = ms(a.started_at), aE = ms(a.ended_at);
  let best = null;
  for (const b of state.sessions) {
    if (!isLive(b) || b.id === id || !b.ended_at || isTournament(b) || sessionLocked(b)) continue;
    if (b.theme !== a.theme) continue;
    const bS = ms(b.started_at), bE = ms(b.ended_at);
    if (dayKeyOf(bS) !== dayKeyOf(aS)) continue;
    const gap = bS >= aE ? bS - aE : aS >= bE ? aS - bE : 0;
    if (gap > maxGapMin * MIN) continue;
    if (!best || gap < best.gap) best = { other: b, gap };
  }
  return best;
}
function mergeSessions(idA, idB) {
  const a = sessionById(idA), b = sessionById(idB); if (!a || !b) return null;
  const start = Math.min(ms(a.started_at), ms(b.started_at));
  const end = Math.max(ms(a.ended_at), ms(b.ended_at));
  const first = ms(a.started_at) <= ms(b.started_at) ? a : b, second = first === a ? b : a;
  const gapStart = ms(first.ended_at), gapEnd = ms(second.started_at);
  const pauses = [...(a.pauses || []), ...(b.pauses || [])];
  if (gapEnd > gapStart) pauses.push({ start: iso(gapStart), end: iso(gapEnd) }); // the gap keeps the totals honest
  const note = [first.note_md, second.note_md].filter(Boolean).join('\n\n');
  const meta = { ...(second.meta || {}), ...(first.meta || {}) };
  applyBatch([
    { id: first.id, patch: { started_at: iso(start), ended_at: iso(end), pauses: pauses.sort((x, y) => x.start.localeCompare(y.start)), note_md: note, meta } },
    { id: second.id, remove: true },
  ]);
  return sessionById(first.id);
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
  const tkNow = todayKey();
  const to = m.deadline && m.deadline < tkNow ? m.deadline : null; // after the deadline nothing else counts towards the goal
  const done = sumRange(from, to, (s) => s.theme === m.theme).netMin;
  const goalMin = (m.goal_hours || 0) * 60;
  const tk = todayKey();
  const daysLeft = m.deadline ? daysBetween(tk, m.deadline) : null;
  const remaining = Math.max(0, goalMin - done);
  const perDay = daysLeft != null && daysLeft > 0 ? remaining / daysLeft : null;
  return { done, goalMin, progress: goalMin ? clamp(done / goalMin, 0, 1) : 0, daysLeft, remaining, perDay, complete: done >= goalMin && goalMin > 0, overdue: daysLeft != null && daysLeft < 0 && done < goalMin };
}

/* ===== Weeks (ISO: Monday → Sunday) ===== */
function weekStartKey(key = todayKey()) { const d = parseYmd(key); const wd = (d.getDay() + 6) % 7; return addDays(key, -wd); }
function weekLabel(startKey) { const a = parseYmd(startKey), b = parseYmd(addDays(startKey, 6)); return `${MON[a.getMonth()]} ${a.getDate()} – ${MON[b.getMonth()]} ${b.getDate()}`; }
function weekStats(startKey) {
  const endKey = addDays(startKey, 6);
  const r = sumRange(startKey, endKey); const byDay = netByDay(startKey, endKey);
  const days = Array.from({ length: 7 }, (_, i) => addDays(startKey, i));
  const perDay = days.map((k) => {
    const e = byDay.get(k);
    const byTheme = e ? Array.from(e.byTheme.entries()).map(([th, msv]) => ({ theme: th === '__none' ? null : th, min: msv / MIN })).sort((x, y) => y.min - x.min) : [];
    return { day: k, min: (e?.net || 0) / MIN, byTheme };
  });
  const studied = perDay.filter((d) => d.min > 0).length;
  let longest = 0;
  for (const s of activeSessions()) { const k = dayKeyOf(ms(s.started_at)); if (k < startKey || k > endKey) continue; longest = Math.max(longest, sessionTimes(s).net / MIN); }
  const tourn = new Set(tournamentDays().filter((t) => { const k = dayKeyOf(ms(t.started_at)); return k >= startKey && k <= endKey; }).map((t) => dayKeyOf(ms(t.started_at)))).size;
  const ratings = ratingStats(startKey, endKey);
  return { startKey, endKey, netMin: r.netMin, count: r.count, byTheme: r.byTheme, perDay, studied, longest, tournaments: tourn, ratings, avgPerStudiedDay: studied ? r.netMin / studied : 0 };
}
/* Two-hour buckets: how the person actually performs through the day */
const HOUR_BUCKETS = [[6, 8], [8, 10], [10, 12], [12, 14], [14, 16], [16, 18], [18, 20], [20, 22], [22, 24], [0, 6]];
function rhythmBuckets(fromKey) {
  const score = { focused: 1, normal: 0.6, scattered: 0.2 };
  const out = HOUR_BUCKETS.map(([a, b]) => ({ a, b, label: a === 0 ? '00–06' : `${pad2(a)}–${pad2(b % 24)}`, sessions: 0, minutes: 0, ratedN: 0, ratedSum: 0, days: new Set() }));
  for (const s of activeSessions()) {
    const day = dayKeyOf(ms(s.started_at)); if (fromKey && day < fromKey) continue;
    const hr = new Date(ms(s.started_at)).getHours();
    const bk = out.find((x) => (x.a === 0 ? hr < 6 : hr >= x.a && hr < x.b)); if (!bk) continue;
    bk.sessions++; bk.minutes += sessionTimes(s).net / MIN; bk.days.add(day);
    const r = s.meta?.rating; if (r && r in score) { bk.ratedN++; bk.ratedSum += score[r]; }
  }
  return out.map((b) => ({ ...b, days: b.days.size, focus: b.ratedN ? b.ratedSum / b.ratedN : null }));
}

/* ===== Numbers for the report ===== */
function sessionsInRange(fromKey, toKey) {
  return activeSessions().filter((s) => { const k = dayKeyOf(ms(s.started_at)); return (!fromKey || k >= fromKey) && (!toKey || k <= toKey); });
}
/* Per theme: time, share, number of blocks, average block, last day studied */
function themeBreakdown(fromKey, toKey) {
  const r = sumRange(fromKey, toKey);
  const list = sessionsInRange(fromKey, toKey);
  const counts = new Map(), last = new Map();
  for (const s of [...list, ...tournamentDays().filter((t) => { const k = dayKeyOf(ms(t.started_at)); return (!fromKey || k >= fromKey) && (!toKey || k <= toKey); }).map((t) => ({ ...t, theme: 'tournament' }))]) {
    const k = s.theme || '__none';
    counts.set(k, (counts.get(k) || 0) + 1);
    const d = dayKeyOf(ms(s.started_at));
    if (!last.get(k) || d > last.get(k)) last.set(k, d);
  }
  const total = r.netMin || 0;
  const rows = Array.from(r.byTheme.entries()).map(([k, min]) => ({
    theme: k === '__none' ? null : k, min, share: total ? min / total : 0,
    count: counts.get(k) || 0, avg: counts.get(k) ? min / counts.get(k) : 0, last: last.get(k) || null,
  })).sort((a, b) => b.min - a.min);
  return { rows, total, sessions: list.length };
}
function recordDay(fromKey, toKey) {
  let best = { day: null, min: 0 };
  for (const [k, v] of netByDay(fromKey, toKey)) { const m = v.net / MIN; if (m > best.min) best = { day: k, min: m }; }
  return best;
}
function weekdayTotals(fromKey, toKey) {
  const out = Array.from({ length: 7 }, () => ({ min: 0, days: new Set(), byTheme: new Map() }));
  for (const [k, v] of netByDay(fromKey, toKey)) {
    const wd = parseYmd(k).getDay(); const e = out[wd];
    e.min += v.net / MIN; e.days.add(k);
    for (const [th, msv] of v.byTheme) e.byTheme.set(th, (e.byTheme.get(th) || 0) + msv / MIN);
  }
  return out.map((e) => ({ min: e.min, days: e.days.size, avg: e.days.size ? e.min / e.days.size : 0, byTheme: Array.from(e.byTheme.entries()).map(([th, min]) => ({ theme: th === '__none' ? null : th, min })).sort((a, b) => b.min - a.min) }));
}
const LENGTH_BUCKETS = [[0, 30, 'under 30 min'], [30, 60, '30–60 min'], [60, 90, '60–90 min'], [90, 120, '90–120 min'], [120, Infinity, 'over 2 h']];
function lengthHistogram(fromKey, toKey) {
  const out = LENGTH_BUCKETS.map(([a, b, label]) => ({ a, b, label, count: 0, min: 0 }));
  for (const s of sessionsInRange(fromKey, toKey)) {
    const m = sessionTimes(s).net / MIN;
    const bk = out.find((x) => m >= x.a && m < x.b); if (bk) { bk.count++; bk.min += m; }
  }
  return out;
}

/* ===== Achievements ===== */
const RATINGS = [['focused', 'Focused', '#8bc34a'], ['normal', 'Normal', '#e0a03a'], ['scattered', 'Scattered', '#e06060']];
const RARITY = { 1: ['common', 'Common', '○'], 2: ['uncommon', 'Uncommon', '◇'], 3: ['rare', 'Rare', '✦'], 4: ['epic', 'Epic', '✦✦'], 5: ['legendary', 'Legendary', '♛'] };
const ACH_CATEGORIES = [['consistency', 'Consistency', 'fire'], ['volume', 'Time', 'clock'], ['sessions', 'Sessions', 'rook'], ['missions', 'Missions', 'focus'], ['books', 'Knowledge', 'book'], ['meditation', 'Meditation', 'brain'], ['special', 'Milestones', 'king']];
/* condition: (m) => number, against goal. `hidden` ones show as ??? until unlocked. */
const ACHIEVEMENTS = [
  { id: 'first_session', cat: 'consistency', tier: 1, icon: 'bolt', name: 'First step', desc: 'Log your first study block', goal: 1, val: (m) => m.sessions },
  { id: 'streak_3', cat: 'consistency', tier: 1, icon: 'fire', name: 'Three days', desc: '3-day streak', goal: 3, val: (m) => m.streak },
  { id: 'streak_7', cat: 'consistency', tier: 2, icon: 'fire', name: 'One week', desc: '7-day streak', goal: 7, val: (m) => m.streak },
  { id: 'streak_14', cat: 'consistency', tier: 3, icon: 'fire', name: 'Two weeks', desc: '14-day streak', goal: 14, val: (m) => m.streak },
  { id: 'streak_30', cat: 'consistency', tier: 4, icon: 'bolt', name: 'A month of it', desc: '30-day streak', goal: 30, val: (m) => m.streak },
  { id: 'streak_100', cat: 'consistency', tier: 5, icon: 'queen', name: 'One hundred days', desc: '100-day streak', goal: 100, val: (m) => m.streak },
  { id: 'hours_5', cat: 'volume', tier: 1, icon: 'clock', name: '5 hours', desc: '5 hours of net study', goal: 300, val: (m) => m.minutes },
  { id: 'hours_10', cat: 'volume', tier: 1, icon: 'clock', name: '10 hours', desc: '10 hours of net study', goal: 600, val: (m) => m.minutes },
  { id: 'hours_25', cat: 'volume', tier: 2, icon: 'clock', name: '25 hours', desc: '25 hours of net study', goal: 1500, val: (m) => m.minutes },
  { id: 'hours_50', cat: 'volume', tier: 2, icon: 'clock', name: '50 hours', desc: '50 hours of net study', goal: 3000, val: (m) => m.minutes },
  { id: 'hours_100', cat: 'volume', tier: 3, icon: 'star', name: '100 hours', desc: '100 hours of net study', goal: 6000, val: (m) => m.minutes },
  { id: 'hours_250', cat: 'volume', tier: 4, icon: 'award', name: '250 hours', desc: '250 hours of net study', goal: 15000, val: (m) => m.minutes },
  { id: 'hours_500', cat: 'volume', tier: 4, icon: 'award', name: '500 hours', desc: '500 hours of net study', goal: 30000, val: (m) => m.minutes },
  { id: 'hours_1000', cat: 'volume', tier: 5, icon: 'queen', name: '1000 hours', desc: '1000 hours of net study', goal: 60000, val: (m) => m.minutes },
  { id: 'sess_10', cat: 'sessions', tier: 1, icon: 'rook', name: '10 blocks', desc: 'Log 10 blocks', goal: 10, val: (m) => m.sessions },
  { id: 'sess_25', cat: 'sessions', tier: 1, icon: 'rook', name: '25 blocks', desc: 'Log 25 blocks', goal: 25, val: (m) => m.sessions },
  { id: 'sess_50', cat: 'sessions', tier: 2, icon: 'knight', name: '50 blocks', desc: 'Log 50 blocks', goal: 50, val: (m) => m.sessions },
  { id: 'sess_100', cat: 'sessions', tier: 3, icon: 'knight', name: '100 blocks', desc: 'Log 100 blocks', goal: 100, val: (m) => m.sessions },
  { id: 'sess_250', cat: 'sessions', tier: 4, icon: 'rook', name: '250 blocks', desc: 'Log 250 blocks', goal: 250, val: (m) => m.sessions },
  { id: 'sess_500', cat: 'sessions', tier: 5, icon: 'queen', name: '500 blocks', desc: 'Log 500 blocks', goal: 500, val: (m) => m.sessions },
  { id: 'mission_1', cat: 'missions', tier: 1, icon: 'focus', name: 'Mission accomplished', desc: 'Finish a mission', goal: 1, val: (m) => m.missions },
  { id: 'mission_5', cat: 'missions', tier: 2, icon: 'focus', name: 'Five missions', desc: 'Finish 5 missions', goal: 5, val: (m) => m.missions },
  { id: 'mission_10', cat: 'missions', tier: 3, icon: 'award', name: 'Ten missions', desc: 'Finish 10 missions', goal: 10, val: (m) => m.missions },
  { id: 'mission_25', cat: 'missions', tier: 5, icon: 'queen', name: 'Twenty-five missions', desc: 'Finish 25 missions', goal: 25, val: (m) => m.missions },
  { id: 'book_1', cat: 'books', tier: 1, icon: 'book', name: 'First book', desc: 'Finish a chess book', goal: 1, val: (m) => m.books },
  { id: 'book_5', cat: 'books', tier: 2, icon: 'book', name: 'Five books', desc: 'Finish 5 chess books', goal: 5, val: (m) => m.books },
  { id: 'book_10', cat: 'books', tier: 3, icon: 'book', name: 'Ten books', desc: 'Finish 10 chess books', goal: 10, val: (m) => m.books },
  { id: 'book_25', cat: 'books', tier: 5, icon: 'queen', name: 'A library', desc: 'Finish 25 chess books', goal: 25, val: (m) => m.books },
  { id: 'med_1', cat: 'meditation', tier: 1, icon: 'brain', name: 'First breath', desc: 'Finish your first meditation', goal: 1, val: (m) => m.medCount },
  { id: 'med_10', cat: 'meditation', tier: 2, icon: 'brain', name: 'Ten sessions', desc: 'Finish 10 meditations', goal: 10, val: (m) => m.medCount },
  { id: 'med_50', cat: 'meditation', tier: 3, icon: 'lightbulb', name: 'Fifty sessions', desc: 'Finish 50 meditations', goal: 50, val: (m) => m.medCount },
  { id: 'med_streak_7', cat: 'meditation', tier: 3, icon: 'fire', name: 'A week of calm', desc: 'Meditate 7 days in a row', goal: 7, val: (m) => m.medStreak },
  { id: 'med_streak_30', cat: 'meditation', tier: 5, icon: 'queen', name: 'A month of calm', desc: 'Meditate 30 days in a row', goal: 30, val: (m) => m.medStreak },
  { id: 'med_min_60', cat: 'meditation', tier: 2, icon: 'clock', name: 'One hour of breathing', desc: '60 minutes of meditation', goal: 60, val: (m) => m.medMinutes },
  { id: 'med_min_600', cat: 'meditation', tier: 4, icon: 'award', name: 'Ten hours of breathing', desc: '10 hours of meditation', goal: 600, val: (m) => m.medMinutes },
  { id: 'med_wim', cat: 'meditation', tier: 4, icon: 'fire', name: 'Iceman', desc: 'Complete a Wim Hof session', goal: 1, val: (m) => m.medWim, hidden: true },
  { id: 'med_before_study', cat: 'meditation', tier: 3, icon: 'focus', name: 'Clear head', desc: 'Meditate and study on the same day, 10 times', goal: 10, val: (m) => m.medWithStudy, hidden: true },
  { id: 'week_full', cat: 'special', tier: 3, icon: 'calendar', name: 'Full week', desc: '7 days in a row above the daily minimum', goal: 7, val: (m) => m.bestWeekRun },
  { id: 'tournament_1', cat: 'special', tier: 2, icon: 'flag', name: 'Tournament day', desc: 'Mark your first tournament day', goal: 1, val: (m) => m.tournaments },
  { id: 'long_2h', cat: 'special', tier: 2, icon: 'brain', name: 'Two hours straight', desc: 'A single block of 2 hours or more', goal: 120, val: (m) => m.longest },
  { id: 'focus_1', cat: 'special', tier: 1, icon: 'star', name: 'In the zone', desc: 'Rate a block as focused', goal: 1, val: (m) => m.focused },
  { id: 'focus_20', cat: 'special', tier: 3, icon: 'focus', name: 'Deep work', desc: '20 blocks rated as focused', goal: 20, val: (m) => m.focused },
  { id: 'themes_5', cat: 'special', tier: 2, icon: 'lightbulb', name: 'All-rounder', desc: 'Study 5 different themes', goal: 5, val: (m) => m.themes },
  { id: 'early_bird', cat: 'special', tier: 3, icon: 'eye', name: 'Early bird', desc: '5 blocks started before 8am', goal: 5, val: (m) => m.early, hidden: true },
  { id: 'night_owl', cat: 'special', tier: 3, icon: 'eye-off', name: 'Night owl', desc: '5 blocks started after 10pm', goal: 5, val: (m) => m.late, hidden: true },
  { id: 'marathon', cat: 'special', tier: 4, icon: 'knight', name: 'Marathon', desc: 'A single block of 4 hours or more', goal: 240, val: (m) => m.longest, hidden: true },
  { id: 'comeback', cat: 'special', tier: 3, icon: 'refresh', name: 'Back on track', desc: 'Study again after a two-week gap', goal: 1, val: (m) => m.comeback, hidden: true },
];
const Achievements = {
  metrics() {
    const sessions = activeSessions(); const all = sumRange(null, null); const sk = streakInfo();
    const minMs = (state.settings.streak_min_min || 25) * MIN; const byDay = netByDay(null, null);
    let bestWeekRun = 0, run = 0, prev = null, comeback = 0;
    const keys = Array.from(byDay.keys()).sort();
    keys.forEach((k) => {
      if (prev && daysBetween(prev, k) >= 14) comeback = 1;
      if (byDay.get(k).net < minMs) { run = 0; prev = k; return; }
      run = prev && addDays(prev, 1) === k ? run + 1 : 1; bestWeekRun = Math.max(bestWeekRun, run); prev = k;
    });
    const hours = sessions.map((s) => new Date(ms(s.started_at)).getHours());
    return {
      sessions: sessions.length, minutes: all.netMin, streak: Math.max(sk.best, sk.current), bestWeekRun,
      missions: state.missions.filter((m) => !m.deleted_at && (m.status === 'done' || missionStats(m).complete)).length,
      books: (state.settings.books || []).length,
      tournaments: tournamentDays().length,
      longest: sessions.reduce((a, s) => Math.max(a, sessionTimes(s).net / MIN), 0),
      focused: sessions.filter((s) => s.meta?.rating === 'focused').length,
      themes: new Set(sessions.map((s) => s.theme).filter(Boolean)).size,
      early: hours.filter((h) => h < 8).length, late: hours.filter((h) => h >= 22).length, comeback,
      ...(() => {
        const med = sessions.filter((x) => x.meta?.type === 'meditation');
        const medDays = new Set(med.map((x) => dayKeyOf(ms(x.started_at))));
        const studyDays = new Set(sessions.filter((x) => x.meta?.type !== 'meditation').map((x) => dayKeyOf(ms(x.started_at))));
        let streak = 0; let d = todayKey(); if (!medDays.has(d)) d = addDays(d, -1);
        while (medDays.has(d)) { streak++; d = addDays(d, -1); }
        return { medCount: med.length, medMinutes: med.reduce((a, x) => a + sessionTimes(x).net / MIN, 0), medStreak: streak,
          medWim: med.filter((x) => x.meta?.pattern === 'wimhof' && x.meta?.completed).length,
          medWithStudy: Array.from(medDays).filter((k) => studyDays.has(k)).length };
      })(),
    };
  },
  list() {
    const m = this.metrics(); const won = state.settings.achievements || {};
    return ACHIEVEMENTS.map((a) => { const have = a.val(m); return { ...a, have, done: !!won[a.id] || have >= a.goal, pct: clamp(have / a.goal, 0, 1), at: won[a.id] || null, rarity: RARITY[a.tier] }; });
  },
  /* Evaluated on real events, not on every render. */
  check(event) {
    const m = this.metrics(); const won = { ...(state.settings.achievements || {}) }; const fresh = [];
    for (const a of ACHIEVEMENTS) { if (won[a.id]) continue; if (a.val(m) >= a.goal) { won[a.id] = iso(Date.now()); fresh.push(a); } }
    if (!fresh.length) return [];
    state.settings.achievements = won; state.settings.updated_at = iso(Date.now());
    dirty('settings', 'settings', ['achievements']); persist();
    if (state.settings.ach_feedback !== false) {
      // a burst (first sync, old history) is summed up instead of filling the screen with toasts
      const shown = fresh.length > 3 ? fresh.slice(0, 2) : fresh;
      shown.forEach((a, i) => setTimeout(() => announceAchievement(a), i * 1500));
      if (fresh.length > 3) { const rest = fresh.slice(2); setTimeout(() => announceAchievement({ icon: 'award', name: `${rest.length} more achievements`, desc: rest.slice(0, 3).map((x) => x.name).join(' · ') + (rest.length > 3 ? ' …' : ''), bonus: rest.reduce((a2, x) => a2 + (ACH_CREDITS[x.tier] || 0), 0) }), 3000); }
    }
    emit('achievements', fresh);
    return fresh;
  },
};

/* Average focus rating, for the report *//* Average focus rating, for the report */
function ratingStats(fromKey, toKey) {
  const out = { counts: { focused: 0, normal: 0, scattered: 0 }, byTheme: new Map(), byHour: new Map(), total: 0 };
  const score = { focused: 1, normal: 0.5, scattered: 0 };
  for (const s of activeSessions()) {
    const r = s.meta?.rating; if (!r || !(r in out.counts)) continue;
    const day = dayKeyOf(ms(s.started_at));
    if ((fromKey && day < fromKey) || (toKey && day > toKey)) continue;
    out.counts[r]++; out.total++;
    const th = s.theme || '__none'; const t = out.byTheme.get(th) || { n: 0, sum: 0 }; t.n++; t.sum += score[r]; out.byTheme.set(th, t);
    const hr = new Date(ms(s.started_at)).getHours(); const hh = out.byHour.get(hr) || { n: 0, sum: 0 }; hh.n++; hh.sum += score[r]; out.byHour.set(hr, hh);
  }
  return out;
}

/* ===== Late study: pointed out, never punished ===== */
const hhmmToMin = (v) => { const [a, b] = String(v || '').split(':').map(Number); return (a || 0) * 60 + (b || 0); };
const LATE_UNTIL_MIN = 5 * 60; // the small hours count as late too
/* dayKey -> minutes of net study after the late hour (default 23:00) or before 05:00 */
function lateByDay(fromKey, toKey) {
  const map = new Map(); const from = hhmmToMin(state.settings.late_from || '23:00');
  for (const s of activeSessions()) {
    if (s.meta?.type === 'meditation') continue;
    for (const sl of sliceSession(s)) {
      if ((fromKey && sl.day < fromKey) || (toKey && sl.day > toKey)) continue;
      const wins = from < LATE_UNTIL_MIN ? [[dayMs(sl.day, from), dayMs(sl.day, LATE_UNTIL_MIN)]] : [[dayMs(sl.day, 0), dayMs(sl.day, LATE_UNTIL_MIN)], [dayMs(sl.day, from), dayMs(addDays(sl.day, 1), 0)]];
      const pz = normPauses(s, sl.end);
      let late = 0;
      for (const [a, b] of wins) {
        const g = overlapMs(sl.start, sl.end, a, b); if (!g) continue;
        const lo = Math.max(sl.start, a), hi = Math.min(sl.end, b);
        late += g - pz.reduce((acc, p) => acc + overlapMs(p.s, p.e, lo, hi), 0);
      }
      if (late > 30000) map.set(sl.day, (map.get(sl.day) || 0) + late / MIN);
    }
  }
  return map;
}

/* ===== Focus (the rating asked when a block closes) ===== */
function focusStats(fromKey, toKey, filter) {
  const out = { focused: 0, normal: 0, scattered: 0, unrated: 0, total: 0, rated: 0, share: null, list: [] };
  for (const s of activeSessions()) {
    if (s.meta?.type === 'meditation') continue;
    const k = dayKeyOf(ms(s.started_at)); if ((fromKey && k < fromKey) || (toKey && k > toKey)) continue;
    if (filter && !filter(s)) continue;
    out.total++; out.list.push(s);
    const r = s.meta?.rating; if (r === 'focused' || r === 'normal' || r === 'scattered') out[r]++; else out.unrated++;
  }
  out.rated = out.total - out.unrated; out.share = out.rated ? out.focused / out.rated : null;
  out.list.sort((a, b) => a.started_at.localeCompare(b.started_at));
  return out;
}

/* ===== Aggregations ===== */
/* Map dayKey -> {net, gross, count, ids, byTheme, tourn} over live sessions (running included, clipped at now).
   Tournament time counts, under its own colour. */
function netByDay(fromKey, toKey, filter) {
  const map = new Map(); const now = nowMs();
  const fromMs = fromKey ? dayMs(fromKey, 0) : -Infinity, toMs = toKey ? dayMs(addDays(toKey, 1), 0) : Infinity;
  for (const s of state.sessions) {
    if (!isLive(s) || (filter && !filter(s))) continue;
    const st = ms(s.started_at), en = s.ended_at ? ms(s.ended_at) : now;
    if (en <= fromMs || st >= toMs || st >= now) continue; // anything still in the future does not count yet
    const tourn = isTournament(s);
    for (const sl of sliceSession(s, now)) {
      if ((fromKey && sl.day < fromKey) || (toKey && sl.day > toKey) || sl.start >= now) continue;
      const frac = Math.min(sl.end, now) - sl.start > 0 ? (Math.min(sl.end, now) - sl.start) / (sl.end - sl.start) : 0;
      const e = map.get(sl.day) || { net: 0, gross: 0, count: 0, ids: new Set(), byTheme: new Map(), tourn: false };
      e.net += sl.net * frac; e.gross += sl.gross * frac; if (!tourn && !e.ids.has(s.id)) { e.ids.add(s.id); e.count++; } // ids/count = study blocks
      if (tourn) e.tourn = true;
      const k = tourn ? 'tournament' : s.theme || '__none'; e.byTheme.set(k, (e.byTheme.get(k) || 0) + sl.net * frac);
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
/* 'ok' = the day counts (enough study, or a tournament), 'neutral' = rest/travel/recovery, 'miss' = breaks the streak */
function dayStreakState(key, map, minMs) {
  const e = map.get(key);
  if (e && (e.net >= minMs || e.tourn)) return 'ok';
  return NEUTRAL_DAYS.has(dayType(key)) ? 'neutral' : 'miss';
}
function streakInfo() {
  const minMs = (state.settings.streak_min_min || 25) * MIN;
  const map = netByDay(null, null); const tk = todayKey();
  const st = (k) => dayStreakState(k, map, minMs);
  const todayOk = st(tk) === 'ok';
  let current = 0, day = todayOk ? tk : addDays(tk, -1), guard = 0; // today still open: it cannot break anything yet
  while (guard++ < 4000) { const s = st(day); if (s === 'ok') current++; else if (s !== 'neutral') break; day = addDays(day, -1); }
  const keys = Array.from(map.keys()).sort(); let best = current, run = 0;
  if (keys.length) {
    guard = 0;
    for (let d = keys[0]; d <= tk && guard++ < 4000; d = addDays(d, 1)) {
      const s = st(d);
      if (s === 'ok') { run++; best = Math.max(best, run); } else if (s === 'miss' && d !== tk) run = 0;
    }
  }
  return { current, best, todayOk, todayMin: (map.get(tk)?.net || 0) / MIN };
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

/* ===== Meditation habit: a weekly goal of days ===== */
function meditationDaySet() { return new Set(activeSessions().filter((s) => s.meta?.type === 'meditation').map((s) => dayKeyOf(ms(s.started_at)))); }
const medGoal = () => clamp(Math.round(+state.settings.med_goal_days || 5), 1, 7);
function meditationWeek(startKey = weekStartKey()) {
  const set = meditationDaySet(); const goal = medGoal();
  const days = Array.from({ length: 7 }, (_, i) => { const k = addDays(startKey, i); return { day: k, done: set.has(k) }; });
  const count = days.filter((d) => d.done).length;
  return { goal, count, met: count >= goal, days, left: Math.max(0, goal - count) };
}

/* ===== Credits: earned by studying, spent on the study room =====
   Everything is derived from the records, so the balance can never drift between devices. */
const CREDITS_PER_HOUR = 10;
const ACH_CREDITS = { 1: 10, 2: 25, 3: 50, 4: 100, 5: 200 };
const CLOSE_DAY_CREDITS = 5, MED_DAY_CREDITS = 4;
const LEVEL_TITLES = [[1, 'Pawn'], [3, 'Knight'], [5, 'Bishop'], [8, 'Rook'], [12, 'Queen'], [16, 'King'], [20, 'Master'], [26, 'Grandmaster']];
const blockCredits = (s) => (s && isLive(s) && s.ended_at ? Math.floor(sessionTimes(s).net / MIN / (60 / CREDITS_PER_HOUR)) : 0);
function levelInfo(xp) {
  const level = Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1;
  const from = 50 * (level - 1) ** 2, to = 50 * level ** 2;
  const title = LEVEL_TITLES.filter(([l]) => l <= level).pop()[1];
  return { level, title, xp, levelFrom: from, levelTo: to, levelPct: clamp((xp - from) / (to - from), 0, 1) };
}
const Credits = {
  _v: -1, _m: null,
  get() {
    if (this._v === Store.version && this._m) return this._m;
    let time = 0; const blockDays = new Set();
    for (const s of state.sessions) { if (!isLive(s) || !s.ended_at) continue; time += blockCredits(s); blockDays.add(dayKeyOf(ms(s.started_at))); }
    const won = state.settings.achievements || {}; let ach = 0;
    for (const a of ACHIEVEMENTS) if (won[a.id]) ach += ACH_CREDITS[a.tier] || 0;
    let closed = 0; for (const [k, e] of Object.entries(state.days.entries || {})) if (e && e.status === 'closed' && blockDays.has(k)) closed++;
    const parts = { time, achievements: ach, closing: closed * CLOSE_DAY_CREDITS, meditation: meditationDaySet().size * MED_DAY_CREDITS };
    const earned = parts.time + parts.achievements + parts.closing + parts.meditation;
    const spent = (state.room.owned || []).reduce((a, o) => a + (+o.price || 0), 0);
    this._m = { earned, spent, balance: earned - spent, parts, ...levelInfo(earned) }; this._v = Store.version;
    return this._m;
  },
  /* what one day brought in: its blocks, plus the bonus for closing it */
  forDay(key) {
    let n = 0; for (const s of state.sessions) if (isLive(s) && s.ended_at && dayKeyOf(ms(s.started_at)) === key) n += blockCredits(s);
    return n + (n > 0 && isDayLocked(key) ? CLOSE_DAY_CREDITS : 0) + (meditationDaySet().has(key) ? MED_DAY_CREDITS : 0);
  },
};
