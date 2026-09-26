/* ===== STUDY NOW wizard + tournament day ===== */
const SESSION_PRESETS = [30, 45, 60];
const BREAK_PRESETS = [5, 10, 15];

/* Quick start: theme → automatic breaks? → (if yes) every how long and how long a break.
   Saying no goes straight to the clock, where breaks are started by hand. */
const StudyNow = {
  open() {
    const running = runningSession();
    let step = 1;
    const pick = { theme: state.settings.last_theme || null, auto: null, every: state.settings.break_every_min || 45, len: state.settings.break_len_min || 10 };
    const body = h('div', { class: 'wizard' });
    const foot = h('div', { class: 'row between', style: { width: '100%' } });
    const m = openModal({ title: 'Start studying', cls: 'narrow', body, footer: foot });
    const dots = () => h('div', { class: 'wiz-steps' }, ...[1, 2, 3].map((n) => h('i', { class: n === step ? 'on' : n < step ? 'past' : '' })));

    const render = () => {
      if (step === 1) {
        setKids(body, dots(), running ? h('p', { class: 'hint warn', style: { marginBottom: '8px' } }, `${themeName(running.theme)} is still running (${fmtHM(sessionTimes(running).net / MIN)}). Starting closes it — you will be asked how it went.`) : null,
          h('h3', null, 'What are you studying?'),
          h('div', { class: 'chips' }, ...themes().map((th) => h('button', { class: 'chip' + (pick.theme === th.id ? ' on' : ''), style: { '--c': th.color, '--ink': contrastInk(th.color) }, onClick: () => { pick.theme = th.id; step = 2; render(); } }, th.name)),
            h('button', { class: 'chip', style: { '--c': '#8a9bb3', '--ink': '#fff' }, onClick: () => { pick.theme = null; step = 2; render(); } }, 'Decide later')));
        setKids(foot, h('span', { class: 'muted small' }, 'Step 1 of 3'),
          h('button', { class: 'btn primary', title: 'No automatic breaks — you decide when to stop', onClick: () => this.start({ ...pick, auto: false }, m) }, icon('play'), 'Start right away'));
      } else if (step === 2) {
        setKids(body, dots(), h('h3', null, 'Automatic breaks?'),
          h('div', { class: 'wiz-choice' },
            h('button', { class: 'choice', onClick: () => { pick.auto = true; step = 3; render(); } }, icon('clock', 'big'), h('b', null, 'Yes, remind me'), h('span', { class: 'muted small' }, 'The clock pauses and comes back on its own')),
            h('button', { class: 'choice', onClick: () => this.start({ ...pick, auto: false }, m) }, icon('play', 'big'), h('b', null, 'No, straight to it'), h('span', { class: 'muted small' }, 'You press Start break and Resume when you want'))));
        setKids(foot, h('button', { class: 'btn', onClick: () => { step = 1; render(); } }, '‹ Back'), h('span', { class: 'muted small' }, pick.theme ? themeName(pick.theme) : 'No theme'));
      } else {
        const customEvery = h('input', { type: 'number', min: 5, max: 240, step: 5, value: pick.every, style: { width: '84px' }, onChange: (e) => { pick.every = clamp(+e.target.value || 45, 5, 240); render(); } });
        const customLen = h('input', { type: 'number', min: 1, max: 60, value: pick.len, style: { width: '84px' }, onChange: (e) => { pick.len = clamp(+e.target.value || 10, 1, 60); render(); } });
        setKids(body, dots(), h('h3', null, 'How often, and for how long?'),
          h('div', { class: 'field' }, h('span', null, 'Study stretch'),
            h('div', { class: 'chips' }, ...SESSION_PRESETS.map((n) => h('button', { class: 'chip' + (pick.every === n ? ' on' : ''), style: { '--c': '#8bc34a', '--ink': '#10200a' }, onClick: () => { pick.every = n; render(); } }, `${n} min`)))),
          h('div', { class: 'field' }, h('span', null, 'Break'),
            h('div', { class: 'chips' }, ...BREAK_PRESETS.map((n) => h('button', { class: 'chip' + (pick.len === n ? ' on' : ''), style: { '--c': '#6e8ef0', '--ink': '#fff' }, onClick: () => { pick.len = n; render(); } }, `${n} min`)))),
          h('div', { class: 'grid2' }, h('label', { class: 'field' }, h('span', null, 'Custom study (min)'), customEvery), h('label', { class: 'field' }, h('span', null, 'Custom break (min)'), customLen)),
          h('div', { class: 'wiz-summary' }, h('b', null, pick.theme ? themeName(pick.theme) : 'No theme'), h('span', null, `${pick.every} min of study · ${pick.len} min of break, repeating`)));
        setKids(foot, h('button', { class: 'btn', onClick: () => { step = 2; render(); } }, '‹ Back'),
          h('button', { class: 'btn primary lg', onClick: () => this.start({ ...pick, auto: true }, m) }, icon('play'), 'Start'));
      }
    };
    render();
  },
  start(pick, modal) {
    const auto = !!pick.auto;
    updateSettings(auto
      ? { target_min: null, guided_breaks: true, break_every_min: pick.every, break_len_min: pick.len }
      : { target_min: null });
    if (modal) modal.close();
    startBlock(pick.theme, { free: !auto, then: () => { location.hash = ''; setTimeout(() => Focus.open(), 60); } });
  },
};

/* Tournament time is logged after it happens, like any block: its hours count and the day keeps the streak. */
const Tournament = {
  window(dayKey) {
    if (dayKey !== todayKey()) return ['12:00', '17:00'];
    const now = new Date(nowMs()); const end = Math.floor((now.getHours() * 60 + now.getMinutes()) / 15) * 15; const start = Math.max(0, end - 240);
    return [`${pad2(Math.floor(start / 60))}:${pad2(start % 60)}`, `${pad2(Math.floor(end / 60))}:${pad2(end % 60)}`];
  },
  readTimes(dateIn, fromIn, toIn) {
    const [y, mo, d] = dateIn.value.split('-').map(Number);
    const [ah, am] = fromIn.value.split(':').map(Number); const [bh, bm] = toIn.value.split(':').map(Number);
    if (!y || Number.isNaN(ah) || Number.isNaN(bh)) return null;
    const start = new Date(y, mo - 1, d, ah, am).getTime(); let end = new Date(y, mo - 1, d, bh, bm).getTime();
    if (end <= start) end += DAY;
    return { start, end };
  },
  check(t, excludeId) {
    if (!t) return 'Pick the day and the times.';
    if (t.end > nowMs() + MIN) return 'That has not finished yet — log the tournament once it is over (or up to now).';
    if (t.end - t.start > 16 * HOUR) return 'More than 16 hours — split it into two entries.';
    const clash = findOverlap(t.start, t.end, excludeId);
    if (clash) return `It overlaps ${isTournament(clash) ? 'another tournament entry' : 'a study block'} (${fmtRange(ms(clash.started_at), clash.ended_at ? ms(clash.ended_at) : nowMs())}) — adjust one of them first.`;
    return null;
  },
  open(dayKey = todayKey()) {
    if (dayKey > todayKey()) dayKey = todayKey();
    const [from, to] = this.window(dayKey);
    const dateIn = h('input', { type: 'date', value: dayKey, max: todayKey() });
    const fromIn = h('input', { type: 'time', value: from, step: 900 });
    const toIn = h('input', { type: 'time', value: to, step: 900 });
    const nameIn = h('input', { type: 'text', placeholder: 'Tournament name (optional)', maxlength: 60 });
    const create = () => {
      const t = this.readTimes(dateIn, fromIn, toIn); const err = this.check(t);
      if (err) { toast(err, { error: true }); return; }
      createTournament({ start: t.start, end: t.end, name: nameIn.value.trim() });
      m.close(); toast('Tournament logged'); Calendar.render();
    };
    const m = openModal({
      title: '🏁 Tournament', cls: 'narrow',
      body: h('div', { class: 'stack' },
        h('p', { class: 'muted small' }, 'Log the time you spent playing. Tournament hours count as study time, and the day keeps your streak.'),
        h('label', { class: 'field' }, h('span', null, 'Day'), dateIn),
        h('div', { class: 'grid2' }, h('label', { class: 'field' }, h('span', null, 'From'), fromIn), h('label', { class: 'field' }, h('span', null, 'To'), toIn)),
        h('label', { class: 'field' }, h('span', null, 'Name'), nameIn)),
      footer: frag(h('button', { class: 'btn', onClick: () => m.close() }, 'Cancel'), h('button', { class: 'btn primary', onClick: create }, 'Log it')),
    });
  },
  edit(id) {
    const t = sessionById(id); if (!t) return;
    const nameIn = h('input', { type: 'text', value: t.meta?.tournament_name || '', maxlength: 60 });
    const fromIn = h('input', { type: 'time', value: hm(ms(t.started_at)), step: 900 });
    const toIn = h('input', { type: 'time', value: hm(ms(t.ended_at)), step: 900 });
    const dateIn = h('input', { type: 'date', value: dayKeyOf(ms(t.started_at)), max: todayKey() });
    const save = () => {
      const tt = this.readTimes(dateIn, fromIn, toIn); const err = this.check(tt, id);
      if (err) { toast(err, { error: true }); return; }
      updateSession(id, { started_at: iso(tt.start), ended_at: iso(tt.end), meta: { ...(t.meta || {}), tournament_name: nameIn.value.trim() } }, { undoable: false });
      Drawer.close(); toast('Tournament updated');
    };
    Drawer.open('🏁 Tournament', h('div', { class: 'stack' },
      h('label', { class: 'field' }, h('span', null, 'Name'), nameIn),
      h('label', { class: 'field' }, h('span', null, 'Day'), dateIn),
      h('div', { class: 'grid2' }, h('label', { class: 'field' }, h('span', null, 'From'), fromIn), h('label', { class: 'field' }, h('span', null, 'To'), toIn)),
      h('p', { class: 'muted small' }, 'Tournament hours count as study time, and the day keeps your streak.'),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', onClick: save }, 'Save'),
        h('button', { class: 'btn danger', onClick: async () => { if (await confirmDialog('Remove this tournament entry?', { danger: true, okLabel: 'Remove' })) { deleteSession(id, { undoable: false }); Drawer.close(); toast('Tournament removed'); } } }, 'Remove'))), 'tournament:' + id);
  },
};

/* Achievement unlocked → short, quiet toast */
function announceAchievement(a) {
  const el = h('div', { class: 'ach-toast', role: 'status' }, h('span', { class: 'ach-ic' }, icon(a.icon)),
    h('div', null, h('b', null, 'Achievement unlocked'), h('div', null, a.name), h('div', { class: 'muted small' }, a.desc),
      (a.bonus || ACH_CREDITS[a.tier]) ? h('div', { class: 'ach-credit small' }, coinIcon(), `+${a.bonus || ACH_CREDITS[a.tier]} credits`) : null));
  el.style.bottom = `${(window.innerWidth <= 760 ? 78 : 22) + $$(".ach-toast").length * 92}px`; // several at once stack instead of overlapping
  document.body.append(el);
  if (navigator.vibrate && state.settings.ach_feedback !== false) { try { navigator.vibrate(30); } catch { /* */ } }
  setTimeout(() => el.classList.add('out'), 3200);
  setTimeout(() => el.remove(), 3800);
}
