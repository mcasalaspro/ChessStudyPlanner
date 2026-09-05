/* ===== Background image: one picture per day, picked from assets/bg/ =====
   Drop more images in that folder named 1.jpg, 2.jpg, 3.webp … (any of jpg/jpeg/png/webp).
   The app tries them in a day-seeded random order and uses the first one that loads. */
const Background = {
  MAX: 30, EXT: ['webp', 'jpg', 'jpeg', 'png'],
  apply() {
    const order = this.orderForToday();
    this.tryNext(order, 0);
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
    if (idx >= order.length) return; // nothing found: the CSS gradient stays
    const n = order[idx];
    this.tryExts(n, 0, (url) => { if (url) this.set(url); else this.tryNext(order, idx + 1); });
  },
  tryExts(n, e, cb) {
    if (e >= this.EXT.length) { cb(null); return; }
    const url = `assets/bg/${n}.${this.EXT[e]}`;
    const img = new Image();
    img.onload = () => cb(url);
    img.onerror = () => this.tryExts(n, e + 1, cb);
    img.src = url;
  },
  set(url) { document.body.style.backgroundImage = `url("${url}")`; document.body.classList.add('has-bg'); },
};
