from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
import sys
c = canvas.Canvas(sys.argv[1], pagesize=A4)
c.setTitle("Algèbre - Anneaux et modules"); c.setAuthor("Daniel Guin")
for i in range(1, 4):
    c.setFont("Helvetica-Bold", 40); c.drawString(80, 700, f"Chapitre {i}")
    c.setFont("Helvetica", 18); c.drawString(80, 650, f"Texte de la page {i} du cours.")
    c.showPage()
c.save()
