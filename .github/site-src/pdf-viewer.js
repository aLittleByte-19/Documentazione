import * as pdfjsLib from "./vendor/pdfjs/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("./vendor/pdfjs/pdf.worker.mjs", import.meta.url).href;

const PUBLISHED_ORIGIN = "https://alittlebyte-19.github.io";
const PUBLISHED_BASE_PATH = "/Documentazione/";
const RENDER_SCALE = 1.22;
const THUMB_SCALE = 0.18;
const MIN_ZOOM = 0.55;
const MAX_ZOOM = 2.2;
const ZOOM_STEP = 0.1;
const ZOOM_PERCENT_STEP = Math.round(ZOOM_STEP * 100);
const MAX_DEVICE_SCALE = 2;
const THUMB_MAX_WIDTH = 86;
const THUMB_MAX_HEIGHT = 86;
const PAGE_FIT_MARGIN = 12;
const FITTED_PAGE_MIN_SCALE = 0.32;
const LANDSCAPE_PAGE_RATIO = 1.12;
const WHEEL_ZOOM_SENSITIVITY = 0.0025;
const WORD_CHARACTER_PATTERN = /[\p{L}\p{N}\p{M}_'-]/u;
const ZOOM_RERENDER_DELAY = 240;
const RENDER_SCALE_TOLERANCE = 0.05;
const THUMB_MANUAL_SCROLL_GRACE = 1500;
const MAX_CANVAS_PIXELS = 16777216;
const EVICTION_KEEP_MARGIN = "3200px 0px";
const EVICTION_PAGE_DISTANCE = 3;
const PAGE_HASH_PATTERN = /(?:^|[#&])page=(\d+)/i;
const SNIPPET_BEFORE_CHARS = 34;
const SNIPPET_AFTER_CHARS = 74;

const body = document.body;
const header = document.querySelector(".viewer-header");
const siteRootUrl = new URL(body.dataset.siteRoot || ".", window.location.href);
const pdfUrl = new URL(body.dataset.pdfSrc, window.location.href);
const documentTitle = body.dataset.documentTitle || "Documento PDF";
const mobileViewportQuery = window.matchMedia("(max-width: 860px)");

const elements = {
  title: document.getElementById("document-title"),
  openPdfLink: document.getElementById("open-pdf-link"),
  downloadPdfLink: document.getElementById("download-pdf-link"),
  sidebarToggle: document.getElementById("sidebar-toggle"),
  sidebar: document.getElementById("sidebar"),
  documentArea: document.querySelector(".document-area"),
  loader: document.getElementById("viewer-loader"),
  viewer: document.getElementById("viewer"),
  status: document.getElementById("status"),
  pageCount: document.getElementById("page-count"),
  thumbnailPanel: document.querySelector(".thumbnail-panel"),
  thumbnailList: document.getElementById("thumbnail-list"),
  thumbnailHeading: document.querySelector(".thumbnail-panel .panel-heading h2"),
  pageInput: document.getElementById("page-input"),
  pageTotal: document.getElementById("page-total"),
  zoomInput: document.getElementById("zoom-input"),
  zoomOut: document.getElementById("zoom-out"),
  zoomIn: document.getElementById("zoom-in"),
  searchBox: document.getElementById("search-box"),
  searchInput: document.getElementById("search-input"),
  searchClear: document.getElementById("search-clear"),
  searchPrev: document.getElementById("search-prev"),
  searchNext: document.getElementById("search-next"),
  searchStatus: document.getElementById("search-status")
};

const state = {
  pdf: null,
  pages: new Map(),
  renderQueue: [],
  activeRenders: 0,
  zoom: 1,
  currentPage: 1,
  searchToken: 0,
  searchQuery: "",
  searchResults: [],
  searchResultButtons: [],
  activeSearchIndex: -1,
  navigationSerial: 0,
  scrollTicking: false,
  layoutTicking: false,
  searchScrollFrame: 0,
  gestureStartZoom: 1,
  pointerInDocumentArea: false,
  zoomRerenderTimer: 0,
  hashUpdateTimer: 0,
  thumbManualScrollUntil: 0
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function nextFrame() {
  // rAF non scatta nei tab in background: fallback a timeout per non
  // bloccare caricamento e ricerca finché il tab non torna in primo piano
  return new Promise(resolve => {
    let settled = false;
    const settle = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };

    window.requestAnimationFrame(settle);
    window.setTimeout(settle, 90);
  });
}

// Yield cooperativo per non bloccare la UI: nei tab nascosti i timer sono
// pesantemente throttlati e non c'è UI da proteggere, quindi non cedere
function yieldToUi() {
  return document.hidden ? Promise.resolve() : nextFrame();
}

function waitForVisibleTab() {
  if (!document.hidden) {
    return Promise.resolve();
  }

  return new Promise(resolve => {
    const onVisibilityChange = () => {
      if (!document.hidden) {
        document.removeEventListener("visibilitychange", onVisibilityChange);
        resolve();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
  });
}

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle("error", isError);
}

function hideLoader() {
  elements.loader?.classList.add("is-hidden");
}

function isMobileViewport() {
  return mobileViewportQuery.matches;
}

function setSidebarCollapsed(collapsed) {
  body.classList.toggle("sidebar-collapsed", collapsed);
  elements.sidebarToggle.setAttribute("aria-pressed", String(!collapsed));
  scheduleLayoutUpdate();
  window.setTimeout(scheduleLayoutUpdate, 180);
}

function syncSidebarForViewport() {
  setSidebarCollapsed(isMobileViewport());
}

function syncHeaderHeight() {
  if (!header) {
    return;
  }

  document.documentElement.style.setProperty("--header-height", `${header.offsetHeight}px`);
}

function getHeaderOffset() {
  return (header?.offsetHeight || 0) + 14;
}

function getDocumentViewportRect() {
  return elements.documentArea.getBoundingClientRect();
}

function getDocumentTopOffset() {
  return getDocumentViewportRect().top + 14;
}

function getDocumentScrollTop() {
  return elements.documentArea.scrollTop;
}

function getMaxDocumentScroll() {
  return Math.max(0, elements.documentArea.scrollHeight - elements.documentArea.clientHeight);
}

function scrollDocumentTo(top, behavior = "auto") {
  elements.documentArea.scrollTo({
    top: clamp(top, 0, getMaxDocumentScroll()),
    behavior
  });
}

function getFileName(url) {
  const name = decodeURIComponent(url.pathname.split("/").pop() || "documento.pdf");
  return name || "documento.pdf";
}

function getPageFromHash() {
  const match = window.location.hash.match(PAGE_HASH_PATTERN);
  const pageNumber = match ? Number.parseInt(match[1], 10) : Number.NaN;
  return Number.isFinite(pageNumber) && pageNumber >= 1 ? pageNumber : null;
}

function schedulePageHashSync() {
  window.clearTimeout(state.hashUpdateTimer);
  state.hashUpdateTimer = window.setTimeout(() => {
    if (state.currentPage === 1 && !window.location.hash) {
      return;
    }

    const target = `#page=${state.currentPage}`;
    if (window.location.hash !== target) {
      window.history.replaceState(null, "", target);
    }
  }, 250);
}

function encodeSitePath(path) {
  return path
    .replace(/^\/+/, "")
    .split("/")
    .map(part => encodeURIComponent(decodeURIComponent(part)))
    .join("/");
}

function toViewerPath(sitePath) {
  const decodedPath = decodeURIComponent(sitePath).replace(/^\/+/, "");
  const filename = decodedPath.split("/").pop() || decodedPath;
  const normalizedFilename = filename.toLowerCase();

  if (normalizedFilename === "glossario.pdf" || normalizedFilename === "glossario.html") {
    return "glossario.html";
  }

  if (decodedPath.toLowerCase().endsWith(".pdf")) {
    return decodedPath.replace(/\.pdf$/i, ".html");
  }

  if (decodedPath.toLowerCase().endsWith(".html")) {
    return decodedPath;
  }

  return decodedPath;
}

function routeLocalSitePath(sitePath, search, hash) {
  const viewerPath = toViewerPath(sitePath);
  const targetUrl = new URL(encodeSitePath(viewerPath), siteRootUrl);
  targetUrl.search = search || "";
  targetUrl.hash = hash || "";
  return targetUrl.href;
}

function isGlossaryHref(href) {
  try {
    return new URL(href, window.location.href)
      .pathname
      .toLowerCase()
      .endsWith("/glossario.html");
  } catch {
    return false;
  }
}

function routeAnnotationUrl(rawUrl) {
  let targetUrl;

  try {
    targetUrl = new URL(rawUrl, pdfUrl.href);
  } catch {
    return null;
  }

  if (targetUrl.protocol === "mailto:") {
    return targetUrl.href;
  }

  if (!["http:", "https:"].includes(targetUrl.protocol)) {
    return null;
  }

  if (
    targetUrl.origin === PUBLISHED_ORIGIN &&
    targetUrl.pathname.startsWith(PUBLISHED_BASE_PATH)
  ) {
    return routeLocalSitePath(
      targetUrl.pathname.slice(PUBLISHED_BASE_PATH.length),
      targetUrl.search,
      targetUrl.hash
    );
  }

  const siteRootPath = siteRootUrl.pathname.endsWith("/")
    ? siteRootUrl.pathname
    : `${siteRootUrl.pathname}/`;

  if (
    targetUrl.origin === window.location.origin &&
    targetUrl.pathname.startsWith(siteRootPath)
  ) {
    return routeLocalSitePath(
      targetUrl.pathname.slice(siteRootPath.length),
      targetUrl.search,
      targetUrl.hash
    );
  }

  return targetUrl.href;
}

function getViewportCenterY() {
  const viewportRect = getDocumentViewportRect();
  return viewportRect.top + Math.max(120, viewportRect.height / 2);
}

function getPageDisplayScale(pageState) {
  return (pageState.fitScale || 1) * state.zoom;
}

function setPageShellSize(pageState) {
  const displayScale = getPageDisplayScale(pageState);
  pageState.shell.style.width = `${pageState.width * displayScale}px`;
  pageState.shell.style.height = `${pageState.height * displayScale}px`;
  pageState.pageElement.style.setProperty("--page-scale", displayScale.toString());
}

function getViewerAvailableSize() {
  return {
    width: Math.max(320, elements.viewer.clientWidth - PAGE_FIT_MARGIN),
    height: Math.max(320, elements.documentArea.clientHeight - 34)
  };
}

function getPageFitScale(pageState) {
  const available = getViewerAvailableSize();
  const widthFit = available.width / pageState.width;
  const heightFit = available.height / pageState.height;
  const isLandscape = pageState.width > pageState.height * LANDSCAPE_PAGE_RATIO;
  const fitScale = isLandscape
    ? Math.min(widthFit, heightFit, 1)
    : Math.min(widthFit, 1);

  return Math.min(clamp(fitScale, FITTED_PAGE_MIN_SCALE, 1), widthFit);
}

function updatePageFitScales(preserveScroll = true) {
  const anchor = preserveScroll ? getScrollAnchor() : null;

  for (const pageState of state.pages.values()) {
    pageState.fitScale = getPageFitScale(pageState);
    setPageShellSize(pageState);
  }

  if (anchor) {
    window.requestAnimationFrame(() => restoreScrollAnchor(anchor));
  } else {
    updateCurrentPage();
  }
}

function scheduleLayoutUpdate() {
  if (state.layoutTicking) {
    return;
  }

  state.layoutTicking = true;
  window.requestAnimationFrame(() => {
    state.layoutTicking = false;
    syncHeaderHeight();
    updatePageFitScales(true);
    scheduleZoomRerender();
  });
}

function applyZoom(nextZoom, preserveScroll = true) {
  const anchor = preserveScroll ? getScrollAnchor() : null;
  state.zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
  document.documentElement.style.setProperty("--zoom", state.zoom.toString());
  elements.zoomInput.value = Math.round(state.zoom * 100);
  elements.zoomOut.disabled = state.zoom <= MIN_ZOOM + 0.001;
  elements.zoomIn.disabled = state.zoom >= MAX_ZOOM - 0.001;

  for (const pageState of state.pages.values()) {
    setPageShellSize(pageState);
  }

  if (anchor) {
    window.requestAnimationFrame(() => restoreScrollAnchor(anchor));
  }

  scheduleZoomRerender();
}

function ensureSharpRender(pageState) {
  if (!pageState.rendered || pageState.rendering) {
    return;
  }

  const targetScale = getTargetRenderScale(pageState);
  const currentScale = pageState.renderedScale || 1;

  if (Math.abs(targetScale - currentScale) / currentScale > RENDER_SCALE_TOLERANCE) {
    pageState.rendered = false;
    queuePageRender(pageState.pageNumber);
  }
}

function scheduleZoomRerender() {
  window.clearTimeout(state.zoomRerenderTimer);
  state.zoomRerenderTimer = window.setTimeout(() => {
    for (const pageState of state.pages.values()) {
      if (pageState.visible) {
        ensureSharpRender(pageState);
      }
    }
  }, ZOOM_RERENDER_DELAY);
}

function evictPage(pageNumber) {
  const pageState = state.pages.get(pageNumber);
  if (!pageState || !pageState.rendered || pageState.rendering || pageNumber === 1) {
    return;
  }

  if (Math.abs(pageNumber - state.currentPage) <= EVICTION_PAGE_DISTANCE) {
    return;
  }

  pageState.rendered = false;
  pageState.renderedScale = 0;
  pageState.canvas.width = 0;
  pageState.canvas.height = 0;
}

function getScrollAnchor() {
  const viewportCenter = getViewportCenterY();
  let anchorPage = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const pageState of state.pages.values()) {
    const rect = pageState.shell.getBoundingClientRect();
    const pageCenter = rect.top + rect.height / 2;
    const containsCenter = rect.top <= viewportCenter && rect.bottom >= viewportCenter;
    const distance = containsCenter ? 0 : Math.abs(pageCenter - viewportCenter);

    if (distance < bestDistance) {
      bestDistance = distance;
      anchorPage = pageState;
    }
  }

  if (!anchorPage) {
    return null;
  }

  const rect = anchorPage.shell.getBoundingClientRect();
  const ratio = rect.height
    ? clamp((viewportCenter - rect.top) / rect.height, 0, 1)
    : 0;

  return { pageNumber: anchorPage.pageNumber, ratio, viewportCenter };
}

function restoreScrollAnchor(anchor) {
  const pageState = state.pages.get(anchor.pageNumber);
  if (!pageState) {
    return;
  }

  const viewportRect = getDocumentViewportRect();
  const rect = pageState.shell.getBoundingClientRect();
  const targetTop = getDocumentScrollTop() +
    rect.top -
    viewportRect.top +
    pageState.shell.offsetHeight * anchor.ratio -
    (anchor.viewportCenter - viewportRect.top);
  scrollDocumentTo(targetTop);
  updateCurrentPage();
}

function getZoomInputValue() {
  const value = Number.parseInt(elements.zoomInput.value, 10);
  return Number.isFinite(value) ? value : null;
}

function getButtonStepZoom(direction) {
  const currentPercent = Math.round(state.zoom * 100);
  const remainder = currentPercent % ZOOM_PERCENT_STEP;
  const nextPercent = direction > 0
    ? currentPercent + (remainder === 0 ? ZOOM_PERCENT_STEP : ZOOM_PERCENT_STEP - remainder)
    : currentPercent - (remainder === 0 ? ZOOM_PERCENT_STEP : remainder);

  return nextPercent / 100;
}

function updateCurrentPage() {
  if (!state.pdf) {
    return;
  }

  const maxScroll = getMaxDocumentScroll();
  const scrollTop = getDocumentScrollTop();
  if (scrollTop <= 2) {
    if (state.currentPage !== 1) {
      state.currentPage = 1;
      updateActiveThumbnail();
    }
    return;
  }

  if (scrollTop >= maxScroll - 2) {
    if (state.currentPage !== state.pdf.numPages) {
      state.currentPage = state.pdf.numPages;
      updateActiveThumbnail();
    }
    return;
  }

  const probeY = getViewportCenterY();
  let bestPage = state.currentPage;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const pageState of state.pages.values()) {
    const rect = pageState.shell.getBoundingClientRect();
    const containsProbe = rect.top <= probeY && rect.bottom >= probeY;
    const distance = containsProbe
      ? 0
      : Math.min(Math.abs(rect.top - probeY), Math.abs(rect.bottom - probeY));

    if (distance < bestDistance) {
      bestDistance = distance;
      bestPage = pageState.pageNumber;
    }
  }

  if (bestPage !== state.currentPage) {
    state.currentPage = bestPage;
    updateActiveThumbnail();
  }
}

function scheduleCurrentPageUpdate() {
  if (state.scrollTicking) {
    return;
  }

  state.scrollTicking = true;
  window.requestAnimationFrame(() => {
    state.scrollTicking = false;
    updateCurrentPage();
  });
}

function scrollToPage(pageNumber, options = {}) {
  const pageState = state.pages.get(pageNumber);
  if (!pageState) {
    return;
  }

  if (!options.fromSearch) {
    state.navigationSerial += 1;
  }

  queuePageRender(pageNumber);
  state.currentPage = pageNumber;
  updateActiveThumbnail();

  const scrollToTarget = behavior => {
    const targetTop = getDocumentScrollTop() +
      pageState.shell.getBoundingClientRect().top -
      getDocumentTopOffset();
    scrollDocumentTo(targetTop, behavior);
  };

  scrollToTarget(options.behavior || "auto");

  window.setTimeout(() => {
    const distance = Math.abs(pageState.shell.getBoundingClientRect().top - getDocumentTopOffset());
    if (distance > 80) {
      scrollToTarget("auto");
    }
  }, 220);
}

function createPageShell(pageNumber, viewport) {
  const shell = document.createElement("section");
  shell.className = "page-shell";
  shell.id = `page-${pageNumber}`;
  shell.dataset.pageNumber = String(pageNumber);
  shell.setAttribute("aria-label", `Pagina ${pageNumber}`);

  const pageElement = document.createElement("div");
  pageElement.className = "pdf-page";
  pageElement.style.width = `${viewport.width}px`;
  pageElement.style.height = `${viewport.height}px`;
  pageElement.setAttribute("aria-busy", "true");

  const canvas = document.createElement("canvas");
  const textLayer = document.createElement("div");
  textLayer.className = "text-layer";

  const highlightLayer = document.createElement("div");
  highlightLayer.className = "highlight-layer";

  const annotationLayer = document.createElement("div");
  annotationLayer.className = "annotation-layer";

  pageElement.append(canvas, textLayer, highlightLayer, annotationLayer);
  shell.append(pageElement);

  return { shell, pageElement, canvas, textLayer, highlightLayer, annotationLayer };
}

function createThumbnail(pageNumber) {
  const button = document.createElement("button");
  button.className = "thumbnail-button";
  button.type = "button";
  button.dataset.pageNumber = String(pageNumber);
  button.setAttribute("aria-label", `Vai a pagina ${pageNumber}`);

  const canvas = document.createElement("canvas");
  const meta = document.createElement("span");
  meta.className = "thumbnail-meta";

  const title = document.createElement("span");
  title.className = "thumbnail-title";
  title.textContent = `Pagina ${pageNumber}`;

  const hits = document.createElement("span");
  hits.className = "thumbnail-hits";
  hits.textContent = "";

  meta.append(title, hits);
  button.append(canvas, meta);
  button.addEventListener("click", event => {
    event.preventDefault();
    scrollToPage(pageNumber);
    if (isMobileViewport()) {
      setSidebarCollapsed(true);
    }
  });

  elements.thumbnailList.appendChild(button);
  return { button, canvas, hits };
}

function clearSearchResultList() {
  for (const button of state.searchResultButtons) {
    button.remove();
  }

  state.searchResultButtons = [];
}

function updateSidebarHeading() {
  if (!elements.thumbnailHeading || !elements.pageCount) {
    return;
  }

  const searching = state.searchQuery.length > 0;
  elements.thumbnailHeading.textContent = searching ? "Risultati" : "Anteprime";
  elements.pageCount.textContent = searching
    ? `${state.searchResults.length} risultati`
    : `${state.pdf?.numPages || 0} pagine`;
}

function createSearchResultButton(result, index) {
  const button = document.createElement("button");
  button.className = "search-result-button";
  button.type = "button";
  button.setAttribute("aria-label", `Risultato ${index + 1}, pagina ${result.pageNumber}`);

  const page = document.createElement("span");
  page.className = "search-result-page";
  page.textContent = `Pagina ${result.pageNumber}`;

  const snippet = document.createElement("span");
  snippet.className = "search-result-snippet";

  const before = document.createElement("span");
  before.textContent = result.snippet.before;

  const match = document.createElement("mark");
  match.textContent = result.snippet.match;

  const after = document.createElement("span");
  after.textContent = result.snippet.after;

  snippet.append(before, match, after);
  button.append(page, snippet);

  button.addEventListener("click", event => {
    event.preventDefault();
    goToSearchResult(index);
    if (isMobileViewport()) {
      setSidebarCollapsed(true);
    }
  });

  elements.thumbnailList.appendChild(button);
  return button;
}

function renderSearchResultList() {
  clearSearchResultList();

  state.searchResults.forEach((result, index) => {
    state.searchResultButtons.push(createSearchResultButton(result, index));
  });

  updateSidebarHeading();
}

function updateActiveSearchResultButton() {
  state.searchResultButtons.forEach((button, index) => {
    button.classList.toggle("is-active", index === state.activeSearchIndex);
  });

  const activeButton = state.searchResultButtons[state.activeSearchIndex];
  if (activeButton) {
    activeButton.scrollIntoView({ block: "nearest" });
  }
}

function updateActiveThumbnail() {
  schedulePageHashSync();
  updatePageIndicator();

  for (const pageState of state.pages.values()) {
    pageState.thumbButton.classList.toggle("is-active", pageState.pageNumber === state.currentPage);
  }

  // Non contrastare lo scroll manuale dell'utente sul pannello anteprime
  if (Date.now() < state.thumbManualScrollUntil) {
    return;
  }

  const active = state.pages.get(state.currentPage)?.thumbButton;
  if (!active || active.offsetParent === null) {
    return;
  }

  const scroller = elements.thumbnailPanel;
  const activeRect = active.getBoundingClientRect();
  const scrollerRect = scroller.getBoundingClientRect();
  const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  const targetTop = scroller.scrollTop +
    activeRect.top -
    scrollerRect.top +
    activeRect.height / 2 -
    scroller.clientHeight / 2;
  scroller.scrollTo({
    top: clamp(targetTop, 0, maxScroll),
    behavior: "auto"
  });
}

function updatePageIndicator() {
  if (!elements.pageInput || !elements.pageTotal) {
    return;
  }

  if (document.activeElement !== elements.pageInput) {
    elements.pageInput.value = String(state.currentPage);
  }

  elements.pageTotal.textContent = `/ ${state.pdf?.numPages || 0}`;
}

function updateSearchBadge(pageNumber, count) {
  const pageState = state.pages.get(pageNumber);
  if (!pageState) {
    return;
  }

  pageState.thumbButton.classList.toggle("has-matches", count > 0);
  pageState.thumbHits.textContent = count > 0
    ? `${count} risultati`
    : "";
}

function resetSearchBadges() {
  clearSearchResultList();
  for (const pageState of state.pages.values()) {
    updateSearchBadge(pageState.pageNumber, 0);
    pageState.shell.classList.remove("search-focus");
    pageState.highlightLayer.replaceChildren();
    pageState.searchMatches = [];
  }
  updateSidebarHeading();
}

async function addAnnotationLinks(pageState) {
  if (pageState.annotationsRendered) {
    return;
  }

  const annotations = await pageState.page.getAnnotations({ intent: "display" });
  // Geometria del testo: serve per correggere i rect dei link troppo stretti
  const searchModel = await getPageSearchModel(pageState.pageNumber).catch(() => null);
  pageState.annotationLayer.replaceChildren();

  for (const annotation of annotations) {
    const link = await createAnnotationLink(pageState, annotation, searchModel);
    if (link) {
      pageState.annotationLayer.appendChild(link);
    }
  }

  pageState.annotationsRendered = true;
}

// hyperref genera rect più stretti del testo quando la riga viene giustificata
// (l'URL si allunga, il box resta a larghezza naturale): se il rect copre
// quasi tutto un item di testo ma si ferma prima della fine, estendilo
function snapBoxToTextItems(searchModel, box) {
  if (!searchModel) {
    return box;
  }

  const { top, height } = box;
  let { left } = box;
  let right = left + box.width;
  const centerY = top + height / 2;
  const maxExtension = Math.max(30, box.width * 0.25);
  const originalRight = right;

  for (const item of searchModel.items) {
    if (centerY < item.top || centerY > item.top + item.height) {
      continue;
    }

    const itemRight = item.left + item.width;
    const overlap = Math.min(right, itemRight) - Math.max(left, item.left);
    if (overlap <= 0 || overlap / item.width < 0.7) {
      continue;
    }

    if (item.left >= left - 3 && itemRight > right) {
      right = Math.min(itemRight, originalRight + maxExtension);
    }
  }

  return { left, top, width: right - left, height };
}

async function createAnnotationLink(pageState, annotation, searchModel = null) {
  if (!annotation.rect) {
    return null;
  }

  const rect = pageState.viewport.convertToViewportRectangle(annotation.rect);
  const rawBox = {
    left: Math.min(rect[0], rect[2]),
    top: Math.min(rect[1], rect[3]),
    width: Math.abs(rect[0] - rect[2]),
    height: Math.abs(rect[1] - rect[3])
  };

  if (rawBox.width < 1 || rawBox.height < 1) {
    return null;
  }

  const { left, top, width, height } = snapBoxToTextItems(searchModel, rawBox);

  const rawUrl = annotation.url || annotation.unsafeUrl;
  if (rawUrl) {
    const targetHref = routeAnnotationUrl(rawUrl);
    if (!targetHref) {
      return null;
    }

    const link = document.createElement("a");
    link.className = "pdf-annotation-link";
    link.href = targetHref;
    // Il glossario riusa sempre la stessa scheda (browsing context con nome)
    link.target = isGlossaryHref(targetHref) ? "glossario" : "_blank";
    link.rel = "noopener noreferrer";
    link.title = targetHref;
    link.setAttribute("aria-label", `Apri link esterno: ${targetHref}`);
    positionLink(link, left, top, width, height);
    registerLinkGroup(pageState, link, targetHref);
    return link;
  }

  if (annotation.dest) {
    const link = document.createElement("a");
    link.className = "page-link";
    link.href = "#";
    link.setAttribute("aria-label", "Vai alla destinazione nel documento");
    positionLink(link, left, top, width, height);
    registerLinkGroup(
      pageState,
      link,
      `dest:${typeof annotation.dest === "string" ? annotation.dest : JSON.stringify(annotation.dest)}`
    );
    link.addEventListener("click", async event => {
      event.preventDefault();
      const destination = Array.isArray(annotation.dest)
        ? annotation.dest
        : await state.pdf.getDestination(annotation.dest);

      if (!destination?.[0]) {
        return;
      }

      const pageIndex = await state.pdf.getPageIndex(destination[0]);
      scrollToPage(pageIndex + 1);
    });
    return link;
  }

  return null;
}

function positionLink(link, left, top, width, height) {
  link.style.left = `${left}px`;
  link.style.top = `${top}px`;
  link.style.width = `${width}px`;
  link.style.height = `${height}px`;
}

// I link spezzati su più righe diventano annotazioni separate nel PDF:
// raggruppale per destinazione così l'hover le evidenzia tutte insieme
function registerLinkGroup(pageState, link, groupKey) {
  link.dataset.linkGroup = groupKey;

  const setGroupHover = active => {
    for (const sibling of pageState.annotationLayer.querySelectorAll("[data-link-group]")) {
      if (sibling.dataset.linkGroup === groupKey) {
        sibling.classList.toggle("is-group-hover", active);
      }
    }
  };

  link.addEventListener("mouseenter", () => setGroupHover(true));
  link.addEventListener("mouseleave", () => setGroupHover(false));
  link.addEventListener("focus", () => setGroupHover(true));
  link.addEventListener("blur", () => setGroupHover(false));
}

function queuePageRender(pageNumber) {
  const pageState = state.pages.get(pageNumber);
  if (!pageState || pageState.rendered || pageState.rendering || pageState.queued) {
    return;
  }

  pageState.queued = true;
  state.renderQueue.push(pageNumber);
  pumpRenderQueue();
}

function pumpRenderQueue() {
  while (state.activeRenders < 2 && state.renderQueue.length > 0) {
    const pageNumber = state.renderQueue.shift();
    const pageState = state.pages.get(pageNumber);

    if (!pageState || pageState.rendered) {
      continue;
    }

    pageState.queued = false;
    state.activeRenders += 1;
    renderPage(pageState)
      .catch(error => {
        console.error(error);
        setStatus(`Errore nel rendering della pagina ${pageState.pageNumber}.`, true);
      })
      .finally(() => {
        state.activeRenders -= 1;
        pumpRenderQueue();
      });
  }
}

function getTargetRenderScale(pageState) {
  const deviceScale = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_SCALE);
  const displayScale = Math.max(1, getPageDisplayScale(pageState));
  const maxAreaScale = Math.sqrt(MAX_CANVAS_PIXELS / (pageState.width * pageState.height));
  return Math.min(deviceScale * displayScale, maxAreaScale);
}

async function renderTextLayer(pageState) {
  if (pageState.textLayerRendered) {
    return;
  }

  try {
    pageState.pageElement.style.setProperty("--scale-factor", String(pageState.viewport.scale));
    const textLayer = new pdfjsLib.TextLayer({
      textContentSource: pageState.page.streamTextContent(),
      container: pageState.textLayer,
      viewport: pageState.viewport
    });
    await textLayer.render();
    pageState.textDivs = textLayer.textDivs || null;
    pageState.textLayerRendered = true;
  } catch (error) {
    console.error("Text layer non disponibile per la pagina", pageState.pageNumber, error);
  }
}

async function renderPage(pageState) {
  pageState.rendering = true;

  try {
    await waitForVisibleTab();
    const outputScale = getTargetRenderScale(pageState);
    const canvas = pageState.canvas;
    const context = canvas.getContext("2d", { alpha: false });
    canvas.width = Math.floor(pageState.width * outputScale);
    canvas.height = Math.floor(pageState.height * outputScale);
    canvas.style.width = `${pageState.width}px`;
    canvas.style.height = `${pageState.height}px`;

    await pageState.page.render({
      canvasContext: context,
      viewport: pageState.viewport,
      transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0]
    }).promise;

    pageState.renderedScale = outputScale;
    await renderTextLayer(pageState);
    await addAnnotationLinks(pageState);
    pageState.rendered = true;
    pageState.pageElement.classList.add("is-rendered");
    pageState.pageElement.setAttribute("aria-busy", "false");

    if (pageState.pageNumber === 1) {
      setStatus("");
      hideLoader();
    }

    // Con il text layer disponibile gli highlight diventano precisi
    if (state.searchQuery) {
      const pageResults = await renderSearchHighlights(pageState.pageNumber, state.searchQuery);
      updateSearchBadge(pageState.pageNumber, pageResults.length);
      const activeResult = state.searchResults[state.activeSearchIndex];
      if (activeResult && activeResult.pageNumber === pageState.pageNumber) {
        setActiveSearchHighlight(activeResult);
      }
    }
  } finally {
    pageState.rendering = false;
  }
}

async function renderAllThumbnails() {
  if (!state.pdf) {
    return;
  }

  for (let pageNumber = 1; pageNumber <= state.pdf.numPages; pageNumber += 1) {
    await renderThumbnail(pageNumber);
    if (pageNumber % 2 === 0) {
      await yieldToUi();
    }
  }
}

async function renderThumbnail(pageNumber) {
  const pageState = state.pages.get(pageNumber);
  if (!pageState || pageState.thumbRendered || pageState.thumbRendering) {
    return;
  }

  pageState.thumbRendering = true;

  try {
    // Nei tab in background i canvas possono uscire neri: attendi visibilità
    await waitForVisibleTab();
    const viewport = pageState.page.getViewport({ scale: THUMB_SCALE });
    const outputScale = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_SCALE);
    const canvas = pageState.thumbCanvas;
    const context = canvas.getContext("2d", { alpha: false });
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);

    const aspectRatio = viewport.width / viewport.height;
    let displayWidth = THUMB_MAX_WIDTH;
    let displayHeight = displayWidth / aspectRatio;

    if (displayHeight > THUMB_MAX_HEIGHT) {
      displayHeight = THUMB_MAX_HEIGHT;
      displayWidth = displayHeight * aspectRatio;
    }

    canvas.style.width = `${Math.round(displayWidth)}px`;
    canvas.style.height = `${Math.round(displayHeight)}px`;

    await pageState.page.render({
      canvasContext: context,
      viewport,
      transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0]
    }).promise;

    pageState.thumbRendered = true;
  } finally {
    pageState.thumbRendering = false;
  }
}

function getTextItemBox(pageState, item) {
  const transform = pdfjsLib.Util.transform(pageState.viewport.transform, item.transform);
  const left = transform[4];
  const fontHeight = Math.hypot(transform[2], transform[3]);
  const height = Math.max(6, fontHeight || item.height * pageState.viewport.scale || 10);
  const width = Math.max(1, Math.abs(item.width * pageState.viewport.scale));
  const top = transform[5] - height;

  return { left, top, width, height };
}

function normalizeSearchText(text) {
  return text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLocaleLowerCase("it-IT");
}

function normalizeSearchQuery(rawQuery) {
  return normalizeSearchText(rawQuery).replace(/\s+/gu, " ").trim();
}

function isWordCharacter(character) {
  return WORD_CHARACTER_PATTERN.test(character);
}

// Le parole sillabate a fine riga vengono ricomposte senza separatore e trattino.
function isHyphenLineBreak(previous, next) {
  return Boolean(
    previous?.hasEOL &&
    /\p{L}-$/u.test(previous.str) &&
    next && /^\p{L}/u.test(next.str)
  );
}

function shouldSeparateItems(previous, next) {
  if (!previous) {
    return false;
  }

  if (isHyphenLineBreak(previous, next)) {
    return false;
  }

  if (previous.hasEOL) {
    return true;
  }

  if (/\s$/u.test(previous.str) || /^\s/u.test(next.str)) {
    return false;
  }

  const lineHeight = Math.max(previous.height, next.height);
  if (Math.abs(previous.top - next.top) > lineHeight * 0.5) {
    return true;
  }

  const gap = next.left - (previous.left + previous.width);
  return gap > Math.max(1.5, previous.height * 0.28);
}

async function getPageSearchModel(pageNumber) {
  const pageState = state.pages.get(pageNumber);
  if (!pageState) {
    return null;
  }

  if (pageState.searchModel) {
    return pageState.searchModel;
  }

  const textContent = await pageState.page.getTextContent();
  const items = [];

  textContent.items.forEach((item, contentIndex) => {
    if (!item.str || !item.str.trim()) {
      return;
    }

    const entry = {
      str: item.str,
      hasEOL: Boolean(item.hasEOL),
      contentIndex,
      ...getTextItemBox(pageState, item)
    };

    if (entry.width > 0 && entry.height > 0) {
      items.push(entry);
    }
  });

  let text = "";
  const refs = [];

  items.forEach((item, itemIndex) => {
    if (shouldSeparateItems(items[itemIndex - 1], item) && text && !text.endsWith(" ")) {
      text += " ";
      refs.push(null);
    }

    const dropTrailingHyphen = isHyphenLineBreak(item, items[itemIndex + 1]);

    for (let charIndex = 0; charIndex < item.str.length; charIndex += 1) {
      if (dropTrailingHyphen && charIndex === item.str.length - 1) {
        continue;
      }

      const sourceChar = item.str[charIndex];

      if (/\s/u.test(sourceChar)) {
        if (text && !text.endsWith(" ")) {
          text += " ";
          refs.push({ itemIndex, charIndex });
        }
        continue;
      }

      for (const normalizedChar of normalizeSearchText(sourceChar)) {
        text += normalizedChar;
        refs.push({ itemIndex, charIndex });
      }
    }
  });

  pageState.searchModel = { pageState, items, text, refs };
  return pageState.searchModel;
}

// Tier di precisione del match: parola intera, inizio parola, sottostringa.
function classifyMatch(text, start, end) {
  if (start > 0 && isWordCharacter(text[start - 1])) {
    return 0;
  }

  return end >= text.length || !isWordCharacter(text[end]) ? 2 : 1;
}

function findPageMatches(model, query) {
  const matches = [];
  let index = model.text.indexOf(query);

  while (index !== -1) {
    const end = index + query.length;
    matches.push({ start: index, end, tier: classifyMatch(model.text, index, end) });
    index = model.text.indexOf(query, index + 1);
  }

  return matches;
}

function selectPageMatches(model, query) {
  const selected = [];

  for (const match of findPageMatches(model, query)) {
    const previous = selected[selected.length - 1];
    if (!previous || match.start >= previous.end) {
      selected.push(match);
    } else {
      previous.tier = Math.max(previous.tier, match.tier);
    }
  }

  return selected;
}

// Ricostruisce il testo originale (maiuscole e accenti inclusi) da un
// intervallo del testo normalizzato, tramite la mappa dei riferimenti
function getSourceText(model, start, end) {
  let text = "";
  let lastRef = null;

  for (let i = start; i < end; i += 1) {
    const ref = model.refs[i];

    if (!ref) {
      text += " ";
      lastRef = null;
      continue;
    }

    if (lastRef && ref.itemIndex === lastRef.itemIndex && ref.charIndex === lastRef.charIndex) {
      continue;
    }

    text += model.items[ref.itemIndex].str[ref.charIndex];
    lastRef = ref;
  }

  return text;
}

function buildSnippet(model, range) {
  const beforeStart = Math.max(0, range.start - SNIPPET_BEFORE_CHARS);
  const afterEnd = Math.min(model.text.length, range.end + SNIPPET_AFTER_CHARS);

  return {
    before: (beforeStart > 0 ? "…" : "") + getSourceText(model, beforeStart, range.start),
    match: getSourceText(model, range.start, range.end),
    after: getSourceText(model, range.end, afterEnd) + (afterEnd < model.text.length ? "…" : "")
  };
}

function getMatchBoxes(model, match) {
  const segments = new Map();

  for (let i = match.start; i < match.end; i += 1) {
    const ref = model.refs[i];
    if (!ref) {
      continue;
    }

    const segment = segments.get(ref.itemIndex);
    if (segment) {
      segment.startChar = Math.min(segment.startChar, ref.charIndex);
      segment.endChar = Math.max(segment.endChar, ref.charIndex + 1);
    } else {
      segments.set(ref.itemIndex, {
        startChar: ref.charIndex,
        endChar: ref.charIndex + 1
      });
    }
  }

  const boxes = [];

  for (const [itemIndex, segment] of segments) {
    const item = model.items[itemIndex];
    const preciseBoxes = getPreciseSegmentBoxes(model.pageState, item, segment.startChar, segment.endChar);

    if (preciseBoxes) {
      boxes.push(...preciseBoxes);
      continue;
    }

    const textLength = Math.max(1, item.str.length);
    const startRatio = segment.startChar / textLength;
    const endRatio = segment.endChar / textLength;
    const horizontalPadding = Math.min(2, item.width * 0.015);
    const verticalPadding = item.height * 0.08;

    boxes.push({
      left: item.left + item.width * startRatio - horizontalPadding,
      top: item.top + verticalPadding,
      width: Math.max(4, item.width * (endRatio - startRatio) + horizontalPadding * 2),
      height: Math.max(4, item.height - verticalPadding * 2)
    });
  }

  return boxes;
}

function getPreciseSegmentBoxes(pageState, item, startChar, endChar) {
  const span = pageState.textDivs?.[item.contentIndex];
  const textNode = span?.firstChild;

  if (
    !textNode ||
    textNode.nodeType !== Node.TEXT_NODE ||
    textNode.data !== item.str ||
    !span.isConnected
  ) {
    return null;
  }

  const pageRect = pageState.pageElement.getBoundingClientRect();
  if (!pageRect.width || !pageState.width) {
    return null;
  }

  const displayScale = pageRect.width / pageState.width;
  const range = document.createRange();
  range.setStart(textNode, startChar);
  range.setEnd(textNode, endChar);

  const boxes = [];
  for (const rect of range.getClientRects()) {
    if (rect.width <= 0 || rect.height <= 0) {
      continue;
    }

    boxes.push({
      left: (rect.left - pageRect.left) / displayScale - 1,
      top: (rect.top - pageRect.top) / displayScale - 1,
      width: rect.width / displayScale + 2,
      height: rect.height / displayScale + 2
    });
  }

  return boxes.length > 0 ? boxes : null;
}

async function renderSearchHighlights(pageNumber, query) {
  const pageState = state.pages.get(pageNumber);
  if (!pageState) {
    return [];
  }

  pageState.highlightLayer.replaceChildren();
  pageState.searchMatches = [];

  if (!query) {
    return [];
  }

  const model = await getPageSearchModel(pageNumber);
  if (!model) {
    return [];
  }

  const results = [];

  for (const match of selectPageMatches(model, query)) {
    const matchElements = [];

    for (const box of getMatchBoxes(model, match)) {
      const highlight = document.createElement("span");
      highlight.className = "search-highlight";
      highlight.style.left = `${box.left}px`;
      highlight.style.top = `${box.top}px`;
      highlight.style.width = `${box.width}px`;
      highlight.style.height = `${box.height}px`;
      pageState.highlightLayer.appendChild(highlight);
      matchElements.push(highlight);
    }

    if (matchElements.length > 0) {
      pageState.searchMatches.push(matchElements);
      results.push({
        pageNumber,
        occurrence: pageState.searchMatches.length,
        tier: match.tier,
        start: match.start,
        snippet: buildSnippet(model, match)
      });
    }
  }

  return results;
}

function setActiveSearchHighlight(result) {
  for (const pageState of state.pages.values()) {
    pageState.shell.classList.toggle("search-focus", pageState.pageNumber === result.pageNumber);

    for (const matchElements of pageState.searchMatches || []) {
      for (const highlight of matchElements) {
        highlight.classList.remove("is-active");
      }
    }
  }

  const pageState = state.pages.get(result.pageNumber);
  const activeMatch = pageState?.searchMatches?.[result.occurrence - 1] || [];

  for (const highlight of activeMatch) {
    highlight.classList.add("is-active");
  }

  return activeMatch[0] || null;
}

function cancelSearchScroll() {
  if (!state.searchScrollFrame) {
    return;
  }

  window.cancelAnimationFrame(state.searchScrollFrame);
  state.searchScrollFrame = 0;
}

function scrollToSearchResult(result) {
  const pageState = state.pages.get(result.pageNumber);
  if (!pageState) {
    return;
  }

  queuePageRender(result.pageNumber);
  state.currentPage = result.pageNumber;
  updateActiveThumbnail();

  const activeHighlight = setActiveSearchHighlight(result);
  if (!activeHighlight) {
    scrollToPage(result.pageNumber, { fromSearch: true, behavior: "auto" });
    return;
  }

  cancelSearchScroll();
  state.searchScrollFrame = window.requestAnimationFrame(() => {
    state.searchScrollFrame = 0;

    if (!activeHighlight.isConnected || !activeHighlight.classList.contains("is-active")) {
      return;
    }

    const rect = activeHighlight.getBoundingClientRect();
    const viewportRect = getDocumentViewportRect();
    const viewportCenter = getViewportCenterY();
    const targetTop = getDocumentScrollTop() +
      rect.top -
      viewportRect.top +
      rect.height / 2 -
      (viewportCenter - viewportRect.top);
    scrollDocumentTo(targetTop);
    updateCurrentPage();
  });
}

async function runSearch(rawQuery) {
  const query = normalizeSearchQuery(rawQuery);
  const token = ++state.searchToken;
  const navigationSerial = state.navigationSerial;
  state.searchQuery = query;
  state.searchResults = [];
  state.activeSearchIndex = -1;
  cancelSearchScroll();
  resetSearchBadges();
  body.classList.toggle("search-active", query.length > 0);

  if (!query) {
    elements.searchStatus.textContent = "";
    return;
  }

  elements.searchStatus.textContent = "Ricerca in corso...";

  for (let pageNumber = 1; pageNumber <= state.pdf.numPages; pageNumber += 1) {
    if (token !== state.searchToken) {
      return;
    }

    const pageResults = await renderSearchHighlights(pageNumber, query);
    updateSearchBadge(pageNumber, pageResults.length);
    state.searchResults.push(...pageResults);

    if (pageNumber % 3 === 0) {
      await yieldToUi();
    }
  }

  if (token !== state.searchToken) {
    return;
  }

  if (state.searchResults.length === 0) {
    elements.searchStatus.textContent = "Nessun risultato";
    updateSidebarHeading();
    return;
  }

  state.searchResults.sort((a, b) =>
    b.tier - a.tier ||
    a.pageNumber - b.pageNumber ||
    a.start - b.start
  );
  renderSearchResultList();

  if (state.navigationSerial === navigationSerial) {
    state.activeSearchIndex = 0;
    goToSearchResult(0);
  } else {
    elements.searchStatus.textContent = `${state.searchResults.length} risultati`;
  }
}

function goToSearchResult(index) {
  if (state.searchResults.length === 0) {
    return;
  }

  state.activeSearchIndex = (index + state.searchResults.length) % state.searchResults.length;
  const result = state.searchResults[state.activeSearchIndex];
  elements.searchStatus.textContent = `${state.activeSearchIndex + 1} di ${state.searchResults.length} - pagina ${result.pageNumber}`;
  updateActiveSearchResultButton();

  scrollToSearchResult(result);
}

function setupObservers() {
  const pageObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const pageNumber = Number(entry.target.dataset.pageNumber);
      const pageState = state.pages.get(pageNumber);
      if (pageState) {
        pageState.visible = entry.isIntersecting;
      }

      if (entry.isIntersecting) {
        queuePageRender(pageNumber);
      }
    }
  }, { rootMargin: "900px 0px" });

  const keepObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) {
        evictPage(Number(entry.target.dataset.pageNumber));
      }
    }
  }, { rootMargin: EVICTION_KEEP_MARGIN });

  const thumbObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        renderThumbnail(Number(entry.target.dataset.pageNumber));
      }
    }
  }, { root: elements.thumbnailPanel, rootMargin: "400px 0px" });

  for (const pageState of state.pages.values()) {
    pageObserver.observe(pageState.shell);
    keepObserver.observe(pageState.shell);
    thumbObserver.observe(pageState.thumbButton);
  }
}

function isNativeZoomShortcut(event) {
  return state.pointerInDocumentArea && (event.ctrlKey || event.metaKey) && !event.altKey;
}

function handleNativeZoomShortcut(event) {
  if (!isNativeZoomShortcut(event)) {
    return;
  }

  const key = event.key.toLowerCase();
  const code = event.code;
  const shouldZoomIn = key === "+" || key === "=" || code === "NumpadAdd";
  const shouldZoomOut = key === "-" || key === "_" || code === "NumpadSubtract";
  const shouldReset = key === "0" || code === "Digit0" || code === "Numpad0";

  if (!shouldZoomIn && !shouldZoomOut && !shouldReset) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  if (shouldReset) {
    applyZoom(1);
  } else {
    applyZoom(state.zoom + (shouldZoomIn ? ZOOM_STEP : -ZOOM_STEP));
  }
}

function handleNativeZoomWheel(event) {
  if (
    !(event.ctrlKey || event.metaKey) ||
    !elements.documentArea.contains(event.target)
  ) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const factor = Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY);
  applyZoom(state.zoom * factor);
}

function handleGestureStart(event) {
  if (!elements.documentArea.contains(event.target)) {
    return;
  }

  event.preventDefault();
  state.gestureStartZoom = state.zoom;
}

function handleGestureChange(event) {
  if (!elements.documentArea.contains(event.target)) {
    return;
  }

  event.preventDefault();
  applyZoom(state.gestureStartZoom * event.scale);
}

async function buildPages() {
  elements.pageCount.textContent = `${state.pdf.numPages} pagine`;

  for (let pageNumber = 1; pageNumber <= state.pdf.numPages; pageNumber += 1) {
    if (!state.pages.get(1)?.rendered) {
      setStatus(`Preparazione pagina ${pageNumber} di ${state.pdf.numPages}...`);
    }
    const page = await state.pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const shellParts = createPageShell(pageNumber, viewport);
    const thumbParts = createThumbnail(pageNumber);

    const pageState = {
      pageNumber,
      page,
      viewport,
      width: viewport.width,
      height: viewport.height,
      fitScale: 1,
      shell: shellParts.shell,
      pageElement: shellParts.pageElement,
      canvas: shellParts.canvas,
      textLayer: shellParts.textLayer,
      highlightLayer: shellParts.highlightLayer,
      annotationLayer: shellParts.annotationLayer,
      visible: false,
      thumbButton: thumbParts.button,
      thumbCanvas: thumbParts.canvas,
      thumbHits: thumbParts.hits,
      rendered: false,
      rendering: false,
      queued: false,
      renderedScale: 0,
      textLayerRendered: false,
      annotationsRendered: false,
      thumbRendered: false,
      thumbRendering: false,
      searchModel: null,
      searchMatches: []
    };

    state.pages.set(pageNumber, pageState);
    setPageShellSize(pageState);
    elements.viewer.appendChild(pageState.shell);

    if (pageNumber === 1) {
      pageState.fitScale = getPageFitScale(pageState);
      setPageShellSize(pageState);
      queuePageRender(1);
      renderThumbnail(1);
      await yieldToUi();
    } else if (pageNumber % 4 === 0) {
      await yieldToUi();
    }
  }
}

function setupControls() {
  elements.sidebarToggle.addEventListener("click", () => {
    setSidebarCollapsed(!body.classList.contains("sidebar-collapsed"));
  });

  if (mobileViewportQuery.addEventListener) {
    mobileViewportQuery.addEventListener("change", syncSidebarForViewport);
  } else {
    mobileViewportQuery.addListener(syncSidebarForViewport);
  }

  if ("ResizeObserver" in window && header) {
    const headerObserver = new ResizeObserver(scheduleLayoutUpdate);
    headerObserver.observe(header);
  }

  elements.zoomOut.addEventListener("click", () => applyZoom(getButtonStepZoom(-1)));
  elements.zoomIn.addEventListener("click", () => applyZoom(getButtonStepZoom(1)));

  const goToTypedPage = () => {
    const value = Number.parseInt(elements.pageInput.value, 10);
    if (!Number.isFinite(value) || !state.pdf) {
      updatePageIndicator();
      return;
    }

    scrollToPage(clamp(value, 1, state.pdf.numPages));
  };

  elements.pageInput.addEventListener("change", goToTypedPage);
  elements.pageInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      goToTypedPage();
      elements.pageInput.blur();
    }
  });
  elements.pageInput.addEventListener("focus", () => elements.pageInput.select());
  elements.zoomInput.addEventListener("focus", () => elements.zoomInput.select());

  const markManualThumbScroll = () => {
    state.thumbManualScrollUntil = Date.now() + THUMB_MANUAL_SCROLL_GRACE;
  };

  elements.thumbnailPanel.addEventListener("wheel", markManualThumbScroll, { passive: true });
  elements.thumbnailPanel.addEventListener("touchmove", markManualThumbScroll, { passive: true });
  elements.thumbnailPanel.addEventListener("pointerdown", markManualThumbScroll, { passive: true });

  elements.zoomInput.addEventListener("change", () => {
    const value = getZoomInputValue();
    if (value === null) {
      elements.zoomInput.value = Math.round(state.zoom * 100);
      return;
    }

    applyZoom(value / 100);
  });

  let searchTimer = 0;
  elements.searchBox.addEventListener("click", event => {
    if (!elements.searchClear.contains(event.target)) {
      elements.searchInput.focus();
    }
  });

  elements.searchInput.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    body.classList.toggle("search-active", elements.searchInput.value.trim().length > 0);
    searchTimer = window.setTimeout(() => runSearch(elements.searchInput.value), 250);
  });

  elements.searchClear.addEventListener("click", async event => {
    event.preventDefault();
    window.clearTimeout(searchTimer);
    elements.searchInput.value = "";
    await runSearch("");
    elements.searchInput.focus();
  });

  elements.searchInput.addEventListener("keydown", async event => {
    if (event.key === "Escape") {
      event.preventDefault();
      window.clearTimeout(searchTimer);
      elements.searchInput.value = "";
      await runSearch("");
      return;
    }

    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    window.clearTimeout(searchTimer);

    const query = normalizeSearchQuery(elements.searchInput.value);
    if (!query) {
      await runSearch("");
      return;
    }

    if (query !== state.searchQuery || state.searchResults.length === 0) {
      await runSearch(elements.searchInput.value);
      return;
    }

    goToSearchResult(state.activeSearchIndex + (event.shiftKey ? -1 : 1));
  });

  elements.searchPrev.addEventListener("click", () => goToSearchResult(state.activeSearchIndex - 1));
  elements.searchNext.addEventListener("click", () => goToSearchResult(state.activeSearchIndex + 1));

  elements.thumbnailPanel.addEventListener("wheel", event => {
    const atTop = elements.thumbnailPanel.scrollTop <= 0;
    const atBottom = Math.ceil(elements.thumbnailPanel.scrollTop + elements.thumbnailPanel.clientHeight) >= elements.thumbnailPanel.scrollHeight;

    if ((atTop && event.deltaY < 0) || (atBottom && event.deltaY > 0)) {
      event.preventDefault();
    }
  }, { passive: false });

  // Mentre si trascina una selezione di testo, i link annotazione non devono
  // catturare il puntatore (altrimenti la selezione si interrompe su ogni link)
  elements.documentArea.addEventListener("pointerdown", event => {
    if (event.button === 0 && event.target.closest(".text-layer")) {
      body.classList.add("is-text-selecting");
    }
  });
  window.addEventListener("pointerup", () => body.classList.remove("is-text-selecting"));
  window.addEventListener("pointercancel", () => body.classList.remove("is-text-selecting"));

  elements.documentArea.addEventListener("scroll", scheduleCurrentPageUpdate, { passive: true });
  elements.documentArea.addEventListener("pointerenter", () => {
    state.pointerInDocumentArea = true;
  });
  elements.documentArea.addEventListener("pointerleave", () => {
    state.pointerInDocumentArea = false;
  });
  window.addEventListener("resize", scheduleLayoutUpdate, { passive: true });
  window.addEventListener("hashchange", () => {
    const pageNumber = getPageFromHash();
    if (pageNumber && state.pdf && pageNumber !== state.currentPage) {
      scrollToPage(clamp(pageNumber, 1, state.pdf.numPages), { behavior: "smooth" });
    }
  });
  window.addEventListener("keydown", handleNativeZoomShortcut, { capture: true });
  window.addEventListener("wheel", handleNativeZoomWheel, { capture: true, passive: false });
  window.addEventListener("gesturestart", handleGestureStart, { passive: false });
  window.addEventListener("gesturechange", handleGestureChange, { passive: false });
}

async function init() {
  try {
    syncHeaderHeight();
    syncSidebarForViewport();
    elements.title.textContent = documentTitle;
    document.title = `${documentTitle} - Documentazione`;
    elements.openPdfLink.href = pdfUrl.href;
    elements.downloadPdfLink.href = pdfUrl.href;
    elements.downloadPdfLink.download = getFileName(pdfUrl);

    setupControls();
    setStatus("Caricamento PDF...");
    state.pdf = await pdfjsLib.getDocument({ url: pdfUrl.href }).promise;

    await buildPages();
    updatePageFitScales(false);
    setupObservers();
    applyZoom(1, false);
    queuePageRender(1);
    queuePageRender(2);
    renderThumbnail(1);
    window.setTimeout(() => {
      renderAllThumbnails().catch(error => console.error(error));
    }, 300);

    const hashPage = getPageFromHash();
    if (hashPage && hashPage > 1) {
      scrollToPage(clamp(hashPage, 1, state.pdf.numPages));
    } else {
      updateActiveThumbnail();
    }

    if (!state.pages.get(1)?.rendered) {
      setStatus("Rendering prime pagine...");
    }
  } catch (error) {
    console.error(error);
    hideLoader();
    setStatus(error.message || "Impossibile caricare il documento.", true);
  }
}

init();
