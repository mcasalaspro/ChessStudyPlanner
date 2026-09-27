/* ===== Study room: rooms and doors, placement, light and shadow, the room card and the shop ===== */
/* The rooms form a row: each one opens at a level, and has a door back on its left wall and a door on to
   the next room on its right wall. Things placed without a room belong to the study (the first room). */
const ROOMS = [
  { id: 'study', name: 'Study', lvl: 1, wall: 'wall_sand', floor: 'floor_oak', desc: 'Where the work happens.' },
  { id: 'library', name: 'Library', lvl: 4, wall: 'wall_library', floor: 'floor_herringbone', desc: 'Shelves, ladders and reading corners.' },
  { id: 'lounge', name: 'Lounge', lvl: 6, wall: 'wall_terracotta', floor: 'floor_parquet', desc: 'Sofas, music and long breaks.' },
  { id: 'zen', name: 'Zen room', lvl: 8, wall: 'wall_shoji', floor: 'floor_tatami', desc: 'Mats, plants and quiet.' },
  { id: 'gallery', name: 'Gallery', lvl: 10, wall: 'wall_gallery', floor: 'floor_marble', desc: 'Your trophies and art, on display.' },
  { id: 'garden', name: 'Winter garden', lvl: 12, wall: 'wall_glass', floor: 'floor_stone', desc: 'Glass walls and a jungle of plants.' },
  { id: 'game', name: 'Game room', lvl: 15, wall: 'wall_arcade', floor: 'floor_checker', desc: 'Tables, arcade machines and fun.' },
  { id: 'observatory', name: 'Observatory', lvl: 18, wall: 'wall_night', floor: 'floor_slate', desc: 'Telescopes and the night sky.' },
];
const roomDef = (id) => ROOMS.find((r) => r.id === id) || ROOMS[0];
const DOOR = { u: 6, w: 1, h: 2.1, keep: 2.5 }; // wall space above the door stays free for its sign
function roomDoors(rid) {
  const i = ROOMS.findIndex((r) => r.id === rid); const out = [];
  if (i > 0) out.push({ wall: 'L', to: ROOMS[i - 1].id, u: DOOR.u, w: DOOR.w, h: DOOR.h, tile: [0, DOOR.u] });
  if (i >= 0 && i < ROOMS.length - 1) out.push({ wall: 'R', to: ROOMS[i + 1].id, u: DOOR.u, w: DOOR.w, h: DOOR.h, tile: [DOOR.u, 0] });
  return out;
}
const STARTER = [ // fixed ids: two devices creating the starter kit end up with one kit
  { uid: 'starter-desk', item: 'desk', x: 3, y: 0 },
  { uid: 'starter-chair', item: 'chair', x: 3, y: 1 },
  { uid: 'starter-plant', item: 'plant_small', x: 0, y: 0 },
];
const Room = {
  _rw: { v: -1, list: [] }, _pl: null,
  purchases() { return state.room.owned || []; },
  /* Rewards are owned by having the achievement: nothing to store, nothing to merge — only where they stand. */
  rewardOwned() {
    const won = state.settings.achievements || {}; const key = Object.keys(won).length + '|' + ROOM_ITEMS.length;
    if (this._rw.v === key && this._rw.won === won) return this._rw.list;
    this._rw = { v: key, won, list: ROOM_ITEMS.filter((it) => it.reward && won[it.reward]).map((it) => ({ uid: 'rw-' + it.id, item: it.id, price: 0, reward: true })) };
    return this._rw.list;
  },
  owned() { return [...this.purchases(), ...this.rewardOwned()]; },
  countOwned(id) { let n = 0; for (const o of this.owned()) if (o.item === id) n++; return n; },
  level() { return Credits.get().level; },
  unlocked(rid) { return this.level() >= roomDef(rid).lvl; },
  unlockedRooms() { const lv = this.level(); return ROOMS.filter((r) => lv >= r.lvl); },
  styleSrc(rid) { return rid === 'study' ? state.room.style || {} : (state.room.styles || {})[rid] || {}; },
  styleOf(kind, rid = 'study') {
    const st = roomStyle(this.styleSrc(rid)[kind]);
    return st && st.kind === kind ? st : roomStyle(roomDef(rid)[kind]) || roomStyle(kind === 'wall' ? 'wall_sand' : 'floor_oak');
  },
  /* a room's own walls and floor are always there for that room; the rest is bought once and used anywhere */
  styleUsable(st, rid) { return st.id === roomDef(rid)[st.kind] || this.countOwned(st.id) > 0 || (st.price === 0 && (st.lvl || 0) <= this.level()); },
  touch() { const now = iso(Date.now()); state.room.updated_at = now; this._pl = null; dirty('settings', 'room'); return now; },
  ensureStarter() {
    if (this.purchases().length || state.room.starter) return;
    if (Sync.enabled && !(Sync.pulled && Sync.lastFull)) return; // wait until the account's own room has been read
    this.touch();
    const old = '2000-01-01T00:00:00.000Z'; // the starter kit never wins over a real arrangement from another device
    state.room.owned = STARTER.map((s) => ({ uid: s.uid, item: s.item, price: 0, at: old }));
    state.room.placed = { ...(state.room.placed || {}), ...Object.fromEntries(STARTER.map((s) => [s.uid, { x: s.x, y: s.y, flip: false, at: old }])) };
    state.room.style = { wall: 'wall_sand', floor: 'floor_oak', wall_at: old, floor_at: old, ...(state.room.style || {}) }; state.room.starter = true;
    persist();
  },
  pl(uidv) { const p = state.room.placed?.[uidv]; return p && !p.stored ? p : null; },
  roomOfUid(uidv) { const p = this.pl(uidv); return p ? p.room || 'study' : null; },
  itemOf(o) { return roomItem(o.item); },
  dims(it, flip) { return flip ? [it.fp[1], it.fp[0]] : [it.fp[0], it.fp[1]]; },
  /* everything placed in one room, with its geometry */
  placedList(rid = 'study') {
    const c = this._pl;
    if (c && c.rid === rid && c.placed === state.room.placed && c.owned === state.room.owned && c.rw === this.rewardOwned()) return c.list;
    const out = [];
    for (const o of this.owned()) {
      const it = this.itemOf(o); const p = this.pl(o.uid); if (!it || !p || (p.room || 'study') !== rid) continue;
      if (it.wall) out.push({ o, it, p, wall: true, layer: 'wall', w: it.wall[0], hh: it.wall[1] });
      else { const [w, d] = this.dims(it, p.flip); out.push({ o, it, p, wall: false, layer: itemLayer(it), x: p.x, y: p.y, w, d, flat: !!it.flat }); }
    }
    this._pl = { rid, placed: state.room.placed, owned: state.room.owned, rw: this.rewardOwned(), list: out };
    return out;
  },
  /* three layers share the floor: rugs, standing things and things hanging from the ceiling */
  fitsFloor(uidv, it, x, y, flip, rid = 'study') {
    const [w, d] = this.dims(it, flip); const N = ISO.N; const L = itemLayer(it);
    if (x < 0 || y < 0 || x + w > N || y + d > N) return false;
    if (L === 'solid' && roomDoors(rid).some((dr) => x <= dr.tile[0] && dr.tile[0] < x + w && y <= dr.tile[1] && dr.tile[1] < y + d)) return false;
    return !this.placedList(rid).some((e) => !e.wall && e.o.uid !== uidv && e.layer === L && x < e.x + e.w && e.x < x + w && y < e.y + e.d && e.y < y + d);
  },
  doorHit(rid, wall, u, w, z, hh) { return roomDoors(rid).some((dr) => dr.wall === wall && u < dr.u + dr.w + 0.04 && dr.u - 0.04 < u + w && z - hh < DOOR.keep); },
  fitsWall(uidv, it, wall, u, z, rid = 'study') {
    const [w, hh] = it.wall;
    if (u < 0 || u + w > ISO.N + 1e-6 || z > ISO.H - 0.08 || z - hh < 0.2) return false;
    if (this.doorHit(rid, wall, u, w, z, hh)) return false;
    return !this.placedList(rid).some((e) => e.wall && e.o.uid !== uidv && e.p.wall === wall && u < e.p.u + e.w && e.p.u < u + w && z - hh < e.p.z && e.p.z - e.hh < z);
  },
  firstFree(uidv, it, rid = 'study') {
    if (it.wall) {
      for (const z of [2.45, 2.85, 1.95, 1.5, 3.0]) for (const wall of ['R', 'L']) for (let u = 0.5; u + it.wall[0] <= ISO.N; u += 0.5) if (this.fitsWall(uidv, it, wall, u, z, rid)) return { wall, u, z };
      return null;
    }
    /* Furniture that belongs against a wall goes there, facing the room; the rest spreads out instead of piling up. */
    const N = ISO.N; const occ = new Set(); const L = itemLayer(it);
    for (const e of this.placedList(rid)) if (!e.wall && e.layer === 'solid' && e.o.uid !== uidv) for (let i = e.x; i < e.x + e.w; i++) for (let j = e.y; j < e.y + e.d; j++) occ.add(i + ',' + j);
    const crowd = (x, y, w, d) => { let n = 0; for (let i = x - 1; i <= x + w; i++) for (let j = y - 1; j <= y + d; j++) if ((i < x || i >= x + w || j < y || j >= y + d) && occ.has(i + ',' + j)) n++; return n; };
    const jitter = (x, y) => ((x * 7 + y * 13 + uidv.charCodeAt(uidv.length - 1)) % 10) / 40;
    let best = null;
    for (const flip of [false, true]) {
      const [w, d] = this.dims(it, flip);
      for (let x = 0; x + w <= N; x++) for (let y = 0; y + d <= N; y++) {
        if (!this.fitsFloor(uidv, it, x, y, flip, rid)) continue;
        const cx = x + w / 2, cy = y + d / 2; let score;
        if (L === 'flat') score = Math.hypot(cx - N / 2, cy - N / 2) + (flip ? 0.01 : 0) + jitter(x, y) * 0.1;
        else if (L === 'hang') score = Math.abs(Math.hypot(cx - N / 2, cy - N / 2) - 1.6) + jitter(x, y) + (flip ? 0.05 : 0);
        else if (it.hug) { const back = (!flip && y === 0) || (flip && x === 0); score = (back ? 0 : 50) + crowd(x, y, w, d) * 2 + Math.abs((flip ? y : x) + (flip ? d : w) / 2 - N / 2) * 0.3; }
        else if (it.edge) score = Math.min(x, y) * 3 + crowd(x, y, w, d) * 2 + jitter(x, y) + (flip ? 0.05 : 0);
        else score = crowd(x, y, w, d) * 3 + Math.abs(Math.hypot(cx - N / 2, cy - N / 2) - 2.3) + jitter(x, y) + (flip ? 0.05 : 0);
        if (!best || score < best.score) best = { x, y, flip, score };
      }
    }
    return best ? { x: best.x, y: best.y, flip: best.flip } : null;
  },
  withRoom(pos, rid) { return rid && rid !== 'study' ? { ...pos, room: rid } : pos; },
  buy(id, rid = 'study') {
    const it = roomItem(id) || roomStyle(id); if (!it) return { error: 'Unknown item' };
    if (it.reward) return { error: 'This one is earned with an achievement' };
    const cr = Credits.get();
    if ((it.lvl || 0) > cr.level) return { error: `Unlocks at level ${it.lvl}` };
    if (cr.balance < it.price) return { error: `You need ${fmtNum(it.price - cr.balance)} more credits` };
    const at = this.touch(); const o = { uid: uid().slice(0, 8), item: id, price: it.price, at };
    state.room.owned = [...this.purchases(), o];
    if (it.kind) { this.setStyle(it.kind, id, rid, at); commit('room'); return { uid: o.uid }; }
    const pos = this.firstFree(o.uid, it, rid);
    state.room.placed = { ...(state.room.placed || {}), [o.uid]: pos ? { ...this.withRoom(pos, rid), at } : { stored: true, at } };
    commit('room');
    return { uid: o.uid, placed: !!pos };
  },
  setStyle(kind, id, rid, at) {
    if (rid === 'study') state.room.style = { ...(state.room.style || {}), [kind]: id, [kind + '_at']: at };
    else { const all = { ...(state.room.styles || {}) }; all[rid] = { ...(all[rid] || {}), [kind]: id, [kind + '_at']: at }; state.room.styles = all; }
  },
  applyStyle(id, rid = 'study') { const st = roomStyle(id); if (!st) return; this.setStyle(st.kind, id, rid, this.touch()); commit('room'); },
  /* keeps the room and the switch of the light unless the new position says otherwise */
  move(uidv, pos, { silent = false } = {}) {
    const at = this.touch(); const cur = state.room.placed?.[uidv] || {};
    let next;
    if (pos.stored) next = { stored: true, at };
    else {
      next = { ...pos, at }; const r = pos.room !== undefined ? pos.room : cur.room;
      if (r && r !== 'study') next.room = r; else delete next.room;
      const off = pos.off !== undefined ? pos.off : cur.off; if (off) next.off = true; else delete next.off;
    }
    state.room.placed = { ...(state.room.placed || {}), [uidv]: next };
    if (!silent) commit('room');
  },
  store(uidv) { if (uidv) this.move(uidv, { stored: true }); },
  placeStored(uidv, rid = 'study') {
    const o = this.owned().find((x) => x.uid === uidv); const it = o && this.itemOf(o); if (!it) return false;
    const pos = this.firstFree(uidv, it, rid); if (!pos) return false;
    this.move(uidv, { ...pos, room: rid }); return true;
  },
  moveToRoom(uidv, rid) { return this.placeStored(uidv, rid); },
  toggleLight(uidv) { const p = this.pl(uidv); if (!p) return; const { at, ...rest } = p; this.move(uidv, { ...rest, off: !p.off }); },
  /* the doors came after some rooms were already decorated: whatever hangs where a door is moves along the wall */
  fixDoors(rid) {
    let changed = false;
    for (const e of this.placedList(rid).slice()) {
      if (!e.wall || !this.doorHit(rid, e.p.wall, e.p.u, e.w, e.p.z, e.hh)) continue;
      const pos = this.firstFree(e.o.uid, e.it, rid);
      this.move(e.o.uid, pos ? { ...pos, room: rid } : { stored: true }, { silent: true }); changed = true;
    }
    if (changed) commit('room');
    return changed;
  },
  /* rewards never placed (e.g. from achievements won before rooms existed) wait in storage */
  pendingRewards() { return this.rewardOwned().filter((o) => !state.room.placed?.[o.uid]); },
  bestRoomFor(it, fallback) { return it.room && this.unlocked(it.room) ? it.room : fallback || 'study'; },
  placeReward(o, fallback) {
    const it = this.itemOf(o); if (!it) return null;
    for (const rid of [this.bestRoomFor(it, fallback), fallback, 'study']) {
      if (!rid || !this.unlocked(rid)) continue;
      const pos = this.firstFree(o.uid, it, rid);
      if (pos) { this.move(o.uid, { ...pos, room: rid }, { silent: true }); return rid; }
    }
    return null;
  },
  /* a fresh achievement brings its reward straight into the room (a burst on first sync stays in storage) */
  grantRewards(fresh) {
    if (!fresh || !fresh.length || fresh.length > 3) return [];
    const ids = new Set(fresh.map((a) => a.id)); const got = [];
    for (const o of this.rewardOwned()) {
      const it = this.itemOf(o); if (!it || !ids.has(it.reward) || state.room.placed?.[o.uid]) continue;
      got.push({ it, rid: this.placeReward(o, RoomView.cur()) });
    }
    if (got.length) commit('room');
    return got;
  },
  /* free floor left in a room (0..1), counting what stands on the floor */
  freeShare(rid) { let used = 0; for (const e of this.placedList(rid)) if (!e.wall && e.layer === 'solid') used += e.w * e.d; return 1 - used / (ISO.N * ISO.N); },
  placeAllRewards(fallback) {
    let n = 0, stored = 0;
    for (const o of this.pendingRewards()) {
      const it = this.itemOf(o); const own = it && it.room && this.unlocked(it.room) ? it.room : null;
      const rid = own || (this.freeShare(fallback) > 0.6 || it.wall ? fallback : null);
      const pos = rid && this.firstFree(o.uid, it, rid);
      if (pos) { this.move(o.uid, { ...pos, room: rid }, { silent: true }); n++; } else { this.move(o.uid, { stored: true }, { silent: true }); stored++; }
    }
    if (n || stored) commit('room');
    return { n, stored };
  },
};

/* ---------- drawing a room ---------- */
/* the time a room shows: the real one, or a preview of the day, the evening or the night */
function roomClock(mode) {
  const real = new Date(nowMs()); if (!mode || mode === 'auto') return real;
  const d = new Date(real); const hm2 = { day: [11, 0], dusk: [18, 45], night: [22, 30] }[mode]; if (hm2) d.setHours(hm2[0], hm2[1], 0, 0);
  return d;
}
function roomCtx(mode) {
  const won = state.settings.achievements || {};
  return { now: roomClock(mode), clock: new Date(nowMs()), achievements: Object.keys(won).length, rare: ACHIEVEMENTS.filter((a) => won[a.id] && a.tier >= 3).length, level: Credits.get().level };
}
function wallFlat(st, side, ctx) {
  const W = ISO.N * 100, H = ISO.H * 100; const base = side === 'R' ? st.a : st.b;
  const clipId = roomDefOnce(`rm-wc-${W}x${H}`, `<clipPath><rect width="${W}" height="${H}"/></clipPath>`);
  const rnd = mulberry(side === 'R' ? 3 : 4); let s = artWallTex(st, side, W, H); // the Canva texture, when there is one
  if (!s) { s = `<rect width="${W}" height="${H}" fill="${base}"/>`; const pat = WALL_PATTERNS[st.pattern]; if (pat) s += pat({ W, H, base, st, side, rnd, ctx: ctx || roomCtx() }); }
  if (!st.bare) s += `<rect x="0" y="0" width="${W}" height="6" fill="${tone(base, 0.18)}"/><rect x="0" y="${H - 17}" width="${W}" height="17" fill="${st.skirt || (st.pattern === 'panel' ? '#5b3620' : tone(base, -0.38))}"/><rect x="0" y="${H - 18}" width="${W}" height="2" fill="${tone(base, 0.3)}" opacity=".7"/>`;
  return `<g clip-path="url(#${clipId})">${s}</g>`;
}
function floorSvg(st, ctx) {
  const N = ISO.N; const rnd = mulberry(21);
  const tex = artFloorTex(st); if (tex) return tex; // the Canva texture, when there is one
  const pat = FLOOR_PATTERNS[st.pattern] || FLOOR_PATTERNS.planks;
  return pat({ N, st, rnd, ctx: ctx || roomCtx() });
}
const wallMatrix = (wall, u, z) => (wall === 'L'
  ? `matrix(${ISO.TW / 200},${-ISO.TH / 200},0,${ISO.ZH / 100},${f1(isoX(0, u))},${f1(isoY(0, u, z))})`
  : `matrix(${ISO.TW / 200},${ISO.TH / 200},0,${ISO.ZH / 100},${f1(isoX(u, 0))},${f1(isoY(u, 0, z))})`);
/* painter's order for things standing or hanging over the floor: b goes after a when it is in front;
   on the same tiles, what hangs goes after what stands (it is above it) */
function sortSolids(list) {
  const n = list.length; const indeg = new Array(n).fill(0); const adj = list.map(() => []);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (i === j) continue; const a = list[i], b = list[j];
    const ov = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.d && b.y < a.y + a.d;
    if (ov) { if (a.layer !== 'hang' && b.layer === 'hang') { adj[i].push(j); indeg[j]++; } continue; }
    const behindX = a.x + a.w <= b.x && !(b.y + b.d <= a.y), behindY = a.y + a.d <= b.y && !(b.x + b.w <= a.x);
    if (behindX || behindY) { adj[i].push(j); indeg[j]++; }
  }
  const out = []; const q = list.map((_, i) => i).filter((i) => !indeg[i]).sort((i, j) => (list[i].x + list[i].y) - (list[j].x + list[j].y));
  while (q.length) { const i = q.shift(); out.push(list[i]); for (const j of adj[i]) if (!--indeg[j]) q.push(j); }
  if (out.length < n) list.forEach((e) => { if (!out.includes(e)) out.push(e); }); // never lose an item
  return out;
}
function drawPlaced(e, ctx, { home = false } = {}) {
  const c = { ...ctx, lit: !e.p.off };
  const inner = home ? (artHome(e.it, c) ?? (e.it.home ? e.it.home(c) : '')) : (artDraw(e.it, c) ?? e.it.draw(c));
  const cls = 'rm-item' + (e.it.pet ? ' pet' : '') + (e.it.glow && e.it.glow !== 'window' ? ' light' : '') + (e.p.off ? ' off' : '') + (e.layer === 'hang' ? ' hang' : '');
  if (e.wall) { // drawn on the wall plane (its projection shears the flat picture); pieces that stand out get their thickness
    const [w, hh] = [e.w, e.hh];
    return `<g class="${cls} wall" data-uid="${e.o.uid}"><g transform="${wallMatrix(e.p.wall, e.p.wall === 'L' ? e.p.u + w : e.p.u, e.p.z)}"><rect x="-4" y="-4" width="${w * 100 + 8}" height="${hh * 100 + 8}" fill="transparent"/>${home ? inner : artWallBody(e.it, e.p.wall, inner)}</g></g>`;
  }
  // flipped items are mirrored around the footprint's back corner, which swaps the footprint (w,d)
  const tr = `translate(${f1(isoX(e.x, e.y))},${f1(isoY(e.x, e.y))})${e.p.flip ? ' scale(-1,1)' : ''}`;
  return `<g class="${cls}" data-uid="${e.o.uid}" transform="${tr}">${inner}</g>`;
}
function footprintPoly(x, y, w, d, cls) { return `<polygon class="${cls}" points="${[[x, y], [x + w, y], [x + w, y + d], [x, y + d]].map(([a, b]) => P(a, b)).join(' ')}"/>`; }
function wallFootprint(wall, u, z, w, hh, cls) {
  const pts = wall === 'L' ? [[0, u, z], [0, u + w, z], [0, u + w, z - hh], [0, u, z - hh]] : [[u, 0, z], [u + w, 0, z], [u + w, 0, z - hh], [u, 0, z - hh]];
  return `<polygon class="${cls}" points="${pts.map(([a, b, c]) => P(a, b, c)).join(' ')}"/>`;
}
/* a door to the next room: wooden, with the room's name above it — locked ones show the level they open at */
function doorSvg(dr, ctx, night) {
  const to = roomDef(dr.to); const open = Room.unlocked(dr.to); const W = dr.w * 100, Hh = dr.h * 100;
  const leaf = open ? '#8a5a36' : '#6b625b', leafD = tone(leaf, -0.25), frame = '#5b3620';
  let art = artDoor(W, Hh, open, dr.wall); // the Canva door (a greyed copy when locked, with its padlock)
  if (!art) { art = `<rect x="-7" y="-6" width="${W + 14}" height="${Hh + 6}" rx="2" fill="${frame}"/><rect x="-3" y="-2" width="${W + 6}" height="${Hh + 2}" fill="${tone(frame, -0.3)}"/>`
    + `<g class="rm-door-leaf"><rect x="0" y="0" width="${W}" height="${Hh}" fill="${leaf}"/>`
    + `<rect x="12" y="14" width="${W - 24}" height="${Hh * 0.36}" rx="3" fill="none" stroke="${leafD}" stroke-width="3"/><rect x="12" y="${Hh * 0.46}" width="${W - 24}" height="${Hh * 0.46}" rx="3" fill="none" stroke="${leafD}" stroke-width="3"/>`
    + `<rect x="0" y="0" width="${W}" height="${Hh}" fill="url(#rm-shaft)" opacity=".08"/>`
    + `<circle cx="${W - 16}" cy="${Hh * 0.55}" r="4.2" fill="${C.gold}" stroke="#a87b16"/><rect x="${W - 18}" y="${Hh * 0.55 + 7}" width="4" height="7" rx="1" fill="#3a2a1a"/></g>`;
  if (!open) art += `<g transform="translate(${W / 2},${Hh * 0.33})"><path d="M-9,-2 v-6 a9,9 0 0 1 18,0 v6" fill="none" stroke="#d9d4c7" stroke-width="3.2"/><rect x="-12" y="-3" width="24" height="19" rx="3" fill="#d9b44a" stroke="#8a6a1e"/><circle cx="0" cy="5" r="2.4" fill="#5a4410"/><rect x="-1" y="6" width="2" height="5" fill="#5a4410"/></g>`; }
  if (open && night > 0.25) art += `<rect x="2" y="${Hh - 3}" width="${W - 4}" height="3" fill="#ffd28a" opacity="${(0.4 + 0.5 * night).toFixed(2)}"/>`;
  const label = open ? to.name : `${to.name} · Lv ${to.lvl}`; const fs = label.length > 16 ? 9.5 : 11;
  art += `<g transform="translate(${W / 2},-24)"><rect x="-58" y="-13" width="116" height="22" rx="5" fill="#2b2118" opacity=".92"/><rect x="-58" y="-13" width="116" height="22" rx="5" fill="none" stroke="${open ? C.gold : '#8e8574'}" stroke-width="1.2" opacity=".8"/><text x="0" y="${fs * 0.36}" font-size="${fs}" text-anchor="middle" fill="${open ? '#f5e6c0' : '#b9b2a6'}" font-family="system-ui, sans-serif" font-weight="700">${esc(label)}</text></g>`;
  const tip = open ? `Go to the ${to.name}` : `${to.name} — opens at level ${to.lvl}`;
  return `<g class="rm-door${open ? '' : ' locked'}" data-to="${to.id}" role="button" aria-label="${esc(tip)}"><title>${esc(tip)}</title><g transform="${wallMatrix(dr.wall, dr.wall === 'L' ? dr.u + dr.w : dr.u, dr.h)}">${art}</g></g>`;
}

/* ---------- light: darkness by the hour, pools of lamp light, the sun and the moon through the windows ---------- */
function sunInfo(d) {
  const hr = d.getHours() + d.getMinutes() / 60; const rise = 6.2, set = 18.7;
  let az, el, color, op, shaft;
  if (hr > rise && hr < set) {
    const t = (hr - rise) / (set - rise); const warm = t < 0.13 || t > 0.86;
    az = Math.PI + 0.14 + t * (Math.PI / 2 - 0.28); el = (11 + 50 * Math.sin(Math.PI * t)) * Math.PI / 180;
    color = warm ? '#ffb46a' : '#ffe39a'; op = warm ? 0.3 : 0.26; shaft = warm ? 0.11 : 0.075;
  } else if (hr >= 20.3 || hr < 4.7) { az = Math.PI * 1.25; el = 38 * Math.PI / 180; color = '#a9bdf5'; op = 0.34; shaft = 0; }
  else return null;
  // light travels away from the sun: every unit of height moves the spot this far across the floor
  const k = 1 / Math.tan(el); return { dx: -Math.cos(el) * Math.cos(az) / Math.sin(el), dy: -Math.cos(el) * Math.sin(az) / Math.sin(el), k, color, op, shaft, moon: !(hr > rise && hr < set) };
}
function convexHull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.slice().reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
function coneGrad(c, up) { const id = `rm-c${up ? 'u' : 'd'}-${c.replace('#', '')}`; return roomDefOnce(id, `<radialGradient cx=".5" cy="${up ? 1 : 0}" r="1" fx=".5" fy="${up ? 1 : 0}"><stop offset="0" stop-color="${c}" stop-opacity="1"/><stop offset=".55" stop-color="${c}" stop-opacity=".45"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`); }
function lightingFor(list, ctx, night, rid, idp) {
  const N = ISO.N, H = ISO.H; const out = { wash: '', pools: '', sunFloor: '', halos: '', dark: '', fx: '', fxFloor: '' }; const holes = [];
  const lights = [];
  for (const e of list) {
    const it = e.it; if (!it.glow || it.glow === 'window' || e.p.off) continue;
    for (const g of it.glow) {
      const [lx, ly, lz, r, c, kind = 'lamp'] = g; let x, y, z, onWall = null;
      if (e.wall) { const along = e.w * (lx || 0.5); z = e.p.z - e.hh / 2 + (lz || 0); if (e.p.wall === 'L') { x = 0.14; y = e.p.u + e.w - along; } else { x = e.p.u + along; y = 0.14; } onWall = e.p.wall; }
      else { const [ax, ay] = e.p.flip ? [ly, lx] : [lx, ly]; x = e.x + ax; y = e.y + ay; z = lz; }
      lights.push({ x, y, z, r, c, kind, onWall });
    }
  }
  for (const dr of roomDoors(rid)) if (Room.unlocked(dr.to) && night > 0.25) lights.push({ x: dr.wall === 'R' ? dr.u + 0.5 : 0.08, y: dr.wall === 'R' ? 0.08 : dr.u + 0.5, z: 0.02, r: 0.45, c: '#ffc27a', kind: 'soft', door: true });
  const nf = night; const f = (v) => f1(v);
  for (const L of lights) {
    const grad = lightGrad(L.c); const cls = L.kind === 'flame' ? ' class="rm-glowflick"' : L.kind === 'screen' ? ' class="rm-glowtv"' : '';
    const bx = isoX(L.x, L.y), by = isoY(L.x, L.y, L.z);
    // a pool of light on the floor, wider for lights up high
    const R = L.r * (0.72 + 0.32 * Math.min(L.z, 2.2)) * (L.onWall ? 0.85 : 1) * (L.door ? 0.8 : 1);
    const px = isoX(L.x, L.y), py = isoY(L.x, L.y, 0); const prx = R * ISO.TW / Math.SQRT2, pry = R * ISO.TH / Math.SQRT2;
    const poolOp = (L.door ? 0.5 * nf : 0.05 + 0.4 * nf) * (L.kind === 'screen' ? 0.55 : 1);
    const wrap = (svg) => (cls ? `<g${cls}>${svg}</g>` : svg);
    out.pools += wrap(`<ellipse cx="${f(px)}" cy="${f(py)}" rx="${f(prx)}" ry="${f(pry)}" fill="url(#${grad})" opacity="${poolOp.toFixed(2)}"/>`);
    holes.push(`<ellipse cx="${f(px)}" cy="${f(py)}" rx="${f(prx * 1.08)}" ry="${f(pry * 1.08)}" fill="url(#rm-hole)"/>`);
    if (!L.door) { // the glow around the light itself
      const hr = L.r * (L.kind === 'flame' ? 24 : L.kind === 'neon' ? 40 : 30);
      out.halos += wrap(`<circle cx="${f(bx)}" cy="${f(by)}" r="${f(hr)}" fill="url(#${grad})" opacity="${((0.08 + 0.46 * nf) * (L.kind === 'neon' ? 1.15 : 1)).toFixed(2)}"/>`);
      holes.push(`<circle cx="${f(bx)}" cy="${f(by)}" r="${f(hr * 1.2)}" fill="url(#rm-hole)"/>`);
    }
    // light thrown on the walls nearby — lampshades throw a cone up and a cone down
    for (const side of ['R', 'L']) {
      const dist = side === 'R' ? L.y : L.x; if (dist > 1.6 || L.door) continue;
      const k = Math.pow(1 - dist / 1.6, 1.2); const along = side === 'R' ? L.x : N - L.y; const fx0 = along * 100, fy0 = (H - L.z) * 100;
      const m = side === 'R' ? `matrix(${ISO.TW / 200},${ISO.TH / 200},0,${ISO.ZH / 100},${f(isoX(0, 0))},${f(isoY(0, 0, H))})` : `matrix(${ISO.TW / 200},${-ISO.TH / 200},0,${ISO.ZH / 100},${f(isoX(0, N))},${f(isoY(0, N, H))})`;
      const op = ((0.05 + 0.5 * nf) * k).toFixed(2), hop = (0.95 * k).toFixed(2);
      const wc = roomDefOnce(`rm-wc-${N * 100}x${H * 100}`, `<clipPath><rect width="${N * 100}" height="${H * 100}"/></clipPath>`); // light stays on the wall
      if (L.kind === 'shade') {
        const up = `M${f(fx0 - 16)},${f(fy0 - 26)} C${f(fx0 - 40)},${f(fy0 - 80)} ${f(fx0 - 70)},${f(fy0 - 150)} ${f(fx0 - 78)},${f(fy0 - 175)} L${f(fx0 + 78)},${f(fy0 - 175)} C${f(fx0 + 70)},${f(fy0 - 150)} ${f(fx0 + 40)},${f(fy0 - 80)} ${f(fx0 + 16)},${f(fy0 - 26)} Z`;
        const dn = `M${f(fx0 - 22)},${f(fy0 + 4)} C${f(fx0 - 50)},${f(fy0 + 60)} ${f(fx0 - 80)},${f(fy0 + 120)} ${f(fx0 - 96)},${f(Math.min(H * 100, fy0 + 175))} L${f(fx0 + 96)},${f(Math.min(H * 100, fy0 + 175))} C${f(fx0 + 80)},${f(fy0 + 120)} ${f(fx0 + 50)},${f(fy0 + 60)} ${f(fx0 + 22)},${f(fy0 + 4)} Z`;
        out.wash += `<g transform="${m}"${cls}><g clip-path="url(#${wc})"><path d="${up}" fill="url(#${coneGrad(L.c, true)})" opacity="${op}"/><path d="${dn}" fill="url(#${coneGrad(L.c, false)})" opacity="${op}"/></g></g>`;
        holes.push(`<g transform="${m}"><g clip-path="url(#${wc})"><path d="${up}" fill="url(#${coneGrad('#000', true)})" opacity="${hop}"/><path d="${dn}" fill="url(#${coneGrad('#000', false)})" opacity="${hop}"/></g></g>`);
      } else {
        const rx = 100 * L.r * (L.onWall === side ? 1.25 : 0.95), ry = 100 * L.r * (L.onWall === side ? 1.1 : 1.3);
        const sh = `<ellipse cx="${f(fx0)}" cy="${f(fy0)}" rx="${f(rx)}" ry="${f(ry)}"`;
        out.wash += `<g transform="${m}"${cls}><g clip-path="url(#${wc})">${sh} fill="url(#${grad})" opacity="${op}"/></g></g>`;
        holes.push(`<g transform="${m}"><g clip-path="url(#${wc})">${sh} fill="url(#rm-hole)" opacity="${hop}"/></g></g>`);
      }
    }
  }
  // the sun (or the moon) through the windows: a bright patch on the floor, and a faint shaft in the air
  const sun = sunInfo(ctx.now);
  if (sun) {
    const day = sun.moon ? nf : 1 - nf * 0.6;
    for (const e of list) {
      if (!e.wall || !(e.it.win || e.it.glow === 'window')) continue;
      const panes = e.it.win || [[0, 0, e.w * 100, e.hh * 100]]; const tints = e.it.winTint || null;
      const toWall = (fx, fy) => { const z = e.p.z - fy / 100; const a = e.p.wall === 'R' ? e.p.u + fx / 100 : e.p.u + e.w - fx / 100; return e.p.wall === 'R' ? [a, 0, z] : [0, a, z]; };
      const toFloor = ([x, y, z]) => [x + sun.dx * z, y + sun.dy * z];
      const shaftPts = []; let tinted = '', plain = '';
      panes.forEach(([px, py, pw, ph], i) => {
        const corners = [[px, py], [px + pw, py], [px + pw, py + ph], [px, py + ph]].map(([a, b]) => toWall(a, b));
        const fl = corners.map(toFloor); const pts = fl.map(([x, y]) => P(x, y)).join(' ');
        if (tints) tinted += `<polygon points="${pts}" fill="${tints[i % tints.length]}"/>`; else plain += `<polygon points="${pts}"/>`;
        corners.forEach((c3) => shaftPts.push([isoX(c3[0], c3[1]), isoY(c3[0], c3[1], c3[2])]));
        fl.forEach(([x, y]) => shaftPts.push([isoX(x, y), isoY(x, y, 0)]));
      });
      // a warm tint that shows on light floors, and a brightening that shows on dark ones
      const op = sun.op * day;
      // (moonlight stays under the night's darkness: lighting it through would also light whatever stands in front)
      if (plain) out.sunFloor += sun.moon ? `<g fill="${sun.color}" opacity="${op.toFixed(2)}" style="mix-blend-mode:screen">${plain}</g>` : `<g fill="${sun.color}" opacity="${op.toFixed(2)}">${plain}</g><g fill="#fff" opacity="${(op * 1.1).toFixed(2)}" style="mix-blend-mode:screen">${plain}</g>`;
      if (tinted) out.sunFloor += `<g opacity="${Math.min(0.6, op * 1.6).toFixed(2)}">${tinted}</g><g opacity="${(op * 0.9).toFixed(2)}" style="mix-blend-mode:screen">${tinted}</g>`;
      if (shaftPts.length && sun.shaft * day > 0.02) out.halos += `<polygon points="${convexHull(shaftPts).map(([x, y]) => `${f(x)},${f(y)}`).join(' ')}" fill="${sun.color}" opacity="${(sun.shaft * day).toFixed(3)}" clip-path="url(#${roomDefOnce(`rm-roomclip-${N}`, `<clipPath><polygon points="${[[0, 0, H], [0, 0, 0], [N, 0, 0], [N, N, 0], [0, N, 0], [0, N, H]].map(([a, b, c]) => P(a, b, c)).join(' ')} ${P(0, 0, H)}"/></clipPath>`)})"/>`;
    }
    if (out.sunFloor) out.sunFloor = `<g clip-path="url(#${roomDefOnce(`rm-floorclip-${N}`, `<clipPath><polygon points="${[[0, 0], [N, 0], [N, N], [0, N]].map(([a, b]) => P(a, b)).join(' ')}"/></clipPath>`)})">${out.sunFloor}</g>`;
  }
  // special effects of some lights (a disco ball, a star projector…)
  for (const e of list) if (e.it.fx && !e.p.off) { const r = e.it.fx(e, ctx, night); if (r) { out.fx += r.air || ''; out.fxFloor += r.floor || ''; (r.holes || []).forEach((hh) => holes.push(hh)); } }
  // the night: everything darkens, except where light falls
  const darkOp = 0.74 * nf;
  if (darkOp > 0.02) {
    const t = 0.14, slab = 0.24;
    const hull = [[-t, N, H + 0.02], [-t, -t, H + 0.02], [N, -t, H + 0.02], [N, -t, -slab], [N, N, -slab], [-t, N, -slab]].map(([a, b, c]) => P(a, b, c)).join(' ');
    out.dark = `<defs><mask id="${idp}-dark" maskUnits="userSpaceOnUse" x="-320" y="-200" width="640" height="520"><rect x="-320" y="-200" width="640" height="520" fill="#fff"/>${holes.join('')}</mask></defs><polygon class="rm-dark" points="${hull}" fill="#050919" opacity="${darkOp.toFixed(2)}" mask="url(#${idp}-dark)" pointer-events="none"/>`;
  }
  return out;
}
let _roomSvgSeq = 0;
/* opts.actors: the character and the pets drawn in place (for the picture to share) */
function roomSvg({ rid = 'study', editing = false, sel = null, mode = 'auto', forExport = false, actors = null, size = null } = {}) {
  ensureRoomDefs();
  const N = ISO.N, H = ISO.H, t = 0.14, slab = 0.24; const ctx = roomCtx(mode); if (forExport) ctx.still = true;
  const ws = Room.styleOf('wall', rid), fs = Room.styleOf('floor', rid);
  const list = Room.placedList(rid); const live = !editing;
  const walls = list.filter((e) => e.wall), flats = list.filter((e) => !e.wall && e.layer === 'flat');
  const homes = live ? list.filter((e) => !e.wall && e.it.walker && e.it.home) : [];
  const standing = list.filter((e) => !e.wall && e.layer !== 'flat' && !(live && e.it.walker));
  const solids = sortSolids(actors ? [...standing, ...actors] : standing);
  const night = roomNight(ctx.now); const sky = skyAt(ctx.now); const idp = 'rmx' + (++_roomSvgSeq);
  const L = lightingFor(list, ctx, night, rid, idp);
  let s = '';
  // shell: outer wall caps, walls, floor slab
  s += poly([[-t, N, 0], [N, N, 0], [N, N, -slab], [-t, N, -slab]], '#4a3a2e') + poly([[N, -t, 0], [N, N, 0], [N, N, -slab], [N, -t, -slab]], '#3a2d24');
  s += `<g transform="matrix(${ISO.TW / 200},${-ISO.TH / 200},0,${ISO.ZH / 100},${f1(isoX(0, N))},${f1(isoY(0, N, H))})">${wallFlat(ws, 'L', ctx)}</g>`;
  s += `<g transform="matrix(${ISO.TW / 200},${ISO.TH / 200},0,${ISO.ZH / 100},${f1(isoX(0, 0))},${f1(isoY(0, 0, H))})">${wallFlat(ws, 'R', ctx)}</g>`;
  s += poly([[-t, -t, H], [0, 0, H], [0, N, H], [-t, N, H]], tone(ws.b, 0.35)) + poly([[-t, -t, H], [N, -t, H], [N, 0, H], [0, 0, H]], tone(ws.a, 0.35));
  s += poly([[-t, N, 0], [0, N, 0], [0, N, H], [-t, N, H]], tone(ws.b, -0.12)) + poly([[N, -t, 0], [N, 0, 0], [N, 0, H], [N, -t, H]], tone(ws.a, -0.3));
  s += `<g class="rm-doors">${roomDoors(rid).map((d) => doorSvg(d, ctx, night)).join('')}</g>`;
  s += `<g class="rm-walls">${walls.map((e) => drawPlaced(e, ctx)).join('')}</g>`;
  if (L.wash) s += `<g class="rm-wash" pointer-events="none" style="mix-blend-mode:screen">${L.wash}</g>`;
  s += `<g class="rm-floor">${floorSvg(fs, ctx)}</g>`;
  if (editing) { let g = ''; for (let i = 0; i <= N; i++) g += `<path d="M${P(i, 0)} L${P(i, N)} M${P(0, i)} L${P(N, i)}"/>`; s += `<g class="rm-grid">${g}</g>`; }
  s += `<g class="rm-flats">${flats.map((e) => drawPlaced(e, ctx)).join('')}${homes.map((e) => drawPlaced(e, ctx, { home: true })).join('')}</g>`;
  s += `<g class="rm-pools" pointer-events="none">${L.sunFloor}${L.fxFloor}<g style="mix-blend-mode:screen">${L.pools}</g></g>`;
  if (editing && sel) { const e = list.find((x) => x.o.uid === sel); if (e) s += e.wall ? wallFootprint(e.p.wall, e.p.u, e.p.z, e.w, e.hh, 'rm-sel') : footprintPoly(e.x, e.y, e.w, e.d, 'rm-sel'); }
  s += '<g class="rm-ghost-layer"></g>';
  s += `<g class="rm-solids">${solids.map((e) => (e.actor ? e.svg : drawPlaced(e, ctx))).join('')}</g>`;
  s += L.dark;
  const hull = [[-t, N, H], [-t, -t, H], [N, -t, H], [N, -t, -slab], [N, N, -slab], [-t, N, -slab]].map(([a, b, c]) => P(a, b, c)).join(' ');
  if (sky.key === 'dusk' && night < 0.95) s += `<polygon points="${hull}" fill="#ff9a4a" opacity="${(0.1 * (1 - night)).toFixed(2)}" pointer-events="none"/>`;
  s += `<g class="rm-halos" pointer-events="none" style="mix-blend-mode:screen">${L.halos}</g>`;
  if (L.fx) s += `<g class="rm-fx" pointer-events="none">${L.fx}</g>`;
  const defs = forExport ? `<defs>${$('#rm-defs defs').innerHTML}</defs>` : '';
  const dims = size ? ` width="${size[0]}" height="${size[1]}"` : '';
  return `<svg class="room-svg" xmlns="http://www.w3.org/2000/svg" viewBox="-272 -130 544 414"${dims} role="img" aria-label="${esc(roomDef(rid).name)}">${defs}${s}</svg>`;
}
/* shop previews (cached: the same picture until the hour, the achievements or the level change) */
const _prevCache = new Map();
function itemPreviewSvg(it) {
  const d = new Date(nowMs()); const cr = Credits.get(); const key = `${it.id}|${d.getHours()}|${Object.keys(state.settings.achievements || {}).length}|${cr.level}`;
  let v = _prevCache.get(key); if (v) return v;
  if (_prevCache.size > 900) _prevCache.clear();
  v = itemPreviewSvgRaw(it); _prevCache.set(key, v); return v;
}
function itemPreviewSvgRaw(it) {
  ensureRoomDefs(); const ctx = { ...roomCtx(), lit: true };
  const art = artDraw(it, ctx) ?? it.draw(ctx);
  if (it.wall) { // on a patch of the right wall, projected as in the room
    const [w, hh] = it.wall; const W = w * 100, H = hh * 100, m = 20; const a = ISO.TW / 200, b = ISO.TH / 200, d = ISO.ZH / 100;
    const pts = [[-m, -m], [W + m, -m], [W + m, H + m], [-m, H + m]].map(([x, y]) => [a * x, b * x + d * y]);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); const x0 = Math.min(...xs) - 3, y0 = Math.min(...ys) - 3;
    return `<svg viewBox="${f1(x0)} ${f1(y0)} ${f1(Math.max(...xs) + 3 - x0)} ${f1(Math.max(...ys) + 3 - y0)}" class="prev-svg"><polygon points="${pts.map((p) => p.map(f1).join(',')).join(' ')}" fill="#d9c7a4"/><g transform="matrix(${a},${b},0,${d},0,0)">${artWallBody(it, 'R', art)}</g></svg>`;
  }
  const [w, d] = it.fp; const hgt = it.hgt || 1.2;
  if (it.hang) {
    const top = it.top || ISO.H, low = it.low != null ? it.low : 1.6;
    const x0 = isoX(0, d) - 12, x1 = isoX(w, 0) + 12, y0 = isoY(0, 0, top) - 4, y1 = isoY(w, d, low) + 8;
    return `<svg viewBox="${f1(x0)} ${f1(y0)} ${f1(x1 - x0)} ${f1(y1 - y0)}" class="prev-svg">${art}</svg>`;
  }
  const x0 = isoX(0, d) - 14, x1 = isoX(w, 0) + 14, y0 = isoY(0, 0, hgt) - 12, y1 = isoY(w, d) + 10;
  return `<svg viewBox="${f1(x0)} ${f1(y0)} ${f1(x1 - x0)} ${f1(y1 - y0)}" class="prev-svg">${poly([[0, 0], [w, 0], [w, d], [0, d]], '#3a3632', ' stroke="#55504a" stroke-width="1"')}${art}</svg>`;
}
function styleSvg(st, rid = 'study') {
  ensureRoomDefs(); const n = 3, H = 1.7; const ctx = roomCtx();
  const ws = st.kind === 'wall' ? st : Room.styleOf('wall', rid), fs = st.kind === 'floor' ? st : Room.styleOf('floor', rid);
  const saveN = ISO.N, saveH = ISO.H; ISO.N = n; ISO.H = H;
  let svg;
  try { svg = `<g transform="matrix(${ISO.TW / 200},${-ISO.TH / 200},0,${ISO.ZH / 100},${f1(isoX(0, n))},${f1(isoY(0, n, H))})">${wallFlat(ws, 'L', ctx)}</g><g transform="matrix(${ISO.TW / 200},${ISO.TH / 200},0,${ISO.ZH / 100},${f1(isoX(0, 0))},${f1(isoY(0, 0, H))})">${wallFlat(ws, 'R', ctx)}</g>${floorSvg(fs, ctx)}`; }
  finally { ISO.N = saveN; ISO.H = saveH; }
  return `<svg viewBox="${f1(isoX(0, n)) - 6} ${f1(isoY(0, 0, H)) - 6} ${f1(isoX(n, 0) - isoX(0, n)) + 12} ${f1(isoY(n, n) - isoY(0, 0, H)) + 12}" class="prev-svg">${svg}</svg>`;
}

/* ---------- the room card (top of the Achievements screen) ---------- */
const LS_ROOM = 'csp:v2:room-cur', LS_LIGHT = 'csp:v2:room-light';
const lsGetRaw = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSetRaw = (k, v) => { try { localStorage.setItem(k, v); } catch { /* */ } };
const LIGHT_MODES = [['auto', 'Real time'], ['day', 'Day'], ['dusk', 'Evening'], ['night', 'Night']];
const RoomView = {
  room: null, editing: false, sel: null, drag: null, root: null, stage: null, keyOff: null, timer: null, offs: [], sig: '', light: null,
  busy() { return !!this.drag; },
  cur() { const r = this.room || lsGetRaw(LS_ROOM) || 'study'; return ROOMS.some((x) => x.id === r) && Room.unlocked(r) ? r : 'study'; },
  lightMode() { if (!this.light) this.light = lsGetRaw(LS_LIGHT) || 'auto'; return this.light; },
  visualKey() { const d = roomClock(this.lightMode()); const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; return `${todayKey()}|${skyAt(d).key}|${Math.round(roomNight(d) * 8)}|${Math.round(d.getHours() * 2 + d.getMinutes() / 30)}${still ? '|' + d.getHours() + ':' + d.getMinutes() : ''}`; },
  unmount() { this.stopKeys(); Actors.unmount(); this.offs.forEach((f) => f()); this.offs = []; if (this.timer) { clearInterval(this.timer); this.timer = null; } if (this.waitSync) { clearInterval(this.waitSync); this.waitSync = null; } this.editing = false; this.sel = null; this.drag = null; this.root = null; this.stage = null; },
  roomSig() { const rid = this.cur(); const won = state.settings.achievements || {}; return JSON.stringify([rid, this.editing, this.sel, this.lightMode(), this.visualKey(), Room.level(), Object.keys(won).length, state.room.placed, state.room.style, state.room.styles, (state.room.owned || []).length, state.room.avatar]); },
  /* things that write to the room wait until this device has the account's latest room */
  synced() { return !Sync.enabled || Sync.pulled; },
  afterSync() { if (!this.root) return; Room.ensureStarter(); Room.fixDoors(this.cur()); this.update(); },
  card() {
    this.room = this.cur();
    if (this.synced()) { Room.ensureStarter(); Room.fixDoors(this.room); }
    else if (!this.waitSync) this.waitSync = setInterval(() => { if (!this.synced()) return; clearInterval(this.waitSync); this.waitSync = null; this.afterSync(); }, 400);
    this.head = h('div', { class: 'room-head' }); this.tabs = h('div', { class: 'room-tabs', role: 'tablist', 'aria-label': 'Rooms' });
    this.stage = h('div', { class: 'room-stage' + (this.editing ? ' editing' : '') });
    this.ctl = h('div', { class: 'stage-ctl' }); this.foot = h('div', { class: 'room-foot' });
    this.root = h('section', { class: 'card room-card' }, this.head, this.tabs, h('div', { class: 'stage-wrap' }, this.stage, this.ctl), this.foot);
    this.renderChrome(); this.paint();
    if (this.editing) this.startKeys(); else this.stopKeys();
    if (!this.offs.length) this.offs.push(on('change', () => this.update()));
    // redraw only when the light, the sky or the date changes (clock hands move by themselves)
    if (!this.timer) this.timer = setInterval(() => {
      if (!this.stage || !this.stage.isConnected) return;
      if (!this.drag && !document.hidden && this.roomSig() !== this.sig) this.paint();
    }, 60000);
    return this.root;
  },
  /* data changed somewhere: refresh the numbers, and the picture only if the room looks different */
  update() {
    if (!this.root || this.drag) return;
    this.renderChrome();
    if (this.roomSig() !== this.sig) this.paint();
  },
  renderChrome() {
    const cr = Credits.get(); const rid = this.cur(); const rd = roomDef(rid);
    const breakdown = `Earned ${fmtNum(cr.earned)} · studying ${fmtNum(cr.parts.time)} · achievements ${fmtNum(cr.parts.achievements)} · closed days ${fmtNum(cr.parts.closing)} · meditation days ${fmtNum(cr.parts.meditation)} · spent ${fmtNum(cr.spent)}`;
    setKids(this.head,
      h('div', { class: 'room-title' }, h('h2', null, rid === 'study' ? 'Your study room' : rd.name),
        h('div', { class: 'lvl', title: `${fmtNum(cr.xp)} XP — every credit you earn counts, even after you spend it` }, h('span', { class: 'lvl-badge' }, `Lv ${cr.level}`), h('span', { class: 'lvl-name' }, cr.title),
          h('span', { class: 'lvl-bar' }, h('i', { style: { width: Math.round(cr.levelPct * 100) + '%' } })), h('span', { class: 'faint small num' }, `${fmtNum(cr.xp)} / ${fmtNum(cr.levelTo)}`))),
      h('div', { class: 'row room-actions' },
        h('span', { class: 'credit-balance', title: breakdown }, coinIcon('lg'), h('b', { class: 'num' }, fmtNum(cr.balance)), h('span', { class: 'muted small' }, 'credits')),
        h('button', { class: 'btn sm', title: 'Your character', onClick: () => AvatarEditor.open() }, icon('user'), 'Character'),
        h('button', { class: 'btn sm' + (this.editing ? ' primary' : ''), onClick: () => this.toggleEdit() }, icon(this.editing ? 'check-outline' : 'edit'), this.editing ? 'Done' : 'Decorate'),
        h('button', { class: 'btn sm shop-btn', onClick: () => Shop.open() }, coinIcon(), 'Shop'),
        h('button', { class: 'btn sm', title: 'A picture of this room for your stories', onClick: () => RoomStory.open(rid) }, icon('image'), 'Share')));
    setKids(this.tabs, ...ROOMS.map((r) => {
      const open = cr.level >= r.lvl; const on2 = r.id === rid;
      return h('button', { class: 'room-tab' + (on2 ? ' on' : '') + (open ? '' : ' locked'), role: 'tab', 'aria-selected': String(on2), title: open ? r.desc : `${r.desc} Opens at level ${r.lvl}.`, onClick: () => this.goTo(r.id) },
        open ? null : h('span', { class: 'lock', 'aria-hidden': 'true' }, '🔒'), r.name, open ? null : h('span', { class: 'faint' }, ` Lv ${r.lvl}`));
    }));
    const mode = this.lightMode(); const lm = LIGHT_MODES.find((x) => x[0] === mode) || LIGHT_MODES[0];
    setKids(this.ctl, h('button', { class: 'btn sm ghost stage-btn', title: 'Light: real time, or preview the day, the evening or the night', onClick: () => this.cycleLight() }, h('span', { 'aria-hidden': 'true' }, { auto: '◐', day: '☀', dusk: '◒', night: '☾' }[mode] || '◐'), lm[1]));
    const pend = Room.pendingRewards();
    const hint = this.editing ? this.editBar()
      : h('p', { class: 'room-hint muted small' }, `${CREDITS_PER_HOUR} credits per hour of study · +${CLOSE_DAY_CREDITS} for each day you close · +10 to +200 per achievement · +${MED_DAY_CREDITS} for each day you meditate. Tap a lamp to switch it, a door to change rooms, your character or an animal to say hello.`);
    setKids(this.foot, pend.length && !this.editing ? h('div', { class: 'reward-note' }, h('span', null, '🎁 ', h('b', null, `${pend.length} special item${pend.length === 1 ? '' : 's'}`), ' from your achievements ', pend.length === 1 ? 'is' : 'are', ' waiting.'),
      h('button', { class: 'btn sm primary', onClick: () => { const r = Room.placeAllRewards(this.cur()); toast(r.n ? `${r.n} reward${r.n === 1 ? '' : 's'} placed in the rooms they suit best` + (r.stored ? ` · ${r.stored} kept in storage — place them from Decorate` : '') : 'They are in storage — place them from Decorate', { duration: 7000 }); } }, 'Place them'),
      h('button', { class: 'btn sm', onClick: () => Shop.open('rewards') }, 'See all rewards')) : null, hint);
  },
  cycleLight() { const i = LIGHT_MODES.findIndex((x) => x[0] === this.lightMode()); this.light = LIGHT_MODES[(i + 1) % LIGHT_MODES.length][0]; lsSetRaw(LS_LIGHT, this.light); this.renderChrome(); this.paint(); },
  goTo(rid, { via } = {}) {
    const r = roomDef(rid);
    if (!Room.unlocked(rid)) { const cr = Credits.get(); const need = 50 * (r.lvl - 1) ** 2 - cr.xp; toast(`The ${r.name} opens at level ${r.lvl} — ${fmtNum(Math.max(0, need))} more credits to earn`, { duration: 5000 }); return; }
    if (rid === this.cur() && this.room === rid) return;
    const from = this.cur(); this.room = rid; lsSetRaw(LS_ROOM, rid); this.sel = null;
    if (this.synced()) Room.fixDoors(rid);
    Actors.arrive(rid, via ? from : null);
    this.stage.classList.add('switching');
    setTimeout(() => { if (!this.stage) return; this.renderChrome(); this.paint(); this.stage.classList.remove('switching'); }, 140);
  },
  paint() {
    if (!this.stage) return;
    this.sig = this.roomSig(); const rid = this.cur();
    this.stage.classList.toggle('editing', this.editing);
    this.stage.innerHTML = roomSvg({ rid, editing: this.editing, sel: this.sel, mode: this.lightMode() });
    this.bind();
    Actors.mount($('svg', this.stage), rid, { editing: this.editing, mode: this.lightMode() });
  },
  refresh() { if (!this.root) return; this.renderChrome(); this.paint(); if (this.editing) this.startKeys(); else this.stopKeys(); },
  toggleEdit() { this.editing = !this.editing; if (!this.editing) this.sel = null; this.refresh(); },
  editBar() {
    const rid = this.cur();
    const stored = Room.owned().filter((o) => !Room.pl(o.uid) && roomItem(o.item));
    const selO = this.sel && Room.owned().find((o) => o.uid === this.sel); const selIt = selO && roomItem(selO.item);
    const others = Room.unlockedRooms().filter((r) => r.id !== rid);
    const tools = selIt ? h('div', { class: 'room-tools' }, h('b', null, selIt.name),
      !selIt.wall ? h('button', { class: 'btn sm', title: 'Mirror it (F)', onClick: () => this.flip() }, '⇋ Flip') : null,
      selIt.wall ? h('button', { class: 'btn sm', title: 'Move to the other wall', onClick: () => this.otherWall() }, '⇄ Other wall') : null,
      others.length ? h('select', { class: 'sm-select', 'aria-label': 'Move to another room', onChange: (e) => { const to = e.target.value; if (!to) return; const u = this.sel; this.sel = null; if (Room.moveToRoom(u, to)) toast(`Moved to the ${roomDef(to).name}`); else { this.sel = u; e.target.value = ''; toast(`No free spot in the ${roomDef(to).name}`, { error: true }); } } },
        h('option', { value: '' }, 'Move to…'), ...others.map((r) => h('option', { value: r.id }, r.name))) : null,
      h('button', { class: 'btn sm', title: 'Put it away (Delete)', onClick: () => { const u = this.sel; this.sel = null; Room.store(u); } }, 'Store'),
      h('button', { class: 'btn sm ghost', onClick: () => { this.sel = null; this.refresh(); } }, 'Deselect'))
      : h('p', { class: 'muted small' }, 'Drag things to move them — walls take pictures, windows and shelves. Tap one for more options; arrow keys nudge it. Doors lead to your other rooms.');
    return h('div', { class: 'room-edit' }, tools,
      stored.length ? h('div', { class: 'room-store' }, h('span', { class: 'muted small' }, `In storage (${stored.length}):`), ...stored.map((o) => {
        const it = roomItem(o.item);
        return h('button', { class: 'store-chip' + (o.reward ? ' reward' : ''), title: 'Place it in this room', onClick: () => { this.sel = o.uid; if (!Room.placeStored(o.uid, rid)) { this.sel = null; toast('No free spot — move or store something first', { error: true }); } } },
          h('span', { class: 'store-prev', html: itemPreviewSvg(it) }), o.reward ? '🎁 ' : '', it.name);
      })) : null);
  },
  selEntry() { return Room.placedList(this.cur()).find((x) => x.o.uid === this.sel); },
  flip() {
    const e = this.selEntry(); if (!e || e.wall) return;
    if (Room.fitsFloor(e.o.uid, e.it, e.x, e.y, !e.p.flip, this.cur())) Room.move(e.o.uid, { x: e.x, y: e.y, flip: !e.p.flip });
    else toast('No room to turn it here — move it first', { error: true });
  },
  otherWall() {
    const e = this.selEntry(); if (!e || !e.wall) return;
    const wall = e.p.wall === 'L' ? 'R' : 'L';
    for (let u = e.p.u, n = 0; n < 16; n++, u = (u + 0.5) % (ISO.N - e.w + 0.5)) if (Room.fitsWall(e.o.uid, e.it, wall, u, e.p.z, this.cur())) { Room.move(e.o.uid, { wall, u, z: e.p.z }); return; }
    toast('The other wall is full at that height', { error: true });
  },
  saveSoon: debounce(() => commit('room'), 450),
  nudge(dx, dy) {
    const e = this.selEntry(); if (!e) return; const rid = this.cur(); let pos = null;
    if (e.wall) { const u = e.p.u + dx * 0.5, z = e.p.z - dy * 0.25; if (Room.fitsWall(e.o.uid, e.it, e.p.wall, u, z, rid)) pos = { wall: e.p.wall, u, z }; }
    else if (Room.fitsFloor(e.o.uid, e.it, e.x + dx, e.y + dy, e.p.flip, rid)) pos = { x: e.x + dx, y: e.y + dy, flip: e.p.flip };
    if (!pos) return;
    Room.move(e.o.uid, pos, { silent: true }); persist(); this.paint(); this.saveSoon(); // held arrow keys: one save at the end
  },
  startKeys() {
    if (this.keyOff) return;
    const onKey = (e) => {
      if (!this.editing || !this.sel || modalStack.length) return;
      const tag = document.activeElement?.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const map = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
      if (map[e.key]) { e.preventDefault(); this.nudge(...map[e.key]); }
      else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); this.flip(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); const u = this.sel; this.sel = null; Room.store(u); }
      else if (e.key === 'Escape') { this.sel = null; this.refresh(); }
    };
    document.addEventListener('keydown', onKey); this.keyOff = () => document.removeEventListener('keydown', onKey);
  },
  stopKeys() { if (this.keyOff) { this.keyOff(); this.keyOff = null; } },
  /* pointer → room coordinates */
  svgPoint(svg, e) { const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); },
  bind() {
    const svg = $('svg', this.stage); if (!svg) return; const rid = this.cur();
    svg.addEventListener('click', (e) => {
      if (performance.now() - (this.dropAt || 0) < 350) return; // the click that ends a drag
      const door = e.target.closest('.rm-door'); if (door) { this.goTo(door.dataset.to, { via: true }); return; }
      if (this.editing) return;
      const actor = e.target.closest('.rm-actor'); if (actor) { Actors.tap(actor.dataset.actor); return; }
      const g = e.target.closest('.rm-item'); if (!g) return;
      if (g.classList.contains('pet')) { this.hello(svg, g); return; } // animals say hello, even the ones that glow
      if (g.classList.contains('light')) Room.toggleLight(g.dataset.uid);
    });
    svg.addEventListener('pointerdown', (e) => {
      if (!this.editing) return;
      const g = e.target.closest('.rm-item');
      if (!g) { if (this.sel && !e.target.closest('.rm-door')) { this.sel = null; this.refresh(); } return; }
      const uidv = g.dataset.uid; const ent = Room.placedList(rid).find((x) => x.o.uid === uidv); if (!ent) return;
      e.preventDefault();
      const p = this.svgPoint(svg, e); const fx = (p.x / (ISO.TW / 2) + p.y / (ISO.TH / 2)) / 2, fy = (p.y / (ISO.TH / 2) - p.x / (ISO.TW / 2)) / 2;
      this.drag = { uid: uidv, ent, g, off: ent.wall ? null : [fx - ent.x, fy - ent.y], start: [e.clientX, e.clientY], moved: false, pos: null, ok: true, pointerId: e.pointerId };
      if (this.sel !== uidv) { this.sel = uidv; const layer = $('.rm-ghost-layer', svg); if (layer) layer.innerHTML = ent.wall ? wallFootprint(ent.p.wall, ent.p.u, ent.p.z, ent.w, ent.hh, 'rm-sel') : footprintPoly(ent.x, ent.y, ent.w, ent.d, 'rm-sel'); }
      try { svg.setPointerCapture(e.pointerId); } catch { /* */ }
    });
    svg.addEventListener('pointermove', (e) => {
      const d = this.drag; if (!d || e.pointerId !== d.pointerId) return;
      if (!d.moved && Math.hypot(e.clientX - d.start[0], e.clientY - d.start[1]) < 4) return;
      d.moved = true; this.stage.classList.add('dragging');
      const p = this.svgPoint(svg, e); const it = d.ent.it; let pos, ok, ghost;
      if (d.ent.wall) {
        const wall = p.x < 0 ? 'L' : 'R'; const along = wall === 'R' ? p.x / (ISO.TW / 2) : -p.x / (ISO.TW / 2);
        const z = (along * ISO.TH / 2 - p.y) / ISO.ZH; const [w, hh] = it.wall;
        const u = clamp(Math.round((along - w / 2) * 2) / 2, 0, ISO.N - w), zt = clamp(Math.round((z + hh / 2) * 4) / 4, hh + 0.2, ISO.H - 0.08);
        pos = { wall, u, z: zt }; ok = Room.fitsWall(d.uid, it, wall, u, zt, rid); ghost = wallFootprint(wall, u, zt, w, hh, ok ? 'rm-ghost' : 'rm-ghost bad');
        d.g.firstElementChild.setAttribute('transform', wallMatrix(wall, wall === 'L' ? u + w : u, zt));
      } else {
        const fx = (p.x / (ISO.TW / 2) + p.y / (ISO.TH / 2)) / 2, fy = (p.y / (ISO.TH / 2) - p.x / (ISO.TW / 2)) / 2;
        const [w, dd] = Room.dims(it, d.ent.p.flip);
        const x = clamp(Math.round(fx - d.off[0]), 0, ISO.N - w), y = clamp(Math.round(fy - d.off[1]), 0, ISO.N - dd);
        pos = { x, y, flip: !!d.ent.p.flip }; ok = Room.fitsFloor(d.uid, it, x, y, d.ent.p.flip, rid); ghost = footprintPoly(x, y, w, dd, ok ? 'rm-ghost' : 'rm-ghost bad');
        d.g.setAttribute('transform', `translate(${f1(isoX(x, y))},${f1(isoY(x, y))})${d.ent.p.flip ? ' scale(-1,1)' : ''}`);
        const top = $('.rm-solids', svg); if (top && d.g.parentNode === top) top.append(d.g); // stay on top while dragging
      }
      d.pos = pos; d.ok = ok; const layer = $('.rm-ghost-layer', svg); if (layer) layer.innerHTML = ghost;
    });
    const end = (e, cancel) => {
      const d = this.drag; if (!d || (e && e.pointerId !== d.pointerId)) return;
      this.drag = null; this.stage.classList.remove('dragging');
      if (d.moved) this.dropAt = performance.now();
      if (!cancel && d.moved && d.ok && d.pos) { Room.move(d.uid, d.pos); return; } // the page redraws itself
      if (d.moved && !d.ok) {
        const what = d.ent.wall ? (Room.doorHit(rid, d.pos.wall, d.pos.u, d.ent.w, d.pos.z, d.ent.hh) ? 'The door needs that space' : 'Something is already there') : 'Something is already there';
        toast(what, { error: true });
      }
      this.refresh();
    };
    svg.addEventListener('pointerup', (e) => end(e, false));
    svg.addEventListener('pointercancel', (e) => end(e, true));
  },
  /* tap an animal that does not walk: a little heart */
  hello(svg, g) {
    const bb = g.getBBox(); const ctm = g.getCTM(); const svgCtm = svg.getCTM();
    const pt = svg.createSVGPoint(); pt.x = bb.x + bb.width / 2; pt.y = bb.y; const p = pt.matrixTransform(svgCtm.inverse().multiply(ctm));
    heartAt(svg, p.x, p.y);
  },
};
/* a fresh achievement brings its reward into a room, on whatever screen you are */
on('achievements', (fresh) => {
  if (Sync.enabled && !Sync.pulled) return; // (the first sync's burst waits in storage)
  const got = Room.grantRewards(fresh);
  got.forEach((g, i) => setTimeout(() => toast(g.rid ? `🎁 Reward: ${g.it.name} — now in your ${roomDef(g.rid).name}` : `🎁 Reward: ${g.it.name} — waiting in storage`, { duration: 6500, action: 'See', onAction: () => { if (g.rid) { RoomView.room = g.rid; lsSetRaw(LS_ROOM, g.rid); } location.hash = '#/achievements'; setTimeout(() => { RoomView.refresh(); $('.room-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 150); } }), 1600 + i * 2600));
});
function heartAt(svg, x, y) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  el.setAttribute('x', f1(x)); el.setAttribute('y', f1(y)); el.setAttribute('class', 'rm-heart'); el.setAttribute('text-anchor', 'middle'); el.textContent = '♥';
  svg.append(el); setTimeout(() => el.remove(), 1300);
}

/* A new level can open a room: say so once. */
const RoomNotify = {
  key() { return `csp:v2:lvlseen:${Sync.userId || 'local'}`; },
  check: debounce(function check() {
    const lv = Credits.get().level; const seen = +lsGetRaw(RoomNotify.key()) || 0;
    if (!seen) { lsSetRaw(RoomNotify.key(), String(lv)); return; }
    if (lv <= seen) return;
    lsSetRaw(RoomNotify.key(), String(lv));
    const opened = ROOMS.filter((r) => r.lvl > seen && r.lvl <= lv);
    const title = LEVEL_TITLES.filter(([l]) => l <= lv).pop()[1];
    if (opened.length) toast(`Level ${lv}! A new room is open: the ${opened[opened.length - 1].name}`, { duration: 8000, action: 'Visit', onAction: () => { RoomView.room = opened[opened.length - 1].id; lsSetRaw(LS_ROOM, RoomView.room); location.hash = '#/achievements'; } });
    else toast(`Level ${lv} — ${title}. New things in the shop.`, { duration: 5000 });
  }, 1500),
};
on('change', () => { if (state.settings.updated_at || state.sessions.length) RoomNotify.check(); });

/* ---------- the shop ---------- */
const Shop = {
  cat: 'furniture', q: '', only: false,
  open(cat) {
    if (cat) this.cat = cat;
    const rid = RoomView.cur(); const body = h('div', { class: 'shop' });
    const m = openModal({ title: 'Shop', cls: 'shop-modal', body });
    const grid = h('div', { class: 'shop-grid' }); const tabs = h('div', { class: 'shop-tabs' }); const top = h('div', { class: 'shop-top' });
    const search = h('input', { type: 'search', class: 'shop-search', placeholder: 'Search the shop…', value: this.q, 'aria-label': 'Search the shop' });
    const only = h('label', { class: 'shop-only small' }, h('input', { type: 'checkbox', checked: this.only }), ' Only what I can get now');
    search.addEventListener('input', debounce(() => { this.q = search.value.trim(); renderGrid(); }, 150));
    only.querySelector('input').addEventListener('change', (e) => { this.only = e.target.checked; renderGrid(); });
    const renderTop = () => { const cr = Credits.get(); setKids(top, h('span', { class: 'credit-balance' }, coinIcon('lg'), h('b', { class: 'num' }, fmtNum(cr.balance)), h('span', { class: 'muted small' }, 'credits')),
      h('span', { class: 'muted small' }, `Level ${cr.level} · ${cr.title} · buying for the ${roomDef(rid).name}`)); };
    const renderTabs = () => setKids(tabs, ...ROOM_CATS.map(([id, label]) => {
      const n = id === 'styles' ? ROOM_STYLES.length : id === 'rewards' ? ROOM_ITEMS.filter((i) => i.reward).length : ROOM_ITEMS.filter((i) => i.cat === id && i.price > 0 && !i.reward).length;
      return h('button', { class: 'chip' + (id === this.cat && !this.q ? ' on' : ''), style: { '--c': '#e8b93c', '--ink': '#1d1606' }, onClick: () => { this.cat = id; this.q = ''; search.value = ''; renderTabs(); renderGrid(); } }, label, h('span', { class: 'chip-n' }, n));
    }));
    const renderGrid = () => {
      const cr = Credits.get(); const q = this.q.toLowerCase();
      let list;
      if (q) list = [...ROOM_ITEMS.filter((i) => (i.price > 0 || i.reward) && (i.name + ' ' + (i.desc || '')).toLowerCase().includes(q)), ...ROOM_STYLES.filter((s) => s.name.toLowerCase().includes(q))];
      else if (this.cat === 'styles') list = ROOM_STYLES.slice();
      else if (this.cat === 'rewards') list = ROOM_ITEMS.filter((i) => i.reward);
      else list = ROOM_ITEMS.filter((i) => i.cat === this.cat && i.price > 0 && !i.reward);
      if (this.only) list = list.filter((it) => (it.reward ? !!(state.settings.achievements || {})[it.reward] : (it.lvl || 0) <= cr.level && (it.price <= cr.balance || (it.kind && Room.styleUsable(it, rid)))));
      if (this.cat !== 'rewards' || q) list.sort((a, b) => (a.reward ? 1 : 0) - (b.reward ? 1 : 0) || ((a.lvl || 0) > cr.level) - ((b.lvl || 0) > cr.level) || (a.kind || '').localeCompare(b.kind || '') || (a.price || 0) - (b.price || 0));
      const achList = this.cat === 'rewards' || q ? Achievements.list() : null;
      renderTabs();
      const MAX = 96; const shown = list.slice(0, MAX);
      setKids(grid, ...(list.length ? shown.map((it) => this.cardFor(it, cr, rid, rerender, m, achList)) : [h('p', { class: 'muted' }, 'Nothing here yet.')]),
        list.length > MAX ? h('p', { class: 'muted small shop-more' }, `Showing ${MAX} of ${list.length} — type a little more to narrow it down.`) : null);
    };
    const rerender = () => { renderTop(); renderGrid(); };
    setKids(body, top, h('div', { class: 'shop-filter' }, search, only), tabs, grid);
    rerender();
    setTimeout(() => { if (!matchMedia('(pointer: coarse)').matches) search.focus(); }, 50);
  },
  cardFor(it, cr, rid, rerender, modal, achList) {
    const isStyle = !!it.kind; const owned = Room.countOwned(it.id); const locked = (it.lvl || 0) > cr.level; const afford = cr.balance >= it.price;
    const applied = isStyle && Room.styleOf(it.kind, rid).id === it.id;
    let action; let extra = null;
    if (it.reward) {
      const a = (achList || Achievements.list()).find((x) => x.id === it.reward); const won = !!(state.settings.achievements || {})[it.reward];
      if (won) {
        const where = Room.roomOfUid('rw-' + it.id);
        action = where ? h('span', { class: 'tag ok' }, `in the ${roomDef(where).name}`) : h('button', { class: 'btn sm primary', onClick: () => { if (Room.placeStored('rw-' + it.id, rid)) { modal.close(); RoomView.editing = true; RoomView.sel = 'rw-' + it.id; RoomView.room = rid; location.hash = '#/achievements'; RoomView.refresh(); toast(`${it.name} is in your ${roomDef(rid).name}`); } else toast('No free spot in this room', { error: true }); } }, 'Place');
      } else {
        const hidden = a && a.hidden;
        extra = h('div', { class: 'reward-req small' }, h('span', { class: 'muted' }, '🏆 ', hidden ? 'A hidden achievement' : a ? a.desc : ''), a && !hidden ? h('div', { class: 'progress sm' }, h('i', { style: { width: Math.round(a.pct * 100) + '%' } })) : null);
        action = h('span', { class: 'shop-lock small' }, a && !hidden ? `${fmtNum(Math.floor(Math.min(a.have, a.goal)))}/${fmtNum(a.goal)}` : '🔒');
      }
    } else if (isStyle && Room.styleUsable(it, rid)) action = applied ? h('span', { class: 'tag ok' }, 'in use') : h('button', { class: 'btn sm', onClick: () => { Room.applyStyle(it.id, rid); rerender(); } }, 'Use here');
    else if (locked) action = h('span', { class: 'shop-lock small' }, `🔒 level ${it.lvl}`);
    else action = h('button', { class: 'btn sm' + (afford ? ' primary' : ''), disabled: !afford, title: afford ? '' : `${fmtNum(it.price - cr.balance)} more credits needed`, onClick: () => this.buy(it, rid, rerender, modal) }, coinIcon(), fmtNum(it.price));
    const tags = [];
    if (it.glow && !isStyle) tags.push(h('span', { class: 'mini-tag' }, it.glow === 'window' ? '☀ sunlight' : '💡 light'));
    if (it.walker) tags.push(h('span', { class: 'mini-tag' }, '🐾 walks around'));
    if (it.hang) tags.push(h('span', { class: 'mini-tag' }, '⤓ hangs'));
    if (it.room && !isStyle) tags.push(h('span', { class: 'mini-tag' }, roomDef(it.room).name));
    return h('div', { class: 'shop-card' + (locked ? ' locked' : '') + (applied ? ' applied' : '') + (it.reward ? ' reward' : '') },
      h('div', { class: 'shop-prev', html: isStyle ? styleSvg(it, rid) : itemPreviewSvg(it) }),
      h('b', null, it.name), h('span', { class: 'muted small shop-desc' }, it.desc || (isStyle ? (it.kind === 'wall' ? 'For the walls.' : 'For the floor.') : '')),
      tags.length ? h('div', { class: 'mini-tags' }, ...tags) : null, extra,
      h('div', { class: 'row between shop-act' }, owned && !isStyle && !it.reward ? h('span', { class: 'faint small' }, `owned ×${owned}`) : h('span'), action));
  },
  async buy(it, rid, rerender, modal) {
    if (!(await confirmDialog(`Buy “${it.name}” for ${fmtNum(it.price)} credits?`, { okLabel: 'Buy' }))) return;
    const res = Room.buy(it.id, rid); if (res.error) { toast(res.error, { error: true }); return; }
    if (it.kind) { toast(`${it.name} — applied to the ${roomDef(rid).name}`); rerender(); return; }
    modal.close();
    RoomView.editing = true; RoomView.sel = res.placed ? res.uid : null; RoomView.room = rid;
    if (!location.hash.startsWith('#/achievements')) location.hash = '#/achievements'; else RoomView.refresh();
    toast(res.placed ? `${it.name} is in your ${roomDef(rid).name} — drag it where you like` : `${it.name} went to storage — make some room to place it`, { duration: 6000 });
    setTimeout(() => $('.room-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
  },
};
