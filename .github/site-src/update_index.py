import os
import re
from datetime import datetime
import shutil

# Configurazione percorsi
# Lo script viene eseguito dalla root del progetto
ROOT_DIR = '.'
SITE_SRC = os.path.join('.github', 'site-src')
BUILD_DIR = '_site'
TEMPLATE_PATH = os.path.join(SITE_SRC, 'index_template.html')

# Cartelle e file da escludere dalla scansione e dal deploy finale
# Non copiamo la logica del sito nel deploy finale (già usata per generare)
EXCLUDE_DIRS = {'.github', '.git', BUILD_DIR, 'scripts', 'website', 'assets', '__pycache__', '.pytest_cache'}
EXCLUDE_FILES = {'.gitignore', 'prompt.tex', 'README.md', 'index.html'}

def build_html_tree(base_path, relative_path=""):
    html_output = ""
    current_dir = os.path.normpath(os.path.join(base_path, relative_path))
    
    if not os.path.exists(current_dir):
        return ""

    # Ottieni cartelle e file, ignorando file nascosti e cartelle escluse
    items = sorted([i for i in os.listdir(current_dir) if not i.startswith('.')])
    
    dirs = [d for d in items if os.path.isdir(os.path.join(current_dir, d)) and d not in EXCLUDE_DIRS]
    files = [f for f in items if os.path.isfile(os.path.join(current_dir, f)) and f not in EXCLUDE_FILES]

    # 1. Stampa SOLO i file .pdf
    valid_files = [f for f in files if f.endswith('.pdf')]
    if valid_files:
        html_output += '    <div class="doc">\n'
        for f in valid_files:
            if relative_path:
                # Forza lo slash (/) per i percorsi URL anche su Windows
                file_path = os.path.join(relative_path, f).replace(os.sep, '/')
            else:
                file_path = f
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

def main():
    # Pulisci o crea la cartella di output
    if os.path.exists(BUILD_DIR):
        shutil.rmtree(BUILD_DIR)
    os.makedirs(BUILD_DIR)

    # Genera l'albero HTML dei documenti
    docs_html = build_html_tree(ROOT_DIR)

    # Leggi il template HTML
    if not os.path.exists(TEMPLATE_PATH):
        print(f"ERRORE: Template non trovato in {TEMPLATE_PATH}")
        return

    with open(TEMPLATE_PATH, 'r', encoding='utf-8') as f:
        html_content = f.read()

    # ---- CONFIGURAZIONE DEI MARKER ----
    start_marker = "<!-- START_DOCS -->"
    end_marker = "<!-- END_DOCS -->"

    start_idx = html_content.find(start_marker)
    end_idx = html_content.find(end_marker)

    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        parte_prima = html_content[:start_idx + len(start_marker)]
        parte_dopo = html_content[end_idx:]
        html_content = f"{parte_prima}\n{docs_html}    {parte_dopo}"
    else:
        print(f"ERRORE: Marker non trovati nel template! Start: {start_idx}, End: {end_idx}")
        return

    # Aggiorna la data di ultimo aggiornamento
    now = datetime.now().strftime("%d/%m/%Y %H:%M")
    html_content = re.sub(
        r'<p id="last-update">Ultimo aggiornamento: .*?</p>',
        f'<p id="last-update">Ultimo aggiornamento: {now}</p>',
        html_content
    )

    # Scrivi il file index.html finale nella cartella _site
    with open(os.path.join(BUILD_DIR, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(html_content)

    # Copia i file statici necessari (CSS e Asset) in _site
    # CSS
    css_src = os.path.join(SITE_SRC, 'style.css')
    if os.path.exists(css_src):
        shutil.copy2(css_src, os.path.join(BUILD_DIR, 'style.css'))
    
    # Asset (Logo ecc)
    assets_src = os.path.join(SITE_SRC, 'assets')
    if os.path.exists(assets_src):
        shutil.copytree(assets_src, os.path.join(BUILD_DIR, 'assets'))

    # Copia tutte le cartelle dei documenti (es. candidatura/) e file PDF in root
    for item in os.listdir(ROOT_DIR):
        if item not in EXCLUDE_DIRS and item not in EXCLUDE_FILES and not item.startswith('.'):
            s = os.path.join(ROOT_DIR, item)
            d = os.path.join(BUILD_DIR, item)
            if os.path.isdir(s):
                shutil.copytree(s, d)
            elif item.endswith('.pdf'):
                shutil.copy2(s, d)

    print("Sito generato con successo nella cartella _site/")

if __name__ == "__main__":
    main()
