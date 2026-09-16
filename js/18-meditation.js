/* ===== Meditation — guided breathing, ported from the "Respire" module ===== */
const MED_CATS = [
  ['calm', 'To calm down', 'Slow the body, quiet the head'],
  ['focus', 'To focus', 'Steady the rhythm before you study'],
  ['energy', 'To wake up', 'A short lift without caffeine'],
  ['wim', 'Wim Hof method', 'Intense rounds — read the warning first'],
  ['adv', 'Advanced', 'Long cycles, for trained lungs'],
];
const BREATH_PATTERNS = [
  { id: '46', cat: 'calm', color: '#22D3EE', badge: 'recommended', name: '4-6 Breathing',
    tag: 'Exhale slower than you inhale — the body’s natural brake.',
    how: 'At this pace you breathe about six times a minute, the rhythm of cardiac coherence: the heart slows a little on every exhale.',
    when: 'Before sleep · peak stress · daily practice', ph: [['inhale', 4], ['exhale', 6]], rc: 12 },
  { id: 'slow', cat: 'calm', color: '#60A5FA', name: 'Slow down',
    tag: 'A quick, discreet decompression for anywhere.',
    how: 'Breathing out for twice as long as you breathe in lowers the alert system, and the short inhale asks nothing of you.',
    when: 'In traffic · a break at work · queues', ph: [['inhale', 3], ['exhale', 6]], rc: 8 },
  { id: 'calm', cat: 'calm', color: '#A78BFA', name: 'Anti-anxiety 4-7-8',
    tag: 'Dr. Andrew Weil’s “natural tranquilliser”.',
    how: 'The seven-second hold lets oxygen circulate and the long exhale strongly engages the vagus nerve.',
    when: 'Insomnia · racing thoughts · waking at night', ph: [['inhale', 4], ['hold-full', 7], ['exhale', 8]], rc: 4,
    note: 'Slight dizziness is possible at first. Practise seated or lying down.' },
  { id: 'box', cat: 'focus', color: '#34D399', name: 'Box breathing',
    tag: 'Composure under pressure — the Navy SEAL pattern.',
    how: 'Four equal phases stabilise the breathing rhythm and CO₂ levels; each side of the box is a handle for attention.',
    when: 'Before presenting · exams · regaining focus', ph: [['inhale', 4], ['hold-full', 4], ['exhale', 4], ['hold-empty', 4]], rc: 6 },
  { id: 'balance', cat: 'focus', color: '#F472B6', name: 'Even rhythm',
    tag: 'Simple and symmetrical — the way in.',
    how: 'Breathing in and out for the same time balances both branches of the nervous system: it neither speeds up nor brakes.',
    when: 'Any time of day · start of a meditation', ph: [['inhale', 3], ['exhale', 3]], rc: 15 },
  { id: 'wake', cat: 'energy', color: '#FB923C', name: 'Wake up',
    tag: 'A breathing espresso, in under a minute.',
    how: 'The quick rhythm gently stimulates the sympathetic system and raises alertness — a light version of yoga’s bhastrika.',
    when: 'On waking · afternoon slump · before training', ph: [['inhale', 1], ['exhale', 1]], rc: 20,
    note: 'Can cause light-headedness: sit down and stop if you feel uncomfortable.' },
  { id: 'wimhof', cat: 'wim', color: '#FBBF24', badge: 'intense', wh: true, name: 'Wim Hof method',
    tag: 'Rounds of deep breathing and retention — energy and focus.',
    how: 'Thirty quick, full breaths lower CO₂; the retention that follows is comfortable and trains tolerance. Recovery brings you back.',
    when: 'Morning · before cold exposure · before hard training', ph: [], rc: 3,
    note: 'Never in water, while driving, standing or operating machinery. Avoid in pregnancy, epilepsy or heart conditions.' },
  { id: 'deep', cat: 'adv', color: '#818CF8', name: 'Deep 10-10',
    tag: 'Long cycles that train the diaphragm.',
    how: 'Long cycles demand the full diaphragm and raise CO₂ tolerance; over time your resting breath slows down by itself.',
    when: 'Long meditation · end of the day', ph: [['inhale', 10], ['exhale', 10]], rc: 20,
    note: 'Advanced: if ten seconds is too much, start with 4-6 and work up.' },
];
const PHASE_LABEL = { inhale: 'Inhale', 'hold-full': 'Hold', exhale: 'Exhale', 'hold-empty': 'Hold' };
const PHASE_HINT = { inhale: 'Breathe in through your nose', 'hold-full': 'Hold, lungs full', exhale: 'Release slowly through your mouth', 'hold-empty': 'Stay empty, wait' };
/* scale range of the orb per phase, exactly as in the original */
const PHASE_SCALE = { inhale: { from: 0.35, to: 1 }, 'hold-full': { from: 1, to: 1 }, exhale: { from: 1, to: 0.35 }, 'hold-empty': { from: 0.35, to: 0.35 } };
const MED_LENGTHS = [2, 5, 10];
const WH_PACES = { slow: [3, 3], normal: [2, 2], fast: [1.5, 1.5] };
const MED_QUOTES = ['Your nervous system thanks you.', 'Take that rhythm with you.', 'A moment of calm changes the rest of the day.', 'Come back whenever you need it.', 'Breathing well is a quiet superpower.'];

function medTone(freq, dur = 0.12, vol = 0.06) {
  if (!state.settings.sound) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq; g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + dur);
    setTimeout(() => ctx.close(), (dur + 0.2) * 1000);
  } catch { /* */ }
}
const fmtSecs = (s) => `${Math.floor(s / 60)}:${pad2(Math.floor(s % 60))}`;

const Meditation = {
  el: null, raf: null, to: null, iv: null, st: null, wh: null, patternById(id) { return BREATH_PATTERNS.find((p) => p.id === id) || BREATH_PATTERNS[0]; },
  cycleSeconds(p) { return p.ph.reduce((a, x) => a + x[1], 0); },

  /* ---------- chooser ---------- */
  open(quickMinutes) {
    if (runningSession()) { toast('Stop the running block first', { error: true }); return; }
    if (quickMinutes) { this.start(this.patternById(state.settings.med_pattern || '46'), quickMinutes); return; }
    let pick = this.patternById(state.settings.med_pattern || '46');
    let minutes = state.settings.med_minutes || 5;
    const body = h('div', { class: 'stack' });
    const foot = h('div', { class: 'row between', style: { width: '100%' } });
    const m = openModal({ title: 'Meditation', cls: 'med-modal', body, footer: foot });
    const render = () => {
      setKids(body, ...MED_CATS.map(([cat, label, sub]) => {
        const items = BREATH_PATTERNS.filter((p) => p.cat === cat); if (!items.length) return null;
        return h('div', { class: 'med-cat' }, h('div', { class: 'med-cat-h' }, h('b', null, label), h('span', { class: 'faint small' }, sub)),
          ...items.map((p) => h('button', { class: 'med-item' + (p.id === pick.id ? ' on' : ''), style: { '--c': p.color }, onClick: () => { pick = p; render(); } },
            h('span', { class: 'med-dot' }),
            h('span', { class: 'grow' }, h('span', { class: 'row' }, h('b', null, p.name), p.badge ? h('span', { class: 'tag ' + (p.badge === 'intense' ? 'bad' : 'ok') }, p.badge) : null),
              h('div', { class: 'muted small' }, p.tag)),
            h('span', { class: 'med-sp num' }, p.wh ? '30 × 3' : p.ph.map((x) => x[1]).join('-')))));
      }),
        h('div', { class: 'med-detail', style: { '--c': pick.color } },
          h('b', null, pick.name), h('p', { class: 'muted small' }, pick.how),
          h('p', { class: 'faint small' }, pick.when), pick.note ? h('p', { class: 'hint warn' }, pick.note) : null,
          pick.wh ? this.whControls(() => render()) : h('div', { class: 'field' }, h('span', null, 'How long'),
            h('div', { class: 'chips' }, ...MED_LENGTHS.map((n) => h('button', { class: 'chip' + (minutes === n ? ' on' : ''), style: { '--c': '#8bc34a', '--ink': '#10200a' }, onClick: () => { minutes = n; render(); } }, `${n} min`)),
              h('button', { class: 'chip' + (!MED_LENGTHS.includes(minutes) ? ' on' : ''), style: { '--c': '#8a9bb3', '--ink': '#fff' }, onClick: () => { const v = prompt('Minutes?', String(minutes)); if (v) { minutes = clamp(+v || 5, 1, 60); render(); } } }, 'Other')))));
      const cycles = pick.wh ? 0 : Math.max(1, Math.round((minutes * 60) / this.cycleSeconds(pick)));
      setKids(foot, h('span', { class: 'muted small' }, pick.wh ? `${state.settings.wh_rounds || 3} rounds · ${state.settings.wh_breaths || 30} breaths` : `${cycles} cycles · ${fmtHM(minutes)}`),
        h('button', { class: 'btn primary lg med-start', onClick: () => { m.close(); pick.wh ? this.whIntro() : this.start(pick, minutes); } }, icon('play'), 'Begin'));
    };
    render();
  },
  whControls(refresh) {
    const s = state.settings;
    const num = (label, key, min, max, step) => h('label', { class: 'field inline' }, h('span', null, label),
      h('input', { type: 'number', min, max, step, value: s[key], style: { width: '80px' }, onChange: (e) => { updateSettings({ [key]: clamp(+e.target.value || min, min, max) }); refresh(); } }));
    return h('div', { class: 'stack sm' }, num('Rounds', 'wh_rounds', 1, 6, 1), num('Breaths per round', 'wh_breaths', 20, 50, 5),
      h('label', { class: 'field inline' }, h('span', null, 'Pace'), h('select', { style: { width: 'auto' }, onChange: (e) => { updateSettings({ wh_pace: e.target.value }); refresh(); } },
        ...Object.keys(WH_PACES).map((k) => h('option', { value: k, selected: k === (s.wh_pace || 'normal') }, k)))));
  },
  whIntro() {
    const p = this.patternById('wimhof');
    const m = openModal({ title: 'Before you start', cls: 'narrow',
      body: h('div', { class: 'stack' },
        h('p', null, 'The Wim Hof method is intense: dizziness, tingling and light-headedness are normal — fainting is possible.'),
        h('p', null, 'Practise only sitting or lying down, somewhere safe.'),
        h('p', null, 'Never in water, while driving, standing or operating machinery.'),
        h('p', null, 'Avoid it in pregnancy, epilepsy or heart conditions — when in doubt, talk to a doctor.')),
      footer: frag(h('button', { class: 'btn', onClick: () => m.close() }, 'Not now'),
        h('button', { class: 'btn primary', onClick: () => { m.close(); this.whStart(p); } }, 'I understand and accept')) });
  },

  /* ---------- shared screen ---------- */
  mount(pattern, extra) {
    const ring = 2 * Math.PI * 118;
    this.ringLen = ring;
    const stage = h('div', { class: 'cw' },
      h('div', { class: 'halo h1' }), h('div', { class: 'halo h2' }),
      h('div', { class: 'orbits' }, ...[0, 120, 240].map((a) => h('i', { class: 'odot', style: { transform: `rotate(${a}deg) translateX(132px)` } }))),
      h('div', { class: 'med-glow', id: 'med-glow' }),
      h('div', { class: 'bu', id: 'med-orb' }, h('div', { class: 'bh' })),
      h('svg', { class: 'sr', viewBox: '0 0 250 250', html: `<circle class="rb" cx="125" cy="125" r="118"/><circle class="rf" id="med-ring" cx="125" cy="125" r="118" stroke="${pattern.color}" stroke-dasharray="${ring}" stroke-dashoffset="${ring}"/>` }),
      h('div', { class: 'ct' }, h('div', { class: 'cr2 num', id: 'med-num' }, '3'), h('div', { class: 'clb', id: 'med-lbl' }, '')));
    this.el = h('div', { class: 'med', style: { '--ac': pattern.color } },
      h('div', { class: 'med-aurora' }, h('i'), h('i'), h('i')),
      h('div', { class: 'tb' }, h('button', { class: 'bt', onClick: () => this.exit() }, '✕ Exit'),
        h('div', { class: 'tbr' }, h('span', { class: 'ti', id: 'med-elapsed' }, '0:00'), extra?.pause !== false ? h('button', { class: 'bt', id: 'med-pause', onClick: () => this.togglePause() }, '⏸ Pause') : null)),
      h('div', { class: 'bc2' },
        h('div', { class: 'bname', id: 'med-name' }, pattern.name),
        h('div', { class: 'bi', id: 'med-instr' }, 'Find a comfortable position…'),
        stage,
        h('div', { class: 'pds', id: 'med-pills' }),
        h('div', { class: 'med-info', id: 'med-info' }, ''),
        h('div', { class: 'med-cta', id: 'med-cta' })),
      h('div', { class: 'bb' }, h('div', { class: 'pt' }, h('div', { class: 'pf', id: 'med-progress', style: { background: pattern.color } })),
        h('div', { class: 'pl2' }, h('span', { id: 'med-left' }, ''), h('span', { id: 'med-total' }, ''))));
    document.body.append(this.el);
    document.body.classList.add('med-open');
    this._onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); this.exit(); }
      else if (e.key === ' ' && this.st) { e.preventDefault(); this.togglePause(); }
    };
    document.addEventListener('keydown', this._onKey, true);
  },
  setPills(pattern, active) {
    const box = $('#med-pills', this.el); if (!box) return;
    setKids(box, ...pattern.ph.map(([t, d], i) => h('span', { class: 'pdt' + (i === active ? ' act' : ''), style: i === active ? { color: pattern.color, background: pattern.color + '28', borderColor: pattern.color + '44' } : {} }, `${PHASE_LABEL[t]} ${d}s`)));
  },

  /* ---------- guided pattern ---------- */
  start(pattern, minutes) {
    updateSettings({ med_pattern: pattern.id, med_minutes: minutes });
    const cycles = Math.max(1, Math.round((minutes * 60) / this.cycleSeconds(pattern)));
    this.st = { pattern, cycles, cycle: 0, phase: 0, elapsed: 0, last: null, paused: false, startedAt: nowMs(), count: 3 };
    this.mount(pattern);
    this.setPills(pattern, -1);
    $('#med-total', this.el).textContent = fmtSecs(cycles * this.cycleSeconds(pattern));
    this.countdown();
  },
  countdown() {
    const st = this.st; if (!st) return;
    $('#med-num', this.el).textContent = String(st.count);
    $('#med-lbl', this.el).textContent = '';
    $('#med-num', this.el).classList.add('cdn');
    medTone(300, 0.12, 0.05);
    this.to = setTimeout(() => {
      st.count--;
      if (st.count > 0) { this.countdown(); return; }
      $('#med-num', this.el).classList.remove('cdn');
      st.last = performance.now();
      this.raf = requestAnimationFrame((t) => this.frame(t));
    }, 1000);
  },
  frame(now) {
    const st = this.st; if (!st || st.paused) return;
    if (!st.last) st.last = now;
    st.elapsed += (now - st.last) / 1000; st.last = now;
    const ph = st.pattern.ph[st.phase];
    if (st.elapsed >= ph[1]) {
      st.elapsed = 0;
      st.phase++;
      if (st.phase >= st.pattern.ph.length) { st.phase = 0; st.cycle++; }
      if (st.cycle >= st.cycles) { this.finish(true); return; }
      medTone(440 + st.phase * 60, 0.2, 0.07);
    }
    this.paint();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  },
  /* The orb really travels: eased growth on the inhale, eased release on the exhale, still on the holds. */
  paint() {
    const st = this.st; if (!st || !this.el) return;
    const p = st.pattern; const [kind, secs] = p.ph[st.phase];
    const prog = Math.min(st.elapsed / secs, 1);
    const eased = kind === 'inhale' ? 1 - Math.pow(1 - prog, 2.5) : kind === 'exhale' ? 1 - Math.pow(1 - prog, 0.4) : 0;
    const range = PHASE_SCALE[kind];
    const sc = range.from + (range.to - range.from) * eased;
    const orb = $('#med-orb', this.el);
    orb.style.transform = `translate(-50%,-50%) scale(${sc})`;
    orb.style.background = `radial-gradient(circle at 35% 35%, ${p.color}e6, ${p.color}44 70%, ${p.color}11)`;
    const glow = Math.round(sc * 44).toString(16).padStart(2, '0');
    orb.style.boxShadow = `0 0 ${60 * sc}px ${20 * sc}px ${p.color}${glow}, inset 0 0 28px rgba(255,255,255,${(0.12 * sc).toFixed(2)})`;
    const hl = $('.bh', orb); if (hl) hl.style.background = `radial-gradient(circle, rgba(255,255,255,${(0.24 * sc).toFixed(2)}), transparent)`;
    $('#med-glow', this.el).style.background = `radial-gradient(circle, ${p.color}${Math.round(sc * 16).toString(16).padStart(2, '0')} 0%, transparent 70%)`;
    $('#med-num', this.el).textContent = String(Math.max(0, Math.ceil(secs - st.elapsed)));
    $('#med-lbl', this.el).textContent = PHASE_LABEL[kind];
    const instr = $('#med-instr', this.el);
    instr.textContent = st.paused ? 'Paused' : PHASE_HINT[kind];
    instr.style.opacity = st.paused ? 0.4 : 1;
    $('#med-info', this.el).textContent = `Cycle ${st.cycle + 1} / ${st.cycles}`;
    this.setPills(p, st.phase);
    const cyc = this.cycleSeconds(p);
    const done = st.cycle * cyc + p.ph.slice(0, st.phase).reduce((a, x) => a + x[1], 0) + st.elapsed;
    const total = st.cycles * cyc; const ov = clamp(done / total, 0, 1);
    $('#med-ring', this.el).setAttribute('stroke-dashoffset', String(this.ringLen * (1 - ov)));
    $('#med-progress', this.el).style.width = ov * 100 + '%';
    $('#med-left', this.el).textContent = fmtSecs(done);
    $('#med-elapsed', this.el).textContent = fmtSecs((nowMs() - st.startedAt) / 1000);
  },
  togglePause() {
    const st = this.st; if (!st) return;
    st.paused = !st.paused;
    const b = $('#med-pause', this.el); if (b) b.textContent = st.paused ? '▶ Resume' : '⏸ Pause';
    if (!st.paused) { st.last = performance.now(); this.raf = requestAnimationFrame((t) => this.frame(t)); }
    this.paint();
  },

  /* ---------- Wim Hof ---------- */
  whStart(pattern) {
    const s = state.settings;
    const pace = WH_PACES[s.wh_pace || 'normal'];
    this.wh = { pattern, rounds: s.wh_rounds || 3, breaths: s.wh_breaths || 30, inh: pace[0], exh: pace[1], round: 1, breath: 1, holds: [], startedAt: nowMs(), phase: 'cd', count: 3 };
    this.mount(pattern, { pause: false });
    $('#med-total', this.el).textContent = `${this.wh.rounds} rounds`;
    this.whDots();
    this.whCountdown();
  },
  whDots() {
    const w = this.wh; if (!w) return;
    setKids($('#med-pills', this.el), ...Array.from({ length: w.rounds }, (_, i) => h('span', {
      class: 'pdt' + (i === w.round - 1 ? ' act' : '') + (i < w.holds.length ? ' done' : ''),
      style: i === w.round - 1 || i < w.holds.length ? { color: w.pattern.color, background: w.pattern.color + (i < w.holds.length ? '14' : '28'), borderColor: w.pattern.color + '44' } : {},
    }, i < w.holds.length ? `R${i + 1} · ${fmtSecs(w.holds[i])}` : `R${i + 1}`)));
  },
  whCountdown() {
    const w = this.wh; if (!w) return;
    $('#med-instr', this.el).textContent = 'Find a comfortable position…';
    $('#med-num', this.el).textContent = String(w.count);
    $('#med-lbl', this.el).textContent = '';
    this.whOrb(0.5, 0.6);
    medTone(300, 0.12, 0.05);
    this.to = setTimeout(() => { w.count--; if (w.count > 0) this.whCountdown(); else this.whBreathing(); }, 1000);
  },
  whOrb(scale, seconds, pulse) {
    const orb = $('#med-orb', this.el); if (!orb) return;
    const c = this.wh.pattern.color;
    orb.style.transition = `transform ${seconds}s ease-in-out`;
    orb.style.transform = `translate(-50%,-50%) scale(${scale})`;
    orb.style.background = `radial-gradient(circle at 35% 32%, ${c}e6, ${c}44 70%, ${c}11)`;
    orb.classList.toggle('holdp', !!pulse);
  },
  whBreathing() {
    const w = this.wh; w.phase = 'breathing'; w.breath = 1;
    $('#med-info', this.el).textContent = `Round ${w.round} / ${w.rounds}`;
    setKids($('#med-cta', this.el));
    this.whDots();
    this.whStep(true);
  },
  whStep(isIn) {
    const w = this.wh; if (!w) return;
    const secs = isIn ? w.inh : w.exh;
    this.whOrb(isIn ? 1 : 0.5, secs);
    $('#med-lbl', this.el).textContent = isIn ? 'Inhale' : 'Exhale';
    $('#med-num', this.el).textContent = String(w.breath);
    $('#med-instr', this.el).textContent = `breath ${w.breath} / ${w.breaths}`;
    $('#med-progress', this.el).style.width = clamp(((w.round - 1) + w.breath / w.breaths) / w.rounds, 0, 1) * 100 + '%';
    $('#med-left', this.el).textContent = `Round ${w.round} of ${w.rounds}`;
    $('#med-elapsed', this.el).textContent = fmtSecs((nowMs() - w.startedAt) / 1000);
    medTone(isIn ? 520 : 330, 0.06, 0.06);
    this.to = setTimeout(() => {
      if (!this.wh) return;
      if (isIn) { this.whStep(false); return; }
      if (w.breath >= w.breaths) { this.whHold(); return; }
      w.breath++; this.whStep(true);
    }, secs * 1000);
  },
  whHold() {
    const w = this.wh; w.phase = 'hold'; w.holdStart = performance.now();
    this.whOrb(0.5, 1.4, true);
    $('#med-lbl', this.el).textContent = 'Retention';
    $('#med-instr', this.el).textContent = 'Let the air out and hold for as long as it stays comfortable';
    $('#med-num', this.el).textContent = '0:00';
    $('#med-info', this.el).textContent = `Round ${w.round} / ${w.rounds} · retention`;
    setKids($('#med-cta', this.el), h('button', { class: 'btn primary lg med-big', onClick: () => this.whFinishHold() }, 'Inhale now →'));
    medTone(620, 0.12, 0.08);
    this.iv = setInterval(() => {
      if (!this.wh) return;
      $('#med-num', this.el).textContent = fmtSecs((performance.now() - w.holdStart) / 1000);
      $('#med-elapsed', this.el).textContent = fmtSecs((nowMs() - w.startedAt) / 1000);
    }, 250);
  },
  whFinishHold() {
    const w = this.wh; if (!w || w.phase !== 'hold') return;
    clearInterval(this.iv); this.iv = null;
    w.holds.push(Math.max(1, Math.round((performance.now() - w.holdStart) / 1000)));
    this.whDots();
    this.whRecovery();
  },
  whRecovery() {
    const w = this.wh; w.phase = 'rec'; w.recStart = performance.now();
    this.whOrb(1, 1);
    setKids($('#med-cta', this.el));
    $('#med-lbl', this.el).textContent = 'Recovery';
    $('#med-instr', this.el).textContent = 'Deep breath in — hold for 15 seconds';
    medTone(740, 0.12, 0.08);
    this.iv = setInterval(() => {
      if (!this.wh) return;
      const rem = Math.max(0, Math.ceil(15 - (performance.now() - w.recStart) / 1000));
      $('#med-num', this.el).textContent = fmtSecs(rem);
      if (rem <= 0) {
        clearInterval(this.iv); this.iv = null;
        if (w.round >= w.rounds) { this.finish(true); return; }
        w.round++; this.whBreathing();
      }
    }, 150);
  },

  /* ---------- end ---------- */
  exit() { if (this.st || this.wh) this.finish(false); },
  clearTimers() { if (this.raf) cancelAnimationFrame(this.raf); if (this.to) clearTimeout(this.to); if (this.iv) clearInterval(this.iv); this.raf = this.to = this.iv = null; },
  finish(completed) {
    const st = this.st, w = this.wh;
    if (!st && !w) return;
    this.clearTimers();
    document.removeEventListener('keydown', this._onKey, true);
    const startedAt = (st || w).startedAt; const pattern = (st || w).pattern;
    const end = Math.round(nowMs()); const start = Math.round(startedAt);
    this.st = null; this.wh = null;
    if (this.el) { this.el.remove(); this.el = null; }
    document.body.classList.remove('med-open');
    if (completed) { medTone(523, 0.4, 0.1); setTimeout(() => medTone(659, 0.4, 0.1), 200); setTimeout(() => medTone(784, 0.6, 0.1), 400); }
    if ((end - start) / MIN < 0.5) { toast('Too short to log'); return; }
    const theme = ensureMeditationTheme();
    const fit = Calendar.fitMove(start, end);
    const meta = { type: 'meditation', pattern: pattern.id, completed: !!completed };
    if (w) { meta.rounds = w.holds.length; meta.holds = w.holds; } else { meta.cycles = completed ? st.cycles : st.cycle; }
    const s = createSession({ theme, started_at: iso(fit.start), ended_at: iso(fit.end), source: 'timer', meta });
    Achievements.check('MEDITATION_DONE');
    hideBanner('meditate');
    this.summary(s, pattern, meta, completed);
  },
  summary(s, pattern, meta, completed) {
    const tm = sessionTimes(s);
    const best = meta.holds?.length ? Math.max(...meta.holds) : 0;
    const m = openModal({ title: completed ? 'Session complete' : 'Session saved', cls: 'narrow',
      body: h('div', { class: 'stack' },
        h('div', { class: 'summary' },
          h('div', null, h('b', null, fmtHM(tm.net / MIN)), h('span', null, 'practised')),
          meta.holds ? h('div', null, h('b', null, fmtSecs(best)), h('span', null, 'best hold')) : h('div', null, h('b', null, String(meta.cycles || 0)), h('span', null, 'cycles')),
          h('div', null, h('b', null, meta.holds ? `${meta.rounds}` : pattern.ph.map((x) => x[1]).join('-')), h('span', null, meta.holds ? 'rounds' : pattern.name))),
        meta.holds?.length ? h('div', { class: 'chips', style: { justifyContent: 'center' } }, ...meta.holds.map((x, i) => h('span', { class: 'chip on', style: { '--c': pattern.color, '--ink': '#14140f' } }, `R${i + 1} · ${fmtSecs(x)}`))) : null,
        h('p', { class: 'muted center' }, MED_QUOTES[Math.floor(Math.random() * MED_QUOTES.length)]),
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
function meditationStats() {
  const list = activeSessions().filter((s) => s.meta?.type === 'meditation');
  const days = new Set(list.map((s) => dayKeyOf(ms(s.started_at))));
  let streak = 0; let d = todayKey();
  if (!days.has(d)) d = addDays(d, -1);
  while (days.has(d)) { streak++; d = addDays(d, -1); }
  return { count: list.length, minutes: list.reduce((a, s) => a + sessionTimes(s).net / MIN, 0), today: days.has(todayKey()), days: days.size, streak };
}
