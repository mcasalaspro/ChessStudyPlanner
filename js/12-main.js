/* ===== App ===== */
const App = {
  mode: 'local', mounted: false, currentView: null,
  async boot() {
    Drawer.ensure();
    this.renderHeader();
    const mode = await Auth.init();
    if (mode === 'nolib') { setKids($('#view'), h('div', { class: 'login' }, h('div', { class: 'card' }, h('h1', null, 'Chess Study Planner'), h('p', { class: 'muted' }, 'Não foi possível carregar a biblioteca de acesso (Supabase). Verifique a conexão com a internet e recarregue a página.'), h('button', { class: 'btn primary', style: { marginTop: '14px' }, onClick: () => location.reload() }, 'Recarregar')))); return; }
    this.mode = mode;
    if (mode === 'cloud' && !Auth.user) { Auth.renderLogin($('#view')); this.renderHeader(); return; }
    this.startSession();
  },
  onAuthChange() { if (Auth.user && !this.mounted) this.startSession(); else if (!Auth.user && this.mounted) { location.reload(); } },
  startSession() {
    if (this.mode === 'cloud') { setStorageUser(Auth.user.id); loadState(); Sync.init(Auth.client, Auth.user.id); }
    else { setStorageUser('local'); loadState(); }
    this.mounted = true;
    window.addEventListener('hashchange', () => this.route());
    document.addEventListener('keydown', (e) => this.shortcuts(e));
    on('tick', () => this.updateLivePill()); on('change', () => { this.updateLivePill(); });
    on('sync', (s) => this.updateSyncPill(s));
    document.addEventListener('visibilitychange', () => { Clock.resync(); if (!document.hidden) { Timer.tick(); if (runningSession()) Timer.ensureLoops(); } Timer.heartbeat(); });
    window.addEventListener('pagehide', () => Timer.heartbeat());
    this.route(); this.renderHeader();
    Timer.hydrate();
    if (this.mode === 'cloud') { Sync.pull().then(() => this.offerLocalImport()); }
    else showBanner('local-mode', { text: 'Modo local: os dados ficam só neste navegador. Para usar login e sincronização, preencha o arquivo config.js (veja o README).' });
  },
  /* first login on a browser that has data from local mode → offer to bring it into the account */
  offerLocalImport() {
    try {
      const raw = localStorage.getItem('csp:v2:local'); if (!raw) return; const p = JSON.parse(raw); if (!p.sessions?.length) return;
      showBanner('local-import', { text: `Há ${p.sessions.length} blocos salvos no modo local deste navegador. Quer importá-los para esta conta?`, actions: [
        { label: 'Importar', primary: true, onClick: () => { hideBanner('local-import'); const r = importJson({ app: 'chess-study-planner', version: 2, sessions: p.sessions, missions: p.missions || [] }); localStorage.removeItem('csp:v2:local'); toast(`Importados ${r.n} blocos`); } },
        { label: 'Descartar', onClick: () => { hideBanner('local-import'); localStorage.removeItem('csp:v2:local'); } }] });
    } catch { /* */ }
  },
  route() {
    const hash = location.hash.replace(/^#\/?/, '');
    const root = $('#view'); Drawer.close();
    if (this.currentView && this.currentView.unmount) this.currentView.unmount();
    root.replaceChildren();
    if (hash.startsWith('relatorio')) { this.currentView = ReportView; ReportView.mount(root); document.body.dataset.page = 'report'; }
    else {
      document.body.dataset.page = 'main'; this.currentView = null;
      TimerCard.mount(root); ManualCard.mount(root); MissionsCard.mount(root); Calendar.mount(root); ReportsCard.mount(root);
    }
    this.renderHeader(); window.scrollTo({ top: 0 });
  },
  renderHeader() {
    const isReport = location.hash.replace(/^#\/?/, '').startsWith('relatorio');
    const cfg = window.CSP_CONFIG || {};
    const actions = $('#top-actions');
    setKids(actions,
      this.mode === 'cloud' && Auth.user ? h('span', { class: 'sync-pill ' + Sync.status, id: 'sync-pill', title: 'Sincronização' }, h('i', { class: 'dot' }), h('span', { class: 'txt' }, this.syncLabel(Sync.status))) : null,
      h('button', { class: 'live-pill', id: 'live-pill', type: 'button', title: 'Ir para o cronômetro', onClick: () => { location.hash = ''; setTimeout(() => $('#card-timer')?.scrollIntoView({ behavior: 'smooth' }), 50); } }, h('i', { class: 'dot' }), h('span', { class: 'txt num' }, '00:00')),
      this.mounted ? (isReport ? frag(h('button', { class: 'btn primary', onClick: () => window.print() }, '⬇ Salvar PDF'), h('a', { class: 'btn', href: '#/' }, 'Voltar')) : frag(h('a', { class: 'btn', href: '#/relatorio' }, '📄 Relatório de estudos'), h('button', { class: 'btn icon', title: 'Configurações', 'aria-label': 'Configurações', onClick: () => Panel.settings() }, '⚙'), cfg.homeUrl ? h('a', { class: 'btn', href: cfg.homeUrl }, 'Voltar') : null)) : null);
    this.updateLivePill();
  },
  syncLabel(s) { return { idle: 'Sincronizado', saving: 'Salvando…', offline: 'Offline', error: 'Erro ao sincronizar', off: '' }[s] || ''; },
  updateSyncPill(s) { const p = $('#sync-pill'); if (!p) return; p.className = 'sync-pill ' + s; $('.txt', p).textContent = this.syncLabel(s); p.title = s === 'error' ? 'Não foi possível salvar na nuvem. Os dados ficam guardados neste navegador e serão enviados quando a conexão voltar.' : 'Sincronização'; },
  updateLivePill() {
    const pill = $('#live-pill'); if (!pill) return; const r = runningSession(); const st = Timer.status();
    pill.className = 'live-pill' + (r ? ' on ' + st : '');
    if (r) $('.txt', pill).textContent = fmtClock(sessionTimes(r).net);
  },
  shortcuts(e) {
    if (Focus.isOpen() || modalStack.length) return;
    const tag = document.activeElement?.tagName; const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) { if (undoLast()) { e.preventDefault(); toast('Desfeito'); } return; }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.body.dataset.page !== 'main') return;
    const k = e.key.toLowerCase();
    if (k === 'f') { e.preventDefault(); Focus.open(); }
    else if (k === ' ' && !e.target.closest('.blk, button, a')) { e.preventDefault(); const st = Timer.status(); if (st === 'idle') { const b = $('#btn-start'); b && b.click(); } else if (st === 'running') Timer.pause(); else Timer.resume(); }
    else if (k === 'n' && runningSession()) { e.preventDefault(); const ta = $('.quick-note textarea'); ta && ta.focus(); }
  },
};
document.addEventListener('DOMContentLoaded', () => App.boot());
