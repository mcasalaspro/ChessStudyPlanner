/* ===== Timer engine ===== */
const APP_TITLE = 'Chess Study Planner';
const Timer = {
  _tick: null, _hb: null, _remindedPause: null, _breakNotified: 0, _favState: null, _favBlink: false,
  status() { const r = runningSession(); if (!r) return 'idle'; return openPause(r) ? 'paused' : 'running'; },

  start(theme) {
    if (runningSession()) throw new Error('Já existe um bloco em andamento.');
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
      ? `A pausa passou de ${state.settings.pause_autostop_min} min, então o bloco foi encerrado no início da pausa (${hm(end)}). O tempo de pausa não contou.`
      : `O app ficou mais de 12 h sem sinal com o cronômetro ligado. O bloco foi encerrado em ${fmtDayShort(dayKeyOf(end))} ${hm(end)}.`;
    showBanner('autoclosed-' + r.id, { text: msg, warn: true, actions: [{ label: 'Reabrir/ajustar', primary: true, onClick: () => { hideBanner('autoclosed-' + r.id); Panel.editSession(r.id); } }] });
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
        text: `Você estava mesmo estudando até agora? O app ficou fechado desde ${fmtDayShort(dayKeyOf(lastSeen))} ${hm(lastSeen)}.`, warn: true,
        actions: [
          { label: 'Sim, seguir', primary: true, onClick: () => { hideBanner(id); this.heartbeat(); } },
          { label: 'Encerrar quando saí', onClick: () => { hideBanner(id); const s = this.stop(lastSeen); if (s) Panel.closeSession(s.id); } },
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
      const pausedFor = nowMs() - ms(op.start);
      if (pausedFor > state.settings.pause_autostop_min * MIN) { this.autoClose(r, ms(op.start), 'pause'); return; }
      if (pausedFor > 10 * MIN && this._remindedPause !== op.start) {
        this._remindedPause = op.start;
        const msg = 'Pausado há 10 min — retomar ou encerrar?';
        toast(msg, { duration: 8000, action: 'Retomar', onAction: () => this.resume() }); notify(msg);
      }
    } else {
      // break reminder every N net minutes ("Avisar pausa a cada X min")
      const every = +state.settings.break_every_min || 0;
      if (every > 0) {
        const netMinutes = sessionTimes(r).net / MIN; const k = Math.floor(netMinutes / every);
        if (k > 0 && k > this._breakNotified) {
          this._breakNotified = k;
          const msg = `${Math.round(netMinutes)} min de estudo — hora de uma pausa?`;
          toast(msg, { duration: 10000, action: 'Pausar', onAction: () => this.pause() }); notify(msg); if (state.settings.sound) playBell(true);
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
