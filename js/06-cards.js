/* ===== Main page cards ===== */

/* ---------- Cronômetro ---------- */
const TimerCard = {
  el: null, offs: [],
  mount(root) {
    this.el = h('section', { class: 'card timer-card', id: 'card-timer' }); root.append(this.el);
    this.render(); this.offs.push(on('change', () => this.render()), on('tick', () => this.updateDigits()));
  },
  render() {
    const r = runningSession(); const st = Timer.status(); const s = state.settings;
    const theme = r ? r.theme : s.last_theme;
    const chips = themeChips(theme, (v) => { if (r) Timer.setTheme(v); else updateSettings({ last_theme: v }); }, { allowNone: false });
    const startBtn = h('button', { class: 'btn primary lg', id: 'btn-start', disabled: st === 'running', onClick: () => { try { if (st === 'paused') Timer.resume(); else Timer.start(theme); } catch (e) { toast(e.message, { error: true }); } } }, st === 'paused' ? '▶ Retomar' : '▶ Iniciar');
    const pauseBtn = h('button', { class: 'btn lg', disabled: st !== 'running', onClick: () => Timer.pause() }, '❚❚ Pausar');
    const plusBtn = h('button', { class: 'btn lg', disabled: !r, title: 'O bloco começou antes de você apertar Iniciar? Adiciona 10 minutos no início.', onClick: () => { if (Timer.addMinutes(10)) toast('+10 min adicionados ao início'); else toast('Não dá para recuar o início: há outro bloco logo antes.', { error: true }); } }, '+10 min');
    const stopBtn = h('button', { class: 'btn lg', disabled: !r, onClick: () => { const x = Timer.stop(); if (x) Panel.closeSession(x.id); } }, '■ Encerrar');
    const focusBtn = h('button', { class: 'btn lg', onClick: () => Focus.open() }, '🎯 Modo foco');
    const breakIn = h('input', { type: 'number', min: 0, max: 240, value: s.break_every_min, 'aria-label': 'Avisar pausa a cada (min)', onChange: (e) => updateSettings({ break_every_min: clamp(+e.target.value || 0, 0, 240) }) });
    const quick = r ? h('div', { class: 'quick-note' }, h('textarea', { rows: 2, placeholder: 'Nota rápida (Ctrl+Enter adiciona ao comentário do bloco)', onKeydown: (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.addNote(e.target); } } }), h('button', { class: 'btn sm', onClick: (e) => this.addNote(e.currentTarget.previousElementSibling) }, 'Adicionar nota')) : null;
    setKids(this.el,
      h('div', { class: 'card-head' }, h('h2', null, 'Cronômetro de estudo'), r ? h('button', { class: 'btn sm ghost', onClick: () => Panel.editSession(r.id) }, '✎ Detalhes do bloco') : null),
      chips,
      h('div', { class: 'clock ' + st }, h('div', { class: 'clock-frozen num', id: 'clk-frozen' }), h('div', { class: 'clock-main num', id: 'clk-main', role: 'timer' }, '00:00'), h('div', { class: 'clock-sub', id: 'clk-sub' }, 'Escolha o tema e inicie.')),
      h('div', { class: 'actions' }, focusBtn, startBtn, pauseBtn, plusBtn, stopBtn),
      h('div', { class: 'row center small muted', style: { gap: '8px' } }, 'Avisar pausa a cada (min)', h('span', { style: { width: '70px' } }, breakIn)),
      quick);
    this.updateDigits();
  },
  addNote(ta) { if (Timer.addQuickNote(ta.value)) { ta.value = ''; toast('Nota adicionada ao bloco'); } },
  updateDigits() {
    const main = $('#clk-main', this.el); if (!main) return; const r = runningSession();
    const sub = $('#clk-sub', this.el), fz = $('#clk-frozen', this.el);
    if (!r) { main.textContent = '00:00'; fz.textContent = ''; sub.textContent = 'Escolha o tema e inicie.'; return; }
    const tm = sessionTimes(r); const p = openPause(r);
    if (p) { main.textContent = fmtClock(nowMs() - ms(p.start)); fz.textContent = `líquido ${fmtClock(tm.net)}`; sub.textContent = `Pausado · ${themeName(r.theme)} · bruto ${fmtClock(tm.gross)} · pausas ${fmtClock(tm.pauseMs)}`; }
    else { main.textContent = fmtClock(tm.net); fz.textContent = ''; sub.textContent = `Estudando ${themeName(r.theme)} desde ${hm(tm.start)} · bruto ${fmtClock(tm.gross)}${tm.pauseMs >= 1000 ? ` · pausas ${fmtClock(tm.pauseMs)}` : ''}`; }
  },
};

/* ---------- Lançar horas manualmente ---------- */
const ManualCard = {
  mount(root) {
    const now = new Date(nowMs());
    const themeSel = themeSelect(state.settings.last_theme);
    const dateIn = h('input', { type: 'date', value: ymd(now) });
    const timeIn = h('input', { type: 'time', value: `${pad2(now.getHours())}:00` });
    const hIn = h('input', { type: 'number', min: 0, max: 16, value: 1, 'aria-label': 'Horas' }), mIn = h('input', { type: 'number', min: 0, max: 59, step: 5, value: 0, 'aria-label': 'Minutos' });
    const noteIn = h('input', { type: 'text', class: 'grow', placeholder: 'Ex.: cálculo de finais de torre — treinei variantes longas', maxlength: 2000 });
    const err = h('div', { class: 'errors', hidden: true });
    const submit = () => {
      const [y, mo, d] = dateIn.value.split('-').map(Number); const [hh, mm] = timeIn.value.split(':').map(Number);
      const start = new Date(y, mo - 1, d, hh, mm).getTime(); const dur = (+hIn.value || 0) * 60 + (+mIn.value || 0);
      if (!dur) { err.hidden = false; err.textContent = 'Informe a duração.'; return; }
      const data = { theme: themeSel.value, started_at: iso(start), ended_at: iso(start + dur * MIN), source: 'manual', note_md: noteIn.value.trim() };
      const errs = validateSession(data);
      if (errs.length) { err.hidden = false; setKids(err, ...errs.map((e) => h('div', null, e.message, ' ', e.conflict ? h('a', { href: '#', onClick: (ev) => { ev.preventDefault(); Panel.editSession(e.conflict.id); } }, 'Ver bloco') : null))); return; }
      err.hidden = true; const s = createSession(data); noteIn.value = ''; toastUndo(`Bloco de ${fmtHM(dur)} registrado`); Calendar.reveal(s.id);
    };
    noteIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    root.append(h('section', { class: 'card', id: 'card-manual' },
      h('div', { class: 'card-head' }, h('div', null, h('h2', null, 'Lançar horas manualmente'), h('p', { class: 'sub' }, 'Estudou fora do app? Registre aqui. Depois é só arrastar o bloco no calendário se precisar ajustar.'))),
      h('div', { class: 'manual-row' }, themeSel, dateIn, timeIn, h('span', { class: 'row nowrap' }, hIn, h('span', { class: 'muted small' }, 'h'), mIn, h('span', { class: 'muted small' }, 'min')), noteIn),
      err, h('div', { class: 'row' }, h('button', { class: 'btn primary', onClick: submit }, 'Registrar'))));
    on('settings', () => { const v = themeSel.value; setKids(themeSel, ...themes().map((th) => h('option', { value: th.id, selected: th.id === v }, th.name))); });
  },
};

/* ---------- Missões ---------- */
const MissionsCard = {
  el: null,
  mount(root) { this.el = h('section', { class: 'card', id: 'card-missions' }); root.append(this.el); this.render(); on('change', () => this.render()); },
  render() {
    const list = activeMissions();
    const nameIn = h('input', { type: 'text', class: 'grow', placeholder: 'Nome (ex.: Cálculo)', maxlength: 80 });
    const themeSel = themeSelect(state.settings.last_theme); const goalSel = h('select', null, ...GOAL_OPTIONS.map((g) => h('option', { value: g }, `${g}h`)));
    const deadIn = h('input', { type: 'date', value: addDays(todayKey(), 90) });
    const hint = h('div', { class: 'hint-box' });
    const updHint = () => { const d = deadIn.value ? daysBetween(todayKey(), deadIn.value) : null; const g = +goalSel.value; hint.textContent = d == null ? 'Escolha um prazo.' : d <= 0 ? 'O prazo precisa estar no futuro.' : `Faltam ${d} dias — média de ${(g / d).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h por dia`; };
    goalSel.addEventListener('change', updHint); deadIn.addEventListener('change', updHint); updHint();
    const create = () => { if (!deadIn.value || daysBetween(todayKey(), deadIn.value) <= 0) { toast('Escolha um prazo no futuro', { error: true }); return; } createMission({ name: nameIn.value, theme: themeSel.value, goal_hours: +goalSel.value, deadline: deadIn.value }); nameIn.value = ''; toast('Missão criada'); };
    nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') create(); });
    setKids(this.el,
      h('div', { class: 'card-head' }, h('div', null, h('h2', null, 'Missões'), h('p', { class: 'sub' }, 'Meta de horas por tema com prazo. Escolha de 50 em 50 horas.'))),
      list.length ? h('div', { class: 'mission-list' }, ...list.map((m) => this.row(m))) : h('p', { class: 'muted italic' }, 'Nenhuma missão ainda — crie uma abaixo.'),
      h('div', { class: 'manual-row' }, nameIn, themeSel, goalSel, deadIn, h('button', { class: 'btn primary', onClick: create }, 'Criar missão')),
      hint);
  },
  row(m) {
    const st = missionStats(m); const pct = Math.round(st.progress * 100);
    const status = m.status === 'done' || st.complete ? h('span', { class: 'tag ok' }, '✓ concluída') : st.overdue ? h('span', { class: 'tag bad' }, `prazo vencido há ${-st.daysLeft} d`) : null;
    const meta = m.status === 'done' || st.complete ? `${fmtHM(st.done)} de ${m.goal_hours}h` : st.daysLeft != null ? `${fmtHM(st.done)} de ${m.goal_hours}h · faltam ${st.daysLeft} dias${st.perDay != null ? ` — média de ${(st.perDay / 60).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h por dia` : ''}` : `${fmtHM(st.done)} de ${m.goal_hours}h`;
    return h('button', { class: 'mission-row', style: { '--c': themeColor(m.theme) }, onClick: () => Panel.mission(m.id) },
      h('div', { class: 'row between' }, h('span', { class: 'row' }, themeDot(m.theme), h('b', null, m.name), h('span', { class: 'muted small' }, themeName(m.theme)), status), h('b', { class: 'num' }, `${pct}%`)),
      h('div', { class: 'progress' }, h('i', { style: { width: pct + '%' } })),
      h('div', { class: 'muted small' }, meta, m.deadline ? ` · prazo ${fmtDateBr(m.deadline)}` : ''));
  },
};

/* ---------- Calendário (linhas = dias, colunas = horas) ---------- */
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
  reveal(id) { const s = sessionById(id); if (!s) return; const k = dayKeyOf(ms(s.started_at)); const days = this.days(); if (k > days[days.length - 1] || k < days[0]) { this.anchor = k > todayKey() ? k : todayKey(); if (k < this.days()[0]) this.mode = daysBetween(k, todayKey()) < 30 ? 'month' : 'quarter'; } this.focusId = id; this.render(); this.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); },
  render() {
    const days = this.days(); const tk = todayKey(); const totals = netByDay(days[0], days[days.length - 1]); const now = nowMs();
    const seg = segmented([['week', 'Semana'], ['month', 'Mês'], ['quarter', 'Trimestre']], this.mode, (v) => { this.mode = v; this.render(); });
    const n = this.nDays();
    const nav = h('div', { class: 'row' }, h('button', { class: 'btn icon sm', 'aria-label': 'Período anterior', onClick: () => { this.anchor = addDays(this.anchor, -n); this.render(); } }, '‹'), h('button', { class: 'btn sm', onClick: () => { this.anchor = tk; this.render(); } }, 'Hoje'), h('button', { class: 'btn icon sm', 'aria-label': 'Próximo período', onClick: () => { this.anchor = addDays(this.anchor, n); this.render(); } }, '›'));
    const grid = this.buildGrid(days, true);
    const legend = h('div', { class: 'legend' }, ...themes().map((th) => h('span', null, h('i', { style: { background: th.color } }), th.name)));
    setKids(this.el,
      h('div', { class: 'card-head' }, h('div', null, h('h2', null, 'Calendário de estudo'), h('p', { class: 'sub' }, 'Linhas = dias, colunas = horas. Clique num bloco para editar no painel, arraste para mover, puxe as bordas para ajustar, Alt+arrastar duplica. Clique num espaço vazio para criar. Clique no dia para ver os blocos.')), h('div', { class: 'row' }, seg, nav)),
      h('div', { class: 'tl-wrap' }, grid), legend);
    this.attachPointer(grid);
    if (this.focusId) { const b = $(`.blk[data-id="${this.focusId}"]`, grid); if (b) b.focus(); this.focusId = null; }
  },
  /* rows = days, 24 hour cells per row, blocks positioned by time; used by the interactive calendar and the static report */
  buildGrid(days, interactive) {
    const tk = todayKey(); const totals = netByDay(days[0], days[days.length - 1]); const now = nowMs();
    const head = h('div', { class: 'tl-row tl-head' }, h('div', { class: 'tl-label' }), h('div', { class: 'tl-hours' }, ...Array.from({ length: 12 }, (_, i) => h('span', null, i * 2))), h('div', { class: 'tl-total' }, 'Total'));
    const rows = days.map((k) => {
      const tot = totals.get(k)?.net || 0;
      const label = interactive ? h('button', { class: 'tl-label', title: 'Ver blocos do dia', onClick: () => Panel.day(k) }, fmtDayShort(k)) : h('div', { class: 'tl-label' }, fmtDayShort(k));
      return h('div', { class: 'tl-row' + (k === tk ? ' today' : '') + (isMonday(k) ? ' week-start' : '') + (k > tk ? ' future' : ''), dataset: { date: k } },
        label, h('div', { class: 'tl-track', dataset: { date: k } }, ...Array.from({ length: 24 }, () => h('i', { class: 'cell' }))), h('div', { class: 'tl-total num' }, tot ? fmtHM(tot / MIN) : ''));
    });
    const tracks = {}; rows.forEach((r) => { tracks[r.dataset.date] = $('.tl-track', r); });
    const rangeStart = dayMs(days[0], 0), rangeEnd = dayMs(addDays(days[days.length - 1], 1), 0);
    for (const s of state.sessions) {
      if (!isLive(s)) continue;
      const st = ms(s.started_at), en = s.ended_at ? ms(s.ended_at) : Math.max(now, st + 60000);
      if (en <= rangeStart || st >= rangeEnd) continue;
      for (const sg of this.segments(st, en)) { const tr = tracks[sg.day]; if (tr) tr.append(this.blockEl(s, sg, interactive)); }
    }
    return h('div', { class: 'tl' + (interactive ? '' : ' static'), role: 'grid' }, head, ...rows);
  },
  segments(st, en) { const out = []; let cur = st, guard = 0; while (cur < en && guard++ < 40) { const day = dayKeyOf(cur); const dayEnd = dayMs(addDays(day, 1), 0); const segEnd = Math.min(en, dayEnd); const a = (cur - dayMs(day, 0)) / DAY, b = (segEnd - dayMs(day, 0)) / DAY; out.push({ day, left: a * 100, width: Math.max(0.35, (b - a) * 100), start: cur, end: segEnd }); cur = segEnd; } return out; },
  blockEl(s, sg, interactive = true) {
    const tm = sessionTimes(s); const live = !s.ended_at; const color = themeColor(s.theme);
    const title = `${themeName(s.theme)} · ${live ? `${hm(tm.start)} – em andamento` : fmtRange(tm.start, tm.end)} · ${fmtHM(tm.net / MIN)}${s.note_md ? '\n' + mdExcerpt(s.note_md, 140) : ''}`;
    const el = h('div', { class: 'blk' + (live ? ' live' : '') + (tm.start > nowMs() ? ' planned' : '') + (interactive && s.id === this.selectedId ? ' selected' : ''), role: 'gridcell', tabindex: interactive ? '0' : null, title, 'aria-label': title.replace('\n', '. '), dataset: { id: s.id, day: sg.day }, style: { left: sg.left + '%', width: sg.width + '%', '--c': color, color: contrastInk(color) }, onKeydown: interactive ? (e) => this.onKey(e, s) : null },
      h('span', { class: 't' }, themeName(s.theme)), s.note_md ? noteIcon() : null);
    return el;
  },
  updateLive() { const r = runningSession(); if (!r) return; const b = $(`.blk.live[data-id="${r.id}"]`, this.el); if (!b) return; const day = b.dataset.day; const st = Math.max(ms(r.started_at), dayMs(day, 0)); const en = Math.min(nowMs(), dayMs(addDays(day, 1), 0)); b.style.width = Math.max(0.35, ((en - st) / DAY) * 100) + '%'; },
  onKey(e, s) {
    const snap = Math.max(5, state.settings.snap_min || 15) * MIN;
    const tm = sessionTimes(s); let start = tm.start, end = tm.end;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); Panel.editSession(s.id); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSession(s.id); Drawer.close(); toastUndo('Bloco apagado'); return; }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { const d = e.key === 'ArrowLeft' ? -snap : snap; if (e.shiftKey) { if (s.ended_at) end = Math.max(start + snap, end + d); else return; } else { start += d; end += d; } }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { const d = e.key === 'ArrowUp' ? -DAY : DAY; start += d; end += d; }
    else return;
    e.preventDefault();
    const patch = { started_at: iso(start) }; if (s.ended_at) patch.ended_at = iso(end);
    const shift = start - tm.start; patch.pauses = (s.pauses || []).map((p) => ({ start: iso(ms(p.start) + (e.shiftKey ? 0 : shift)), end: p.end ? iso(ms(p.end) + (e.shiftKey ? 0 : shift)) : null }));
    const errs = validateSession({ ...s, ...patch }, s.id); if (errs.length) { toast(errs[0].message, { error: true }); return; }
    this.focusId = s.id; updateSession(s.id, patch); toastUndo('Bloco ajustado');
  },
  createAt(startMs, lenMin) {
    const fit = this.fitMove(startMs, startMs + lenMin * MIN); if (!fit.ok) { toast('Não cabe aí: há outro bloco nesse horário', { error: true }); return null; }
    const data = { theme: state.settings.last_theme || themes()[0]?.id, started_at: iso(fit.start), ended_at: iso(fit.end), source: 'manual' };
    const errs = validateSession(data); if (errs.length) { toast(errs[0].message, { error: true }); return null; }
    const s = createSession(data); this.focusId = s.id; this.selectedId = s.id; Panel.editSession(s.id); toastUndo('Bloco criado'); return s;
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
      const reject = () => { blocks.forEach((b) => { b.classList.add('reject'); setTimeout(() => b.classList.remove('reject'), 300); }); toast('Não cabe aí: encosta em outro bloco', { error: true }); };
      if (!res.ok) { reject(); return; }
      if (d.kind === 'create') { const data = { theme: state.settings.last_theme || themes()[0]?.id, started_at: iso(res.start), ended_at: iso(res.end), source: 'manual' }; const errs = validateSession(data); if (errs.length) { toast(errs[0].message, { error: true }); return; } const s = createSession(data); this.selectedId = s.id; this.focusId = s.id; toastUndo('Bloco criado'); setTimeout(() => Panel.editSession(s.id), 30); return; }
      if (d.kind === 'dup') { const src = d.session; const shift = res.start - d.orig.start; const pauses = (src.pauses || []).map((p) => ({ start: iso(ms(p.start) + shift), end: p.end ? iso(ms(p.end) + shift) : null })); const data = { theme: src.theme, started_at: iso(res.start), ended_at: iso(res.end), pauses, source: 'manual', note_md: src.note_md }; const errs = validateSession(data); if (errs.length) { toast(errs[0].message, { error: true }); return; } const s = createSession(data); this.focusId = s.id; toastUndo('Bloco duplicado'); return; }
      const s = d.session; const shift = res.start - d.orig.start; const patch = { started_at: iso(res.start) };
      if (s.ended_at) patch.ended_at = iso(res.end);
      if (d.kind === 'move') patch.pauses = (s.pauses || []).map((p) => ({ start: iso(ms(p.start) + shift), end: p.end ? iso(ms(p.end) + shift) : null }));
      else patch.pauses = (s.pauses || []).map((p) => ({ start: iso(clamp(ms(p.start), res.start, res.end)), end: p.end ? iso(clamp(ms(p.end), res.start, res.end)) : null })).filter((p) => !p.end || ms(p.end) > ms(p.start));
      const errs = validateSession({ ...s, ...patch }, s.id); if (errs.length) { reject(); return; }
      this.focusId = s.id; this.selectedId = s.id; updateSession(s.id, patch); toastUndo(d.kind === 'move' ? 'Bloco movido' : 'Bloco ajustado');
    };
    grid.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const blk = e.target.closest('.blk'); const tr = e.target.closest('.tl-track'); if (!tr) return;
      if (e.target.closest('.tl-label')) return;
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
        if (d.session) Panel.editSession(d.session.id);
        else if (d.kind === 'create') this.createAt(dayMs(d.day, d.anchorMin), state.settings.default_len_min);
        return;
      }
      finish(true, e.clientX, e.clientY);
    });
    grid.addEventListener('pointercancel', () => finish(false));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drag) finish(false); });
  },
};

/* ---------- Relatórios ---------- */
const ReportsCard = {
  el: null, period: 'week',
  mount(root) { this.el = h('section', { class: 'card', id: 'card-reports' }); root.append(this.el); this.render(); on('change', () => this.render()); },
  render() {
    const [from, to] = this.period === 'all' ? [null, null] : periodRange(this.period);
    const r = sumRange(from, to); const sk = streakInfo();
    const byTheme = themes().map((th) => ({ th, min: r.byTheme.get(th.id) || 0 })); const other = r.byTheme.get('__none') || 0;
    const max = Math.max(1, ...byTheme.map((x) => x.min), other);
    const top = byTheme.slice().sort((a, b) => b.min - a.min)[0];
    const seg = segmented([['week', 'Semana'], ['month', 'Mês'], ['all', 'Total']], this.period, (v) => { this.period = v; this.render(); });
    setKids(this.el,
      h('div', { class: 'card-head' }, h('div', null, h('h2', null, 'Relatórios'), h('p', { class: 'sub' }, this.period === 'week' ? 'Últimos 7 dias' : this.period === 'month' ? 'Últimos 30 dias' : 'Todo o período')), h('div', { class: 'row' }, seg, h('a', { class: 'btn sm', href: '#/relatorio' }, '📄 Relatório completo'))),
      h('div', { class: 'stats' },
        h('div', null, h('b', null, fmtHM(r.netMin)), h('span', null, 'Tempo')),
        h('div', null, h('b', null, `${sk.current} ${sk.current === 1 ? 'dia' : 'dias'}`), h('span', null, 'Sequência')),
        h('div', null, h('b', { style: { color: top && top.min > 0 ? top.th.color : '' } }, top && top.min > 0 ? top.th.name : '—'), h('span', null, 'Tema principal'))),
      h('div', { class: 'bars' }, ...byTheme.map(({ th, min }) => h('div', { class: 'bar-row' }, h('span', { class: 'lbl' }, th.name), h('div', { class: 'bar' }, h('i', { class: 'dotc', style: { background: th.color } }), h('i', { class: 'fill', style: { width: (min / max) * 100 + '%', background: th.color } })), h('span', { class: 'val num' }, min ? fmtHM(min) : ''))),
        other ? h('div', { class: 'bar-row' }, h('span', { class: 'lbl muted' }, 'Sem tema'), h('div', { class: 'bar' }, h('i', { class: 'dotc', style: { background: '#8a9bb3' } }), h('i', { class: 'fill', style: { width: (other / max) * 100 + '%', background: '#8a9bb3' } })), h('span', { class: 'val num' }, fmtHM(other))) : null));
  },
};
