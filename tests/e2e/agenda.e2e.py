# Navigateur réel : glisser pour créer, une seule occurrence d'une série, tuteur et Apprendre (CSP stricte, aucune erreur console).
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1100, "height": 900})
    pg = ctx.new_page()
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    pg.goto("http://localhost:8765/index.html#calendar")
    pg.wait_for_selector("h1")
    pg.click(".seg__btn:text-is('Semaine')")
    col = pg.locator(".wk__col").nth(2)
    box = col.bounding_box()
    # glisser de 9 h à 11 h (48 px par heure) : souris immédiate
    x = box["x"] + 20
    pg.mouse.move(x, box["y"] + 9 * 48 + 4)
    pg.mouse.down()
    pg.mouse.move(x, box["y"] + 10 * 48 + 4, steps=4)
    assert pg.locator(".wk__drag").count() == 1
    pg.mouse.move(x, box["y"] + 11 * 48 - 4, steps=4)
    pg.mouse.up()
    dlg = pg.locator("dialog[open]")
    dlg.wait_for()
    assert dlg.locator("input[type=time]").nth(0).input_value() == "09:00"
    assert dlg.locator("input[type=time]").nth(1).input_value() == "11:00"
    dlg.locator("input[type=text]").first.fill("Cours tracé")
    # série hebdomadaire
    dlg.locator("select").filter(has=pg.locator("option", has_text="Toutes les semaines")).select_option(label="Toutes les semaines")
    dlg.locator("button[type=submit]").click()
    assert pg.locator(".wk__col button.wk__ev", has_text="Cours tracé").count() >= 1
    assert pg.locator(".wk__drag").count() == 0

    # une seule occurrence : choix, puis titre de cette occurrence seulement
    pg.locator(".wk__col button.wk__ev", has_text="Cours tracé").first.click()
    pg.get_by_role("button", name="Cet événement seulement").click()
    dlg = pg.locator("dialog[open]"); dlg.wait_for()
    dlg.locator("input[type=text]").first.fill("Cours tracé (TD)")
    dlg.locator("button[type=submit]").click()
    assert pg.locator(".wk__col button.wk__ev", has_text="Cours tracé (TD)").count() == 1
    pg.click("button[aria-label='Suivant']")
    assert pg.locator(".wk__col button.wk__ev", has_text="Cours tracé").count() >= 1
    assert pg.locator(".wk__col button.wk__ev", has_text="(TD)").count() == 0, "la semaine suivante garde le titre de la série"

    # Mémorisation : leçon, Apprendre (fiche, podcast, couches), Tuteur
    pg.goto("http://localhost:8765/index.html#revision")
    pg.wait_for_selector("h1")
    pg.get_by_role("button", name="+ Leçon").click()
    pg.locator("dialog input[type=text]").fill("Moments de force")
    pg.locator("dialog button[type=submit]").click()
    for title in ["Cartographie en couches", "Fiche", "Podcast", "Source du cours"]:
        assert title in pg.inner_text("main"), title
    pg.fill("textarea[aria-label='Source du cours']", "Le moment d'une force vaut r fois F.")
    pg.locator("textarea[aria-label='Source du cours']").blur()
    pg.get_by_role("button", name="Tuteur").click()
    assert pg.get_by_role("button", name="1. Copier le prompt du tuteur").count() == 1
    pg.locator("textarea[aria-label='Réponse du tuteur']").fill('Bravo [DARACE]\n```session_log\n{"topic":"Moments","level":"novice","mastered":["Définition"],"weak":["Signe"],"recall_questions":["Que vaut la somme des moments ?"],"next_step":"exercice","confidence_gap":""}\n```')
    pg.get_by_role("button", name="Enregistrer la session").click()
    assert "Session enregistrée" in pg.locator("[data-tutor-msg]").inner_text()
    assert "Moments" in pg.inner_text("main")
    pg.goto("http://localhost:8765/index.html#home")
    pg.wait_for_selector("section[data-widget='xp']")
    assert "Niveau 1" in pg.locator("section[data-widget='xp']").inner_text()
    assert not errors, errors
    print("agenda/tuteur e2e OK")
    b.close()
