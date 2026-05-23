import os
import re
from datetime import datetime
import shutil

# Configurazione percorsi
ROOT_DIR = '.'
SITE_SRC = os.path.join('.github', 'site-src')
BUILD_DIR = '_site'
TEMPLATE_PATH = os.path.join(SITE_SRC, 'index_template.html')

EXCLUDE_DIRS = {'.github', '.git', BUILD_DIR, 'scripts', 'website', 'assets', '__pycache__', '.pytest_cache'}
EXCLUDE_FILES = {'.gitignore', 'prompt.tex', 'README.md', 'index.html'}

# Configurazione delle sezioni con i loro percorsi
SECTIONS = {
    'candidatura': 'documents/candidatura',
    'rtb': 'documents/rtb', 
    'pb': 'documents/pb'
}

def build_dropdown_tree(base_path, relative_path=""):
    """Genera dropdown annidati per i documenti (stile moderno)"""
    html_output = ""
    current_dir = os.path.normpath(os.path.join(base_path, relative_path))
    
    if not os.path.exists(current_dir):
        return ""

    items = sorted([i for i in os.listdir(current_dir) if not i.startswith('.')])
    
    # Lettera di Presentazione in cima
    for i, item in enumerate(items):
        if "lettera di presentazione" in item.lower():
            items.insert(0, items.pop(i))
            break
    
    dirs = [d for d in items if os.path.isdir(os.path.join(current_dir, d)) and d not in EXCLUDE_DIRS]
    files = [f for f in items if os.path.isfile(os.path.join(current_dir, f)) and f not in EXCLUDE_FILES]

    # File PDF nella cartella corrente
    valid_files = [f for f in files if f.endswith('.pdf')]
    
    # Se ci sono file, crea un dropdown
    if valid_files:
        folder_name = os.path.basename(current_dir).replace('-', ' ').title()
        if relative_path == "":
            folder_name = "Documenti"
        
        # Scegli l'icona
        icon = "fa-folder-open"
        if "verbale" in folder_name.lower():
            icon = "fa-calendar-alt"
        elif "interni" in folder_name.lower():
            icon = "fa-users"
        elif "esterni" in folder_name.lower():
            icon = "fa-handshake"
        
        html_output += '<div class="inner-dropdown">\n'
        html_output += f'    <div class="inner-dropdown-header">\n'
        html_output += f'        <h3><i class="fas {icon}"></i>{folder_name}</h3>\n'
        html_output += f'        <i class="fas fa-chevron-down inner-dropdown-icon"></i>\n'
        html_output += f'    </div>\n'
        html_output += f'    <div class="inner-dropdown-content">\n'
        html_output += f'        <div class="inner-content">\n'
        html_output += f'            <div class="file-list">\n'
        
        # Ordina file per data
        def get_sort_key(filename):
            date_match = re.search(r'(\d{4})[-_](\d{2})[-_](\d{2})', filename)
            if date_match:
                return (date_match.group(1) + date_match.group(2) + date_match.group(3), filename)
            return (str(os.path.getmtime(os.path.join(current_dir, filename))), filename)
        
        valid_files.sort(key=get_sort_key, reverse=True)
        
        for f in valid_files:
            if relative_path:
                file_path = os.path.join(relative_path, f).replace(os.sep, '/')
            else:
                file_path = f
            name_without_ext = os.path.splitext(f)[0]
            html_output += f'                <div class="file-item">\n'
            html_output += f'                    <a href="{file_path}" target="_blank">\n'
            html_output += f'                        <i class="fas fa-file-pdf"></i>\n'
            html_output += f'                        {name_without_ext}\n'
            html_output += f'                        <span class="file-badge">PDF</span>\n'
            html_output += f'                    </a>\n'
            html_output += f'                </div>\n'
        
        html_output += f'            </div>\n'
        html_output += f'        </div>\n'
        html_output += f'    </div>\n'
        html_output += f'</div>\n'
    
    # Ricorsione per le sottocartelle
    for d in dirs:
        sub_content = build_dropdown_tree(base_path, os.path.join(relative_path, d))
        if sub_content.strip():
            html_output += sub_content

    return html_output

def update_section(html_content, section_name, docs_path):
    """Aggiorna una specifica sezione del sito"""
    start_marker = f"<!-- START_DOCS_{section_name.upper()} -->"
    end_marker = f"<!-- END_DOCS_{section_name.upper()} -->"
    
    start_idx = html_content.find(start_marker)
    end_idx = html_content.find(end_marker)
    
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        # Genera l'HTML per questa sezione
        docs_html = build_dropdown_tree(docs_path)
        
        if not docs_html.strip():
            docs_html = '    <div class="info-box"><i class="fas fa-info-circle"></i> Nessun documento disponibile in questa sezione.</div>\n'
        
        parte_prima = html_content[:start_idx + len(start_marker)]
        parte_dopo = html_content[end_idx:]
        
        return f"{parte_prima}\n{docs_html}    {parte_dopo}"
    
    # Se il marker specifico non esiste, prova con quello generico
    start_marker_generic = "<!-- START_DOCS -->"
    end_marker_generic = "<!-- END_DOCS -->"
    
    start_idx = html_content.find(start_marker_generic)
    end_idx = html_content.find(end_marker_generic)
    
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        docs_html = build_dropdown_tree(docs_path)
        if not docs_html.strip():
            docs_html = '    <div class="info-box"><i class="fas fa-info-circle"></i> Nessun documento disponibile in questa sezione.</div>\n'
        
        parte_prima = html_content[:start_idx + len(start_marker_generic)]
        parte_dopo = html_content[end_idx:]
        
        return f"{parte_prima}\n{docs_html}    {parte_dopo}"
    
    return html_content

def main():
    # Pulisci o crea la cartella di output
    if os.path.exists(BUILD_DIR):
        shutil.rmtree(BUILD_DIR)
    os.makedirs(BUILD_DIR)

    # Leggi il template HTML
    if not os.path.exists(TEMPLATE_PATH):
        print(f"ERRORE: Template non trovato in {TEMPLATE_PATH}")
        return

    with open(TEMPLATE_PATH, 'r', encoding='utf-8') as f:
        html_content = f.read()

    # Aggiorna ogni sezione
    for section_name, docs_path in SECTIONS.items():
        html_content = update_section(html_content, section_name, docs_path)

    # Aggiorna la data
    now = datetime.now().strftime("%d/%m/%Y %H:%M")
    html_content = re.sub(
        r'<p id="last-update">Ultimo aggiornamento: .*?</p>',
        f'<p id="last-update">Ultimo aggiornamento: {now}</p>',
        html_content
    )

    # Scrivi il file index.html finale
    with open(os.path.join(BUILD_DIR, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(html_content)

    # Copia i file statici
    css_src = os.path.join(SITE_SRC, 'style.css')
    if os.path.exists(css_src):
        shutil.copy2(css_src, os.path.join(BUILD_DIR, 'style.css'))
    
    assets_src = os.path.join(SITE_SRC, 'assets')
    if os.path.exists(assets_src):
        shutil.copytree(assets_src, os.path.join(BUILD_DIR, 'assets'))

    # Copia i documenti
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
