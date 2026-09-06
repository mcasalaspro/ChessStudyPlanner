/* ===== Background image: one picture per day, picked from assets/bg/ =====
   Drop more images in that folder named 1.jpg, 2.jpg, 3.webp … (jpg/jpeg/png/webp).
   A day-seeded draw keeps the same picture all day; Settings has a button to step to the next one. */
const Background = {
  MAX: 24, EXT: ['webp', 'jpg', 'jpeg', 'png'],
  current: null, list: null, scanning: false,
  overrideKey() { return 'csp:v2:bg:' + (Auth.user?.id || 'x'); },
  apply() {
    this.strength();
    let saved = null;
    try { const raw = localStorage.getItem(this.overrideKey()); if (raw) { const o = JSON.parse(raw); if (o.day === todayKey()) saved = o.url; } } catch { /* */ }
    if (saved) { this.probe(saved, (ok) => { if (ok) this.set(saved); else this.pickOfDay(); }); return; }
    this.pickOfDay();
  },
  pickOfDay() {
    this.scan((list) => {
      if (!list.length) return;
      const key = todayKey(); let hnum = 2166136261;
      for (let i = 0; i < key.length; i++) { hnum ^= key.charCodeAt(i); hnum = Math.imul(hnum, 16777619); }
      this.set(list[Math.abs(hnum) % list.length]);
    });
  },
  /* How much the picture shows through: 'soft' | 'medium' | 'strong' */
  strength() {
    const v = state.settings.bg_strength || 'medium';
    document.body.classList.remove('bg-soft', 'bg-strong');
    if (v === 'soft') document.body.classList.add('bg-soft');
    if (v === 'strong') document.body.classList.add('bg-strong');
  },
  tryExts(n, e, cb) {
    if (e >= this.EXT.length) { cb(null); return; }
    const url = `assets/bg/${n}.${this.EXT[e]}`;
    this.probe(url, (ok) => ok ? cb(url) : this.tryExts(n, e + 1, cb));
  },
  probe(url, cb) { const img = new Image(); img.onload = () => cb(true); img.onerror = () => cb(false); img.src = url; },
  /* Find the pictures in the folder once a day (stops after a few missing numbers) and cache the list. */
  scan(cb) {
    if (this.list) { cb(this.list); return; }
    try { const raw = localStorage.getItem('csp:v2:bglist'); if (raw) { const o = JSON.parse(raw); if (o.day === todayKey() && Array.isArray(o.list)) { this.list = o.list; cb(this.list); return; } } } catch { /* */ }
    const found = []; let gaps = 0, n = 1;
    const step = () => {
      if (n > this.MAX || gaps >= 3) {
        this.list = found;
        try { localStorage.setItem('csp:v2:bglist', JSON.stringify({ day: todayKey(), list: found })); } catch { /* */ }
        cb(this.list); return;
      }
      const num = n++;
      this.tryExts(num, 0, (url) => { if (url) { found.push(url); gaps = 0; } else gaps++; step(); });
    };
    step();
  },
  next() {
    try { localStorage.removeItem('csp:v2:bglist'); } catch { /* */ }
    this.list = null;
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
    this.pickOfDay(); toast("Back to the day's picture");
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
