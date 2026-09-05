/* ===== Auth (Supabase email + senha; usuários criados manualmente pelo administrador) ===== */
const Auth = {
  client: null, user: null, configured: false,
  async init() {
    const cfg = window.CSP_CONFIG || {};
    this.configured = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
    if (!this.configured) return 'local';
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
    const email = h('input', { type: 'email', placeholder: 'E-mail', autocomplete: 'username', required: true });
    const pass = h('input', { type: 'password', placeholder: 'Senha', autocomplete: 'current-password', required: true });
    const err = h('p', { class: 'errors', hidden: true }); const btn = h('button', { class: 'btn primary lg', type: 'submit' }, 'Entrar');
    const form = h('form', { onSubmit: async (e) => {
      e.preventDefault(); err.hidden = true; btn.disabled = true; btn.textContent = 'Entrando…';
      try { await this.signIn(email.value.trim(), pass.value); }
      catch (ex) { err.hidden = false; err.textContent = /invalid/i.test(ex.message || '') ? 'E-mail ou senha incorretos.' : /confirm/i.test(ex.message || '') ? 'E-mail ainda não confirmado — peça ao administrador para confirmar o usuário.' : 'Não foi possível entrar: ' + (ex.message || 'erro desconhecido'); btn.disabled = false; btn.textContent = 'Entrar'; }
    } }, email, pass, err, btn);
    setKids(root, h('div', { class: 'login' }, h('div', { class: 'card' }, h('img', { src: 'assets/logo.png', alt: '' }), h('h1', null, 'Chess Study Planner'), h('p', { class: 'muted' }, message || 'Entre com o e-mail e a senha que você recebeu.'), form,
      h('p', { class: 'muted small', style: { marginTop: '16px' } }, 'Acesso restrito a usuários cadastrados. Cada pessoa vê apenas os próprios dados.'))));
    setTimeout(() => email.focus(), 30);
  },
};
