// Construction du DOM sans innerHTML : tout texte passe par des noeuds texte.
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function select(options, value, props = {}) {
  return h('select', props, options.map((o) => {
    const [val, label] = Array.isArray(o) ? o : [o, o];
    return h('option', { value: val, selected: val === value }, label);
  }));
}

export function field(label, control, extra = '') {
  return h('label', { class: `field ${extra}`.trim() }, h('span', { class: 'field__label' }, label), control);
}

export function safeUrl(u) {
  try {
    const url = new URL(String(u));
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch { return null; }
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function empty(text, hint = '') {
  return h('div', { class: 'empty' }, h('p', null, text), hint && h('p', { class: 'muted' }, hint));
}

export function debounce(fn, ms = 400) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
