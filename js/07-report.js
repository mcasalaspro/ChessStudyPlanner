/* ===== Study report page (#/report) ===== */
const ReportView = {
  months: 12, days: 30, rhythmPeriod: 28, rhythmMetric: 'focus', el: null, offs: [],
  mount(root) { this.el = h('div', { class: 'report' }); root.append(this.el); this.render(); this.offs.push(on('change', () => this.render())); },
  unmount() { this.offs.forEach((f) => f()); this.offs = []; },
  render() {
    const name = state.settings.name || (Auth.user?.email ? Auth.user.email.split('@')[0] : 'Student');
    const monthsData = monthlyTotals(this.months); const totalAll = monthsData.reduce((a, m) => a + m.total, 0); const max = Math.max(60, ...monthsData.map((m) => m.total));
    const bars = h('div', { class: 'mbars', style: { '--n': monthsData.length } }, ...monthsData.map((m) => {
      const segs = themes().map((th) => [th.color, m.byTheme.get(th.id) || 0]).filter(([, v]) => v > 0); const none = m.byTheme.get('__none') || 0; if (none) segs.push(['#8a9bb3', none]);
      return h('div', { class: 'mbar' }, h('div', { class: 'stack-col' }, h('span', { class: 'mval num' }, m.total ? (m.total >= 60 ? `${Math.round(m.total / 60)}h` : `${Math.round(m.total)}min`) : ''), h('div', { class: 'col', style: { height: (m.total / max) * 100 + '%' } }, ...segs.map(([c, v]) => h('i', { style: { flex: v, background: c } })))), h('span', { class: 'mlbl' }, m.label));
    }));
    const missions = activeMissions();
    const days = Array.from({ length: this.days }, (_, i) => addDays(todayKey(), -(this.days - 1 - i)));
    const notes = state.sessions.filter((s) => isLive(s) && s.ended_at && s.note_md && dayKeyOf(ms(s.started_at)) >= days[0]).sort((a, b) => a.started_at.localeCompare(b.started_at));
    setKids(this.el,
      h('div', { class: 'report-title' }, h('h1', null, `${name} — Study report`), h('p', { class: 'muted small' }, fmtDate(new Date(nowMs())))),
      h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, 'Overview'), segmented([[3, 'Quarter'], [12, 'Year']], this.months, (v) => { this.months = v; this.render(); }, 'sm')),
        h('div', { class: 'mbars-wrap' }, bars), h('p', { class: 'muted small center' }, `${fmtHM(totalAll)} over the last ${this.months} months`)),
      h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, 'Missions and deadlines')),
        missions.length ? h('div', { class: 'mission-list' }, ...missions.map((m) => {
          const st = missionStats(m); const pct = Math.round(st.progress * 100);
          return h('div', { class: 'mission-row static', style: { '--c': themeColor(m.theme) } },
            h('div', { class: 'row between' }, h('span', { class: 'row' }, themeDot(m.theme), h('b', null, m.name), h('span', { class: 'muted small' }, themeName(m.theme))), h('b', { class: 'num' }, `${pct}%`)),
            h('div', { class: 'progress' }, h('i', { style: { width: pct + '%' } })),
            h('div', { class: 'muted small' }, `${fmtHM(st.done)} of ${m.goal_hours}h`, m.deadline ? ` · due ${fmtDate(m.deadline)}` : '',
              st.complete || m.status === 'done' ? ' · ✓ done' : st.daysLeft != null && st.daysLeft > 0 ? ` · ${st.daysLeft} days left (${dec1(st.perDay / 60)}h/day)` : st.overdue ? ' · overdue' : ''));
        })) : h('p', { class: 'muted italic' }, 'No missions yet — create one on the main page.')),
      h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, 'Study calendar'), segmented([[30, '30 days'], [60, '60 days'], [90, '90 days']], this.days, (v) => { this.days = v; this.render(); }, 'sm')),
        h('p', { class: 'sub' }, 'Rows = days, columns = hours.'), h('div', { class: 'tl-wrap' }, Calendar.buildGrid(days, false)),
        h('div', { class: 'legend' }, ...themes().map((th) => h('span', null, h('i', { style: { background: th.color } }), th.name)))),
      (() => {
        const fromKey = this.rhythmPeriod ? addDays(todayKey(), -this.rhythmPeriod) : null;
        const buckets = rhythmBuckets(fromKey).filter((b) => b.sessions > 0);
        const totalSessions = buckets.reduce((a, b) => a + b.sessions, 0);
        const distinctDays = buckets.reduce((a, b) => a + b.days, 0);
        const metric = this.rhythmMetric;
        const valueOf = (b) => metric === 'focus' ? (b.focus == null ? 0 : b.focus) : metric === 'time' ? b.minutes : b.sessions;
        const max = Math.max(0.0001, ...buckets.map(valueOf));
        // Only say something about "when you study best" with enough sessions spread over enough days.
        const reliable = totalSessions >= 8 && distinctDays >= 4;
        const rated = buckets.filter((b) => b.focus != null && b.sessions >= 2);
        const bestFocus = rated.slice().sort((a, b) => b.focus - a.focus)[0];
        const bestTime = buckets.slice().sort((a, b) => b.minutes - a.minutes)[0];
        return h('section', { class: 'card' },
          h('div', { class: 'card-head' }, h('div', null, h('h2', null, 'Your rhythm'), h('p', { class: 'sub' }, 'When do you tend to study best? The app observes; it does not prescribe.')),
            h('div', { class: 'row' },
              segmented([[28, '4 weeks'], [90, '3 months'], [0, 'All time']], this.rhythmPeriod, (v) => { this.rhythmPeriod = v; this.render(); }, 'sm'),
              segmented([['focus', 'Focus'], ['time', 'Time'], ['sessions', 'Sessions']], metric, (v) => { this.rhythmMetric = v; this.render(); }, 'sm'))),
          buckets.length ? frag(
            h('div', { class: 'rhythm' }, ...buckets.map((b) => {
              const v = valueOf(b); const stars = Math.max(1, Math.round((v / max) * 5));
              const label = metric === 'focus' ? (b.focus == null ? 'not rated' : `${Math.round(b.focus * 100)}%`) : metric === 'time' ? fmtHM(b.minutes) : `${b.sessions}`;
              return h('div', { class: 'rh-row' }, h('span', { class: 'rh-lbl num' }, b.label),
                h('span', { class: 'rh-stars', title: `${b.sessions} sessions · ${fmtHM(b.minutes)}` }, metric === 'focus' && b.focus == null ? '—' : '★'.repeat(stars) + '☆'.repeat(5 - stars)),
                h('span', { class: 'rh-val muted small' }, label));
            })),
            h('p', { class: 'muted small', style: { marginTop: '8px' } }, reliable
              ? (metric === 'focus' && bestFocus ? `In your recent sessions, ${bestFocus.label} shows up as your most consistent window.`
                : bestTime ? `You study most around ${bestTime.label}.` : '')
              : 'Not enough sessions yet to draw conclusions — keep logging and this fills in.'),
            reliable && bestFocus && bestTime && bestFocus.label !== bestTime.label
              ? h('p', { class: 'muted small' }, `You study more around ${bestTime.label}, but your focus is better around ${bestFocus.label}.`) : null)
            : h('p', { class: 'muted italic small' }, 'No sessions in this period.'));
      })(),
      h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, '🏆 Achievements'), h('a', { class: 'btn sm', href: '#/achievements' }, 'Open')),
        (() => { const list = Achievements.list(); const got = list.filter((a) => a.done); return frag(
          h('p', { class: 'sub' }, `${got.length} of ${list.length} unlocked · ${(state.settings.books || []).length} books finished`),
          h('div', { class: 'ach-strip' }, ...got.slice(-10).map((a) => h('span', { class: 'ach-chip', title: `${a.name} — ${a.desc}` }, a.icon)))); })()),
      h('section', { class: 'card notes-section' }, h('div', { class: 'card-head' }, h('h2', null, 'Notes in the period')),
        notes.length ? h('div', { class: 'stack' }, ...notes.map((s) => { const tm = sessionTimes(s); return h('div', { class: 'note-item', style: { '--c': themeColor(s.theme) } }, h('div', { class: 'small muted' }, `${fmtDayShort(dayKeyOf(tm.start))} · ${fmtRange(tm.start, tm.end)} · ${themeName(s.theme)} · ${fmtHM(tm.net / MIN)}`), h('div', { class: 'md', html: renderMd(s.note_md) })); }))
          : h('p', { class: 'muted italic' }, `No notes in the last ${this.days} days.`)));
  },
};
