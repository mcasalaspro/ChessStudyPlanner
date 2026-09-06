/* ===== STUDY NOW wizard + tournament day ===== */
const LENGTH_PRESETS = [15, 25, 45, 60, 90];
const BREAK_PRESETS = [[25, 5], [50, 10], [90, 15]];

const StudyNow = {
  open() {
    if (runningSession()) { toast('A block is already running', { error: true }); location.hash = ''; return; }
    let step = 1;
    const pick = { theme: state.settings.last_theme || null, minutes: 45, breaks: null };
    const body = h('div', { class: 'wizard' });
    const foot = h('div', { class: 'row between', style: { width: '100%' } });
    const m = openModal({ title: 'Study now', cls: 'narrow', body, footer: foot });

    const render = () => {
      const dots = h('div', { class: 'wiz-steps' }, ...[1, 2, 3].map((n) => h('i', { class: n === step ? 'on' : n < step ? 'past' : '' })));
      if (step === 1) {
        setKids(body, dots, h('h3', null, 'What are you studying?'),
          h('div', { class: 'chips' }, ...themes().map((th) => h('button', { class: 'chip' + (pick.theme === th.id ? ' on' : ''), style: { '--c': th.color, '--ink': contrastInk(th.color) }, onClick: () => { pick.theme = th.id; step = 2; render(); } }, th.name)),
            h('button', { class: 'chip', style: { '--c': '#8a9bb3', '--ink': '#fff' }, onClick: () => { pick.theme = null; step = 2; render(); } }, 'Decide later')));
        setKids(foot, h('span', { class: 'muted small' }, 'Step 1 of 3'), h('button', { class: 'btn', onClick: () => { step = 2; render(); } }, 'Skip'));
      } else if (step === 2) {
        const custom = h('input', { type: 'number', min: 5, max: 480, step: 5, value: pick.minutes, style: { width: '90px' }, onChange: (e) => { pick.minutes = clamp(+e.target.value || 45, 5, 480); render(); } });
        setKids(body, dots, h('h3', null, 'For how long?'),
          h('div', { class: 'chips' }, ...LENGTH_PRESETS.map((n) => h('button', { class: 'chip' + (pick.minutes === n ? ' on' : ''), style: { '--c': '#8bc34a', '--ink': '#10200a' }, onClick: () => { pick.minutes = n; step = 3; render(); } }, `${n} min`))),
          h('label', { class: 'field inline' }, h('span', null, 'Custom (min)'), custom));
        setKids(foot, h('button', { class: 'btn', onClick: () => { step = 1; render(); } }, '‹ Back'), h('button', { class: 'btn primary', onClick: () => { step = 3; render(); } }, 'Continue ›'));
      } else if (step === 3) {
        setKids(body, dots, h('h3', null, 'Breaks?'),
          h('div', { class: 'chips' },
            h('button', { class: 'chip' + (pick.breaks === null ? ' on' : ''), style: { '--c': '#8a9bb3', '--ink': '#fff' }, onClick: () => { pick.breaks = null; render(); } }, 'No breaks'),
            ...BREAK_PRESETS.map(([a, b]) => h('button', { class: 'chip' + (pick.breaks && pick.breaks[0] === a ? ' on' : ''), style: { '--c': '#6e8ef0', '--ink': '#fff' }, onClick: () => { pick.breaks = [a, b]; render(); } }, `${a}/${b}`))),
          h('div', { class: 'wiz-summary' }, h('b', null, pick.theme ? themeName(pick.theme) : 'No theme'), h('span', null, `${fmtHM(pick.minutes)} · ${pick.breaks ? `${pick.breaks[0]} min study / ${pick.breaks[1]} min break` : 'no breaks'}`)));
        setKids(foot, h('button', { class: 'btn', onClick: () => { step = 2; render(); } }, '‹ Back'), h('button', { class: 'btn primary lg', onClick: () => this.start(pick, m) }, '▶ Start now'));
      }
    };
    render();
  },
  start(pick, modal) {
    try {
      const patch = { target_min: pick.minutes };
      if (pick.breaks) { patch.break_every_min = pick.breaks[0]; patch.break_len_min = pick.breaks[1]; patch.guided_breaks = true; }
      else patch.break_every_min = 0;
      updateSettings(patch);
      Timer.start(pick.theme);
      modal.close();
      location.hash = '';
      setTimeout(() => Focus.open(), 60);
    } catch (e) { toast(e.message, { error: true }); }
  },
};

const Tournament = {
  open(dayKey = todayKey()) {
    const dateIn = h('input', { type: 'date', value: dayKey });
    const fromIn = h('input', { type: 'time', value: '12:00', step: 900 });
    const toIn = h('input', { type: 'time', value: '17:00', step: 900 });
    const nameIn = h('input', { type: 'text', placeholder: 'Tournament name (optional)', maxlength: 60 });
    const create = () => {
      const [y, mo, d] = dateIn.value.split('-').map(Number);
      const [ah, am] = fromIn.value.split(':').map(Number); const [bh, bm] = toIn.value.split(':').map(Number);
      let start = new Date(y, mo - 1, d, ah, am).getTime(); let end = new Date(y, mo - 1, d, bh, bm).getTime();
      if (end <= start) end += DAY;
      const clash = findOverlap(start, end);
      if (clash) { toast('There is already a block in that window — move it first', { error: true }); return; }
      createTournament({ start, end, name: nameIn.value.trim() });
      m.close(); toast('Tournament day marked'); Calendar.render();
    };
    const m = openModal({
      title: '🏁 Tournament day', cls: 'narrow',
      body: h('div', { class: 'stack' },
        h('p', { class: 'muted small' }, 'Blocks the window for planning. You can still hit “Study now” during it — preparation, analysis or a lesson still count.'),
        h('label', { class: 'field' }, h('span', null, 'Day'), dateIn),
        h('div', { class: 'grid2' }, h('label', { class: 'field' }, h('span', null, 'From'), fromIn), h('label', { class: 'field' }, h('span', null, 'To'), toIn)),
        h('label', { class: 'field' }, h('span', null, 'Name'), nameIn)),
      footer: frag(h('button', { class: 'btn', onClick: () => m.close() }, 'Cancel'), h('button', { class: 'btn primary', onClick: create }, 'Confirm')),
    });
  },
  edit(id) {
    const t = sessionById(id); if (!t) return;
    const nameIn = h('input', { type: 'text', value: t.meta?.tournament_name || '', maxlength: 60 });
    const fromIn = h('input', { type: 'time', value: hm(ms(t.started_at)), step: 900 });
    const toIn = h('input', { type: 'time', value: hm(ms(t.ended_at)), step: 900 });
    const dateIn = h('input', { type: 'date', value: dayKeyOf(ms(t.started_at)) });
    const save = () => {
      const [y, mo, d] = dateIn.value.split('-').map(Number);
      const [ah, am] = fromIn.value.split(':').map(Number); const [bh, bm] = toIn.value.split(':').map(Number);
      let start = new Date(y, mo - 1, d, ah, am).getTime(); let end = new Date(y, mo - 1, d, bh, bm).getTime();
      if (end <= start) end += DAY;
      updateSession(id, { started_at: iso(start), ended_at: iso(end), meta: { ...(t.meta || {}), tournament_name: nameIn.value.trim() } }, { undoable: false });
      Drawer.close(); toast('Tournament day updated');
    };
    Drawer.open('🏁 Tournament day', h('div', { class: 'stack' },
      h('label', { class: 'field' }, h('span', null, 'Name'), nameIn),
      h('label', { class: 'field' }, h('span', null, 'Day'), dateIn),
      h('div', { class: 'grid2' }, h('label', { class: 'field' }, h('span', null, 'From'), fromIn), h('label', { class: 'field' }, h('span', null, 'To'), toIn)),
      h('p', { class: 'muted small' }, 'Planning is blocked inside this window; real study sessions are always allowed.'),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', onClick: save }, 'Save'),
        h('button', { class: 'btn danger', onClick: async () => { if (await confirmDialog('Remove this tournament day?', { danger: true, okLabel: 'Remove' })) { deleteSession(id, { undoable: false }); Drawer.close(); toast('Tournament day removed'); } } }, 'Remove'))), 'tournament:' + id);
  },
};

/* Achievement unlocked → short, quiet toast */
function announceAchievement(a) {
  const el = h('div', { class: 'ach-toast', role: 'status' }, h('span', { class: 'ach-ic' }, a.icon),
    h('div', null, h('b', null, 'Achievement unlocked'), h('div', null, a.name), h('div', { class: 'muted small' }, a.desc)));
  document.body.append(el);
  if (navigator.vibrate && state.settings.ach_feedback !== false) { try { navigator.vibrate(30); } catch { /* */ } }
  setTimeout(() => el.classList.add('out'), 3200);
  setTimeout(() => el.remove(), 3800);
}
