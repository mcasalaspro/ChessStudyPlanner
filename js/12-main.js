/* ===== App ===== */
const App = {
  mounted: false, currentView: null,
  async boot() {
    Drawer.ensure();
    document.body.dataset.page = 'login';
    this.renderHeader();
    const mode = await Auth.init();
    if (mode !== 'cloud') { this.blockedScreen(mode); return; }
    if (!Auth.user) { Auth.renderLogin($('#view')); this.renderHeader(); return; }
    this.startSession();
  },
  /* The app always works against the online database: no offline-only mode that could silently lose data. */
  blockedScreen(mode) {
    const msg = mode === 'nolib'
      ? 'Could not load the sign-in library. Check your internet connection and reload the page.'
      : 'This copy is not connected to a database yet. Open config.js and put the project URL and key inside the quotes.';
    setKids($('#view'), h('div', { class: 'login' }, h('div', { class: 'card' }, h('img', { src: 'assets/logo.png', alt: '' }), h('h1', null, 'Chess Study Planner'), h('p', { class: 'muted' }, msg),
      h('button', { class: 'btn primary', style: { marginTop: '14px' }, onClick: () => location.reload() }, 'Reload'))));
  },
  onAuthChange() { if (Auth.user && !this.mounted) this.startSession(); else if (!Auth.user && this.mounted) location.reload(); },
  startSession() {
    setStorageUser(Auth.user.id); loadState(); Sync.init(Auth.client, Auth.user.id);
    this.mounted = true;
    window.addEventListener('hashchange', () => this.route());
    document.addEventListener('keydown', (e) => this.shortcuts(e));
    on('tick', () => this.updateLivePill()); on('change', () => this.updateLivePill());
    on('sync', (s) => this.updateSyncPill(s));
    document.addEventListener('visibilitychange', () => { Clock.resync(); if (!document.hidden) { Timer.tick(); if (runningSession()) Timer.ensureLoops(); } Timer.heartbeat(); });
    window.addEventListener('pagehide', () => Timer.heartbeat());
    this.route(); this.renderHeader();
    Timer.hydrate();
    Sync.pull();
  },
  route() {
    const hash = location.hash.replace(/^#\/?/, '');
    const root = $('#view'); Drawer.close();
    if (this.currentView && this.currentView.unmount) this.currentView.unmount();
    root.replaceChildren();
    if (hash.startsWith('report') || hash.startsWith('relatorio')) {
      document.body.dataset.page = 'report'; this.currentView = ReportView; ReportView.mount(root);
    } else {
      document.body.dataset.page = 'main'; this.currentView = null;
      const left = h('div', { class: 'col-left' }), right = h('div', { class: 'col-right' });
      root.append(h('div', { class: 'columns' }, left, right));
      TimerCard.mount(left); ManualCard.mount(left); ReportsCard.mount(left);
      MissionsCard.mount(right); Calendar.mount(right);
    }
    this.renderHeader(); window.scrollTo({ top: 0 });
  },
  renderHeader() {
    const isReport = document.body.dataset.page === 'report';
    const cfg = window.CSP_CONFIG || {};
    const actions = $('#top-actions');
    setKids(actions,
      this.mounted ? h('span', { class: 'sync-pill ' + Sync.status, id: 'sync-pill', title: 'Sync' }, h('i', { class: 'dot' }), h('span', { class: 'txt' }, this.syncLabel(Sync.status))) : null,
      this.mounted ? h('button', { class: 'live-pill', id: 'live-pill', type: 'button', title: 'Go to the timer', onClick: () => { location.hash = ''; setTimeout(() => $('#card-timer')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50); } }, h('i', { class: 'dot' }), h('span', { class: 'txt num' }, '00:00')) : null,
      this.mounted ? (isReport
        ? frag(h('button', { class: 'btn primary', onClick: () => window.print() }, '⬇ Save PDF'), h('a', { class: 'btn', href: '#/' }, 'Back'))
        : frag(h('a', { class: 'btn', href: '#/report' }, '📄 Study report'), h('button', { class: 'btn icon', title: 'Settings', 'aria-label': 'Settings', onClick: () => Panel.settings() }, '⚙'), cfg.homeUrl ? h('a', { class: 'btn', href: cfg.homeUrl }, 'Back') : null)) : null);
    this.updateLivePill();
  },
  syncLabel(s) { return { idle: 'Synced', saving: 'Saving…', offline: 'Offline', error: 'Sync error', off: '' }[s] || ''; },
  updateSyncPill(s) { const p = $('#sync-pill'); if (!p) return; p.className = 'sync-pill ' + s; $('.txt', p).textContent = this.syncLabel(s); p.title = s === 'error' ? 'Could not save to the cloud. Your work is kept in this browser and will be sent when the connection is back.' : 'Sync'; },
  updateLivePill() {
    const pill = $('#live-pill'); if (!pill) return; const r = runningSession(); const st = Timer.status();
    pill.className = 'live-pill' + (r ? ' on ' + st : '');
    if (r) $('.txt', pill).textContent = fmtClock(sessionTimes(r).net);
  },
  shortcuts(e) {
    if (Focus.isOpen() || modalStack.length) return;
    const tag = document.activeElement?.tagName; const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) { if (undoLast()) { e.preventDefault(); toast('Undone'); } return; }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.body.dataset.page !== 'main') return;
    const k = e.key.toLowerCase();
    if (k === 'f') { e.preventDefault(); Focus.open(); }
    else if (k === ' ' && !e.target.closest('.blk, button, a')) { e.preventDefault(); const st = Timer.status(); if (st === 'idle') { const b = $('#btn-start'); b && b.click(); } else if (st === 'running') Timer.pause(); else Timer.resume(); }
    else if (k === 'n' && runningSession()) { e.preventDefault(); const ta = $('.quick-note textarea'); ta && ta.focus(); }
  },
};
document.addEventListener('DOMContentLoaded', () => App.boot());
