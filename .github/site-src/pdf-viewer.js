import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs";

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
  activeSearchIndex: -1,
  navigationSerial: 0,
  scrollTicking: false,
  layoutTicking: false,
  searchScrollFrame: 0,
  gestureStartZoom: 1,
  pointerInDocumentArea: false
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function nextFrame() {
  return new Promise(resolve => window.requestAnimationFrame(resolve));
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
  });
}

function applyZoom(nextZoom, preserveScroll = true) {
  const anchor = preserveScroll ? getScrollAnchor() : null;
  state.zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
  document.documentElement.style.setProperty("--zoom", state.zoom.toString());
  elements.zoomInput.value = Math.round(state.zoom * 100);

  for (const pageState of state.pages.values()) {
    setPageShellSize(pageState);
  }

  if (anchor) {
    window.requestAnimationFrame(() => restoreScrollAnchor(anchor));
  }
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
  const highlightLayer = document.createElement("div");
  highlightLayer.className = "highlight-layer";

  const annotationLayer = document.createElement("div");
  annotationLayer.className = "annotation-layer";

  pageElement.append(canvas, highlightLayer, annotationLayer);
  shell.append(pageElement);

  return { shell, pageElement, canvas, highlightLayer, annotationLayer };
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

function updateActiveThumbnail() {
  for (const pageState of state.pages.values()) {
    pageState.thumbButton.classList.toggle("is-active", pageState.pageNumber === state.currentPage);
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
  for (const pageState of state.pages.values()) {
    updateSearchBadge(pageState.pageNumber, 0);
    pageState.shell.classList.remove("search-focus");
    pageState.highlightLayer.replaceChildren();
    pageState.searchHighlightElements = [];
  }
}

async function addAnnotationLinks(pageState) {
  const annotations = await pageState.page.getAnnotations({ intent: "display" });
  pageState.annotationLayer.replaceChildren();

  for (const annotation of annotations) {
    const link = await createAnnotationLink(pageState, annotation);
    if (link) {
      pageState.annotationLayer.appendChild(link);
    }
  }
}

async function createAnnotationLink(pageState, annotation) {
  if (!annotation.rect) {
    return null;
  }

  const rect = pageState.viewport.convertToViewportRectangle(annotation.rect);
  const left = Math.min(rect[0], rect[2]);
  const top = Math.min(rect[1], rect[3]);
  const width = Math.abs(rect[0] - rect[2]);
  const height = Math.abs(rect[1] - rect[3]);

  if (width < 1 || height < 1) {
    return null;
  }

  const rawUrl = annotation.url || annotation.unsafeUrl;
  if (rawUrl) {
    const targetHref = routeAnnotationUrl(rawUrl);
    if (!targetHref) {
      return null;
    }

    const link = document.createElement("a");
    link.className = "pdf-annotation-link";
    link.href = targetHref;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.title = targetHref;
    link.setAttribute("aria-label", `Apri link esterno: ${targetHref}`);
    positionLink(link, left, top, width, height);
    return link;
  }

  if (annotation.dest) {
    const link = document.createElement("a");
    link.className = "page-link";
    link.href = "#";
    link.setAttribute("aria-label", "Vai alla destinazione nel documento");
    positionLink(link, left, top, width, height);
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

async function renderPage(pageState) {
  pageState.rendering = true;

  const outputScale = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_SCALE);
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

  await addAnnotationLinks(pageState);
  pageState.rendered = true;
  pageState.rendering = false;
  pageState.pageElement.classList.add("is-rendered");
  pageState.pageElement.setAttribute("aria-busy", "false");

  if (pageState.pageNumber === 1) {
    setStatus("");
    hideLoader();
  }
}

async function renderThumbnail(pageNumber) {
  const pageState = state.pages.get(pageNumber);
  if (!pageState || pageState.thumbRendered || pageState.thumbRendering) {
    return;
  }

  pageState.thumbRendering = true;
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
  pageState.thumbRendering = false;
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

async function getPageSearchItems(pageNumber) {
  const pageState = state.pages.get(pageNumber);
  if (!pageState) {
    return [];
  }

  if (pageState.searchItems) {
    return pageState.searchItems;
  }

  const textContent = await pageState.page.getTextContent();
  pageState.searchItems = textContent.items
    .filter(item => item.str && item.str.trim())
    .map(item => ({
      str: item.str,
      lowerStr: item.str.toLocaleLowerCase("it-IT"),
      ...getTextItemBox(pageState, item)
    }))
    .filter(item => item.width > 0 && item.height > 0);

  return pageState.searchItems;
}

function isWordCharacter(character) {
  return WORD_CHARACTER_PATTERN.test(character);
}

function shouldExpandMatch(query) {
  return !/\s/u.test(query);
}

function expandMatchRange(text, start, length, query) {
  let expandedStart = start;
  let expandedEnd = start + length;

  if (!shouldExpandMatch(query)) {
    return { start: expandedStart, end: expandedEnd };
  }

  while (expandedStart > 0 && isWordCharacter(text[expandedStart - 1])) {
    expandedStart -= 1;
  }

  while (expandedEnd < text.length && isWordCharacter(text[expandedEnd])) {
    expandedEnd += 1;
  }

  return { start: expandedStart, end: expandedEnd };
}

function getMatchRanges(item, query) {
  const ranges = [];
  const text = item.str;
  const lowerText = item.lowerStr;
  let index = lowerText.indexOf(query);

  while (index !== -1) {
    const range = expandMatchRange(text, index, query.length, query);
    const isDuplicate = ranges.some(existing =>
      existing.start === range.start && existing.end === range.end
    );

    if (!isDuplicate) {
      ranges.push(range);
    }

    index = lowerText.indexOf(query, index + query.length);
  }

  return ranges;
}

async function renderSearchHighlights(pageNumber, query) {
  const pageState = state.pages.get(pageNumber);
  if (!pageState) {
    return 0;
  }

  pageState.highlightLayer.replaceChildren();
  pageState.searchHighlightElements = [];

  if (!query) {
    return 0;
  }

  const items = await getPageSearchItems(pageNumber);
  let count = 0;

  for (const item of items) {
    const matches = getMatchRanges(item, query);
    const textLength = Math.max(1, item.str.length);

    for (const match of matches) {
      const startRatio = match.start / textLength;
      const endRatio = match.end / textLength;
      const horizontalPadding = Math.min(2, item.width * 0.015);
      const verticalPadding = item.height * 0.08;
      const highlight = document.createElement("span");
      highlight.className = "search-highlight";
      highlight.style.left = `${item.left + item.width * startRatio - horizontalPadding}px`;
      highlight.style.top = `${item.top + verticalPadding}px`;
      highlight.style.width = `${Math.max(4, item.width * (endRatio - startRatio) + horizontalPadding * 2)}px`;
      highlight.style.height = `${Math.max(4, item.height - verticalPadding * 2)}px`;
      pageState.highlightLayer.appendChild(highlight);
      pageState.searchHighlightElements.push(highlight);
      count += 1;
    }
  }

  return count;
}

function setActiveSearchHighlight(result) {
  for (const pageState of state.pages.values()) {
    pageState.shell.classList.toggle("search-focus", pageState.pageNumber === result.pageNumber);

    for (const highlight of pageState.searchHighlightElements || []) {
      highlight.classList.remove("is-active");
    }
  }

  const pageState = state.pages.get(result.pageNumber);
  const activeHighlight = pageState?.searchHighlightElements?.[result.occurrence - 1];
  activeHighlight?.classList.add("is-active");
  return activeHighlight || null;
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
  const query = rawQuery.trim().toLocaleLowerCase("it-IT");
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

    const count = await renderSearchHighlights(pageNumber, query);
    updateSearchBadge(pageNumber, count);

    for (let i = 0; i < count; i += 1) {
      state.searchResults.push({ pageNumber, occurrence: i + 1 });
    }

    if (pageNumber % 3 === 0) {
      await nextFrame();
    }
  }

  if (token !== state.searchToken) {
    return;
  }

  if (state.searchResults.length === 0) {
    elements.searchStatus.textContent = "Nessun risultato";
    return;
  }

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

  scrollToSearchResult(result);
}

function setupObservers() {
  const pageObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        queuePageRender(Number(entry.target.dataset.pageNumber));
      }
    }
  }, { rootMargin: "900px 0px" });

  const thumbObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        renderThumbnail(Number(entry.target.dataset.pageNumber));
      }
    }
  }, { root: elements.thumbnailPanel, rootMargin: "400px 0px" });

  for (const pageState of state.pages.values()) {
    pageObserver.observe(pageState.shell);
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
    setStatus(`Preparazione pagina ${pageNumber} di ${state.pdf.numPages}...`);
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
      highlightLayer: shellParts.highlightLayer,
      annotationLayer: shellParts.annotationLayer,
      thumbButton: thumbParts.button,
      thumbCanvas: thumbParts.canvas,
      thumbHits: thumbParts.hits,
      rendered: false,
      rendering: false,
      queued: false,
      thumbRendered: false,
      thumbRendering: false,
      searchItems: null,
      searchHighlightElements: []
    };

    state.pages.set(pageNumber, pageState);
    setPageShellSize(pageState);
    elements.viewer.appendChild(pageState.shell);

    if (pageNumber % 4 === 0) {
      await nextFrame();
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
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    window.clearTimeout(searchTimer);

    const query = elements.searchInput.value.trim().toLocaleLowerCase("it-IT");
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

  elements.documentArea.addEventListener("scroll", scheduleCurrentPageUpdate, { passive: true });
  elements.documentArea.addEventListener("pointerenter", () => {
    state.pointerInDocumentArea = true;
  });
  elements.documentArea.addEventListener("pointerleave", () => {
    state.pointerInDocumentArea = false;
  });
  window.addEventListener("resize", scheduleLayoutUpdate, { passive: true });
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
    updateActiveThumbnail();
    queuePageRender(1);
    queuePageRender(2);
    renderThumbnail(1);
    setStatus("Rendering prime pagine...");
  } catch (error) {
    console.error(error);
    hideLoader();
    setStatus(error.message || "Impossibile caricare il documento.", true);
  }
}

init();
