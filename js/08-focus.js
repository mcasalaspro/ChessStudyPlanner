/* ===== Focus mode ===== */
const Focus = {
  el: null, raf: null, idleTm: null, lock: null, offs: [], t0: 0, stars: null, waveOffset: 0,
  isOpen() { return !!this.el; },
  open() {
    if (this.el) return;
    const el = h('div', { class: 'focus', role: 'dialog', 'aria-label': 'Focus mode' });
    const canvas = h('canvas'); el.append(canvas);
    const missionBox = h('div', { class: 'fz-mission', id: 'fz-mission' });
    const center = h('div', { class: 'fz-center' }, missionBox, h('div', { class: 'fz-frozen num', id: 'fz-frozen' }), h('div', { class: 'fz-main num', id: 'fz-main' }, '00:00:00'), h('div', { class: 'fz-sub', id: 'fz-sub' }),
      h('div', { class: 'fz-plan', id: 'fz-plan' }, h('div', { class: 'fz-plan-track', id: 'fz-plan-track' }), h('div', { class: 'fz-plan-legend', id: 'fz-plan-legend' })));
    const q = quoteOfDay();
    const quote = h('div', { class: 'fz-quote' }, h('i', null, `“${q.t}”`), h('span', null, `— ${q.s}`));
    const noteTa = h('textarea', { placeholder: 'Quick note (Ctrl+Enter adds it to the block)', 'aria-label': 'Quick note' });
    const noteBox = h('div', { class: 'fz-note', hidden: true }, noteTa, h('div', { class: 'row' }, h('button', { class: 'btn sm', onClick: () => { noteBox.hidden = true; } }, 'Cancel'), h('button', { class: 'btn sm primary', onClick: () => this.addNote() }, 'Add')));
    noteTa.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.addNote(); } if (e.key === 'Escape') { noteBox.hidden = true; } });
    const bar = h('div', { class: 'fz-bar', id: 'fz-bar' });
    el.append(h('div', { class: 'fz-hint' }, 'Space pause · N note · M theme · E stop · Esc exit'), center, quote, noteBox, bar);
    document.body.append(el); this.el = el; this.canvas = canvas; this.noteBox = noteBox; this.noteTa = noteTa;
    this.renderControls();
    // fullscreen (fallback: overlay already covers the viewport)
    try { if (el.requestFullscreen) el.requestFullscreen().catch(() => { }); } catch { /* */ }
    this.requestWakeLock();
    const onMove = () => this.wake(); el.addEventListener('pointermove', onMove); el.addEventListener('pointerdown', onMove); el.addEventListener('keydown', onMove);
    const onKey = (e) => this.onKey(e); document.addEventListener('keydown', onKey, true);
    const onVis = () => { if (document.hidden) this.stopAnim(); else { this.startAnim(); this.requestWakeLock(); } }; document.addEventListener('visibilitychange', onVis);
    const onFs = () => { if (!document.fullscreenElement && this.el) this.close(false); }; document.addEventListener('fullscreenchange', onFs);
    const onResize = () => this.resize(); window.addEventListener('resize', onResize);
    this.offs = [() => document.removeEventListener('keydown', onKey, true), () => document.removeEventListener('visibilitychange', onVis), () => document.removeEventListener('fullscreenchange', onFs), () => window.removeEventListener('resize', onResize), on('tick', () => { this.updateDigits(); this.renderPlan(); }), on('change', () => { this.renderControls(); this.renderPlan(); })];
    this.t0 = performance.now(); this.resize(); this.startAnim(); this.wake(); this.updateDigits(); this.renderPlan();
  },
  close(exitFs = true) {
    if (!this.el) return;
    this.stopAnim(); this.offs.forEach((f) => f()); this.offs = []; clearTimeout(this.idleTm);
    this.el.remove(); this.el = null;
    if (this.lock) { try { this.lock.release(); } catch { /* */ } this.lock = null; }
    if (exitFs && document.fullscreenElement) { try { document.exitFullscreen(); } catch { /* */ } }
  },
  async requestWakeLock() { try { if ('wakeLock' in navigator && !this.lock) { this.lock = await navigator.wakeLock.request('screen'); this.lock.addEventListener('release', () => { this.lock = null; }); } } catch { /* silent fallback */ } },
  wake() { if (!this.el) return; this.el.classList.remove('idle', 'hide-cursor'); clearTimeout(this.idleTm); this.idleTm = setTimeout(() => { if (this.el && !this.el.contains(document.activeElement) || document.activeElement === document.body) this.el && this.el.classList.add('idle', 'hide-cursor'); }, 4000); },
  renderControls() {
    if (!this.el) return;
    const r = runningSession(); const st = Timer.status(); const bar = $('#fz-bar', this.el); const mb = $('#fz-mission', this.el);
    this.el.classList.toggle('paused', st === 'paused');
    const th = themeById(r ? r.theme : state.settings.last_theme);
    mb.replaceChildren(th ? frag(h('i', { class: 'dot', style: { background: th.color } }), h('span', null, th.name)) : h('span', { style: { opacity: 0.6 } }, r ? 'Study' : 'Ready to start'));
    bar.replaceChildren(...[
      !r ? h('button', { class: 'btn lg', onClick: () => { try { Timer.start(state.settings.last_theme || null); } catch (e) { toast(e.message, { error: true }); } } }, '▶ Start')
        : st === 'running' ? h('button', { class: 'btn lg', onClick: () => Timer.pause() }, '❚❚ Pause') : h('button', { class: 'btn lg', onClick: () => Timer.resume() }, '▶ Resume'),
      r ? h('button', { class: 'btn lg', onClick: () => this.toggleNote() }, '📝 Note') : null,
      h('button', { class: 'btn lg', onClick: () => this.pickMission() }, '◉ Theme'),
      r ? h('button', { class: 'btn lg', onClick: () => this.stop() }, '■ Stop') : null,
      h('button', { class: 'btn lg', onClick: () => this.close() }, 'Exit (Esc)')].filter(Boolean));
    this.updateDigits();
  },
  updateDigits() {
    if (!this.el) return; const r = runningSession(); const main = $('#fz-main', this.el), sub = $('#fz-sub', this.el), fz = $('#fz-frozen', this.el);
    if (!r) { main.textContent = '00:00:00'; sub.textContent = ''; fz.textContent = ''; return; }
    const tm = sessionTimes(r); const p = openPause(r);
    if (p) { main.textContent = fmtClock(nowMs() - ms(p.start)); fz.textContent = `net ${fmtClock(tm.net)}`; } else main.textContent = fmtClock(tm.net);
    sub.textContent = `gross ${fmtClock(tm.gross)} · breaks ${fmtClock(tm.pauseMs)}`;
  },
  /* Horizontal plan: white = study stretches, blue = breaks, with a marker for the current moment. */
  renderPlan() {
    if (!this.el) return;
    const track = $('#fz-plan-track', this.el), legend = $('#fz-plan-legend', this.el); if (!track) return;
    const study = Math.max(5, +state.settings.break_every_min || 25), brk = Math.max(5, +state.settings.break_len_min || 15);
    const target = +state.settings.target_min || 0;
    const segs = []; let acc = 0;
    if (target > 0) {
      while (acc < target) { const len = Math.min(study, target - acc); segs.push({ kind: 'study', len }); acc += len; if (acc < target) { segs.push({ kind: 'break', len: brk }); } }
    } else {
      for (let i = 0; i < 2; i++) { segs.push({ kind: 'study', len: study }); segs.push({ kind: 'break', len: brk }); }
    }
    const totalStudy = segs.filter((x) => x.kind === 'study').reduce((a, x) => a + x.len, 0);
    const totalSpan = segs.reduce((a, x) => a + x.len, 0);
    const r = runningSession(); const done = r ? sessionTimes(r).net / MIN : 0;
    // the marker walks over the study stretches only, since breaks do not count as net time
    let markLeft = 0, walked = 0;
    for (const sg of segs) {
      if (sg.kind === 'study') {
        if (walked + sg.len >= done) { markLeft += ((done - walked) / totalSpan) * 100; walked = done; break; }
        walked += sg.len;
      }
      markLeft += (sg.len / totalSpan) * 100;
    }
    setKids(track, ...segs.map((sg) => h('i', { class: 'seg ' + sg.kind, style: { width: (sg.len / totalSpan) * 100 + '%' }, title: `${sg.kind === 'study' ? 'Study' : 'Break'} ${fmtHM(sg.len)}` })),
      h('span', { class: 'mark', style: { left: clamp(markLeft, 0, 100) + '%' } }));
    legend.textContent = target > 0
      ? `Target ${fmtHM(target)} · ${fmtHM(study)} study / ${fmtHM(brk)} break · ${fmtHM(Math.max(0, totalStudy - done))} to go`
      : `${fmtHM(study)} study / ${fmtHM(brk)} break — two rounds shown (no target set)`;
  },
  toggleNote() { if (!runningSession()) return; this.noteBox.hidden = !this.noteBox.hidden; if (!this.noteBox.hidden) this.noteTa.focus(); },
  addNote() { if (Timer.addQuickNote(this.noteTa.value)) { this.noteTa.value = ''; toast('Note added to the block'); } this.noteBox.hidden = true; },
  pickMission() {
    const mb = $('#fz-mission', this.el); const r = runningSession();
    const sel = themeSelect(r ? r.theme : state.settings.last_theme || '');
    sel.addEventListener('change', () => { if (r) Timer.setTheme(sel.value || null); else updateSettings({ last_theme: sel.value || null }); this.renderControls(); });
    sel.addEventListener('keydown', (e) => e.stopPropagation()); sel.addEventListener('blur', () => this.renderControls());
    mb.replaceChildren(sel); sel.focus();
  },
  /* Leaves focus mode first: the confirmation dialog is not visible over the fullscreen overlay. */
  async stop() {
    if (!runningSession()) return;
    this.close();
    if (await confirmDialog('Stop the block?', { okLabel: 'Stop' })) { const s = Timer.stop(); if (s) Panel.closeSession(s.id); }
  },
  onKey(e) {
    if (!this.el) return; if (modalStack.length) return;
    const tag = document.activeElement?.tagName; if (tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); const st = Timer.status(); if (st === 'idle') { try { Timer.start(state.settings.last_theme || null); } catch (err) { toast(err.message, { error: true }); } } else if (st === 'running') Timer.pause(); else Timer.resume(); }
    else if (k === 'n') { e.preventDefault(); this.toggleNote(); }
    else if (k === 'm') { e.preventDefault(); this.pickMission(); }
    else if (k === 'e') { e.preventDefault(); this.stop(); }
    else if (k === 'escape' || k === 'f') { e.preventDefault(); e.stopPropagation(); this.close(); }
  },
  /* ---- animation ---- */
  resize() { if (!this.canvas) return; const dpr = Math.min(2, window.devicePixelRatio || 1); this.canvas.width = Math.floor(this.el.clientWidth * dpr); this.canvas.height = Math.floor(this.el.clientHeight * dpr); this.dpr = dpr; this.stars = null; if (!this.raf) this.draw(performance.now()); },
  startAnim() { if (this.raf || !this.el) return; const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; if (reduced || state.settings.focus_anim === 'nenhuma') { this.draw(performance.now()); return; } const loop = (ts) => { this.draw(ts); this.raf = requestAnimationFrame(loop); }; this.raf = requestAnimationFrame(loop); },
  stopAnim() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = null; },
  palette() {
    const r = runningSession(); const th = themeById(r ? r.theme : state.settings.last_theme);
    const base = hexToHsl(th ? th.color : '#5c86f0'); const paused = Timer.status() === 'paused';
    const sat = paused ? 10 : 30, light = paused ? 26 : 36;
    return { h: base.h, s: sat, l: light, paused };
  },
  draw(ts) {
    const c = this.canvas; if (!c) return; const ctx = c.getContext('2d'); const W = c.width, H = c.height; const time = (ts - this.t0) / 1000;
    const pal = this.palette(); const kind = state.settings.focus_anim; const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tt = reduced ? 0 : time;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = `hsl(${pal.h} ${Math.round(pal.s * 0.4)}% 7%)`; ctx.fillRect(0, 0, W, H);
    if (kind === 'aurora' || kind === 'nenhuma') {
      const blobs = [[0.3, 0.35, 74, 121, 0], [0.7, 0.55, 95, 160, 25], [0.5, 0.8, 85, 128, -20]];
      ctx.globalCompositeOperation = 'lighter';
      blobs.forEach(([bx, by, p1, p2, hueOff], i) => {
        const x = W * (bx + 0.16 * Math.sin((tt / p1) * 2 * Math.PI + i) + 0.07 * Math.cos((tt / p2) * 2 * Math.PI * 1.7 + i * 2));
        const y = H * (by + 0.14 * Math.cos((tt / p2) * 2 * Math.PI + i * 1.3) + 0.06 * Math.sin((tt / p1) * 2 * Math.PI * 1.3));
        const rad = Math.max(W, H) * (0.42 + 0.05 * Math.sin(tt / 23 + i));
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        const hue = (pal.h + hueOff + 360) % 360;
        g.addColorStop(0, `hsla(${hue} ${pal.s}% ${pal.l}% / 0.38)`); g.addColorStop(0.45, `hsla(${hue} ${pal.s}% ${pal.l}% / 0.12)`); g.addColorStop(1, 'hsla(0 0% 0% / 0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      });
      ctx.globalCompositeOperation = 'source-over';
    } else if (kind === 'ondas') {
      const dpr = this.dpr || 1; const shift = tt * 1 * dpr; // 1 px/s
      [[0.78, 0.035, 220, 0.28], [0.84, 0.045, 340, 0.18]].forEach(([yb, amp, wl, alpha], i) => {
        ctx.beginPath(); ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 6 * dpr) { const y = H * yb + Math.sin((x + shift * (i ? -1 : 1)) / (wl * dpr) * 2 * Math.PI) * H * amp + Math.sin((x - shift) / (wl * 0.53 * dpr) * 2 * Math.PI) * H * amp * 0.4; ctx.lineTo(x, y); }
        ctx.lineTo(W, H); ctx.closePath();
        ctx.fillStyle = `hsla(${(pal.h + i * 18) % 360} ${pal.s}% ${pal.l}% / ${alpha})`; ctx.fill();
      });
    } else if (kind === 'estrelas') {
      if (!this.stars) { const rnd = mulberry(7); this.stars = Array.from({ length: 80 }, () => ({ x: rnd() * W, y: rnd() * H, r: (0.8 + rnd() * 1.6) * (this.dpr || 1), p: 6 + rnd() * 8, ph: rnd() * Math.PI * 2 })); }
      for (const s of this.stars) { const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin((tt / s.p) * 2 * Math.PI + s.ph)); ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fillStyle = `hsla(${pal.h} ${Math.round(pal.s * 0.6)}% 88% / ${a * (pal.paused ? 0.55 : 1)})`; ctx.fill(); }
    }
  },
};
function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let x = a; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
