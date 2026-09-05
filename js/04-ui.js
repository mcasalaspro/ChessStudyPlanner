/* ===== Shared UI ===== */
const modalStack = [];
function openModal({ title, body, footer, cls = '', onClose }) {
  const root = h('div', { class: 'modal-root', role: 'dialog', 'aria-modal': 'true', 'aria-label': title || '' });
  const modal = h('div', { class: 'modal ' + cls }, title ? h('div', { class: 'modal-head' }, h('h2', null, title), h('button', { class: 'btn icon ghost', 'aria-label': 'Fechar', onClick: () => close() }, '✕')) : null, body, footer ? h('div', { class: 'modal-foot' }, footer) : null);
  root.append(modal);
  let closed = false;
  function close(result) { if (closed) return; closed = true; root.remove(); modalStack.splice(modalStack.indexOf(api), 1); onClose && onClose(result); }
  root.addEventListener('mousedown', (e) => { if (e.target === root) close(); });
  const api = { close, el: modal, root }; modalStack.push(api); document.body.append(root);
  return api;
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modalStack.length) { e.stopPropagation(); modalStack[modalStack.length - 1].close(); } });
function confirmDialog(message, { title, okLabel = 'Confirmar', cancelLabel = 'Cancelar', danger = false, twice = null } = {}) {
  return new Promise((resolve) => {
    let step = 0; const msgEl = h('p', null, message);
    const ok = h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), onClick: () => { if (twice && step === 0) { step = 1; msgEl.textContent = twice; ok.textContent = 'Confirmar'; return; } m.close(true); } }, okLabel);
    const m = openModal({ title: title || '', cls: 'narrow', body: msgEl, footer: frag(h('button', { class: 'btn', onClick: () => m.close(false) }, cancelLabel), ok), onClose: (r) => resolve(!!r) });
    setTimeout(() => ok.focus(), 30);
  });
}

/* Snackbar */
let toastTimer = null, toastEl = null;
function toast(msg, { action, onAction, duration = 4000, error = false } = {}) {
  if (toastEl) toastEl.remove();
  toastEl = h('div', { class: 'snackbar' + (error ? ' err' : ''), role: 'status' }, h('span', null, msg),
    action ? h('button', { onClick: () => { clearTimeout(toastTimer); toastEl.remove(); toastEl = null; onAction && onAction(); } }, action) : null);
  document.body.append(toastEl); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl && toastEl.remove(); toastEl = null; }, duration);
}
function toastUndo(msg) { toast(msg, { action: 'Desfazer', duration: 8000, onAction: () => { if (undoLast()) toast('Desfeito'); } }); }

/* Banners (non-blocking, under the header) */
const banners = new Map();
function showBanner(id, { text, warn, actions = [] }) {
  hideBanner(id);
  const el = h('div', { class: 'banner' + (warn ? ' warn' : ''), role: 'alert' }, h('div', { class: 'grow' }, text),
    ...actions.map((a) => h('button', { class: 'btn sm ' + (a.primary ? 'primary' : ''), onClick: a.onClick }, a.label)),
    h('button', { class: 'btn ghost icon sm', 'aria-label': 'Fechar', onClick: () => hideBanner(id) }, '✕'));
  banners.set(id, el); const root = $('#banners'); if (root) root.append(el);
}
function hideBanner(id) { const el = banners.get(id); if (el) { el.remove(); banners.delete(id); } }

/* Segmented control: opts [[value,label]] */
function segmented(opts, value, onChange, cls = '') {
  const el = h('div', { class: 'seg ' + cls, role: 'group' });
  const render = (v) => setKids(el, ...opts.map(([val, label]) => h('button', { type: 'button', 'aria-pressed': String(val === v), onClick: () => { if (val !== v) { render(val); onChange(val); } } }, label)));
  render(value); el.set = render; return el;
}
/* Theme chips: colored outline pills; selected = filled */
function themeChips(value, onChange, { allowNone = false, small = false } = {}) {
  const el = h('div', { class: 'chips' + (small ? ' small' : ''), role: 'radiogroup' });
  const render = (v) => setKids(el, ...themes().map((th) => h('button', { type: 'button', class: 'chip' + (th.id === v ? ' on' : ''), role: 'radio', 'aria-checked': String(th.id === v), style: { '--c': th.color, '--ink': contrastInk(th.color) }, onClick: () => { const nv = allowNone && th.id === v ? null : th.id; render(nv); onChange(nv); } }, th.name)));
  render(value); el.set = render; return el;
}
function themeSelect(value, { allowNone = false } = {}) {
  const sel = h('select', null, allowNone ? h('option', { value: '' }, 'Sem tema') : null, ...themes().map((th) => h('option', { value: th.id, selected: th.id === value }, th.name)));
  return sel;
}
function themeDot(id) { return h('i', { class: 'dot', style: { background: themeColor(id) } }); }

/* Note icon (small speech bubble) for blocks with a user comment */
function noteIcon(cls = '') { return h('span', { class: 'note-ic ' + cls, title: 'Tem comentário', 'aria-label': 'Tem comentário', html: '<svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><path d="M2 2.5A1.5 1.5 0 0 1 3.5 1h9A1.5 1.5 0 0 1 14 2.5v7A1.5 1.5 0 0 1 12.5 11H6l-3.2 2.6c-.4.3-.8 0-.8-.5V11A1.5 1.5 0 0 1 2 9.5z" fill="currentColor"/></svg>' }); }

/* Note editor with write/preview + counter (max 20 000) */
function noteEditor(initial = '', { placeholder = 'Comentário do bloco: o que estudou, ideias, pendências… (**negrito**, *itálico*, - listas)', rows = 5, onChange } = {}) {
  const ta = h('textarea', { rows, placeholder, maxlength: 20000, 'aria-label': 'Comentário' }); ta.value = initial || '';
  const counter = h('span', { class: 'counter' }); const preview = h('div', { class: 'md preview', hidden: true });
  const updCount = () => { const n = ta.value.length; counter.textContent = `${fmtNum(n)} / 20.000`; counter.classList.toggle('warn', n >= 18000); };
  const seg = segmented([['write', 'Escrever'], ['preview', 'Prévia']], 'write', (v) => { const p = v === 'preview'; preview.hidden = !p; ta.hidden = p; if (p) preview.innerHTML = renderMd(ta.value) || '<p class="muted">Nada para mostrar.</p>'; }, 'sm');
  ta.addEventListener('input', () => { updCount(); onChange && onChange(ta.value); });
  updCount();
  return { el: h('div', { class: 'note-editor' }, h('div', { class: 'row between' }, seg, counter), ta, preview), ta, value: () => ta.value };
}

/* ===== Side panel (drawer) ===== */
const Drawer = {
  el: null, current: null,
  ensure() {
    if (this.el) return this.el;
    this.el = h('aside', { class: 'drawer', id: 'drawer', role: 'complementary', 'aria-label': 'Painel lateral', hidden: true },
      h('div', { class: 'drawer-head' }, h('h2', { id: 'drawer-title' }), h('button', { class: 'btn icon ghost', 'aria-label': 'Fechar painel', onClick: () => this.close() }, '✕')),
      h('div', { class: 'drawer-body', id: 'drawer-body' }));
    document.body.append(this.el);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !this.el.hidden && !modalStack.length && !Focus.isOpen()) { const tag = document.activeElement?.tagName; if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') { document.activeElement.blur(); return; } this.close(); } });
    return this.el;
  },
  open(title, body, key) {
    this.ensure(); this.current = key || title;
    $('#drawer-title', this.el).textContent = title; setKids($('#drawer-body', this.el), body);
    this.el.hidden = false; document.body.classList.add('drawer-open');
    emit('drawer', { open: true, key: this.current });
  },
  close() { if (!this.el || this.el.hidden) return; this.el.hidden = true; this.current = null; document.body.classList.remove('drawer-open'); emit('drawer', { open: false }); },
  isOpen(key) { return !!this.el && !this.el.hidden && (key == null || this.current === key); },
};
