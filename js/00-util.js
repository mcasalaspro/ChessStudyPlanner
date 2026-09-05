/* ===== Chess Study Planner — utilities ===== */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') { for (const sk in v) { if (v[sk] == null) continue; if (sk.startsWith('--')) el.style.setProperty(sk, String(v[sk])); else el.style[sk] = v[sk]; } }
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}
const frag = (...kids) => { const f = document.createDocumentFragment(); kids.flat(Infinity).forEach((k) => k != null && k !== false && f.append(k.nodeType ? k : document.createTextNode(String(k)))); return f; };
function setKids(el, ...kids) { el.replaceChildren(); el.append(frag(...kids)); return el; }

function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); });
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const debounce = (fn, ms) => { let tm; return (...a) => { clearTimeout(tm); tm = setTimeout(() => fn(...a), ms); }; };

/* Monotonic wall clock: anchored once, advanced with performance.now() so system clock jumps don't disturb the display. */
const Clock = (() => {
  let wall = Date.now(), perf = performance.now();
  return { now() { return wall + (performance.now() - perf); }, resync() { wall = Date.now(); perf = performance.now(); } };
})();
const nowMs = () => Clock.now();

/* ===== Dates ===== */
const MIN = 60000, HOUR = 3600000, DAY = 86400000;
const iso = (msv) => new Date(msv).toISOString();
const ms = (isoStr) => new Date(isoStr).getTime();
const pad2 = (n) => String(n).padStart(2, '0');
function ymd(d) { d = d instanceof Date ? d : new Date(d); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function parseYmd(key) { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(d, n) { const x = d instanceof Date ? new Date(d) : parseYmd(d); x.setDate(x.getDate() + n); return d instanceof Date ? x : ymd(x); }
function addMonths(d, n) { const x = new Date(d.getFullYear(), d.getMonth() + n, 1); return x; }
function daysBetween(k1, k2) { return Math.round((parseYmd(k2) - parseYmd(k1)) / DAY); }
function dayMs(key, minutes) { return parseYmd(key).getTime() + minutes * MIN; }
function minuteOfDay(msv) { const d = new Date(msv); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; }
const todayKey = () => ymd(new Date(nowMs()));
const dayKeyOf = (msv) => ymd(new Date(msv));
const isMonday = (key) => parseYmd(key).getDay() === 1;

/* ===== Formatting (en) ===== */
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WD_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MON_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function fmtClock(msv) { // H:MM:SS when >= 1 h, else MM:SS
  msv = Math.max(0, Math.floor(msv / 1000));
  const hh = Math.floor(msv / 3600), mm = Math.floor((msv % 3600) / 60), ss = msv % 60;
  return hh ? `${hh}:${pad2(mm)}:${pad2(ss)}` : `${pad2(mm)}:${pad2(ss)}`;
}
function fmtHM(minutes) { // 2h35 · 50min · 0min
  const m = Math.round(minutes); const hh = Math.floor(m / 60), mm = m % 60;
  if (hh === 0) return `${mm}min`;
  return `${hh}h${pad2(mm)}`;
}
function fmtHMlong(minutes) { const m = Math.round(minutes); const hh = Math.floor(m / 60), mm = m % 60; if (hh === 0) return `${mm} min`; if (mm === 0) return `${hh} h`; return `${hh} h ${pad2(mm)} min`; }
function fmtHours1(minutes) { return (minutes / 60).toLocaleString('en-US', { maximumFractionDigits: 1 }) + 'h'; }
const hm = (msv) => { const d = new Date(msv); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
const fmtRange = (s, e) => `${hm(s)}\u2013${hm(e)}`;
function fmtDayShort(key) { const d = parseYmd(key); return `${WD[d.getDay()]} ${MON[d.getMonth()]} ${d.getDate()}`; }
function fmtDayLong(key) { const d = parseYmd(key); return `${WD_LONG[d.getDay()]}, ${MON_LONG[d.getMonth()]} ${d.getDate()}`; }
function fmtDate(d) { d = d instanceof Date ? d : parseYmd(d); return `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; }
function fmtDayRel(key) { const tk = todayKey(); if (key === tk) return 'Today'; if (key === addDays(tk, -1)) return 'Yesterday'; if (key === addDays(tk, 1)) return 'Tomorrow'; return fmtDayShort(key); }
const fmtNum = (n) => Number(n).toLocaleString('en-US');
const dec1 = (n) => n.toLocaleString('en-US', { maximumFractionDigits: 1 });
function localDateTimeValue(msv) { const d = new Date(msv); return `${ymd(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }

/* ===== Colors ===== */
function hexToRgb(hex) { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return { r: 120, g: 120, b: 120 }; const v = parseInt(m[1], 16); return { r: v >> 16, g: (v >> 8) & 255, b: v & 255 }; }
function contrastInk(hex) { const { r, g, b } = hexToRgb(hex); const L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; return L > 0.62 ? '#141414' : '#ffffff'; }
function hexToHsl(hex) {
  let { r, g, b } = hexToRgb(hex); r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b); let hh = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) { const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min); switch (max) { case r: hh = (g - b) / d + (g < b ? 6 : 0); break; case g: hh = (b - r) / d + 2; break; default: hh = (r - g) / d + 4; } hh *= 60; }
  return { h: hh, s: s * 100, l: l * 100 };
}
const rgba = (hex, a) => { const { r, g, b } = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };
const THEME_PALETTE = ['#e06b6b', '#6e8ef0', '#6cbf63', '#4db6ac', '#e8964e', '#d9c94b', '#a875e6', '#dba145', '#d86ab0', '#5eb1e8', '#8a9bb3', '#c98b5c'];
