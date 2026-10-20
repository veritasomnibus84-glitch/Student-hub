// Graphiques et arbres en SVG, construits sans innerHTML.
const NS = 'http://www.w3.org/2000/svg';

export function svgEl(tag, attrs = {}, ...kids) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return e;
}

const W = 320; const H = 150; const L = 32; const R = 6; const T = 10; const B = 22;
const frame = (values, labels, fmt, label) => {
  const max = Math.max(1, ...values);
  const svg = svgEl('svg', {
    viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img',
    'aria-label': `${label} : ${values.map((v, i) => (v > 0 ? `${labels[i]} ${fmt(v)}` : null)).filter(Boolean).join(', ') || 'aucune donnée'}`,
  });
  [0, 0.5, 1].forEach((f) => {
    const y = T + (H - T - B) * (1 - f);
    svg.append(svgEl('line', { x1: L, x2: W - R, y1: y, y2: y, class: 'chart__grid' }), svgEl('text', { x: L - 4, y: y + 3, class: 'chart__t', 'text-anchor': 'end' }, fmt(max * f)));
  });
  return { svg, max };
};

export function barChart(values, labels, { label = '', every = 1, fmt = (v) => (v >= 10 || Number.isInteger(v) ? String(Math.round(v)) : v.toFixed(1)) } = {}) {
  const { svg, max } = frame(values, labels, fmt, label);
  const bw = (W - L - R) / values.length;
  values.forEach((v, i) => {
    const bh = ((H - T - B) * v) / max;
    if (v > 0) svg.append(svgEl('rect', { x: L + i * bw + 1, y: H - B - bh, width: Math.max(1, bw - 2), height: bh, rx: 2, class: 'chart__bar' }));
    if (i % every === 0) svg.append(svgEl('text', { x: L + i * bw + bw / 2, y: H - 6, class: 'chart__t', 'text-anchor': 'middle' }, labels[i]));
  });
  return svg;
}

export function lineChart(values, labels, { label = '', every = 1, fmt = (v) => (v >= 10 || Number.isInteger(v) ? String(Math.round(v)) : v.toFixed(1)), peak = -1 } = {}) {
  const { svg, max } = frame(values, labels, fmt, label);
  const step = (W - L - R) / Math.max(1, values.length - 1);
  const pts = values.map((v, i) => [L + i * step, H - B - ((H - T - B) * v) / max]);
  svg.append(svgEl('polyline', { points: pts.map((p) => p.join(',')).join(' '), class: 'chart__line', fill: 'none' }));
  if (peak >= 0) svg.append(svgEl('circle', { cx: pts[peak][0], cy: pts[peak][1], r: 4, class: 'chart__peak' }));
  values.forEach((_, i) => { if (i % every === 0) svg.append(svgEl('text', { x: pts[i][0], y: H - 6, class: 'chart__t', 'text-anchor': 'middle' }, labels[i])); });
  return svg;
}

// Anneau de répartition : parts = [{ value, color, label }]
export function donut(parts, centre = '') {
  const sum = parts.reduce((n, p) => n + p.value, 0);
  const C = 2 * Math.PI * 40;
  const svg = svgEl('svg', { viewBox: '0 0 120 120', class: 'donut', role: 'img', 'aria-label': `Répartition : ${parts.map((p) => `${p.label} ${Math.round((p.value / (sum || 1)) * 100)} %`).join(', ') || 'aucune donnée'}` });
  svg.append(svgEl('circle', { cx: 60, cy: 60, r: 40, fill: 'none', 'stroke-width': 18, class: 'donut__bg' }));
  let acc = 0;
  for (const p of parts) {
    const len = sum ? (p.value / sum) * C : 0;
    svg.append(svgEl('circle', { cx: 60, cy: 60, r: 40, fill: 'none', 'stroke-width': 18, class: `donut__seg c--${p.color}`, 'stroke-dasharray': `${len} ${C - len}`, 'stroke-dashoffset': -acc, transform: 'rotate(-90 60 60)' }));
    acc += len;
  }
  svg.append(svgEl('text', { x: 60, y: 64, 'text-anchor': 'middle', class: 'donut__t' }, centre));
  return svg;
}

// Arbre en 5 stades (0 = graine … 4 = arbre complet), ou arbre mort.
export function treeSvg(stage, dead = false) {
  const g = [svgEl('ellipse', { cx: 60, cy: 98, rx: 36, ry: 9, class: 'tree__ground' })];
  const tri = (pts) => svgEl('polygon', { points: pts, class: 'tree__leaf' });
  const trunk = (x, y, w, hh) => svgEl('rect', { x, y, width: w, height: hh, rx: 2, class: 'tree__trunk' });
  if (dead) {
    g.push(trunk(56, 54, 8, 44), svgEl('path', { d: 'M60 70 L44 56 M60 62 L76 48 M60 80 L74 70', class: 'tree__dead', fill: 'none' }));
  } else if (stage <= 0) {
    g.push(svgEl('circle', { cx: 60, cy: 93, r: 4.5, class: 'tree__trunk' }));
  } else if (stage === 1) {
    g.push(svgEl('path', { d: 'M60 98 L60 80', class: 'tree__stem', fill: 'none' }), svgEl('ellipse', { cx: 52, cy: 79, rx: 9, ry: 5, class: 'tree__leaf', transform: 'rotate(-25 52 79)' }), svgEl('ellipse', { cx: 68, cy: 75, rx: 9, ry: 5, class: 'tree__leaf', transform: 'rotate(25 68 75)' }));
  } else if (stage === 2) {
    g.push(trunk(57, 76, 6, 22), tri('60,42 80,80 40,80'));
  } else if (stage === 3) {
    g.push(trunk(56, 70, 8, 28), tri('60,28 84,62 36,62'), tri('60,44 90,84 30,84'));
  } else {
    g.push(trunk(55, 66, 10, 32), tri('60,10 80,40 40,40'), tri('60,26 86,62 34,62'), tri('60,46 92,86 28,86'));
  }
  return svgEl('svg', { viewBox: '0 0 120 110', class: 'tree', role: 'img', 'aria-label': dead ? 'Arbre mort' : `Arbre, stade ${Math.max(0, stage) + 1} sur 5` }, g);
}
