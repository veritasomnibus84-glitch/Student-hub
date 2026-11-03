import { JSDOM } from 'jsdom';

export function setupDOM() {
  const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', { url: 'http://localhost/' });
  const w = dom.window;
  globalThis.window = w; globalThis.document = w.document; globalThis.Node = w.Node; globalThis.location = w.location;
  w.HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute('open', ''); };
  w.HTMLDialogElement.prototype.close = function close() { this.removeAttribute('open'); this.dispatchEvent(new w.Event('close')); };
  globalThis.confirm = () => true;
  return w;
}
export const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
