# Test de bout en bout : python3 -m http.server 8765 dans le dossier, puis python3 tests/e2e/app.e2e.py
import os, tempfile
from playwright.sync_api import sync_playwright, expect
BASE = "http://localhost:8765/index.html"
errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 800}, accept_downloads=True)
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
    pg.on("console", lambda m: errors.append("console: " + m.text) if m.type == "error" else None)
    pg.on("dialog", lambda d: d.accept())
    pg.goto(BASE)
    pg.wait_for_selector(".home__hello")
    pg.screenshot(path="/tmp/home.png")
    assert "Student Hub" in pg.inner_text(".brand")
    assert pg.locator("header .brand img").get_attribute("src") == "assets/logo.svg"

    # --- verrou ---
    pg.click("button:has-text('Définir un verrou')")
    dlg = pg.locator("dialog.sheet")
    dlg.locator("input[type=text]").fill("Emmanuel")
    dlg.locator("input[type=password]").nth(0).fill("abc")
    dlg.locator("input[type=password]").nth(1).fill("abc")
    dlg.locator("button[type=submit]").click()
    expect(dlg.locator(".error")).to_contain_text("6 caractères")
    dlg.locator("input[type=password]").nth(0).fill("secret123")
    dlg.locator("input[type=password]").nth(1).fill("autre123")
    dlg.locator("button[type=submit]").click()
    expect(dlg.locator(".error")).to_contain_text("différents")
    dlg.locator("input[type=password]").nth(1).fill("secret123")
    dlg.locator("button[type=submit]").click()
    pg.wait_for_selector("dialog.sheet", state="detached")
    pg.click("button:has-text('Verrouiller maintenant')")
    pg.wait_for_selector(".lock")
    pg.screenshot(path="/tmp/lock.png")
    pg.fill(".lock input[type=text]", "emmanuel")
    pg.fill(".lock input[type=password]", "mauvais")
    pg.click(".lock button[type=submit]")
    expect(pg.locator(".lock .error")).to_contain_text("incorrect")
    pg.fill(".lock input[type=password]", "secret123")
    pg.click(".lock button[type=submit]")
    pg.wait_for_selector(".home__hello")

    # --- agenda : semaine, création par clic sur un créneau ---
    pg.goto(BASE + "#calendar"); pg.wait_for_selector(".mgrid")
    pg.click(".seg__btn:text-is('Semaine')")
    pg.wait_for_selector(".wk__col")
    pg.locator(".wk__col").nth(2).click(position={"x": 20, "y": 9 * 48 + 10})
    dlg = pg.locator("dialog.sheet"); dlg.wait_for()
    assert dlg.locator("input[type=time]").nth(0).input_value() == "09:00"
    dlg.locator("input[type=text]").first.fill("TP chimie")
    dlg.locator("select").nth(1).select_option("weekly")
    dlg.locator("select").nth(2).select_option("15")
    dlg.locator("button[type=submit]").click()
    pg.wait_for_selector("dialog.sheet", state="detached")
    expect(pg.locator(".wk__ev")).to_have_count(1)
    pg.screenshot(path="/tmp/week.png")
    # répété : visible la semaine suivante aussi
    pg.click("button[aria-label='Suivant']")
    expect(pg.locator(".wk__ev")).to_have_count(1)
    pg.click("button:text-is(\"Aujourd'hui\")")
    # mois : un point ; année : une marque
    pg.click(".seg__btn:text-is('Mois')")
    assert pg.locator(".mday .dot").count() >= 1
    pg.screenshot(path="/tmp/month.png")
    pg.click(".seg__btn:text-is('Année')")
    assert pg.locator(".yr__d.has").count() >= 1
    # événement du jour via Home + recherche globale
    pg.goto(BASE + "#home"); pg.wait_for_selector(".home__hello")
    pg.click("button:has-text('+ Événement')")
    dlg = pg.locator("dialog.sheet")
    dlg.locator("input[type=text]").first.fill("Réunion de groupe")
    dlg.locator("button[type=submit]").click()
    pg.wait_for_selector("dialog.sheet", state="detached")
    assert "Réunion de groupe" in pg.inner_text(".home__grid")
    pg.fill("input[aria-label='Recherche globale']", "réunion")
    expect(pg.locator(".result")).to_have_count(1)
    pg.screenshot(path="/tmp/home2.png")
    # export / import .ics
    pg.goto(BASE + "#calendar"); pg.wait_for_selector(".cal__title")
    pg.click("summary:has-text('Agendas et réglages')")
    with pg.expect_download() as dl:
        pg.click("button:has-text('Exporter .ics')")
    path = dl.value.path()
    ics = open(path, encoding="utf-8").read()
    assert "SUMMARY:Réunion de groupe" in ics and "RRULE:FREQ=WEEKLY" in ics and "TRIGGER:-PT15M" in ics
    pg.set_input_files("input[aria-label='Importer un fichier .ics']", path)
    expect(pg.locator("#cal-msg")).to_contain_text("2 événements importés")
    # suppression d'un cours (page du cours)
    pg.goto(BASE + "#workspace"); pg.wait_for_selector(".course")
    n = pg.locator(".course").count()
    pg.locator(".course", has_text="Chimie").click()
    pg.click("button:has-text('Supprimer le cours')")
    pg.wait_for_selector(".course")
    assert pg.locator(".course").count() == n - 1
    # mot de passe oublié : efface verrou + données
    pg.goto(BASE + "#home"); pg.wait_for_selector(".home__hello")
    pg.click("button:has-text('Verrouiller maintenant')")
    pg.wait_for_selector(".lock")
    pg.click("button:has-text('Mot de passe oublié')")
    pg.wait_for_selector("header .brand")
    pg.goto(BASE + "#workspace"); pg.wait_for_selector(".course")
    assert pg.locator(".course").count() == 8, "les données doivent être revenues au départ"
    assert pg.evaluate("localStorage.getItem('studenthub:lock')") is None
    b.close()
print("ERREURS:", errors)
assert not errors
print("E2E APP OK")
