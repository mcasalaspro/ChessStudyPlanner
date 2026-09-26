/* ===== Sync with Supabase (local-first: the browser cache is always written first) =====
   Rows of kind 'settings' are per-user documents: id 'settings' (preferences), 'days' (closed days) and
   'room' (the study room). Documents are merged field by field, never overwritten wholesale, so two devices
   cannot erase each other's books, achievements or purchases.
   Downloads are incremental once the database has the server_updated_at column (supabase/update-2-sync.sql);
   without it every pull downloads everything, as before. */
const SYNC_TABLE = 'study_records';
const DOC_IDS = ['settings', 'days', 'room'];
const SETTINGS_FOREIGN = ['entries', 'since', 'owned', 'placed', 'style', 'styles', 'avatar']; // keys an older app version may have mixed in
const jeq = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const maxIso = (a, b) => ((a || '') > (b || '') ? a : b) || null;
/* content equality that ignores key order (the database may reorder keys) and the document's own timestamp */
const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',')}}` : JSON.stringify(v ?? null));
const sameDoc = (a, b) => canon({ ...a, updated_at: null }) === canon({ ...b, updated_at: null });

/* ---- merges ---- */
function mergeListById(L, R, B) { // 3-way when a base is known: deletions on either side stick
  const r = new Map(R.filter(Boolean).map((x) => [x.id, x])), b = B ? new Map(B.filter(Boolean).map((x) => [x.id, x])) : null;
  const out = []; const seen = new Set();
  for (const x of L) {
    if (!x) continue; seen.add(x.id);
    if (r.has(x.id)) out.push(b && b.has(x.id) && jeq(x, b.get(x.id)) ? r.get(x.id) : x);
    else if (!(b && b.has(x.id))) out.push(x); // new here; if it was in the base, the other device deleted it
  }
  for (const x of R) { if (!x || seen.has(x.id) || (b && b.has(x.id))) continue; out.push(x); }
  return out;
}
function mergeSet(L, R, B) {
  const l = new Set(L), r = new Set(R), b = B ? new Set(B) : null; const out = new Set();
  for (const x of l) if (r.has(x) || !(b && b.has(x))) out.add(x);
  for (const x of r) if (!(b && b.has(x))) out.add(x);
  return Array.from(out).sort();
}
function mergeAchMap(L, R) { const out = { ...(R || {}) }; for (const [k, v] of Object.entries(L || {})) out[k] = out[k] && out[k] < v ? out[k] : v; return out; }
/* Settings: the fields changed on this device and not pushed yet (`pend`) keep the local value — lists are
   merged so additions and deletions from both sides survive — and every other field follows the server. */
function mergeSettingsDoc(local, remote, base, pend) {
  const out = { ...local, ...remote };
  for (const k of pend) {
    const L = local[k], R = remote[k], B = base ? base[k] : undefined;
    if (k === 'achievements') out[k] = mergeAchMap(L, R);
    else if (k === 'books' || k === 'themes') out[k] = mergeListById(L || [], R || [], base ? B || [] : null);
    else if (k === 'locked_days') out[k] = mergeSet(L || [], R || [], base ? B || [] : null);
    else if (L !== undefined) out[k] = L;
  }
  out.updated_at = maxIso(local.updated_at, remote.updated_at);
  return out;
}
/* Days merge per day; for the same day the newer entry wins, but fields it does not carry are kept. */
function mergeDaysDoc(local, remote) {
  const entries = { ...(local.entries || {}) };
  for (const [k, e] of Object.entries(remote.entries || {})) {
    const l = entries[k]; if (!l) { entries[k] = e; continue; }
    entries[k] = (e.updated_at || '') > (l.updated_at || '') ? { ...l, ...e } : { ...e, ...l };
  }
  const since = [local.since, remote.since].filter(Boolean).sort()[0] || null;
  return { ...local, entries, since, updated_at: maxIso(local.updated_at, remote.updated_at) };
}
function mergeRoomDoc(local, remote) {
  const owned = mergeListById((local.owned || []).map((o) => ({ ...o, id: o.uid })), (remote.owned || []).map((o) => ({ ...o, id: o.uid })), null).map(({ id, ...o }) => o);
  const placed = { ...(local.placed || {}) };
  for (const [k, p] of Object.entries(remote.placed || {})) if (!placed[k] || (p.at || '') > (placed[k].at || '')) placed[k] = p;
  const mergeStyle = (L = {}, R = {}) => { // wall and floor are merged on their own
    const out = {};
    for (const k of ['wall', 'floor']) {
      const la = L[k + '_at'] || L.at || '', ra = R[k + '_at'] || R.at || '';
      const src = ra > la ? R : L; if (src[k]) { out[k] = src[k]; out[k + '_at'] = src[k + '_at'] || src.at || null; }
    }
    return out;
  };
  const style = mergeStyle(local.style, remote.style);
  const styles = {}; // the other rooms, each merged the same way
  for (const rid of new Set([...Object.keys(local.styles || {}), ...Object.keys(remote.styles || {})])) styles[rid] = mergeStyle((local.styles || {})[rid], (remote.styles || {})[rid]);
  const la = local.avatar?.at || '', ra = remote.avatar?.at || '';
  const avatar = ra > la ? remote.avatar : local.avatar || remote.avatar || null;
  const out = { ...remote, ...local, owned, placed, style, styles, starter: !!(local.starter || remote.starter), updated_at: maxIso(local.updated_at, remote.updated_at) };
  if (avatar) out.avatar = avatar;
  return out;
}

const Sync = {
  enabled: false, client: null, userId: null, status: 'off', dirty: new Set(), gen: new Map(), flushing: false, pulling: null, timers: [], lastPull: 0,
  srv: null, cursor: null, lastFull: 0, base: null, pulled: false, pend: new Map(),
  lsKey(name) { return `csp:v2:${name}:${this.userId}`; },
  dirtyKey() { return this.lsKey('dirty'); },
  lsGet(name) { try { return localStorage.getItem(this.lsKey(name)); } catch { return null; } },
  lsSet(name, v) { try { if (v == null) localStorage.removeItem(this.lsKey(name)); else localStorage.setItem(this.lsKey(name), v); } catch { /* the main cache matters more */ } },
  init(client, userId) {
    this.client = client; this.userId = userId; this.enabled = true;
    try { this.dirty = new Set(JSON.parse(localStorage.getItem(this.dirtyKey()) || '[]')); } catch { this.dirty = new Set(); }
    this.cursor = this.lsGet('cursor'); this.lastFull = +this.lsGet('fullpull') || 0;
    try { this.base = JSON.parse(this.lsGet('base') || 'null'); } catch { this.base = null; }
    try { this.pend = new Map(JSON.parse(this.lsGet('pend') || '[]').map((k) => [k, 1])); } catch { this.pend = new Map(); }
    // an empty cache (new device, cleared data, signed out) always starts with a full download
    if (!state.sessions.length && !state.missions.length && !state.settings.updated_at) { this.cursor = null; this.lastFull = 0; this.base = null; ['cursor', 'fullpull', 'base'].forEach((n) => this.lsSet(n, null)); }
    Store.onDirty = (kind, id, keys) => {
      const k = kind + ':' + id; this.dirty.add(k); this.gen.set(k, (this.gen.get(k) || 0) + 1);
      if (k === 'settings:settings') (keys || []).forEach((f) => this.pend.set(f, (this.pend.get(f) || 0) + 1));
      this.saveDirty(); this.scheduleFlush();
    };
    this.setStatus(navigator.onLine === false ? 'offline' : 'idle');
    const onVis = () => { if (!document.hidden) { if (Date.now() - this.lastPull > 60000) this.pull(); this.flush(); } };
    document.addEventListener('visibilitychange', onVis); window.addEventListener('focus', onVis);
    window.addEventListener('online', () => { this.setStatus('idle'); this.flush(); this.pull(); });
    window.addEventListener('offline', () => this.setStatus('offline'));
    window.addEventListener('pagehide', () => this.flush(true));
    this.timers.push(setInterval(() => { if (!document.hidden) this.pull(); }, 5 * 60000));
  },
  stop() { Store.onDirty = null; this.enabled = false; this.timers.forEach(clearInterval); this.timers = []; this.setStatus('off'); },
  saveDirty() { try { localStorage.setItem(this.dirtyKey(), JSON.stringify(Array.from(this.dirty))); } catch { /* */ } this.lsSet('pend', JSON.stringify(Array.from(this.pend.keys()))); },
  /* signing out: nothing of this account's sync bookkeeping may leak into the next session */
  forget() { ['dirty', 'cursor', 'fullpull', 'base', 'pend'].forEach((n) => this.lsSet(n, null)); },
  saveBase(doc) { this.base = JSON.parse(JSON.stringify(doc)); this.lsSet('base', JSON.stringify(this.base)); },
  setStatus(s) { if (this.status === s) return; this.status = s; emit('sync', s); },
  scheduleFlush: null,
  docOf(id) { return id === 'settings' ? state.settings : id === 'days' ? state.days : id === 'room' ? state.room : null; },
  rowFor(key) {
    const i = key.indexOf(':'); const kind = key.slice(0, i), id = key.slice(i + 1);
    if (kind === 'settings') {
      const doc = this.docOf(id); if (!doc) return null;
      const copy = JSON.parse(JSON.stringify(doc)); // what is sent is exactly what becomes the base
      return { user_id: this.userId, id, kind: 'settings', doc: copy, updated_at: copy.updated_at || iso(Date.now()), deleted_at: null };
    }
    const o = kind === 'session' ? sessionById(id) : kind === 'mission' ? missionById(id) : null; if (!o) return null;
    return { user_id: this.userId, id, kind, doc: JSON.parse(JSON.stringify(o)), updated_at: o.updated_at || iso(Date.now()), deleted_at: o.deleted_at || null };
  },
  /* Merge one remote document into the local state. Returns true when something local changed. */
  applyDoc(id, remote, localDirty) {
    if (!remote || typeof remote !== 'object') return false;
    if (id === 'settings') {
      const clean = { ...remote }; SETTINGS_FOREIGN.forEach((k) => delete clean[k]);
      const before = JSON.stringify(state.settings);
      let pend = localDirty ? Array.from(this.pend.keys()) : [];
      if (localDirty && !pend.length && this.base) pend = Object.keys(state.settings).filter((k) => k !== 'updated_at' && !jeq(state.settings[k], this.base[k])); // queued before fields were tracked
      if (pend.length) state.settings = mergeSettingsDoc(state.settings, clean, this.base, pend);
      else if (!jeq(clean, this.base) || (clean.updated_at || '') > (state.settings.updated_at || '')) state.settings = { ...state.settings, ...clean }; // the server moved on: follow it
      if (!Array.isArray(state.settings.themes) || !state.settings.themes.length) state.settings.themes = DEFAULT_THEMES.map((x) => ({ ...x }));
      this.saveBase(clean);
      return JSON.stringify(state.settings) !== before;
    }
    if (id === 'days') { const before = JSON.stringify(state.days); state.days = mergeDaysDoc(state.days, remote); return JSON.stringify(state.days) !== before; }
    if (id === 'room') {
      const before = JSON.stringify(state.room); state.room = mergeRoomDoc(state.room, remote);
      // the room only ever grows (purchases, newest placements): if the server copy lacks something this device has, send it back
      if (!localDirty && !sameDoc(state.room, remote)) dirty('settings', 'room');
      return JSON.stringify(state.room) !== before;
    }
    return false;
  },
  /* Read-merge-write for documents: what another device saved in the meantime is kept. */
  async mergeRemoteDocs(ids) {
    const { data, error } = await this.client.from(SYNC_TABLE).select('id,doc').eq('kind', 'settings').in('id', ids);
    if (error) throw error;
    let changed = false; const seen = {};
    for (const row of data || []) { changed = this.applyDoc(row.id, row.doc, true) || changed; seen[row.id] = row.doc?.updated_at || null; }
    if (changed) { persist(); emit('change'); }
    return seen;
  },
  async flush(keepalive = false) {
    if (!this.enabled || this.flushing || !this.dirty.size) return;
    // while the page is closing there is no time to merge documents: they stay queued for the next visit
    const keys = Array.from(this.dirty).filter((k) => !keepalive || !k.startsWith('settings:')); if (!keys.length) return;
    const gens = new Map(keys.map((k) => [k, this.gen.get(k) || 0])); const pendAt = new Map(this.pend);
    this.flushing = true; this.setStatus('saving');
    try {
      const docIds = keys.filter((k) => k.startsWith('settings:')).map((k) => k.slice(9)).filter((id) => DOC_IDS.includes(id));
      if (docIds.length) {
        const seen = await this.mergeRemoteDocs(docIds);
        // the merged copy must read as newer than what it was merged with, even if this device's clock lags a little
        docIds.forEach((id) => { const d = this.docOf(id); if (d) d.updated_at = iso(Math.max(Date.now(), seen[id] ? ms(seen[id]) + 1 : 0)); });
      }
      const rows = keys.map((k) => this.rowFor(k)).filter(Boolean);
      if (rows.length) { const { error } = await this.client.from(SYNC_TABLE).upsert(rows, { onConflict: 'user_id,id' }); if (error) throw error; }
      keys.forEach((k) => { if ((this.gen.get(k) || 0) === gens.get(k)) this.dirty.delete(k); }); // changed again meanwhile: keep it queued
      const st = rows.find((r) => r.kind === 'settings' && r.id === 'settings');
      if (st) { this.saveBase(st.doc); for (const [f, n] of pendAt) if (this.pend.get(f) === n) this.pend.delete(f); }
      this.saveDirty();
      this.setStatus('idle');
    } catch (e) {
      console.warn('sync push failed', e); this.setStatus(navigator.onLine === false ? 'offline' : 'error');
      if (!keepalive) setTimeout(() => this.flush(), 20000);
    } finally { this.flushing = false; if (this.dirty.size && this.status === 'idle') this.scheduleFlush(); }
  },
  isNoColumn(err) { return !!err && (err.code === '42703' || /server_updated_at/.test(err.message || '')); },
  /* Everything, page by page (Supabase returns at most 1000 rows per request). */
  async fetchAll() {
    const PAGE = 1000;
    const run = async (withSrv) => {
      const cols = 'id,kind,doc,updated_at,deleted_at' + (withSrv ? ',server_updated_at' : ''); const out = [];
      for (let from = 0; ; from += PAGE) {
        const { data: page, error } = await this.client.from(SYNC_TABLE).select(cols).order('id', { ascending: true }).range(from, from + PAGE - 1);
        if (error) throw error;
        out.push(...(page || [])); if (!page || page.length < PAGE) break;
      }
      return out;
    };
    if (this.srv !== false) {
      try { const rows = await run(true); this.srv = true; return rows; }
      catch (e) { if (!this.isNoColumn(e)) throw e; this.srv = false; }
    }
    return run(false);
  },
  /* Only what changed since the last pull (a small overlap covers clock rounding and late commits). */
  async fetchSince(cursor) {
    const PAGE = 1000; const since = iso(ms(cursor) - 30000); const out = [];
    for (let from = 0; ; from += PAGE) {
      const { data: page, error } = await this.client.from(SYNC_TABLE).select('id,kind,doc,updated_at,deleted_at,server_updated_at').gt('server_updated_at', since).order('server_updated_at', { ascending: true }).range(from, from + PAGE - 1);
      if (error) { if (this.isNoColumn(error)) { this.srv = false; return null; } throw error; }
      out.push(...(page || [])); if (!page || page.length < PAGE) break;
    }
    return out;
  },
  async peek(kind, id) {
    if (!this.enabled || navigator.onLine === false) return null;
    try { const { data, error } = await this.client.from(SYNC_TABLE).select('doc').eq('kind', kind).eq('id', id); if (error) return null; return (data && data[0] && data[0].doc) || null; } catch { return null; }
  },
  pull(opts) { if (!this.enabled) return Promise.resolve(); if (!this.pulling) this.pulling = this.doPull(opts).finally(() => { this.pulling = null; }); return this.pulling; },
  async doPull({ full = false } = {}) {
    this.lastPull = Date.now();
    try {
      let rows = null, isFull = false;
      const wantFull = full || !this.cursor || this.srv === false || Date.now() - this.lastFull > DAY;
      if (!wantFull) rows = await this.fetchSince(this.cursor);
      if (rows == null) { rows = await this.fetchAll(); isFull = true; }
      const changed = this.apply(rows, isFull);
      const newest = rows.reduce((a, r) => (r.server_updated_at && r.server_updated_at > a ? r.server_updated_at : a), this.cursor || '');
      if (this.srv && newest) { this.cursor = newest; this.lsSet('cursor', newest); }
      if (isFull) { this.lastFull = Date.now(); this.lsSet('fullpull', String(this.lastFull)); }
      if (changed) { persist(); emit('change'); Timer.ensureLoops(); }
      this.pulled = true;
      if (this.status === 'error' || this.status === 'offline') this.setStatus('idle');
      this.flush();
    } catch (e) { console.warn('sync pull failed', e); this.setStatus(navigator.onLine === false ? 'offline' : 'error'); }
  },
  apply(data, isFull) {
    const remoteIds = new Set(); let changed = 0;
    for (const row of data) {
      const doc = row.doc; if (!doc) continue; remoteIds.add(row.kind + ':' + row.id);
      const localDirty = this.dirty.has(row.kind + ':' + row.id);
      if (row.kind === 'settings') { if (this.applyDoc(row.id, doc, localDirty)) changed++; continue; }
      const coll = row.kind === 'session' ? state.sessions : row.kind === 'mission' ? state.missions : null; if (!coll) continue;
      const idx = coll.findIndex((x) => x.id === row.id);
      if (idx < 0) { coll.push(doc); changed++; }
      else if (!localDirty && (doc.updated_at || '') > (coll[idx].updated_at || '')) { coll[idx] = doc; changed++; }
    }
    if (isFull) { // local records unknown to the server (created offline / before login) → upload
      state.sessions.forEach((s) => { if (!remoteIds.has('session:' + s.id)) this.dirty.add('session:' + s.id); });
      state.missions.forEach((m) => { if (!remoteIds.has('mission:' + m.id)) this.dirty.add('mission:' + m.id); });
      DOC_IDS.forEach((id) => { const d = this.docOf(id); if (!remoteIds.has('settings:' + id) && d && d.updated_at) this.dirty.add('settings:' + id); });
      this.saveDirty();
    }
    // only one running block per account: keep the most recent, close the others
    const running = state.sessions.filter((s) => !s.deleted_at && !s.ended_at).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    // a block nobody has kept alive for 6 hours (or longer than 16 h) is closed where it stopped — even across midnight a live block goes on
    running.forEach((s) => {
      const last = s.meta?.last_seen_at ? ms(s.meta.last_seen_at) : ms(s.started_at);
      if (nowMs() - last > 6 * HOUR || nowMs() - ms(s.started_at) > 16 * HOUR) {
        s.ended_at = iso(Math.max(ms(s.started_at) + 60000, last));
        s.meta = { ...(s.meta || {}), autoclosed: true, autoclosed_reason: 'stale' };
        s.updated_at = iso(Date.now()); this.dirty.add('session:' + s.id); changed++;
      }
    });
    running.filter((s) => !s.ended_at).slice(1).forEach((s) => { const last = s.meta?.last_seen_at || s.updated_at; s.ended_at = iso(Math.max(ms(s.started_at) + 60000, ms(last))); s.meta = { ...(s.meta || {}), autoclosed: true, autoclosed_reason: 'conflict' }; s.updated_at = iso(Date.now()); this.dirty.add('session:' + s.id); changed++; });
    if (changed) this.saveDirty();
    return changed > 0;
  },
};
Sync.scheduleFlush = debounce(() => Sync.flush(), 1200);
