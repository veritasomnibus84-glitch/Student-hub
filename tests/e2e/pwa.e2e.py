# Navigateur réel : manifeste, service worker, et l'app qui s'ouvre sans réseau (CSP stricte).
import json
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 420, "height": 800}, service_workers="allow")
    pg = ctx.new_page()
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    pg.goto("http://localhost:8765/index.html#home")
    pg.wait_for_selector("section[data-widget]")
    # manifeste lisible par le navigateur
    href = pg.locator("link[rel=manifest]").get_attribute("href")
    m = pg.evaluate("async (u) => (await fetch(u)).json()", href)
    assert m["display"] == "standalone" and len(m["icons"]) == 3
    # service worker actif et qui contrôle la page
    pg.evaluate("navigator.serviceWorker.ready.then(() => true)")
    for _ in range(40):
        if pg.evaluate("!!navigator.serviceWorker.controller"):
            break
        pg.wait_for_timeout(250)
    else:
        pg.reload(); pg.wait_for_selector("section[data-widget]")
        assert pg.evaluate("!!navigator.serviceWorker.controller"), "le service worker ne contrôle pas la page"
    names = pg.evaluate("caches.keys()")
    assert any(n.startswith("studenthub-") and n != "studenthub-runtime" for n in names), names
    n_files = pg.evaluate("caches.keys().then(async (ks) => { const k = ks.find((x) => x !== 'studenthub-runtime'); return (await (await caches.open(k)).keys()).length; })")
    assert n_files >= 60, n_files
    # ajouter une to-do en ligne, puis couper le réseau
    pg.goto("http://localhost:8765/index.html#workspace"); pg.wait_for_selector("h1")
    # hors ligne : rechargement complet, onglets, données conservées
    ctx.set_offline(True)
    pg.reload()
    pg.wait_for_selector("h1", timeout=10000)
    assert pg.locator("nav a").count() == 12, pg.locator("nav a").count()
    pg.goto("http://localhost:8765/index.html#revision"); pg.wait_for_selector("h1")
    assert "Mémorisation" in pg.inner_text("h1")
    pg.goto("http://localhost:8765/index.html#settings"); pg.wait_for_selector("h1")
    txt = pg.inner_text("main")
    assert "mode hors ligne est prêt" in txt, txt[:400]
    ctx.set_offline(False)
    real = [e for e in errors if "Failed to load resource" not in e and "ERR_" not in e]
    assert not real, real
    print("pwa e2e OK :", n_files, "fichiers en cache")
    b.close()
