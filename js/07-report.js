/* ===== Study report page (#/report) ===== */
const ReportView = {
  months: 12, days: 30, el: null, offs: [],
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
      h('section', { class: 'card notes-section' }, h('div', { class: 'card-head' }, h('h2', null, 'Notes in the period')),
        notes.length ? h('div', { class: 'stack' }, ...notes.map((s) => { const tm = sessionTimes(s); return h('div', { class: 'note-item', style: { '--c': themeColor(s.theme) } }, h('div', { class: 'small muted' }, `${fmtDayShort(dayKeyOf(tm.start))} · ${fmtRange(tm.start, tm.end)} · ${themeName(s.theme)} · ${fmtHM(tm.net / MIN)}`), h('div', { class: 'md', html: renderMd(s.note_md) })); }))
          : h('p', { class: 'muted italic' }, `No notes in the last ${this.days} days.`)));
  },
};
