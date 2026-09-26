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
        kpi((() => { const f = focusStats(w.startKey, w.endKey); return f.share == null ? '—' : `${Math.round(f.share * 100)}%`; })(), 'focused'),
        kpi(fmtHM(w.netMin), 'studied'), kpi(String(w.count), w.count === 1 ? 'session' : 'sessions'), kpi(`${w.studied}`, 'days studied'),
        kpi(fmtHM(w.avgPerStudiedDay), 'avg / day studied'), kpi(String(w.tournaments), w.tournaments === 1 ? 'tournament day' : 'tournament days')),
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
        h('div', { class: 'week-bars' }, ...w.perDay.map((d) => {
          const total = Math.max(d.min ? 6 : 0, (d.min / maxDay) * 100);
          const segs = d.byTheme.map((t) => h('i', { class: 'sg', style: { flex: t.min, background: themeColor(t.theme) }, title: `${themeName(t.theme)} · ${fmtHM(t.min)}` }));
          return h('div', { class: 'wb' + (d.min > 0 ? ' on' : '') + (d.day === todayKey() ? ' today' : '') },
            h('div', { class: 'wb-bar' }, h('div', { class: 'wb-stack', style: { height: total + '%' } }, ...segs)),
            h('span', { class: 'wb-lbl' }, WD[parseYmd(d.day).getDay()]), h('span', { class: 'wb-val num' }, d.min ? fmtHM(d.min) : ''));
        })),
        h('div', { class: 'legend' }, ...Array.from(w.byTheme.keys()).map((th) => h('span', null, h('i', { style: { background: themeColor(th === '__none' ? null : th) } }), themeName(th === '__none' ? null : th)))),
        h('p', { class: 'muted small' }, `${w.studied} of 7 days with study.`)),
      this.focusCard(w, prev),
      this.habitCard(),
      (() => { const ins = this.insights(w, prev); return ins.length ? h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, 'What stands out')), h('ul', { class: 'insights' }, ...ins.map((t) => h('li', null, t)))) : null; })(),
      h('div', { class: 'row', style: { justifyContent: 'center', margin: '14px 0 30px' } },
        h('button', { class: 'btn', onClick: () => { this.week = addDays(this.week, -7); this.render(); } }, '‹ Previous week'),
        h('button', { class: 'btn primary lg', onClick: () => StudyNow.open() }, icon('play'), 'Study now')));
  },
  /* How focused the week felt — the first thing that matters. */
  focusCard(w, prev) {
    const f = focusStats(w.startKey, w.endKey); const fp = focusStats(prev.startKey, prev.endKey);
    if (!f.total) return null;
    const pct = f.share == null ? null : Math.round(f.share * 100);
    const delta = f.rated >= 3 && fp.rated >= 3 ? Math.round((f.share - fp.share) * 100) : null;
    return h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('div', null, h('h2', null, icon('focus'), ' Focus'), h('p', { class: 'sub' }, 'How your blocks felt, from the question asked when each one closes.')),
      pct != null ? h('div', { class: 'focus-big' }, h('b', { class: 'num' }, `${pct}%`), h('span', null, 'focused'), delta != null && delta !== 0 ? h('span', { class: 'tag ' + (delta > 0 ? 'ok' : 'bad') }, `${delta > 0 ? '+' : ''}${delta} vs last week`) : null) : null),
      h('div', { class: 'focus-strip' }, ...f.list.map((s) => h('i', { class: 'fdot ' + (s.meta?.rating || 'none'), title: `${fmtDayShort(dayKeyOf(ms(s.started_at)))} ${hm(ms(s.started_at))} · ${themeName(s.theme)} · ${s.meta?.rating || 'not rated'}` }))),
      h('div', { class: 'bars' }, ...RATINGS.map(([id, label, color]) => { const n = f[id]; const p2 = f.rated ? (n / f.rated) * 100 : 0;
        return h('div', { class: 'bar-row' }, h('span', { class: 'lbl' }, label), h('div', { class: 'bar' }, h('i', { class: 'fill', style: { width: p2 + '%', background: color } })), h('span', { class: 'val num' }, n ? `${n}` : '')); })),
      h('p', { class: 'muted small' }, `${f.rated} of ${f.total} blocks rated${f.unrated ? ` · ${f.unrated} still without an answer` : ''}.`));
  },
  habitCard() {
    const mw = meditationWeek(this.week);
    return h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, icon('brain'), ' Meditation habit'), h('span', { class: 'muted small' }, `goal: ${mw.goal} day${mw.goal === 1 ? '' : 's'} a week`)),
      h('div', { class: 'habit-row' }, ...mw.days.map((d) => h('div', { class: 'habit-day' + (d.done ? ' on' : '') + (d.day === todayKey() ? ' today' : '') + (d.day > todayKey() ? ' later' : '') }, h('i', null, d.done ? '✓' : ''), h('span', null, WD[parseYmd(d.day).getDay()]))),
        h('div', { class: 'habit-sum' }, h('b', { class: 'num' }, `${mw.count}/${mw.goal}`), h('span', { class: 'muted small' }, mw.met ? 'goal met ✓' : this.week === weekStartKey() ? `${mw.left} to go` : 'not reached'))));
  },
  /* Plain observations, never a to-do list. Only from samples big enough to mean something. */
  insights(w, prev) {
    const out = [];
    const themeRows = Array.from(w.byTheme.entries()).sort((a, b) => b[1] - a[1]);
    if (themeRows.length && themeRows[0][1] > 0) out.push(`Most of your time went to ${themeName(themeRows[0][0] === '__none' ? null : themeRows[0][0])} (${fmtHM(themeRows[0][1])}).`);
    const f = focusStats(w.startKey, w.endKey), fp = focusStats(prev.startKey, prev.endKey);
    if (f.rated >= 4) out.push(fp.rated >= 4 ? `${Math.round(f.share * 100)}% of the rated blocks felt focused, against ${Math.round(fp.share * 100)}% the week before.` : `${Math.round(f.share * 100)}% of the rated blocks felt focused.`);
    // meditation and focus, over four weeks
    const from28 = addDays(w.endKey, -27); const medDays = meditationDaySet();
    const onMed = focusStats(from28, w.endKey, (s) => medDays.has(dayKeyOf(ms(s.started_at)))), offMed = focusStats(from28, w.endKey, (s) => !medDays.has(dayKeyOf(ms(s.started_at))));
    if (onMed.rated >= 4 && offMed.rated >= 4 && Math.abs(onMed.share - offMed.share) >= 0.1) out.push(`Over four weeks, on days you meditated ${Math.round(onMed.share * 100)}% of the rated blocks felt focused — ${Math.round(offMed.share * 100)}% on the other days.`);
    if (w.count >= 3 && prev.count >= 3) {
      const diff = w.netMin - prev.netMin;
      if (Math.abs(diff) >= 30) out.push(diff > 0 ? `${fmtHM(diff)} more than the previous week.` : `${fmtHM(-diff)} less than the previous week.`);
    }
    const buckets = rhythmBuckets(addDays(todayKey(), -28)).filter((b) => b.sessions > 0);
    const rated = buckets.filter((b) => b.focus != null && b.ratedN >= 3);
    if (rated.length >= 2) { const best = rated.slice().sort((a, b) => b.focus - a.focus)[0]; out.push(`Your focus has been steadiest around ${best.label}.`); }
    const late = Array.from(lateByDay(w.startKey, w.endKey).values()); const lateMin = late.reduce((a, b) => a + b, 0);
    if (lateMin >= 5) out.push(`Study after ${state.settings.late_from || '23:00'} on ${late.length} day${late.length === 1 ? '' : 's'} (${fmtHM(lateMin)}) — just noting it.`);
    const kinds = { rest: 0, travel: 0, recovery: 0 };
    for (let i = 0; i < 7; i++) { const t = dayType(addDays(w.startKey, i)); if (t in kinds) kinds[t]++; }
    const breaks = Object.entries(kinds).filter(([, n]) => n).map(([k, n]) => `${n} ${k} day${n === 1 ? '' : 's'}`);
    if (breaks.length) out.push(`${breaks.join(', ')} — the streak kept going through ${breaks.length > 1 || Object.values(kinds).reduce((a, b) => a + b, 0) > 1 ? 'them' : 'it'}.`);
    if (w.studied >= 5) out.push(`You studied on ${w.studied} of the 7 days.`);
    return out.slice(0, 5);
  },
};

const AchievementsView = {
  el: null, offs: [],
  mount(root) { this.el = h('div', { class: 'review ach-page' }); root.append(this.el); this.render(); this.offs.push(on('change', () => { if (!RoomView.busy()) this.render(); }), on('achievements', () => this.render())); },
  unmount() { this.offs.forEach((f) => f()); this.offs = []; RoomView.unmount(); },
  render() {
    const list = Achievements.list(); const got = list.filter((a) => a.done).length;
    const books = (state.settings.books || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    setKids(this.el,
      RoomView.card(),
      h('div', { class: 'row between', style: { margin: '6px 0 10px' } }, h('div', null, h('h1', null, icon('award', 'big'), ' Achievements'), h('p', { class: 'muted small' }, `${got} of ${list.length} unlocked · each one adds credits (10 to 200 by rarity)`)), null),
      h('section', { class: 'card' }, h('div', { class: 'progress' }, h('i', { style: { width: (got / list.length) * 100 + '%', background: 'var(--gold)' } }))),
      ...ACH_CATEGORIES.map(([cat, label, ico]) => {
        const items = list.filter((a) => a.cat === cat);
        return h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, icon(ico), ' ', label), h('span', { class: 'muted small' }, `${items.filter((a) => a.done).length}/${items.length}`)),
          h('div', { class: 'ach-grid' }, ...items.map((a) => this.badge(a))));
      }),
      this.booksCard(books));
  },
  booksCard(books) {
    const row = (bk) => h('div', { class: 'book-row' },
      h('div', { class: 'grow' }, h('b', null, bk.title), bk.author ? h('span', { class: 'muted small' }, ` — ${bk.author}`) : null,
        h('div', { class: 'faint small' }, bk.date ? fmtDate(bk.date) : '')),
      h('button', {
        class: 'btn ghost icon sm', 'aria-label': 'Remove',
        onClick: async () => { if (await confirmDialog(`Remove “${bk.title}”?`, { danger: true, okLabel: 'Remove' })) updateSettings({ books: (state.settings.books || []).filter((x) => x.id !== bk.id) }); },
      }, icon('trash')));
    const body = books.length
      ? h('div', { class: 'stack sm' }, ...books.map(row))
      : h('div', { class: 'empty' }, art('endgame'), h('p', { class: 'muted italic small' }, 'No books yet.'));
    return h('section', { class: 'card' },
      h('div', { class: 'card-head' },
        h('div', null, h('h2', null, icon('book'), ` ${books.length} book${books.length === 1 ? '' : 's'} finished`), h('p', { class: 'sub' }, 'Books you have worked through, start to finish.')),
        h('button', { class: 'btn sm primary', onClick: () => this.addBook() }, icon('plus'), 'Add book')),
      body);
  },
  badge(a) {
    const hidden = a.hidden && !a.done;
    return h('div', { class: 'ach' + (a.done ? ' done r-' + a.rarity[0] : ''), title: hidden ? 'Hidden achievement' : a.desc },
      h('span', { class: 'ach-ic' }, hidden ? icon('eye-off') : icon(a.icon)),
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
    const m = openModal({ title: 'Book finished', cls: 'narrow',
      body: h('div', { class: 'stack' }, h('label', { class: 'field' }, h('span', null, 'Book'), title), h('label', { class: 'field' }, h('span', null, 'Author'), author), h('label', { class: 'field' }, h('span', null, 'Finished on'), date)),
      footer: frag(h('button', { class: 'btn', onClick: () => m.close() }, 'Cancel'), h('button', { class: 'btn primary', onClick: save }, 'Register')) });
    setTimeout(() => title.focus(), 30);
  },
};
