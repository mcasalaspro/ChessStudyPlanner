/* ===== Study room art made with Canva: raster sprites drawn in place of the old vector drawings =====
   ROOM_ART (30-room-art-data.js) says where each picture sits in the item's own drawing units, so the
   footprints, walls, light and draw order of the room stay exactly as they were. A few live details stay in
   code on top of the art — clock hands, today's date, neon words, your level and the sky behind the glass.
   Anything without a Canva picture yet keeps its old drawing. */
const ART_BASE = 'assets/room/';
const artUrl = (f) => `${ART_BASE}${f}.png?v=${ROOM_ART.v}`;
const artImg = (f, x, y, w, h, extra = '') => `<image href="${artUrl(f)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none"${extra}/>`;
const artObj = (e) => ({ x: e[6], y: e[7], w: e[8], h: e[9], cx: e[6] + e[8] / 2, cy: e[7] + e[9] / 2 });

/* ---------- walls and floors: Canva textures, tiled as SVG patterns (tex: [file, tileW, tileH, left-wall shade, band?]) ---------- */
const texUrl = (f) => `${ART_BASE}${f}.jpg?v=${ROOM_ART.v}`;
const texPattern = (key, f, w, h) => patDef('tex-' + key, w, h, `<image href="${texUrl(f)}" width="${w}" height="${h}" preserveAspectRatio="none"/>`);
function artWallTex(st, side, W, H) {
  const t = ROOM_ART.tex && ROOM_ART.tex[st.id]; if (!t) return '';
  const [f, tw, th, shade, band] = t;
  let s;
  if (tw) s = `<rect width="${W}" height="${H}" fill="url(#${texPattern(st.id, f, tw, th)})"/>`;
  else { // a mural (tileW 0): one picture over the whole wall, mirrored on the left wall when th is 1 so both walls meet at the corner
    const img = `<image href="${texUrl(f)}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`;
    s = side === 'L' && th ? `<g transform="matrix(-1,0,0,1,${W},0)">${img}</g>` : img;
  }
  if (band) { // wood panelling along the bottom, with its rail
    const [bf, bw, bh, noRail] = band; const c = st.c || '#6e4428';
    s += `<g transform="translate(0,${H - bh})"><rect width="${W}" height="${bh}" fill="url(#${texPattern(st.id + '-w', bf, bw, bh)})"/></g><rect x="0" y="${H - bh - 6}" width="${W}" height="7" fill="${tone(c, 0.12)}"/><rect x="0" y="${H - bh + 1}" width="${W}" height="2" fill="${tone(c, -0.25)}"/>`;
    if (st.rail !== false && !noRail) s +=`<rect x="0" y="34" width="${W}" height="4" fill="${tone(st.a, -0.25)}" opacity=".7"/>`;
  }
  if (side === 'L' && shade) s += `<rect width="${W}" height="${H}" fill="#000" opacity="${shade}"/>`;
  return s;
}
function artFloorTex(st) {
  const t = ROOM_ART.tex && ROOM_ART.tex[st.id]; if (!t) return '';
  return floorRect(texPattern(st.id, t[0], t[1], t[2]));
}

/* live layers: `under` is drawn before the picture (seen through transparent glass), `over` after it */
/* the sky behind a window's cleared glass: where the glass is (ROOM_ART.glass, found when the art is built), clipped
   to it so nothing of the sky (a passing cloud) shows on the wall around the window */
function artSky(e, o, rect) {
  const g = ROOM_ART.glass && ROOM_ART.glass[e[0]];
  const [x, y, w, h] = (g || rect(artObj(e))).map(f1);
  if (!g) { const cid = roomDefOnce(`rm-gl-${e[0]}`, `<clipPath><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath>`); return `<g clip-path="url(#${cid})">${skyView(x, y, w, h, o)}</g>`; }
  // the exact shape of the glass (a white picture made with the art): the sky shows only there
  const mid = roomDefOnce(`rm-gm-${e[0]}`, `<mask maskUnits="userSpaceOnUse" x="${e[1]}" y="${e[2]}" width="${e[3]}" height="${e[4]}">${artImg(e[0] + '_glass', e[1], e[2], e[3], e[4])}</mask>`);
  return `<g mask="url(#${mid})">${skyView(x, y, w, h, o)}</g>`;
}
const ART_LIVE = {
  window: { under: (o, e) => artSky(e, o, (b) => [b.x + b.w * 0.08, b.y + b.h * 0.06, b.w * 0.84, b.h * 0.8]) },
  wallclock: { over: (o, e) => { const b = artObj(e); const r = Math.min(b.w, b.h) / 2; return clockHands(f1(b.cx), f1(b.cy), f1(r * 0.42), f1(r * 0.6), f1(r * 0.075), f1(r * 0.05), '#2b2118', o) + `<circle cx="${f1(b.cx)}" cy="${f1(b.cy)}" r="${f1(r * 0.06)}" fill="#2b2118"/>`; } },
};

/* ---------- effects animated by code over the art: fire, smoke, water, glow, petals ----------
   The anchors are found on each picture when the art is built (ROOM_ART.fx). CSS animations (rm-flicker, rm-rise,
   rm-ripple, rm-twinkle, rm-fall…) do the moving, so they stop with prefers-reduced-motion. `lit` effects only show
   while the light is on. Their strength is set with fill-/stroke-opacity: the animations drive `opacity`, which would
   replace an opacity attribute. */
const _tear = (x, y, w, h) => `M${f1(x)},${f1(y - h)} C${f1(x + w)},${f1(y - h * 0.42)} ${f1(x + w * 0.62)},${f1(y)} ${f1(x)},${f1(y)} C${f1(x - w * 0.62)},${f1(y)} ${f1(x - w)},${f1(y - h * 0.42)} ${f1(x)},${f1(y - h)} Z`;
const _dl = (i, per) => `animation-delay:-${(((i * 0.618) % 1) * per).toFixed(2)}s`;
const ART_FX = {
  flame: { lit: true, draw: (x, y, w, h, i) => { const fw = Math.max(w * 0.55, 1.1), fh = Math.max(h, 3);
    return `<g class="rm-flicker" style="${_dl(i, 0.9)}"><ellipse cx="${x}" cy="${f1(y - fh * 0.5)}" rx="${f1(fw * 4.2)}" ry="${f1(fh * 1.35)}" fill="#ffbe55" opacity=".3" filter="url(#rm-soft)"/><path d="${_tear(x, y, fw, fh)}" fill="#fff1b8" opacity=".8"/></g>`; } },
  fire: { lit: true, draw: (x, y, w, h, i) => `<ellipse class="rm-glowflick" cx="${x}" cy="${f1(y - h * 0.45)}" rx="${f1(w * 0.9)}" ry="${f1(h * 0.75)}" fill="#ff9d3c" fill-opacity=".35" filter="url(#rm-soft)"/>`
    + [-0.22, 0, 0.22].map((dx, k) => `<path class="rm-flicker" style="${_dl(i * 3 + k, 0.9)}" d="${_tear(x + dx * w, y - h * 0.08, w * 0.16, h * (k === 1 ? 0.8 : 0.55))}" fill="#ffe28a" fill-opacity=".55"/>`).join('') },
  steam: { draw: (x, y, w, h, i) => [0, 1, 2].map((k) => `<circle class="rm-rise" style="${_dl(i * 3 + k, 3)}" cx="${f1(x + (k - 1) * 1.8)}" cy="${f1(y)}" r="${f1(2.2 + k * 0.7)}" fill="#fff" fill-opacity=".5" filter="url(#rm-soft)"/>`).join('') },
  bubbles: { draw: (x, y, w, h, i) => Array.from({ length: 5 }, (_, k) => `<circle class="rm-rise" style="${_dl(i * 5 + k, 3)}" cx="${f1(x - w / 2 + (((k * 0.37) + 0.1) % 1) * w)}" cy="${f1(y)}" r="${f1(0.9 + (k % 3) * 0.4)}" fill="none" stroke="#effcff" stroke-width=".55" stroke-opacity=".9"/>`).join('') },
  ripple: { draw: (x, y, w, h, i) => [0, 1].map((k) => `<ellipse class="rm-ripple" style="${_dl(i * 2 + k, 1.6)}" cx="${x}" cy="${y}" rx="${f1(w / 2)}" ry="${f1(h / 2)}" fill="none" stroke="#effcff" stroke-width=".7" stroke-opacity=".8"/>`).join('') },
  glow: { lit: true, draw: (x, y, w, h, i) => `<ellipse class="rm-glowflick" style="${_dl(i, 1.4)}" cx="${x}" cy="${y}" rx="${f1(w)}" ry="${f1(h)}" fill="#ffdca8" fill-opacity=".3" filter="url(#rm-soft)"/>` },
  twinkle: { lit: true, draw: (x, y, w, h, i) => `<g class="rm-twinkle" style="${_dl(i, 2.2)}"><circle cx="${x}" cy="${y}" r="2.6" fill="#ffe7a0" opacity=".35" filter="url(#rm-soft)"/><circle cx="${x}" cy="${y}" r=".9" fill="#fffbe6"/></g>` },
  neon: { lit: true, draw: (x, y, w, h, i, c = '#ff5fa2') => `<ellipse class="rm-neon" cx="${x}" cy="${y}" rx="${f1(w / 2)}" ry="${f1(h / 2)}" fill="${c}" fill-opacity=".2" filter="url(#rm-blur)"/>` },
  petals: { draw: (x, y, w, h, i) => Array.from({ length: 3 }, (_, k) => `<ellipse class="rm-fall" style="${_dl(i * 3 + k, 6.4)}" cx="${f1(x - w / 2 + (((k * 0.41) + 0.2) % 1) * w)}" cy="${f1(y)}" rx="1.3" ry=".8" fill="#f7b9cb"/>`).join('') },
};
function artFx(it, o) {
  const L = ROOM_ART.fx && ROOM_ART.fx[it.id]; if (!L) return '';
  const on = lit(o);
  return L.map(([t, x, y, w, h, c], i) => { const d = ART_FX[t]; return d && (!d.lit || on) ? d.draw(x, y, w, h, i, c, o) : ''; }).join('');
}

/* every window shows the live sky behind its cleared glass; the dawn window is always at sunrise */
for (const id of ['window_round', 'window_arch', 'window_tall']) ART_LIVE[id] = ART_LIVE.window;
ART_LIVE.rw_dawnwindow = { under: (o, e) => { const d = new Date(o.now || Date.now()); d.setHours(6, 30, 0, 0); return artSky(e, { ...o, now: d }, (b) => [b.x + b.w * 0.06, b.y + b.h * 0.06, b.w * 0.88, b.h * 0.86]); } };

/* the word of a neon sign, glowing on the Canva acrylic board (the words stay live text) */
function artNeonWord(text, c, inner, o, size, b) {
  const on = lit(o); const tube = on ? c : '#8d8a90', core = on ? inner : '#b3b0b6';
  const t = (st, sw) => `<text x="${f1(b.cx)}" y="${f1(b.cy + size * 0.36)}" font-size="${size}" text-anchor="middle" fill="none" stroke="${st}" stroke-width="${sw}" font-family="system-ui, sans-serif" font-weight="800" letter-spacing="${f1(size * 0.17)}"${on && sw > 2 ? ' filter="url(#rm-neon)"' : ''}>${text}</text>`;
  const body = t(tube, 3) + t(core, 1);
  return on ? anim('rm-neon', body) : body;
}
const ART_NEON = { neon: ['FOCUS', '#ff5fa2', '#ffd1e6', 34], neon_study: ['STUDY', '#5ee0f0', '#d8fbff', 30], neon_gm: ['GM', '#ffd166', '#fff4c8', 40], neon_play: ['PLAY', '#7cf07c', '#e6ffe6', 32], neon_think: ['THINK', '#ff9a4a', '#ffe8d0', 30], neon_calm: ['CALM', '#b58cff', '#efe6ff', 32] };
for (const [id, [txt, c, inner, sz]] of Object.entries(ART_NEON)) ART_LIVE[id] = { over: (o, e) => artNeonWord(txt, c, inner, o, sz, artObj(e)) };
/* clock dials found on the pictures (fx 'dial'): the hands keep the real time */
ART_FX.dial = { draw: (x, y, w, h, i, c, o) => {
  // w, h: the face's semi-axes; c: 'ang:<deg>;utc:<hours>' (its tilt, and a time zone for the world clocks)
  const kv = Object.fromEntries(String(c || '').split(';').filter(Boolean).map((p) => p.split(':')));
  let oo = o || {};
  if (kv.utc != null) { const base = oo.clock || oo.now || new Date(); const d = new Date(base.getTime() + base.getTimezoneOffset() * 60000 + (+kv.utc) * 3600000); oo = { ...oo, clock: d, now: d }; }
  const col = '#2b2118';
  return `<g transform="translate(${x},${y}) rotate(${+kv.ang || 0}) scale(${f1(w)},${f1(h)})">${clockHands(0, 0, 0.52, 0.76, 0.1, 0.065, col, oo)}<circle r=".08" fill="${col}"/></g>`;
} };

/* words and numbers stay live text over the pictures (Canva art has no text): posters' titles, the certificate,
   the pennant, today's date on the calendar, your level in the golden frame. Positions are in the old drawing's units
   (w x h) and follow the new picture's box. */
function artTextAt(b, W, H, [t, x, y, size, c, weight = 800, ls = 1, font = 'system-ui, sans-serif', anchor = 'middle']) {
  const k = b.h / H;
  return `<text x="${f1(b.x + (x / W) * b.w)}" y="${f1(b.y + (y / H) * b.h)}" font-size="${f1(size * k)}" text-anchor="${anchor}" fill="${c}" font-family="${font}" font-weight="${weight}" letter-spacing="${f1(ls * k)}">${t}</text>`;
}
const ART_TEXTS = {
  poster_think: [80, 110, [['THINK', 40, 88, 13, '#f2c14e', 900, 2], ['TWICE', 40, 102, 10, '#f3ead2', 700, 3]]],
  poster_onemove: [80, 110, [['ONE MOVE', 40, 82, 11, '#2b2118', 900, 1], ['AT A TIME', 40, 96, 9, '#2b2118', 700, 2]]],
  poster_board: [80, 110, [['PLAY THE', 40, 82, 10, '#2b2118', 700, 2], ['BOARD', 40, 98, 14, '#b5483f', 900, 2]]],
  poster_tactics: [80, 110, [['TACTICS', 40, 100, 12, '#f3ead2', 900, 2]]],
  poster_endgame: [80, 110, [['ENDGAME', 40, 94, 12, '#2b2b30', 900, 1]]],
  poster_opening: [80, 110, [['OPENING', 40, 86, 11, '#f2c14e', 900, 1], ['NIGHT', 40, 99, 9, '#f3ead2', 700, 3]]],
  poster_curious: [80, 110, [['STAY', 40, 86, 11, '#2b2b30', 900, 2], ['CURIOUS', 40, 100, 11, '#2b2b30', 900, 2]]],
  poster_knight: [90, 110, [['KNIGHT', 45, 100, 10, '#f3ead2', 900, 3]]],
  poster_diagram: [100, 110, [['WHITE TO PLAY', 50, 96, 8, '#2b2118', 800, 1.5]]],
  poster_space: [80, 110, [['EXPLORE', 40, 100, 9, '#f3d9a8', 800, 3]]],
  diploma: [80, 100, [['CERTIFICATE', 40, 29, 7.4, '#6b4a1e', 700, 0.6, 'Georgia, serif']]],
  rw_dayone: [80, 90, [['DAY ONE', 40, 26, 9, '#6b4a1e', 700, 1, 'Georgia, serif']]],
  rw_weekplaque: [120, 60, [['FULL WEEK', 60, 46.5, 7.5, '#3a2410', 800, 1]]],
  rw_banner: [80, 130, [['OPEN', 40, 76, 9, '#f3ead2', 800, 1]]],
  clocks_world: [180, 70, [['LONDON', 32.4, 63.4, 5.2, '#f4f1ea', 800, 0.4], ['NEW YORK', 84.6, 63.4, 5.2, '#f4f1ea', 800, 0.4], ['TOKYO', 136.8, 63.4, 5.2, '#f4f1ea', 800, 0.4]]],
};
for (const [id, [W, H, L]] of Object.entries(ART_TEXTS)) ART_LIVE[id] = { over: (o, e) => L.map((l) => artTextAt(artObj(e), W, H, l)).join('') };
const ART_MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'], ART_DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
ART_LIVE.calendar = { over: (o, e) => { const d = o.clock || o.now || new Date(); const b = artObj(e);
  return [[ART_MONTHS[d.getMonth()], 35, 20, 11, '#fff', 700, 0.5], [String(d.getDate()), 35, 64, 32, '#2f3440', 800, 0], [ART_DAYS[d.getDay()], 35, 81, 9, '#8e8574', 600, 0.5]].map((l) => artTextAt(b, 70, 90, l)).join(''); } };
ART_LIVE.rw_goldframe = { over: (o, e) => { const b = artObj(e); return artTextAt(b, 120, 140, ['LEVEL', 60, 56, 12, '#e8b93c', 800, 2]) + artTextAt(b, 120, 140, [String(o.level || 1), 60, 96, 38, '#f3ead2', 900, 0]); } };
/* one small medal (or cup) per achievement, hung on the board / set on the shelves of the cabinet */
ART_LIVE.medals = { over: (o, e) => { const S = ROOM_ART.sprites && ROOM_ART.sprites.medal; if (!S) return ''; const b = artObj(e); const n = Math.min(15, o.achievements || 0);
  const mh = b.h * 0.26, mw = mh * S[1] / S[2]; let s = '';
  for (let i = 0; i < n; i++) { const x = b.x + b.w * (16 + (i % 5) * 22) / 120, y = b.y + b.h * (18 + Math.floor(i / 5) * 24) / 90; s += artImg(S[0], f1(x - mw / 2), f1(y - mh * 0.72), f1(mw), f1(mh)); }
  return s; } };
ART_LIVE.trophies = { over: (o, e) => { const S = ROOM_ART.sprites && ROOM_ART.sprites.trophy, P = ROOM_ART.sprites && ROOM_ART.sprites.trophySlots; if (!S || !P) return ''; const n = Math.min(9, o.rare || 0);
  let s = ''; for (let i = 0; i < n && i < P.length; i++) { const [x, y, hh] = P[i]; const w = hh * S[1] / S[2]; s += artImg(S[0], f1(x - w / 2), f1(y - hh), f1(w), f1(hh)); }
  return s; } };

/* the doors between rooms: the Canva door, greyed by code when the room is still locked, with a padlock */
function artDoor(W, Hh, open, wall) {
  const S = ROOM_ART.sprites || {}; if (!S.door) return '';
  const pic = [open ? 'door' : 'door_locked', -7, -6, W + 14, Hh + 6];
  let s = `<g class="rm-door-leaf">${artImg(...pic)}</g>`;
  if (!open && S.padlock) { const [f, pw, ph] = S.padlock; const hh = 30, ww = (hh * pw) / ph; s += artImg(f, f1(W / 2 - ww / 2), f1(Hh * 0.33 - hh / 2), f1(ww), hh); }
  return artThick('door', wall, pic, s);
}

/* ---------- what hangs on a wall ----------
   Flat pictures (front views) are drawn on the wall plane: the wall's projection moves every column of pixels down
   1 px for every 2 px across (the room's 2:1 isometric), so their edges follow the wall exactly, on either wall.
   A piece that stands out from the wall gets a thickness: its outline, filled with the colour of its edge
   (ROOM_ART.side), stacked from the wall to the front face, which is pushed towards the room — left and down on
   the right wall, right and down on the left wall. Depths in the wall's units (100 = one floor tile). */
const ART_DEPTH = [[/^(window|window_round|window_arch|window_tall|window_stained|rw_dawnwindow|stringlights|bunting)$/, 0],
  [/^(tapestry|rw_banner|rw_flag|pennant|macrame_wall|calendar)$/, 2], [/^(poster_|led_)/, 3],
  [/^(neon|photos|butterflies|rw_dayone|diploma|mirror|board_wall)/, 4],
  [/^(painting|chalkboard|whiteboard|corkboard|pegboard|map_pins|medals|rw_missionboard|records_wall|tv_wall|rw_weekplaque|rw_goldframe)/, 5],
  [/^(wallclock|clock_minimal|dartboard|rw_astroclock|clocks_world|door)$/, 6], [/^(cuckoo|shelf_|guitar_wall|sconce_|garden_wall)/, 8], [/^torch$/, 5], [/^ac$/, 18]];
function artDepth(id) { for (const [re, d] of ART_DEPTH) if (re.test(id)) return d; return 4; }
/* pic = [file, x, y, w, h] of the picture; inner = everything drawn for the piece (picture and live layers) */
function artThick(id, wall, pic, inner) {
  const c = ROOM_ART.side && ROOM_ART.side[id]; const D = c ? artDepth(id) : 0;
  if (!D || !pic || (wall !== 'L' && wall !== 'R')) return inner;
  const sx = wall === 'L' ? 1 : -1, ky = ISO.TH / ISO.ZH; const n = Math.max(2, Math.min(8, Math.ceil(D / 1.5)));
  const fid = roomDefOnce(`rm-side-${c.slice(1)}`, `<filter x="-4%" y="-4%" width="108%" height="108%" color-interpolation-filters="sRGB"><feFlood flood-color="${c}"/><feComposite in2="SourceAlpha" operator="in"/></filter>`);
  let s = ''; for (let i = 0; i < n; i++) { const t = (D * i) / n; s += artImg(pic[0], f1(pic[1] + sx * t), f1(pic[2] + ky * t), pic[3], pic[4]); }
  return `<g filter="url(#${fid})">${s}</g><g transform="translate(${f1(sx * D)},${f1(ky * D)})">${inner}</g>`;
}
function artWallBody(it, wall, inner) { const e = ROOM_ART.items[it.id]; return e ? artThick(it.id, wall, e, inner) : inner; }

function artDraw(it, o) {
  const e = ROOM_ART.items[it.id];
  if (!e) { // an animal standing still (shop, editing): its own picture, on its cushion if it has one
    const set = it.walker && ROOM_ART.walkers[it.id]; if (!set) return null;
    const fig = artFigure(set, { still: true, pose: 'idle' });
    return (artHome(it, o) ?? (it.home ? it.home(o) : shadow(0.5, 0.5, 0.22, 0.22))) + sprite(0.5, 0.52, 0, set.k ? `<g transform="scale(${set.k})">${fig}</g>` : fig);
  }
  const live = ART_LIVE[it.id];
  let img = artImg(e[10] && !lit(o) ? e[0] + '_off' : e[0], e[1], e[2], e[3], e[4]); // a light switched off has its own picture
  if (e[5] === 'r') img = onTop(0, 0, 0.004, img);
  return (live && live.under ? live.under(o || {}, e) : '') + img + artFx(it, o) + (live && live.over ? live.over(o || {}, e) : '');
}
function artHome(it, o) {
  const e = ROOM_ART.items[it.id + '#home']; if (!e) return null;
  return artImg(e[0], e[1], e[2], e[3], e[4]);
}

/* ---------- figures: one picture per direction (x+, y+, x−, y−) and one standing still ----------
   A figure made of parts has one strip picture per direction: body, legs, head and tail stacked one under the
   other. Each part is shown through its own window onto the strip and carries its pivot (data-px, data-py), so the
   walk is animated by code: legs swing in turns, the head nods, the tail wags, the body breathes. */
const ART_DIRS = ['xp', 'yp', 'xm', 'ym', 'idle'];
const ART_MIRROR = { xp: 'yp', yp: 'xp', xm: 'ym', ym: 'xm' };
const f5 = (v) => +v.toFixed(5);
/* part k of n in the strip file f, placed at the figure box e (x, y, w, h); pad = clear rows around each tile */
function artPart(f, e, k, n, pad, extra = '') {
  const st = 1 + 2 * pad;
  return `<svg x="${e[1]}" y="${e[2]}" width="${e[3]}" height="${e[4]}" viewBox="0 ${f5(k * st + pad)} 1 1" preserveAspectRatio="none" overflow="hidden"><image href="${artUrl(f)}" width="1" height="${f5(n * st)}" preserveAspectRatio="none"${extra}/></svg>`;
}
/* parts: [[type (b body, l leg, h head, t tail), group, px, py], ...] in draw order; layers(k, n) = the pictures of part k */
function artRig(parts, layers, onHead = '') {
  const n = parts.length; const hat = onHead && !parts.some((p) => p[0] === 'h');
  const out = parts.map(([t, g, px, py], k) => `<g data-q="${t}" data-g="${g}" data-px="${px}" data-py="${py}">${layers(k, n)}${t === 'h' ? onHead : ''}</g>`).join('');
  return out + (hat ? onHead : '');
}
function artFigure(set, { pose = 'idle', still = false } = {}) {
  if (!set) return null;
  const pic = (d) => {
    let e = set[d], flip = false;
    if (!e && ART_MIRROR[d] && set[ART_MIRROR[d]]) { e = set[ART_MIRROR[d]]; flip = true; }
    if (!e) e = set.idle || set.xp; if (!e) return '';
    const img = Array.isArray(e[5]) ? artRig(e[5], (k, n) => artPart(e[0], e, k, n, e[6])) : artImg(e[0], e[1], e[2], e[3], e[4]);
    return flip ? `<g transform="scale(-1,1)">${img}</g>` : img;
  };
  const dirs = still ? [pose] : ART_DIRS;
  return `<g data-p="bob">${dirs.map((d) => `<g data-pose="${d}"${d === pose ? '' : ' display="none"'}>${pic(d)}</g>`).join('')}</g>`;
}
function artWalkerSvg(it, opts) { return it && ROOM_ART.walkers[it.id] ? artFigure(ROOM_ART.walkers[it.id], opts) : null; }
/* the character: six looks; skin, hair, top and bottom are grey shade layers tinted with the colours you pick */
const AV_LOOKS = [['A', 'Short hair'], ['B', 'Long hair'], ['C', 'Curls'], ['D', 'Ponytail'], ['E', 'Bob & glasses'], ['F', 'Buzz & beard']];
const AV_TINTS = ['skin', 'hair', 'top', 'bot'];
function avLookOf(av) {
  if (av.look && ROOM_ART.looks && ROOM_ART.looks[av.look]) return av.look;
  return { long: 'B', braids: 'B', side: 'A', afro: 'C', curly: 'C', pony: 'D', bun: 'D', bob: 'E', buzz: 'F', bald: 'F' }[av.hair] || 'A';
}
function artAvatarReady() { const L = ROOM_ART.looks; return !!(L && Object.keys(L).length); }
let _avTint = 0;
/* where a hat sits: centred on the top of the head, as wide as the head times the hat's own ratio */
function avHatSvg(hat, e) {
  const H = ROOM_ART.hats && ROOM_ART.hats[hat]; if (!H || hat === 'none') return '';
  const [f, iw, ih, ax, ay, wr] = H; const hx = e[5], hy = e[6], hw = e[7];
  const w = hw * wr, hh = w * ih / iw;
  return artImg(f, f1(hx - ax * w), f1(hy - ay * hh), f1(w), f1(hh));
}
function artAvatarSvg(av, { pose = 'idle', still = false } = {}) {
  if (!artAvatarReady()) return null;
  const look = ROOM_ART.looks[avLookOf(av)]; const id = 'avt' + (++_avTint);
  const cols = { skin: AV_SKINS[av.skin] || AV_SKINS[1], hair: av.hairC, top: av.topC, bot: av.bottomC };
  const flt = AV_TINTS.map((k) => { const { r, g, b } = hexToRgb(cols[k] || '#888888'); const v = (c) => (2 * c / 255).toFixed(3);
    return `<filter id="${id}-${k}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${v(r)} 0 0 0 0 0 ${v(g)} 0 0 0 0 0 ${v(b)} 0 0 0 0 0 1 0"/></filter>`; }).join('');
  const pic = (d) => {
    let e = look[d], flip = false;
    if (!e && ART_MIRROR[d] && look[ART_MIRROR[d]]) { e = look[ART_MIRROR[d]]; flip = true; }
    if (!e) e = look.idle || look.xp; if (!e) return '';
    const [f, x, y, w, hh] = e;
    const s = Array.isArray(e[8])
      ? artRig(e[8], (k, n) => artPart(f, e, k, n, e[9]) + AV_TINTS.map((t) => artPart(`${f}_${t}`, e, k, n, e[9], ` filter="url(#${id}-${t})"`)).join(''), avHatSvg(av.hat, e))
      : artImg(f, x, y, w, hh) + AV_TINTS.map((k) => artImg(`${f}_${k}`, x, y, w, hh, ` filter="url(#${id}-${k})"`)).join('') + avHatSvg(av.hat, e);
    return flip ? `<g transform="scale(-1,1)">${s}</g>` : s;
  };
  const dirs = still ? [pose] : ART_DIRS;
  return `<defs>${flt}</defs><g data-p="bob">${dirs.map((d) => `<g data-pose="${d}"${d === pose ? '' : ' display="none"'}>${pic(d)}</g>`).join('')}</g>`;
}

/* ---------- the picture to share is drawn from an SVG string, which cannot load files: inline them ---------- */
const _artData = new Map();
async function artDataUrl(url) {
  if (_artData.has(url)) return _artData.get(url);
  const p = fetch(url).then((r) => { if (!r.ok) throw new Error(url); return r.blob(); })
    .then((b) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(b); }))
    .catch(() => null);
  _artData.set(url, p); return p;
}
async function inlineArt(svg) {
  const urls = [...new Set([...svg.matchAll(/href="(assets\/room\/[^"]+)"/g)].map((m) => m[1]))];
  const data = await Promise.all(urls.map((u) => artDataUrl(u.replace(/&amp;/g, '&'))));
  let out = svg; urls.forEach((u, i) => { if (data[i]) out = out.split(`href="${u}"`).join(`href="${data[i]}"`); });
  return out;
}
