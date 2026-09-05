/* ===== Auth (Supabase email + password; accounts are created by the administrator) ===== */
const Auth = {
  client: null, user: null, configured: false,
  async init() {
    const cfg = window.CSP_CONFIG || {};
    this.configured = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
    if (!this.configured) return 'unconfigured';
    if (!window.supabase || !window.supabase.createClient) return 'nolib';
    this.client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
    try { const { data } = await this.client.auth.getSession(); this.user = data?.session?.user || null; } catch (e) { console.warn(e); this.user = null; }
    this.client.auth.onAuthStateChange((event, session) => {
      const u = session?.user || null; const changed = (u?.id || null) !== (this.user?.id || null);
      this.user = u; if (changed) App.onAuthChange();
    });
    return 'cloud';
  },
  async signIn(email, password) {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.user = data.user; App.onAuthChange(); return data.user;
  },
  async signOut() {
    Sync.flush(true);
    try { await this.client.auth.signOut(); } catch { /* */ }
    clearLocalCache(); this.user = null; location.hash = ''; location.reload();
  },
  renderLogin(root, message) {
    const email = h('input', { type: 'email', placeholder: 'Email', autocomplete: 'username', required: true });
    const pass = h('input', { type: 'password', placeholder: 'Password', autocomplete: 'current-password', required: true });
    const err = h('p', { class: 'errors', hidden: true }); const btn = h('button', { class: 'btn primary lg', type: 'submit' }, 'Sign in');
    const form = h('form', { onSubmit: async (e) => {
      e.preventDefault(); err.hidden = true; btn.disabled = true; btn.textContent = 'Signing in…';
      try { await this.signIn(email.value.trim(), pass.value); }
      catch (ex) {
        const m = ex.message || '';
        err.hidden = false;
        err.textContent = /invalid/i.test(m) ? 'Wrong email or password.' : /confirm/i.test(m) ? 'This account has not been confirmed yet.' : /fetch|network/i.test(m) ? 'No connection to the server. Check your internet and try again.' : 'Could not sign in: ' + (m || 'unknown error');
        btn.disabled = false; btn.textContent = 'Sign in';
      }
    } }, email, pass, err, btn);
    setKids(root, h('div', { class: 'login' }, h('div', { class: 'card' }, h('img', { src: 'assets/logo.png', alt: '' }), h('h1', null, 'Chess Study Planner'), message ? h('p', { class: 'muted' }, message) : null, form)));
    setTimeout(() => email.focus(), 30);
  },
};
