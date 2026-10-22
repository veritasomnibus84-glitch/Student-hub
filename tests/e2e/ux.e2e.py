# Navigateur réel (CSP stricte) : onglet Paramètres, widgets, menu contextuel au clic droit et à l'appui long.
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 800}, has_touch=True)
    pg = ctx.new_page()
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    pg.goto("http://localhost:8765/index.html#home")
    pg.wait_for_selector("section[data-widget]")
    assert pg.locator("nav a").count() == 12, pg.locator("nav a").count()
    assert pg.locator("section[data-widget]").count() == 10

    # Workspace : un to-do, clic droit -> menu positionné (CSS posé sans style inline), action « Statut »
    pg.goto("http://localhost:8765/index.html#workspace")
    pg.wait_for_selector("h1")
    pg.get_by_role("button", name="+ To-do").first.click() if pg.get_by_role("button", name="+ To-do").count() else None
    if pg.locator("li.card").count() == 0:
        pg.locator("dialog").wait_for(timeout=2000)
        pg.locator("dialog input[type=text]").first.fill("Rendre le TP")
        pg.locator("dialog button[type=submit]").click()
    card = pg.locator("li.card").first
    card.click(button="right")
    assert pg.locator(".ctx").count() == 1
    assert pg.locator(".ctx [role=menuitem]", has_text="Dupliquer").count() == 1
    box = pg.locator(".ctx").bounding_box()
    assert box and box["x"] >= 0 and box["x"] + box["width"] <= 390 + 1
    pg.keyboard.press("Escape")
    assert pg.locator(".ctx").count() == 0
    # bouton ⋯
    pg.locator("li.card .menu-btn").first.click()
    assert pg.locator(".ctx").count() == 1
    pg.locator(".ctx [role=menuitem]", has_text="Dupliquer").click()
    assert pg.locator("li.card", has_text="(copie)").count() >= 1

    # barre de widgets en bas d'un onglet + personnalisation
    pg.goto("http://localhost:8765/index.html#notes")
    pg.wait_for_selector(".widgets")
    assert pg.locator(".widgets details").count() == 2
    pg.get_by_role("button", name="Personnaliser").click()
    pg.locator("dialog button[type=submit]").click()

    # Paramètres
    pg.goto("http://localhost:8765/index.html#settings")
    pg.wait_for_selector("h1")
    assert "Compte et synchronisation" in pg.inner_text("main")
    assert pg.locator("input[aria-label='Mot de passe']").count() == 1
    # un échec réseau est expliqué, sans casser la page
    pg.fill("input[aria-label='Adresse du projet']", "https://exemple-inexistant.supabase.co")
    pg.fill("input[aria-label='Clé anon public']", "cle")
    pg.fill("input[aria-label='E-mail']", "a@b.c")
    pg.fill("input[aria-label='Mot de passe']", "secret1")
    pg.get_by_role("button", name="Se connecter").click()
    pg.wait_for_function("(() => { const e = document.querySelector('main p[role=status]'); return !!e && e.textContent.length > 0 && !e.textContent.endsWith('…'); })()", timeout=15000)
    msg = pg.locator("main p[role=status]").first.inner_text()
    assert "Connexion impossible" in msg or "incorrect" in msg or "Accès" in msg or "Erreur" in msg or "introuvable" in msg.lower(), msg
    print("ux e2e OK :", msg)
    b.close()
    # les erreurs de réseau attendues vers le faux projet ne comptent pas
    real = [e for e in errors if "exemple-inexistant" not in e and "Failed to load resource" not in e and "ERR_" not in e]
    assert not real, real
