# Navigateur réel (CSP stricte, 390 px) : sous-tâches, dépendances, projets, rapports, objectifs reliés.
import json
from playwright.sync_api import sync_playwright

URL = "http://localhost:8765/index.html"

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 800}, has_touch=True)
    pg = ctx.new_page()
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

    state = {
        "todos": [
            {"id": "t1", "name": "Dossier d'info", "status": "A faire", "deadline": "2020-01-01", "projectId": "p1", "effort": 120},
            {"id": "t2", "name": "Plan du dossier", "status": "A faire", "parentId": "t1"},
            {"id": "t3", "name": "Rédiger", "status": "A faire", "blockedBy": ["t4"], "projectId": "p1"},
            {"id": "t4", "name": "Chercher les sources", "status": "A faire", "projectId": "p1"},
        ],
        "projects": [{"id": "p1", "name": "Projet info", "color": "teal"}],
        "goals": [{"id": "g1", "title": "Valider S1", "start": "2026-10-01", "amount": 6, "unit": "months", "mode": "auto", "links": [{"kind": "project", "id": "p1"}]}],
    }
    pg.goto(URL + "#home")
    pg.evaluate("s => localStorage.setItem('studenthub:v1', s)", json.dumps(state))
    pg.goto(URL + "#workspace")
    pg.reload()
    pg.wait_for_selector(".seg")
    assert pg.locator(".seg__btn").count() == 3
    assert pg.locator("nav a").count() == 12, "pas de 13e onglet"

    # Tableau : parent avec compteur, tâche bloquée grisée, sous-tâche rangée sous son parent
    pg.get_by_role("tab", name="Tableau").click()
    pg.wait_for_selector("li.card")
    parent = pg.locator("li.card", has_text="Dossier d'info")
    assert "0/1" in parent.inner_text()
    assert parent.locator("details.card__subs").count() == 1
    assert pg.locator("li.card", has_text="Plan du dossier").count() == 1, "la sous-tâche n'a pas sa propre carte"
    blocked = pg.locator("li.card--blocked", has_text="Rédiger")
    assert blocked.count() == 1 and "Chercher les sources" in blocked.inner_text()

    # Terminer la sous-tâche termine le parent (règle commune)
    parent.locator("summary").click()
    parent.locator(".card__subs input[type=checkbox]").first.check()
    pg.wait_for_selector("li.card:has-text('Dossier d\\'info') >> text=1/1")
    assert pg.locator(".col--done li.card", has_text="Dossier d'info").count() == 1

    # Démarrer une tâche bloquée : confirmation, Annuler ne change rien
    dialogs = []
    pg.once("dialog", lambda d: (dialogs.append(d.message), d.dismiss()))
    blocked.locator(".card__next").click()
    pg.wait_for_timeout(300)
    assert dialogs and "Chercher les sources" in dialogs[0], dialogs
    assert pg.locator(".col--todo li.card--blocked", has_text="Rédiger").count() == 1

    # Terminer le blocage : toast « Débloque » et la carte n'est plus grisée
    nxt = pg.locator("button[aria-label^='Passer « Chercher les sources »']")
    nxt.click()
    nxt.click()
    pg.wait_for_selector(".toast")
    assert "Débloque" in pg.locator(".toast").first.inner_text()
    assert pg.locator("li.card--blocked").count() == 0

    # Projets : liste, page, avancement, objectifs liés
    pg.get_by_role("tab", name="Projets").click()
    assert pg.locator("li", has_text="Projet info").count() >= 1
    pg.locator("button.course", has_text="Projet info").click()
    pg.wait_for_selector("input[aria-label='Nom du projet']")
    txt = pg.inner_text("main")
    assert "Avancement" in txt and "Objectifs liés" in txt and "Valider S1" in txt, txt
    pg.get_by_role("button", name="← Projets").click()

    # Rapports : six sections, donut, retard cliquable, graphique de charge
    pg.get_by_role("tab", name="Rapports").click()
    pg.wait_for_selector("svg.donut")
    assert pg.locator("section.block h2").count() == 6
    assert pg.locator("svg.chart").count() >= 2
    assert pg.locator("section.block", has_text="En retard").locator("button.linkish", has_text="Dossier d'info").count() == 0, "le dossier est terminé : plus en retard"

    # Objectifs : statut et avancement
    pg.goto(URL + "#goals")
    pg.wait_for_selector(".goal")
    gt = pg.inner_text(".goal")
    assert "Avancement :" in gt and "Projet · Projet info" in gt, gt
    # fenêtre de l'objectif : curseur et liens selon le mode
    pg.locator(".goal").get_by_role("button", name="Modifier").click()
    pg.wait_for_selector("dialog[open]")
    assert pg.locator("dialog select[aria-label='Progression']").input_value() == "auto"
    assert pg.locator("dialog input[type=range]").is_hidden()
    pg.locator("dialog select[aria-label='Progression']").select_option("manual")
    assert pg.locator("dialog input[type=range]").is_visible()
    pg.keyboard.press("Escape")

    # Home : les trois nouveaux widgets
    pg.goto(URL + "#home")
    pg.wait_for_selector("section[data-widget]")
    for w in ("ready", "late", "load"):
        assert pg.locator(f"section[data-widget={w}]").count() == 1, w

    # pas de débordement horizontal sur téléphone
    pg.goto(URL + "#workspace")
    pg.get_by_role("tab", name="Rapports").click()
    pg.wait_for_selector("svg.donut")
    assert pg.evaluate("document.documentElement.scrollWidth") <= 391

    assert not errors, errors
    print("projects e2e OK")
    b.close()
