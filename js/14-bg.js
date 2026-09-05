/* ===== Background image: one picture per day, picked from assets/bg/ =====
   Drop more images in that folder named 1.jpg, 2.jpg, 3.webp … (jpg/jpeg/png/webp).
   A day-seeded draw keeps the same picture all day; Settings has a button to step to the next one. */
const Background = {
  MAX: 40, EXT: ['webp', 'jpg', 'jpeg', 'png'],
  current: null, list: null, scanning: false,
  overrideKey() { return 'csp:v2:bg:' + (Auth.user?.id || 'x'); },
  apply() {
    this.strength();
    let saved = null;
    try { const raw = localStorage.getItem(this.overrideKey()); if (raw) { const o = JSON.parse(raw); if (o.day === todayKey()) saved = o.url; } } catch { /* */ }
    if (saved) { this.probe(saved, (ok) => ok ? this.set(saved) : this.tryNext(this.orderForToday(), 0)); return; }
    this.tryNext(this.orderForToday(), 0);
  },
  /* How much the picture shows through: 'soft' | 'medium' | 'strong' */
  strength() {
    const v = state.settings.bg_strength || 'medium';
    document.body.classList.remove('bg-soft', 'bg-strong');
    if (v === 'soft') document.body.classList.add('bg-soft');
    if (v === 'strong') document.body.classList.add('bg-strong');
  },
  orderForToday() {
    const key = todayKey(); let hnum = 2166136261;
    for (let i = 0; i < key.length; i++) { hnum ^= key.charCodeAt(i); hnum = Math.imul(hnum, 16777619); }
    const rnd = mulberry(Math.abs(hnum));
    const nums = Array.from({ length: this.MAX }, (_, i) => i + 1);
    for (let i = nums.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [nums[i], nums[j]] = [nums[j], nums[i]]; }
    return nums;
  },
  tryNext(order, idx) {
    if (idx >= order.length) return; // nothing found: the plain dark background stays
    this.tryExts(order[idx], 0, (url) => { if (url) this.set(url); else this.tryNext(order, idx + 1); });
  },
  tryExts(n, e, cb) {
    if (e >= this.EXT.length) { cb(null); return; }
    const url = `assets/bg/${n}.${this.EXT[e]}`;
    this.probe(url, (ok) => ok ? cb(url) : this.tryExts(n, e + 1, cb));
  },
  probe(url, cb) { const img = new Image(); img.onload = () => cb(true); img.onerror = () => cb(false); img.src = url; },
  /* Find every picture in the folder (once), then step to the one after the current. */
  scan(cb) {
    if (this.list) { cb(this.list); return; }
    if (this.scanning) return;
    this.scanning = true;
    const found = []; let pending = 0, n = 1;
    const step = () => {
      if (n > this.MAX) { if (!pending) { this.list = found.sort((a, b) => a.n - b.n).map((x) => x.url); this.scanning = false; cb(this.list); } return; }
      const num = n++; pending++;
      this.tryExts(num, 0, (url) => { if (url) found.push({ n: num, url }); pending--; step(); });
    };
    step();
  },
  next() {
    this.scan((list) => {
      if (!list.length) { toast('No pictures found in assets/bg/', { error: true }); return; }
      const i = list.indexOf(this.current);
      const url = list[(i + 1) % list.length];
      this.set(url);
      try { localStorage.setItem(this.overrideKey(), JSON.stringify({ day: todayKey(), url })); } catch { /* */ }
      toast(`Background ${list.indexOf(url) + 1} of ${list.length}`);
    });
  },
  useDaily() {
    try { localStorage.removeItem(this.overrideKey()); } catch { /* */ }
    this.tryNext(this.orderForToday(), 0); toast("Back to the day's picture");
  },
  set(url) {
    this.current = url;
    let layer = document.getElementById('bgimg');
    if (!layer) { layer = h('div', { id: 'bgimg' }); document.body.prepend(layer); }
    layer.style.backgroundImage = `url("${url}")`;
    // keep the sharpest fit: images smaller than the window are gently softened instead of shown pixelated
    const img = new Image();
    img.onload = () => {
      const upscale = Math.max(window.innerWidth / img.naturalWidth, window.innerHeight / img.naturalHeight);
      layer.style.setProperty('--bg-soften', upscale > 1.05 ? `${Math.min(2.5, (upscale - 1) * 6).toFixed(1)}px` : '0px');
    };
    img.src = url;
    document.body.classList.add('has-bg');
  },
};
