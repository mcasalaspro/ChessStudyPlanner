/* ===== Closing things: "How was your focus?" when a block ends, and closing the day =====
   The app only records what happened. A block ends → one question about focus. A day ends → the next
   morning the app walks through what is still open, closes the day and shows a short read of it. */

/* Starting a block always closes the one still running (at the same instant) and asks about it. */
function startBlock(theme, { free = true, then } = {}) {
  try {
    const { closed } = Timer.start(theme, { free });
    if (closed) FocusCheck.ask(closed.id, { reason: 'switched', then });
    else if (then) then();
  } catch (e) { toast(e.message, { error: true }); }
}
/* Stop the running block and ask about it. */
function stopBlock(atMs) { const s = Timer.stop(atMs); if (s) FocusCheck.ask(s.id); return s; }

/* Log a finished block that ended now (it slides back past anything already logged). */
function logNow(mins) {
  if (runningSession()) { toast('A block is running — stop it first, or use the timer targets', { error: true }); return null; }
  let end = Math.floor(nowMs() / MIN) * MIN; let guard = 0;
  while (guard++ < 30) {
    const c = findOverlap(end - mins * MIN, end);
    if (!c) break;
    end = Math.min(end, ms(c.started_at));
  }
  const start = end - mins * MIN;
  const day = dayKeyOf(start);
  if (day !== todayKey() && isDayLocked(day)) { toast('No room before the blocks already logged today — adjust them in the calendar', { error: true }); return null; }
  if (isDayLocked(todayKey())) setDayEntry(todayKey(), { status: 'open', closed_at: null }, { silent: true }); // logging more today reopens it
  const data = { theme: state.settings.last_theme || themes()[0]?.id, started_at: iso(start), ended_at: iso(end), source: 'manual' };
  const errs = validateSession(data); if (errs.length) { toast(errs[0].message, { error: true }); return null; }
  const s = createSession(data); Calendar.reveal(s.id);
  FocusCheck.ask(s.id, { reason: 'logged' });
  return s;
}

/* A small gold coin, used wherever credits show up. */
function coinIcon(cls = '') {
  return h('span', { class: 'coin ' + cls, 'aria-hidden': 'true', html: '<svg viewBox="0 0 20 20" width="100%" height="100%"><circle cx="10" cy="10" r="9" fill="#f5c542"/><circle cx="10" cy="10" r="9" fill="none" stroke="#b7791f" stroke-width="1.4"/><circle cx="10" cy="10" r="6.2" fill="none" stroke="#d69e2e" stroke-width="1.1"/><path d="M10 5.6l1.3 2.7 3 .4-2.2 2.1.5 2.9L10 12.3l-2.6 1.4.5-2.9-2.2-2.1 3-.4z" fill="#b7791f"/></svg>' });
}
const creditText = (n) => `${n > 0 ? '+' : ''}${fmtNum(n)} credit${Math.abs(n) === 1 ? '' : 's'}`;

const FOCUS_OPTS = [
  ['focused', 'Focused', 'In the zone', '#8bc34a'],
  ['normal', 'Normal', 'Did the job', '#e0a03a'],
  ['scattered', 'Scattered', 'Kept drifting', '#e06060'],
];

/* ---------- "How was your focus?" ---------- */
const FocusCheck = {
  current: null,
  ask(id, { reason = 'stopped', note = '', then } = {}) {
    const s = sessionById(id);
    if (!s || s.deleted_at || !s.ended_at || isTournament(s) || s.meta?.type === 'meditation') { if (then) then(); return; }
    if (this.current) this.current.close('replace');
    const tm = sessionTimes(s); const credits = blockCredits(s); const short = tm.net < MIN;
    let skipThen = false;
    const noteTa = h('textarea', { rows: 2, placeholder: 'A line about this block (optional)', maxlength: 2000, hidden: true });
    const save = (rid) => {
      const cur = sessionById(id); if (!cur) return;
      const meta = { ...(cur.meta || {}), rating: rid };
      const extra = noteTa.value.trim();
      updateSession(id, { meta, ...(extra ? { note_md: (cur.note_md ? cur.note_md.replace(/\s+$/, '') + '\n' : '') + extra } : {}) }, { undoable: false });
      m.close('rated');
      toast(credits ? `Saved · ${creditText(credits)}` : 'Saved');
    };
    const reasonLine = reason === 'switched' ? 'Closed because a new block just started.'
      : reason === 'target' ? note : reason === 'logged' ? 'Logged — one question before you go on.' : '';
    const opts = h('div', { class: 'fc-opts' }, ...FOCUS_OPTS.map(([rid, label, sub, color], i) => h('button', { class: 'fc-opt', type: 'button', style: { '--c': color }, onClick: () => save(rid) },
      h('span', { class: 'fc-bar' }), h('b', null, label), h('span', { class: 'fc-sub' }, sub), h('kbd', null, String(i + 1)))));
    const body = h('div', { class: 'stack' },
      h('div', { class: 'fc-block', style: { '--c': themeColor(s.theme) } }, h('i', { class: 'fc-dot' }),
        h('div', { class: 'grow' }, h('b', null, themeName(s.theme)), h('div', { class: 'muted small' }, `${fmtRange(tm.start, tm.end)} · ${fmtHM(tm.net / MIN)} net${tm.pauseMs >= MIN ? ` · ${fmtHM(tm.pauseMs / MIN)} of breaks` : ''}`)),
        credits ? h('span', { class: 'credit-pill' }, coinIcon(), `+${credits}`) : null),
      reasonLine ? h('p', { class: 'muted small' }, reasonLine) : null,
      opts, noteTa,
      h('div', { class: 'fc-links' },
        h('button', { class: 'btn sm ghost', type: 'button', onClick: () => { noteTa.hidden = !noteTa.hidden; if (!noteTa.hidden) noteTa.focus(); } }, icon('note'), 'Add a line'),
        h('button', { class: 'btn sm ghost', type: 'button', title: 'Change the times, theme or breaks', onClick: () => { skipThen = true; m.close('adjust'); Panel.editSession(id); } }, icon('edit'), 'Adjust block'),
        short ? h('button', { class: 'btn sm danger', type: 'button', onClick: () => { deleteSession(id); m.close('discard'); toastUndo('Block discarded — it was under a minute'); } }, 'Discard') : null,
        h('span', { class: 'grow' }),
        h('button', { class: 'btn sm ghost', type: 'button', title: 'It will be asked again when you close the day', onClick: () => m.close('later') }, 'Later')));
    const onKey = (e) => {
      if (document.activeElement === noteTa) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); } return; }
      const i = ['1', '2', '3'].indexOf(e.key); if (i >= 0) { e.preventDefault(); save(FOCUS_OPTS[i][0]); }
    };
    const m = openModal({ title: 'How was your focus?', cls: 'narrow focus-check', body,
      onClose: (why) => { document.removeEventListener('keydown', onKey, true); if (this.current === m) this.current = null; if (why !== 'replace' && !skipThen && then) setTimeout(then, 30); } });
    document.addEventListener('keydown', onKey, true);
    this.current = m;
    setTimeout(() => { const b = $('.fc-opt', m.el); if (b) b.focus(); }, 40);
  },
};

/* ---------- Closing the day ---------- */
const DayClose = {
  open: false, lastCheck: null,
  firstBlockDay() { let min = null; for (const s of state.sessions) { if (!isLive(s) || !s.ended_at) continue; const k = dayKeyOf(ms(s.started_at)); if (!min || k < min) min = k; } return min; },
  ensureSince() {
    if (state.days.since) return;
    state.days.since = addDays(todayKey(), -1); state.days.updated_at = iso(Date.now());
    dirty('settings', 'days'); persist();
  },
  /* days before today, since the feature started, that are still open (oldest first) */
  pendingDays() {
    this.ensureSince();
    const first = this.firstBlockDay(); if (!first) return [];
    const tk = todayKey(); let d = state.days.since > first ? state.days.since : first;
    if (daysBetween(d, tk) > 60) d = addDays(tk, -60); // after a long absence only the last two months are asked about
    const out = []; let guard = 0;
    for (; d < tk && guard++ < 400; d = addDays(d, 1)) if (!isDayLocked(d)) out.push(d);
    return out;
  },
  blocksOf(key) { return state.sessions.filter((s) => isLive(s) && s.ended_at && dayKeyOf(ms(s.started_at)) === key).sort((a, b) => a.started_at.localeCompare(b.started_at)); },
  /* Called on start-up (after the first sync), when the tab comes back and when the date changes. */
  check({ force = false } = {}) {
    if (this.open || Focus.isOpen() || Meditation.el || modalStack.length || runningSession()) return;
    const tk = todayKey(); if (!force && this.lastCheck === tk) return;
    this.lastCheck = tk;
    const pend = this.pendingDays();
    if (!pend.length) { hideBanner('dayclose'); return; }
    this.run(pend);
  },
  banner(pend) {
    const n = pend.length; const label = n === 1 ? (pend[0] === addDays(todayKey(), -1) ? 'Yesterday is' : `${fmtDayShort(pend[0])} is`) : `${n} days are`;
    showBanner('dayclose', { text: `${label} still open — closing takes a few seconds.`, actions: [{ label: 'Close now', primary: true, onClick: () => { hideBanner('dayclose'); this.run(this.pendingDays()); } }] });
  },
  /* Steps: each day with blocks is one step; runs of days without study are grouped in one step. */
  run(days, { manual = false } = {}) {
    if (!days.length || this.open) return;
    hideBanner('dayclose');
    const steps = [];
    for (const d of days) {
      if (this.blocksOf(d).length || isTournamentDay(d)) steps.push({ kind: 'day', day: d });
      else { const last = steps[steps.length - 1]; if (last && last.kind === 'empty') last.days.push(d); else steps.push({ kind: 'empty', days: [d] }); }
    }
    const choice = {}; // empty day -> type
    for (const st of steps) if (st.kind === 'empty') for (const d of st.days) if (isTournamentDay(addDays(d, -1))) choice[d] = 'recovery';
    const dayInput = {}; // day -> {score, note}
    let i = 0; const closedDays = [];
    const body = h('div', { class: 'dc' }); const foot = h('div', { class: 'row between', style: { width: '100%' } });
    this.open = true;
    const m = openModal({ title: '', cls: 'dayclose', body, footer: foot, onClose: (why) => {
      this.open = false;
      if (why !== 'done' && !manual) { const rest = this.pendingDays(); if (rest.length) this.banner(rest); }
    } });
    const closeDay = (d, type) => { // only what was actually answered is written, so nothing set elsewhere gets blanked
      const inp = dayInput[d] || {}; const note = (inp.note || '').trim();
      setDayEntry(d, { status: 'closed', closed_at: iso(Date.now()), type: type || (this.blocksOf(d).length || isTournamentDay(d) ? 'study' : 'skipped'), ...(inp.score ? { score: inp.score } : {}), ...(note ? { note } : {}) });
      closedDays.push(d);
    };
    const next = () => { i++; if (i >= steps.length) summary(); else render(); };
    const dots = () => steps.length > 1 ? h('div', { class: 'wiz-steps' }, ...steps.map((_, n) => h('i', { class: n === i ? 'on' : n < i ? 'past' : '' }))) : null;
    const render = () => {
      const st = steps[i];
      if (st.kind === 'day') renderDay(st.day); else renderEmpty(st.days);
      if (steps.length - i > 2 && !manual) foot.prepend(h('button', { class: 'btn sm ghost', title: 'Close every remaining day as it is', onClick: () => { for (let n = i; n < steps.length; n++) { const s2 = steps[n]; if (s2.kind === 'day') closeDay(s2.day); else s2.days.forEach((d) => closeDay(d, choice[d] || 'skipped')); } i = steps.length; summary(); } }, 'Close the rest as they are'));
    };
    const renderDay = (d) => {
      const list = this.blocksOf(d); const tot = netByDay(d, d).get(d)?.net || 0; const inp = (dayInput[d] ||= {});
      const unrated = list.filter((s) => !isTournament(s) && s.meta?.type !== 'meditation' && !s.meta?.rating).length;
      const nb = list.filter((s) => !isTournament(s)).length;
      const row = (s) => {
        const tm = sessionTimes(s); const t = isTournament(s); const med = s.meta?.type === 'meditation';
        const flags = [];
        if (s.meta?.autoclosed) flags.push('closed automatically — check the end');
        else if (tm.net >= 3 * HOUR) flags.push('long block — right?');
        const endIn = flags.length ? h('input', { type: 'time', value: hm(tm.end), step: 60, 'aria-label': 'End time', onChange: (e) => {
          const [eh, em] = String(e.target.value || '').split(':').map(Number); if (!Number.isFinite(eh) || !Number.isFinite(em)) return;
          const base = parseYmd(dayKeyOf(tm.start));
          let end = new Date(base.getFullYear(), base.getMonth(), base.getDate(), eh, em).getTime(); if (end <= tm.start) end += DAY;
          const pauses = (s.pauses || []).filter((p) => ms(p.start) < end).map((p) => ({ start: p.start, end: p.end && ms(p.end) > end ? iso(end) : p.end }));
          const meta = { ...(s.meta || {}) }; delete meta.autoclosed; delete meta.autoclosed_reason;
          const errs = validateSession({ ...s, ended_at: iso(end), pauses }, s.id); if (errs.length) { toast(errs[0].message, { error: true }); renderDay(d); return; }
          updateSession(s.id, { ended_at: iso(end), pauses, meta }); toast('End time fixed'); renderDay(d);
        } }) : null;
        const rate = t || med ? h('span', { class: 'faint small' }, t ? 'tournament' : 'meditation')
          : h('div', { class: 'dc-rate' + (s.meta?.rating ? '' : ' need') }, ...FOCUS_OPTS.map(([rid, label, , color]) => h('button', { type: 'button', class: 'rate' + (s.meta?.rating === rid ? ' on' : ''), style: { '--c': color }, title: label, onClick: () => { const meta = { ...(sessionById(s.id).meta || {}), rating: rid }; updateSession(s.id, { meta }, { undoable: false }); renderDay(d); } }, label)));
        return h('div', { class: 'dc-row' + (flags.length ? ' flag' : ''), style: { '--c': t ? TOURNAMENT_THEME.color : themeColor(s.theme) } },
          h('i', { class: 'bar' }),
          h('div', { class: 'grow' }, h('div', null, h('b', null, t ? s.meta?.tournament_name || 'Tournament' : themeName(s.theme)), h('span', { class: 'muted small' }, ` ${fmtRange(tm.start, tm.end)} · ${fmtHM(tm.net / MIN)}`)),
            flags.length ? h('div', { class: 'dc-flag small' }, '⚠ ', flags[0], ' ', endIn) : null),
          rate);
      };
      const scores = h('div', { class: 'dc-score' }, ...[1, 2, 3, 4, 5].map((n) => h('button', { type: 'button', class: 'sc' + (inp.score === n ? ' on' : ''), onClick: () => { inp.score = inp.score === n ? null : n; renderDay(d); } }, String(n))));
      const noteIn = h('input', { type: 'text', maxlength: 200, placeholder: 'What worked, what got in the way… (optional)', value: inp.note || '', onInput: (e) => { inp.note = e.target.value; } });
      setKids(body, dots(),
        h('div', { class: 'dc-head' }, h('h3', null, d === addDays(todayKey(), -1) ? `Close yesterday · ${fmtDayLong(d)}` : d === todayKey() ? `Close today · ${fmtDayLong(d)}` : `Close ${fmtDayLong(d)}`),
          h('div', { class: 'muted small' }, [fmtHM(tot / MIN), nb ? `${nb} block${nb === 1 ? '' : 's'}` : null, list.some(isTournament) ? 'tournament day' : null, unrated ? `${unrated} without a focus rating` : null].filter(Boolean).join(' · '))),
        h('div', { class: 'dc-list' }, ...list.map(row)),
        h('div', { class: 'dc-extra' }, h('div', { class: 'field inline' }, h('span', null, 'How was the day? (optional)'), scores), noteIn));
      setKids(foot, h('button', { class: 'btn', onClick: () => m.close('later') }, 'Later'),
        h('button', { class: 'btn primary', onClick: () => { closeDay(d); next(); } }, icon('check-outline'), unrated ? `Close day (${unrated} unrated)` : 'Close day'));
    };
    const renderEmpty = (list) => {
      setKids(body, dots(),
        h('div', { class: 'dc-head' }, h('h3', null, list.length === 1 ? `No study on ${fmtDayLong(list[0])}` : `No study on ${list.length} days`),
          h('div', { class: 'muted small' }, 'What kind of day was it? Rest, travel and recovery keep your streak; skipped days don’t.')),
        h('div', { class: 'dc-list' }, ...list.map((d) => h('div', { class: 'dc-row empty' }, h('b', { class: 'grow' }, fmtDayShort(d)),
          segmented(DAY_TYPES, choice[d] || null, (v) => { choice[d] = v; }, 'sm')))));
      setKids(foot, h('button', { class: 'btn', onClick: () => m.close('later') }, 'Later'),
        h('button', { class: 'btn primary', onClick: () => { list.forEach((d) => closeDay(d, choice[d] || 'skipped')); next(); } }, 'Continue'));
    };
    const summary = () => {
      const withStudy = closedDays.filter((d) => netByDay(d, d).get(d)?.net > 0);
      const d = withStudy[withStudy.length - 1] || closedDays[closedDays.length - 1];
      setKids(body, this.summaryView(d, closedDays));
      setKids(foot, h('a', { class: 'btn', href: '#/achievements', onClick: () => m.close('done') }, coinIcon(), 'Decorate your room'), h('button', { class: 'btn primary', onClick: () => m.close('done') }, 'Done'));
      emit('dayclosed', closedDays);
    };
    render();
  },
  /* The short read after closing: plain numbers, no judgement. */
  summaryView(d, closedDays = [d]) {
    if (!d) return h('p', { class: 'muted' }, 'Nothing to close.');
    const tk = todayKey(); const rel = d === addDays(tk, -1) ? 'Yesterday' : d === tk ? 'Today' : fmtDayShort(d);
    const map = netByDay(addDays(d, -7), d); const tot = (map.get(d)?.net || 0) / MIN;
    const prevDays = Array.from({ length: 7 }, (_, n) => addDays(d, -(n + 1))).filter((k) => !NEUTRAL_DAYS.has(dayType(k)));
    const avg = prevDays.length ? prevDays.reduce((a, k) => a + (map.get(k)?.net || 0), 0) / prevDays.length / MIN : 0;
    const f = focusStats(d, d); const fPrev = focusStats(addDays(d, -7), addDays(d, -1));
    const themeRows = Array.from(map.get(d)?.byTheme || []).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const late = lateByDay(d, d).get(d) || 0;
    const medDone = meditationDaySet().has(d); const mw = meditationWeek(weekStartKey(d));
    const sk = streakInfo(); const type = dayType(d); const e = dayEntry(d) || {};
    const credits = Credits.forDay(d);
    const line = (ic, ...kids) => h('li', null, h('span', { class: 'dc-ic' }, ic), h('span', null, ...kids));
    const diff = tot - avg;
    const items = [];
    if (tot > 0) {
      items.push(line(icon('clock'), h('b', null, `${rel} you studied ${fmtHMlong(tot)}.`), avg > 0 ? ` The 7 days before averaged ${fmtHMlong(avg)} a day (${diff >= 0 ? '+' : '−'}${fmtHM(Math.abs(diff))}).` : ''));
      if (f.total) items.push(line(icon('focus'), f.rated ? `Focus: ${f.focused} of ${f.rated} rated block${f.rated === 1 ? '' : 's'} focused (${Math.round(f.share * 100)}%)` : 'No block was rated for focus', fPrev.rated >= 3 ? ` · last 7 days ${Math.round(fPrev.share * 100)}%.` : '.'));
      if (themeRows.length) items.push(line(icon('bar-chart'), 'Most time: ', ...themeRows.flatMap(([k, v], n) => [n ? ', ' : '', h('b', { style: { color: themeColor(k === '__none' ? null : k) } }, themeName(k === '__none' ? null : k)), ` ${fmtHM(v / MIN)}`]), '.'));
    } else {
      const lbl = { rest: 'a rest day', travel: 'a travel day', recovery: 'a recovery day' }[type] || 'no study';
      items.push(line(icon('clock'), h('b', null, `${rel}: ${lbl}.`), NEUTRAL_DAYS.has(type) ? ' Your streak is kept.' : ''));
    }
    if (late >= 1) items.push(line(icon('eye'), `Noted: ${fmtHM(late)} of study after ${state.settings.late_from || '23:00'}.`));
    items.push(line(icon('brain'), medDone ? 'Meditated ✓' : 'No meditation that day', ` · ${mw.count} of ${mw.goal} days this week${mw.met ? ' — goal met' : ''}.`));
    items.push(line(icon('fire'), `Streak: ${sk.current} day${sk.current === 1 ? '' : 's'}${sk.best > sk.current ? ` (best ${sk.best})` : ''}.`));
    if (e.score) items.push(line(icon('star'), `You gave the day ${e.score}/5.`));
    return h('div', { class: 'stack' },
      h('div', { class: 'dc-done' }, h('span', { class: 'dc-check', html: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>' }), h('div', null, h('h3', null, closedDays.length > 1 ? `${closedDays.length} days closed` : 'Day closed'), h('div', { class: 'muted small' }, fmtDayLong(d)))),
      h('ul', { class: 'dc-sum' }, ...items),
      credits ? h('div', { class: 'dc-credits' }, coinIcon('lg'), h('b', null, creditText(credits)), h('span', { class: 'muted small' }, `for ${rel.toLowerCase() === 'today' ? 'today' : rel === 'Yesterday' ? 'yesterday' : fmtDayShort(d)} · balance ${fmtNum(Credits.get().balance)}`)) : null);
  },
};
function isTournamentDay(key) { return state.sessions.some((s) => isLive(s) && isTournament(s) && dayKeyOf(ms(s.started_at)) === key); }
