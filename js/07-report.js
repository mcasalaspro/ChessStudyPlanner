/* ===== Study report (#/report) — the long view, built like the weekly review ===== */
const ReportView = {
  period: 90, months: 12, days: 30, rhythmMetric: 'focus', el: null, offs: [],
  mount(root) { this.el = h('div', { class: 'review report' }); root.append(this.el); this.render(); this.offs.push(on('change', () => this.render())); },
  unmount() { this.offs.forEach((f) => f()); this.offs = []; },
  range() { return this.period ? [addDays(todayKey(), -(this.period - 1)), todayKey()] : [null, null]; },
  periodLabel() { return this.period === 30 ? 'last 30 days' : this.period === 90 ? 'last 90 days' : this.period === 365 ? 'last 12 months' : 'all time'; },

  render() {
    const name = state.settings.name || (Auth.user?.email ? Auth.user.email.split('@')[0] : 'Student');
    const [from, to] = this.range();
    const stats = themeBreakdown(from, to);
    const byDay = netByDay(from, to);
    const studiedDays = Array.from(byDay.values()).filter((v) => v.net > 0).length;
    const spanDays = this.period || Math.max(1, (Array.from(byDay.keys()).sort()[0] ? daysBetween(Array.from(byDay.keys()).sort()[0], todayKey()) + 1 : 1));
    const rec = recordDay(from, to);
    const sk = streakInfo();
    const longest = sessionsInRange(from, to).reduce((a, s) => Math.max(a, sessionTimes(s).net / MIN), 0);

    setKids(this.el,
      h('div', { class: 'row between report-head' },
        h('div', null, h('h1', null, `${name} — Study report`), h('p', { class: 'muted small' }, `${fmtDate(new Date(nowMs()))} · ${this.periodLabel()}`)),
        segmented([[30, '30 days'], [90, '90 days'], [365, '12 months'], [0, 'All time']], this.period, (v) => { this.period = v; this.render(); }, 'sm')),

      /* --- the numbers --- */
      h('section', { class: 'card' }, h('div', { class: 'stats wide four' },
        this.kpi(fmtHM(stats.total), 'studied'),
        this.kpi(String(stats.sessions), stats.sessions === 1 ? 'block' : 'blocks'),
        this.kpi(`${studiedDays}`, `days studied of ${spanDays}`),
        this.kpi(fmtHM(studiedDays ? stats.total / studiedDays : 0), 'avg / day studied'),
        this.kpi(fmtHM(stats.total / Math.max(1, spanDays)), 'avg / calendar day'),
        this.kpi(rec.min ? fmtHM(rec.min) : '—', rec.day ? `record day · ${fmtDayShort(rec.day)}` : 'record day'),
        this.kpi(fmtHM(longest), 'longest block'),
        this.kpi(`${sk.current}`, `day streak · best ${sk.best}`))),

      /* --- study areas --- */
      h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('div', null, h('h2', null, 'Study areas'), h('p', { class: 'sub' }, 'Where the hours went in this period.'))),
        stats.rows.length ? this.areaTable(stats) : h('div', { class: 'empty' }, art('journey'), h('p', { class: 'muted italic small' }, 'No blocks in this period.'))),

      /* --- month by month --- */
      this.monthsCard(),

      /* --- weekday profile --- */
      this.weekdayCard(from, to),

      /* --- block length --- */
      this.lengthCard(from, to),

      /* --- rhythm --- */
      this.rhythmCard(from),

      /* --- missions --- */
      this.missionsCard(),

      /* --- calendar --- */
      this.calendarCard(),

      /* --- achievements --- */
      this.achievementsCard(),

      /* --- notes --- */
      this.notesCard(from));
  },

  kpi(v, l) { return h('div', null, h('b', null, v), h('span', null, l)); },

  areaTable(stats) {
    const max = Math.max(1, ...stats.rows.map((r) => r.min));
    return frag(
      h('div', { class: 'area-table' },
        h('div', { class: 'area-row head' }, h('span', null, 'Area'), h('span', null, ''), h('span', { class: 'num' }, 'Time'), h('span', { class: 'num' }, 'Share'), h('span', { class: 'num' }, 'Blocks'), h('span', { class: 'num' }, 'Avg')),
        ...stats.rows.map((r) => h('div', { class: 'area-row' },
          h('span', { class: 'row' }, themeDot(r.theme), themeName(r.theme)),
          h('span', { class: 'bar' }, h('i', { class: 'fill', style: { width: (r.min / max) * 100 + '%', background: themeColor(r.theme) } })),
          h('b', { class: 'num' }, fmtHM(r.min)),
          h('span', { class: 'num muted' }, `${Math.round(r.share * 100)}%`),
          h('span', { class: 'num muted' }, String(r.count)),
          h('span', { class: 'num muted' }, fmtHM(r.avg)))),
        h('div', { class: 'area-row total' }, h('b', null, 'Total'), h('span', null, ''), h('b', { class: 'num' }, fmtHM(stats.total)), h('span', { class: 'num muted' }, '100%'), h('b', { class: 'num' }, String(stats.sessions)), h('span', { class: 'num muted' }, fmtHM(stats.sessions ? stats.total / stats.sessions : 0)))));
  },

  monthsCard() {
    const data = monthlyTotals(this.months);
    const withData = data.filter((m) => m.total > 0);
    const total = data.reduce((a, m) => a + m.total, 0);
    const max = Math.max(60, ...data.map((m) => m.total));
    const best = withData.slice().sort((a, b) => b.total - a.total)[0];
    const avg = withData.length ? total / withData.length : 0;
    const bars = h('div', { class: 'mbars', style: { '--n': data.length } }, ...data.map((m) => {
      const segs = themes().map((th) => [th.color, m.byTheme.get(th.id) || 0]).filter(([, v]) => v > 0);
      const none = m.byTheme.get('__none') || 0; if (none) segs.push(['#8a9bb3', none]);
      return h('div', { class: 'mbar' + (m.total ? '' : ' empty') },
        h('div', { class: 'stack-col' }, h('span', { class: 'mval num' }, m.total ? fmtHM(m.total) : ''),
          h('div', { class: 'col', style: { height: (m.total / max) * 100 + '%' } }, ...segs.map(([c, v]) => h('i', { style: { flex: v, background: c } })))),
        h('span', { class: 'mlbl' }, m.label));
    }));
    return h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('div', null, h('h2', null, 'Month by month'), h('p', { class: 'sub' }, `${fmtHM(total)} in the window · ${withData.length} month${withData.length === 1 ? '' : 's'} with study`)),
        segmented([[3, 'Quarter'], [6, '6 months'], [12, 'Year']], this.months, (v) => { this.months = v; this.render(); }, 'sm')),
      h('div', { class: 'mbars-wrap' }, bars),
      h('p', { class: 'muted small center' }, best ? `Best month: ${best.label} with ${fmtHM(best.total)} · average of ${fmtHM(avg)} per active month` : 'No data yet.'));
  },

  weekdayCard(from, to) {
    const wd = weekdayTotals(from, to);
    const order = [1, 2, 3, 4, 5, 6, 0]; // Monday first
    const max = Math.max(30, ...wd.map((x) => x.min));
    const best = order.map((i) => ({ i, ...wd[i] })).sort((a, b) => b.min - a.min)[0];
    return h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('div', null, h('h2', null, 'Day of the week'), h('p', { class: 'sub' }, 'Total in the period and the average of the days you actually studied.'))),
      h('div', { class: 'week-bars' }, ...order.map((i) => {
        const d = wd[i]; const hpct = Math.max(d.min ? 6 : 0, (d.min / max) * 100);
        return h('div', { class: 'wb' + (d.min > 0 ? ' on' : '') },
          h('div', { class: 'wb-bar' }, h('div', { class: 'wb-stack', style: { height: hpct + '%' } }, ...d.byTheme.map((t) => h('i', { class: 'sg', style: { flex: t.min, background: themeColor(t.theme) }, title: `${themeName(t.theme)} · ${fmtHM(t.min)}` })))),
          h('span', { class: 'wb-lbl' }, WD[i]), h('span', { class: 'wb-val num' }, d.min ? fmtHM(d.min) : ''),
          h('span', { class: 'wb-sub faint' }, d.days ? `${fmtHM(d.avg)}/day` : ''));
      })),
      best && best.min ? h('p', { class: 'muted small' }, `${WD_LONG[best.i].charAt(0).toUpperCase() + WD_LONG[best.i].slice(1)} is your strongest day: ${fmtHM(best.min)} in total.`) : null);
  },

  lengthCard(from, to) {
    const hist = lengthHistogram(from, to);
    const total = hist.reduce((a, b) => a + b.count, 0);
    const max = Math.max(1, ...hist.map((b) => b.count));
    if (!total) return null;
    const typical = hist.slice().sort((a, b) => b.count - a.count)[0];
    return h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('div', null, h('h2', null, 'Block length'), h('p', { class: 'sub' }, 'How long your study blocks tend to be.'))),
      h('div', { class: 'bars' }, ...hist.map((b) => h('div', { class: 'bar-row' },
        h('span', { class: 'lbl' }, b.label),
        h('div', { class: 'bar' }, h('i', { class: 'fill', style: { width: (b.count / max) * 100 + '%', background: 'var(--green)' } })),
        h('span', { class: 'val num' }, b.count ? `${b.count} · ${fmtHM(b.min)}` : '')))),
      h('p', { class: 'muted small' }, `Most of your blocks fall in the ${typical.label} range (${Math.round((typical.count / total) * 100)}% of ${total}).`));
  },

  rhythmCard(from) {
    const buckets = rhythmBuckets(from).filter((b) => b.sessions > 0);
    const totalSessions = buckets.reduce((a, b) => a + b.sessions, 0);
    const distinctDays = buckets.reduce((a, b) => a + b.days, 0);
    const metric = this.rhythmMetric;
    const valueOf = (b) => metric === 'focus' ? (b.focus == null ? 0 : b.focus) : metric === 'time' ? b.minutes : b.sessions;
    const max = Math.max(0.0001, ...buckets.map(valueOf));
    const reliable = totalSessions >= 8 && distinctDays >= 4;
    const rated = buckets.filter((b) => b.focus != null && b.sessions >= 2);
    const bestFocus = rated.slice().sort((a, b) => b.focus - a.focus)[0];
    const bestTime = buckets.slice().sort((a, b) => b.minutes - a.minutes)[0];
    return h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('div', null, h('h2', null, 'Time of day'), h('p', { class: 'sub' }, 'When you study, and when it feels sharpest. The app observes; it does not prescribe.')),
        segmented([['focus', 'Focus'], ['time', 'Time'], ['sessions', 'Blocks']], metric, (v) => { this.rhythmMetric = v; this.render(); }, 'sm')),
      buckets.length ? frag(
        h('div', { class: 'rhythm' }, ...buckets.map((b) => {
          const v = valueOf(b); const stars = Math.max(1, Math.round((v / max) * 5));
          const label = metric === 'focus' ? (b.focus == null ? 'not rated' : `${Math.round(b.focus * 100)}%`) : metric === 'time' ? fmtHM(b.minutes) : `${b.sessions}`;
          return h('div', { class: 'rh-row' }, h('span', { class: 'rh-lbl num' }, b.label),
            h('span', { class: 'rh-stars', title: `${b.sessions} blocks · ${fmtHM(b.minutes)}` }, metric === 'focus' && b.focus == null ? '—' : '★'.repeat(stars) + '☆'.repeat(5 - stars)),
            h('span', { class: 'rh-val muted small' }, label));
        })),
        h('p', { class: 'muted small', style: { marginTop: '8px' } }, reliable
          ? (metric === 'focus' && bestFocus ? `In your recent blocks, ${bestFocus.label} is your most consistent window.` : bestTime ? `You study most around ${bestTime.label}.` : '')
          : 'Not enough blocks yet to draw conclusions — keep logging and this fills in.'),
        reliable && bestFocus && bestTime && bestFocus.label !== bestTime.label
          ? h('p', { class: 'muted small' }, `You study more around ${bestTime.label}, but your focus is better around ${bestFocus.label}.`) : null)
        : h('p', { class: 'muted italic small' }, 'No blocks in this period.'));
  },

  missionsCard() {
    const missions = activeMissions();
    return h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, 'Missions and deadlines')),
      missions.length ? h('div', { class: 'mission-list' }, ...missions.map((m) => {
        const st = missionStats(m); const pct = Math.round(st.progress * 100);
        return h('div', { class: 'mission-row static', style: { '--c': themeColor(m.theme) } },
          h('div', { class: 'row between' }, h('span', { class: 'row' }, themeDot(m.theme), h('b', null, m.name), h('span', { class: 'muted small' }, themeName(m.theme))), h('b', { class: 'num' }, `${pct}%`)),
          h('div', { class: 'progress' }, h('i', { style: { width: pct + '%' } })),
          h('div', { class: 'muted small' }, `${fmtHM(st.done)} of ${m.goal_hours}h`, m.deadline ? ` · due ${fmtDate(m.deadline)}` : '',
            st.complete || m.status === 'done' ? ' · done' : st.daysLeft != null && st.daysLeft > 0 ? ` · ${st.daysLeft} days left (${dec1(st.perDay / 60)}h/day)` : st.overdue ? ' · overdue' : ''));
      })) : h('div', { class: 'empty' }, art('journey'), h('p', { class: 'muted italic' }, 'No missions yet — create one on the main page.')));
  },

  calendarCard() {
    const days = Array.from({ length: this.days }, (_, i) => addDays(todayKey(), -(this.days - 1 - i)));
    return h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', null, 'Study calendar'), segmented([[30, '30 days'], [60, '60 days'], [90, '90 days']], this.days, (v) => { this.days = v; this.render(); }, 'sm')),
      h('p', { class: 'sub' }, 'Rows = days, columns = hours.'), h('div', { class: 'tl-wrap' }, Calendar.buildGrid(days, false)),
      h('div', { class: 'legend' }, ...themes().map((th) => h('span', null, h('i', { style: { background: th.color } }), th.name))));
  },

  achievementsCard() {
    const list = Achievements.list(); const got = list.filter((a) => a.done);
    const books = (state.settings.books || []).length;
    return h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('div', null, h('h2', null, icon('award'), ' Achievements'), h('p', { class: 'sub' }, `${got.length} of ${list.length} unlocked · ${books} book${books === 1 ? '' : 's'} finished`)),
        h('a', { class: 'btn sm', href: '#/achievements' }, 'Open')),
      got.length ? h('div', { class: 'ach-strip' }, ...got.slice(-12).map((a) => h('span', { class: 'ach-chip' + (a.tier >= 4 ? ' gold' : ''), title: `${a.name} — ${a.desc}` }, icon(a.icon), h('span', { class: 'ach-chip-name' }, a.name))))
        : h('p', { class: 'muted italic small' }, 'Nothing unlocked yet.'));
  },

  notesCard(from) {
    const notes = state.sessions.filter((s) => isLive(s) && !isTournament(s) && s.ended_at && s.note_md && (!from || dayKeyOf(ms(s.started_at)) >= from)).sort((a, b) => b.started_at.localeCompare(a.started_at));
    return h('section', { class: 'card notes-section' }, h('div', { class: 'card-head' }, h('h2', null, 'Notes'), h('span', { class: 'muted small' }, `${notes.length} block${notes.length === 1 ? '' : 's'} with notes`)),
      notes.length ? h('div', { class: 'stack' }, ...notes.slice(0, 60).map((s) => { const tm = sessionTimes(s);
        return h('div', { class: 'note-item', style: { '--c': themeColor(s.theme) } },
          h('div', { class: 'small muted' }, `${fmtDayShort(dayKeyOf(tm.start))} · ${fmtRange(tm.start, tm.end)} · ${themeName(s.theme)} · ${fmtHM(tm.net / MIN)}`),
          h('div', { class: 'md', html: renderMd(s.note_md) })); }))
        : h('p', { class: 'muted italic small' }, 'No notes in this period.'));
  },
};
