/* ===== Sync with Supabase (local-first: the browser cache is always written first) ===== */
const SYNC_TABLE = 'study_records';
const Sync = {
  enabled: false, client: null, userId: null, status: 'off', dirty: new Set(), flushing: false, timers: [], lastPull: 0,
  dirtyKey() { return `csp:v2:dirty:${this.userId}`; },
  init(client, userId) {
    this.client = client; this.userId = userId; this.enabled = true;
    try { this.dirty = new Set(JSON.parse(localStorage.getItem(this.dirtyKey()) || '[]')); } catch { this.dirty = new Set(); }
    Store.onDirty = (kind, id) => { this.dirty.add(kind + ':' + id); this.saveDirty(); this.scheduleFlush(); };
    this.setStatus(navigator.onLine === false ? 'offline' : 'idle');
    const onVis = () => { if (!document.hidden) { if (Date.now() - this.lastPull > 60000) this.pull(); this.flush(); } };
    document.addEventListener('visibilitychange', onVis); window.addEventListener('focus', onVis);
    window.addEventListener('online', () => { this.setStatus('idle'); this.flush(); this.pull(); });
    window.addEventListener('offline', () => this.setStatus('offline'));
    window.addEventListener('pagehide', () => this.flush(true));
    this.timers.push(setInterval(() => { if (!document.hidden) this.pull(); }, 5 * 60000));
  },
  stop() { Store.onDirty = null; this.enabled = false; this.timers.forEach(clearInterval); this.timers = []; this.setStatus('off'); },
  saveDirty() { try { localStorage.setItem(this.dirtyKey(), JSON.stringify(Array.from(this.dirty))); } catch { /* */ } },
  setStatus(s) { if (this.status === s) return; this.status = s; emit('sync', s); },
  scheduleFlush: null,
  rowFor(key) {
    const [kind, id] = key.split(':');
    if (kind === 'settings') return { user_id: this.userId, id: 'settings', kind, doc: state.settings, updated_at: state.settings.updated_at || iso(Date.now()), deleted_at: null };
    const o = kind === 'session' ? sessionById(id) : missionById(id); if (!o) return null;
    return { user_id: this.userId, id, kind, doc: o, updated_at: o.updated_at || iso(Date.now()), deleted_at: o.deleted_at || null };
  },
  async flush(keepalive = false) {
    if (!this.enabled || this.flushing || !this.dirty.size) return;
    const keys = Array.from(this.dirty); const rows = keys.map((k) => this.rowFor(k)).filter(Boolean);
    if (!rows.length) { keys.forEach((k) => this.dirty.delete(k)); this.saveDirty(); return; }
    this.flushing = true; this.setStatus('saving');
    try {
      const { error } = await this.client.from(SYNC_TABLE).upsert(rows, { onConflict: 'user_id,id' });
      if (error) throw error;
      keys.forEach((k) => this.dirty.delete(k)); this.saveDirty(); this.setStatus('idle');
    } catch (e) {
      console.warn('sync push failed', e); this.setStatus(navigator.onLine === false ? 'offline' : 'error');
      if (!keepalive) setTimeout(() => this.flush(), 20000);
    } finally { this.flushing = false; if (this.dirty.size && this.status === 'idle') this.scheduleFlush(); }
  },
  async pull() {
    if (!this.enabled) return; this.lastPull = Date.now();
    try {
      // paginated: Supabase returns at most 1000 rows per request
      const data = []; const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const { data: page, error } = await this.client.from(SYNC_TABLE).select('id,kind,doc,updated_at,deleted_at').order('updated_at', { ascending: true }).range(from, from + PAGE - 1);
        if (error) throw error;
        data.push(...(page || [])); if (!page || page.length < PAGE) break;
      }
      const remoteIds = new Set(); let changed = 0;
      for (const row of data) {
        const doc = row.doc; if (!doc) continue; remoteIds.add(row.kind + ':' + row.id);
        const localDirty = this.dirty.has(row.kind + ':' + row.id);
        if (row.kind === 'settings') {
          if (!localDirty && (doc.updated_at || '') > (state.settings.updated_at || '')) { state.settings = { ...state.settings, ...doc }; changed++; }
          continue;
        }
        const coll = row.kind === 'session' ? state.sessions : row.kind === 'mission' ? state.missions : null; if (!coll) continue;
        const idx = coll.findIndex((x) => x.id === row.id);
        if (idx < 0) { coll.push(doc); changed++; }
        else if (!localDirty && (doc.updated_at || '') > (coll[idx].updated_at || '')) { coll[idx] = doc; changed++; }
      }
      // local records unknown to the server (created offline / before login) → upload
      state.sessions.forEach((s) => { if (!remoteIds.has('session:' + s.id)) this.dirty.add('session:' + s.id); });
      state.missions.forEach((m) => { if (!remoteIds.has('mission:' + m.id)) this.dirty.add('mission:' + m.id); });
      if (!remoteIds.has('settings:settings') && state.settings.updated_at) this.dirty.add('settings:settings');
      this.saveDirty();
      // only one running block per account: keep the most recent, close the others
      const running = state.sessions.filter((s) => !s.deleted_at && !s.ended_at).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      running.slice(1).forEach((s) => { const last = s.meta?.last_seen_at || s.updated_at; s.ended_at = iso(Math.max(ms(s.started_at) + 60000, ms(last))); s.meta = { ...(s.meta || {}), autoclosed: true, autoclosed_reason: 'conflict' }; s.updated_at = iso(Date.now()); this.dirty.add('session:' + s.id); changed++; });
      if (changed) { persist(); emit('change'); Timer.ensureLoops(); }
      if (this.status === 'error' || this.status === 'offline') this.setStatus('idle');
      this.flush();
    } catch (e) { console.warn('sync pull failed', e); this.setStatus(navigator.onLine === false ? 'offline' : 'error'); }
  },
};
Sync.scheduleFlush = debounce(() => Sync.flush(), 1200);
