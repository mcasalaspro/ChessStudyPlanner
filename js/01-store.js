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
  break_every_min: 25, break_len_min: 15, pause_autostop_min: 60, streak_min_min: 25, default_len_min: 60, snap_min: 15, target_min: null,
  focus_anim: 'aurora', sound: true, bg_strength: 'strong', night_freeze: false, night_from: '23:00', night_to: '07:00', guided_breaks: true, weekly_goal_hours: 0, books: [], achievements: {}, ach_feedback: true, updated_at: null,
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
const isTournament = (s) => s.meta?.type === 'tournament';
const activeSessions = () => state.sessions.filter((s) => isLive(s) && s.ended_at && !isTournament(s));
const tournamentDays = () => state.sessions.filter((s) => isLive(s) && isTournament(s));
/* Any tournament block overlapping the range (planning is blocked there, real study is not) */
function tournamentAt(startMs, endMs) { return tournamentDays().find((t) => ms(t.started_at) < endMs && ms(t.ended_at) > startMs) || null; }
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
function findOverlap(startMs, endMs, excludeId) {
  const now = nowMs();
  for (const s of state.sessions) {
    if (!isLive(s) || isTournament(s) || s.id === excludeId) continue;
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
  const perDay = days.map((k) => ({ day: k, min: (byDay.get(k)?.net || 0) / MIN }));
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

/* ===== Achievements ===== */
const RATINGS = [['focused', 'Focused', '#8bc34a'], ['normal', 'Normal', '#e0a03a'], ['scattered', 'Scattered', '#e06060']];
const RARITY = { 1: ['common', 'Common', '○'], 2: ['uncommon', 'Uncommon', '◇'], 3: ['rare', 'Rare', '✦'], 4: ['epic', 'Epic', '✦✦'], 5: ['legendary', 'Legendary', '♛'] };
const ACH_CATEGORIES = [['consistency', 'Consistency', '🔥'], ['volume', 'Time', '⏱'], ['sessions', 'Sessions', '♟'], ['missions', 'Missions', '🎯'], ['books', 'Knowledge', '📚'], ['special', 'Milestones', '👑']];
/* condition: (m) => number, against goal. `hidden` ones show as ??? until unlocked. */
const ACHIEVEMENTS = [
  { id: 'first_session', cat: 'consistency', tier: 1, icon: '🚀', name: 'First step', desc: 'Log your first study block', goal: 1, val: (m) => m.sessions },
  { id: 'streak_3', cat: 'consistency', tier: 1, icon: '🔥', name: 'Three days', desc: '3-day streak', goal: 3, val: (m) => m.streak },
  { id: 'streak_7', cat: 'consistency', tier: 2, icon: '🔥', name: 'One week', desc: '7-day streak', goal: 7, val: (m) => m.streak },
  { id: 'streak_14', cat: 'consistency', tier: 3, icon: '🔥', name: 'Two weeks', desc: '14-day streak', goal: 14, val: (m) => m.streak },
  { id: 'streak_30', cat: 'consistency', tier: 4, icon: '⚡', name: 'A month of it', desc: '30-day streak', goal: 30, val: (m) => m.streak },
  { id: 'streak_100', cat: 'consistency', tier: 5, icon: '♛', name: 'One hundred days', desc: '100-day streak', goal: 100, val: (m) => m.streak },
  { id: 'hours_5', cat: 'volume', tier: 1, icon: '⏱', name: '5 hours', desc: '5 hours of net study', goal: 300, val: (m) => m.minutes },
  { id: 'hours_10', cat: 'volume', tier: 1, icon: '⏱', name: '10 hours', desc: '10 hours of net study', goal: 600, val: (m) => m.minutes },
  { id: 'hours_25', cat: 'volume', tier: 2, icon: '⌛', name: '25 hours', desc: '25 hours of net study', goal: 1500, val: (m) => m.minutes },
  { id: 'hours_50', cat: 'volume', tier: 2, icon: '⌛', name: '50 hours', desc: '50 hours of net study', goal: 3000, val: (m) => m.minutes },
  { id: 'hours_100', cat: 'volume', tier: 3, icon: '💯', name: '100 hours', desc: '100 hours of net study', goal: 6000, val: (m) => m.minutes },
  { id: 'hours_250', cat: 'volume', tier: 4, icon: '🏆', name: '250 hours', desc: '250 hours of net study', goal: 15000, val: (m) => m.minutes },
  { id: 'hours_500', cat: 'volume', tier: 4, icon: '🏆', name: '500 hours', desc: '500 hours of net study', goal: 30000, val: (m) => m.minutes },
  { id: 'hours_1000', cat: 'volume', tier: 5, icon: '♛', name: '1000 hours', desc: '1000 hours of net study', goal: 60000, val: (m) => m.minutes },
  { id: 'sess_10', cat: 'sessions', tier: 1, icon: '♟', name: '10 blocks', desc: 'Log 10 blocks', goal: 10, val: (m) => m.sessions },
  { id: 'sess_25', cat: 'sessions', tier: 1, icon: '♟', name: '25 blocks', desc: 'Log 25 blocks', goal: 25, val: (m) => m.sessions },
  { id: 'sess_50', cat: 'sessions', tier: 2, icon: '♞', name: '50 blocks', desc: 'Log 50 blocks', goal: 50, val: (m) => m.sessions },
  { id: 'sess_100', cat: 'sessions', tier: 3, icon: '♞', name: '100 blocks', desc: 'Log 100 blocks', goal: 100, val: (m) => m.sessions },
  { id: 'sess_250', cat: 'sessions', tier: 4, icon: '♜', name: '250 blocks', desc: 'Log 250 blocks', goal: 250, val: (m) => m.sessions },
  { id: 'sess_500', cat: 'sessions', tier: 5, icon: '♛', name: '500 blocks', desc: 'Log 500 blocks', goal: 500, val: (m) => m.sessions },
  { id: 'mission_1', cat: 'missions', tier: 1, icon: '🎯', name: 'Mission accomplished', desc: 'Finish a mission', goal: 1, val: (m) => m.missions },
  { id: 'mission_5', cat: 'missions', tier: 2, icon: '🎯', name: 'Five missions', desc: 'Finish 5 missions', goal: 5, val: (m) => m.missions },
  { id: 'mission_10', cat: 'missions', tier: 3, icon: '🥇', name: 'Ten missions', desc: 'Finish 10 missions', goal: 10, val: (m) => m.missions },
  { id: 'mission_25', cat: 'missions', tier: 5, icon: '♛', name: 'Twenty-five missions', desc: 'Finish 25 missions', goal: 25, val: (m) => m.missions },
  { id: 'book_1', cat: 'books', tier: 1, icon: '📖', name: 'First book', desc: 'Finish a chess book', goal: 1, val: (m) => m.books },
  { id: 'book_5', cat: 'books', tier: 2, icon: '📚', name: 'Five books', desc: 'Finish 5 chess books', goal: 5, val: (m) => m.books },
  { id: 'book_10', cat: 'books', tier: 3, icon: '📚', name: 'Ten books', desc: 'Finish 10 chess books', goal: 10, val: (m) => m.books },
  { id: 'book_25', cat: 'books', tier: 5, icon: '♛', name: 'A library', desc: 'Finish 25 chess books', goal: 25, val: (m) => m.books },
  { id: 'week_full', cat: 'special', tier: 3, icon: '📅', name: 'Full week', desc: '7 days in a row above the daily minimum', goal: 7, val: (m) => m.bestWeekRun },
  { id: 'tournament_1', cat: 'special', tier: 2, icon: '🏁', name: 'Tournament day', desc: 'Mark your first tournament day', goal: 1, val: (m) => m.tournaments },
  { id: 'long_2h', cat: 'special', tier: 2, icon: '🧠', name: 'Two hours straight', desc: 'A single block of 2 hours or more', goal: 120, val: (m) => m.longest },
  { id: 'focus_1', cat: 'special', tier: 1, icon: '✨', name: 'In the zone', desc: 'Rate a block as focused', goal: 1, val: (m) => m.focused },
  { id: 'focus_20', cat: 'special', tier: 3, icon: '🧿', name: 'Deep work', desc: '20 blocks rated as focused', goal: 20, val: (m) => m.focused },
  { id: 'themes_5', cat: 'special', tier: 2, icon: '🎓', name: 'All-rounder', desc: 'Study 5 different themes', goal: 5, val: (m) => m.themes },
  { id: 'early_bird', cat: 'special', tier: 3, icon: '🌅', name: 'Early bird', desc: '5 blocks started before 8am', goal: 5, val: (m) => m.early, hidden: true },
  { id: 'night_owl', cat: 'special', tier: 3, icon: '🌙', name: 'Night owl', desc: '5 blocks started after 10pm', goal: 5, val: (m) => m.late, hidden: true },
  { id: 'marathon', cat: 'special', tier: 4, icon: '🐎', name: 'Marathon', desc: 'A single block of 4 hours or more', goal: 240, val: (m) => m.longest, hidden: true },
  { id: 'comeback', cat: 'special', tier: 3, icon: '🔄', name: 'Back on track', desc: 'Study again after a two-week gap', goal: 1, val: (m) => m.comeback, hidden: true },
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
    dirty('settings', 'settings'); persist();
    if (state.settings.ach_feedback !== false) fresh.forEach((a, i) => setTimeout(() => announceAchievement(a), i * 1500));
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

/* ===== Night hours (sleep window) ===== */
const hhmmToMin = (v) => { const [a, b] = String(v || '').split(':').map(Number); return (a || 0) * 60 + (b || 0); };
/* True when the given minute of the day falls inside the frozen sleep window. */
function isNightMinute(min) {
  if (!state.settings.night_freeze) return false;
  const a = hhmmToMin(state.settings.night_from), b = hhmmToMin(state.settings.night_to);
  if (a === b) return false;
  return a < b ? min >= a && min < b : min >= a || min < b;
}
function nightBlocks(startMs, endMs) { // any minute of the range inside the sleep window
  if (!state.settings.night_freeze) return false;
  for (let t = startMs; t < endMs; t += 15 * MIN) if (isNightMinute(minuteOfDay(t))) return true;
  return isNightMinute(minuteOfDay(endMs - 1));
}

/* ===== Aggregations ===== */
/* Map dayKey -> {net, gross, count, ids, byTheme} over live sessions (running included, clipped at now) */
function netByDay(fromKey, toKey, filter) {
  const map = new Map(); const now = nowMs();
  const fromMs = fromKey ? dayMs(fromKey, 0) : -Infinity, toMs = toKey ? dayMs(addDays(toKey, 1), 0) : Infinity;
  for (const s of state.sessions) {
    if (!isLive(s) || isTournament(s) || (filter && !filter(s))) continue;
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
