/* ===== Main page cards ===== */

/* ---------- Study timer ---------- */
const TimerCard = {
  el: null,
  mount(root) {
    this.el = h('section', { class: 'card timer-card', id: 'card-timer' }); root.append(this.el);
    this.render(); on('change', () => this.render()); on('tick', () => this.updateDigits());
  },
  render() {
    const r = runningSession(); const st = Timer.status(); const s = state.settings; const onBreak = !!Timer.breakLeft();
    const theme = r ? r.theme : s.last_theme;
    const chips = themeChips(theme, (v) => { if (r) Timer.setTheme(v); else updateSettings({ last_theme: v }); }, { allowNone: false });
    const startBtn = h('button', { class: 'btn primary', id: 'btn-start', disabled: st === 'running' || onBreak, onClick: () => { try { if (st === 'paused') Timer.resume(); else Timer.start(theme); } catch (e) { toast(e.message, { error: true }); } } }, onBreak ? '☕ On break' : st === 'paused' ? '▶ Resume' : '▶ Start');
    const pauseBtn = onBreak
      ? h('button', { class: 'btn primary', onClick: () => Timer.endBreak() }, '▶ Skip break')
      : h('button', { class: 'btn', disabled: st !== 'running', onClick: () => Timer.pause() }, '❚❚ Pause');
    const plusBtn = onBreak ? h('button', { class: 'btn', onClick: () => Timer.addBreakMinutes(5) }, '+5 min break') : h('button', { class: 'btn', disabled: !r, title: 'Started before you hit Start? Moves the beginning back 10 minutes.', onClick: () => { if (Timer.addMinutes(10)) toast('+10 min added to the start'); else toast('Cannot move the start back: another block is right before it.', { error: true }); } }, '+10 min');
    const stopBtn = h('button', { class: 'btn', disabled: !r, onClick: () => { const x = Timer.stop(); if (x) Panel.closeSession(x.id); } }, '■ Stop');
    const focusBtn = h('button', { class: 'btn', onClick: () => Focus.open() }, '🎯 Focus');
    const breakIn = h('input', { type: 'number', min: 0, max: 240, value: s.break_every_min, 'aria-label': 'Break reminder every (min)', onChange: (e) => updateSettings({ break_every_min: clamp(+e.target.value || 0, 0, 240) }) });
    // one-click session lengths: log a block of 30 min / 1 h / 2 h ending now (or set the timer target if it is running)
    const presets = h('div', { class: 'row preset-row center' }, h('span', { class: 'muted small' }, r ? 'Stop at:' : 'Log now:'),
      ...DURATION_PRESETS.map(([mins, label]) => h('button', { class: 'btn sm' + (r && s.target_min === mins ? ' primary' : ''), title: r ? `Stop automatically after ${label} of net study` : `Log a ${label} block ending now`, onClick: () => this.preset(mins, label) }, label)),
      r && s.target_min ? h('button', { class: 'btn sm ghost', title: 'Remove the target', onClick: () => updateSettings({ target_min: null }) }, '✕') : null);
    const quick = r ? h('div', { class: 'quick-note' }, h('textarea', { rows: 2, placeholder: 'Quick note (Ctrl+Enter adds it to the block)', onKeydown: (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.addNote(e.target); } } }), h('button', { class: 'btn sm', onClick: (e) => this.addNote(e.currentTarget.previousElementSibling) }, 'Add')) : null;
    setKids(this.el,
      h('div', { class: 'card-head' }, h('h2', null, 'Study timer'), r ? h('button', { class: 'btn sm ghost', onClick: () => Panel.editSession(r.id) }, '✎ Block details') : h('button', { class: 'btn primary sm', id: 'btn-study-now', onClick: () => StudyNow.open() }, '+ Study now')),
      chips,
      h('div', { class: 'clock ' + st + (onBreak ? ' onbreak' : '') }, h('div', { class: 'clock-frozen num', id: 'clk-frozen' }), h('div', { class: 'clock-main num', id: 'clk-main', role: 'timer' }, '00:00'), h('div', { class: 'clock-sub', id: 'clk-sub' }, 'Pick a theme and start.')),
      h('div', { class: 'actions' }, focusBtn, startBtn, pauseBtn, plusBtn, stopBtn),
      presets,
      h('div', { class: 'row center small muted', style: { gap: '6px' } }, 'Study', h('span', { style: { width: '62px' } }, breakIn), 'min · break',
        h('select', { style: { width: 'auto' }, 'aria-label': 'Break length (min)', onChange: (e) => updateSettings({ break_len_min: +e.target.value }) }, ...[10, 15, 30].map((v) => h('option', { value: v, selected: v === (s.break_len_min || 15) }, v))), 'min'),
      quick);
    this.updateDigits();
  },
  /* With the timer running the preset becomes a target (auto-stop); idle, it logs a finished block ending now. */
  preset(mins, label) {
    const r = runningSession();
    if (r) { updateSettings({ target_min: state.settings.target_min === mins ? null : mins }); if (state.settings.target_min) toast(`Target set: ${label} of net study`); return; }
    const end = Math.round(nowMs() / MIN) * MIN; const start = end - mins * MIN;
    const fit = Calendar.fitMove(start, end); if (!fit.ok) { toast('Does not fit: it overlaps another block', { error: true }); return; }
    const data = { theme: state.settings.last_theme || themes()[0]?.id, started_at: iso(fit.start), ended_at: iso(fit.end), source: 'manual' };
    const errs = validateSession(data); if (errs.length) { toast(errs[0].message, { error: true }); return; }
    const s = createSession(data); toastUndo(`${label} block logged`); Calendar.reveal(s.id);
  },
  addNote(ta) { if (Timer.addQuickNote(ta.value)) { ta.value = ''; toast('Note added to the block'); } },
  updateDigits() {
    const main = $('#clk-main', this.el); if (!main) return; const r = runningSession();
    const sub = $('#clk-sub', this.el), fz = $('#clk-frozen', this.el);
    if (!r) { main.textContent = '00:00'; fz.textContent = ''; sub.textContent = 'Pick a theme and start.'; return; }
    const tm = sessionTimes(r); const p = openPause(r); const target = state.settings.target_min;
    const left = Timer.breakLeft();
    if (left) { main.textContent = fmtClock(left); fz.textContent = `☕ break · net ${fmtClock(tm.net)}`; sub.textContent = 'The timer comes back on its own when the break ends.'; }
    else if (p) { main.textContent = fmtClock(nowMs() - ms(p.start)); fz.textContent = `net ${fmtClock(tm.net)}`; sub.textContent = `Paused · ${themeName(r.theme)} · gross ${fmtClock(tm.gross)} · breaks ${fmtClock(tm.pauseMs)}`; }
    else {
      main.textContent = fmtClock(tm.net); fz.textContent = target ? `target ${fmtHM(target)}` : '';
      sub.textContent = `Studying ${themeName(r.theme)} since ${hm(tm.start)} · gross ${fmtClock(tm.gross)}${tm.pauseMs >= 1000 ? ` · breaks ${fmtClock(tm.pauseMs)}` : ''}`;
    }
  },
};

/* ---------- Today (full width, on top) ---------- */
const TodayCard = {
  el: null, mobile: null,
  mount(root) {
    this.el = h('section', { class: 'card today-card', id: 'card-today' }); root.append(this.el); this.render();
    on('change', () => this.render()); on('tick', () => this.updateNow());
    window.addEventListener('resize', () => { const m = window.innerWidth <= 760; if (m !== this.mobile) this.render(); });
  },
  render() {
    const tk = todayKey(); const info = netByDay(tk, tk).get(tk); const total = info?.net || 0; const count = info?.count || 0;
    this.mobile = window.innerWidth <= 760;
    const head = h('div', { class: 'card-head' },
      h('div', { class: 'row' }, h('h2', null, this.mobile ? this.greeting() : 'Today'), h('span', { class: 'muted small' }, fmtDayLong(tk))),
      h('div', { class: 'row' }, h('span', { class: 'today-total num' }, fmtHM(total / MIN)), h('span', { class: 'muted small' }, count ? `${count} block${count > 1 ? 's' : ''}` : 'no blocks yet'),
        ...(this.mobile ? [] : [...DURATION_PRESETS.map(([mins, label]) => h('button', { class: 'btn sm', title: `Add a ${label} block`, onClick: () => this.add(mins) }, '+ ' + label)),
          h('button', { class: 'btn sm', title: 'Mark a tournament day', onClick: () => Tournament.open(todayKey()) }, '🏁 Tournament')])));
    if (this.mobile) { setKids(this.el, head, h('button', { class: 'btn primary lg full', onClick: () => StudyNow.open() }, '▶ STUDY NOW'), this.agenda(tk), this.weekLine()); return; }
    const grid = Calendar.buildGrid([tk], true, { big: true });
    setKids(this.el, head, h('div', { class: 'tl-wrap' }, grid));
    Calendar.attachPointer(grid);
    this.updateNow();
  },
  greeting() { const hr = new Date(nowMs()).getHours(); return hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening'; },
  /* Mobile: a vertical agenda reads better than a 24 h timeline. */
  agenda(tk) {
    const list = state.sessions.filter((s) => isLive(s) && sliceSession(s).some((sl) => sl.day === tk)).sort((a, b) => a.started_at.localeCompare(b.started_at));
    const now = nowMs();
    return h('div', { class: 'agenda' },
      ...list.map((s) => { const tm = sessionTimes(s); const t = isTournament(s);
        return h('button', { class: 'ag-row' + (t ? ' tourn' : '') + (!s.ended_at ? ' live' : '') + (tm.start > now ? ' next' : ''), style: { '--c': t ? '#b98cf0' : themeColor(s.theme) },
          onClick: () => (t ? Tournament.edit(s.id) : Panel.editSession(s.id)) },
          h('span', { class: 'ag-time num' }, hm(tm.start)),
          h('span', { class: 'ag-bar' }),
          h('span', { class: 'grow' }, h('b', null, t ? `🏁 ${s.meta?.tournament_name || 'Tournament day'}` : themeName(s.theme)), s.note_md ? noteIcon() : null,
            h('div', { class: 'muted small' }, s.ended_at ? `${fmtRange(tm.start, tm.end)} · ${fmtHM(tm.net / MIN)}` : `since ${hm(tm.start)} · running`)));
      }),
      !list.length ? h('p', { class: 'muted italic small' }, 'Nothing scheduled today — hit Study now, or add a block below.') : null,
      h('div', { class: 'row preset-row' }, ...DURATION_PRESETS.map(([mins, label]) => h('button', { class: 'btn sm', onClick: () => this.add(mins) }, '+ ' + label)),
        h('button', { class: 'btn sm', onClick: () => Tournament.open(todayKey()) }, '🏁')));
  },
  weekLine() {
    const w = weekStats(weekStartKey()); const goal = (state.settings.weekly_goal_hours || 0) * 60;
    return h('a', { class: 'week-line', href: '#/week' }, h('span', null, 'This week'), h('b', { class: 'num' }, goal ? `${fmtHM(w.netMin)} / ${fmtHM(goal)}` : fmtHM(w.netMin)),
      goal ? h('div', { class: 'progress' }, h('i', { style: { width: Math.min(100, (w.netMin / goal) * 100) + '%' } })) : null);
  },
  add(mins) {
    const now = new Date(nowMs()); const start = dayMs(todayKey(), Math.floor((now.getHours() * 60 + now.getMinutes()) / 15) * 15);
    Calendar.createAt(start, mins);
  },
  updateNow() { if (!this.mobile) Calendar.paintNow(this.el); },
};

/* ---------- Missions ---------- */
const MissionsCard = {
  el: null,
  mount(root) { this.el = h('section', { class: 'card', id: 'card-missions' }); root.append(this.el); this.render(); on('change', () => this.render()); },
  render() {
    const list = activeMissions();
    setKids(this.el,
      h('div', { class: 'card-head' },
        h('div', null, h('h2', null, 'Missions'), h('p', { class: 'sub' }, 'Hour goal per theme inside a date window.')),
        h('button', { class: 'btn sm primary', onClick: () => this.openCreator() }, '+ New mission')),
      list.length ? h('div', { class: 'mission-grid' }, ...list.map((m) => this.card(m)))
        : h('p', { class: 'muted italic small' }, 'No missions yet — create one with the button above.'));
  },
  /* Creation happens in a dialog so the page stays clean. */
  openCreator() {
    const nameIn = h('input', { type: 'text', placeholder: 'e.g. Master calculation', maxlength: 80 });
    const themeSel = themeSelect(state.settings.last_theme);
    const goalSel = h('select', null, ...GOAL_OPTIONS.map((g) => h('option', { value: g }, `${g}h`)));
    const startIn = h('input', { type: 'date', value: todayKey() });
    const deadIn = h('input', { type: 'date', value: addDays(todayKey(), 90) });
    const hint = h('div', { class: 'hint-box' });
    const updHint = () => {
      const g = +goalSel.value;
      if (!startIn.value || !deadIn.value) { hint.textContent = 'Pick a start date and a deadline.'; return; }
      const span = daysBetween(startIn.value, deadIn.value); const left = daysBetween(todayKey(), deadIn.value);
      if (span <= 0) { hint.textContent = 'The deadline must be after the start date.'; return; }
      hint.textContent = `${span} days in the window${left !== span ? ` · ${left > 0 ? `${left} days left` : 'window already closed'}` : ''} — ${dec1(g / Math.max(1, left > 0 ? left : span))}h per day to finish`;
    };
    [goalSel, startIn, deadIn].forEach((el) => el.addEventListener('change', updHint)); updHint();
    const create = () => {
      if (!startIn.value || !deadIn.value || daysBetween(startIn.value, deadIn.value) <= 0) { toast('The deadline must be after the start date', { error: true }); return; }
      createMission({ name: nameIn.value, theme: themeSel.value, goal_hours: +goalSel.value, start_date: startIn.value, deadline: deadIn.value });
      m.close(); toast('Mission created');
    };
    nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') create(); });
    const m = openModal({
      title: 'New mission', cls: 'narrow',
      body: h('div', { class: 'stack' },
        h('label', { class: 'field' }, h('span', null, 'Name'), nameIn),
        h('div', { class: 'grid2' },
          h('label', { class: 'field' }, h('span', null, 'Theme'), themeSel),
          h('label', { class: 'field' }, h('span', null, 'Goal'), goalSel),
          h('label', { class: 'field' }, h('span', null, 'Start'), startIn),
          h('label', { class: 'field' }, h('span', null, 'Deadline'), deadIn)),
        hint),
      footer: frag(h('button', { class: 'btn', onClick: () => m.close() }, 'Cancel'), h('button', { class: 'btn primary', onClick: create }, 'Create')),
    });
    setTimeout(() => nameIn.focus(), 30);
  },
  card(m) {
    const st = missionStats(m); const pct = Math.round(st.progress * 100);
    const done = m.status === 'done' || st.complete;
    const line = done ? 'goal reached'
      : st.daysLeft != null && st.daysLeft > 0 ? `${st.daysLeft} days left · ${st.perDay != null ? `${dec1(st.perDay / 60)}h per day` : ''}`
      : st.overdue ? `deadline passed ${-st.daysLeft} days ago` : `${fmtHM(st.done)} of ${m.goal_hours}h`;
    return h('button', { class: 'mission-card' + (done ? ' done' : '') + (st.overdue && !done ? ' late' : ''), style: { '--c': themeColor(m.theme) }, title: 'Edit mission', onClick: () => Panel.mission(m.id) },
      h('div', { class: 'mc-head' }, h('span', { class: 'mc-medal' + (done ? '' : ' dim') }, medalIcon()), h('div', { class: 'grow' }, h('b', { class: 'mc-name' }, m.name), h('div', { class: 'muted small' }, themeName(m.theme))), h('b', { class: 'num mc-pct' }, `${pct}%`)),
      h('div', { class: 'progress' }, h('i', { style: { width: pct + '%' } })),
      h('div', { class: 'mc-foot muted small' }, h('span', null, `${fmtHM(st.done)} / ${m.goal_hours}h`), h('span', null, line)),
      h('div', { class: 'mc-dates faint small' }, m.start_date && m.deadline ? `${fmtDate(m.start_date)} → ${fmtDate(m.deadline)}` : m.deadline ? `due ${fmtDate(m.deadline)}` : ''));
  },
};
/* Achievement medal */
function medalIcon() {
  return h('span', { html: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M7 2h3l2.2 6.2L9 10 7 2Z" fill="currentColor" opacity=".75"/><path d="M17 2h-3l-2.2 6.2L15 10l2-8Z" fill="currentColor" opacity=".55"/><circle cx="12" cy="15.5" r="6.2" fill="currentColor"/><circle cx="12" cy="15.5" r="4.3" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="1.1"/><path d="m12 12.4 1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3 1-2.1Z" fill="rgba(0,0,0,.4)"/></svg>' });
}

/* ---------- Calendar (rows = days, columns = hours) ---------- */
const Calendar = {
  el: null, mode: 'week', anchor: null, selectedId: null, focusId: null,
  nDays() { return { week: 7, month: 30, quarter: 90 }[this.mode] || 7; },
  days() { const n = this.nDays(); const a = this.anchor || todayKey(); return Array.from({ length: n }, (_, i) => addDays(a, -(n - 1 - i))); },
  mount(root) {
    this.anchor = todayKey();
    this.el = h('section', { class: 'card cal-card', id: 'card-calendar' }); root.append(this.el); this.render();
    on('change', () => this.render()); on('tick', () => this.updateLive());
    on('select', ({ id }) => { this.selectedId = id; $$('.blk.selected', this.el).forEach((b) => b.classList.remove('selected')); $$(`.blk[data-id="${id}"]`, this.el).forEach((b) => b.classList.add('selected')); });
    on('drawer', ({ open }) => { if (!open) { this.selectedId = null; $$('.blk.selected', this.el).forEach((b) => b.classList.remove('selected')); } });
    setInterval(() => { if (this.anchor !== todayKey() && this.anchor === this._lastToday) { this.anchor = todayKey(); this.render(); } this._lastToday = todayKey(); }, 60000);
  },
  reveal(id) { const s = sessionById(id); if (!s) return; const k = dayKeyOf(ms(s.started_at)); const days = this.days(); if (k > days[days.length - 1] || k < days[0]) { this.anchor = k > todayKey() ? k : todayKey(); if (k < this.days()[0]) this.mode = daysBetween(k, todayKey()) < 30 ? 'month' : 'quarter'; } this.focusId = id; this.render(); },
  render() {
    const days = this.days(); const tk = todayKey();
    const seg = segmented([['week', 'Week'], ['month', 'Month'], ['quarter', 'Quarter']], this.mode, (v) => { this.mode = v; this.render(); }, 'sm');
    const n = this.nDays();
    const nav = h('div', { class: 'row' }, h('button', { class: 'btn icon sm', 'aria-label': 'Previous period', onClick: () => { this.anchor = addDays(this.anchor, -n); this.render(); } }, '‹'), h('button', { class: 'btn sm', onClick: () => { this.anchor = tk; this.render(); } }, 'Today'), h('button', { class: 'btn icon sm', 'aria-label': 'Next period', onClick: () => { this.anchor = addDays(this.anchor, n); this.render(); } }, '›'));
    const grid = this.buildGrid(days, true);
    const legend = h('div', { class: 'legend' }, ...themes().map((th) => h('span', null, h('i', { style: { background: th.color } }), th.name)));
    setKids(this.el,
      h('div', { class: 'card-head' }, h('div', null, h('h2', null, 'Study calendar'), h('p', { class: 'sub' }, 'Rows = days, columns = hours. Click a block to edit it in the side panel · drag to move · pull the edges to resize · Alt+drag duplicates · click an empty slot to create.')), h('div', { class: 'row' }, seg, nav)),
      h('div', { class: 'tl-wrap' + (this.mode === 'week' ? '' : ' scroll') }, grid), legend);
    this.attachPointer(grid);
    if (this.focusId) { const b = $(`.blk[data-id="${this.focusId}"]`, grid); if (b) b.focus(); this.focusId = null; }
  },
  /* rows = days, 24 hour cells per row, blocks positioned by time; used by the calendar and the report */
  buildGrid(days, interactive, { big = false } = {}) {
    const tk = todayKey(); const totals = netByDay(days[0], days[days.length - 1]); const now = nowMs();
    const head = h('div', { class: 'tl-row tl-head' }, h('div', { class: 'tl-label' }), h('div', { class: 'tl-hours' }, ...Array.from({ length: 12 }, (_, i) => h('span', null, i * 2))), h('div', { class: 'tl-total' }, 'Total'));
    const rows = days.map((k) => {
      const tot = totals.get(k)?.net || 0;
      const label = interactive ? h('button', { class: 'tl-label', title: 'See the blocks of this day', onClick: () => Panel.day(k) }, fmtDayShort(k)) : h('div', { class: 'tl-label' }, fmtDayShort(k));
      const track = h('div', { class: 'tl-track', dataset: { date: k } }, ...Array.from({ length: 24 }, (_, hr) => h('i', { class: 'cell' + (isNightMinute(hr * 60 + 30) ? ' night' : ''), title: isNightMinute(hr * 60 + 30) ? 'Sleep hours (frozen)' : null })));
      if (k === tk) track.append(h('div', { class: 'now-line' }, h('span', { class: 'now-lbl num' })));
      return h('div', { class: 'tl-row' + (k === tk ? ' today' : '') + (isMonday(k) ? ' week-start' : '') + (k > tk ? ' future' : ''), dataset: { date: k } },
        label, track, h('div', { class: 'tl-total num' }, tot ? fmtHM(tot / MIN) : ''));
    });
    const tracks = {}; rows.forEach((r) => { tracks[r.dataset.date] = $('.tl-track', r); });
    const rangeStart = dayMs(days[0], 0), rangeEnd = dayMs(addDays(days[days.length - 1], 1), 0);
    for (const s of state.sessions) {
      if (!isLive(s)) continue;
      const st = ms(s.started_at), en = s.ended_at ? ms(s.ended_at) : Math.max(now, st + 60000);
      if (en <= rangeStart || st >= rangeEnd) continue;
      for (const sg of this.segments(st, en)) { const tr = tracks[sg.day]; if (tr) tr.append(this.blockEl(s, sg, interactive)); }
    }
    return h('div', { class: 'tl' + (interactive ? '' : ' static') + (big ? ' big' : ''), role: 'grid' }, head, ...rows);
  },
  segments(st, en) { const out = []; let cur = st, guard = 0; while (cur < en && guard++ < 40) { const day = dayKeyOf(cur); const dayEnd = dayMs(addDays(day, 1), 0); const segEnd = Math.min(en, dayEnd); const a = (cur - dayMs(day, 0)) / DAY, b = (segEnd - dayMs(day, 0)) / DAY; out.push({ day, left: a * 100, width: Math.max(0.35, (b - a) * 100), start: cur, end: segEnd }); cur = segEnd; } return out; },
  blockEl(s, sg, interactive = true) {
    const tm = sessionTimes(s); const live = !s.ended_at; const color = isTournament(s) ? '#b98cf0' : themeColor(s.theme);
    if (isTournament(s)) {
      const name = s.meta?.tournament_name || 'Tournament day';
      const t = `🏁 ${name} · ${fmtRange(tm.start, tm.end)} (planning locked)`;
      return h('div', { class: 'blk tourn', role: 'gridcell', tabindex: interactive ? '0' : null, title: t, 'aria-label': t, dataset: { id: s.id, day: sg.day },
        style: { left: sg.left + '%', width: sg.width + '%', '--c': color, color: contrastInk(color) },
        onKeydown: interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); Tournament.edit(s.id); } } : null },
        h('span', { class: 't' }, '🏁 ', name), h('span', { class: 'when' }, fmtRange(tm.start, tm.end)), h('span', { class: 'lock' }, '🔒'));
    }
    const title = `${themeName(s.theme)} · ${live ? `${hm(tm.start)} – running` : fmtRange(tm.start, tm.end)} · ${fmtHM(tm.net / MIN)}${s.note_md ? '\n' + mdExcerpt(s.note_md, 140) : ''}`;
    return h('div', { class: 'blk' + (live ? ' live' : '') + (tm.start > nowMs() ? ' planned' : '') + (interactive && s.id === this.selectedId ? ' selected' : ''), role: 'gridcell', tabindex: interactive ? '0' : null, title, 'aria-label': title.replace('\n', '. '), dataset: { id: s.id, day: sg.day }, style: { left: sg.left + '%', width: sg.width + '%', '--c': color, color: contrastInk(color) }, onKeydown: interactive ? (e) => this.onKey(e, s) : null },
      h('span', { class: 't' }, themeName(s.theme)),
      h('span', { class: 'when' }, live ? `${hm(tm.start)} – now` : `${fmtRange(tm.start, tm.end)} · ${fmtHM(tm.net / MIN)}`),
      s.note_md ? noteIcon() : null);
  },
  /* white bar marking the current time inside today's row */
  paintNow(root) {
    const pct = (minuteOfDay(nowMs()) / 1440) * 100;
    $$('.now-line', root || document).forEach((el) => { el.style.left = pct + '%'; const l = $('.now-lbl', el); if (l) l.textContent = hm(nowMs()); });
  },
  updateLive() { this.paintNow(this.el); const r = runningSession(); if (!r) return; const b = $(`.blk.live[data-id="${r.id}"]`, this.el); if (!b) return; const day = b.dataset.day; const st = Math.max(ms(r.started_at), dayMs(day, 0)); const en = Math.min(nowMs(), dayMs(addDays(day, 1), 0)); b.style.width = Math.max(0.35, ((en - st) / DAY) * 100) + '%'; },
  onKey(e, s) {
    const snap = Math.max(5, state.settings.snap_min || 15) * MIN;
    const tm = sessionTimes(s); let start = tm.start, end = tm.end;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); Panel.editSession(s.id); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSession(s.id); Drawer.close(); toastUndo('Block deleted'); return; }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { const d = e.key === 'ArrowLeft' ? -snap : snap; if (e.shiftKey) { if (s.ended_at) end = Math.max(start + snap, end + d); else return; } else { start += d; end += d; } }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { const d = e.key === 'ArrowUp' ? -DAY : DAY; start += d; end += d; }
    else return;
    e.preventDefault();
    const patch = { started_at: iso(start) }; if (s.ended_at) patch.ended_at = iso(end);
    const shift = start - tm.start; patch.pauses = (s.pauses || []).map((p) => ({ start: iso(ms(p.start) + (e.shiftKey ? 0 : shift)), end: p.end ? iso(ms(p.end) + (e.shiftKey ? 0 : shift)) : null }));
    const errs = validateSession({ ...s, ...patch }, s.id); if (errs.length) { toast(errs[0].message, { error: true }); return; }
    this.focusId = s.id; updateSession(s.id, patch); toastUndo('Block adjusted');
  },
  planningGuard(startMs, endMs, onConfirm) {
    const t = tournamentAt(startMs, endMs);
    if (!t) { onConfirm(); return; }
    confirmDialog(`${t.meta?.tournament_name || 'Tournament day'} is blocked for planning (${fmtRange(ms(t.started_at), ms(t.ended_at))}). Study sessions started with “Study now” are always allowed.`,
      { title: 'Tournament day', okLabel: 'Schedule anyway' }).then((ok) => { if (ok) onConfirm(); });
  },
  createAt(startMs, lenMin) {
    if (tournamentAt(startMs, startMs + lenMin * MIN)) { this.planningGuard(startMs, startMs + lenMin * MIN, () => this.forceCreate(startMs, lenMin)); return null; }
    if (nightBlocks(startMs, startMs + lenMin * MIN)) { toast('Those are your sleep hours — unfreeze them in Settings if you want to study then', { error: true }); return null; }
    const fit = this.fitMove(startMs, startMs + lenMin * MIN); if (!fit.ok) { toast('Does not fit: another block is in the way', { error: true }); return null; }
    const data = { theme: state.settings.last_theme || themes()[0]?.id, started_at: iso(fit.start), ended_at: iso(fit.end), source: 'manual' };
    const errs = validateSession(data); if (errs.length) { toast(errs[0].message, { error: true }); return null; }
    const s = createSession(data); this.focusId = s.id; this.selectedId = s.id; Panel.editSession(s.id); toastUndo('Block created'); return s;
  },
  forceCreate(startMs, lenMin) {
    const fit = this.fitMove(startMs, startMs + lenMin * MIN); if (!fit.ok) { toast('Does not fit: another block is in the way', { error: true }); return null; }
    const data = { theme: state.settings.last_theme || themes()[0]?.id, started_at: iso(fit.start), ended_at: iso(fit.end), source: 'manual' };
    const errs = validateSession(data); if (errs.length) { toast(errs[0].message, { error: true }); return null; }
    const s = createSession(data); this.focusId = s.id; Panel.editSession(s.id); toastUndo('Block created'); return s;
  },
  fitMove(start, end, excludeId) {
    const c = findOverlap(start, end, excludeId); if (!c) return { start, end, ok: true };
    const dur = end - start, cS = ms(c.started_at), cE = c.ended_at ? ms(c.ended_at) : nowMs();
    const cands = [[cE, cE + dur], [cS - dur, cS]].sort((a, b) => Math.abs(a[0] - start) - Math.abs(b[0] - start));
    for (const [s2, e2] of cands) if (!findOverlap(s2, e2, excludeId)) return { start: s2, end: e2, ok: true, clamped: true };
    return { start, end, ok: false };
  },
  fitEnd(start, end, excludeId) { const snap = Math.max(5, state.settings.snap_min || 15) * MIN; const c = findOverlap(start, end, excludeId); if (!c) return { start, end, ok: true }; const cS = ms(c.started_at); if (cS - start >= snap) return { start, end: cS, ok: true, clamped: true }; return { start, end, ok: false }; },
  fitStart(start, end, excludeId) { const snap = Math.max(5, state.settings.snap_min || 15) * MIN; const c = findOverlap(start, end, excludeId); if (!c) return { start, end, ok: true }; const cE = c.ended_at ? ms(c.ended_at) : nowMs(); if (end - cE >= snap) return { start: cE, end, ok: true, clamped: true }; return { start, end, ok: false }; },

  attachPointer(grid) {
    const snapMin = () => Math.max(5, state.settings.snap_min || 15);
    const snapM = (m) => Math.round(m / snapMin()) * snapMin();
    const trackAt = (x, y) => { const rows = $$('.tl-row:not(.tl-head)', grid); let best = null, bd = Infinity; for (const r of rows) { const rc = r.getBoundingClientRect(); const d = y < rc.top ? rc.top - y : y > rc.bottom ? y - rc.bottom : 0; if (d < bd) { bd = d; best = r; } } return best ? $('.tl-track', best) : null; };
    const minuteAt = (track, x) => { const rc = track.getBoundingClientRect(); return clamp(((x - rc.left) / rc.width) * 1440, 0, 1440); };
    let drag = null;
    const clearGhost = () => { if (drag?.ghosts) { drag.ghosts.forEach((g) => g.remove()); drag.ghosts = []; } };
    const paintGhost = (start, end, bad, s) => {
      clearGhost(); const color = s ? themeColor(s.theme) : themeColor(state.settings.last_theme);
      drag.ghosts = this.segments(start, end).map((sg) => { const tr = $(`.tl-track[data-date="${sg.day}"]`, grid); if (!tr) return null; const g = h('div', { class: 'blk ghost' + (bad ? ' bad' : ''), style: { left: sg.left + '%', width: sg.width + '%', '--c': color, color: contrastInk(color) } }, h('span', { class: 't' }, `${fmtRange(start, end)} · ${fmtHM((end - start) / MIN)}`)); tr.append(g); return g; }).filter(Boolean);
    };
    const compute = (x, y) => {
      const tr = trackAt(x, y); if (!tr) return null; const mins = minuteAt(tr, x); const s = drag.session;
      if (drag.kind === 'create') {
        const a = dayMs(drag.day, drag.anchorMin); const b = dayMs(tr.dataset.date, snapM(mins));
        let start = Math.min(a, b), end = Math.max(a, b); if (end - start < snapMin() * MIN) end = start + snapMin() * MIN;
        return b >= a ? this.fitEnd(start, end) : this.fitStart(start, end);
      }
      const deltaMin = snapM(mins - drag.startMin); const dayDelta = daysBetween(drag.day, tr.dataset.date);
      if (drag.kind === 'move' || drag.kind === 'dup') {
        const o = drag.orig; const origDay = dayKeyOf(o.start); const origMin = (o.start - dayMs(origDay, 0)) / MIN;
        const start = dayMs(addDays(origDay, dayDelta), origMin + deltaMin); return this.fitMove(start, start + (o.end - o.start), drag.kind === 'move' ? s.id : null);
      }
      const total = deltaMin + dayDelta * 1440;
      if (drag.kind === 'resize-end') { const base = dayMs(dayKeyOf(drag.orig.end), 0); const end = Math.max(drag.orig.start + snapMin() * MIN, base + snapM((drag.orig.end - base) / MIN + total) * MIN); return this.fitEnd(drag.orig.start, end, s.id); }
      if (drag.kind === 'resize-start') { const base = dayMs(dayKeyOf(drag.orig.start), 0); const start = Math.min(drag.orig.end - snapMin() * MIN, base + snapM((drag.orig.start - base) / MIN + total) * MIN); return this.fitStart(start, drag.orig.end, s.id); }
      return null;
    };
    const finish = (commitIt, x, y) => {
      if (!drag) return; clearTimeout(drag.tmr);
      const d = drag; const res = commitIt && d.moved ? compute(x, y) : null;
      drag = null; document.body.classList.remove('dragging'); clearGhost();
      const blocks = d.session ? $$(`.blk[data-id="${d.session.id}"]`, grid) : []; blocks.forEach((b) => b.classList.remove('dim'));
      if (!commitIt || !d.moved || !res) return;
      const reject = () => { blocks.forEach((b) => { b.classList.add('reject'); setTimeout(() => b.classList.remove('reject'), 300); }); toast('Does not fit: it runs into another block', { error: true }); };
      if (!res.ok) { reject(); return; }
      if (d.kind === 'create') { if (tournamentAt(res.start, res.end)) { this.planningGuard(res.start, res.end, () => this.forceCreate(res.start, (res.end - res.start) / MIN)); return; } if (nightBlocks(res.start, res.end)) { toast('Those are your sleep hours — unfreeze them in Settings if you want to study then', { error: true }); return; } const data = { theme: state.settings.last_theme || themes()[0]?.id, started_at: iso(res.start), ended_at: iso(res.end), source: 'manual' }; const errs = validateSession(data); if (errs.length) { toast(errs[0].message, { error: true }); return; } const s = createSession(data); this.selectedId = s.id; this.focusId = s.id; toastUndo('Block created'); setTimeout(() => Panel.editSession(s.id), 30); return; }
      if (d.kind === 'dup') { const src = d.session; const shift = res.start - d.orig.start; const pauses = (src.pauses || []).map((p) => ({ start: iso(ms(p.start) + shift), end: p.end ? iso(ms(p.end) + shift) : null })); const data = { theme: src.theme, started_at: iso(res.start), ended_at: iso(res.end), pauses, source: 'manual', note_md: src.note_md }; const errs = validateSession(data); if (errs.length) { toast(errs[0].message, { error: true }); return; } const s = createSession(data); this.focusId = s.id; toastUndo('Block duplicated'); return; }
      const s = d.session; const shift = res.start - d.orig.start; const patch = { started_at: iso(res.start) };
      if (s.ended_at) patch.ended_at = iso(res.end);
      if (d.kind === 'move') patch.pauses = (s.pauses || []).map((p) => ({ start: iso(ms(p.start) + shift), end: p.end ? iso(ms(p.end) + shift) : null }));
      else patch.pauses = (s.pauses || []).map((p) => ({ start: iso(clamp(ms(p.start), res.start, res.end)), end: p.end ? iso(clamp(ms(p.end), res.start, res.end)) : null })).filter((p) => !p.end || ms(p.end) > ms(p.start));
      const errs = validateSession({ ...s, ...patch }, s.id); if (errs.length) { reject(); return; }
      this.focusId = s.id; this.selectedId = s.id; updateSession(s.id, patch); toastUndo(d.kind === 'move' ? 'Block moved' : 'Block adjusted');
    };
    grid.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const blk = e.target.closest('.blk'); const tr = e.target.closest('.tl-track'); if (!tr) return;
      const touch = e.pointerType === 'touch';
      if (blk) {
        const s = sessionById(blk.dataset.id); if (!s) return;
        const rc = blk.getBoundingClientRect(); const tm = sessionTimes(s); const edge = Math.min(8, rc.width / 3);
        let kind = 'move';
        if (s.ended_at && e.clientX >= rc.right - edge) kind = 'resize-end'; else if (e.clientX <= rc.left + edge) kind = 'resize-start'; else if (e.altKey && s.ended_at) kind = 'dup';
        if (!s.ended_at && kind === 'move') kind = 'resize-start'; // running block: only the start edge moves
        drag = { kind, session: s, orig: { start: tm.start, end: tm.end }, day: tr.dataset.date, startMin: minuteAt(tr, e.clientX), x: e.clientX, y: e.clientY, moved: false, ready: !touch, ghosts: [], pointerId: e.pointerId };
        if (touch) drag.tmr = setTimeout(() => { if (drag) { drag.ready = true; blk.classList.add('dim'); if (navigator.vibrate) navigator.vibrate(10); } }, 350);
      } else {
        drag = { kind: 'create', day: tr.dataset.date, anchorMin: snapM(minuteAt(tr, e.clientX)), x: e.clientX, y: e.clientY, moved: false, ready: !touch, ghosts: [], pointerId: e.pointerId };
      }
      try { grid.setPointerCapture(e.pointerId); } catch { /* */ }
    });
    grid.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.pointerId) return;
      const dist = Math.hypot(e.clientX - drag.x, e.clientY - drag.y);
      if (!drag.ready) { if (dist > 8) { clearTimeout(drag.tmr); drag = null; } return; }
      if (!drag.moved) { if (dist < 4) return; drag.moved = true; document.body.classList.add('dragging'); if (drag.session && drag.kind !== 'dup') $$(`.blk[data-id="${drag.session.id}"]`, grid).forEach((b) => b.classList.add('dim')); }
      const res = compute(e.clientX, e.clientY); if (res) paintGhost(res.start, res.end, !res.ok, drag.session);
    });
    grid.addEventListener('pointerup', (e) => {
      if (!drag || e.pointerId !== drag.pointerId) return; const d = drag;
      if (!d.moved) {
        finish(false);
        if (d.session) { if (isTournament(d.session)) Tournament.edit(d.session.id); else Panel.editSession(d.session.id); }
        else if (d.kind === 'create') this.createAt(dayMs(d.day, d.anchorMin), state.settings.default_len_min);
        return;
      }
      finish(true, e.clientX, e.clientY);
    });
    grid.addEventListener('pointercancel', () => finish(false));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drag) finish(false); });
  },
};

/* ---------- Reports (compact) ---------- */
const ReportsCard = {
  el: null, period: 'week',
  mount(root) { this.el = h('section', { class: 'card reports-card', id: 'card-reports' }); root.append(this.el); this.render(); on('change', () => this.render()); },
  render() {
    const [from, to] = this.period === 'all' ? [null, null] : periodRange(this.period);
    const r = sumRange(from, to); const sk = streakInfo();
    const byTheme = themes().map((th) => ({ th, min: r.byTheme.get(th.id) || 0 })); const other = r.byTheme.get('__none') || 0;
    const max = Math.max(1, ...byTheme.map((x) => x.min), other);
    const top = byTheme.slice().sort((a, b) => b.min - a.min)[0];
    const seg = segmented([['week', 'Week'], ['month', 'Month'], ['all', 'Total']], this.period, (v) => { this.period = v; this.render(); }, 'sm');
    setKids(this.el,
      h('div', { class: 'card-head' }, h('h2', null, 'Reports'), h('div', { class: 'row' }, seg, h('a', { class: 'btn sm', href: '#/week' }, '📈 Weekly review'), h('a', { class: 'btn sm', href: '#/report' }, '📄 Full report'))),
      h('div', { class: 'stats' },
        h('div', null, h('b', null, fmtHM(r.netMin)), h('span', null, 'Time')),
        h('div', null, h('b', null, `${sk.current} ${sk.current === 1 ? 'day' : 'days'}`), h('span', null, 'Streak')),
        h('div', null, h('b', { style: { color: top && top.min > 0 ? top.th.color : '' } }, top && top.min > 0 ? top.th.name : '—'), h('span', null, 'Top theme'))),
      h('div', { class: 'bars' }, ...byTheme.map(({ th, min }) => h('div', { class: 'bar-row' }, h('span', { class: 'lbl' }, th.name), h('div', { class: 'bar' }, h('i', { class: 'dotc', style: { background: th.color } }), h('i', { class: 'fill', style: { width: (min / max) * 100 + '%', background: th.color } })), h('span', { class: 'val num' }, min ? fmtHM(min) : ''))),
        other ? h('div', { class: 'bar-row' }, h('span', { class: 'lbl muted' }, 'No theme'), h('div', { class: 'bar' }, h('i', { class: 'dotc', style: { background: '#8a9bb3' } }), h('i', { class: 'fill', style: { width: (other / max) * 100 + '%', background: '#8a9bb3' } })), h('span', { class: 'val num' }, fmtHM(other))) : null));
  },
};
