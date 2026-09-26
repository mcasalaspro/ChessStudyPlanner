/* ===== More walls and floors (each new room has its own look; all of them can be bought for any room) =====
   Repeating designs are SVG patterns, drawn once by the browser however big the room is. */
const hash01 = (n) => { let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
function patDef(key, w, hh, content) { return roomDefOnce(`rm-pat-${key}`, `<pattern patternUnits="userSpaceOnUse" width="${w}" height="${hh}">${content}</pattern>`); }
const floorRect = (id) => onTop(0, 0, 0, `<rect x="0" y="0" width="${ISO.N * 100}" height="${ISO.N * 100}" fill="url(#${id})"/>`);

Object.assign(WALL_PATTERNS, {
  plain: () => '',
  /* dark paint above, wood panelling below, a rail between */
  wainscot: ({ W, H, st }) => { const c = st.c || '#6e4428', cd = tone(c, -0.25); let s = `<rect x="0" y="${H - 125}" width="${W}" height="125" fill="${c}"/><rect x="0" y="${H - 131}" width="${W}" height="8" fill="${tone(c, 0.12)}"/><rect x="0" y="${H - 124}" width="${W}" height="2" fill="${cd}"/>`; for (let x = 12; x < W; x += 66) s += `<rect x="${x}" y="${H - 112}" width="52" height="88" rx="3" fill="none" stroke="${cd}" stroke-width="3"/><rect x="${x + 5}" y="${H - 107}" width="42" height="78" rx="2" fill="${tone(c, 0.06)}" opacity=".5"/>`; if (st.rail !== false) s += `<rect x="0" y="34" width="${W}" height="4" fill="${tone(st.a, -0.25)}" opacity=".7"/>`; return s; },
  shoji: ({ W, H, st }) => { const fr = st.c || '#5b3620'; let s = `<rect x="0" y="${H - 70}" width="${W}" height="70" fill="${tone(fr, 0.15)}"/>`; for (let x = 0; x <= W; x += 100) s += `<rect x="${x - 4}" y="0" width="8" height="${H}" fill="${fr}"/>`; for (let x = 0; x < W; x += 100) for (let y = 20; y < H - 70; y += 44) s += `<rect x="${x}" y="${y}" width="100" height="3" fill="${fr}" opacity=".85"/>`; for (let x = 50; x < W; x += 100) s += `<rect x="${x - 1.5}" y="0" width="3" height="${H - 70}" fill="${fr}" opacity=".8"/>`; s += `<rect x="0" y="${H - 72}" width="${W}" height="6" fill="${fr}"/>`; return s; },
  gallery: ({ W, H, base }) => `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#rm-shaft)" opacity=".18"/><rect x="0" y="26" width="${W}" height="3" fill="${tone(base, -0.18)}"/><rect x="0" y="29" width="${W}" height="1.4" fill="#fff" opacity=".6"/>`,
  /* the winter garden: glass panes with the real sky behind, on a low brick wall */
  glass: ({ W, H, ctx }) => {
    const sky = skyAt(ctx.now); let s = `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#rm-sky-${sky.key})"/>`;
    if (sky.key === 'night') { const rnd = mulberry(5); for (let i = 0; i < W / 14; i++) s += `<circle cx="${f1(rnd() * W)}" cy="${f1(rnd() * (H - 100))}" r="${f1(0.6 + rnd())}" fill="#fff" opacity=".8"/>`; }
    else s += anim('rm-drift', `<g opacity=".85"><ellipse cx="${W * 0.2}" cy="60" rx="34" ry="11" fill="#fff"/><ellipse cx="${W * 0.2 + 22}" cy="52" rx="20" ry="11" fill="#fff"/><ellipse cx="${W * 0.62}" cy="96" rx="28" ry="9" fill="#fff" opacity=".8"/></g>`);
    s += `<path d="M0,${H - 96} Q${W * 0.25},${H - 132} ${W * 0.5},${H - 104} T${W},${H - 112} L${W},${H - 80} L0,${H - 80} Z" fill="${sky.key === 'night' ? '#1d3a2e' : '#6fae5c'}" opacity=".9"/>`;
    s += `<rect x="0" y="0" width="${W}" height="${H}" fill="#e8f6ff" opacity=".12"/>`;
    for (let x = 0; x <= W; x += 100) s += `<rect x="${x - 3.5}" y="0" width="7" height="${H}" fill="#e9efe6"/>`;
    for (let y = 0; y < H - 80; y += 76) s += `<rect x="0" y="${y}" width="${W}" height="5" fill="#e9efe6"/>`;
    s += `<path d="M20,20 L70,20 L24,90 Z" fill="#fff" opacity=".1"/>`;
    s += `<rect x="0" y="${H - 84}" width="${W}" height="84" fill="#a65a44"/>`; for (let r = 0; r < 5; r++) for (let x = (r % 2) * 22; x < W; x += 44) s += `<rect x="${x + 1}" y="${H - 82 + r * 16}" width="41" height="14" fill="${r % 2 ? '#b0634b' : '#9c523d'}"/>`;
    return s;
  },
  arcade: ({ W, H }) => { let s = ''; for (let x = 0; x < W; x += 40) s += `<rect x="${x}" y="0" width="1.4" height="${H}" fill="#fff" opacity=".04"/>`; s += `<rect x="0" y="${H * 0.46}" width="${W}" height="5" fill="#ff5fa2"/><rect x="0" y="${H * 0.46 + 12}" width="${W}" height="3" fill="#5ee0f0"/>`; for (let x = 0; x < W; x += 20) s += `<rect x="${x}" y="${H - 58}" width="10" height="10" fill="#fff" opacity=".1"/><rect x="${x + 10}" y="${H - 48}" width="10" height="10" fill="#fff" opacity=".1"/>`; return s; },
  damask: ({ W, H, base, st }) => `<rect width="${W}" height="${H}" fill="url(#${patDef(st.id, 60, 80, `<path d="M30,6 C40,18 44,30 30,40 C16,30 20,18 30,6 Z M30,40 C42,50 42,66 30,74 C18,66 18,50 30,40 Z M0,40 C8,46 8,56 0,62 M60,40 C52,46 52,56 60,62" fill="${tone(base, st.dark ? 0.1 : -0.1)}"/><circle cx="30" cy="40" r="3" fill="${tone(base, st.dark ? 0.16 : -0.16)}"/>`)})"/>`,
  floral: ({ W, H, base, st }) => `<rect width="${W}" height="${H}" fill="url(#${patDef(st.id, 70, 70, [[18, 18], [53, 53]].map(([x, y]) => `<g transform="translate(${x},${y})">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-5" rx="3.2" ry="5.2" transform="rotate(${a})" fill="${st.c || '#e89aa8'}"/>`).join('')}<circle r="2.4" fill="${st.c2 || '#f2c14e'}"/></g>`).join('') + `<path d="M40,16 q6,4 2,10 M10,50 q-5,5 0,9" stroke="${st.leaf || '#6c9a5a'}" stroke-width="2" fill="none"/>`)})"/>`,
  geo: ({ W, H, base, st }) => `<rect width="${W}" height="${H}" fill="url(#${patDef(st.id, 60, 52, `<path d="M0,52 L30,0 L60,52 Z" fill="${tone(base, -0.08)}"/><path d="M30,0 L60,52 L60,0 Z" fill="${st.c || tone(base, 0.08)}" opacity=".7"/>`)})"/>`,
  subway: ({ W, H, base, st }) => `<rect width="${W}" height="${H}" fill="url(#${patDef(st.id, 40, 40, `<rect width="40" height="40" fill="${st.grout || tone(base, -0.12)}"/><rect x="1" y="1" width="38" height="18" rx="1.5" fill="${base}"/><rect x="-19" y="21" width="38" height="18" rx="1.5" fill="${base}"/><rect x="21" y="21" width="38" height="18" rx="1.5" fill="${base}"/><rect x="3" y="3" width="30" height="3" rx="1.5" fill="#fff" opacity=".35"/>`)})"/>`,
  concrete: ({ W, H, base, rnd }) => { let s = ''; for (let i = 0; i < W / 10; i++) s += `<circle cx="${f1(rnd() * W)}" cy="${f1(rnd() * H)}" r="${f1(6 + rnd() * 26)}" fill="${tone(base, (rnd() - 0.5) * 0.12)}" opacity=".45"/>`; for (let x = 50; x < W; x += 100) for (let y = 60; y < H - 30; y += 110) s += `<circle cx="${x}" cy="${y}" r="3" fill="${tone(base, -0.3)}"/>`; for (let x = 100; x < W; x += 200) s += `<rect x="${x}" y="0" width="1.4" height="${H}" fill="${tone(base, -0.2)}"/>`; return s; },
  logs: ({ W, H, base }) => { let s = ''; for (let y = 0; y < H; y += 24) s += `<rect x="0" y="${y}" width="${W}" height="24" fill="${y % 48 ? base : tone(base, -0.06)}"/><rect x="0" y="${y + 20}" width="${W}" height="4" fill="${tone(base, -0.35)}"/><rect x="0" y="${y + 3}" width="${W}" height="3" fill="${tone(base, 0.16)}" opacity=".6"/>`; for (let x = 0; x < W; x += 180) s += `<ellipse cx="${x + 60}" cy="${H * 0.5}" rx="3" ry="2" fill="${tone(base, -0.3)}"/>`; return s; },
  stone: ({ W, H, base, rnd }) => { let s = ''; for (let y = 0; y < H; y += 30) { let x = -rnd() * 30; while (x < W) { const w = 36 + rnd() * 34; s += `<rect x="${f1(x + 2)}" y="${y + 2}" width="${f1(w - 4)}" height="26" rx="8" fill="${tone(base, (rnd() - 0.5) * 0.2)}" stroke="${tone(base, -0.3)}" stroke-width="1.2"/>`; x += w; } } return s; },
  bamboo: ({ W, H, base }) => `<rect width="${W}" height="${H}" fill="url(#${patDef('bamboo-' + base, 30, 120, `<rect x="2" width="24" height="120" fill="${base}"/><rect x="5" width="4" height="120" fill="${tone(base, 0.18)}" opacity=".7"/><rect x="2" y="38" width="24" height="4" fill="${tone(base, -0.3)}"/><rect x="2" y="100" width="24" height="4" fill="${tone(base, -0.3)}"/><rect x="0" width="2" height="120" fill="${tone(base, -0.45)}"/>`)})"/>`,
  dots: ({ W, H, base, st }) => `<rect width="${W}" height="${H}" fill="url(#${patDef(st.id, 40, 40, `<circle cx="10" cy="10" r="5" fill="${st.c}"/><circle cx="30" cy="30" r="5" fill="${st.c}"/>`)})"/>`,
  waves: ({ W, H, base, st }) => `<rect width="${W}" height="${H}" fill="url(#${patDef(st.id, 80, 30, `<path d="M0,15 Q20,3 40,15 T80,15" stroke="${st.c || tone(base, 0.15)}" stroke-width="4" fill="none"/>`)})"/>`,
  checkerwall: ({ W, H, base, st }) => `<rect width="${W}" height="${H}" fill="url(#${patDef(st.id, 50, 50, `<rect width="25" height="25" fill="${st.c}"/><rect x="25" y="25" width="25" height="25" fill="${st.c}"/>`)})"/>`,
  sunset: ({ W, H }) => `<rect width="${W}" height="${H}" fill="url(#rm-sunset)"/><circle cx="${W * 0.5}" cy="${H * 0.62}" r="60" fill="#ffd27a" opacity=".55"/>${Array.from({ length: 5 }, (_, i) => `<rect x="0" y="${H * 0.6 + i * 16}" width="${W}" height="${6 - i}" fill="#3b2d6e" opacity=".22"/>`).join('')}`,
  hexwall: ({ W, H, base, st }) => `<rect width="${W}" height="${H}" fill="url(#${patDef(st.id, 52, 90, `<path d="M13,0 L39,0 L52,22.5 L39,45 L13,45 L0,22.5 Z M13,45 L0,67.5 L13,90 M39,45 L52,67.5 L39,90" fill="none" stroke="${st.c || tone(base, -0.18)}" stroke-width="2.4"/>`)})"/>`,
  bookwall: ({ W, H, st }) => { let row = ''; for (let r = 0; r < 2; r++) { row += `<rect x="0" y="${r * 60 + 54}" width="240" height="6" fill="${st.c || '#5b3620'}"/>` + bookRow(2, 238, r * 60 + 54, 46, 31 + r); } return `<rect width="${W}" height="${H}" fill="url(#${patDef(st.id, 240, 120, `<rect width="240" height="120" fill="#2a1a10"/>${row}`)})"/>`; },
  space: ({ W, H, rnd }) => { let s = ''; for (let i = 0; i < W / 9; i++) s += `<circle cx="${f1(rnd() * W)}" cy="${f1(rnd() * (H - 30))}" r="${f1(0.5 + rnd() * 1.3)}" fill="#fff" opacity="${(0.35 + rnd() * 0.6).toFixed(2)}"/>`; s += `<circle cx="${W * 0.22}" cy="80" r="26" fill="#e0a06a"/><ellipse cx="${W * 0.22}" cy="80" rx="42" ry="8" fill="none" stroke="#f3d9a8" stroke-width="3" transform="rotate(-14 ${W * 0.22} 80)"/><circle cx="${W * 0.7}" cy="130" r="14" fill="#6fb7ea"/><circle cx="${W * 0.7 + 4}" cy="126" r="4" fill="#fff" opacity=".4"/><ellipse cx="${W * 0.48}" cy="60" rx="90" ry="26" fill="#9f7aea" opacity=".12"/>`; return s; },
  chalk: ({ W, H }) => { const t = (x, y, txt, sz = 20, rot = 0) => `<text x="${x}" y="${y}" font-size="${sz}" fill="#f4f1ea" opacity=".75" font-family="'Comic Sans MS','Segoe Print',cursive" transform="rotate(${rot} ${x} ${y})">${txt}</text>`; return `<rect x="0" y="0" width="${W}" height="${H}" fill="#2f4a3a"/>${t(40, 70, '1. e4 e5', 22, -3)}${t(60, 110, '2. Nf3 Nc6', 20, -2)}${t(W * 0.42, 80, 'think!', 26, 4)}${t(W * 0.66, 150, 'calm mind', 20, -5)}${t(W * 0.18, 190, '+=', 30)}<rect x="${W * 0.8}" y="40" width="80" height="80" fill="none" stroke="#f4f1ea" stroke-width="2" opacity=".6"/><path d="M${W * 0.8},80 h80 M${W * 0.8 + 40},40 v80" stroke="#f4f1ea" stroke-width="1.4" opacity=".5"/><path d="M${W * 0.36},210 q30,-30 60,0 t60,0" stroke="#f4f1ea" stroke-width="2" fill="none" opacity=".6"/><rect x="0" y="${H - 34}" width="${W}" height="8" fill="#6e4428"/>`; },
  map: ({ W, H, base }) => { const land = tone(base, -0.2); const cont = (x, y, s) => `<path transform="translate(${x},${y}) scale(${s})" d="M0,20 C10,0 40,-6 60,8 C80,20 70,42 50,46 C40,60 20,56 12,42 C0,40 -6,30 0,20 Z" fill="${land}" stroke="${tone(land, -0.25)}" stroke-width="1.2"/>`; let s = ''; for (let x = 0; x < W; x += 100) s += `<rect x="${x}" y="0" width="1" height="${H}" fill="${tone(base, -0.2)}" opacity=".35"/>`; for (let y = 0; y < H; y += 60) s += `<rect x="0" y="${y}" width="${W}" height="1" fill="${tone(base, -0.2)}" opacity=".35"/>`; return s + cont(40, 50, 1.4) + cont(W * 0.3, 120, 1) + cont(W * 0.5, 40, 1.8) + cont(W * 0.72, 140, 1.2) + cont(W * 0.86, 50, 0.8); },
});

Object.assign(FLOOR_PATTERNS, {
  herringbone: ({ st }) => { const u = 25; let s = `<rect width="400" height="400" fill="${tone(st.b, -0.3)}"/>`;
    // colours follow the brick's place in the repeating tile, so bricks cut by the tile's edge match their other half
    for (let t = -4; t < 20; t++) for (let k = -6; k < 6; k++) {
      const x = (t + 2 * k) * u, y = (t - 2 * k) * u; const m = Math.floor(t / 8); const key = [((t % 8) + 8) % 8, (((k - 4 * m) % 8) + 8) % 8];
      const c = (n) => { const r = hash01(key[0] * 31 + key[1] * 7 + n); return tone(r < 0.5 ? st.a : st.b, (hash01(key[0] * 13 + key[1] * 17 + n + 5) - 0.5) * 0.09); };
      s += `<rect x="${x + 0.6}" y="${y + 0.6}" width="${2 * u - 1.2}" height="${u - 1.2}" fill="${c(1)}"/><rect x="${x + 0.6}" y="${y + u + 0.6}" width="${u - 1.2}" height="${2 * u - 1.2}" fill="${c(2)}"/>`;
    }
    return floorRect(patDef(st.id, 400, 400, s)); },
  parquet: ({ st }) => { const d = tone(st.b, -0.28); let s = `<rect width="100" height="100" fill="${d}"/>`; for (let i = 0; i < 4; i++) { s += `<rect x="1" y="${1 + i * 12.25}" width="48" height="11" fill="${i % 2 ? st.a : st.b}"/><rect x="${51 + i * 12.25}" y="51" width="11" height="48" fill="${i % 2 ? st.b : st.a}"/><rect x="${51 + i * 12.25}" y="1" width="11" height="48" fill="${i % 2 ? st.a : st.b}"/><rect x="1" y="${51 + i * 12.25}" width="48" height="11" fill="${i % 2 ? st.b : st.a}"/>`; } return floorRect(patDef(st.id, 100, 100, s)); },
  flagstone: ({ st }) => { const rnd = mulberry(8); let s = `<rect width="200" height="200" fill="${st.grout || tone(st.b, -0.35)}"/>`; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const x = i * 50, y = j * 50; s += `<path d="M${x + 3 + rnd() * 4},${y + 3 + rnd() * 4} L${x + 46 - rnd() * 4},${y + 2 + rnd() * 4} L${x + 47 - rnd() * 4},${y + 46 - rnd() * 4} L${x + 3 + rnd() * 3},${y + 47 - rnd() * 4} Z" fill="${tone(rnd() < 0.5 ? st.a : st.b, (rnd() - 0.5) * 0.12)}"/>`; } return floorRect(patDef(st.id, 200, 200, s)); },
  slate: ({ st }) => { let s = `<rect width="200" height="200" fill="${tone(st.b, -0.4)}"/>`; for (let j = 0; j < 4; j++) { const off = j % 2 ? 50 : 0; for (let k = -1; k < 2; k++) { const x = k * 100 + off; const key = (((x % 200) + 200) % 200) * 7 + j; s += `<rect x="${x + 1.5}" y="${j * 50 + 1.5}" width="97" height="47" rx="2" fill="${tone(hash01(key) < 0.5 ? st.a : st.b, (hash01(key + 3) - 0.5) * 0.1)}"/>`; } } return floorRect(patDef(st.id, 200, 200, s)); },
  terrazzo: ({ st }) => { const rnd = mulberry(6); let s = `<rect width="120" height="120" fill="${st.a}"/>`; const cols = st.chips || ['#c46a41', '#6e8ef0', '#e8b93c', '#4f8a5b', '#2f3440']; for (let i = 0; i < 60; i++) s += `<ellipse cx="${f1(rnd() * 120)}" cy="${f1(rnd() * 120)}" rx="${f1(1 + rnd() * 3.4)}" ry="${f1(0.8 + rnd() * 2.4)}" transform="rotate(${Math.floor(rnd() * 180)} ${f1(rnd() * 120)} ${f1(rnd() * 120)})" fill="${cols[i % cols.length]}" opacity=".8"/>`; return floorRect(patDef(st.id, 120, 120, s)) + poly([[0, 0], [ISO.N, 0], [ISO.N, ISO.N], [0, ISO.N]], 'none', ` stroke="${tone(st.a, -0.2)}" stroke-width=".6"`); },
  hex: ({ st }) => { const w = 52, hh = 90; const hx = (x, y, c) => `<path d="M${x + 13},${y} L${x + 39},${y} L${x + 52},${y + 22.5} L${x + 39},${y + 45} L${x + 13},${y + 45} L${x},${y + 22.5} Z" fill="${c}" stroke="${st.grout || '#fff'}" stroke-width="2.4"/>`; return floorRect(patDef(st.id, 78, hh, hx(0, 0, st.a) + hx(39, 45, st.b) + hx(-39, 45, st.b) + hx(0, 90, st.a) + hx(39, -45, st.b))); },
  tiles: ({ st }) => floorRect(patDef(st.id, 50, 50, `<rect width="50" height="50" fill="${st.grout || tone(st.b, -0.2)}"/><rect x="1.2" y="1.2" width="47.6" height="47.6" rx="2" fill="${st.a}"/><rect x="4" y="4" width="20" height="3" rx="1.5" fill="#fff" opacity=".25"/>`)),
  grass: ({ st }) => { const rnd = mulberry(2); let s = `<rect width="150" height="150" fill="${st.a}"/>`; for (let i = 0; i < 90; i++) { const x = rnd() * 150, y = rnd() * 150; s += `<path d="M${f1(x)},${f1(y)} l${f1(-2 + rnd() * 4)},-6 M${f1(x + 2)},${f1(y)} l${f1(rnd() * 3)},-5" stroke="${rnd() < 0.5 ? st.b : tone(st.a, 0.15)}" stroke-width="1.4"/>`; } for (let i = 0; i < 5; i++) s += `<circle cx="${f1(rnd() * 150)}" cy="${f1(rnd() * 150)}" r="2.2" fill="${['#fff', '#f2c14e', '#e89aa8'][i % 3]}"/>`; return floorRect(patDef(st.id, 150, 150, s)); },
  polished: ({ st }) => { const rnd = mulberry(9); let s = `<rect width="400" height="400" fill="${st.a}"/>`; for (let i = 0; i < 30; i++) s += `<circle cx="${f1(rnd() * 400)}" cy="${f1(rnd() * 400)}" r="${f1(10 + rnd() * 40)}" fill="${tone(st.a, (rnd() - 0.5) * 0.1)}" opacity=".5"/>`; s += '<path d="M200,0 V400 M0,200 H400" stroke="#000" stroke-opacity=".12" stroke-width="1.4"/>'; return floorRect(patDef(st.id, 400, 400, s)); },
  cork: ({ st }) => { const rnd = mulberry(12); let s = `<rect width="100" height="100" fill="${st.a}"/>`; for (let i = 0; i < 140; i++) s += `<circle cx="${f1(rnd() * 100)}" cy="${f1(rnd() * 100)}" r="${f1(0.6 + rnd() * 1.4)}" fill="${tone(st.a, rnd() < 0.5 ? -0.25 : 0.15)}"/>`; s += `<rect x="0" y="0" width="100" height="100" fill="none" stroke="${tone(st.a, -0.3)}" stroke-width="1.2"/>`; return floorRect(patDef(st.id, 100, 100, s)); },
  pebbles: ({ st }) => { const rnd = mulberry(15); let s = `<rect width="120" height="120" fill="${tone(st.b, -0.3)}"/>`; for (let i = 0; i < 70; i++) s += `<ellipse cx="${f1(rnd() * 120)}" cy="${f1(rnd() * 120)}" rx="${f1(3 + rnd() * 5)}" ry="${f1(2.4 + rnd() * 3)}" fill="${tone(rnd() < 0.5 ? st.a : st.b, (rnd() - 0.5) * 0.2)}"/>`; return floorRect(patDef(st.id, 120, 120, s)); },
  stars: ({ st }) => { const rnd = mulberry(18); let s = `<rect width="200" height="200" fill="${st.a}"/>`; for (let i = 0; i < 40; i++) s += `<circle cx="${f1(rnd() * 200)}" cy="${f1(rnd() * 200)}" r="${f1(0.6 + rnd() * 1.6)}" fill="${st.b}" opacity="${(0.4 + rnd() * 0.6).toFixed(2)}"/>`; s += `<path d="M20,30 L60,60 L90,40 L130,90" stroke="${st.b}" stroke-width=".8" opacity=".5" fill="none"/>`; return floorRect(patDef(st.id, 200, 200, s)); },
  rubber: ({ st }) => floorRect(patDef(st.id, 100, 100, `<rect width="100" height="100" fill="${st.a}"/><rect x="0" y="0" width="100" height="100" fill="none" stroke="${tone(st.a, -0.3)}" stroke-width="2"/>${Array.from({ length: 12 }, (_, i) => `<circle cx="${(i * 37) % 100}" cy="${(i * 53) % 100}" r="1.2" fill="${st.b}"/>`).join('')}`)),
  bambooFloor: ({ st }) => { const rnd = mulberry(22); let s = ''; for (let i = 0; i < 10; i++) { const c = tone(rnd() < 0.5 ? st.a : st.b, (rnd() - 0.5) * 0.08); s += `<rect x="${i * 20}" y="0" width="20" height="200" fill="${c}" stroke="${tone(st.b, -0.3)}" stroke-width=".8"/><rect x="${i * 20}" y="${40 + (i % 3) * 50}" width="20" height="2" fill="${tone(st.b, -0.25)}"/>`; } return floorRect(patDef(st.id, 200, 200, s)); },
});

ROOM_STYLES.push(
  /* the new rooms' own walls and floors (free in their own room) */
  { id: 'wall_library', kind: 'wall', name: 'Library green', price: 480, lvl: 4, a: '#2f5245', b: '#284638', pattern: 'wainscot', c: '#6e4428' },
  { id: 'wall_terracotta', kind: 'wall', name: 'Terracotta', price: 260, lvl: 3, a: '#c9775a', b: '#b8694e', pattern: 'plain' },
  { id: 'wall_shoji', kind: 'wall', name: 'Paper screens', price: 520, lvl: 5, a: '#f1e9d4', b: '#e6dcc3', pattern: 'shoji', c: '#5b3620' },
  { id: 'wall_gallery', kind: 'wall', name: 'Gallery white', price: 240, lvl: 3, a: '#f1efea', b: '#e4e1da', pattern: 'gallery' },
  { id: 'wall_glass', kind: 'wall', name: 'Greenhouse glass', price: 900, lvl: 10, a: '#cfe8f5', b: '#bcdaea', pattern: 'glass', skirt: '#7d4a36' },
  { id: 'wall_arcade', kind: 'wall', name: 'Arcade night', price: 560, lvl: 7, a: '#241c3a', b: '#1d1630', pattern: 'arcade', skirt: '#120d22' },
  { id: 'floor_herringbone', kind: 'floor', name: 'Herringbone oak', price: 480, lvl: 4, a: '#c08a57', b: '#a8733f', pattern: 'herringbone' },
  { id: 'floor_parquet', kind: 'floor', name: 'Parquet', price: 420, lvl: 3, a: '#b87a48', b: '#9c6436', pattern: 'parquet' },
  { id: 'floor_stone', kind: 'floor', name: 'Garden flagstones', price: 520, lvl: 6, a: '#b9b2a4', b: '#a39c8e', pattern: 'flagstone', grout: '#6f7a4c' },
  { id: 'floor_slate', kind: 'floor', name: 'Dark slate', price: 560, lvl: 7, a: '#4a4f5a', b: '#3e434d', pattern: 'slate' },
  /* plain paints */
  { id: 'wall_blush', kind: 'wall', name: 'Blush pink', price: 180, a: '#efc9c4', b: '#e2b9b3', pattern: 'plain' },
  { id: 'wall_mint', kind: 'wall', name: 'Mint', price: 180, a: '#c4e3d2', b: '#b2d6c2', pattern: 'plain' },
  { id: 'wall_lavender', kind: 'wall', name: 'Lavender', price: 200, a: '#cfc4e6', b: '#bfb3da', pattern: 'plain' },
  { id: 'wall_charcoal', kind: 'wall', name: 'Charcoal', price: 220, a: '#3a3d44', b: '#31343a', pattern: 'plain' },
  { id: 'wall_ocean', kind: 'wall', name: 'Ocean blue', price: 220, a: '#3d6f96', b: '#355f82', pattern: 'plain' },
  { id: 'wall_forest', kind: 'wall', name: 'Forest green', price: 220, a: '#3e6b4a', b: '#355c3f', pattern: 'plain' },
  { id: 'wall_mustard', kind: 'wall', name: 'Mustard', price: 200, a: '#d9a93e', b: '#c89a34', pattern: 'plain' },
  /* two tones and panelling */
  { id: 'wall_navy_wood', kind: 'wall', name: 'Navy & oak', price: 460, lvl: 4, a: '#2f4468', b: '#283a5a', pattern: 'wainscot', c: '#a8733f' },
  { id: 'wall_cream_wood', kind: 'wall', name: 'Cream & walnut', price: 420, lvl: 3, a: '#efe4cc', b: '#e3d6ba', pattern: 'wainscot', c: '#5b3620' },
  { id: 'wall_sage_white', kind: 'wall', name: 'Sage & white', price: 400, lvl: 3, a: '#b7c6ae', b: '#a8b89e', pattern: 'wainscot', c: '#eeeae2', rail: false },
  /* wallpapers */
  { id: 'wall_damask', kind: 'wall', name: 'Gold damask', price: 540, lvl: 5, a: '#7a2e2e', b: '#6a2727', pattern: 'damask', dark: true },
  { id: 'wall_damask_blue', kind: 'wall', name: 'Blue damask', price: 540, lvl: 5, a: '#c9d6e6', b: '#b8c7da', pattern: 'damask' },
  { id: 'wall_floral', kind: 'wall', name: 'Flower wallpaper', price: 380, lvl: 2, a: '#f4ede0', b: '#e9e0cf', pattern: 'floral' },
  { id: 'wall_floral_dark', kind: 'wall', name: 'Night garden', price: 460, lvl: 4, a: '#2a3b35', b: '#23322d', pattern: 'floral', c: '#f2a6b8', c2: '#f7d46a', leaf: '#7fb07a' },
  { id: 'wall_geo', kind: 'wall', name: 'Triangles', price: 360, lvl: 2, a: '#e7dcc8', b: '#dbcfb8', pattern: 'geo', c: '#d9a86a' },
  { id: 'wall_subway', kind: 'wall', name: 'White tiles', price: 380, lvl: 3, a: '#f2f1ee', b: '#e6e4df', pattern: 'subway' },
  { id: 'wall_subway_green', kind: 'wall', name: 'Green tiles', price: 420, lvl: 4, a: '#5e8f76', b: '#557f69', pattern: 'subway', grout: '#e8eee8' },
  { id: 'wall_dots', kind: 'wall', name: 'Polka dots', price: 300, lvl: 2, a: '#f6e7d2', b: '#ecdcc4', pattern: 'dots', c: '#e7a3a3' },
  { id: 'wall_waves', kind: 'wall', name: 'Soft waves', price: 320, lvl: 2, a: '#9fc6d6', b: '#8fb8c9', pattern: 'waves', c: '#b8dae6' },
  { id: 'wall_checker', kind: 'wall', name: 'Chequered wall', price: 440, lvl: 4, a: '#ece4d4', b: '#e0d7c4', pattern: 'checkerwall', c: '#d6c8ad' },
  { id: 'wall_hex', kind: 'wall', name: 'Honeycomb', price: 400, lvl: 3, a: '#f2d98a', b: '#e6cc7c', pattern: 'hexwall', c: '#d4ad4a' },
  { id: 'wall_books', kind: 'wall', name: 'Book wallpaper', price: 680, lvl: 6, a: '#2a1a10', b: '#241509', pattern: 'bookwall', bare: false },
  { id: 'wall_map', kind: 'wall', name: 'Old map', price: 560, lvl: 5, a: '#e8d9b0', b: '#dccb9f', pattern: 'map' },
  { id: 'wall_chalk', kind: 'wall', name: 'Chalkboard', price: 520, lvl: 5, a: '#2f4a3a', b: '#2a4334', pattern: 'chalk' },
  /* materials */
  { id: 'wall_whitebrick', kind: 'wall', name: 'White brick', price: 460, lvl: 3, a: '#ece6dc', b: '#e0d9cd', pattern: 'brick' },
  { id: 'wall_concrete', kind: 'wall', name: 'Concrete', price: 420, lvl: 4, a: '#a9a8a4', b: '#9b9a96', pattern: 'concrete' },
  { id: 'wall_logs', kind: 'wall', name: 'Log cabin', price: 560, lvl: 5, a: '#b27a45', b: '#a06d3c', pattern: 'logs' },
  { id: 'wall_stone', kind: 'wall', name: 'Stone wall', price: 600, lvl: 6, a: '#a19a8e', b: '#948d82', pattern: 'stone' },
  { id: 'wall_bamboo', kind: 'wall', name: 'Bamboo', price: 480, lvl: 5, a: '#c9b36a', b: '#bba55e', pattern: 'bamboo' },
  { id: 'wall_sunset', kind: 'wall', name: 'Sunset mural', price: 720, lvl: 8, a: '#e46a6a', b: '#d65f60', pattern: 'sunset' },
  { id: 'wall_space', kind: 'wall', name: 'Outer space', price: 760, lvl: 9, a: '#12132a', b: '#0e0f22', pattern: 'space', skirt: '#08091a' },
  /* floors */
  { id: 'floor_lightoak', kind: 'floor', name: 'Light oak', price: 180, a: '#dcb384', b: '#cfa575', pattern: 'planks' },
  { id: 'floor_cherry', kind: 'floor', name: 'Cherry wood', price: 240, a: '#9a4d35', b: '#8a432d', pattern: 'planks' },
  { id: 'floor_greywash', kind: 'floor', name: 'Grey-washed wood', price: 240, a: '#a9a39a', b: '#9b958c', pattern: 'planks' },
  { id: 'floor_ebony', kind: 'floor', name: 'Ebony planks', price: 320, lvl: 3, a: '#3b2c24', b: '#33261f', pattern: 'planks' },
  { id: 'floor_herring_dark', kind: 'floor', name: 'Walnut herringbone', price: 560, lvl: 5, a: '#7a4e31', b: '#643f27', pattern: 'herringbone' },
  { id: 'floor_carpet_red', kind: 'floor', name: 'Red carpet', price: 300, lvl: 2, a: '#9c3b36', b: '#9c3b36', pattern: 'carpet' },
  { id: 'floor_carpet_green', kind: 'floor', name: 'Green carpet', price: 280, a: '#4f7a55', b: '#4f7a55', pattern: 'carpet' },
  { id: 'floor_carpet_navy', kind: 'floor', name: 'Navy carpet', price: 280, a: '#2f4468', b: '#2f4468', pattern: 'carpet' },
  { id: 'floor_terrazzo', kind: 'floor', name: 'Terrazzo', price: 520, lvl: 5, a: '#ece6dc', b: '#e0d9cd', pattern: 'terrazzo' },
  { id: 'floor_hex', kind: 'floor', name: 'Hexagon tiles', price: 460, lvl: 4, a: '#f0ece4', b: '#d8e6e0', pattern: 'hex', grout: '#b9b2a6' },
  { id: 'floor_hex_green', kind: 'floor', name: 'Green hexagons', price: 480, lvl: 4, a: '#5e8f76', b: '#6f9f86', pattern: 'hex', grout: '#e8eee8' },
  { id: 'floor_tiles_blue', kind: 'floor', name: 'Blue tiles', price: 380, lvl: 3, a: '#6f9cc4', b: '#5f8cb4', pattern: 'tiles', grout: '#e9eef2' },
  { id: 'floor_tiles_terra', kind: 'floor', name: 'Terracotta tiles', price: 380, lvl: 3, a: '#c46a41', b: '#b25c36', pattern: 'tiles', grout: '#e3d2b4' },
  { id: 'floor_grass', kind: 'floor', name: 'Indoor lawn', price: 520, lvl: 6, a: '#6fa85a', b: '#4f8a44', pattern: 'grass' },
  { id: 'floor_concrete', kind: 'floor', name: 'Polished concrete', price: 360, lvl: 3, a: '#a8a7a3', b: '#9a9995', pattern: 'polished' },
  { id: 'floor_cork', kind: 'floor', name: 'Cork', price: 300, lvl: 2, a: '#c49a6c', b: '#b88d60', pattern: 'cork' },
  { id: 'floor_pebbles', kind: 'floor', name: 'River pebbles', price: 480, lvl: 5, a: '#b8b2a6', b: '#8e877b', pattern: 'pebbles' },
  { id: 'floor_blackmarble', kind: 'floor', name: 'Black marble', price: 780, lvl: 8, a: '#2b2b30', b: '#232327', pattern: 'marble', line: '#4a4a52', vein: '#8a8a94' },
  { id: 'floor_greenmarble', kind: 'floor', name: 'Green marble', price: 760, lvl: 8, a: '#3f6b56', b: '#355c4a', pattern: 'marble', line: '#2a4a3a', vein: '#a8d0b8' },
  { id: 'floor_checker_bw', kind: 'floor', name: 'Black & white', price: 540, lvl: 4, a: '#f0ede6', b: '#2b2b30', pattern: 'checker' },
  { id: 'floor_stars', kind: 'floor', name: 'Star map', price: 820, lvl: 10, a: '#141833', b: '#cfd8ff', pattern: 'stars' },
  { id: 'floor_gym', kind: 'floor', name: 'Gym floor', price: 320, lvl: 3, a: '#3a3d44', b: '#6cbf63', pattern: 'rubber' },
  { id: 'floor_bamboo', kind: 'floor', name: 'Bamboo floor', price: 360, lvl: 3, a: '#d2b476', b: '#c4a569', pattern: 'bambooFloor' },
);
