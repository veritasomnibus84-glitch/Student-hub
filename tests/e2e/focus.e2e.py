# Test de bout en bout : Focus (horloge simulée), relations tâche/événement/note, import/export par onglet.
import json, datetime
from playwright.sync_api import sync_playwright, expect
BASE = "http://localhost:8765/index.html"
HIDE = "Object.defineProperty(document,'hidden',{value:true,configurable:true}); document.dispatchEvent(new Event('visibilitychange'))"
SHOW = "Object.defineProperty(document,'hidden',{value:false,configurable:true}); document.dispatchEvent(new Event('visibilitychange'))"
errors = []

def open_tools(pg, label):
    d = pg.locator("details.tools", has=pg.locator(f"summary:has-text('{label}')"))
    if d.get_attribute("open") is None:
        d.locator("summary").click()

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 800}, accept_downloads=True)
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
    pg.on("console", lambda m: errors.append("console: " + m.text) if m.type == "error" else None)
    pg.on("dialog", lambda d: d.accept())
    pg.clock.install(time=datetime.datetime(2026, 10, 19, 9, 0, 0))
    pg.goto(BASE + "#focus"); pg.wait_for_selector(".focus__globe")
    pg.screenshot(path="/tmp/focus-idle.png")

    # --- session réussie (1 minute) ---
    pg.fill(".focus__num", "1"); pg.locator(".focus__num").dispatch_event("change")
    expect(pg.locator(".focus__clock")).to_have_text("01:00")
    pg.fill("input[aria-label='Titre de la session']", "Révision analyse")
    pg.click("button:has-text('Démarrer la concentration')")
    pg.wait_for_selector("button:has-text('Abandonner')")
    pg.clock.run_for(30_000)
    pg.screenshot(path="/tmp/focus-run.png")
    pg.clock.run_for(32_000)
    expect(pg.locator("section[role=status] h2")).to_have_text("Arbre planté")

    # --- session échouée : on quitte l'app plus de 10 s ---
    pg.click("button:has-text('OK')")
    pg.click("button:has-text('Démarrer la concentration')")
    pg.wait_for_selector("button:has-text('Abandonner')")
    pg.clock.run_for(2_000)
    pg.evaluate(HIDE)
    pg.clock.run_for(12_000)
    pg.evaluate(SHOW)
    expect(pg.locator("section[role=status] h2")).to_have_text("Arbre mort")
    pg.screenshot(path="/tmp/focus-dead.png")

    # --- retour dans les 10 s : la session continue ---
    pg.click("button:has-text('OK')")
    pg.click("button:has-text('Démarrer la concentration')")
    pg.wait_for_selector("button:has-text('Abandonner')")
    pg.evaluate(HIDE); pg.clock.run_for(5_000); pg.evaluate(SHOW)
    pg.wait_for_selector("button:has-text('Abandonner')")
    pg.click("button:has-text('Abandonner')")
    pg.click("button:has-text('OK')")

    # --- statistiques ---
    pg.click(".seg__btn:text-is('Statistiques')")
    expect(pg.locator("text=Arbres plantés : 1")).to_be_visible()
    expect(pg.locator("text=Arbres morts : 2")).to_be_visible()
    assert pg.locator(".forest li").count() == 3
    assert pg.locator("svg.chart").count() >= 3 and pg.locator("svg.donut").count() == 1
    pg.screenshot(path="/tmp/focus-stats.png", full_page=True)
    for label in ["Semaine", "Mois", "Année"]:
        pg.click(f".seg__btn:text-is('{label}')")
        assert pg.locator("svg.chart").count() >= 3

    # --- relations : événement avec tâches et notes ---
    pg.goto(BASE + "#calendar"); pg.wait_for_selector(".cal__title")
    pg.click("button:has-text('+ Événement')")
    dlg = pg.locator("dialog.sheet")
    dlg.locator("input[type=text]").first.fill("TP chimie")
    dlg.locator("button[type=submit]").click()
    pg.wait_for_selector("dialog.sheet", state="detached")
    pg.locator(".ev--row", has_text="TP chimie").click()
    dlg = pg.locator("dialog.sheet")
    expect(dlg).to_contain_text("Tâches liées (0)")
    dlg.locator("input[aria-label='Nouvelle tâche']").fill("Préparer le matériel")
    dlg.locator("button:text-is('Ajouter')").click()
    dlg.locator("input[aria-label='Nouvelle tâche']").fill("Imprimer le protocole")
    dlg.locator("input[aria-label='Nouvelle tâche']").press("Enter")
    expect(dlg).to_contain_text("Tâches liées (2)")
    dlg.locator("button:has-text('+ Nouvelle note pour cet événement')").click()
    expect(dlg).to_contain_text("Notes liées (1)")
    pg.screenshot(path="/tmp/event-rel.png")
    dlg.locator("button:text-is('Annuler')").click()
    pg.wait_for_selector("dialog.sheet", state="detached")
    expect(pg.locator(".ev__rel")).to_contain_text("2 tâches · 1 note")

    # --- export par onglet (Notes) puis import dans Notes ; refus dans Liens ---
    pg.goto(BASE + "#notes"); pg.wait_for_selector(".note")
    open_tools(pg, "Données — Notes")
    with pg.expect_download() as dl:
        pg.click("button:has-text('Exporter cet onglet')")
    path = dl.value.path()
    exp = json.load(open(path, encoding="utf-8"))
    assert exp["section"] == "notes" and list(exp["data"].keys()) == ["notes"] and exp["data"]["notes"][0]["title"].startswith("Note · TP chimie")
    pg.goto(BASE + "#links"); pg.wait_for_selector("text=Liens utiles")
    open_tools(pg, "Données — Liens")
    pg.locator("button:has-text('Importer dans cet onglet')").click()
    # le sélecteur de fichier est créé dynamiquement
    pg.set_input_files("input[aria-label='Choisir un fichier JSON']", path)
    dlg = pg.locator("dialog.sheet"); dlg.wait_for()
    dlg.locator("button[type=submit]").click()
    expect(dlg.locator(".error")).to_contain_text("Notes")
    dlg.locator("button:text-is('Annuler')").click()

    # --- Home : tout exporter, avec toutes les sections ---
    pg.goto(BASE + "#home"); pg.wait_for_selector(".home__hello")
    pg.click("button:has-text('Tout exporter')")  # déclenche un téléchargement
    with pg.expect_download() as dl2:
        pg.click("button:has-text('Tout exporter')")
    full = json.load(open(dl2.value.path(), encoding="utf-8"))
    assert full["kind"] == "all" and {"sessions", "events", "todos", "notes", "library", "links"} <= set(full["data"].keys())
    assert len(full["data"]["sessions"]) == 3 and len(full["data"]["todos"]) == 2
    assert pg.locator("text=Focus").count() >= 1
    pg.screenshot(path="/tmp/home-backup.png", full_page=True)
    b.close()
print("ERREURS:", errors)
assert not errors
print("E2E FOCUS OK")
