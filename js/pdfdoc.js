// Pont vers pdf.js (copie locale dans vendor/, chargée à la demande).
let lib;
async function pdfjs() {
  if (!lib) {
    lib = await import('../vendor/pdfjs/pdf.min.mjs');
    lib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
  }
  return lib;
}

export async function openPdf(blob) {
  const data = new Uint8Array(await blob.arrayBuffer());
  const { getDocument } = await pdfjs();
  const task = getDocument({
    data,
    isEvalSupported: false,
    standardFontDataUrl: new URL('../vendor/pdfjs/standard_fonts/', import.meta.url).href,
    cMapUrl: new URL('../vendor/pdfjs/cmaps/', import.meta.url).href,
    cMapPacked: true,
  });
  const doc = await task.promise;
  // Selon la version de pdf.js, destroy() est sur le document ou sur la tâche de chargement.
  if (typeof doc.destroy !== 'function') doc.destroy = () => task.destroy();
  return doc;
}

export async function renderPage(page, canvas, cssWidth) {
  const base = page.getViewport({ scale: 1 });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const viewport = page.getViewport({ scale: (cssWidth / base.width) * dpr });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.dataset.cssWidth = String(cssWidth);
  const ctx2d = canvas.getContext('2d');
  ctx2d.fillStyle = '#ffffff'; // sans fond, la couverture JPEG deviendrait noire
  ctx2d.fillRect(0, 0, canvas.width, canvas.height);
  const task = page.render({ canvas, canvasContext: ctx2d, viewport, background: '#ffffff' });
  return task;
}

async function cover(doc) {
  const page = await doc.getPage(1);
  const canvas = document.createElement('canvas');
  const task = await renderPage(page, canvas, 240);
  await task.promise;
  return canvas.toDataURL('image/jpeg', 0.7);
}

export async function readMeta(blob) {
  const doc = await openPdf(blob);
  try {
    const meta = await doc.getMetadata().catch(() => null);
    return {
      pages: doc.numPages,
      title: String(meta?.info?.Title ?? '').trim(),
      author: String(meta?.info?.Author ?? '').trim(),
      cover: await cover(doc).catch(() => ''),
    };
  } finally { doc.destroy(); }
}
