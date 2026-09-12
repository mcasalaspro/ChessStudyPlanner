/* ===== Export / import ===== */
function download(name, content, type) {
  const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name }); document.body.append(a); a.click(); setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 500);
}
function csvEscape(v) { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function exportCsv(sessions) {
  const head = ['date', 'start', 'end', 'gross_min', 'break_min', 'net_min', 'theme', 'source', 'note'];
  const rows = [head.join(';')];
  for (const s of sessions.slice().sort((a, b) => a.started_at.localeCompare(b.started_at))) {
    const tm = sessionTimes(s);
    rows.push([dayKeyOf(tm.start), `${ymd(new Date(tm.start))} ${hm(tm.start)}`, `${ymd(new Date(tm.end))} ${hm(tm.end)}`, Math.round(tm.gross / MIN), Math.round(tm.pauseMs / MIN), Math.round(tm.net / MIN), themeName(s.theme), s.meta?.autoclosed ? 'auto' : s.source, s.note_md || ''].map(csvEscape).join(';'));
  }
  download(`chess-study-${ymd(new Date())}.csv`, '\ufeff' + rows.join('\r\n'), 'text/csv;charset=utf-8');
}
function exportJson() {
  const dump = { app: 'chess-study-planner', version: 2, exported_at: iso(Date.now()), settings: state.settings, missions: state.missions, sessions: state.sessions };
  download(`chess-study-backup-${ymd(new Date())}.json`, JSON.stringify(dump, null, 2), 'application/json');
}
function importJson(obj) {
  if (!obj || obj.app !== 'chess-study-planner' || !Array.isArray(obj.sessions)) throw new Error('invalid');
  let n = 0, u = 0, c = 0;
  const merge = (coll, incoming, kind) => {
    for (const item of incoming || []) {
      if (!item || !item.id) continue;
      if (kind === 'session' && item.mission_id !== undefined && item.theme === undefined) { item.theme = null; delete item.mission_id; delete item.tags; } // v1 backup
      const idx = coll.findIndex((x) => x.id === item.id);
      if (idx < 0) { coll.push(item); n++; dirty(kind, item.id); }
      else if ((item.updated_at || '') > (coll[idx].updated_at || '')) { coll[idx] = item; u++; dirty(kind, item.id); }
      else c++;
    }
  };
  merge(state.sessions, obj.sessions, 'session');
  if (obj.version >= 2) merge(state.missions, obj.missions, 'mission');
  const running = state.sessions.filter((s) => !s.deleted_at && !s.ended_at).sort((a, b) => a.started_at.localeCompare(b.started_at));
  running.slice(1).forEach((s) => { s.ended_at = iso(Math.max(ms(s.started_at) + 60000, ms(s.updated_at || s.started_at))); s.meta = { ...(s.meta || {}), autoclosed: true, autoclosed_reason: 'import' }; dirty('session', s.id); });
  if (obj.version >= 2 && obj.settings && Array.isArray(obj.settings.themes)) updateSettings({ ...obj.settings, name: state.settings.name || obj.settings.name });
  commit('sessions');
  return { n, u, c };
}

/* Sample data for trying the app (35 days of fictitious blocks) */
function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
function seedSampleData() {
  const rnd = mulberry(7); const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const ths = themes().map((x) => x.id);
  const notes = ['**[19:12]** Italian with 4.c3: remember the d4 plan after castling.', 'Lucena with a rook pawn: the bridge works the same.', '- 12 puzzles, 9 correct\n- pattern I missed: sacrifice on h7', 'Reviewed round 3. `28...Qxd4` was the move.', 'Philidor: rook on the third rank until the pawn advances.', 'Opening review from the notebook, no board.'];
  const today = new Date(nowMs());
  for (let d = 35; d >= 1; d--) {
    if (rnd() < 0.25) continue;
    const n = rnd() < 0.6 ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const startH = i === 0 ? (rnd() < 0.4 ? 8 + Math.floor(rnd() * 4) : 18 + Math.floor(rnd() * 3)) : 20 + Math.floor(rnd() * 2);
      const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - d, startH, [0, 15, 30, 45][Math.floor(rnd() * 4)]);
      const durMin = 25 + Math.floor(rnd() * 8) * 10; const start = day.getTime(), end = start + durMin * MIN;
      if (findOverlap(start, end)) continue;
      const pauses = rnd() < 0.35 ? [{ start: iso(start + Math.floor(durMin / 2) * MIN), end: iso(start + Math.floor(durMin / 2) * MIN + (3 + Math.floor(rnd() * 8)) * MIN) }] : [];
      const s = newSessionObj({ theme: pick(ths), started_at: iso(start), ended_at: iso(end), pauses, source: rnd() < 0.8 ? 'timer' : 'manual', note_md: rnd() < 0.4 ? pick(notes) : '' });
      state.sessions.push(s); dirty('session', s.id);
    }
  }
  if (!activeMissions().length) createMission({ name: 'Calculation', theme: ths[0], goal_hours: 50, deadline: addDays(todayKey(), 91) });
  commit('sessions');
}
