import os
import re
import shutil
import subprocess
from datetime import datetime
from html import escape
from urllib.parse import quote

# Configurazione percorsi
# Lo script viene eseguito dalla root del progetto
ROOT_DIR = '.'
SITE_SRC = os.path.join('.github', 'site-src')
BUILD_DIR = '_site'
TEMPLATE_PATH = os.path.join(SITE_SRC, 'index_template.html')
PDF_VIEWER_TEMPLATE_PATH = os.path.join(SITE_SRC, 'pdf-viewer-template.html')
GLOSSARY_SRC = os.path.join(SITE_SRC, 'glossario.html')

# Cartelle e file da escludere dalla scansione e dal deploy finale
EXCLUDE_DIRS = {'.github', '.git', BUILD_DIR, 'scripts', 'website', 'assets', '__pycache__', '.pytest_cache'}
EXCLUDE_FILES = {'.gitignore', 'prompt.tex', 'README.md', 'index.html'}
EXCLUDE_PDFS = set()

# ---- Configurazione delle fasi ----
# Le fasi vengono rilevate automaticamente dalle cartelle presenti nella root
# (confronto case-insensitive con gli id qui sotto). L'ultima fase presente
# nell'ordine di PHASE_META e' la consegna corrente; le precedenti finiscono
# in archivio. Quando verra' creata la cartella "PB", alla build successiva il
# sito si riorganizza da solo: PB diventa corrente e RTB scivola in archivio.
PHASE_META = [
    {
        'id': 'candidatura',
        'title': 'Candidatura',
        'subtitle': 'Scelta del capitolato e dichiarazione degli impegni',
        'artefatto': None,
        # La candidatura ha prodotti una tantum, fuori dalla classificazione
        # del regolamento: gruppo unico esplicito.
        'groups_override': [('Documenti', ['analisi capitolati', 'Dichiarazione Impegni'])],
    },
    {
        'id': 'rtb',
        'title': 'RTB',
        'subtitle': 'Requirements and Technology Baseline',
        'artefatto': ('PoC', 'https://github.com/aLittleByte-19/PoC'),
    },
    {
        'id': 'pb',
        'title': 'PB',
        'subtitle': 'Product Baseline',
        'artefatto': ('MVP', 'https://github.com/aLittleByte-19/MVP'),
        # Prodotti attesi dal regolamento: se la cartella manca o e' ancora
        # vuota, la fase corrente espone un segnaposto "In preparazione".
        'attesi': [
            'Piano di Progetto',
            'Piano di Qualifica',
            'Analisi dei Requisiti',
            'Specifica Tecnica',
            'Manuale Utente',
            'Norme di Progetto',
            'Glossario',
        ],
    },
]

# Forza una fase come corrente (es. 'rtb'); None = automatico (ultima presente)
CURRENT_PHASE = None

# Classificazione dei prodotti secondo il regolamento ("Obblighi documentali").
# I confronti sono case-insensitive sul nome della cartella del prodotto.
DOCUMENTI_ESTERNI = [
    'piano di progetto',
    'piano di qualifica',
    'analisi dei requisiti',
    'specifica tecnica',
    'manuale utente',
]
DOCUMENTI_INTERNI = [
    'norme di progetto',
    'glossario',
]

SLIDES_DIR = 'Diapositive'

# Cartelle top-level note che non contengono documenti da esporre
NON_DOC_DIRS = {'mockup'}

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

def date_sort_key(pdf_rel_path):
    """Chiave di ordinamento: data nel nome file (YYYY-MM-DD o YYYY_MM_DD), fallback mtime."""
    filename = os.path.basename(pdf_rel_path)
    date_match = re.search(r'(\d{4})[-_](\d{2})[-_](\d{2})', filename)
    if date_match:
        return (date_match.group(1) + date_match.group(2) + date_match.group(3), filename)
    return (str(os.path.getmtime(os.path.join(ROOT_DIR, pdf_rel_path))), filename)

def list_dir_pdfs(rel_dir):
    """PDF direttamente contenuti in rel_dir (non ricorsivo), come percorsi relativi alla root."""
    abs_dir = os.path.join(ROOT_DIR, rel_dir)
    if not os.path.isdir(abs_dir):
        print(f"ATTENZIONE: cartella non trovata: {rel_dir}")
        return []

    return [
        os.path.join(rel_dir, f)
        for f in sorted(os.listdir(abs_dir))
        if f.lower().endswith('.pdf') and f not in EXCLUDE_PDFS
    ]

def filter_signed_only(pdf_paths):
    """Se esistono sia X.pdf che X_FIRMATO.pdf, espone solo la versione firmata."""
    stems = {os.path.splitext(os.path.basename(p))[0] for p in pdf_paths}
    result = []
    for p in pdf_paths:
        stem = os.path.splitext(os.path.basename(p))[0]
        if not stem.endswith('_FIRMATO') and f'{stem}_FIRMATO' in stems:
            continue
        result.append(p)
    return result

def display_title(pdf_rel_path):
    """Titolo leggibile: senza estensione, suffisso FIRMATO come nota, date normalizzate."""
    stem = os.path.splitext(os.path.basename(pdf_rel_path))[0]
    signed = stem.endswith('_FIRMATO')
    if signed:
        stem = stem[: -len('_FIRMATO')]
    stem = re.sub(r'(\d{4})[-_](\d{2})[-_](\d{2})', r'\1-\2-\3', stem)
    title = stem.replace('_', ' ').strip()
    if signed:
        title += ' (firmato)'
    return title

# Icone inline (stroke: currentColor)
SVG_DOC = (
    '<svg class="icon-doc" viewBox="0 0 24 24" width="20" height="20" fill="none" '
    'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" '
    'aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>'
    '<path d="M14 2v6h6"/></svg>'
)
SVG_OPEN = (
    '<svg class="icon-open" viewBox="0 0 24 24" width="16" height="16" fill="none" '
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" '
    'aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'
    '<path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>'
)
SVG_WEB = (
    '<svg class="icon-doc" viewBox="0 0 24 24" width="20" height="20" fill="none" '
    'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" '
    'aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/>'
    '<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>'
)

# ---- Miniature dei documenti ----
THUMBS_DIR = 'thumbs'
_pdftoppm_warned = False
_chrome_warned = False

def ensure_thumbnail(pdf_rel_path):
    """Genera (se possibile) la miniatura della prima pagina del PDF con pdftoppm;
    ritorna il percorso relativo alla root del sito oppure None (fallback: icona)."""
    global _pdftoppm_warned
    if shutil.which('pdftoppm') is None:
        if not _pdftoppm_warned:
            print("ATTENZIONE: pdftoppm non disponibile, uso icone al posto delle anteprime")
            _pdftoppm_warned = True
        return None

    slug = re.sub(r'[^a-z0-9]+', '-', os.path.splitext(pdf_rel_path)[0].lower()).strip('-')
    out_dir = os.path.join(BUILD_DIR, THUMBS_DIR)
    os.makedirs(out_dir, exist_ok=True)
    out_prefix = os.path.join(out_dir, slug)
    out_file = f'{out_prefix}.png'

    result = subprocess.run(
        ['pdftoppm', '-png', '-f', '1', '-singlefile', '-scale-to-x', '192', '-scale-to-y', '-1',
         os.path.join(ROOT_DIR, pdf_rel_path), out_prefix],
        capture_output=True,
    )
    if result.returncode != 0 or not os.path.exists(out_file):
        print(f"ATTENZIONE: anteprima non generata per {pdf_rel_path}")
        return None

    return f'{THUMBS_DIR}/{slug}.png'

def find_chrome():
    candidates = [
        os.environ.get('CHROME_BIN'),
        shutil.which('google-chrome'),
        shutil.which('chromium'),
        shutil.which('chromium-browser'),
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ]
    for candidate in candidates:
        if candidate and os.path.exists(candidate):
            return candidate
    return None

def ensure_web_thumbnail(html_src_path, slug):
    """Genera la miniatura di una pagina web con Chrome headless;
    ritorna il percorso relativo alla root del sito oppure None (fallback: icona)."""
    global _chrome_warned
    chrome = find_chrome()
    if chrome is None:
        if not _chrome_warned:
            print("ATTENZIONE: Chrome non disponibile, uso icona per le anteprime web")
            _chrome_warned = True
        return None

    out_dir = os.path.join(BUILD_DIR, THUMBS_DIR)
    os.makedirs(out_dir, exist_ok=True)
    out_file = os.path.abspath(os.path.join(out_dir, f'{slug}.png'))
    src_url = 'file://' + os.path.abspath(html_src_path)

    result = subprocess.run(
        [chrome, '--headless=new', '--disable-gpu', '--hide-scrollbars',
         f'--screenshot={out_file}', '--window-size=800,1131', src_url],
        capture_output=True,
    )
    if result.returncode != 0 or not os.path.exists(out_file):
        print(f"ATTENZIONE: anteprima web non generata per {html_src_path}")
        return None

    return f'{THUMBS_DIR}/{slug}.png'

def render_doc_item(pdf_rel_path, desc=None, large=False):
    """Elemento documento: anteprima della prima pagina, titolo-link, metadati.
    Un solo link per elemento, tutta l'area cliccabile."""
    viewer_path = to_url_path(get_pdf_viewer_path(pdf_rel_path))
    is_glossario = viewer_path.endswith('glossario.html')
    link_target = 'glossario' if is_glossario else '_blank'
    meta = 'Pagina web' if is_glossario else 'PDF'

    # Il glossario apre una pagina web: anteprima della pagina, non del PDF
    if is_glossario:
        thumb_rel = ensure_web_thumbnail(GLOSSARY_SRC, 'glossario-web')
    else:
        thumb_rel = ensure_thumbnail(pdf_rel_path)

    if thumb_rel:
        thumb_html = (
            f'<img class="doc-thumb" src="{to_url_path(thumb_rel)}" alt="" loading="lazy">'
        )
    elif is_glossario:
        thumb_html = f'<span class="doc-thumb doc-thumb-fallback">{SVG_WEB}</span>'
    else:
        thumb_html = f'<span class="doc-thumb doc-thumb-fallback">{SVG_DOC}</span>'

    css_class = 'doc-item doc-item-lg' if large else 'doc-item'
    desc_html = f'<span class="doc-desc">{escape(desc)}</span>' if desc else ''
    return (
        f'<a class="{css_class}" href="{viewer_path}" target="{link_target}" rel="noopener noreferrer">'
        f'{thumb_html}'
        f'<span class="doc-body">'
        f'<span class="doc-title">{escape(display_title(pdf_rel_path))}</span>'
        f'{desc_html}'
        f'<span class="doc-meta">{meta}</span>'
        f'</span>'
        f'<span class="open-flag">{SVG_OPEN}</span></a>'
    )

def render_placeholder_item(title, desc=None, large=False):
    """Segnaposto non cliccabile per un prodotto atteso ma non ancora consegnato."""
    css_class = 'doc-item doc-item-placeholder doc-item-lg' if large else 'doc-item doc-item-placeholder'
    desc_html = f'<span class="doc-desc">{escape(desc)}</span>' if desc else ''
    return (
        f'<div class="{css_class}">'
        f'<span class="doc-thumb doc-thumb-fallback">{SVG_DOC}</span>'
        f'<span class="doc-body">'
        f'<span class="doc-title">{escape(title)}</span>'
        f'{desc_html}'
        f'<span class="doc-meta">In preparazione</span>'
        f'</span></div>'
    )

def render_doc_row(pdf_rel_path):
    """Riga compatta senza anteprima (usata per i verbali)."""
    viewer_path = to_url_path(get_pdf_viewer_path(pdf_rel_path))
    return (
        f'<a class="doc-row" href="{viewer_path}" target="_blank" rel="noopener noreferrer">'
        f'<span class="doc-title">{escape(display_title(pdf_rel_path))}</span>'
        f'<span class="open-flag">{SVG_OPEN}</span></a>'
    )

# ---- Rilevamento automatico di fasi e struttura ----

def discover_phases():
    """Le fasi presenti nel repo, nell'ordine di PHASE_META (cronologico)."""
    top_dirs = {
        d.lower(): d
        for d in os.listdir(ROOT_DIR)
        if os.path.isdir(os.path.join(ROOT_DIR, d)) and not d.startswith('.') and d not in EXCLUDE_DIRS
    }

    phases = []
    for meta in PHASE_META:
        base = top_dirs.get(meta['id'])
        if base:
            phase = dict(meta)
            phase['base'] = base
            phases.append(phase)
    return phases

def detect_structure(phase):
    """Individua nella cartella di fase: lettera, cartella verbali e prodotti."""
    base_abs = os.path.join(ROOT_DIR, phase['base'])
    lettera = None
    verbali = None
    products = []

    for item in sorted(os.listdir(base_abs)):
        if item.startswith('.') or not os.path.isdir(os.path.join(base_abs, item)):
            continue
        low = item.lower()
        if 'lettera di presentazione' in low:
            lettera = item
        elif 'verbal' in low:
            verbali = item
        else:
            products.append(item)

    if lettera is None:
        print(f"ATTENZIONE: nessuna Lettera di Presentazione trovata nella fase '{phase['id']}'")
    if verbali is None:
        print(f"ATTENZIONE: nessuna cartella verbali trovata nella fase '{phase['id']}'")
    return lettera, verbali, products

def classify_products(phase, products):
    """Divide i prodotti in documenti esterni/interni secondo il regolamento."""
    if phase.get('groups_override'):
        return phase['groups_override']

    def bucket_of(name):
        low = name.lower()
        for index, known in enumerate(DOCUMENTI_ESTERNI):
            if low == known or known in low:
                return ('esterni', index)
        for index, known in enumerate(DOCUMENTI_INTERNI):
            if low == known or known in low:
                return ('interni', index)
        return ('altri', 0)

    esterni, interni, altri = [], [], []
    for product in products:
        bucket, order = bucket_of(product)
        if bucket == 'esterni':
            esterni.append((order, product))
        elif bucket == 'interni':
            interni.append((order, product))
        else:
            print(f"ATTENZIONE: prodotto non classificato dal regolamento nella fase '{phase['id']}': {product}")
            altri.append(product)

    groups = []
    if esterni:
        groups.append(('Documenti esterni', [name for _, name in sorted(esterni)]))
    if interni:
        groups.append(('Documenti interni', [name for _, name in sorted(interni)]))
    if altri:
        groups.append(('Altri documenti', altri))
    return groups

# ---- Rendering delle sezioni ----

def render_lettera(phase, lettera_dir, current=False):
    """La Lettera di Presentazione, in cima alla fase ("sopra l'involucro")."""
    pdfs = []
    if lettera_dir:
        pdfs = filter_signed_only(list_dir_pdfs(os.path.join(phase['base'], lettera_dir)))

    if not pdfs:
        if current:
            item = render_placeholder_item(
                f"Lettera di Presentazione {phase['title']}",
                desc='Contenuti della consegna e stato di avanzamento',
                large=True,
            )
            return f'    <div class="lettera-wrap">\n        {item}\n    </div>\n'
        print(f"ATTENZIONE: nessuna Lettera di Presentazione nella fase '{phase['id']}'")
        return ''

    return (
        '    <div class="lettera-wrap">\n'
        f'        {render_doc_item(pdfs[0], desc="Contenuti della consegna e stato di avanzamento", large=True)}\n'
        '    </div>\n'
    )

def render_groups(phase, groups, current=False):
    """Gruppi di prodotti (documenti esterni / interni) come voci di primo livello."""
    if not groups:
        return ''

    html = '    <div class="doc-groups">\n'
    for group_title, subdirs in groups:
        html += '        <div class="doc-group">\n'
        html += f'            <h2 class="group-title">{escape(group_title)}</h2>\n'
        html += '            <ul class="product-list">\n'
        for subdir in subdirs:
            rel_dir = os.path.join(phase['base'], subdir)
            pdfs = []
            if os.path.isdir(os.path.join(ROOT_DIR, rel_dir)):
                pdfs = filter_signed_only(list_dir_pdfs(rel_dir))
            if not pdfs:
                if current:
                    html += f'                <li>{render_placeholder_item(format_dir_title(subdir))}</li>\n'
                else:
                    print(f"ATTENZIONE: nessun PDF trovato per il prodotto: {rel_dir}")
                continue
            for pdf in pdfs:
                html += f'                <li>{render_doc_item(pdf)}</li>\n'
        html += '            </ul>\n'
        html += '        </div>\n'
    html += '    </div>\n'
    return html

def render_verbali(phase, verbali_dir, heading_level):
    """Sezione Verbali: sotto-liste per verbali esterni e interni, dal piu' recente."""
    if not verbali_dir:
        return ''

    rel_dir = os.path.join(phase['base'], verbali_dir)
    abs_dir = os.path.join(ROOT_DIR, rel_dir)
    subdirs = [d for d in sorted(os.listdir(abs_dir)) if os.path.isdir(os.path.join(abs_dir, d))]
    esterni = [d for d in subdirs if 'estern' in d.lower()]
    interni = [d for d in subdirs if 'intern' in d.lower()]
    for d in subdirs:
        if d not in esterni and d not in interni:
            print(f"ATTENZIONE: sottocartella verbali non classificata: {os.path.join(rel_dir, d)}")

    html = '    <div class="verbali-block">\n'
    html += f'        <h{heading_level} class="group-title">Verbali</h{heading_level}>\n'
    for d in esterni + interni:
        pdfs = filter_signed_only(list_dir_pdfs(os.path.join(rel_dir, d)))
        if not pdfs:
            continue
        pdfs.sort(key=date_sort_key, reverse=True)
        dir_id = f"{phase['id']}-{re.sub(r'[^a-z0-9]+', '-', d.lower()).strip('-')}"
        html += f'        <details id="{dir_id}" class="dir-container">\n'
        html += f'            <summary class="dir-title"><h{heading_level + 1}>{escape(format_dir_title(d))}</h{heading_level + 1}></summary>\n'
        html += '            <div class="dir-content">\n'
        html += '                <div class="doc-list">\n'
        for pdf in pdfs:
            html += f'                    {render_doc_row(pdf)}\n'
        html += '                </div>\n'
        html += '            </div>\n'
        html += '        </details>\n'
    html += '    </div>\n'
    return html

def render_phase_body(phase, heading_level=2, current=False):
    lettera_dir, verbali_dir, products = detect_structure(phase)

    # Nella fase corrente i prodotti attesi ma assenti compaiono come segnaposto
    if current and phase.get('attesi'):
        present = {p.lower() for p in products}
        products = products + [a for a in phase['attesi'] if a.lower() not in present]

    groups = classify_products(phase, products)
    return (
        render_lettera(phase, lettera_dir, current=current)
        + render_groups(phase, groups, current=current)
        + render_verbali(phase, verbali_dir, heading_level)
    )

def render_current_phase(phase):
    artefatto_html = ''
    if phase.get('artefatto'):
        name, url = phase['artefatto']
        artefatto_html = (
            '    <p class="phase-artefatto">Artefatto: '
            f'<a href="{escape(url, quote=True)}" target="_blank" rel="noopener noreferrer">{escape(name)}{SVG_OPEN}</a></p>\n'
        )

    html = '<section id="documentazione" class="phase-current">\n'
    html += f'    <span id="{phase["id"]}" class="phase-anchor" aria-hidden="true"></span>\n'
    html += f'    <h1>{escape(phase["title"])}</h1>\n'
    html += f'    <p class="phase-subtitle">{escape(phase["subtitle"])}</p>\n'
    html += artefatto_html
    html += render_phase_body(phase, heading_level=2, current=True)
    html += '</section>\n'
    return html

# Milestone delle presentazioni, dalla piu' vecchia alla piu' recente:
# in pagina compaiono in ordine inverso (la piu' recente in cima, come i diari)
PRESENTATION_ORDER = ['tb', 'rtb', 'pb']

def render_slides_section():
    pdfs = list_dir_pdfs(SLIDES_DIR)
    if not pdfs:
        return ''

    presentazioni, diari = [], []
    for pdf in pdfs:
        name = os.path.splitext(os.path.basename(pdf))[0].lower()
        if 'presentazione' in name:
            presentazioni.append(pdf)
        else:
            if 'diario' not in name:
                print(f"ATTENZIONE: diapositiva non classificata, esposta tra i diari: {pdf}")
            diari.append(pdf)

    def presentation_key(pdf):
        tokens = re.split(r'[^a-z0-9]+', os.path.splitext(os.path.basename(pdf))[0].lower())
        for index, token in enumerate(PRESENTATION_ORDER):
            if token in tokens:
                return (0, -index, pdf)
        print(f"ATTENZIONE: presentazione senza milestone riconosciuta nel nome: {pdf}")
        return (1, 0, pdf)

    presentazioni.sort(key=presentation_key)
    diari.sort(key=date_sort_key, reverse=True)

    html = '<section id="diapositive">\n'
    html += '    <h1>Diapositive</h1>\n'
    html += '    <div class="doc-groups doc-groups-stacked">\n'
    for group_title, group_pdfs in (('Presentazioni', presentazioni), ('Diari di bordo', diari)):
        if not group_pdfs:
            continue
        html += '        <div class="doc-group">\n'
        html += f'            <h2 class="group-title">{escape(group_title)}</h2>\n'
        html += '            <ul class="product-list slides-list">\n'
        for pdf in group_pdfs:
            html += f'                <li>{render_doc_item(pdf)}</li>\n'
        html += '            </ul>\n'
        html += '        </div>\n'
    html += '    </div>\n'
    html += '</section>\n'
    return html

def render_archive_section(archived_phases):
    if not archived_phases:
        return ''

    html = '<section id="archivio">\n'
    html += '    <h1>Archivio</h1>\n'
    for phase in archived_phases:
        html += f'    <details id="{phase["id"]}" class="phase-archived">\n'
        html += f'        <summary class="dir-title"><h2>{escape(phase["title"])}</h2></summary>\n'
        html += '        <div class="phase-archived-content">\n'
        html += render_phase_body(phase, heading_level=3)
        html += '        </div>\n'
        html += '    </details>\n'
    html += '</section>\n'
    return html

def check_top_level(phases):
    """Avvisa se nella root compaiono cartelle non riconosciute."""
    known = {phase['base'] for phase in phases} | {SLIDES_DIR} | NON_DOC_DIRS
    for item in sorted(os.listdir(ROOT_DIR)):
        if item.startswith('.') or item in EXCLUDE_DIRS or item in EXCLUDE_FILES:
            continue
        if os.path.isdir(os.path.join(ROOT_DIR, item)) and item not in known:
            print(f"ATTENZIONE: cartella top-level non riconosciuta (fase mancante in PHASE_META?): {item}")

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

    phases = discover_phases()
    if not phases:
        print("ERRORE: nessuna fase trovata nel repo")
        return

    check_top_level(phases)

    if CURRENT_PHASE:
        current = next((p for p in phases if p['id'] == CURRENT_PHASE), None)
        if current is None:
            print(f"ERRORE: CURRENT_PHASE '{CURRENT_PHASE}' non trovata tra le fasi presenti")
            return
    else:
        current = phases[-1]
    # In archivio dalla piu' recente alla piu' vecchia
    archived = [p for p in reversed(phases) if p['id'] != current['id']]

    print(f"Fase corrente: {current['title']}; in archivio: {[p['title'] for p in archived]}")

    docs_html = render_current_phase(current)
    docs_html += render_slides_section()
    docs_html += render_archive_section(archived)

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

    # La voce di navigazione della sezione documenti prende il nome della fase corrente
    html_content = html_content.replace('{{CURRENT_PHASE_NAV}}', escape(current['title'].upper()))

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

    if os.path.exists(GLOSSARY_SRC):
        shutil.copy2(GLOSSARY_SRC, os.path.join(BUILD_DIR, 'glossario.html'))

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

    # Copia tutte le cartelle dei documenti (es. RTB/) e file PDF in root
    for item in os.listdir(ROOT_DIR):
        if item not in EXCLUDE_DIRS and item not in EXCLUDE_FILES and not item.startswith('.'):
            s = os.path.join(ROOT_DIR, item)
            d = os.path.join(BUILD_DIR, item)
            if os.path.isdir(s):
                shutil.copytree(s, d)
            elif item.endswith('.pdf'):
                shutil.copy2(s, d)

    generate_pdf_viewers(site_pdf_paths)

    print("Sito generato con successo nella cartella _site/")

if __name__ == "__main__":
    main()
