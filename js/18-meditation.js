/* ===== Meditation — guided breathing, adapted from the "Respire" module ===== */
const BREATH_PATTERNS = [
  { id: '46', name: '4-6 Breathing', cat: 'Calm', color: '#22D3EE', badge: 'recommended',
    tag: 'Exhale slower than you inhale — the body’s natural brake.',
    how: 'At this pace you breathe about six times a minute, the rhythm of cardiac coherence: the heart slows a little on every exhale.',
    ph: [['inhale', 4], ['exhale', 6]] },
  { id: 'slow', name: 'Slow down', cat: 'Calm', color: '#60A5FA',
    tag: 'A quick, discreet decompression for anywhere.',
    how: 'Breathing out for twice as long as you breathe in lowers the alert system without demanding much air.',
    ph: [['inhale', 3], ['exhale', 6]] },
  { id: 'calm', name: '4-7-8', cat: 'Calm', color: '#A78BFA',
    tag: 'Dr. Andrew Weil’s “natural tranquilliser”.',
    how: 'The seven-second hold lets oxygen circulate and the long exhale strongly engages the vagus nerve.',
    ph: [['inhale', 4], ['hold-full', 7], ['exhale', 8]], note: 'Slight dizziness is possible at first — practise seated.' },
  { id: 'box', name: 'Box breathing', cat: 'Focus', color: '#34D399',
    tag: 'Composure under pressure — the Navy SEAL pattern.',
    how: 'Four equal phases stabilise the breathing rhythm and CO₂ levels; each side of the box is a handle for attention.',
    ph: [['inhale', 4], ['hold-full', 4], ['exhale', 4], ['hold-empty', 4]] },
  { id: 'balance', name: 'Even rhythm', cat: 'Focus', color: '#F472B6',
    tag: 'Simple and symmetrical — the way in.',
    how: 'Breathing in and out for the same time balances both branches of the nervous system: it neither speeds up nor brakes.',
    ph: [['inhale', 3], ['exhale', 3]] },
  { id: 'wake', name: 'Wake up', cat: 'Energy', color: '#FB923C',
    tag: 'A breathing espresso, in under a minute.',
    how: 'The quick rhythm gently stimulates the sympathetic system and raises alertness — energy without caffeine.',
    ph: [['inhale', 1], ['exhale', 1]], note: 'Can cause light-headedness: sit down and stop if you feel uncomfortable.' },
  { id: 'deep', name: 'Deep 10-10', cat: 'Advanced', color: '#818CF8',
    tag: 'Long cycles that train the diaphragm.',
    how: 'Long cycles demand the full diaphragm and raise CO₂ tolerance; over time your resting breath slows down by itself.',
    ph: [['inhale', 10], ['exhale', 10]], note: 'If ten seconds is too much, start with 4-6 and work up.' },
];
const PHASE_LABEL = { inhale: 'Breathe in', 'hold-full': 'Hold', exhale: 'Breathe out', 'hold-empty': 'Hold' };
const PHASE_HINT = { inhale: 'through your nose', 'hold-full': 'lungs full', exhale: 'slowly, through your mouth', 'hold-empty': 'lungs empty' };
const MED_LENGTHS = [2, 5, 10];

const Meditation = {
  el: null, timer: null, raf: null, session: null, state: null,
  patternById(id) { return BREATH_PATTERNS.find((p) => p.id === id) || BREATH_PATTERNS[0]; },
  cycleSeconds(p) { return p.ph.reduce((a, x) => a + x[1], 0); },

  /* ---- chooser ---- */
  open(quickMinutes) {
    if (runningSession()) { toast('Stop the running block first', { error: true }); return; }
    if (quickMinutes) { this.start(this.patternById(state.settings.med_pattern || '46'), quickMinutes); return; }
    let pick = this.patternById(state.settings.med_pattern || '46');
    let minutes = state.settings.med_minutes || 5;
    const body = h('div', { class: 'stack' });
    const foot = h('div', { class: 'row between', style: { width: '100%' } });
    const m = openModal({ title: 'Meditation', cls: 'narrow', body, footer: foot });
    const render = () => {
      const cycles = Math.max(1, Math.round((minutes * 60) / this.cycleSeconds(pick)));
      setKids(body,
        h('div', { class: 'med-list' }, ...BREATH_PATTERNS.map((p) => h('button', { class: 'med-item' + (p.id === pick.id ? ' on' : ''), style: { '--c': p.color }, onClick: () => { pick = p; render(); } },
          h('span', { class: 'med-dot' }),
          h('span', { class: 'grow' }, h('b', null, p.name), p.badge ? h('span', { class: 'tag ok' }, p.badge) : null, h('div', { class: 'muted small' }, p.tag)),
          h('span', { class: 'med-sp num' }, p.ph.map((x) => x[1]).join('-'))))),
        h('div', { class: 'field' }, h('span', null, 'How long'),
          h('div', { class: 'chips' }, ...MED_LENGTHS.map((n) => h('button', { class: 'chip' + (minutes === n ? ' on' : ''), style: { '--c': '#8bc34a', '--ink': '#10200a' }, onClick: () => { minutes = n; render(); } }, `${n} min`)),
            h('button', { class: 'chip' + (![2, 5, 10].includes(minutes) ? ' on' : ''), style: { '--c': '#8a9bb3', '--ink': '#fff' }, onClick: () => { const v = prompt('Minutes?', String(minutes)); if (v) { minutes = clamp(+v || 5, 1, 60); render(); } } }, 'Other'))),
        h('div', { class: 'wiz-summary' }, h('b', null, pick.name), h('span', null, `${cycles} cycles · ${fmtHM(minutes)} · ${pick.ph.map(([t, d]) => `${PHASE_LABEL[t].toLowerCase()} ${d}s`).join(' · ')}`)),
        h('p', { class: 'muted small' }, pick.how), pick.note ? h('p', { class: 'hint warn' }, pick.note) : null);
      setKids(foot, h('span', { class: 'muted small' }, 'Counts as study time'),
        h('button', { class: 'btn primary lg', onClick: () => { m.close(); this.start(pick, minutes); } }, icon('play'), 'Begin'));
    };
    render();
  },

  /* ---- practice ---- */
  start(pattern, minutes) {
    updateSettings({ med_pattern: pattern.id, med_minutes: minutes });
    const cycles = Math.max(1, Math.round((minutes * 60) / this.cycleSeconds(pattern)));
    this.state = { pattern, cycles, cycle: 0, phase: 0, phaseStart: 0, startedAt: nowMs(), paused: false, pausedAt: 0, pausedTotal: 0, done: false };
    this.mount();
    this.tickPhase(true);
    this.timer = setInterval(() => this.tick(), 100);
  },
  mount() {
    const st = this.state; const p = st.pattern;
    const orb = h('div', { class: 'med-orb', id: 'med-orb' }, h('div', { class: 'med-orb-in' }));
    this.el = h('div', { class: 'med', style: { '--c': p.color } },
      h('div', { class: 'med-top' }, h('span', { class: 'muted small' }, p.name), h('button', { class: 'btn sm ghost', onClick: () => this.stop(false) }, 'Exit')),
      h('div', { class: 'med-center' },
        h('div', { class: 'med-count num', id: 'med-count' }, '3'),
        orb,
        h('div', { class: 'med-phase', id: 'med-phase' }, 'Get comfortable…'),
        h('div', { class: 'med-hint', id: 'med-hint' }, 'starting in a moment'),
        h('div', { class: 'med-cycles', id: 'med-cycles' }, '')),
      h('div', { class: 'med-bar' }, h('i', { id: 'med-progress' })),
      h('div', { class: 'med-actions' },
        h('button', { class: 'btn', id: 'med-pause', onClick: () => this.togglePause() }, icon('pause'), 'Pause'),
        h('button', { class: 'btn', onClick: () => this.stop(true) }, icon('check'), 'Finish')));
    document.body.append(this.el);
    document.body.classList.add('med-open');
    this._onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); this.stop(false); } else if (e.key === ' ') { e.preventDefault(); this.togglePause(); } };
    document.addEventListener('keydown', this._onKey, true);
    this.prepUntil = nowMs() + 3000;
  },
  tickPhase(first) {
    const st = this.state; const ph = st.pattern.ph[st.phase];
    st.phaseStart = nowMs();
    const orb = $('#med-orb', this.el); if (!orb) return;
    const [kind, secs] = ph;
    $('#med-phase', this.el).textContent = PHASE_LABEL[kind];
    $('#med-hint', this.el).textContent = PHASE_HINT[kind];
    $('#med-cycles', this.el).textContent = `cycle ${st.cycle + 1} of ${st.cycles}`;
    orb.style.transitionDuration = secs + 's';
    orb.classList.toggle('hold', kind.startsWith('hold'));
    orb.style.transform = `scale(${kind === 'inhale' ? 1 : kind === 'exhale' ? 0.45 : (st.pattern.ph[st.phase - 1] || ['inhale'])[0] === 'inhale' ? 1 : 0.45})`;
    if (state.settings.sound && !first) playBell(true);
  },
  tick() {
    const st = this.state; if (!st || st.paused) return;
    const now = nowMs();
    if (this.prepUntil && now < this.prepUntil) { $('#med-count', this.el).textContent = String(Math.ceil((this.prepUntil - now) / 1000)); return; }
    if (this.prepUntil) { this.prepUntil = 0; $('#med-count', this.el).textContent = ''; st.phaseStart = now; this.tickPhase(true); }
    const [, secs] = st.pattern.ph[st.phase];
    const left = secs - (now - st.phaseStart) / 1000;
    $('#med-count', this.el).textContent = String(Math.max(1, Math.ceil(left)));
    const total = st.cycles * this.cycleSeconds(st.pattern);
    const done = st.cycle * this.cycleSeconds(st.pattern) + st.pattern.ph.slice(0, st.phase).reduce((a, x) => a + x[1], 0) + (secs - Math.max(0, left));
    $('#med-progress', this.el).style.width = clamp(done / total, 0, 1) * 100 + '%';
    if (left > 0) return;
    st.phase++;
    if (st.phase >= st.pattern.ph.length) { st.phase = 0; st.cycle++; }
    if (st.cycle >= st.cycles) { this.stop(true); return; }
    this.tickPhase();
  },
  togglePause() {
    const st = this.state; if (!st) return;
    st.paused = !st.paused;
    const btn = $('#med-pause', this.el);
    if (st.paused) { st.pausedAt = nowMs(); setKids(btn, icon('play'), 'Resume'); $('#med-phase', this.el).textContent = 'Paused'; }
    else { st.pausedTotal += nowMs() - st.pausedAt; st.phaseStart += nowMs() - st.pausedAt; setKids(btn, icon('pause'), 'Pause'); this.tickPhase(true); }
  },
  /* Finishing logs the practice as a study block with the Meditation theme. */
  stop(completed) {
    const st = this.state; if (!st) return;
    clearInterval(this.timer); this.timer = null;
    document.removeEventListener('keydown', this._onKey, true);
    const end = Math.round(nowMs()); const start = Math.round(st.startedAt);
    const minutes = (end - start) / MIN;
    this.el.remove(); this.el = null; this.state = null; document.body.classList.remove('med-open');
    if (minutes < 0.5) { toast('Too short to log'); return; }
    const theme = ensureMeditationTheme();
    const fit = Calendar.fitMove(start, end);
    const s = createSession({ theme, started_at: iso(fit.start), ended_at: iso(fit.end), source: 'timer',
      meta: { type: 'meditation', pattern: st.pattern.id, cycles: completed ? st.cycles : st.cycle, completed: !!completed } });
    Achievements.check('MEDITATION_DONE');
    hideBanner('meditate');
    this.summary(s, st, completed);
  },
  summary(s, st, completed) {
    const tm = sessionTimes(s);
    const quotes = ['Your nervous system thanks you.', 'Take that rhythm with you.', 'A moment of calm changes the rest of the day.', 'Come back whenever you need it.'];
    const m = openModal({ title: completed ? 'Session complete' : 'Session saved', cls: 'narrow',
      body: h('div', { class: 'stack' },
        h('div', { class: 'summary' },
          h('div', null, h('b', null, fmtHM(tm.net / MIN)), h('span', null, 'practised')),
          h('div', null, h('b', null, String(completed ? st.cycles : st.cycle)), h('span', null, 'cycles')),
          h('div', null, h('b', null, st.pattern.ph.map((x) => x[1]).join('-')), h('span', null, st.pattern.name))),
        h('p', { class: 'muted center' }, quotes[Math.floor(Math.random() * quotes.length)]),
        h('p', { class: 'muted small center' }, 'Logged under Meditation — it counts towards your study time.')),
      footer: frag(h('button', { class: 'btn', onClick: () => { m.close(); Panel.editSession(s.id); } }, 'Add a note'),
        h('button', { class: 'btn primary', onClick: () => m.close() }, 'Done')) });
  },
};

/* The Meditation theme is created once; deleting it in Settings keeps it deleted. */
function ensureMeditationTheme() {
  const existing = themes().find((t) => t.id === 'meditation');
  if (existing) return existing.id;
  upsertTheme({ id: 'meditation', name: 'Meditation', color: '#7dd3fc' });
  return 'meditation';
}
/* Minutes and day streak of meditation, for reminders and achievements */
function meditationStats() {
  const list = activeSessions().filter((s) => s.meta?.type === 'meditation');
  const days = new Set(list.map((s) => dayKeyOf(ms(s.started_at))));
  let streak = 0; let d = todayKey();
  if (!days.has(d)) d = addDays(d, -1);
  while (days.has(d)) { streak++; d = addDays(d, -1); }
  return { count: list.length, minutes: list.reduce((a, s) => a + sessionTimes(s).net / MIN, 0), today: days.has(todayKey()), days: days.size, streak };
}
