/* ===== Study room — isometric drawing kit and the catalogue of things to buy =====
   Coordinates: x runs to the lower right, y to the lower left, z up; one tile = 1 unit.
   Floor items are drawn from their footprint's back corner (0,0,0); wall items are flat drawings
   (100 units per tile) mapped onto a wall. Everything is plain SVG, so it stays sharp at any size. */
const ISO = { TW: 64, TH: 32, ZH: 34, N: 8, H: 3.1 };
const isoX = (x, y) => ((x - y) * ISO.TW) / 2;
const isoY = (x, y, z = 0) => ((x + y) * ISO.TH) / 2 - z * ISO.ZH;
const f1 = (v) => Math.round(v * 10) / 10;
const P = (x, y, z = 0) => `${f1(isoX(x, y))},${f1(isoY(x, y, z))}`;
function tone(hex, amt) { // amt > 0 lightens, < 0 darkens
  const { r, g, b } = hexToRgb(hex); const f = (c) => Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt);
  return '#' + [f(r), f(g), f(b)].map((v) => clamp(v, 0, 255).toString(16).padStart(2, '0')).join('');
}
const poly = (pts, fill, extra = '') => `<polygon points="${pts.map(([x, y, z]) => P(x, y, z)).join(' ')}" fill="${fill}"${extra}/>`;
const edge = (c, w = 0.7) => ` stroke="${tone(c, -0.5)}" stroke-width="${w}" stroke-linejoin="round"`;
/* an axis-aligned box: left face (facing +y), right face (facing +x), top */
function box(x, y, z, w, d, hh, c, o = {}) {
  const x1 = x + w, y1 = y + d, z1 = z + hh; const st = o.line === false ? '' : edge(c, o.lw);
  return poly([[x, y1, z], [x1, y1, z], [x1, y1, z1], [x, y1, z1]], o.l || tone(c, -0.05), st)
    + poly([[x1, y, z], [x1, y1, z], [x1, y1, z1], [x1, y, z1]], o.r || tone(c, -0.27), st)
    + poly([[x, y, z1], [x1, y, z1], [x1, y1, z1], [x, y1, z1]], o.t || tone(c, 0.13), st);
}
/* an upright cylinder */
function cyl(cx, cy, z, r, hh, c, o = {}) {
  const rx = (r * ISO.TW) / Math.SQRT2, ry = (r * ISO.TH) / Math.SQRT2;
  const bx = f1(isoX(cx, cy)), by = f1(isoY(cx, cy, z)), ty = f1(isoY(cx, cy, z + hh));
  const L = o.l || tone(c, -0.03), R = o.r || tone(c, -0.28), T = o.t || tone(c, 0.14); const st = o.line === false ? '' : edge(c, 0.6);
  return `<path d="M${bx - rx},${ty} L${bx - rx},${by} A${rx},${ry} 0 0 0 ${bx},${by + ry} L${bx},${ty + ry} A${rx},${ry} 0 0 1 ${bx - rx},${ty} Z" fill="${L}"/>`
    + `<path d="M${bx},${ty + ry} L${bx},${by + ry} A${rx},${ry} 0 0 0 ${bx + rx},${by} L${bx + rx},${ty} A${rx},${ry} 0 0 1 ${bx},${ty + ry} Z" fill="${R}"/>`
    + `<path d="M${bx - rx},${ty} L${bx - rx},${by} A${rx},${ry} 0 0 0 ${bx + rx},${by} L${bx + rx},${ty}" fill="none"${st}/>`
    + `<ellipse cx="${bx}" cy="${ty}" rx="${f1(rx)}" ry="${f1(ry)}" fill="${T}"${st}/>`;
}
/* flat drawings mapped onto planes (100 units per tile) */
const faceY = (y, x0, zTop, svg) => `<g transform="matrix(${ISO.TW / 200},${ISO.TH / 200},0,${ISO.ZH / 100},${f1(isoX(x0, y))},${f1(isoY(x0, y, zTop))})">${svg}</g>`;
const faceX = (x, yLeft, zTop, svg) => `<g transform="matrix(${ISO.TW / 200},${-ISO.TH / 200},0,${ISO.ZH / 100},${f1(isoX(x, yLeft))},${f1(isoY(x, yLeft, zTop))})">${svg}</g>`;
const onTop = (x0, y0, z, svg) => `<g transform="matrix(${ISO.TW / 200},${ISO.TH / 200},${-ISO.TW / 200},${ISO.TH / 200},${f1(isoX(x0, y0))},${f1(isoY(x0, y0, z))})">${svg}</g>`;
const sprite = (cx, cy, z, svg) => `<g transform="translate(${f1(isoX(cx, cy))},${f1(isoY(cx, cy, z))})">${svg}</g>`;
const shadow = (cx, cy, r, op = 0.22) => `<ellipse cx="${f1(isoX(cx, cy))}" cy="${f1(isoY(cx, cy))}" rx="${f1(r * ISO.TW / Math.SQRT2)}" ry="${f1(r * ISO.TH / Math.SQRT2)}" fill="#000" opacity="${op}" filter="url(#rm-soft)"/>`;
const anim = (cls, svg, delay = 0) => `<g class="${cls}"${delay ? ` style="animation-delay:${delay}s"` : ''}>${svg}</g>`;

const C = { wood: '#b9824f', woodL: '#d4a06a', woodD: '#7a4b2a', dark: '#34343a', metal: '#9aa3ad', white: '#eeeae2', terra: '#c46a41', leaf: '#4c9a52', leafL: '#6cc070', leafD: '#2f6b38', gold: '#e8b93c', glass: '#bfe3f2' };

/* ---------- shared parts ---------- */
function legs4(x, y, w, d, hh, c, t = 0.07) { return box(x, y, 0, t, t, hh, c) + box(x + w - t, y, 0, t, t, hh, c) + box(x, y + d - t, 0, t, t, hh, c) + box(x + w - t, y + d - t, 0, t, t, hh, c); }
function pot(cx, cy, r, hh, c = C.terra) { return cyl(cx, cy, 0, r, hh, c) + `<ellipse cx="${f1(isoX(cx, cy))}" cy="${f1(isoY(cx, cy, hh))}" rx="${f1(r * 0.82 * ISO.TW / Math.SQRT2)}" ry="${f1(r * 0.82 * ISO.TH / Math.SQRT2)}" fill="#4a3325"/>`; }
function leafBlob(x, y, rx, ry, rot, c) { return `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${x} ${y})" fill="${c}" stroke="${tone(c, -0.35)}" stroke-width="0.6"/>`; }
function bookRow(x0, x1, z0, hMax, seed) { // books standing on a face plane (flat units)
  const rnd = mulberry(seed); const cols = ['#b5483f', '#3f6ea8', '#4f8a5b', '#d4a23a', '#7d5aa6', '#2f7f86', '#c46a41', '#e8e0cc']; let x = x0; let out = '';
  while (x < x1 - 4) { const w = 5 + Math.floor(rnd() * 5); const hh = hMax * (0.65 + rnd() * 0.35); if (x + w > x1) break; const c = cols[Math.floor(rnd() * cols.length)];
    if (rnd() < 0.12 && x + hh < x1) { out += `<rect x="${x}" y="${z0 - w}" width="${hh}" height="${w}" fill="${c}" stroke="${tone(c, -0.45)}" stroke-width="0.6"/>`; x += hh + 1; continue; }
    out += `<rect x="${x}" y="${z0 - hh}" width="${w}" height="${hh}" fill="${c}" stroke="${tone(c, -0.45)}" stroke-width="0.6"/><rect x="${x + 1}" y="${z0 - hh + 3}" width="${w - 2}" height="1.4" fill="${tone(c, 0.35)}" opacity=".7"/>`; x += w + 0.6; }
  return out;
}

/* Clock hands turn by themselves in real time (a CSS rotation started at the right angle). */
function clockHands(cx, cy, hl, ml, hw, mw, color, now) {
  const sec = now.getMinutes() * 60 + now.getSeconds(); const hsec = (now.getHours() % 12) * 3600 + sec;
  const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hand = (len, w, period, at) => {
    const line = `<line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - len}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;
    if (still) return `<g transform="rotate(${(360 * at) / period} ${cx} ${cy})">${line}</g>`;
    return `<g class="rm-hand" style="animation-duration:${period}s;animation-delay:-${at}s">${line}<line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy + len}" stroke="none"/></g>`;
  };
  return hand(hl, hw, 43200, hsec) + hand(ml, mw, 3600, sec);
}

/* ---------- a sitting cat, facing the viewer at three quarters ---------- */
function catSprite(body, stripe, eye = '#8bc34a') {
  const bd = tone(body, -0.3);
  return `<g transform="translate(-2,0)">`
    + anim('rm-wag', `<path d="M8,-6 C22,-6 26,-18 20,-26 C18,-29 15,-27 17,-24 C21,-18 17,-11 8,-10 Z" fill="${body}" stroke="${bd}" stroke-width="0.8"/>`)
    + `<path d="M-9,0 C-12,-10 -10,-22 0,-25 C10,-22 12,-10 9,0 Z" fill="${body}" stroke="${bd}" stroke-width="0.8"/>`
    + (stripe ? `<path d="M-7,-14 q4,2 7,0 M-8,-9 q5,2 9,0 M-6,-19 q3,1.5 6,0" stroke="${stripe}" stroke-width="1.6" fill="none" stroke-linecap="round"/>` : '')
    + `<ellipse cx="0" cy="-5" rx="5.5" ry="4.5" fill="${tone(body, 0.35)}"/>`
    + `<path d="M-6,0 q2,-4 4,0 M2,0 q2,-4 4,0" fill="${tone(body, 0.2)}" stroke="${bd}" stroke-width="0.7"/>`
    + `<g><path d="M-9,-31 L-8,-40 L-3,-35 Z M9,-31 L8,-40 L3,-35 Z" fill="${body}" stroke="${bd}" stroke-width="0.8"/><path d="M-7.5,-33.5 L-7.3,-38 L-4.5,-35.5 Z M7.5,-33.5 L7.3,-38 L4.5,-35.5 Z" fill="#e8a0a0"/>`
    + `<ellipse cx="0" cy="-30" rx="10" ry="8.5" fill="${body}" stroke="${bd}" stroke-width="0.8"/>`
    + (stripe ? `<path d="M-2,-37 l1,3 M2,-37 l-1,3 M0,-38 v3" stroke="${stripe}" stroke-width="1.3" stroke-linecap="round"/>` : '')
    + anim('rm-blink', `<ellipse cx="-3.8" cy="-30.5" rx="1.7" ry="2.1" fill="${eye}"/><ellipse cx="3.8" cy="-30.5" rx="1.7" ry="2.1" fill="${eye}"/><ellipse cx="-3.8" cy="-30.3" rx=".6" ry="1.6" fill="#111"/><ellipse cx="3.8" cy="-30.3" rx=".6" ry="1.6" fill="#111"/>`)
    + `<path d="M-1.2,-27.2 h2.4 l-1.2,1.3 Z" fill="#d77"/><path d="M0,-25.9 q-2,2 -3.5,1 M0,-25.9 q2,2 3.5,1" stroke="${bd}" stroke-width=".6" fill="none"/>`
    + `<path d="M-6,-27 l-7,-1 M-6,-26 l-7,1 M6,-27 l7,-1 M6,-26 l7,1" stroke="#fff" stroke-width=".4" opacity=".8"/></g></g>`;
}

/* ---------- the catalogue ---------- */
/* fp = footprint in tiles (w along x, d along y); wall = [w, h] for wall items; flat = rugs;
   glow = light sources [x, y, z, radius, colour] in local tiles; lvl = level needed to buy. */
const ROOM_CATS = [['furniture', 'Furniture'], ['plants', 'Plants'], ['lights', 'Lights'], ['animals', 'Animals'], ['decor', 'Decor'], ['wall', 'On the wall'], ['styles', 'Walls & floors']];
const ROOM_ITEMS = [
  /* ----- furniture ----- */
  { id: 'desk', hug: true, cat: 'furniture', name: 'Study desk', price: 0, fp: [2, 1], hgt: 1.3, desc: 'Books, a mug and a desk lamp.', glow: [[1.65, 0.3, 1.2, 0.9, '#ffd28a']],
    draw() {
      const t = 0.74, w = C.wood;
      return legs4(0.06, 0.08, 0.3, 0.84, t, C.woodD) + box(1.28, 0.08, 0, 0.64, 0.84, t, w)
        + faceY(0.92, 1.28, t, `<rect x="4" y="6" width="56" height="18" rx="2" fill="none" stroke="${C.woodD}" stroke-width="1"/><rect x="4" y="28" width="56" height="18" rx="2" fill="none" stroke="${C.woodD}" stroke-width="1"/><rect x="4" y="50" width="56" height="18" rx="2" fill="none" stroke="${C.woodD}" stroke-width="1"/><rect x="26" y="13" width="12" height="3" rx="1.5" fill="${C.gold}"/><rect x="26" y="35" width="12" height="3" rx="1.5" fill="${C.gold}"/><rect x="26" y="57" width="12" height="3" rx="1.5" fill="${C.gold}"/>`)
        + box(0, 0, t, 2, 1, 0.06, C.woodL)
        + onTop(0.62, 0.34, t + 0.06, `<path d="M0,0 L40,-6 L42,26 L2,32 Z" fill="#f4efe2" stroke="#b9b2a1" stroke-width="1"/><path d="M40,-6 L80,0 L82,32 L42,26 Z" fill="#fbf7ec" stroke="#b9b2a1" stroke-width="1"/><path d="M8,6 h26 M8,12 h22 M8,18 h26 M48,6 h26 M48,12 h20" stroke="#9aa3ad" stroke-width="1.2"/>`)
        + box(0.14, 0.12, t + 0.06, 0.36, 0.28, 0.07, '#b5483f') + box(0.16, 0.14, t + 0.13, 0.32, 0.25, 0.06, '#3f6ea8') + box(0.13, 0.12, t + 0.19, 0.35, 0.27, 0.06, '#4f8a5b')
        + cyl(1.05, 0.72, t + 0.06, 0.06, 0.1, C.white) + sprite(1.05, 0.72, t + 0.12, `<path d="M3.2,-4 q4,0 3.5,3.5 q-0.5,2.5 -3.5,2" fill="none" stroke="#d9d4c7" stroke-width="1.3"/>`)
        + cyl(1.65, 0.3, t + 0.06, 0.09, 0.025, C.dark) + sprite(1.65, 0.3, t + 0.08, `<path d="M0,0 L-3,-18 L7,-27" stroke="${C.dark}" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M1,-31 L15,-27 L11,-19 L-1,-23 Z" fill="#2f6e5a" stroke="#1d4a3c" stroke-width=".8"/><ellipse cx="8" cy="-21" rx="4" ry="2" fill="#fff4c8"/>`);
    } },
  { id: 'chair', cat: 'furniture', name: 'Desk chair', price: 0, fp: [1, 1], hgt: 1.1, desc: 'Turns to face the desk when flipped.',
    draw() {
      const f = '#3f6ea8';
      return sprite(0.5, 0.5, 0.04, `<path d="M-16,4 L0,0 L16,4 M0,0 L-2,10 M0,0 L12,-6 M0,0 L-12,-6" stroke="${C.dark}" stroke-width="2.4" stroke-linecap="round"/>`)
        + cyl(0.5, 0.5, 0.05, 0.05, 0.36, C.dark) + box(0.2, 0.2, 0.41, 0.6, 0.54, 0.09, f)
        + box(0.47, 0.72, 0.36, 0.06, 0.04, 0.2, C.dark) + box(0.22, 0.68, 0.52, 0.56, 0.08, 0.5, f) + box(0.26, 0.7, 0.58, 0.48, 0.05, 0.38, tone(f, 0.12), { line: false });
    } },
  { id: 'bookcase', hug: true, cat: 'furniture', name: 'Bookcase', price: 180, fp: [1, 1], hgt: 2.3, desc: 'Four shelves of well-read books.',
    draw() {
      const H = 2.1; let shelves = '';
      for (let i = 0; i < 4; i++) { const zb = 190 - i * 48; shelves += `<rect x="7" y="${zb - 42}" width="86" height="42" fill="#3b2415"/>` + bookRow(9, 91, zb, 34, 11 + i); }
      return box(0, 0, 0, 1, 0.45, H, C.woodD) + faceY(0.45, 0, H, `<rect x="0" y="0" width="100" height="${H * 100}" fill="none"/>${shelves}<rect x="4" y="198" width="92" height="8" fill="${tone(C.woodD, 0.1)}"/>`);
    } },
  { id: 'armchair', cat: 'furniture', name: 'Reading armchair', price: 240, fp: [1, 1], hgt: 1.2, desc: 'Deep enough for a long chapter.',
    draw() {
      const f = '#4f8a6b';
      return shadow(0.5, 0.55, 0.45) + legs4(0.12, 0.14, 0.76, 0.72, 0.12, C.woodD, 0.06) + box(0.08, 0.1, 0.12, 0.84, 0.8, 0.28, f) + box(0.08, 0.1, 0.4, 0.84, 0.2, 0.58, f)
        + box(0.08, 0.3, 0.4, 0.16, 0.6, 0.22, f) + box(0.24, 0.3, 0.4, 0.52, 0.58, 0.1, tone(f, 0.15)) + box(0.76, 0.3, 0.4, 0.16, 0.6, 0.22, f)
        + box(0.3, 0.3, 0.5, 0.4, 0.1, 0.3, '#e8c86a');
    } },
  { id: 'sofa', hug: true, cat: 'furniture', name: 'Sofa', price: 420, lvl: 3, fp: [2, 1], hgt: 1.1, desc: 'For breaks that deserve a sofa.',
    draw() {
      const f = '#b0574a';
      return shadow(1, 0.55, 0.8, 0.2) + legs4(0.1, 0.12, 1.8, 0.76, 0.1, C.woodD, 0.06) + box(0.06, 0.08, 0.1, 1.88, 0.84, 0.28, f) + box(0.06, 0.08, 0.38, 1.88, 0.24, 0.5, f)
        + box(0.06, 0.32, 0.38, 0.2, 0.6, 0.24, f) + box(0.28, 0.32, 0.38, 0.7, 0.58, 0.1, tone(f, 0.14)) + box(1.02, 0.32, 0.38, 0.7, 0.58, 0.1, tone(f, 0.14))
        + box(1.74, 0.32, 0.38, 0.2, 0.6, 0.24, f) + box(0.34, 0.34, 0.48, 0.34, 0.1, 0.3, '#e8c86a') + box(1.3, 0.34, 0.48, 0.34, 0.1, 0.3, '#6e8ef0');
    } },
  { id: 'chesstable', cat: 'furniture', name: 'Chess table', price: 320, fp: [1, 1], hgt: 1.0, desc: 'A game always set up and waiting.',
    draw() {
      let sq = ''; for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) sq += `<rect x="${i * 7.5}" y="${j * 7.5}" width="7.5" height="7.5" fill="${(i + j) % 2 ? '#8b5a2b' : '#ecd9b0'}"/>`;
      const pc = (x, y, c) => cyl(x, y, 0.69, 0.022, 0.05, c, { line: false }) + sprite(x, y, 0.74, `<circle cy="-1.5" r="2.1" fill="${c}" stroke="${tone(c, -0.5)}" stroke-width=".5"/>`);
      return shadow(0.5, 0.5, 0.38) + cyl(0.5, 0.5, 0, 0.2, 0.05, C.woodD) + cyl(0.5, 0.5, 0.05, 0.05, 0.57, C.wood) + box(0.12, 0.12, 0.62, 0.76, 0.76, 0.06, C.woodD)
        + onTop(0.2, 0.2, 0.685, `<rect x="-2" y="-2" width="64" height="64" fill="#5a3a20"/>${sq}`)
        + pc(0.3, 0.36, '#f3eee2') + pc(0.44, 0.52, '#f3eee2') + pc(0.62, 0.3, '#f3eee2') + pc(0.52, 0.66, '#2b2b30') + pc(0.7, 0.58, '#2b2b30') + pc(0.36, 0.72, '#2b2b30');
    } },
  { id: 'coffeetable', cat: 'furniture', name: 'Coffee table', price: 120, fp: [1, 1], hgt: 0.7, desc: 'A mug, a book, a small plant.',
    draw() {
      return shadow(0.5, 0.5, 0.4, 0.16) + legs4(0.16, 0.2, 0.68, 0.6, 0.3, C.woodD) + box(0.14, 0.18, 0.3, 0.72, 0.64, 0.05, C.woodL)
        + box(0.24, 0.3, 0.35, 0.3, 0.22, 0.05, '#7d5aa6') + cyl(0.66, 0.36, 0.35, 0.055, 0.09, C.white) + cyl(0.62, 0.66, 0.35, 0.06, 0.08, C.terra)
        + sprite(0.62, 0.66, 0.43, `${leafBlob(-3, -4, 3, 5, -30, C.leafL)}${leafBlob(3, -4, 3, 5, 30, C.leaf)}${leafBlob(0, -6, 2.6, 5, 0, C.leafL)}`);
    } },
  { id: 'beanbag', cat: 'furniture', name: 'Bean bag', price: 150, fp: [1, 1], hgt: 0.8, desc: 'Sink in between two sessions.',
    draw() {
      const c = '#d4a23a';
      return shadow(0.5, 0.5, 0.42, 0.25) + sprite(0.5, 0.5, 0, `<path d="M-24,-2 C-28,-14 -20,-28 -4,-30 C8,-32 22,-26 25,-12 C27,-2 20,6 0,7 C-16,7 -22,4 -24,-2 Z" fill="${c}" stroke="${tone(c, -0.45)}" stroke-width="0.9"/><path d="M-14,-12 C-8,-18 6,-18 12,-10 C6,-6 -8,-6 -14,-12 Z" fill="${tone(c, -0.18)}"/><path d="M-18,-20 C-10,-27 4,-28 12,-24" stroke="${tone(c, 0.35)}" stroke-width="2" fill="none" stroke-linecap="round" opacity=".7"/>`);
    } },
  { id: 'desk_pro', hug: true, cat: 'furniture', name: 'Desk with monitor', price: 520, lvl: 4, fp: [2, 1], hgt: 1.7, desc: 'Big screen, clean keyboard, one plant.', glow: [[1, 0.2, 1.1, 0.8, '#7fc4ff']],
    draw() {
      const t = 0.74; let lines = ''; const rnd = mulberry(5);
      for (let i = 0; i < 7; i++) lines += `<rect x="${8 + (i % 3) * 4}" y="${8 + i * 6}" width="${20 + rnd() * 40}" height="2.4" rx="1" fill="${['#8bc34a', '#7fc4ff', '#e8b93c', '#d9d4c7'][i % 4]}" opacity=".85"/>`;
      return box(0.04, 0.06, 0, 0.08, 0.88, t, C.dark) + box(1.88, 0.06, 0, 0.08, 0.88, t, C.dark) + box(0, 0, t, 2, 1, 0.05, '#e9e4d8')
        + box(0.95, 0.2, t + 0.05, 0.1, 0.08, 0.14, C.dark) + box(0.46, 0.16, t + 0.16, 1.08, 0.06, 0.62, '#1f2024')
        + faceY(0.22, 0.5, t + 0.74, `<rect x="0" y="0" width="100" height="54" rx="2" fill="#0f1b2d"/><rect x="0" y="0" width="100" height="54" rx="2" fill="url(#rm-screen)"/>${lines}<rect x="70" y="10" width="22" height="22" fill="none" stroke="#8bc34a" stroke-width="1.2"/><path d="M72,28 l5,-6 l4,3 l6,-9" stroke="#8bc34a" stroke-width="1.4" fill="none"/>`)
        + box(0.55, 0.5, t + 0.05, 0.8, 0.22, 0.025, '#2a2b30') + onTop(0.57, 0.52, t + 0.076, (() => { let k = ''; for (let i = 0; i < 12; i++) for (let j = 0; j < 3; j++) k += `<rect x="${i * 6.3 + 1}" y="${j * 6 + 1}" width="5" height="4.6" rx=".8" fill="#4a4c55"/>`; return k; })())
        + cyl(1.52, 0.62, t + 0.05, 0.05, 0.02, '#2a2b30') + cyl(1.8, 0.3, t + 0.05, 0.08, 0.12, C.white)
        + sprite(1.8, 0.3, t + 0.17, `${leafBlob(-4, -6, 3.2, 7, -35, C.leaf)}${leafBlob(4, -6, 3.2, 7, 35, C.leafL)}${leafBlob(0, -9, 3, 7, 0, C.leafD)}`);
    } },
  { id: 'cabinet', hug: true, cat: 'furniture', name: 'Drawer cabinet', price: 130, fp: [1, 1], hgt: 1.3, desc: 'Three drawers and a vase on top.',
    draw() {
      return box(0.1, 0.1, 0, 0.8, 0.55, 0.78, C.woodL) + faceY(0.65, 0.1, 0.78, `<rect x="4" y="5" width="72" height="20" rx="2" fill="none" stroke="${C.woodD}"/><rect x="4" y="29" width="72" height="20" rx="2" fill="none" stroke="${C.woodD}"/><rect x="4" y="53" width="72" height="20" rx="2" fill="none" stroke="${C.woodD}"/><circle cx="40" cy="15" r="2.2" fill="${C.gold}"/><circle cx="40" cy="39" r="2.2" fill="${C.gold}"/><circle cx="40" cy="63" r="2.2" fill="${C.gold}"/>`)
        + cyl(0.5, 0.36, 0.78, 0.08, 0.2, '#5a8fb5') + sprite(0.5, 0.36, 0.98, `<path d="M0,0 C-2,-8 -8,-12 -10,-16 M0,0 C0,-9 1,-14 2,-20 M0,0 C3,-7 8,-10 10,-14" stroke="#3f7a3f" stroke-width="1" fill="none"/><circle cx="-10" cy="-17" r="3" fill="#f06a8a"/><circle cx="2" cy="-21" r="3.2" fill="#ffd166"/><circle cx="10" cy="-15" r="3" fill="#b18cf0"/>`);
    } },
  { id: 'trophies', hug: true, cat: 'furniture', name: 'Trophy cabinet', price: 560, lvl: 5, fp: [1, 1], hgt: 2.2, desc: 'Shows one trophy for every rare or better achievement you unlock.',
    draw(o) {
      const n = Math.min(9, o.rare || 0); const H = 1.95; let cups = '';
      for (let i = 0; i < n; i++) { const row = Math.floor(i / 3), col = i % 3; const x = 18 + col * 28, zb = 186 - row * 60;
        cups += `<g transform="translate(${x},${zb})"><rect x="-6" y="-4" width="12" height="4" fill="#6b4a1e"/><path d="M-2,-4 h4 v-5 h-4 Z" fill="${C.gold}"/><path d="M-8,-20 h16 c0,8 -4,11 -8,11 c-4,0 -8,-3 -8,-11 Z" fill="${C.gold}" stroke="#a87b16" stroke-width=".8"/><path d="M-8,-18 c-5,0 -5,6 0,6 M8,-18 c5,0 5,6 0,6" stroke="${C.gold}" stroke-width="1.4" fill="none"/></g>`; }
      if (!n) cups = `<text x="45" y="110" font-size="11" fill="#c9b99a" text-anchor="middle" font-family="system-ui">waiting for</text><text x="45" y="124" font-size="11" fill="#c9b99a" text-anchor="middle" font-family="system-ui">your trophies</text>`;
      return box(0.05, 0.05, 0, 0.9, 0.5, H, C.woodD) + faceY(0.55, 0.05, H, `<rect x="5" y="6" width="80" height="185" fill="#2a1a10"/><rect x="5" y="66" width="80" height="4" fill="${C.woodD}"/><rect x="5" y="126" width="80" height="4" fill="${C.woodD}"/>${cups}<rect x="5" y="6" width="80" height="185" fill="url(#rm-glass)" opacity=".55"/><path d="M14,12 L30,12 L12,70 Z" fill="#fff" opacity=".12"/>`);
    } },
  { id: 'grandclock', hug: true, cat: 'furniture', name: 'Grandfather clock', price: 680, lvl: 6, fp: [1, 1], hgt: 2.6, desc: 'Keeps real time; the pendulum never tires.',
    draw(o) {
      const H = 2.25;
      return box(0.25, 0.25, 0, 0.5, 0.36, H, '#5b3620') + box(0.21, 0.21, H, 0.58, 0.44, 0.12, '#6e4428')
        + faceY(0.61, 0.25, H - 0.08, `<circle cx="25" cy="22" r="19" fill="#f3ead2" stroke="${C.gold}" stroke-width="2.4"/>${Array.from({ length: 12 }, (_, i) => `<line x1="25" y1="6" x2="25" y2="9" stroke="#3b2a1a" stroke-width="1.4" transform="rotate(${i * 30} 25 22)"/>`).join('')}${clockHands(25, 22, 10, 14, 2, 1.3, '#222', o.now)}<circle cx="25" cy="22" r="1.6" fill="#222"/>`
          + `<rect x="10" y="52" width="30" height="100" rx="3" fill="#2a170c"/>` + anim('rm-pendulum', `<line x1="25" y1="54" x2="25" y2="128" stroke="${C.gold}" stroke-width="1.4"/><circle cx="25" cy="134" r="7" fill="${C.gold}" stroke="#a87b16"/>`) + `<rect x="10" y="52" width="30" height="100" rx="3" fill="url(#rm-glass)" opacity=".35"/>`);
    } },
  { id: 'piano', hug: true, cat: 'furniture', name: 'Upright piano', price: 950, lvl: 8, fp: [2, 1], hgt: 1.5, desc: 'For the breaks with music.',
    draw() {
      let keys = ''; for (let i = 0; i < 22; i++) keys += `<rect x="${i * 7.6}" y="0" width="7.2" height="20" fill="#f7f4ec" stroke="#b9b2a1" stroke-width=".5"/>`;
      let blk = ''; for (let i = 0; i < 21; i++) { if (i % 7 === 2 || i % 7 === 6) continue; blk += `<rect x="${i * 7.6 + 5}" y="0" width="4.4" height="12" fill="#1c1c20"/>`; }
      return box(0.1, 0.05, 0, 1.8, 0.42, 1.2, '#2b211d') + box(0.12, 0.47, 0.64, 1.76, 0.24, 0.06, '#2b211d') + onTop(0.16, 0.49, 0.7, `${keys}${blk}`)
        + box(0.1, 0.47, 0, 0.08, 0.2, 0.64, '#2b211d') + box(1.82, 0.47, 0, 0.08, 0.2, 0.64, '#2b211d')
        + faceY(0.47, 0.1, 1.2, `<rect x="18" y="8" width="144" height="36" rx="4" fill="#3a2d27"/><rect x="60" y="12" width="60" height="26" fill="#f4efe2"/><path d="M64,18 h52 M64,23 h52 M64,28 h52 M64,33 h52" stroke="#9aa3ad" stroke-width=".7"/><circle cx="74" cy="23" r="2" fill="#222"/><circle cx="90" cy="28" r="2" fill="#222"/><circle cx="104" cy="20" r="2" fill="#222"/>`)
        + legs4(0.62, 0.8, 0.76, 0.16, 0.4, '#2b211d', 0.05) + box(0.6, 0.78, 0.4, 0.8, 0.2, 0.06, '#3a2d27');
    } },
  { id: 'globe', cat: 'furniture', name: 'Globe', price: 260, fp: [1, 1], hgt: 1.4, desc: 'Turns slowly, all day.',
    draw() {
      return shadow(0.5, 0.5, 0.3) + sprite(0.5, 0.5, 0, `<path d="M-14,4 L0,-22 L14,4 M0,-22 L0,8" stroke="${C.woodD}" stroke-width="2.6" stroke-linecap="round"/><ellipse cx="0" cy="4" rx="14" ry="5" fill="${C.woodD}" opacity=".9"/>`
        + `<g transform="translate(0,-40) scale(.86)"><circle r="17" fill="#3f86c7" stroke="#1e4f7a" stroke-width="1"/><g clip-path="url(#rm-globe-clip)">${anim('rm-drift-globe', `<path d="M-40,-8 c6,-6 14,-4 16,2 c2,6 -6,10 -4,16 c-6,0 -12,-4 -12,-10 Z M-18,-14 c8,-4 12,2 10,8 c-4,2 -10,0 -10,-8 Z M2,-4 c6,-4 14,0 12,8 c-2,6 -10,6 -12,0 Z M-6,8 c4,-2 8,2 6,6 c-4,2 -8,0 -6,-6 Z M20,-10 c6,-2 10,4 6,8 c-4,0 -8,-2 -6,-8 Z M40,-8 c6,-6 14,-4 16,2 c2,6 -6,10 -4,16 c-6,0 -12,-4 -12,-10 Z M62,-14 c8,-4 12,2 10,8 c-4,2 -10,0 -10,-8 Z" fill="#5cb85c"/>`)}</g><circle r="17" fill="url(#rm-sphere)"/><ellipse rx="21" ry="21" fill="none" stroke="${C.gold}" stroke-width="1.6" transform="rotate(-20)"/></g>`);
    } },
  { id: 'telescope', edge: true, cat: 'furniture', name: 'Telescope', price: 480, lvl: 5, fp: [1, 1], hgt: 1.6, desc: 'Pointed at the window, just in case.',
    draw() {
      return shadow(0.5, 0.5, 0.3, 0.18) + sprite(0.5, 0.5, 0, `<path d="M0,-30 L-14,4 M0,-30 L13,3 M0,-30 L2,9" stroke="#3b3f46" stroke-width="2.2" stroke-linecap="round"/><g transform="translate(0,-34) rotate(-28)"><rect x="-26" y="-6" width="46" height="12" rx="3" fill="#e9e4d8" stroke="#8e8574" stroke-width=".8"/><rect x="18" y="-8" width="10" height="16" rx="2" fill="${C.gold}" stroke="#a87b16" stroke-width=".8"/><rect x="-32" y="-3.5" width="8" height="7" rx="1.5" fill="#3b3f46"/><rect x="-6" y="-6" width="4" height="12" fill="${C.gold}"/></g>`);
    } },
  { id: 'fireplace', hug: true, cat: 'furniture', name: 'Fireplace', price: 1100, lvl: 7, fp: [2, 1], hgt: 1.8, desc: 'A real fire, lit all day — warmer at night.', glow: [[1, 0.6, 0.35, 1.6, '#ff9a3c']],
    draw() {
      const st = '#8d8a84';
      const flames = anim('rm-flicker', `<path d="M70,108 C62,92 70,82 74,70 C78,82 86,88 82,108 Z" fill="#ff7a1a"/><path d="M84,108 C80,94 88,86 92,76 C96,88 102,96 96,108 Z" fill="#ffb52e"/><path d="M98,108 C94,96 100,90 104,82 C108,92 112,98 108,108 Z" fill="#ff7a1a"/>`) + anim('rm-flicker', `<path d="M78,108 C76,98 82,92 86,86 C88,94 92,100 88,108 Z" fill="#fff0a8"/>`, -0.4);
      return box(0.05, 0.02, 0, 1.9, 0.45, 1.3, st) + faceY(0.47, 0.05, 1.3, `${Array.from({ length: 7 }, (_, r) => Array.from({ length: 8 }, (_, c) => `<rect x="${c * 24 + (r % 2 ? -12 : 0)}" y="${r * 18.6}" width="23" height="17.6" fill="${(r + c) % 3 ? '#9a968f' : '#86827b'}" opacity=".9"/>`).join('')).join('')}<path d="M52,130 L52,62 Q95,26 138,62 L138,130 Z" fill="#1b120d"/><rect x="62" y="104" width="66" height="7" rx="3" fill="#5a3a22"/><rect x="70" y="100" width="50" height="6" rx="3" fill="#6e4428" transform="rotate(-8 95 103)"/>${flames}`)
        + box(0, 0, 1.3, 2, 0.56, 0.1, C.woodD) + cyl(0.3, 0.3, 1.4, 0.05, 0.18, '#f3ead2') + sprite(0.3, 0.3, 1.58, anim('rm-flicker', '<path d="M0,0 C-2,-3 0,-6 0,-8 C1,-6 3,-3 0,0 Z" fill="#ffb52e"/>')) + cyl(1.72, 0.3, 1.4, 0.05, 0.12, '#f3ead2') + sprite(1.72, 0.3, 1.52, anim('rm-flicker', '<path d="M0,0 C-2,-3 0,-6 0,-8 C1,-6 3,-3 0,0 Z" fill="#ffb52e"/>', -0.3))
        + box(0.9, 0.1, 1.4, 0.3, 0.06, 0.34, C.gold) + faceY(0.16, 0.92, 1.72, '<rect x="2" y="2" width="22" height="28" fill="#5d8fb8"/><path d="M2,26 l8,-10 l6,6 l8,-8 v16 h-22 Z" fill="#4f8a5b"/>');
    } },
  { id: 'recordplayer', hug: true, cat: 'furniture', name: 'Record player', price: 380, lvl: 3, fp: [1, 1], hgt: 1.0, desc: 'The record keeps spinning.',
    draw() {
      return box(0.12, 0.18, 0, 0.76, 0.6, 0.56, C.woodL) + faceY(0.78, 0.12, 0.56, `<rect x="6" y="8" width="30" height="40" rx="3" fill="#2e2a26"/><circle cx="21" cy="28" r="10" fill="#3f3a35" stroke="#1a1714"/><rect x="40" y="8" width="30" height="40" rx="3" fill="#2e2a26"/><circle cx="55" cy="28" r="10" fill="#3f3a35" stroke="#1a1714"/>`)
        + box(0.16, 0.22, 0.56, 0.68, 0.52, 0.07, '#3a3530')
        + onTop(0.2, 0.26, 0.635, `<g transform="translate(28,24)">${anim('rm-spin', '<circle r="22" fill="#15151a"/><circle r="17" fill="none" stroke="#2c2c34" stroke-width="1"/><circle r="12" fill="none" stroke="#2c2c34" stroke-width="1"/><circle r="6" fill="#c0463c"/><rect x="-1" y="-21" width="2" height="8" fill="#55555f" opacity=".8"/>')}</g><path d="M56,6 L60,6 L60,30 L46,40" stroke="#c9ccd2" stroke-width="2" fill="none" stroke-linecap="round"/>`);
    } },
  /* ----- plants ----- */
  { id: 'plant_small', edge: true, cat: 'plants', name: 'Potted plant', price: 40, fp: [1, 1], hgt: 1.0, desc: 'Small, green, forgiving.',
    draw() {
      return shadow(0.5, 0.5, 0.2) + pot(0.5, 0.5, 0.15, 0.24) + sprite(0.5, 0.5, 0.24, anim('rm-sway', `${leafBlob(-8, -8, 4, 10, -40, C.leaf)}${leafBlob(8, -8, 4, 10, 40, C.leafL)}${leafBlob(-4, -14, 4, 11, -15, C.leafL)}${leafBlob(5, -15, 4, 11, 15, C.leaf)}${leafBlob(0, -18, 3.6, 11, 0, C.leafD)}`));
    } },
  { id: 'monstera', edge: true, cat: 'plants', name: 'Monstera', price: 130, fp: [1, 1], hgt: 1.6, desc: 'Big split leaves, big personality.',
    draw() {
      const leaf = (x, y, s, r, c) => `<g transform="translate(${x},${y}) rotate(${r}) scale(${s})"><path d="M0,0 C-10,-4 -14,-16 -8,-26 C-4,-32 4,-32 8,-26 C14,-16 10,-4 0,0 Z" fill="${c}" stroke="${tone(c, -0.35)}" stroke-width=".8"/><path d="M0,-2 L0,-28 M0,-10 L-7,-16 M0,-16 L7,-22 M0,-20 L-6,-25" stroke="${tone(c, -0.3)}" stroke-width="1"/><path d="M-9,-14 l4,1 M9,-12 l-4,0" stroke="${C.white}" stroke-width="1.6" opacity=".25"/></g>`;
      return shadow(0.5, 0.5, 0.26) + pot(0.5, 0.5, 0.2, 0.3, '#e7e1d3') + sprite(0.5, 0.5, 0.3, `<path d="M0,0 C-4,-14 -12,-24 -20,-30 M0,0 C0,-18 2,-30 4,-40 M0,0 C6,-12 14,-18 22,-24" stroke="#3f7a3f" stroke-width="1.6" fill="none"/>` + anim('rm-sway', `${leaf(-20, -28, 0.9, -50, C.leaf)}${leaf(4, -38, 1, 5, C.leafL)}${leaf(22, -22, 0.85, 55, C.leaf)}${leaf(-6, -22, 0.7, -20, C.leafD)}`));
    } },
  { id: 'cactus', edge: true, cat: 'plants', name: 'Cactus', price: 60, fp: [1, 1], hgt: 1.0, desc: 'Needs nothing. Flowers anyway.',
    draw() {
      const g = '#5b9c4f';
      return shadow(0.5, 0.5, 0.2) + pot(0.5, 0.5, 0.14, 0.2, '#d98b5f') + sprite(0.5, 0.5, 0.2, `<rect x="-6" y="-34" width="12" height="36" rx="6" fill="${g}" stroke="${tone(g, -0.35)}" stroke-width=".8"/><path d="M-6,-16 h-6 a4,4 0 0 1 -4,-4 v-8 a3,3 0 0 1 6,0 v6 h4" fill="${g}" stroke="${tone(g, -0.35)}" stroke-width=".8"/><path d="M6,-22 h5 a4,4 0 0 0 4,-4 v-6 a3,3 0 0 0 -6,0 v5 h-3" fill="${g}" stroke="${tone(g, -0.35)}" stroke-width=".8"/><path d="M-2,-30 v24 M2,-28 v24" stroke="${tone(g, 0.25)}" stroke-width=".8"/><circle cx="0" cy="-36" r="3.2" fill="#f06a8a"/><circle cx="0" cy="-36" r="1.2" fill="#ffd166"/>`);
    } },
  { id: 'bonsai', edge: true, cat: 'plants', name: 'Bonsai', price: 260, lvl: 3, fp: [1, 1], hgt: 1.1, desc: 'Patience, shaped like a tree.',
    draw() {
      const pad = (x, y, rx, c) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${rx * 0.55}" fill="${c}" stroke="${tone(c, -0.35)}" stroke-width=".7"/>`;
      return shadow(0.5, 0.5, 0.3) + box(0.25, 0.3, 0, 0.5, 0.4, 0.12, '#3f5f7a') + sprite(0.5, 0.5, 0.12, `<path d="M-2,0 C-4,-8 4,-12 2,-18 C0,-24 -8,-24 -10,-30 M2,-18 C6,-22 12,-22 14,-26" stroke="#6b4a2e" stroke-width="3.2" fill="none" stroke-linecap="round"/>` + anim('rm-sway', `${pad(-11, -32, 11, C.leafD)}${pad(14, -28, 9, C.leaf)}${pad(0, -38, 9, C.leafL)}${pad(-4, -30, 6, C.leaf)}`));
    } },
  { id: 'ficus', edge: true, cat: 'plants', name: 'Tall ficus', price: 170, fp: [1, 1], hgt: 2.2, desc: 'Fills an empty corner.',
    draw() {
      const rnd = mulberry(9); let leaves = '';
      for (let i = 0; i < 26; i++) { const a = rnd() * Math.PI * 2, r = rnd() * 16; leaves += leafBlob(Math.cos(a) * r, -58 + Math.sin(a) * r * 0.9 - rnd() * 14, 3.2, 5.5, rnd() * 180, [C.leaf, C.leafL, C.leafD][i % 3]); }
      return shadow(0.5, 0.5, 0.26) + pot(0.5, 0.5, 0.2, 0.32, '#8a6f5a') + sprite(0.5, 0.5, 0.32, `<path d="M0,0 C-2,-20 4,-36 0,-56 M0,-30 C6,-36 10,-44 12,-52" stroke="#6b4a2e" stroke-width="2.6" fill="none"/>` + anim('rm-sway', leaves));
    } },
  { id: 'flowers', edge: true, cat: 'plants', name: 'Flower vase', price: 90, fp: [1, 1], hgt: 1.0, desc: 'Something bright on the floor.',
    draw() {
      const fl = (x, y, c) => `<circle cx="${x}" cy="${y}" r="4" fill="${c}"/><circle cx="${x}" cy="${y}" r="1.6" fill="#ffd166"/>`;
      return shadow(0.5, 0.5, 0.18) + cyl(0.5, 0.5, 0, 0.1, 0.3, '#7fb3d5', { t: '#a9cfe6' }) + sprite(0.5, 0.5, 0.3, `<path d="M0,0 C-3,-8 -8,-12 -10,-20 M0,0 C0,-10 1,-16 1,-24 M0,0 C3,-8 8,-12 9,-19 M0,0 C-1,-8 -3,-12 -4,-15" stroke="#3f7a3f" stroke-width="1" fill="none"/>` + anim('rm-sway', `${fl(-10, -21, '#f06a8a')}${fl(1, -25, '#ffffff')}${fl(9, -20, '#b18cf0')}${fl(-4, -16, '#ff9f43')}`));
    } },
  /* ----- lights ----- */
  { id: 'floorlamp', edge: true, cat: 'lights', name: 'Floor lamp', price: 90, fp: [1, 1], hgt: 2.0, desc: 'Warm light for the evening.', glow: [[0.5, 0.5, 1.7, 1.3, '#ffd28a']],
    draw() {
      return shadow(0.5, 0.5, 0.18) + cyl(0.5, 0.5, 0, 0.14, 0.03, C.dark) + sprite(0.5, 0.5, 0.03, `<rect x="-1.2" y="-58" width="2.4" height="58" fill="${C.dark}"/><path d="M-12,-56 L12,-56 L8,-72 L-8,-72 Z" fill="#f2e3c0" stroke="#b9a37a" stroke-width=".8"/><ellipse cx="0" cy="-56" rx="12" ry="3" fill="#fff4d6" opacity=".9"/>`);
    } },
  { id: 'lavalamp', edge: true, cat: 'lights', name: 'Lava lamp', price: 160, fp: [1, 1], hgt: 0.9, desc: 'Slow blobs, slow thoughts.', glow: [[0.5, 0.5, 0.5, 0.8, '#ff5fa2']],
    draw() {
      return shadow(0.5, 0.5, 0.16) + sprite(0.5, 0.5, 0, `<path d="M-7,0 L7,0 L5,-8 L-5,-8 Z" fill="#8e96a0"/><path d="M-5,-8 C-8,-18 -6,-30 -3,-36 L3,-36 C6,-30 8,-18 5,-8 Z" fill="#5b2a72" opacity=".9"/><g clip-path="url(#rm-lava-clip)">${anim('rm-lava', '<ellipse cx="-1" cy="-14" rx="4" ry="5" fill="#ff5fa2"/>')}${anim('rm-lava', '<ellipse cx="1.5" cy="-24" rx="3" ry="4" fill="#ff8fc0"/>', -3.5)}</g><path d="M-3,-36 L3,-36 L2,-40 L-2,-40 Z" fill="#8e96a0"/><path d="M-3,-32 C-4,-24 -4,-16 -2,-10" stroke="#fff" stroke-width=".8" opacity=".35" fill="none"/>`);
    } },
  { id: 'candles', cat: 'lights', name: 'Candles', price: 70, fp: [1, 1], hgt: 0.6, desc: 'Three small flames.', glow: [[0.5, 0.5, 0.35, 0.7, '#ffb347']],
    draw() {
      const fl = (d) => anim('rm-flicker', '<path d="M0,0 C-2.4,-3 0,-7 0,-9 C1.2,-7 3,-3 0,0 Z" fill="#ffb52e"/><path d="M0,-1 C-1,-2.5 0,-4.5 0,-5.5 C.6,-4.5 1.4,-2.5 0,-1 Z" fill="#fff3b0"/>', d);
      return shadow(0.5, 0.5, 0.2, 0.15) + cyl(0.38, 0.42, 0, 0.06, 0.3, '#f3ead2') + sprite(0.38, 0.42, 0.3, fl(0)) + cyl(0.6, 0.46, 0, 0.055, 0.2, '#f3ead2') + sprite(0.6, 0.46, 0.2, fl(-0.3)) + cyl(0.46, 0.64, 0, 0.05, 0.13, '#f3ead2') + sprite(0.46, 0.64, 0.13, fl(-0.6));
    } },
  /* ----- animals ----- */
  { id: 'cat', cat: 'animals', name: 'Ginger cat', price: 700, lvl: 3, fp: [1, 1], hgt: 1.0, pet: true, desc: 'Blinks slowly; the tail never stops.', draw() { return shadow(0.5, 0.5, 0.22, 0.25) + sprite(0.5, 0.5, 0, catSprite('#e8954a', '#b8621f')); } },
  { id: 'cat_black', cat: 'animals', name: 'Black cat', price: 700, lvl: 3, fp: [1, 1], hgt: 1.0, pet: true, desc: 'Golden eyes, very serious.', draw() { return shadow(0.5, 0.5, 0.22, 0.25) + sprite(0.5, 0.5, 0, catSprite('#2c2c33', null, '#f2c14e')); } },
  { id: 'dog', cat: 'animals', name: 'Dog', price: 820, lvl: 4, fp: [1, 1], hgt: 0.9, pet: true, desc: 'Naps on its cushion while you work.',
    draw() {
      const b = '#c98a4b', w = '#f3e6cf', bd = tone(b, -0.35);
      return sprite(0.5, 0.5, 0, `<ellipse cx="0" cy="0" rx="26" ry="11" fill="#6e8ef0" stroke="#3d5bb8" stroke-width=".8"/><ellipse cx="0" cy="-2" rx="21" ry="7.5" fill="#8aa3f5"/>`
        + anim('rm-wag', `<path d="M14,-6 C22,-10 26,-16 24,-20" stroke="${b}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`)
        + anim('rm-breathe', `<ellipse cx="2" cy="-7" rx="15" ry="8" fill="${b}" stroke="${bd}" stroke-width=".8"/><ellipse cx="0" cy="-4" rx="9" ry="4" fill="${w}"/>`)
        + `<ellipse cx="-14" cy="-3" rx="5" ry="2.6" fill="${w}" stroke="${bd}" stroke-width=".6"/><ellipse cx="-4" cy="-1" rx="5" ry="2.6" fill="${w}" stroke="${bd}" stroke-width=".6"/>`
        + `<g transform="translate(-16,-11)"><ellipse cx="0" cy="0" rx="8" ry="7" fill="${b}" stroke="${bd}" stroke-width=".8"/><ellipse cx="-5" cy="3" rx="5" ry="3.6" fill="${w}"/><ellipse cx="-8.5" cy="1.6" rx="1.8" ry="1.3" fill="#2a2320"/><path d="M-1,-2 q1.5,1 3,0" stroke="#2a2320" stroke-width=".9" fill="none"/><path d="M3,-6 C8,-6 8,4 5,6 C3,4 2,-2 3,-6 Z" fill="${tone(b, -0.25)}"/></g>`);
    } },
  { id: 'parrot', cat: 'animals', name: 'Parrot', price: 650, lvl: 4, fp: [1, 1], hgt: 1.8, pet: true, desc: 'Bobs its head to your typing.',
    draw() {
      return shadow(0.5, 0.5, 0.22) + sprite(0.5, 0.5, 0, `<ellipse cx="0" cy="2" rx="12" ry="4.5" fill="${C.woodD}"/><rect x="-1.6" y="-56" width="3.2" height="58" fill="${C.woodD}"/><rect x="-16" y="-58" width="32" height="3.4" rx="1.7" fill="${C.woodD}"/>`
        + `<g transform="translate(0,-58)">${anim('rm-bob', `<path d="M4,-2 C8,4 10,14 6,22 C4,16 2,8 2,0 Z" fill="#3f6ea8"/><ellipse cx="0" cy="-10" rx="7" ry="10" fill="#e0403a" stroke="#9e2622" stroke-width=".7"/><path d="M-6,-8 C-9,-2 -6,6 -2,6 C0,0 -1,-6 -6,-8 Z" fill="#3fa34d"/><circle cx="1" cy="-21" r="6" fill="#e0403a" stroke="#9e2622" stroke-width=".7"/><path d="M-4,-22 C-9,-22 -9,-15 -5,-15 C-4,-17 -3,-19 -4,-22 Z" fill="#f3ead2" stroke="#8e8574" stroke-width=".6"/><circle cx="1.5" cy="-22.5" r="2.2" fill="#fff"/><circle cx="1.2" cy="-22.5" r="1.1" fill="#111"/><path d="M4,-26 q3,-3 6,-2" stroke="#ffd166" stroke-width="1.4" fill="none"/>`)}<path d="M-3,0 v3 M3,0 v3" stroke="#6b5a4a" stroke-width="1.4"/></g>`);
    } },
  { id: 'owl', cat: 'animals', name: 'Owl', price: 760, lvl: 5, fp: [1, 1], hgt: 1.7, pet: true, desc: 'Wise, quiet, keeps an eye on the clock.',
    draw() {
      const b = '#8a6a4a';
      return shadow(0.5, 0.5, 0.22) + sprite(0.5, 0.5, 0, `<ellipse cx="0" cy="2" rx="12" ry="4.5" fill="#5b4632"/><path d="M-1.5,2 C-2,-20 2,-36 0,-52" stroke="#5b4632" stroke-width="3.4" fill="none"/><path d="M0,-50 C-8,-52 -16,-50 -20,-54 M0,-50 C8,-51 14,-49 18,-52" stroke="#5b4632" stroke-width="2.6" fill="none" stroke-linecap="round"/>`
        + `<g transform="translate(0,-52)"><ellipse cx="0" cy="-13" rx="11" ry="14" fill="${b}" stroke="${tone(b, -0.4)}" stroke-width=".8"/><ellipse cx="0" cy="-9" rx="7" ry="8.5" fill="#d9c3a0"/><path d="M-4,-8 q2,2 4,0 q2,2 4,0 M-4,-4 q2,2 4,0 q2,2 4,0" stroke="${tone(b, -0.2)}" stroke-width=".8" fill="none"/><path d="M-10,-24 L-8,-31 L-4,-26 Z M10,-24 L8,-31 L4,-26 Z" fill="${b}"/><circle cx="-4.5" cy="-20" r="4.6" fill="#f3ead2"/><circle cx="4.5" cy="-20" r="4.6" fill="#f3ead2"/>`
        + anim('rm-blink', '<circle cx="-4.5" cy="-20" r="2.8" fill="#f2a41c"/><circle cx="4.5" cy="-20" r="2.8" fill="#f2a41c"/><circle cx="-4.5" cy="-20" r="1.4" fill="#111"/><circle cx="4.5" cy="-20" r="1.4" fill="#111"/>')
        + `<path d="M-1.4,-16 L1.4,-16 L0,-13 Z" fill="#e0a03a"/><path d="M-3,1 v2 M3,1 v2" stroke="#e0a03a" stroke-width="1.4"/></g>`);
    } },
  { id: 'rabbit', cat: 'animals', name: 'Rabbit', price: 520, lvl: 3, fp: [1, 1], hgt: 0.9, pet: true, desc: 'Twitches an ear now and then.',
    draw() {
      const w = '#f1ede6', bd = '#b9b2a6';
      return shadow(0.5, 0.5, 0.2, 0.22) + sprite(0.5, 0.5, 0, `<ellipse cx="4" cy="-8" rx="12" ry="9" fill="${w}" stroke="${bd}" stroke-width=".8"/><circle cx="15" cy="-10" r="3.6" fill="#fff" stroke="${bd}" stroke-width=".6"/><ellipse cx="-2" cy="-1" rx="6" ry="2.6" fill="${w}" stroke="${bd}" stroke-width=".6"/>`
        + `<g transform="translate(-6,-16)"><ellipse cx="0" cy="0" rx="7.5" ry="6.5" fill="${w}" stroke="${bd}" stroke-width=".8"/><path d="M-3,-5 C-6,-14 -5,-22 -2,-24 C1,-22 1,-14 -1,-5 Z" fill="${w}" stroke="${bd}" stroke-width=".8"/><path d="M-2.4,-8 C-4,-14 -3.6,-19 -2.2,-21" stroke="#f2b8c0" stroke-width="1.6" fill="none"/>`
        + anim('rm-ear', `<path d="M2,-5 C3,-14 7,-21 10,-22 C12,-19 9,-12 4,-4 Z" fill="${w}" stroke="${bd}" stroke-width=".8"/>`)
        + `<circle cx="-3" cy="-1" r="1.4" fill="#2a2320"/><circle cx="-7" cy="2" r="1.1" fill="#f28c9c"/></g>`);
    } },
  { id: 'fishbowl', cat: 'animals', name: 'Goldfish bowl', price: 280, fp: [1, 1], hgt: 1.2, pet: true, desc: 'One goldfish, many laps.',
    draw() {
      return shadow(0.5, 0.5, 0.22) + legs4(0.34, 0.34, 0.32, 0.32, 0.46, C.woodD, 0.05) + box(0.3, 0.3, 0.46, 0.4, 0.4, 0.04, C.woodL)
        + sprite(0.5, 0.5, 0.5, `<circle cx="0" cy="-14" r="14" fill="#bfe3f2" opacity=".35" stroke="#dff3fb" stroke-width="1"/><g clip-path="url(#rm-bowl)"><rect x="-14" y="-18" width="28" height="18" fill="#4aa8d8" opacity=".55"/>${anim('rm-swim-s', '<g><path d="M-4,-9 c3,-3 7,-3 9,0 c-2,3 -6,3 -9,0 Z" fill="#ff8a3d"/><path d="M-4,-9 l-4,-3 v6 Z" fill="#ff6a1a"/><circle cx="3" cy="-9.5" r=".8" fill="#111"/></g>')}<rect x="-14" y="-4" width="28" height="6" fill="#d9c7a0"/></g><ellipse cx="0" cy="-26" rx="8" ry="2" fill="none" stroke="#dff3fb" stroke-width="1"/><path d="M-8,-20 q-3,6 0,12" stroke="#fff" stroke-width="1.2" opacity=".6" fill="none"/>`);
    } },
  { id: 'aquarium', hug: true, cat: 'animals', name: 'Aquarium', price: 1250, lvl: 6, fp: [2, 1], hgt: 1.5, pet: true, desc: 'Three fish, bubbles and green plants.', glow: [[1, 0.5, 1, 1, '#5ec8f0']],
    draw() {
      const t = 0.55, H = 0.72; const fish = (c, d, y) => anim('rm-swim', `<g transform="translate(0,${y})"><path d="M0,0 c4,-4 10,-4 13,0 c-3,4 -9,4 -13,0 Z" fill="${c}"/><path d="M0,0 l-5,-4 v8 Z" fill="${tone(c, -0.2)}"/><circle cx="9.5" cy="-.6" r=".9" fill="#111"/></g>`, d);
      return box(0.1, 0.1, 0, 1.8, 0.7, t, '#3a2d27') + box(0.1, 0.1, t, 1.8, 0.7, H, '#4aa8d8', { l: 'rgba(74,168,216,.55)', r: 'rgba(52,130,170,.6)', t: 'rgba(160,220,245,.55)', line: false })
        + faceY(0.8, 0.1, t + H, `<rect x="0" y="0" width="180" height="${H * 100}" fill="url(#rm-water)"/><rect x="0" y="${H * 100 - 10}" width="180" height="10" fill="#d9c7a0"/><path d="M20,${H * 100 - 8} C16,50 26,40 20,24 M26,${H * 100 - 8} C30,48 22,40 28,28 M150,${H * 100 - 8} C146,46 156,40 150,20 M158,${H * 100 - 8} C162,52 154,44 160,34" stroke="#3fa34d" stroke-width="3" fill="none" stroke-linecap="round"/><g transform="translate(40,0)">${fish('#ff8a3d', 0, 24)}${fish('#f2c14e', -3, 40)}${fish('#6ec1ff', -6, 54)}</g>${anim('rm-rise', '<circle cx="120" cy="60" r="2" fill="#fff" opacity=".7"/><circle cx="124" cy="48" r="1.4" fill="#fff" opacity=".6"/>')}${anim('rm-rise', '<circle cx="70" cy="62" r="1.6" fill="#fff" opacity=".6"/>', -1.5)}`)
        + box(0.08, 0.08, t + H, 1.84, 0.74, 0.05, '#2b2b30') + poly([[0.1, 0.8, t], [1.9, 0.8, t], [1.9, 0.8, t + H], [0.1, 0.8, t + H]], 'none', ' stroke="#dff3fb" stroke-width="1" opacity=".6"');
    } },
  /* ----- decor ----- */
  { id: 'rug_round', cat: 'decor', name: 'Round rug', price: 150, fp: [2, 2], flat: true, hgt: 0.2, desc: 'Soft rings under your feet.',
    draw() { return onTop(0, 0, 0.004, `<circle cx="100" cy="100" r="96" fill="#b45a4a"/><circle cx="100" cy="100" r="84" fill="none" stroke="#e8c86a" stroke-width="6"/><circle cx="100" cy="100" r="62" fill="#c8735f"/><circle cx="100" cy="100" r="44" fill="none" stroke="#f3ead2" stroke-width="4" stroke-dasharray="8 6"/><circle cx="100" cy="100" r="22" fill="#e8c86a"/>`); } },
  { id: 'rug_rect', cat: 'decor', name: 'Patterned rug', price: 230, fp: [3, 2], flat: true, hgt: 0.2, desc: 'A big rug to anchor the room.',
    draw() { let p = ''; for (let i = 0; i < 6; i++) p += `<path d="M${30 + i * 42},100 l18,-26 l18,26 l-18,26 Z" fill="${i % 2 ? '#e8c86a' : '#f3ead2'}" opacity=".9"/>`; return onTop(0, 0, 0.004, `<rect x="6" y="6" width="288" height="188" rx="6" fill="#2f5d7c"/><rect x="18" y="18" width="264" height="164" fill="none" stroke="#e8c86a" stroke-width="5"/><rect x="30" y="30" width="240" height="140" fill="#3a7196"/>${p}`); } },
  { id: 'zafu', cat: 'decor', name: 'Meditation cushion', price: 110, fp: [1, 1], hgt: 0.5, desc: 'For the breathing sessions.',
    draw() { return onTop(0.08, 0.08, 0.004, '<rect x="0" y="0" width="84" height="84" rx="6" fill="#2f3f6e"/><rect x="6" y="6" width="72" height="72" rx="4" fill="none" stroke="#6e8ef0" stroke-width="2"/>') + cyl(0.5, 0.5, 0.02, 0.26, 0.14, '#6e5bb8') + sprite(0.5, 0.5, 0.16, '<path d="M-10,0 q10,-4 20,0" stroke="#9f8ce8" stroke-width="1.4" fill="none"/>'); } },
  { id: 'fountain', cat: 'decor', name: 'Zen fountain', price: 420, lvl: 4, fp: [1, 1], hgt: 1.0, desc: 'Water over stones, on repeat.',
    draw() {
      return shadow(0.5, 0.5, 0.34) + cyl(0.5, 0.5, 0, 0.32, 0.16, '#7b7f86') + `<ellipse cx="${f1(isoX(0.5, 0.5))}" cy="${f1(isoY(0.5, 0.5, 0.16))}" rx="${f1(0.27 * ISO.TW / Math.SQRT2)}" ry="${f1(0.27 * ISO.TH / Math.SQRT2)}" fill="#5ab4d8"/>`
        + sprite(0.5, 0.5, 0.16, `<ellipse cx="0" cy="-3" rx="9" ry="5" fill="#8d9096" stroke="#5f6268" stroke-width=".7"/><ellipse cx="1" cy="-10" rx="7" ry="4" fill="#9ea1a7" stroke="#5f6268" stroke-width=".7"/><ellipse cx="0" cy="-16" rx="5" ry="3" fill="#b0b3b8" stroke="#5f6268" stroke-width=".7"/><rect x="-1" y="-24" width="2.4" height="8" fill="#6b4a2e"/>${anim('rm-drip', '<circle cx="0.2" cy="-16" r="1.2" fill="#9fdcf5"/>')}${anim('rm-ripple', '<ellipse cx="0" cy="2" rx="6" ry="2" fill="none" stroke="#dff3fb" stroke-width=".8"/>')}`);
    } },
  { id: 'bookstack', edge: true, cat: 'decor', name: 'Stack of books', price: 50, fp: [1, 1], hgt: 0.7, desc: 'The next ones to read.',
    draw() { return shadow(0.5, 0.5, 0.28, 0.16) + box(0.22, 0.26, 0, 0.56, 0.44, 0.08, '#b5483f') + box(0.26, 0.24, 0.08, 0.5, 0.42, 0.07, '#3f6ea8') + box(0.2, 0.3, 0.15, 0.54, 0.4, 0.09, '#4f8a5b') + box(0.28, 0.26, 0.24, 0.46, 0.4, 0.06, '#d4a23a') + box(0.24, 0.3, 0.3, 0.5, 0.38, 0.08, '#7d5aa6'); } },
  { id: 'kingstatue', edge: true, cat: 'decor', name: 'King statue', price: 880, lvl: 6, fp: [1, 1], hgt: 2.0, desc: 'A tall marble king on a plinth.',
    draw() {
      const m = '#ece8df', md = '#b9b3a6';
      return box(0.18, 0.18, 0, 0.64, 0.64, 0.5, '#5b5f66') + sprite(0.5, 0.5, 0.5, `<path d="M-14,0 L14,0 L12,-6 L-12,-6 Z" fill="${m}" stroke="${md}" stroke-width=".8"/><path d="M-11,-6 C-9,-14 -7,-22 -6,-34 L6,-34 C7,-22 9,-14 11,-6 Z" fill="${m}" stroke="${md}" stroke-width=".8"/><ellipse cx="0" cy="-35" rx="9" ry="3" fill="${m}" stroke="${md}" stroke-width=".8"/><path d="M-7,-37 C-9,-44 -6,-50 0,-52 C6,-50 9,-44 7,-37 Z" fill="${m}" stroke="${md}" stroke-width=".8"/><rect x="-1.6" y="-62" width="3.2" height="10" fill="${C.gold}"/><rect x="-4.6" y="-59" width="9.2" height="3" fill="${C.gold}"/><path d="M-3,-30 C-2,-20 -3,-12 -5,-8" stroke="#fff" stroke-width="1.4" opacity=".5" fill="none"/>`);
    } },
  { id: 'guitar', edge: true, cat: 'decor', name: 'Guitar on a stand', price: 340, fp: [1, 1], hgt: 1.5, desc: 'For the long breaks.',
    draw() {
      return shadow(0.5, 0.5, 0.2, 0.18) + sprite(0.5, 0.5, 0, `<path d="M-8,4 L0,-10 L8,4" stroke="${C.dark}" stroke-width="2" fill="none"/><g transform="rotate(-8)"><path d="M0,-14 C-12,-14 -13,-24 -8,-28 C-12,-33 -10,-40 0,-40 C10,-40 12,-33 8,-28 C13,-24 12,-14 0,-14 Z" fill="#c98a4b" stroke="#7a4b2a" stroke-width=".9"/><circle cx="0" cy="-27" r="3.6" fill="#3a2418"/><rect x="-1.8" y="-70" width="3.6" height="32" fill="#5b3620"/><rect x="-3" y="-76" width="6" height="7" rx="1.5" fill="#3a2418"/><path d="M-.8,-70 V-18 M.8,-70 V-18" stroke="#e8e0cc" stroke-width=".4"/></g>`);
    } },
  { id: 'coffee', hug: true, cat: 'decor', name: 'Coffee corner', price: 300, fp: [1, 1], hgt: 1.3, desc: 'Espresso machine, steam included.',
    draw() {
      return box(0.12, 0.12, 0, 0.76, 0.62, 0.74, '#e9e4d8') + faceY(0.74, 0.12, 0.74, `<rect x="6" y="8" width="64" height="58" rx="3" fill="none" stroke="#c9c2b2"/><rect x="34" y="30" width="10" height="3" rx="1.5" fill="#8e96a0"/>`)
        + box(0.22, 0.18, 0.74, 0.44, 0.34, 0.36, '#3b3f46') + faceY(0.52, 0.22, 1.1, '<rect x="6" y="6" width="32" height="10" rx="2" fill="#8bc34a" opacity=".85"/><rect x="14" y="20" width="16" height="4" fill="#9aa3ad"/>')
        + cyl(0.46, 0.66, 0.74, 0.06, 0.08, C.white) + sprite(0.46, 0.66, 0.9, anim('rm-rise', '<path d="M0,0 c-3,-4 3,-6 0,-10 c-3,-4 3,-6 0,-10" stroke="#fff" stroke-width="1.4" fill="none" opacity=".6"/>'));
    } },
  /* ----- on the wall (flat drawings, w × h in tiles) ----- */
  { id: 'window', cat: 'wall', name: 'Window', price: 320, wall: [2, 1.3], desc: 'The sky follows the real time of day.', glow: 'window',
    draw(o) {
      const s = skyAt(o.now); const W = 200, H = 130;
      return `<rect x="0" y="0" width="${W}" height="${H}" rx="4" fill="#f3ead2"/><g clip-path="url(#rm-window-clip)"><rect x="10" y="10" width="${W - 20}" height="${H - 20}" fill="url(#rm-sky-${s.key})"/>`
        + (s.key === 'night' ? `${Array.from({ length: 14 }, (_, i) => `<circle cx="${18 + ((i * 37) % 160)}" cy="${16 + ((i * 23) % 60)}" r="${i % 3 ? 0.9 : 1.4}" fill="#fff" opacity=".85"/>`).join('')}<circle cx="150" cy="34" r="11" fill="#f5f0dc"/><circle cx="155" cy="30" r="10" fill="#1a2440"/>` : `<circle cx="${s.key === 'dusk' ? 60 : 150}" cy="${s.key === 'dusk' ? 84 : 34}" r="12" fill="${s.key === 'dusk' ? '#ffb070' : '#fff2b0'}"/>` + anim('rm-drift', `<g opacity=".9"><ellipse cx="40" cy="36" rx="16" ry="6" fill="#fff"/><ellipse cx="52" cy="32" rx="10" ry="6" fill="#fff"/><ellipse cx="130" cy="58" rx="14" ry="5" fill="#fff" opacity=".8"/></g>`))
        + `<path d="M10,${H - 10} L10,96 Q50,78 90,92 T190,86 L190,${H - 10} Z" fill="${s.hill}"/><path d="M10,${H - 10} L10,104 Q70,94 120,104 T190,100 L190,${H - 10} Z" fill="${tone(s.hill, -0.15)}"/></g>`
        + `<rect x="${W / 2 - 3}" y="10" width="6" height="${H - 20}" fill="#f3ead2"/><rect x="10" y="${H / 2 - 3}" width="${W - 20}" height="6" fill="#f3ead2"/><rect x="-4" y="${H - 6}" width="${W + 8}" height="10" rx="2" fill="#d9ccb0"/>`
        + `<path d="M-6,-4 C10,30 6,90 -6,${H} L-16,${H} L-16,-4 Z" fill="#b0574a" opacity=".95"/><path d="M${W + 6},-4 C${W - 10},30 ${W - 6},90 ${W + 6},${H} L${W + 16},${H} L${W + 16},-4 Z" fill="#b0574a" opacity=".95"/><rect x="-18" y="-10" width="${W + 36}" height="6" rx="3" fill="${C.woodD}"/>`;
    } },
  { id: 'painting', cat: 'wall', name: 'Landscape painting', price: 150, wall: [1.2, 0.9], desc: 'Mountains at dawn.',
    draw() { return '<rect x="0" y="0" width="120" height="90" rx="3" fill="#b8862f"/><rect x="7" y="7" width="106" height="76" fill="#f7d9a8"/><circle cx="84" cy="30" r="9" fill="#ff9f68"/><path d="M7,70 L36,34 L54,56 L74,28 L113,70 V83 H7 Z" fill="#5b7fa6"/><path d="M36,34 l-6,8 h12 Z M74,28 l-7,9 h14 Z" fill="#fff"/><path d="M7,76 Q60,64 113,76 V83 H7 Z" fill="#4f8a5b"/>'; } },
  { id: 'diploma', cat: 'wall', name: 'Framed certificate', price: 120, wall: [0.8, 1.0], desc: 'Proof of all those hours.',
    draw() { return '<rect x="0" y="0" width="80" height="100" rx="2" fill="#3a2418"/><rect x="6" y="6" width="68" height="88" fill="#f7f1e1"/><text x="40" y="26" font-size="9" text-anchor="middle" fill="#6b4a1e" font-family="Georgia,serif" font-weight="700">CERTIFICATE</text><path d="M16,40 h48 M16,48 h48 M16,56 h36" stroke="#b9a37a" stroke-width="1.4"/><circle cx="56" cy="76" r="9" fill="#c0463c"/><path d="M50,82 l-3,12 l6,-4 l3,5 M62,82 l3,12 l-6,-4 l-3,5" fill="#c0463c"/><circle cx="56" cy="76" r="5" fill="none" stroke="#f2c14e" stroke-width="1.2"/>'; } },
  { id: 'wallclock', cat: 'wall', name: 'Wall clock', price: 180, wall: [0.8, 0.8], desc: 'Shows the real time.',
    draw(o) { return `<circle cx="40" cy="40" r="38" fill="#2f3440"/><circle cx="40" cy="40" r="33" fill="#f7f4ec"/>${Array.from({ length: 12 }, (_, i) => `<line x1="40" y1="10" x2="40" y2="${i % 3 ? 14 : 17}" stroke="#2f3440" stroke-width="${i % 3 ? 1.4 : 2.6}" transform="rotate(${i * 30} 40 40)"/>`).join('')}${clockHands(40, 40, 18, 26, 3.4, 2, '#2f3440', o.now)}<circle cx="40" cy="40" r="2.6" fill="#c0463c"/>`; } },
  { id: 'shelf_plants', cat: 'wall', name: 'Plant shelf', price: 160, wall: [2, 0.7], desc: 'Three pots and a trailing ivy.',
    draw() { const potx = (x, c) => `<path d="M${x - 9},40 L${x + 9},40 L${x + 7},58 L${x - 7},58 Z" fill="${c}"/>`; const ivy = (x) => `<path d="M${x},40 C${x - 6},54 ${x + 4},62 ${x - 2},74" stroke="#3f7a3f" stroke-width="1.4" fill="none"/>${[46, 54, 62, 70].map((y, i) => `<ellipse cx="${x + (i % 2 ? 3 : -4)}" cy="${y}" rx="3.2" ry="2.2" fill="${i % 2 ? C.leafL : C.leaf}"/>`).join('')}`;
      return `<rect x="0" y="58" width="200" height="8" rx="2" fill="${C.woodL}"/><path d="M14,66 v6 M186,66 v6" stroke="${C.woodD}" stroke-width="3"/>${potx(40, C.terra)}${potx(100, '#e7e1d3')}${potx(160, '#5a8fb5')}${leafBlob(34, 32, 4, 9, -30, C.leaf)}${leafBlob(46, 32, 4, 9, 30, C.leafL)}${leafBlob(40, 28, 3.6, 10, 0, C.leafD)}<rect x="95" y="18" width="10" height="24" rx="5" fill="#5b9c4f"/>${leafBlob(154, 32, 4, 8, -40, C.leafL)}${leafBlob(166, 32, 4, 8, 40, C.leaf)}${ivy(160)}`; } },
  { id: 'shelf_books', cat: 'wall', name: 'Book shelf', price: 140, wall: [2, 0.7], desc: 'The classics, within reach.',
    draw() { return `<rect x="0" y="58" width="200" height="8" rx="2" fill="${C.woodD}"/><path d="M14,66 v6 M186,66 v6" stroke="${C.woodD}" stroke-width="3"/>${bookRow(8, 150, 58, 40, 77)}<g transform="translate(170,58)"><rect x="-8" y="-4" width="16" height="4" fill="#6b4a1e"/><path d="M-2,-4 h4 v-6 h-4 Z" fill="${C.gold}"/><path d="M-9,-24 h18 c0,9 -4,13 -9,13 c-5,0 -9,-4 -9,-13 Z" fill="${C.gold}"/></g>`; } },
  { id: 'neon', cat: 'wall', name: 'Neon sign', price: 450, lvl: 5, wall: [2, 0.7], desc: 'FOCUS, in pink light.', glow: [[0, 0, 0, 1.2, '#ff5fa2']],
    draw() { return anim('rm-neon', '<rect x="4" y="6" width="192" height="58" rx="10" fill="#1a1022" opacity=".85"/><text x="100" y="48" font-size="34" text-anchor="middle" fill="none" stroke="#ff5fa2" stroke-width="3" font-family="system-ui, sans-serif" font-weight="800" letter-spacing="6" filter="url(#rm-neon)">FOCUS</text><text x="100" y="48" font-size="34" text-anchor="middle" fill="none" stroke="#ffd1e6" stroke-width="1" font-family="system-ui, sans-serif" font-weight="800" letter-spacing="6">FOCUS</text>'); } },
  { id: 'mirror', cat: 'wall', name: 'Round mirror', price: 200, wall: [0.8, 1.1], desc: 'Checks your posture.',
    draw() { return '<ellipse cx="40" cy="55" rx="38" ry="53" fill="#b8862f"/><ellipse cx="40" cy="55" rx="32" ry="47" fill="url(#rm-mirror)"/><path d="M22,30 L34,18 M22,44 L44,22" stroke="#fff" stroke-width="3" opacity=".45" stroke-linecap="round"/>'; } },
  { id: 'calendar', cat: 'wall', name: 'Wall calendar', price: 90, wall: [0.7, 0.9], desc: 'Always on today’s date.',
    draw(o) { const d = o.now; return `<rect x="0" y="4" width="70" height="86" rx="3" fill="#fbf8f0" stroke="#c9c2b2"/><rect x="0" y="4" width="70" height="22" rx="3" fill="#c0463c"/><circle cx="18" cy="4" r="3" fill="#555"/><circle cx="52" cy="4" r="3" fill="#555"/><text x="35" y="20" font-size="11" text-anchor="middle" fill="#fff" font-family="system-ui" font-weight="700">${MON[d.getMonth()].toUpperCase()}</text><text x="35" y="64" font-size="32" text-anchor="middle" fill="#2f3440" font-family="system-ui" font-weight="800">${d.getDate()}</text><text x="35" y="81" font-size="9" text-anchor="middle" fill="#8e8574" font-family="system-ui">${WD[d.getDay()].toUpperCase()}</text>`; } },
  { id: 'medals', cat: 'wall', name: 'Medal board', price: 260, wall: [1.2, 0.9], desc: 'One medal for each achievement (up to 15).',
    draw(o) { const n = Math.min(15, o.achievements || 0); let m = ''; for (let i = 0; i < n; i++) { const x = 16 + (i % 5) * 22, y = 18 + Math.floor(i / 5) * 24; const c = ['#e8b93c', '#c9ccd2', '#c98a4b'][i % 3]; m += `<path d="M${x - 3},${y - 10} L${x},${y - 3} L${x + 3},${y - 10}" stroke="#c0463c" stroke-width="3" fill="none"/><circle cx="${x}" cy="${y}" r="6" fill="${c}" stroke="${tone(c, -0.4)}"/>`; } return `<rect x="0" y="0" width="120" height="90" rx="3" fill="#2f5d4f"/><rect x="5" y="5" width="110" height="80" fill="none" stroke="${C.gold}" stroke-width="1.4"/>${m || '<text x="60" y="50" font-size="10" text-anchor="middle" fill="#cfe3d9" font-family="system-ui">medals go here</text>'}`; } },
  { id: 'stringlights', cat: 'wall', name: 'String lights', price: 140, wall: [2.4, 0.5], desc: 'Twinkle along the wall.', glow: [[0, 0, 0, 1.3, '#ffe08a']],
    draw() { let b = ''; for (let i = 0; i < 12; i++) { const x = 8 + i * 20; const y = 14 + Math.sin((i / 11) * Math.PI) * 18; b += anim('rm-twinkle', `<circle cx="${x}" cy="${y + 5}" r="3.6" fill="${['#ffe08a', '#ff9fb2', '#9fe0ff', '#b7f59f'][i % 4]}"/>`, -(i % 5) * 0.4); } return `<path d="M0,10 Q120,52 240,10" stroke="#3b3f46" stroke-width="1.2" fill="none"/>${b}`; } },
];

/* Walls and floors: one of each is applied at a time. */
const ROOM_STYLES = [
  { id: 'wall_sand', kind: 'wall', name: 'Sand walls', price: 0, a: '#e3d2b4', b: '#d2bf9d' },
  { id: 'wall_sage', kind: 'wall', name: 'Sage walls', price: 200, a: '#b7c6ae', b: '#a3b499' },
  { id: 'wall_navy', kind: 'wall', name: 'Navy walls', price: 250, a: '#34476b', b: '#2b3b5a' },
  { id: 'wall_stripes', kind: 'wall', name: 'Striped wallpaper', price: 320, a: '#e9dcc3', b: '#d9c7a4', pattern: 'stripes' },
  { id: 'wall_brick', kind: 'wall', name: 'Brick', price: 450, lvl: 3, a: '#a65a44', b: '#8f4b38', pattern: 'brick' },
  { id: 'wall_panel', kind: 'wall', name: 'Wood panels', price: 520, lvl: 4, a: '#e6d9c2', b: '#d6c6aa', pattern: 'panel' },
  { id: 'wall_night', kind: 'wall', name: 'Starry night', price: 480, lvl: 5, a: '#1f2a4a', b: '#18213b', pattern: 'stars' },
  { id: 'floor_oak', kind: 'floor', name: 'Oak planks', price: 0, a: '#c08a57', b: '#b17c4a', pattern: 'planks' },
  { id: 'floor_walnut', kind: 'floor', name: 'Walnut planks', price: 200, a: '#7a4e31', b: '#6d442a', pattern: 'planks' },
  { id: 'floor_carpet', kind: 'floor', name: 'Soft carpet', price: 250, a: '#8c9aa8', b: '#8c9aa8', pattern: 'carpet' },
  { id: 'floor_tatami', kind: 'floor', name: 'Tatami', price: 420, lvl: 3, a: '#cdbf86', b: '#c2b378', pattern: 'tatami' },
  { id: 'floor_checker', kind: 'floor', name: 'Chessboard floor', price: 560, lvl: 4, a: '#eadbc0', b: '#5e4632', pattern: 'checker' },
  { id: 'floor_marble', kind: 'floor', name: 'Marble', price: 650, lvl: 6, a: '#e9e7e3', b: '#d9d6d0', pattern: 'marble' },
];
const roomItem = (id) => ROOM_ITEMS.find((x) => x.id === id) || null;
const roomStyle = (id) => ROOM_STYLES.find((x) => x.id === id) || null;

/* Sky by the real time of day (for the window and the room's light). */
function skyAt(d) {
  const hr = d.getHours() + d.getMinutes() / 60;
  if (hr >= 20 || hr < 5.5) return { key: 'night', hill: '#1d3a2e' };
  if (hr >= 17.3 || hr < 7) return { key: 'dusk', hill: '#5c6b3e' };
  return { key: 'day', hill: '#6fae5c' };
}
function roomNight(d) { const hr = d.getHours() + d.getMinutes() / 60; return hr < 5 ? 1 : hr < 7 ? 1 - (hr - 5) / 2 : hr < 17.5 ? 0 : hr < 20 ? (hr - 17.5) / 2.5 : 1; }

/* Shared gradients and filters, defined once in the document so every room and preview can use them. */
function ensureRoomDefs() {
  if (document.getElementById('rm-defs')) return;
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  el.setAttribute('id', 'rm-defs'); el.setAttribute('width', '0'); el.setAttribute('height', '0'); el.setAttribute('aria-hidden', 'true');
  el.style.position = 'absolute'; el.style.width = '0'; el.style.height = '0'; el.style.overflow = 'hidden';
  el.innerHTML = `<defs>
    <filter id="rm-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter>
    <filter id="rm-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="10"/></filter>
    <filter id="rm-neon" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <linearGradient id="rm-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8f6ff" stop-opacity=".55"/><stop offset=".5" stop-color="#bfe3f2" stop-opacity=".12"/><stop offset="1" stop-color="#e8f6ff" stop-opacity=".35"/></linearGradient>
    <linearGradient id="rm-screen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d3a5f" stop-opacity=".9"/><stop offset="1" stop-color="#0f1b2d" stop-opacity="0"/></linearGradient>
    <linearGradient id="rm-water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fd0f0" stop-opacity=".55"/><stop offset="1" stop-color="#2f86b5" stop-opacity=".75"/></linearGradient>
    <radialGradient id="rm-sphere" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient>
    <linearGradient id="rm-mirror" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#dfeef5"/><stop offset=".6" stop-color="#a9c3d1"/><stop offset="1" stop-color="#7f9aab"/></linearGradient>
    <linearGradient id="rm-sky-day" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fb7ea"/><stop offset="1" stop-color="#cdeafc"/></linearGradient>
    <linearGradient id="rm-sky-dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a5aa0"/><stop offset=".55" stop-color="#e98a7a"/><stop offset="1" stop-color="#ffc98a"/></linearGradient>
    <linearGradient id="rm-sky-night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1430"/><stop offset="1" stop-color="#1a2a55"/></linearGradient>
    <clipPath id="rm-globe-clip"><circle r="17"/></clipPath>
    <clipPath id="rm-lava-clip"><path d="M-5,-8 C-8,-18 -6,-30 -3,-36 L3,-36 C6,-30 8,-18 5,-8 Z"/></clipPath>
    <clipPath id="rm-bowl"><circle cx="0" cy="-14" r="13"/></clipPath>
    <clipPath id="rm-window-clip"><rect x="10" y="10" width="180" height="110"/></clipPath>
    <radialGradient id="rm-glowgrad"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  </defs>`;
  document.body.append(el);
}
