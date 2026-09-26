/* ===== Study room: data, the room at the top of Achievements, and the shop ===== */
const STARTER = [ // fixed ids: two devices creating the starter kit end up with one kit
  { uid: 'starter-desk', item: 'desk', x: 3, y: 0 },
  { uid: 'starter-chair', item: 'chair', x: 3, y: 1 },
  { uid: 'starter-plant', item: 'plant_small', x: 0, y: 0 },
];
const Room = {
  owned() { return state.room.owned || []; },
  countOwned(id) { return this.owned().filter((o) => o.item === id).length; },
  styleOf(kind) { const st = roomStyle(state.room.style?.[kind]); return st && st.kind === kind ? st : roomStyle(kind === 'wall' ? 'wall_sand' : 'floor_oak'); },
  touch() { const now = iso(Date.now()); state.room.updated_at = now; dirty('settings', 'room'); return now; },
  ensureStarter() {
    if (this.owned().length || state.room.starter) return;
    if (Sync.enabled && !(Sync.pulled && Sync.lastFull)) return; // wait until the account's own room has been read
    this.touch();
    const old = '2000-01-01T00:00:00.000Z'; // the starter kit never wins over a real arrangement from another device
    state.room.owned = STARTER.map((s) => ({ uid: s.uid, item: s.item, price: 0, at: old }));
    state.room.placed = Object.fromEntries(STARTER.map((s) => [s.uid, { x: s.x, y: s.y, flip: false, at: old }]));
    state.room.style = { wall: 'wall_sand', floor: 'floor_oak', wall_at: old, floor_at: old }; state.room.starter = true;
    persist();
  },
  pl(uidv) { const p = state.room.placed?.[uidv]; return p && !p.stored ? p : null; },
  itemOf(o) { return roomItem(o.item); },
  dims(it, flip) { return flip ? [it.fp[1], it.fp[0]] : [it.fp[0], it.fp[1]]; },
  /* everything placed, with its geometry */
  placedList() {
    const out = [];
    for (const o of this.owned()) {
      const it = this.itemOf(o); const p = this.pl(o.uid); if (!it || !p) continue;
      if (it.wall) out.push({ o, it, p, wall: true, w: it.wall[0], hh: it.wall[1] });
      else { const [w, d] = this.dims(it, p.flip); out.push({ o, it, p, wall: false, x: p.x, y: p.y, w, d, flat: !!it.flat }); }
    }
    return out;
  },
  fitsFloor(uidv, it, x, y, flip) {
    const [w, d] = this.dims(it, flip); const N = ISO.N;
    if (x < 0 || y < 0 || x + w > N || y + d > N) return false;
    return !this.placedList().some((e) => !e.wall && e.o.uid !== uidv && e.flat === !!it.flat && x < e.x + e.w && e.x < x + w && y < e.y + e.d && e.y < y + d);
  },
  fitsWall(uidv, it, wall, u, z) {
    const [w, hh] = it.wall;
    if (u < 0 || u + w > ISO.N + 1e-6 || z > ISO.H - 0.08 || z - hh < 0.2) return false;
    return !this.placedList().some((e) => e.wall && e.o.uid !== uidv && e.p.wall === wall && u < e.p.u + e.w && e.p.u < u + w && z - hh < e.p.z && e.p.z - e.hh < z);
  },
  firstFree(uidv, it) {
    if (it.wall) {
      for (const z of [2.45, 2.85, 1.95, 1.5]) for (const wall of ['R', 'L']) for (let u = 0.5; u + it.wall[0] <= ISO.N; u += 0.5) if (this.fitsWall(uidv, it, wall, u, z)) return { wall, u, z };
      return null;
    }
    /* Furniture that belongs against a wall goes there, facing the room; the rest spreads out instead of piling up. */
    const N = ISO.N; const occ = new Set();
    for (const e of this.placedList()) if (!e.wall && !e.flat && e.o.uid !== uidv) for (let i = e.x; i < e.x + e.w; i++) for (let j = e.y; j < e.y + e.d; j++) occ.add(i + ',' + j);
    const crowd = (x, y, w, d) => { let n = 0; for (let i = x - 1; i <= x + w; i++) for (let j = y - 1; j <= y + d; j++) if ((i < x || i >= x + w || j < y || j >= y + d) && occ.has(i + ',' + j)) n++; return n; };
    const jitter = (x, y) => ((x * 7 + y * 13 + uidv.charCodeAt(0)) % 10) / 40;
    let best = null;
    for (const flip of [false, true]) {
      const [w, d] = this.dims(it, flip);
      for (let x = 0; x + w <= N; x++) for (let y = 0; y + d <= N; y++) {
        if (!this.fitsFloor(uidv, it, x, y, flip)) continue;
        const cx = x + w / 2, cy = y + d / 2; let score;
        if (it.flat) score = Math.hypot(cx - N / 2, cy - N / 2) + (flip ? 0.01 : 0);
        else if (it.hug) { const back = (!flip && y === 0) || (flip && x === 0); score = (back ? 0 : 50) + crowd(x, y, w, d) * 2 + Math.abs((flip ? y : x) + (flip ? d : w) / 2 - N / 2) * 0.3; }
        else if (it.edge) score = Math.min(x, y) * 3 + crowd(x, y, w, d) * 2 + jitter(x, y) + (flip ? 0.05 : 0);
        else score = crowd(x, y, w, d) * 3 + Math.abs(Math.hypot(cx - N / 2, cy - N / 2) - 2.3) + jitter(x, y) + (flip ? 0.05 : 0);
        if (!best || score < best.score) best = { x, y, flip, score };
      }
    }
    return best ? { x: best.x, y: best.y, flip: best.flip } : null;
  },
  buy(id) {
    const it = roomItem(id) || roomStyle(id); if (!it) return { error: 'Unknown item' };
    const cr = Credits.get();
    if ((it.lvl || 0) > cr.level) return { error: `Unlocks at level ${it.lvl}` };
    if (cr.balance < it.price) return { error: `You need ${fmtNum(it.price - cr.balance)} more credits` };
    const at = this.touch(); const o = { uid: uid().slice(0, 8), item: id, price: it.price, at };
    state.room.owned = [...this.owned(), o];
    if (it.kind) { state.room.style = { ...(state.room.style || {}), [it.kind]: id, [it.kind + '_at']: at }; commit('room'); return { uid: o.uid }; }
    const pos = this.firstFree(o.uid, it);
    state.room.placed = { ...(state.room.placed || {}), [o.uid]: pos ? { ...pos, at } : { stored: true, at } };
    commit('room');
    return { uid: o.uid, placed: !!pos };
  },
  applyStyle(id) { const st = roomStyle(id); if (!st) return; const at = this.touch(); state.room.style = { ...(state.room.style || {}), [st.kind]: id, [st.kind + '_at']: at }; commit('room'); },
  move(uidv, pos) { const at = this.touch(); state.room.placed = { ...(state.room.placed || {}), [uidv]: { ...pos, at } }; commit('room'); },
  store(uidv) { this.move(uidv, { stored: true }); },
  placeStored(uidv) {
    const o = this.owned().find((x) => x.uid === uidv); const it = o && this.itemOf(o); if (!it) return false;
    const pos = this.firstFree(uidv, it); if (!pos) return false;
    this.move(uidv, pos); return true;
  },
};

/* ---------- drawing the room ---------- */
function roomCtx() {
  const won = state.settings.achievements || {};
  return { now: new Date(nowMs()), achievements: Object.keys(won).length, rare: ACHIEVEMENTS.filter((a) => won[a.id] && a.tier >= 3).length };
}
function wallFlat(st, side) {
  const W = ISO.N * 100, H = ISO.H * 100; const base = side === 'R' ? st.a : st.b; let s = `<rect width="${W}" height="${H}" fill="${base}"/>`;
  const clipId = `rm-wc-${W}x${H}`; if (!document.getElementById(clipId)) { ensureRoomDefs(); const cp = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath'); cp.setAttribute('id', clipId); cp.innerHTML = `<rect width="${W}" height="${H}"/>`; $('#rm-defs defs').append(cp); }
  const rnd = mulberry(side === 'R' ? 3 : 4);
  if (st.pattern === 'stripes') for (let x = 0; x < W; x += 44) s += `<rect x="${x}" y="0" width="22" height="${H}" fill="${tone(base, -0.07)}"/>`;
  if (st.pattern === 'brick') { for (let r = 0; r * 18 < H; r++) { s += `<rect x="0" y="${r * 18 + 16}" width="${W}" height="2" fill="${tone(base, 0.28)}"/>`; for (let x = (r % 2) * 22; x < W; x += 44) s += `<rect x="${x}" y="${r * 18}" width="2" height="16" fill="${tone(base, 0.28)}"/><rect x="${x + 4}" y="${r * 18 + 2}" width="${16 + rnd() * 18}" height="3" fill="${tone(base, rnd() < 0.5 ? 0.08 : -0.08)}" opacity=".6"/>`; } }
  if (st.pattern === 'panel') { s += `<rect x="0" y="${H - 115}" width="${W}" height="115" fill="#8a5a36"/><rect x="0" y="${H - 121}" width="${W}" height="7" fill="#6e4428"/>`; for (let x = 10; x < W; x += 60) s += `<rect x="${x}" y="${H - 104}" width="48" height="84" rx="3" fill="none" stroke="#6e4428" stroke-width="3"/>`; }
  if (st.pattern === 'stars') for (let i = 0; i < 70; i++) { const x = rnd() * W, y = rnd() * (H - 30); s += i % 9 ? `<circle cx="${x}" cy="${y}" r="${0.8 + rnd() * 1.4}" fill="#fff" opacity="${0.4 + rnd() * 0.5}"/>` : `<path d="M${x},${y - 5} L${x + 1.4},${y - 1.4} L${x + 5},${y} L${x + 1.4},${y + 1.4} L${x},${y + 5} L${x - 1.4},${y + 1.4} L${x - 5},${y} L${x - 1.4},${y - 1.4} Z" fill="#ffe8a8"/>`; }
  s += `<rect x="0" y="0" width="${W}" height="6" fill="${tone(base, 0.18)}"/><rect x="0" y="${H - 17}" width="${W}" height="17" fill="${st.pattern === 'panel' ? '#5b3620' : tone(base, -0.38)}"/><rect x="0" y="${H - 18}" width="${W}" height="2" fill="${tone(base, 0.3)}" opacity=".7"/>`;
  return `<g clip-path="url(#${clipId})">${s}</g>`;
}
function floorSvg(st) {
  const N = ISO.N; let s = ''; const rnd = mulberry(21);
  if (st.pattern === 'checker') { for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) s += poly([[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]], (i + j) % 2 ? st.b : st.a, ` stroke="${tone(st.b, -0.2)}" stroke-width=".4"`); return s; }
  if (st.pattern === 'carpet') { s += poly([[0, 0], [N, 0], [N, N], [0, N]], st.a); for (let i = 0; i < 260; i++) { const x = rnd() * N, y = rnd() * N; s += `<circle cx="${f1(isoX(x, y))}" cy="${f1(isoY(x, y))}" r="${0.6 + rnd()}" fill="${tone(st.a, rnd() < 0.5 ? 0.1 : -0.1)}" opacity=".7"/>`; } return s; }
  if (st.pattern === 'tatami') { for (let j = 0; j < N; j++) for (let i = (j % 2); i < N + 1; i += 2) { const x0 = Math.max(0, i - (j % 2 ? 1 : 0)), x1 = Math.min(N, i + 2 - (j % 2 ? 1 : 0)); if (x1 <= x0) continue; s += poly([[x0, j], [x1, j], [x1, j + 1], [x0, j + 1]], j % 2 ? st.a : st.b, ' stroke="#4a3f22" stroke-width="1.6"'); } return s; }
  if (st.pattern === 'marble') { for (let i = 0; i < N; i += 2) for (let j = 0; j < N; j += 2) { s += poly([[i, j], [i + 2, j], [i + 2, j + 2], [i, j + 2]], ((i + j) / 2) % 2 ? st.b : st.a, ' stroke="#c9c5bd" stroke-width=".8"'); const x = i + rnd() * 2, y = j + rnd() * 2; s += `<path d="M${P(x, j + 0.1)} Q${P(i + 1, j + 1)} ${P(i + 1.9, y)}" stroke="#b9b5ae" stroke-width=".7" fill="none" opacity=".7"/>`; } return s; }
  // planks, staggered
  for (let r = 0; r < N * 2; r++) { const y0 = r / 2, y1 = y0 + 0.5; let x = r % 2 ? -1 : 0; while (x < N) { const a = Math.max(0, x), b = Math.min(N, x + 2); const c = rnd() < 0.5 ? st.a : st.b; s += poly([[a, y0], [b, y0], [b, y1], [a, y1]], tone(c, (rnd() - 0.5) * 0.08), ` stroke="${tone(st.b, -0.28)}" stroke-width=".6"`); x += 2; } }
  return s;
}
/* painter's order for things standing on the floor: b goes after a when it is in front */
function sortSolids(list) {
  const n = list.length; const indeg = new Array(n).fill(0); const adj = list.map(() => []);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (i === j) continue; const a = list[i], b = list[j];
    const behindX = a.x + a.w <= b.x && !(b.y + b.d <= a.y), behindY = a.y + a.d <= b.y && !(b.x + b.w <= a.x);
    if (behindX || behindY) { adj[i].push(j); indeg[j]++; }
  }
  const out = []; const q = list.map((_, i) => i).filter((i) => !indeg[i]).sort((i, j) => (list[i].x + list[i].y) - (list[j].x + list[j].y));
  while (q.length) { const i = q.shift(); out.push(list[i]); for (const j of adj[i]) if (!--indeg[j]) q.push(j); }
  if (out.length < n) list.forEach((e) => { if (!out.includes(e)) out.push(e); }); // never lose an item
  return out;
}
function drawPlaced(e, ctx) {
  const inner = e.it.draw(ctx);
  if (e.wall) {
    const [w, hh] = [e.w, e.hh];
    const m = e.p.wall === 'L'
      ? `matrix(${ISO.TW / 200},${-ISO.TH / 200},0,${ISO.ZH / 100},${f1(isoX(0, e.p.u + w))},${f1(isoY(0, e.p.u + w, e.p.z))})`
      : `matrix(${ISO.TW / 200},${ISO.TH / 200},0,${ISO.ZH / 100},${f1(isoX(e.p.u, 0))},${f1(isoY(e.p.u, 0, e.p.z))})`;
    return `<g class="rm-item wall" data-uid="${e.o.uid}"><g transform="${m}"><rect x="-4" y="-4" width="${w * 100 + 8}" height="${hh * 100 + 8}" fill="transparent"/>${inner}</g></g>`;
  }
  // flipped items are mirrored around the footprint's back corner, which swaps the footprint (w,d)
  const tr = `translate(${f1(isoX(e.x, e.y))},${f1(isoY(e.x, e.y))})${e.p.flip ? ' scale(-1,1)' : ''}`;
  return `<g class="rm-item${e.it.pet ? ' pet' : ''}" data-uid="${e.o.uid}" transform="${tr}">${inner}</g>`;
}
function footprintPoly(x, y, w, d, cls) { return `<polygon class="${cls}" points="${[[x, y], [x + w, y], [x + w, y + d], [x, y + d]].map(([a, b]) => P(a, b)).join(' ')}"/>`; }
function wallFootprint(wall, u, z, w, hh, cls) {
  const pts = wall === 'L' ? [[0, u, z], [0, u + w, z], [0, u + w, z - hh], [0, u, z - hh]] : [[u, 0, z], [u + w, 0, z], [u + w, 0, z - hh], [u, 0, z - hh]];
  return `<polygon class="${cls}" points="${pts.map(([a, b, c]) => P(a, b, c)).join(' ')}"/>`;
}
function glowFor(e, night) {
  if (!e.it.glow) return '';
  const g = e.it.glow === 'window' ? [[e.w / 2, 0, -e.hh / 2, 1.6, '#cfe8ff']] : e.it.glow; let s = '';
  for (const [lx, ly, lz, r, c] of g) {
    let x, y, z;
    if (e.wall) { const along = e.w / 2; z = e.p.z - e.hh / 2; if (e.p.wall === 'L') { x = 0.15; y = e.p.u + along; } else { x = e.p.u + along; y = 0.15; } }
    else { const [ax, ay] = e.p.flip ? [ly, lx] : [lx, ly]; x = e.x + ax; y = e.y + ay; z = lz; }
    const op = e.it.glow === 'window' ? 0.16 * (1 - night) : 0.08 + 0.46 * night;
    if (op < 0.02) continue;
    s += `<ellipse cx="${f1(isoX(x, y))}" cy="${f1(isoY(x, y, z))}" rx="${f1(r * 46)}" ry="${f1(r * 30)}" fill="${c}" opacity="${op.toFixed(2)}" filter="url(#rm-blur)" style="mix-blend-mode:screen"/>`;
  }
  return s;
}
function roomSvg({ editing = false, sel = null } = {}) {
  ensureRoomDefs();
  const N = ISO.N, H = ISO.H, t = 0.14, slab = 0.24; const ctx = roomCtx();
  const ws = Room.styleOf('wall'), fs = Room.styleOf('floor');
  const list = Room.placedList(); const walls = list.filter((e) => e.wall), flats = list.filter((e) => !e.wall && e.flat), solids = sortSolids(list.filter((e) => !e.wall && !e.flat));
  const night = roomNight(ctx.now); const sky = skyAt(ctx.now);
  let s = '';
  // shell: outer wall caps, walls, floor slab
  s += poly([[-t, N, 0], [N, N, 0], [N, N, -slab], [-t, N, -slab]], '#4a3a2e') + poly([[N, -t, 0], [N, N, 0], [N, N, -slab], [N, -t, -slab]], '#3a2d24');
  s += `<g transform="matrix(${ISO.TW / 200},${-ISO.TH / 200},0,${ISO.ZH / 100},${f1(isoX(0, N))},${f1(isoY(0, N, H))})">${wallFlat(ws, 'L')}</g>`;
  s += `<g transform="matrix(${ISO.TW / 200},${ISO.TH / 200},0,${ISO.ZH / 100},${f1(isoX(0, 0))},${f1(isoY(0, 0, H))})">${wallFlat(ws, 'R')}</g>`;
  s += poly([[-t, -t, H], [0, 0, H], [0, N, H], [-t, N, H]], tone(ws.b, 0.35)) + poly([[-t, -t, H], [N, -t, H], [N, 0, H], [0, 0, H]], tone(ws.a, 0.35));
  s += poly([[-t, N, 0], [0, N, 0], [0, N, H], [-t, N, H]], tone(ws.b, -0.12)) + poly([[N, -t, 0], [N, 0, 0], [N, 0, H], [N, -t, H]], tone(ws.a, -0.3));
  s += `<g class="rm-walls">${walls.map((e) => drawPlaced(e, ctx)).join('')}</g>`;
  s += `<g class="rm-floor">${floorSvg(fs)}</g>`;
  if (editing) { let g = ''; for (let i = 0; i <= N; i++) g += `<path d="M${P(i, 0)} L${P(i, N)} M${P(0, i)} L${P(N, i)}"/>`; s += `<g class="rm-grid">${g}</g>`; }
  s += `<g class="rm-flats">${flats.map((e) => drawPlaced(e, ctx)).join('')}</g>`;
  if (editing && sel) { const e = list.find((x) => x.o.uid === sel); if (e) s += e.wall ? wallFootprint(e.p.wall, e.p.u, e.p.z, e.w, e.hh, 'rm-sel') : footprintPoly(e.x, e.y, e.w, e.d, 'rm-sel'); }
  s += '<g class="rm-ghost-layer"></g>';
  s += `<g class="rm-solids">${solids.map((e) => drawPlaced(e, ctx)).join('')}</g>`;
  // light of the hour: darker at night, warm at dusk, and every lamp glows
  const hull = [[-t, N, H], [-t, -t, H], [N, -t, H], [N, -t, -slab], [N, N, -slab], [-t, N, -slab]].map(([a, b, c]) => P(a, b, c)).join(' ');
  if (night > 0.02) s += `<polygon points="${hull}" fill="#0b1433" opacity="${(0.4 * night).toFixed(2)}" pointer-events="none"/>`;
  if (sky.key === 'dusk' && night < 0.95) s += `<polygon points="${hull}" fill="#ff9a4a" opacity="${(0.08 * (1 - night)).toFixed(2)}" pointer-events="none"/>`;
  s += `<g class="rm-glows" pointer-events="none">${list.map((e) => glowFor(e, night)).join('')}</g>`;
  return `<svg class="room-svg" viewBox="-272 -130 544 414" role="img" aria-label="Your study room">${s}</svg>`;
}
/* shop previews */
function itemPreviewSvg(it) {
  ensureRoomDefs(); const ctx = roomCtx();
  if (it.wall) { const [w, hh] = it.wall; return `<svg viewBox="${-22} ${-14} ${w * 100 + 44} ${hh * 100 + 28}" class="prev-svg"><rect x="-22" y="-14" width="${w * 100 + 44}" height="${hh * 100 + 28}" fill="#d9c7a4" rx="6"/>${it.draw(ctx)}</svg>`; }
  const [w, d] = it.fp; const hgt = it.hgt || 1.2;
  const x0 = isoX(0, d) - 14, x1 = isoX(w, 0) + 14, y0 = isoY(0, 0, hgt) - 12, y1 = isoY(w, d) + 10;
  return `<svg viewBox="${f1(x0)} ${f1(y0)} ${f1(x1 - x0)} ${f1(y1 - y0)}" class="prev-svg">${poly([[0, 0], [w, 0], [w, d], [0, d]], '#3a3632', ' stroke="#55504a" stroke-width="1"')}${it.draw(ctx)}</svg>`;
}
function styleSvg(st) {
  ensureRoomDefs(); const n = 3, H = 1.7;
  const ws = st.kind === 'wall' ? st : Room.styleOf('wall'), fs = st.kind === 'floor' ? st : Room.styleOf('floor');
  const saveN = ISO.N, saveH = ISO.H; ISO.N = n; ISO.H = H;
  const svg = `<g transform="matrix(${ISO.TW / 200},${-ISO.TH / 200},0,${ISO.ZH / 100},${f1(isoX(0, n))},${f1(isoY(0, n, H))})">${wallFlat(ws, 'L')}</g><g transform="matrix(${ISO.TW / 200},${ISO.TH / 200},0,${ISO.ZH / 100},${f1(isoX(0, 0))},${f1(isoY(0, 0, H))})">${wallFlat(ws, 'R')}</g>${floorSvg(fs)}`;
  ISO.N = saveN; ISO.H = saveH;
  return `<svg viewBox="${f1(isoX(0, n)) - 6} ${f1(isoY(0, 0, H)) - 6} ${f1(isoX(n, 0) - isoX(0, n)) + 12} ${f1(isoY(n, n) - isoY(0, 0, H)) + 12}" class="prev-svg">${svg}</svg>`;
}

/* ---------- the room card (top of the Achievements screen) ---------- */
const RoomView = {
  editing: false, sel: null, drag: null, root: null, stage: null, keyOff: null, timer: null,
  busy() { return !!this.drag; },
  visualKey() { const d = new Date(nowMs()); const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; return `${todayKey()}|${skyAt(d).key}|${Math.round(roomNight(d) * 8)}${still ? '|' + d.getHours() + ':' + d.getMinutes() : ''}`; },
  unmount() { this.stopKeys(); this.editing = false; this.sel = null; this.drag = null; this.root = null; },
  card() {
    Room.ensureStarter();
    const cr = Credits.get();
    const breakdown = `Earned ${fmtNum(cr.earned)} · studying ${fmtNum(cr.parts.time)} · achievements ${fmtNum(cr.parts.achievements)} · closed days ${fmtNum(cr.parts.closing)} · meditation weeks ${fmtNum(cr.parts.meditation)} · spent ${fmtNum(cr.spent)}`;
    const head = h('div', { class: 'room-head' },
      h('div', { class: 'room-title' }, h('h2', null, 'Your study room'),
        h('div', { class: 'lvl', title: `${fmtNum(cr.xp)} XP — every credit you earn counts, even after you spend it` }, h('span', { class: 'lvl-badge' }, `Lv ${cr.level}`), h('span', { class: 'lvl-name' }, cr.title),
          h('span', { class: 'lvl-bar' }, h('i', { style: { width: Math.round(cr.levelPct * 100) + '%' } })), h('span', { class: 'faint small num' }, `${fmtNum(cr.xp)} / ${fmtNum(cr.levelTo)}`))),
      h('div', { class: 'row' },
        h('span', { class: 'credit-balance', title: breakdown }, coinIcon('lg'), h('b', { class: 'num' }, fmtNum(cr.balance)), h('span', { class: 'muted small' }, 'credits')),
        h('button', { class: 'btn sm' + (this.editing ? ' primary' : ''), onClick: () => this.toggleEdit() }, icon(this.editing ? 'check-outline' : 'edit'), this.editing ? 'Done' : 'Decorate'),
        h('button', { class: 'btn sm shop-btn', onClick: () => Shop.open() }, coinIcon(), 'Shop')));
    this.stage = h('div', { class: 'room-stage' + (this.editing ? ' editing' : '') });
    this.paint();
    const foot = this.editing ? this.editBar()
      : h('p', { class: 'room-hint muted small' }, `${CREDITS_PER_HOUR} credits per hour of study · +${CLOSE_DAY_CREDITS} for each day you close · +10 to +200 per achievement · +${MED_DAY_CREDITS} for each day you meditate. Tap an animal to say hello.`);
    this.root = h('section', { class: 'card room-card' }, head, this.stage, foot);
    if (this.editing) this.startKeys(); else this.stopKeys();
    // redraw only when the light, the sky or the date changes (clock hands move by themselves)
    this.vkey = this.visualKey();
    if (!this.timer) this.timer = setInterval(() => {
      if (!this.stage || !this.stage.isConnected) { clearInterval(this.timer); this.timer = null; return; }
      const k = this.visualKey(); if (k !== this.vkey && !this.drag && !document.hidden) { this.vkey = k; this.paint(); }
    }, 60000);
    return this.root;
  },
  paint() { if (!this.stage) return; this.stage.innerHTML = roomSvg({ editing: this.editing, sel: this.sel }); this.bind(); },
  refresh() { const old = this.root; if (old && old.isConnected) old.replaceWith(this.card()); },
  toggleEdit() { this.editing = !this.editing; if (!this.editing) this.sel = null; this.refresh(); },
  editBar() {
    const stored = Room.owned().filter((o) => !Room.pl(o.uid) && roomItem(o.item));
    const selO = this.sel && Room.owned().find((o) => o.uid === this.sel); const selIt = selO && roomItem(selO.item);
    const tools = selIt ? h('div', { class: 'room-tools' }, h('b', null, selIt.name),
      !selIt.wall ? h('button', { class: 'btn sm', title: 'Mirror it (F)', onClick: () => this.flip() }, '⇋ Flip') : null,
      selIt.wall ? h('button', { class: 'btn sm', title: 'Move to the other wall', onClick: () => this.otherWall() }, '⇄ Other wall') : null,
      h('button', { class: 'btn sm', title: 'Put it away (Delete)', onClick: () => { const u = this.sel; this.sel = null; Room.store(u); } }, 'Store'),
      h('button', { class: 'btn sm ghost', onClick: () => { this.sel = null; this.refresh(); } }, 'Deselect'))
      : h('p', { class: 'muted small' }, 'Drag things to move them — walls take pictures, windows and shelves. Tap one for more options; arrow keys nudge it.');
    return h('div', { class: 'room-edit' }, tools,
      stored.length ? h('div', { class: 'room-store' }, h('span', { class: 'muted small' }, 'In storage:'), ...stored.map((o) => h('button', { class: 'store-chip', title: 'Place it in the room', onClick: () => { this.sel = o.uid; if (!Room.placeStored(o.uid)) { this.sel = null; toast('No free spot — move or store something first', { error: true }); } } },
        h('span', { class: 'store-prev', html: itemPreviewSvg(roomItem(o.item)) }), roomItem(o.item).name))) : null);
  },
  flip() {
    const e = Room.placedList().find((x) => x.o.uid === this.sel); if (!e || e.wall) return;
    if (Room.fitsFloor(e.o.uid, e.it, e.x, e.y, !e.p.flip)) Room.move(e.o.uid, { x: e.x, y: e.y, flip: !e.p.flip });
    else toast('No room to turn it here — move it first', { error: true });
  },
  otherWall() {
    const e = Room.placedList().find((x) => x.o.uid === this.sel); if (!e || !e.wall) return;
    const wall = e.p.wall === 'L' ? 'R' : 'L';
    for (let u = e.p.u, n = 0; n < 16; n++, u = (u + 0.5) % (ISO.N - e.w + 0.5)) if (Room.fitsWall(e.o.uid, e.it, wall, u, e.p.z)) { Room.move(e.o.uid, { wall, u, z: e.p.z }); return; }
    toast('The other wall is full at that height', { error: true });
  },
  nudge(dx, dy) {
    const e = Room.placedList().find((x) => x.o.uid === this.sel); if (!e) return;
    if (e.wall) { const u = e.p.u + dx * 0.5, z = e.p.z - dy * 0.25; if (Room.fitsWall(e.o.uid, e.it, e.p.wall, u, z)) Room.move(e.o.uid, { wall: e.p.wall, u, z }); return; }
    if (Room.fitsFloor(e.o.uid, e.it, e.x + dx, e.y + dy, e.p.flip)) Room.move(e.o.uid, { x: e.x + dx, y: e.y + dy, flip: e.p.flip });
  },
  startKeys() {
    if (this.keyOff) return;
    const onKey = (e) => {
      if (!this.editing || !this.sel || modalStack.length) return;
      const tag = document.activeElement?.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA') return;
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
    const svg = $('svg', this.stage); if (!svg) return;
    svg.addEventListener('pointerdown', (e) => {
      const g = e.target.closest('.rm-item');
      if (!this.editing) { if (g && g.classList.contains('pet')) this.hello(svg, g); return; }
      if (!g) { if (this.sel) { this.sel = null; this.refresh(); } return; }
      const uidv = g.dataset.uid; const ent = Room.placedList().find((x) => x.o.uid === uidv); if (!ent) return;
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
        pos = { wall, u, z: zt }; ok = Room.fitsWall(d.uid, it, wall, u, zt); ghost = wallFootprint(wall, u, zt, w, hh, ok ? 'rm-ghost' : 'rm-ghost bad');
        const m = wall === 'L' ? `matrix(${ISO.TW / 200},${-ISO.TH / 200},0,${ISO.ZH / 100},${f1(isoX(0, u + w))},${f1(isoY(0, u + w, zt))})` : `matrix(${ISO.TW / 200},${ISO.TH / 200},0,${ISO.ZH / 100},${f1(isoX(u, 0))},${f1(isoY(u, 0, zt))})`;
        d.g.firstElementChild.setAttribute('transform', m);
      } else {
        const fx = (p.x / (ISO.TW / 2) + p.y / (ISO.TH / 2)) / 2, fy = (p.y / (ISO.TH / 2) - p.x / (ISO.TW / 2)) / 2;
        const [w, dd] = Room.dims(it, d.ent.p.flip);
        const x = clamp(Math.round(fx - d.off[0]), 0, ISO.N - w), y = clamp(Math.round(fy - d.off[1]), 0, ISO.N - dd);
        pos = { x, y, flip: !!d.ent.p.flip }; ok = Room.fitsFloor(d.uid, it, x, y, d.ent.p.flip); ghost = footprintPoly(x, y, w, dd, ok ? 'rm-ghost' : 'rm-ghost bad');
        d.g.setAttribute('transform', `translate(${f1(isoX(x, y))},${f1(isoY(x, y))})${d.ent.p.flip ? ' scale(-1,1)' : ''}`);
        const top = $('.rm-solids', svg); if (top && d.g.parentNode === top) top.append(d.g); // stay on top while dragging
      }
      d.pos = pos; d.ok = ok; const layer = $('.rm-ghost-layer', svg); if (layer) layer.innerHTML = ghost;
    });
    const end = (e, cancel) => {
      const d = this.drag; if (!d || (e && e.pointerId !== d.pointerId)) return;
      this.drag = null; this.stage.classList.remove('dragging');
      if (!cancel && d.moved && d.ok && d.pos) { Room.move(d.uid, d.pos); return; } // the page redraws itself
      if (d.moved && !d.ok) toast('Something is already there', { error: true });
      this.refresh();
    };
    svg.addEventListener('pointerup', (e) => end(e, false));
    svg.addEventListener('pointercancel', (e) => end(e, true));
  },
  /* tap an animal: a little heart */
  hello(svg, g) {
    const bb = g.getBBox(); const ctm = g.getCTM(); const svgCtm = svg.getCTM();
    const pt = svg.createSVGPoint(); pt.x = bb.x + bb.width / 2; pt.y = bb.y; const p = pt.matrixTransform(svgCtm.inverse().multiply(ctm));
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    el.setAttribute('x', f1(p.x)); el.setAttribute('y', f1(p.y)); el.setAttribute('class', 'rm-heart'); el.setAttribute('text-anchor', 'middle'); el.textContent = '♥';
    svg.append(el); setTimeout(() => el.remove(), 1300);
  },
};

/* ---------- the shop ---------- */
const Shop = {
  cat: 'furniture',
  open(cat) {
    if (cat) this.cat = cat;
    const body = h('div', { class: 'shop' });
    const m = openModal({ title: 'Shop', cls: 'shop-modal', body });
    const render = () => {
      const cr = Credits.get();
      const list = this.cat === 'styles' ? ROOM_STYLES : ROOM_ITEMS.filter((i) => i.cat === this.cat && i.price > 0);
      setKids(body,
        h('div', { class: 'shop-top' }, h('span', { class: 'credit-balance' }, coinIcon('lg'), h('b', { class: 'num' }, fmtNum(cr.balance)), h('span', { class: 'muted small' }, 'credits')),
          h('span', { class: 'muted small' }, `Level ${cr.level} · ${cr.title} — some things unlock as you level up`)),
        h('div', { class: 'shop-tabs' }, ...ROOM_CATS.map(([id, label]) => h('button', { class: 'chip' + (id === this.cat ? ' on' : ''), style: { '--c': '#e8b93c', '--ink': '#1d1606' }, onClick: () => { this.cat = id; render(); } }, label))),
        h('div', { class: 'shop-grid' }, ...list.map((it) => this.cardFor(it, cr, render, m))));
    };
    render();
  },
  cardFor(it, cr, rerender, modal) {
    const isStyle = !!it.kind; const owned = Room.countOwned(it.id); const locked = (it.lvl || 0) > cr.level; const afford = cr.balance >= it.price;
    const applied = isStyle && Room.styleOf(it.kind).id === it.id;
    let action;
    if (isStyle && (owned || it.price === 0)) action = applied ? h('span', { class: 'tag ok' }, 'in use') : h('button', { class: 'btn sm', onClick: () => { Room.applyStyle(it.id); rerender(); } }, 'Use');
    else if (locked) action = h('span', { class: 'shop-lock small' }, `🔒 level ${it.lvl}`);
    else action = h('button', { class: 'btn sm' + (afford ? ' primary' : ''), disabled: !afford, title: afford ? '' : `${fmtNum(it.price - cr.balance)} more credits needed`, onClick: () => this.buy(it, rerender, modal) }, coinIcon(), fmtNum(it.price));
    return h('div', { class: 'shop-card' + (locked ? ' locked' : '') + (applied ? ' applied' : '') },
      h('div', { class: 'shop-prev', html: isStyle ? styleSvg(it) : itemPreviewSvg(it) }),
      h('b', null, it.name), h('span', { class: 'muted small shop-desc' }, it.desc || (isStyle ? (it.kind === 'wall' ? 'For the walls.' : 'For the floor.') : '')),
      h('div', { class: 'row between shop-act' }, owned && !isStyle ? h('span', { class: 'faint small' }, `owned ×${owned}`) : h('span'), action));
  },
  async buy(it, rerender, modal) {
    if (!(await confirmDialog(`Buy “${it.name}” for ${fmtNum(it.price)} credits?`, { okLabel: 'Buy' }))) return;
    const res = Room.buy(it.id); if (res.error) { toast(res.error, { error: true }); return; }
    if (it.kind) { toast(`${it.name} — applied`); rerender(); return; }
    modal.close();
    RoomView.editing = true; RoomView.sel = res.placed ? res.uid : null;
    if (!location.hash.startsWith('#/achievements')) location.hash = '#/achievements'; else RoomView.refresh();
    toast(res.placed ? `${it.name} is in your room — drag it where you like` : `${it.name} went to storage — make some room to place it`, { duration: 6000 });
    setTimeout(() => $('.room-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
  },
};
