import os
import re
from datetime import datetime

DOCS_DIR = 'documents'

def build_html_tree(base_path, relative_path=""):
    html_output = ""
    current_dir = os.path.join(base_path, relative_path)
    
    if not os.path.exists(current_dir):
        return ""

    # Ottieni cartelle e file, ignorando file nascosti
    items = sorted([i for i in os.listdir(current_dir) if not i.startswith('.')])
    
    dirs = [d for d in items if os.path.isdir(os.path.join(current_dir, d))]
    files = [f for f in items if os.path.isfile(os.path.join(current_dir, f))]

    # 1. Stampa SOLO i file .pdf
    valid_files = [f for f in files if f.endswith('.pdf')]
    if valid_files:
        html_output += '    <div class="doc">\n'
        for f in valid_files:
            file_path = os.path.join(DOCS_DIR, relative_path, f).replace('\\', '/')
            name_without_ext = os.path.splitext(f)[0]
            html_output += f'        <p><a href="{file_path}" target="_blank">{name_without_ext}</a></p>\n'
        html_output += '    </div>\n'

    # 2. Esplora ricorsivamente
    for d in dirs:
        dir_title = d.replace('-', ' ').title()
        depth = len(relative_path.split(os.sep)) if relative_path else 0
        header_level = min(depth + 2, 6) 
        
        sub_content = build_html_tree(base_path, os.path.join(relative_path, d))
        
        if sub_content.strip():
            html_output += f'\n    <h{header_level}>{dir_title}</h{header_level}>\n'
            html_output += sub_content

    return html_output

# Genera l'HTML dell'albero dei documenti
docs_html = build_html_tree(DOCS_DIR)

# Leggi il file HTML
with open('index.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

# ---- CONFIGURAZIONE DEI MARKER ----
start_marker = "<!-- START_DOCS -->"
end_marker = "<!-- END_DOCS -->"

start_idx = html_content.find(start_marker)
end_idx = html_content.find(end_marker)

if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
    # Manteniamo i marker stessi e sostituiamo solo il contenuto in mezzo
    parte_prima = html_content[:start_idx + len(start_marker)]
    parte_dopo = html_content[end_idx:]
    
    # Ricostruzione: marker inizio + a capo + nuovi link + spaziature + marker fine
    html_content = f"{parte_prima}\n{docs_html}    {parte_dopo}"
else:
    print(f"ERRORE: Marker non trovati! Start: {start_idx}, End: {end_idx}")

# ... (resto del codice per l'aggiornamento della data)

# Aggiorna la data
now = datetime.now().strftime("%d/%m/%Y %H:%M")
html_content = re.sub(
    r'<p id="last-update">Ultimo aggiornamento: .*?</p>',
    f'<p id="last-update">Ultimo aggiornamento: {now}</p>',
    html_content
)

# Scrivi il file HTML sovrascrivendolo
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html_content)

print("index.html aggiornato con successo!")