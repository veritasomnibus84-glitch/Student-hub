# Navigateur réel : tracé sur plusieurs jours, déplacement par glisser (événement simple et série), CSP stricte.
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1200, "height": 900})
    pg = ctx.new_page()
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    pg.goto("http://localhost:8765/index.html#calendar")
    pg.wait_for_selector("h1")
    pg.click(".seg__btn:text-is('Semaine')")
    cols = pg.locator(".wk__col")
    box = [cols.nth(i).bounding_box() for i in range(7)]
    y9 = box[0]["y"] + 9 * 48 + 4

    # 1) tracé de la colonne 1 (9 h) à la colonne 3 (11 h) : événement sur plusieurs jours
    pg.mouse.move(box[1]["x"] + 20, y9)
    pg.mouse.down()
    pg.mouse.move(box[2]["x"] + 20, y9 + 60, steps=6)
    assert pg.locator(".wk__drag").count() >= 2, pg.locator(".wk__drag").count()
    pg.mouse.move(box[3]["x"] + 20, box[0]["y"] + 11 * 48 - 4, steps=6)
    pg.mouse.up()
    dlg = pg.locator("dialog[open]"); dlg.wait_for()
    dates = dlg.locator("input[type=date]")
    d0, d1 = dates.nth(0).input_value(), dates.nth(1).input_value()
    assert d0 and d1 and d1 > d0, (d0, d1)
    assert dlg.locator("input[type=time]").nth(0).input_value() == "09:00"
    dlg.locator("input[type=text]").first.fill("Stage long")
    dlg.locator("button[type=submit]").click()
    assert cols.nth(1).locator("button.wk__ev", has_text="Stage long").count() == 1, "premier jour"
    assert pg.locator(".wk__allday .ev", has_text="Stage long").count() == 1, "jour du milieu en « journée »"
    assert cols.nth(3).locator("button.wk__ev", has_text="Stage long").count() == 1, "dernier jour"

    # 2) événement simple tracé puis déplacé à la souris : colonne 5, 14 h
    pg.mouse.move(box[5]["x"] + 20, box[0]["y"] + 10 * 48 + 4)
    pg.mouse.down(); pg.mouse.move(box[5]["x"] + 20, box[0]["y"] + 11 * 48 - 4, steps=4); pg.mouse.up()
    pg.locator("dialog[open]").wait_for()
    pg.locator("dialog[open] input[type=text]").first.fill("Rendez-vous")
    pg.locator("dialog[open] button[type=submit]").click()
    ev = cols.nth(5).locator("button.wk__ev", has_text="Rendez-vous")
    assert ev.count() == 1
    eb = ev.bounding_box()
    pg.mouse.move(eb["x"] + 10, eb["y"] + 10); pg.mouse.down()
    pg.mouse.move(box[6]["x"] + 20, eb["y"] + 10 + 4 * 48, steps=8)
    assert pg.locator(".wk__ghost").count() == 1
    pg.mouse.up()
    assert pg.locator("dialog[open]").count() == 0, "un déplacement n'ouvre pas la fiche"
    moved = cols.nth(6).locator("button.wk__ev", has_text="Rendez-vous")
    assert moved.count() == 1 and cols.nth(5).locator("button.wk__ev", has_text="Rendez-vous").count() == 0
    assert "14:00" in moved.inner_text(), moved.inner_text()
    # un simple clic sur l'événement ouvre toujours sa fiche
    moved.click(); assert pg.locator("dialog[open]").count() == 1
    pg.keyboard.press("Escape")

    # 3) série : déplacer une occurrence ne change que celle-ci
    pg.mouse.move(box[0]["x"] + 20, box[0]["y"] + 16 * 48 + 4)
    pg.mouse.down(); pg.mouse.move(box[0]["x"] + 20, box[0]["y"] + 17 * 48 - 4, steps=4); pg.mouse.up()
    dlg = pg.locator("dialog[open]"); dlg.wait_for()
    dlg.locator("input[type=text]").first.fill("Cours répété")
    dlg.locator("select").filter(has=pg.locator("option", has_text="Toutes les semaines")).select_option(label="Toutes les semaines")
    dlg.locator("button[type=submit]").click()
    occ = cols.nth(0).locator("button.wk__ev", has_text="Cours répété"); assert occ.count() == 1
    ob = occ.bounding_box()
    pg.mouse.move(ob["x"] + 10, ob["y"] + 10); pg.mouse.down()
    pg.mouse.move(box[2]["x"] + 20, ob["y"] + 10, steps=8); pg.mouse.up()
    assert cols.nth(2).locator("button.wk__ev", has_text="Cours répété").count() == 1
    assert "cet événement a été déplacé" in pg.inner_text("body")
    pg.click("button[aria-label='Suivant']")
    assert pg.locator(".wk__col").nth(0).locator("button.wk__ev", has_text="Cours répété").count() == 1, "la semaine suivante est inchangée"
    assert not errors, errors
    print("agenda2 e2e OK")
    b.close()
