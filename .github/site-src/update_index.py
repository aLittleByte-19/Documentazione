import os
import re
import subprocess
from datetime import datetime
import shutil
from html import escape
from urllib.parse import quote

# Configurazione percorsi
# Lo script viene eseguito dalla root del progetto
ROOT_DIR = '.'
SITE_SRC = os.path.join('.github', 'site-src')
BUILD_DIR = '_site'
TEMPLATE_PATH = os.path.join(SITE_SRC, 'index_template.html')
PDF_VIEWER_TEMPLATE_PATH = os.path.join(SITE_SRC, 'pdf-viewer-template.html')

# Cartelle e file da escludere dalla scansione e dal deploy finale
EXCLUDE_DIRS = {'.github', '.git', BUILD_DIR, 'scripts', 'website', 'assets', '__pycache__', '.pytest_cache'}
EXCLUDE_FILES = {'.gitignore', 'prompt.tex', 'README.md', 'index.html'}
EXCLUDE_PDFS = {'Presentazione tecnologie.pdf'}

# Formati Office convertibili in PDF con LibreOffice al momento della build.
# I .key di Keynote non sono convertibili su Linux: esportarli in .pptx o .pdf.
CONVERTIBLE_EXTENSIONS = {'.pptx', '.ppt', '.odp', '.docx', '.odt'}
SOFFICE_FALLBACK_PATHS = ('/Applications/LibreOffice.app/Contents/MacOS/soffice',)

# Popolato in main() con i sorgenti Office convertiti con successo
CONVERTED_SOURCES = set()
ROOT_SECTION_ORDER = {'rtb': 0, 'diapositive': 1, 'candidatura': 2}
ACRONYMS = {'adr': 'AdR', 'pb': 'PB', 'poc': 'PoC', 'rtb': 'RTB'}
LOWERCASE_TITLE_WORDS = {
    'a', 'ad', 'al', 'allo', 'ai', 'agli', 'alla', 'alle',
    'con', 'da', 'dal', 'dallo', 'dai', 'dagli', 'dalla', 'dalle',
    'de', 'del', 'dello', 'dei', 'degli', 'della', 'delle',
    'di', 'e', 'in', 'nel', 'nello', 'nei', 'negli', 'nella', 'nelle',
    'o', 'per', 'su', 'sul', 'sullo', 'sui', 'sugli', 'sulla', 'sulle',
    'tra', 'fra'
}

def format_dir_title(dirname):
    text = dirname.replace('-', ' ').replace('_', ' ')
    tokens = re.split(r'(\s+)', text.strip())
    formatted = []
    word_index = 0

    for token in tokens:
        if not token or token.isspace():
            formatted.append(token)
            continue

        normalized = token.lower()
        if normalized in ACRONYMS:
            formatted.append(ACRONYMS[normalized])
        elif word_index > 0 and normalized in LOWERCASE_TITLE_WORDS:
            formatted.append(normalized)
        else:
            formatted.append(normalized.capitalize())
        word_index += 1

    return ''.join(formatted)

def get_dir_id(relative_path):
    slug = relative_path.replace(os.sep, ' ').lower()
    slug = re.sub(r'[^a-z0-9]+', '-', slug).strip('-')
    return slug

def sort_root_sections(item):
    normalized = item.lower()
    return (ROOT_SECTION_ORDER.get(normalized, len(ROOT_SECTION_ORDER)), normalized)

def to_url_path(path):
    return quote(path.replace(os.sep, '/'), safe='/')

def get_pdf_viewer_path(pdf_path):
    pdf_path = pdf_path.replace(os.sep, '/')
    filename = os.path.basename(pdf_path)
    if filename.lower() == 'glossario.pdf':
        return 'glossario.html'

    return os.path.splitext(pdf_path)[0] + '.html'

def get_asset_prefix(viewer_path):
    viewer_dir = os.path.dirname(viewer_path.replace(os.sep, '/'))
    if not viewer_dir:
        return ''

    depth = len([part for part in viewer_dir.split('/') if part])
    return '../' * depth

def iter_source_pdfs():
    for current_dir, dirs, files in os.walk(ROOT_DIR):
        dirs[:] = [
            d for d in dirs
            if not d.startswith('.') and d not in EXCLUDE_DIRS
        ]

        for filename in files:
            if filename.lower().endswith('.pdf') and filename not in EXCLUDE_FILES:
                yield os.path.join(current_dir, filename)

def find_soffice():
    path = shutil.which('soffice')
    if path:
        return path

    for candidate in SOFFICE_FALLBACK_PATHS:
        if os.path.exists(candidate):
            return candidate

    return None

def iter_convertible_files():
    for current_dir, dirs, files in os.walk(ROOT_DIR):
        dirs[:] = [
            d for d in dirs
            if not d.startswith('.') and d not in EXCLUDE_DIRS
        ]

        for filename in files:
            if filename in EXCLUDE_FILES:
                continue

            base, ext = os.path.splitext(filename)
            if ext.lower() not in CONVERTIBLE_EXTENSIONS:
                continue

            # Se esiste già il PDF omonimo, il sorgente Office è ridondante
            if os.path.exists(os.path.join(current_dir, base + '.pdf')):
                continue

            yield os.path.join(current_dir, filename)

def convert_documents_to_pdf(source_paths, soffice_path):
    converted = []

    for source_path in source_paths:
        relative_path = os.path.relpath(source_path, ROOT_DIR)
        output_dir = os.path.join(BUILD_DIR, os.path.dirname(relative_path))
        os.makedirs(output_dir, exist_ok=True)

        try:
            result = subprocess.run(
                [soffice_path, '--headless', '--norestore',
                 '--convert-to', 'pdf', '--outdir', output_dir, source_path],
                capture_output=True, text=True, timeout=300
            )
        except subprocess.TimeoutExpired:
            print(f"ATTENZIONE: timeout nella conversione di {relative_path}")
            continue

        pdf_name = os.path.splitext(os.path.basename(source_path))[0] + '.pdf'
        output_pdf = os.path.join(output_dir, pdf_name)

        if result.returncode != 0 or not os.path.exists(output_pdf):
            error = (result.stderr or result.stdout or '').strip()
            print(f"ATTENZIONE: conversione fallita per {relative_path}: {error}")
            continue

        site_path = os.path.join(os.path.dirname(relative_path), pdf_name).replace(os.sep, '/')
        converted.append((source_path, site_path))
        print(f"Convertito in PDF: {relative_path}")

    return converted

def build_html_tree(base_path, relative_path=""):
    html_output = ""
    current_dir = os.path.normpath(os.path.join(base_path, relative_path))
    
    if not os.path.exists(current_dir):
        return ""

    # Ottieni cartelle e file, ignorando file nascosti e cartelle escluse
    items = sorted([i for i in os.listdir(current_dir) if not i.startswith('.')])

    if not relative_path:
        items.sort(key=sort_root_sections)
    
    # Assicura che la Lettera di Presentazione sia in cima
    for i, item in enumerate(items):
        if "lettera di presentazione" in item.lower():
            items.insert(0, items.pop(i))
            break
    
    dirs = [d for d in items if os.path.isdir(os.path.join(current_dir, d)) and d not in EXCLUDE_DIRS]
    files = [f for f in items if os.path.isfile(os.path.join(current_dir, f)) and f not in EXCLUDE_FILES]

    # 1. Stampa i file .pdf e i formati Office convertiti in PDF durante la build
    valid_files = []
    for f in files:
        if f.endswith('.pdf'):
            if f not in EXCLUDE_PDFS:
                valid_files.append(f)
        elif os.path.normpath(os.path.join(current_dir, f)) in CONVERTED_SOURCES:
            if os.path.splitext(f)[0] + '.pdf' not in EXCLUDE_PDFS:
                valid_files.append(f)
    if valid_files:
        def get_sort_key(filename):
            # Cerca una data nel nome del file (es. 2026-03-16 o 2026_03_16)
            date_match = re.search(r'(\d{4})[-_](\d{2})[-_](\d{2})', filename)
            if date_match:
                # Restituisce la data come stringa YYYYMMDD per l'ordinamento
                return (date_match.group(1) + date_match.group(2) + date_match.group(3), filename)
            # Fallback: data di modifica del file e nome
            return (str(os.path.getmtime(os.path.join(current_dir, filename))), filename)

        # Ordina i file in ordine decrescente (più recenti in alto)
        valid_files.sort(key=get_sort_key, reverse=True)

        # Assicura che la Lettera di Presentazione sia il primo file
        for i, f in enumerate(valid_files):
            if "lettera di presentazione" in f.lower():
                valid_files.insert(0, valid_files.pop(i))
                break
        
        html_output += '    <div class="doc">\n'
        for f in valid_files:
            name_without_ext = os.path.splitext(f)[0]
            # I formati Office puntano al PDF generato dalla conversione
            pdf_name = f if f.endswith('.pdf') else name_without_ext + '.pdf'
            if relative_path:
                # Forza lo slash (/) per i percorsi URL anche su Windows
                file_path = os.path.join(relative_path, pdf_name).replace(os.sep, '/')
            else:
                file_path = pdf_name
            viewer_path = to_url_path(get_pdf_viewer_path(file_path))
            # Il glossario riusa la stessa scheda invece di aprirne una nuova
            link_target = 'glossario' if viewer_path.endswith('glossario.html') else '_blank'
            html_output += f'        <p><a class="doc-link" href="{viewer_path}" target="{link_target}" rel="noopener noreferrer">{name_without_ext}</a></p>\n'
        html_output += '    </div>\n'

    # 2. Esplora ricorsivamente
    for d in dirs:
        dir_title = format_dir_title(d)
        dir_id = get_dir_id(os.path.join(relative_path, d))
        depth = len(relative_path.split(os.sep)) if relative_path else 0
        header_level = min(depth + 2, 6) 
        
        sub_content = build_html_tree(base_path, os.path.join(relative_path, d))
        
        if sub_content.strip():
            # Implementazione cartelle collassabili
            html_output += f'\n    <details id="{dir_id}" class="dir-container">\n'
            html_output += f'        <summary class="dir-title"><h{header_level}>{dir_title}</h{header_level}></summary>\n'
            html_output += f'        <div class="dir-content">\n'
            html_output += sub_content
            html_output += f'        </div>\n'
            html_output += f'    </details>\n'

    return html_output

def generate_pdf_viewers(site_pdf_paths):
    """Genera una pagina viewer per ogni PDF (percorsi relativi alla root del sito)."""
    if not os.path.exists(PDF_VIEWER_TEMPLATE_PATH):
        print(f"ERRORE: Template viewer PDF non trovato in {PDF_VIEWER_TEMPLATE_PATH}")
        return

    with open(PDF_VIEWER_TEMPLATE_PATH, 'r', encoding='utf-8') as f:
        template = f.read()

    for relative_pdf_path in site_pdf_paths:
        relative_pdf_path = relative_pdf_path.replace(os.sep, '/')
        filename = os.path.basename(relative_pdf_path)
        document_title = os.path.splitext(filename)[0]
        viewer_relative_path = get_pdf_viewer_path(relative_pdf_path)
        viewer_abs_path = os.path.join(BUILD_DIR, viewer_relative_path)
        pdf_src = to_url_path(filename)
        asset_prefix = get_asset_prefix(viewer_relative_path)

        if os.path.basename(viewer_abs_path).lower() == 'glossario.html':
            continue

        os.makedirs(os.path.dirname(viewer_abs_path), exist_ok=True)
        viewer_html = (
            template
            .replace('{{DOCUMENT_TITLE}}', escape(document_title))
            .replace('{{PDF_SRC}}', escape(pdf_src, quote=True))
            .replace('{{ASSET_PREFIX}}', asset_prefix)
        )

        with open(viewer_abs_path, 'w', encoding='utf-8') as f:
            f.write(viewer_html)

def main():
    # Pulisci o crea la cartella di output
    if os.path.exists(BUILD_DIR):
        shutil.rmtree(BUILD_DIR)
    os.makedirs(BUILD_DIR)

    site_pdf_paths = [
        os.path.relpath(p, ROOT_DIR).replace(os.sep, '/')
        for p in iter_source_pdfs()
    ]

    # Converte i formati Office (presentazioni e documenti) in PDF nella build
    convertible_paths = list(iter_convertible_files())
    if convertible_paths:
        soffice_path = find_soffice()
        if soffice_path:
            converted = convert_documents_to_pdf(convertible_paths, soffice_path)
            CONVERTED_SOURCES.update(os.path.normpath(src) for src, _ in converted)
            site_pdf_paths.extend(site_path for _, site_path in converted)
        else:
            print("ATTENZIONE: LibreOffice (soffice) non trovato, file non pubblicati:")
            for path in convertible_paths:
                print(f"  - {os.path.relpath(path, ROOT_DIR)}")

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

    glossary_src = os.path.join(SITE_SRC, 'glossario.html')
    if os.path.exists(glossary_src):
        shutil.copy2(glossary_src, os.path.join(BUILD_DIR, 'glossario.html'))

    for asset_name in ('pdf-viewer.css', 'pdf-viewer.js'):
        asset_src = os.path.join(SITE_SRC, asset_name)
        if os.path.exists(asset_src):
            shutil.copy2(asset_src, os.path.join(BUILD_DIR, asset_name))

    # Librerie vendorizzate (pdf.js)
    vendor_src = os.path.join(SITE_SRC, 'vendor')
    if os.path.exists(vendor_src):
        shutil.copytree(vendor_src, os.path.join(BUILD_DIR, 'vendor'))
    
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
                # dirs_exist_ok: le cartelle possono già contenere i PDF convertiti
                shutil.copytree(s, d, dirs_exist_ok=True)
            elif item.endswith('.pdf'):
                shutil.copy2(s, d)

    generate_pdf_viewers(site_pdf_paths)

    print("Sito generato con successo nella cartella _site/")

if __name__ == "__main__":
    main()
