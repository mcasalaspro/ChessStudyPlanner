/* ===== Weekly Review (#/week) and the Achievements screen (#/achievements) ===== */
const WeeklyView = {
  week: null, el: null, offs: [],
  mount(root) { this.week = this.week || weekStartKey(); this.el = h('div', { class: 'review' }); root.append(this.el); this.render(); this.offs.push(on('change', () => this.render())); },
  unmount() { this.offs.forEach((f) => f()); this.offs = []; },
  render() {
    const w = weekStats(this.week);
    const prev = weekStats(addDays(this.week, -7));
    const goal = (state.settings.weekly_goal_hours || 0) * 60;
    const isThis = this.week === weekStartKey();
    const kpi = (v, l) => h('div', null, h('b', null, v), h('span', null, l));
    const themeRows = Array.from(w.byTheme.entries()).sort((a, b) => b[1] - a[1]);
    const top = themeRows.slice(0, 5); const rest = themeRows.slice(5).reduce((a, x) => a + x[1], 0);
    const maxTheme = Math.max(1, ...top.map((x) => x[1]), rest);
    const maxDay = Math.max(60, ...w.perDay.map((d) => d.min));
    setKids(this.el,
      h('div', { class: 'row between', style: { marginBottom: '10px' } },
        h('div', null, h('h1', null, 'Weekly review'), h('p', { class: 'muted small' }, `${weekLabel(this.week)}${isThis ? ' · this week' : ''}`)),
        h('div', { class: 'row' },
          h('button', { class: 'btn sm', onClick: () => { this.week = addDays(this.week, -7); this.render(); } }, '‹ Previous'),
          h('button', { class: 'btn sm', disabled: isThis, onClick: () => { this.week = weekStartKey(); this.render(); } }, 'This week'),
          h('button', { class: 'btn sm', disabled: this.week >= weekStartKey(), onClick: () => { this.week = addDays(this.week, 7); this.render(); } }, 'Next ›'))),
      !w.count && !w.netMin ? h('section', { class: 'card' }, h('p', { class: 'muted italic' }, 'No blocks in this week yet.')) : null,
      h('section', { class: 'card' }, h('div', { class: 'stats wide' },
        kpi(fmtHM(w.netMin), 'studied'), kpi(String(w.count), w.count === 1 ? 'session' : 'sessions'), kpi(`${w.studied}`, 'days studied'),
        kpi(fmtHM(w.avgPerStudiedDay), 'avg / day studied'), kpi(fmtHM(w.longest), 'longest session'), kpi(String(w.tournaments), w.tournaments === 1 ? 'tournament day' : 'tournament days')),
        goal ? (() => { const pct = Math.round((w.netMin / goal) * 100); const over = w.netMin >= goal;
          return h('div', { style: { marginTop: '10px' } },
            h('div', { class: 'row between small' }, h('span', null, `Goal ${fmtHM(goal)}`), h('b', null, over ? `${pct}% · ${fmtHM(w.netMin - goal)} above the goal` : `${pct}% · ${fmtHM(goal - w.netMin)} to go`)),
            h('div', { class: 'progress' }, h('i', { style: { width: Math.min(100, pct) + '%', background: over ? 'var(--gold)' : 'var(--green)' } })));
        })() : h('p', { class: 'muted small', style: { marginTop: '8px' } }, 'No weekly goal set — you can add one in Settings.')),
      h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, 'Where the time went')),
        themeRows.length ? h('div', { class: 'bars' },
          ...top.map(([th, min]) => h('div', { class: 'bar-row' }, h('span', { class: 'lbl' }, themeName(th === '__none' ? null : th)),
            h('div', { class: 'bar' }, h('i', { class: 'fill', style: { width: (min / maxTheme) * 100 + '%', background: themeColor(th === '__none' ? null : th) } })), h('span', { class: 'val num' }, fmtHM(min)))),
          rest ? h('div', { class: 'bar-row' }, h('span', { class: 'lbl muted' }, 'Others'), h('div', { class: 'bar' }, h('i', { class: 'fill', style: { width: (rest / maxTheme) * 100 + '%', background: '#8a9bb3' } })), h('span', { class: 'val num' }, fmtHM(rest))) : null)
          : h('p', { class: 'muted italic small' }, 'Nothing logged this week.')),
      h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, 'Consistency')),
        h('div', { class: 'week-bars' }, ...w.perDay.map((d) => h('div', { class: 'wb' + (d.min > 0 ? ' on' : '') },
          h('div', { class: 'wb-bar' }, h('i', { style: { height: Math.max(d.min ? 6 : 0, (d.min / maxDay) * 100) + '%' } })),
          h('span', { class: 'wb-lbl' }, WD[parseYmd(d.day).getDay()]), h('span', { class: 'wb-val num' }, d.min ? fmtHM(d.min) : '')))),
        h('p', { class: 'muted small' }, `${w.studied} of 7 days with study.`)),
      w.ratings.total ? h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, 'How it felt')),
        h('div', { class: 'bars' }, ...RATINGS.map(([id, label, color]) => { const n = w.ratings.counts[id]; const pct = (n / w.ratings.total) * 100;
          return h('div', { class: 'bar-row' }, h('span', { class: 'lbl' }, label), h('div', { class: 'bar' }, h('i', { class: 'fill', style: { width: pct + '%', background: color } })), h('span', { class: 'val num' }, n ? `${n}` : '')); })),
        h('p', { class: 'muted small' }, `${w.ratings.total} of ${w.count} blocks rated.`)) : null,
      (() => { const ins = this.insights(w, prev); return ins.length ? h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, 'What stands out')), h('ul', { class: 'insights' }, ...ins.map((t) => h('li', null, t)))) : null; })(),
      h('div', { class: 'row', style: { justifyContent: 'center', margin: '14px 0 30px' } },
        h('button', { class: 'btn', onClick: () => { this.week = addDays(this.week, -7); this.render(); } }, '‹ Previous week'),
        h('button', { class: 'btn primary lg', onClick: () => StudyNow.open() }, '▶ Study now')));
  },
  /* At most three, and never from a sample too small to mean anything. */
  insights(w, prev) {
    const out = [];
    const themeRows = Array.from(w.byTheme.entries()).sort((a, b) => b[1] - a[1]);
    if (themeRows.length && themeRows[0][1] > 0) out.push(`Most of your time went to ${themeName(themeRows[0][0] === '__none' ? null : themeRows[0][0])} (${fmtHM(themeRows[0][1])}).`);
    if (w.studied >= 5) out.push(`You studied on ${w.studied} of the 7 days.`);
    if (w.count >= 3 && prev.count >= 3) {
      const diff = w.netMin - prev.netMin;
      if (Math.abs(diff) >= 30) out.push(diff > 0 ? `That is ${fmtHM(diff)} more than the previous week.` : `That is ${fmtHM(-diff)} less than the previous week.`);
    }
    if (out.length < 3) {
      const buckets = rhythmBuckets(addDays(todayKey(), -28)).filter((b) => b.sessions > 0);
      const total = buckets.reduce((a, b) => a + b.sessions, 0); const days = new Set(buckets.flatMap(() => [])).size;
      const enough = total >= 8 && buckets.reduce((a, b) => Math.max(a, b.days), 0) >= 2;
      if (enough) { const best = buckets.slice().sort((a, b) => b.minutes - a.minutes)[0]; if (best) out.push(`Over the last four weeks, ${best.label} is when you study most.`); }
    }
    if (out.length < 3 && w.ratings.total >= 4) {
      const f = w.ratings.counts.focused;
      if (f / w.ratings.total >= 0.5) out.push(`Half or more of the blocks you rated felt focused.`);
    }
    return out.slice(0, 3);
  },
};

const AchievementsView = {
  el: null, offs: [],
  mount(root) { this.el = h('div', { class: 'review' }); root.append(this.el); this.render(); this.offs.push(on('change', () => this.render()), on('achievements', () => this.render())); },
  unmount() { this.offs.forEach((f) => f()); this.offs = []; },
  render() {
    const list = Achievements.list(); const got = list.filter((a) => a.done).length;
    const books = (state.settings.books || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    setKids(this.el,
      h('div', { class: 'row between', style: { marginBottom: '10px' } }, h('div', null, h('h1', null, '🏆 Achievements'), h('p', { class: 'muted small' }, `${got} of ${list.length} unlocked`)), null),
      h('section', { class: 'card' }, h('div', { class: 'progress' }, h('i', { style: { width: (got / list.length) * 100 + '%', background: 'var(--gold)' } }))),
      ...ACH_CATEGORIES.map(([cat, label, icon]) => {
        const items = list.filter((a) => a.cat === cat);
        return h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, `${icon} ${label}`), h('span', { class: 'muted small' }, `${items.filter((a) => a.done).length}/${items.length}`)),
          h('div', { class: 'ach-grid' }, ...items.map((a) => this.badge(a))));
      }),
      h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('div', null, h('h2', null, `📚 ${books.length} book${books.length === 1 ? '' : 's'} finished`), h('p', { class: 'sub' }, 'Books you have worked through, start to finish.')),
        h('button', { class: 'btn sm primary', onClick: () => this.addBook() }, '+ Add book')),
        books.length ? h('div', { class: 'stack sm' }, ...books.map((bk) => h('div', { class: 'book-row' },
          h('div', { class: 'grow' }, h('b', null, bk.title), bk.author ? h('span', { class: 'muted small' }, ` — ${bk.author}`) : null, h('div', { class: 'faint small' }, bk.date ? fmtDate(bk.date) : '')),
          h('button', { class: 'btn ghost icon sm', 'aria-label': 'Remove', onClick: async () => { if (await confirmDialog(`Remove “${bk.title}”?`, { danger: true, okLabel: 'Remove' })) { updateSettings({ books: (state.settings.books || []).filter((x) => x.id !== bk.id) }); } } }, '✕'))))
          : h('p', { class: 'muted italic small' }, 'No books yet.')));
  },
  badge(a) {
    const hidden = a.hidden && !a.done;
    return h('div', { class: 'ach' + (a.done ? ' done r-' + a.rarity[0] : ''), title: hidden ? 'Hidden achievement' : a.desc },
      h('span', { class: 'ach-ic' }, hidden ? '🔒' : a.icon),
      h('div', { class: 'grow' },
        h('div', { class: 'row between' }, h('b', null, hidden ? '???' : a.name), h('span', { class: 'rarity', title: a.rarity[1] }, a.rarity[2])),
        h('div', { class: 'muted small' }, hidden ? 'Keep going to find this one' : a.desc),
        a.done ? h('div', { class: 'faint small' }, a.at ? `unlocked ${fmtDate(new Date(ms(a.at)))}` : 'unlocked') : h('div', { class: 'progress sm' }, h('i', { style: { width: Math.round(a.pct * 100) + '%' } }))));
  },
  addBook() {
    const title = h('input', { type: 'text', placeholder: 'e.g. Silman’s Complete Endgame Course', maxlength: 120 });
    const author = h('input', { type: 'text', placeholder: 'Author (optional)', maxlength: 80 });
    const date = h('input', { type: 'date', value: todayKey() });
    const save = () => {
      if (!title.value.trim()) { toast('Give the book a title', { error: true }); return; }
      const books = [...(state.settings.books || []), { id: uid().slice(0, 8), title: title.value.trim(), author: author.value.trim(), date: date.value || todayKey() }];
      updateSettings({ books });
      Achievements.check('BOOK_COMPLETED');
      m.close(); toast('Book added');
    };
    title.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    const m = openModal({ title: '📚 Book finished', cls: 'narrow',
      body: h('div', { class: 'stack' }, h('label', { class: 'field' }, h('span', null, 'Book'), title), h('label', { class: 'field' }, h('span', null, 'Author'), author), h('label', { class: 'field' }, h('span', null, 'Finished on'), date)),
      footer: frag(h('button', { class: 'btn', onClick: () => m.close() }, 'Cancel'), h('button', { class: 'btn primary', onClick: save }, 'Register')) });
    setTimeout(() => title.focus(), 30);
  },
};
