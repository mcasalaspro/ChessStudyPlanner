/* ===== Timer engine ===== */
const APP_TITLE = 'Chess Study Planner';
const Timer = {
  _tick: null, _hb: null, _remindedPause: null, _breakNotified: 0, _favState: null, _favBlink: false,
  status() { const r = runningSession(); if (!r) return 'idle'; return openPause(r) ? 'paused' : 'running'; },

  start(theme) {
    if (runningSession()) throw new Error('A block is already running.');
    const nowN = Math.round(nowMs()); const now = iso(nowN);
    // A block planned in advance that covers "now" (or starts within 15 min) is adopted by the timer instead of conflicting with it.
    const planned = state.sessions.find((x) => isLive(x) && x.ended_at && ms(x.started_at) > ms(x.created_at) + 5 * MIN && ms(x.started_at) <= nowN + 15 * MIN && ms(x.ended_at) > nowN);
    let s;
    if (planned) {
      s = planned; s.started_at = now; s.ended_at = null; s.pauses = []; s.source = 'timer'; s.meta = { ...(s.meta || {}), last_seen_at: now, planned: true }; s.updated_at = iso(Date.now());
      if (theme) s.theme = theme;
    } else {
      s = newSessionObj({ theme: theme || state.settings.last_theme || null, started_at: now, ended_at: null, source: 'timer', meta: { last_seen_at: now } });
      state.sessions.push(s);
    }
    if (s.theme) state.settings.last_theme = s.theme;
    this._breakNotified = 0;
    dirty('session', s.id); commit('timer', { status: 'running' });
    this.ensureLoops();
    return s;
  },
  pause() {
    const r = runningSession(); if (!r || openPause(r)) return;
    r.pauses = r.pauses || []; r.pauses.push({ start: iso(Math.round(nowMs())), end: null }); r.updated_at = iso(Date.now());
    this._remindedPause = null;
    dirty('session', r.id); commit('timer', { status: 'paused' });
  },
  resume() {
    const r = runningSession(); if (!r) return; const p = openPause(r); if (!p) return;
    p.end = iso(Math.round(nowMs())); r.updated_at = iso(Date.now());
    dirty('session', r.id); commit('timer', { status: 'running' });
  },
  /* "+10 min": the block actually began earlier — move the start back (limited by the previous block). */
  addMinutes(n) {
    const r = runningSession(); if (!r) return false;
    const start = ms(r.started_at); let newStart = start - n * MIN;
    const c = findOverlap(newStart, start, r.id); if (c) newStart = Math.max(newStart, c.ended_at ? ms(c.ended_at) : start);
    if (newStart >= start) return false;
    r.started_at = iso(newStart); r.updated_at = iso(Date.now());
    dirty('session', r.id); commit('timer', { status: this.status() });
    return true;
  },
  setTheme(theme) { const r = runningSession(); if (!r) return; r.theme = theme || null; r.updated_at = iso(Date.now()); if (theme) state.settings.last_theme = theme; dirty('session', r.id); commit('timer', { status: this.status() }); },
  /* Stops the running block at `atMs` (default now); returns the closed session for review. */
  stop(atMs) {
    const r = runningSession(); if (!r) return null;
    const end = Math.round(atMs ?? nowMs());
    const p = openPause(r); if (p) { if (ms(p.start) >= end) r.pauses = r.pauses.filter((x) => x !== p); else p.end = iso(end); }
    r.pauses = (r.pauses || []).filter((x) => ms(x.start) < end).map((x) => ({ start: x.start, end: x.end && ms(x.end) > end ? iso(end) : x.end }));
    r.ended_at = iso(Math.max(end, ms(r.started_at) + 1000)); r.updated_at = iso(Date.now());
    if (state.settings.sound) playBell();
    dirty('session', r.id); commit('timer', { status: 'idle' });
    return r;
  },
  discard() {
    const r = runningSession(); if (!r) return;
    r.deleted_at = iso(Date.now()); r.updated_at = r.deleted_at; r.ended_at = r.ended_at || r.deleted_at;
    dirty('session', r.id); commit('timer', { status: 'idle' });
  },
  /* Guided break: pauses and counts down; ends by itself. */
  startBreak(minutes) {
    const r = runningSession(); if (!r || openPause(r)) return;
    const len = Math.max(1, +minutes || +state.settings.break_len_min || 15);
    this.pause();
    const r2 = runningSession(); if (!r2) return;
    r2.meta = { ...(r2.meta || {}), break_until: iso(Math.round(nowMs()) + len * MIN) }; r2.updated_at = iso(Date.now());
    if (state.settings.sound) playBell(true);
    const msg = `Break time — ${len} min. The timer comes back on its own.`;
    toast(msg, { duration: 7000, action: 'Skip', onAction: () => this.endBreak() }); notify(msg);
    dirty('session', r2.id); commit('timer', { status: 'paused' });
  },
  endBreak() {
    const r = runningSession(); if (!r) return;
    if (r.meta) { const m = { ...r.meta }; delete m.break_until; r.meta = m; }
    this.resume();
    if (state.settings.sound) playBell();
    const msg = 'Break over — back to it.'; toast(msg); notify(msg);
  },
  breakLeft() { const r = runningSession(); const u = r?.meta?.break_until ? ms(r.meta.break_until) : 0; return u ? Math.max(0, u - nowMs()) : 0; },
  addBreakMinutes(n) {
    const r = runningSession(); const u = r?.meta?.break_until ? ms(r.meta.break_until) : 0; if (!u) return;
    r.meta = { ...r.meta, break_until: iso(u + n * MIN) }; r.updated_at = iso(Date.now());
    dirty('session', r.id); commit('timer', { status: 'paused' });
  },
  addQuickNote(text) {
    const r = runningSession(); if (!r || !text.trim()) return false;
    const line = `**[${hm(nowMs())}]** ${text.trim()}`;
    r.note_md = (r.note_md ? r.note_md.replace(/\s+$/, '') + '\n' : '') + line; r.updated_at = iso(Date.now());
    dirty('session', r.id); commit('timer', { status: this.status() });
    return true;
  },
  autoClose(r, atMs, reason) {
    const end = Math.max(Math.round(atMs), ms(r.started_at) + 1000);
    r.pauses = (r.pauses || []).filter((p) => ms(p.start) < end).map((p) => ({ start: p.start, end: !p.end || ms(p.end) > end ? iso(end) : p.end }));
    r.ended_at = iso(end); r.meta = { ...(r.meta || {}), autoclosed: true, autoclosed_reason: reason }; r.updated_at = iso(Date.now());
    dirty('session', r.id); commit('timer', { status: 'idle' });
    const msg = reason === 'pause'
      ? `The break went past ${state.settings.pause_autostop_min} min, so the block was closed at the start of the break (${hm(end)}). Break time was not counted.`
      : `The app went more than 12 h without a signal while the timer was running. The block was closed on ${fmtDayShort(dayKeyOf(end))} at ${hm(end)}.`;
    showBanner('autoclosed-' + r.id, { text: msg, warn: true, actions: [{ label: 'Reopen / adjust', primary: true, onClick: () => { hideBanner('autoclosed-' + r.id); Panel.editSession(r.id); } }] });
  },
  heartbeat() {
    const r = runningSession(); if (!r) return;
    r.meta = { ...(r.meta || {}), last_seen_at: iso(Math.round(nowMs())) };
    persist(); dirty('session', r.id);
  },
  hydrate() {
    const r = runningSession();
    if (!r) { this.updateChrome(); return; }
    const lastSeen = r.meta?.last_seen_at ? ms(r.meta.last_seen_at) : ms(r.started_at);
    const now = nowMs(), gap = now - lastSeen;
    const op = openPause(r);
    if (op && now - ms(op.start) > state.settings.pause_autostop_min * MIN) { this.autoClose(r, ms(op.start), 'pause'); return; }
    if (gap > 12 * HOUR) { this.autoClose(r, lastSeen, 'idle'); return; }
    if (gap > 3 * MIN) {
      const id = 'absence';
      showBanner(id, {
        text: `Were you really studying until now? The app has been closed since ${fmtDayShort(dayKeyOf(lastSeen))} ${hm(lastSeen)}.`, warn: true,
        actions: [
          { label: 'Yes, keep going', primary: true, onClick: () => { hideBanner(id); this.heartbeat(); } },
          { label: 'Stop when I left', onClick: () => { hideBanner(id); const s = this.stop(lastSeen); if (s) Panel.closeSession(s.id); } },
        ],
      });
    }
    this.heartbeat();
    this.ensureLoops();
  },
  ensureLoops() {
    if (!this._tick) this._tick = setInterval(() => this.tick(), 250);
    if (!this._hb) this._hb = setInterval(() => this.heartbeat(), 60000);
  },
  tick() {
    const r = runningSession();
    if (!r) { if (this._tick) { clearInterval(this._tick); this._tick = null; } if (this._hb) { clearInterval(this._hb); this._hb = null; } this.updateChrome(); emit('tick'); return; }
    const op = openPause(r);
    if (op) {
      // guided break: resume by itself when the break time is over
      const until = r.meta?.break_until ? ms(r.meta.break_until) : 0;
      if (until) {
        if (nowMs() >= until) { this.endBreak(); return; }
        const pausedForG = nowMs() - ms(op.start);
        if (pausedForG > state.settings.pause_autostop_min * MIN) { this.autoClose(r, ms(op.start), 'pause'); }
        this.updateChrome(); emit('tick'); return;
      }
      const pausedFor = nowMs() - ms(op.start);
      if (pausedFor > state.settings.pause_autostop_min * MIN) { this.autoClose(r, ms(op.start), 'pause'); return; }
      if (pausedFor > 10 * MIN && this._remindedPause !== op.start) {
        this._remindedPause = op.start;
        const msg = 'Paused for 10 min — resume or stop?';
        toast(msg, { duration: 8000, action: 'Resume', onAction: () => this.resume() }); notify(msg);
      }
    } else {
      // session target set by the 30 min / 1 h / 2 h buttons: stop by itself when the net time is reached
      const target = +state.settings.target_min || 0;
      if (target > 0 && sessionTimes(r).net >= target * MIN) {
        const stopped = this.stop();
        updateSettings({ target_min: null });
        if (stopped) { const msg = `Target of ${fmtHM(target)} reached — block stopped.`; toast(msg, { duration: 8000 }); notify(msg); Panel.closeSession(stopped.id); }
        return;
      }
      // break reminder every N net minutes — guided breaks pause and resume by themselves
      const every = +state.settings.break_every_min || 0;
      if (every > 0) {
        const netMinutes = sessionTimes(r).net / MIN; const k = Math.floor(netMinutes / every);
        if (k > 0 && k > this._breakNotified) {
          this._breakNotified = k;
          if (state.settings.guided_breaks) { this.startBreak(); return; }
          const msg = `${Math.round(netMinutes)} min of study — time for a break?`;
          toast(msg, { duration: 10000, action: 'Take a break', onAction: () => this.pause() }); notify(msg); if (state.settings.sound) playBell(true);
        }
      }
    }
    this.updateChrome();
    emit('tick');
  },
  updateChrome() {
    const r = runningSession(); const st = this.status();
    if (!r) { if (document.title !== APP_TITLE) document.title = APP_TITLE; this.setFavicon('idle'); return; }
    const net = sessionTimes(r).net;
    const title = `${st === 'paused' ? '⏸' : '⏱'} ${fmtClock(net)} — ${APP_TITLE}`;
    if (document.title !== title) document.title = title;
    if (st === 'paused') { if (Math.floor(nowMs() / 1000) % 2 === 0 !== this._favBlink) { this._favBlink = !this._favBlink; this.setFavicon(this._favBlink ? 'paused' : 'paused-dim'); } }
    else this.setFavicon('running');
  },
  setFavicon(kind) {
    if (this._favState === kind) return; this._favState = kind;
    const dot = { idle: '', running: '<circle cx="52" cy="12" r="10" fill="#8bc34a"/>', paused: '<circle cx="52" cy="12" r="10" fill="#e0a03a"/>', 'paused-dim': '<circle cx="52" cy="12" r="10" fill="#e0a03a" opacity="0.35"/>' }[kind] || '';
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='#15181f'/><text x='31' y='48' font-size='42' text-anchor='middle' fill='#f2a41c' font-family='serif'>♞</text>${dot}</svg>`;
    let link = $('link[rel="icon"]'); if (!link) { link = h('link', { rel: 'icon' }); document.head.append(link); }
    link.href = 'data:image/svg+xml,' + encodeURIComponent(svg);
  },
};

function notify(body) {
  try { if ('Notification' in window && Notification.permission === 'granted' && document.hidden) new Notification(APP_TITLE, { body }); } catch { /* ignore */ }
}
function playBell(soft = false) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime; const vol = soft ? 0.08 : 0.18;
    [660, 990].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, now + i * 0.05); g.gain.exponentialRampToValueAtTime(vol, now + i * 0.05 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
      o.start(now + i * 0.05); o.stop(now + 1.5);
    });
    setTimeout(() => ctx.close(), 1800);
  } catch { /* ignore */ }
}
