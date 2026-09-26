/* ===== A picture of your room to share (1080 × 1920, the size of an Instagram story) ===== */
const STORY_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const STORY_THEMES = {
  warm: { top: '#2b2117', bottom: '#100c09', glow: '#f5c542', ink: '#f7f0e4', sub: 'rgba(247,240,228,.62)', panel: 'rgba(255,255,255,.055)', line: 'rgba(245,197,66,.38)', accent: '#f5c542' },
  night: { top: '#18204a', bottom: '#060812', glow: '#8fa8ff', ink: '#eef2ff', sub: 'rgba(238,242,255,.62)', panel: 'rgba(255,255,255,.06)', line: 'rgba(143,168,255,.4)', accent: '#ffd76a', stars: true },
  light: { top: '#f7efe1', bottom: '#e6d6ba', glow: '#ffffff', ink: '#2a2016', sub: 'rgba(42,32,22,.6)', panel: 'rgba(255,255,255,.55)', line: 'rgba(138,90,54,.35)', accent: '#b8791f' },
};
function svgToImage(svg) {
  return new Promise((resolve, reject) => {
    const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('The room could not be drawn'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}
function roundRect(g, x, y, w, hh, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + hh, r); g.arcTo(x + w, y + hh, x, y + hh, r); g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
let _coinImg = null; // the Canva coin, loaded once for the picture to share
function coinArtReady() { const S = typeof ROOM_ART !== 'undefined' && ROOM_ART.sprites && ROOM_ART.sprites.coin; if (!S) return Promise.resolve(null); if (_coinImg) return _coinImg; _coinImg = new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = `assets/room/${S[0]}.png?v=${ROOM_ART.v}`; }); return _coinImg; }
let _coinLoaded = null;
function coinOnCanvas(g, cx, cy, r) {
  if (_coinLoaded) { g.drawImage(_coinLoaded, cx - r, cy - r, 2 * r, 2 * r); return; }
  const gr = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r); gr.addColorStop(0, '#ffe58a'); gr.addColorStop(0.5, '#f5c542'); gr.addColorStop(1, '#c98e1c');
  g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#a8740f'; g.lineWidth = r * 0.12; g.stroke();
  g.strokeStyle = 'rgba(255,245,200,.85)'; g.lineWidth = r * 0.1; g.beginPath(); g.arc(cx, cy, r * 0.66, 0, Math.PI * 2); g.stroke();
}
const RoomStory = {
  opts: null,
  open(rid) {
    coinArtReady().then((im) => { _coinLoaded = im; });
    const mode = RoomView.lightMode();
    this.opts = { rid: rid || RoomView.cur(), mode, avatar: true, theme: roomNight(roomClock(mode)) > 0.5 ? 'night' : 'warm' };
    const o = this.opts; const cv = h('canvas', { width: 1080, height: 1920, class: 'story-canvas', role: 'img', 'aria-label': 'Preview of the picture' });
    const status = h('span', { class: 'muted small story-status' });
    let busy = false, again = false;
    const redraw = async () => { if (busy) { again = true; return; } busy = true; status.textContent = 'Drawing…'; try { await this.draw(cv, o); status.textContent = ''; } catch (e) { console.error(e); status.textContent = 'Could not draw the picture'; } busy = false; if (again) { again = false; redraw(); } };
    const roomSel = h('select', { 'aria-label': 'Room', onChange: (e) => { o.rid = e.target.value; redraw(); } }, ...Room.unlockedRooms().map((r) => h('option', { value: r.id, selected: r.id === o.rid }, r.name)));
    const light = segmented(LIGHT_MODES.map(([id, l]) => [id, id === 'auto' ? 'Now' : l]), o.mode, (v) => { o.mode = v; redraw(); }, 'sm');
    const theme = segmented([['warm', 'Warm'], ['night', 'Night'], ['light', 'Light']], o.theme, (v) => { o.theme = v; redraw(); }, 'sm');
    const who = h('label', { class: 'row small' }, h('input', { type: 'checkbox', checked: true, onChange: (e) => { o.avatar = e.target.checked; redraw(); } }), ' Show my character');
    const field = (label, el) => h('label', { class: 'field' }, h('span', null, label), el);
    const canShare = !!(navigator.canShare && window.File);
    const m = openModal({ title: 'Share your room', cls: 'story-modal',
      body: h('div', { class: 'story-wrap' }, h('div', { class: 'story-prev' }, cv),
        h('div', { class: 'story-ctl stack' }, h('p', { class: 'muted small' }, 'A picture the size of an Instagram story (1080 × 1920): your room, your level and all the credits you have earned so far.'),
          field('Room', roomSel), field('Light', light), field('Background', theme), who, status)),
      footer: frag(h('button', { class: 'btn', onClick: () => m.close() }, 'Close'),
        canShare ? h('button', { class: 'btn', onClick: () => this.share(cv) }, icon('share'), 'Share…') : null,
        h('button', { class: 'btn primary', onClick: () => this.download(cv) }, icon('image'), 'Download PNG')) });
    redraw();
  },
  stats() {
    const cr = Credits.get(); const won = state.settings.achievements || {};
    return { cr, hours: sumRange(null, null).netMin / 60, ach: Object.keys(won).length, items: Room.owned().length, rooms: Room.unlockedRooms().length, best: streakInfo().best };
  },
  async draw(cv, o) {
    const W = 1080, H = 1920; const g = cv.getContext('2d'); const T = STORY_THEMES[o.theme] || STORY_THEMES.warm; const S = this.stats(); const rd = roomDef(o.rid);
    g.clearRect(0, 0, W, H);
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, T.top); bg.addColorStop(1, T.bottom); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const glow = g.createRadialGradient(W / 2, 860, 40, W / 2, 860, 700); glow.addColorStop(0, rgba(T.glow, o.theme === 'light' ? 0.55 : 0.2)); glow.addColorStop(1, rgba(T.glow, 0)); g.fillStyle = glow; g.fillRect(0, 0, W, H);
    if (T.stars) { const rnd = mulberry(11); for (let i = 0; i < 140; i++) { g.fillStyle = `rgba(255,255,255,${(0.2 + rnd() * 0.6).toFixed(2)})`; g.beginPath(); g.arc(rnd() * W, rnd() * H * 0.6, 0.8 + rnd() * 1.8, 0, Math.PI * 2); g.fill(); } }
    // title
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    if ('letterSpacing' in g) g.letterSpacing = '9px';
    g.fillStyle = T.accent; g.font = `800 30px ${STORY_FONT}`; g.fillText('MY STUDY ROOM', W / 2, 238);
    if ('letterSpacing' in g) g.letterSpacing = '0px';
    const title = o.rid === 'study' ? 'The Study' : `The ${rd.name}`;
    g.fillStyle = T.ink; let fs = 96; g.font = `800 ${fs}px ${STORY_FONT}`; while (g.measureText(title).width > 940 && fs > 50) { fs -= 4; g.font = `800 ${fs}px ${STORY_FONT}`; } g.fillText(title, W / 2, 340);
    const d = new Date(nowMs()); g.fillStyle = T.sub; g.font = `500 32px ${STORY_FONT}`; g.fillText(`${MON_LONG[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`, W / 2, 396);
    // the room
    const rw = 1060, rh = Math.round(rw * 414 / 544), rx = (W - rw) / 2, ry = 432;
    const actors = Actors.snapshot(o.rid).filter((a) => o.avatar || a.id !== 'avatar');
    const img = await svgToImage(await inlineArt(roomSvg({ rid: o.rid, mode: o.mode, forExport: true, actors, size: [rw, rh] })));
    g.save(); g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 60; g.shadowOffsetY = 24; g.drawImage(img, rx, ry, rw, rh); g.restore();
    // level and credits
    const px = 80, py = 1268, pw = W - 160, ph = 400;
    g.fillStyle = T.panel; roundRect(g, px, py, pw, ph, 36); g.fill(); g.strokeStyle = T.line; g.lineWidth = 2; g.stroke();
    const bx = px + 44, by = py + 44, bs = 164;
    const bgr = g.createLinearGradient(bx, by, bx + bs, by + bs); bgr.addColorStop(0, '#ffe58a'); bgr.addColorStop(0.55, '#f5c542'); bgr.addColorStop(1, '#d08f1f');
    g.fillStyle = bgr; roundRect(g, bx, by, bs, bs, 30); g.fill();
    g.fillStyle = '#3a2606'; g.textAlign = 'center'; g.font = `800 28px ${STORY_FONT}`; g.fillText('LEVEL', bx + bs / 2, by + 48);
    g.font = `900 ${S.cr.level >= 100 ? 70 : 86}px ${STORY_FONT}`; g.fillText(String(S.cr.level), bx + bs / 2, by + 138);
    const tx = bx + bs + 40, tw = px + pw - 44 - tx;
    g.textAlign = 'left'; g.fillStyle = T.ink; g.font = `800 60px ${STORY_FONT}`; g.fillText(S.cr.title, tx, by + 62);
    const barY = by + 92; g.fillStyle = o.theme === 'light' ? 'rgba(42,32,22,.12)' : 'rgba(255,255,255,.12)'; roundRect(g, tx, barY, tw, 22, 11); g.fill();
    const pg = g.createLinearGradient(tx, 0, tx + tw, 0); pg.addColorStop(0, '#e0a03a'); pg.addColorStop(1, '#f5c542'); g.fillStyle = pg; roundRect(g, tx, barY, Math.max(22, tw * S.cr.levelPct), 22, 11); g.fill();
    g.fillStyle = T.sub; g.font = `600 28px ${STORY_FONT}`; g.fillText(`${fmtNum(S.cr.xp)} / ${fmtNum(S.cr.levelTo)} XP to level ${S.cr.level + 1}`, tx, by + 158);
    g.strokeStyle = T.line; g.lineWidth = 2; g.beginPath(); g.moveTo(px + 44, py + 246); g.lineTo(px + pw - 44, py + 246); g.stroke();
    // total credits earned so far
    const credits = fmtNum(S.cr.earned); g.font = `900 70px ${STORY_FONT}`; const cw = g.measureText(credits).width; const lab = 'credits earned'; g.font = `600 30px ${STORY_FONT}`; const lw = g.measureText(lab).width;
    const total = 64 + 18 + cw + 18 + lw; let cx = W / 2 - total / 2;
    coinOnCanvas(g, cx + 32, py + 318, 30); cx += 64 + 18;
    g.fillStyle = T.accent; g.font = `900 70px ${STORY_FONT}`; g.fillText(credits, cx, py + 342); cx += cw + 18;
    g.fillStyle = T.sub; g.font = `600 30px ${STORY_FONT}`; g.fillText(lab, cx, py + 338);
    // a few more numbers under the panel
    const bits = [`${fmtNum(Math.round(S.hours))} h studied`, `${S.ach} achievement${S.ach === 1 ? '' : 's'}`, `${S.items} items`, `${S.rooms} room${S.rooms === 1 ? '' : 's'}`];
    g.textAlign = 'center'; g.fillStyle = T.ink; g.font = `700 30px ${STORY_FONT}`; g.fillText(bits.join('  ·  '), W / 2, py + ph + 62);
    g.fillStyle = T.sub; g.font = `600 26px ${STORY_FONT}`; if ('letterSpacing' in g) g.letterSpacing = '4px'; g.fillText('CHESS STUDY PLANNER', W / 2, py + ph + 118); if ('letterSpacing' in g) g.letterSpacing = '0px';
  },
  fileName() { return `study-room-${this.opts?.rid || 'study'}-${todayKey()}.png`; },
  blob(cv) { return new Promise((resolve, reject) => { try { cv.toBlob((b) => (b ? resolve(b) : reject(new Error('empty'))), 'image/png'); } catch (e) { reject(e); } }); },
  async download(cv) {
    try {
      const b = await this.blob(cv); const url = URL.createObjectURL(b);
      const a = h('a', { href: url, download: this.fileName() }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast('Picture saved');
    } catch (e) { console.error(e); toast('The picture could not be saved', { error: true }); }
  },
  async share(cv) {
    try {
      const b = await this.blob(cv); const file = new File([b], this.fileName(), { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: 'My study room' });
      else this.download(cv);
    } catch (e) { if (e && e.name !== 'AbortError') { console.error(e); this.download(cv); } }
  },
};
