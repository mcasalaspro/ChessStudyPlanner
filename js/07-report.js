/* ===== Relatório de estudos (página #/relatorio) ===== */
const ReportView = {
  months: 12, days: 30, el: null, offs: [],
  mount(root) { this.el = h('div', { class: 'report' }); root.append(this.el); this.render(); this.offs.push(on('change', () => this.render())); },
  unmount() { this.offs.forEach((f) => f()); this.offs = []; },
  render() {
    const name = state.settings.name || (Auth.user?.email ? Auth.user.email.split('@')[0] : 'Estudante');
    const monthsData = monthlyTotals(this.months); const totalAll = monthsData.reduce((a, m) => a + m.total, 0); const max = Math.max(60, ...monthsData.map((m) => m.total));
    const bars = h('div', { class: 'mbars', style: { '--n': monthsData.length } }, ...monthsData.map((m) => {
      const segs = themes().map((th) => [th.color, m.byTheme.get(th.id) || 0]).filter(([, v]) => v > 0); const none = m.byTheme.get('__none') || 0; if (none) segs.push(['#8a9bb3', none]);
      return h('div', { class: 'mbar' }, h('div', { class: 'stack-col' }, h('span', { class: 'mval num' }, m.total ? (m.total >= 60 ? `${Math.round(m.total / 60)}h` : `${Math.round(m.total)}min`) : ''), h('div', { class: 'col', style: { height: (m.total / max) * 100 + '%' } }, ...segs.map(([c, v]) => h('i', { style: { flex: v, background: c } })))), h('span', { class: 'mlbl' }, m.label.charAt(0).toUpperCase() + m.label.slice(1)));
    }));
    const missions = activeMissions();
    const days = Array.from({ length: this.days }, (_, i) => addDays(todayKey(), -(this.days - 1 - i)));
    setKids(this.el,
      h('div', { class: 'report-title' }, h('h1', null, `${name} — Relatório de estudos`), h('p', { class: 'muted small' }, fmtDateBr(new Date(nowMs())))),
      h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, 'Visão geral'), segmented([[3, 'Trimestre'], [12, 'Ano']], this.months, (v) => { this.months = v; this.render(); })),
        h('div', { class: 'mbars-wrap' }, bars), h('p', { class: 'muted small center' }, `${fmtHM(totalAll)} nos últimos ${this.months} meses`)),
      h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, 'Missões e prazos')),
        missions.length ? h('div', { class: 'mission-list' }, ...missions.map((m) => { const st = missionStats(m); const pct = Math.round(st.progress * 100); return h('div', { class: 'mission-row static', style: { '--c': themeColor(m.theme) } }, h('div', { class: 'row between' }, h('span', { class: 'row' }, themeDot(m.theme), h('b', null, m.name), h('span', { class: 'muted small' }, themeName(m.theme))), h('b', { class: 'num' }, `${pct}%`)), h('div', { class: 'progress' }, h('i', { style: { width: pct + '%' } })), h('div', { class: 'muted small' }, `${fmtHM(st.done)} de ${m.goal_hours}h`, m.deadline ? ` · prazo ${fmtDateBr(m.deadline)}` : '', st.daysLeft != null && st.daysLeft > 0 && !st.complete ? ` · faltam ${st.daysLeft} dias (${(st.perDay / 60).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h/dia)` : st.complete || m.status === 'done' ? ' · ✓ concluída' : st.overdue ? ' · prazo vencido' : '')); })) : h('p', { class: 'muted italic' }, 'Nenhuma missão ainda — crie uma na página principal.')),
      h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', null, 'Calendário de estudo'), segmented([[30, '30 dias'], [60, '60 dias'], [90, '90 dias']], this.days, (v) => { this.days = v; this.render(); })),
        h('p', { class: 'sub' }, 'Linhas = dias, colunas = horas.'), h('div', { class: 'tl-wrap' }, Calendar.buildGrid(days, false)),
        h('div', { class: 'legend' }, ...themes().map((th) => h('span', null, h('i', { style: { background: th.color } }), th.name)))),
      h('section', { class: 'card notes-section' }, h('div', { class: 'card-head' }, h('h2', null, 'Comentários do período')),
        (() => { const list = state.sessions.filter((s) => isLive(s) && s.ended_at && s.note_md && dayKeyOf(ms(s.started_at)) >= days[0]).sort((a, b) => a.started_at.localeCompare(b.started_at)); return list.length ? h('div', { class: 'stack' }, ...list.map((s) => { const tm = sessionTimes(s); return h('div', { class: 'note-item', style: { '--c': themeColor(s.theme) } }, h('div', { class: 'small muted' }, `${fmtDayShort(dayKeyOf(tm.start))} · ${fmtRange(tm.start, tm.end)} · ${themeName(s.theme)} · ${fmtHM(tm.net / MIN)}`), h('div', { class: 'md', html: renderMd(s.note_md) })); })) : h('p', { class: 'muted italic' }, 'Nenhum comentário nos últimos ' + this.days + ' dias.'); })()));
  },
};
