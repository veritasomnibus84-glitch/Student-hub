# Test de bout en bout (navigateur réel) : python3 -m http.server 8765 dans le dossier, puis python3 tests/e2e/library.e2e.py
import subprocess, tempfile, os
from playwright.sync_api import sync_playwright, expect
BASE = "http://localhost:8765/index.html"
pdf = os.path.join(tempfile.mkdtemp(), "Algebre2.pdf")
subprocess.run(["python3", "tests/e2e/make_pdf.py", pdf], check=True)
errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 800})
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
    pg.on("console", lambda m: errors.append("console: " + m.text) if m.type == "error" else None)
    pg.goto(BASE + "#library")
    pg.wait_for_selector("text=Ta bibliothèque est vide")
    pg.set_input_files("input[type=file]", pdf)
    pg.wait_for_selector(".book__title")
    pg.wait_for_selector("img.cover")
    assert pg.inner_text(".book__title") == "Algèbre - Anneaux et modules", pg.inner_text(".book__title")
    assert "3 p." in pg.inner_text(".book"), pg.inner_text(".book")
    assert pg.get_attribute("img.cover", "src").startswith("data:image/jpeg")
    pg.screenshot(path="/tmp/lib-grid.png")
    # doublon : ignoré
    pg.set_input_files("input[type=file]", pdf)
    pg.wait_for_selector("text=déjà présent")
    assert pg.locator(".book").count() == 1
    # lecteur
    pg.click(".book__open")
    pg.wait_for_selector("dialog.reader[open] canvas")
    pg.wait_for_selector(".reader__status:empty", state="attached")
    expect(pg.locator(".reader__num")).to_have_value("1")
    pg.screenshot(path="/tmp/lib-reader.png")
    pg.click("button[aria-label='Page suivante']")
    expect(pg.locator(".reader__num")).to_have_value("2")
    pg.click("dialog.reader >> text=Signet")
    expect(pg.locator("dialog.reader >> text=Signet ✓")).to_be_visible()
    pg.click("dialog.reader >> text=Fermer")
    pg.wait_for_selector("dialog.reader", state="detached")
    # progression 2/3 = 67 %
    assert pg.get_attribute("progress", "value") == "67", pg.get_attribute("progress", "value")
    # signets
    pg.click(".seg__btn:text-is('Signets')")
    pg.wait_for_selector("text=page 2")
    # favoris
    pg.click(".seg__btn:text-is('Bibliothèque')")
    pg.click("button[aria-label^='Ajouter']")
    pg.click(".seg__btn:text-is('Favoris')")
    assert pg.locator(".book").count() == 1
    # persistance après rechargement (catalogue + fichier)
    pg.reload(); pg.wait_for_selector(".book__title")
    pg.wait_for_selector(".book--away", state="detached")
    pg.click(".seg__btn:text-is('Récents')"); assert pg.locator(".book").count() == 1
    # modes d'affichage
    pg.click(".seg__btn:text-is('Bibliothèque')")
    for mode in ["cover", "list", "condensed", "grid"]:
        pg.select_option("select[aria-label='Affichage']", mode)
        assert pg.locator(".book").count() == 1
        if mode == "list": pg.screenshot(path="/tmp/lib-list.png")
    # export du catalogue sans le PDF
    state = pg.evaluate("localStorage.getItem('studenthub:v1')")
    assert "Algèbre" in state and "%PDF" not in state
    # thème sombre
    ctx2 = b.new_context(viewport={"width": 390, "height": 800}, color_scheme="dark")
    p2 = ctx2.new_page(); p2.goto(BASE + "#library"); p2.set_input_files("input[type=file]", pdf)
    p2.wait_for_selector("img.cover"); p2.screenshot(path="/tmp/lib-dark.png")
    b.close()
print("ERREURS:", errors)
assert not errors
print("E2E OK")
