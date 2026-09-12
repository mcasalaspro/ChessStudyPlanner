/* ===== Light Markdown (bold, italic, lists, links, code, timestamps) — escape first, then whitelist ===== */
function mdInline(text) {
  let s = esc(text);
  const codes = [];
  s = s.replace(/`([^`\n]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  s = s.replace(/\*\*\[(\d{1,2}:\d{2})\]\*\*/g, '<span class="ts">[$1]</span>');
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[\s(])\*(?!\s)([^*\n]+?)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
  s = s.replace(/(^|[\s(])_(?!\s)([^_\n]+?)_(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
  s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, txt, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${txt}</a>`);
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (_, pre, url) => `${pre}<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[+i]}</code>`);
  return s;
}
function renderMd(text) {
  if (!text) return '';
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  const out = []; let para = [], list = null;
  const flushPara = () => { if (para.length) { out.push(`<p>${para.join('<br>')}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push(`<${list.tag}>${list.items.map((i) => `<li>${i}</li>`).join('')}</${list.tag}>`); list = null; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const ul = /^\s*[-*•]\s+(.*)$/.exec(line), ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ul || ol) {
      flushPara(); const tag = ul ? 'ul' : 'ol';
      if (!list || list.tag !== tag) { flushList(); list = { tag, items: [] }; }
      list.items.push(mdInline((ul || ol)[1]));
    } else if (line.trim() === '') { flushPara(); flushList(); }
    else { flushList(); para.push(mdInline(line)); }
  }
  flushPara(); flushList();
  return out.join('');
}
function mdExcerpt(text, n = 120) {
  const plain = String(text || '').replace(/\*\*\[(\d{1,2}:\d{2})\]\*\*/g, '[$1]').replace(/[*_`#>]/g, '').replace(/\s+/g, ' ').trim();
  return plain.length > n ? plain.slice(0, n - 1) + '…' : plain;
}
