// Fichier généré par scripts/build-sw.mjs : ne pas modifier à la main (npm run build:sw).
const VERSION = '4cfa890dfeb5';
const CACHE = `studenthub-${VERSION}`;
const RUNTIME = 'studenthub-runtime';
const PRECACHE = [
  "assets/logo.svg",
  "css/base.css",
  "css/components.css",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-512.png",
  "index.html",
  "js/app.js",
  "js/appearance.js",
  "js/autosync.js",
  "js/calendar-logic.js",
  "js/constants.js",
  "js/data-io.js",
  "js/deps-logic.js",
  "js/dom.js",
  "js/files.js",
  "js/focus-logic.js",
  "js/focus-runtime.js",
  "js/fsrs.js",
  "js/goals-logic.js",
  "js/ics.js",
  "js/kanban.js",
  "js/library-logic.js",
  "js/lock.js",
  "js/main.js",
  "js/modules/calendar.js",
  "js/modules/focus.js",
  "js/modules/goals.js",
  "js/modules/home.js",
  "js/modules/learn-ui.js",
  "js/modules/library.js",
  "js/modules/links.js",
  "js/modules/messages.js",
  "js/modules/notes.js",
  "js/modules/projects.js",
  "js/modules/revision.js",
  "js/modules/settings-ui.js",
  "js/modules/settings.js",
  "js/modules/tutor-ui.js",
  "js/modules/videos.js",
  "js/modules/workspace.js",
  "js/pdfdoc.js",
  "js/planning.js",
  "js/pwa.js",
  "js/reminders.js",
  "js/reports-logic.js",
  "js/revision-logic.js",
  "js/search.js",
  "js/settings-logic.js",
  "js/store.js",
  "js/study-logic.js",
  "js/sync.js",
  "js/tasks-logic.js",
  "js/tombstones.js",
  "js/tutor-logic.js",
  "js/tutor-prompt.js",
  "js/ui/charts.js",
  "js/ui/context-menu.js",
  "js/ui/data-panel.js",
  "js/ui/dialog.js",
  "js/ui/download.js",
  "js/ui/focus-plan.js",
  "js/ui/lock-screen.js",
  "js/ui/reader.js",
  "js/ui/report-widgets.js",
  "js/ui/slot-planner.js",
  "js/ui/todo-actions.js",
  "js/ui/todo-dialog.js",
  "js/ui/widgets.js",
  "js/work-logic.js",
  "js/xp-logic.js",
  "manifest.webmanifest",
  "vendor/pdfjs/pdf.min.mjs",
  "vendor/pdfjs/pdf.worker.min.mjs"
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('studenthub-') && k !== CACHE && k !== RUNTIME).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Données de Hermes et des Actions GitHub : réseau d'abord (fraîches), cache si hors ligne.
const networkFirst = (req) => fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(RUNTIME).then((c) => c.put(req, copy)); } return res; })
  .catch(() => caches.match(req).then((hit) => hit || Promise.reject(new Error('hors ligne'))));

// Le reste : cache d'abord (l'app marche sans réseau), puis réseau, mis de côté pour la prochaine fois.
const cacheFirst = (req) => caches.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(RUNTIME).then((c) => c.put(req, copy)); } return res; }));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // vignettes YouTube, Supabase… : jamais interceptés
  if (/\/data\/[^/]+\.json$/.test(url.pathname)) { e.respondWith(networkFirst(req)); return; }
  if (req.mode === 'navigate') { e.respondWith(caches.match('index.html').then((hit) => hit || fetch(req))); return; }
  e.respondWith(cacheFirst(req));
});
