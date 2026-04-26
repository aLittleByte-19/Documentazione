const views = {
  overview: "Overview operativa",
  assistant: "AI Assistant Generativo",
  copilot: "AI Co-Pilot per i CdL"
};

const mainNavItems = document.querySelectorAll(".nav-item");
const subNavItems = document.querySelectorAll(".nav-subitem");
const sections = document.querySelectorAll(".view");
const titleNode = document.getElementById("view-title");
const themeToggle = document.getElementById("theme-toggle");
const backToTopButton = document.getElementById("back-to-top");
const storedTheme = window.localStorage.getItem("nexum-theme");
const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
let currentTheme = storedTheme || (systemPrefersDark ? "dark" : "light");
let currentView = "overview";

function isVisibleNode(node) {
  return Boolean(node) && !node.classList.contains("is-hidden");
}

function setText(node, value) {
  if (node) {
    node.textContent = value;
  }
}

function setValue(node, value) {
  if (node) {
    node.value = value;
  }
}

function setModelValue(node, value) {
  if (!node) {
    return;
  }

  node.value = value;
  node.dataset.modelValue = value;
  node.closest(".field")?.classList.remove("has-manual-correction");
}

function renderMetricList(list, values) {
  if (!list) {
    return;
  }

  list.replaceChildren();
  values.forEach(([value, label]) => {
    const item = document.createElement("li");
    const strong = document.createElement("strong");
    const span = document.createElement("span");
    strong.textContent = value;
    span.textContent = label;
    item.append(strong, span);
    list.append(item);
  });
}

function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem("nexum-theme", theme);
  themeToggle?.setAttribute("aria-pressed", String(theme === "dark"));
  themeToggle?.setAttribute(
    "aria-label",
    theme === "dark" ? "Attiva tema chiaro" : "Attiva tema scuro"
  );
}

applyTheme(currentTheme);

themeToggle?.addEventListener("click", () => {
  applyTheme(currentTheme === "dark" ? "light" : "dark");
});

function updateBackToTopVisibility() {
  backToTopButton?.classList.toggle("visible", window.scrollY > 360);
}

function syncSubnavWithScroll() {
  const activeTargets = Array.from(subNavItems)
    .filter((button) => button.dataset.view === currentView && isVisibleNode(button))
    .map((button) => document.getElementById(button.dataset.target))
    .filter((target) => isVisibleNode(target));

  if (activeTargets.length === 0) {
    activateSubnav("workspace-top");
    return;
  }

  const nearPageBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8;
  if (nearPageBottom) {
    activateSubnav(activeTargets[activeTargets.length - 1].id);
    return;
  }

  const anchorOffset = 120;
  let activeId = activeTargets[0].id;
  let smallestDistance = Number.POSITIVE_INFINITY;

  activeTargets.forEach((target) => {
    const distance = Math.abs(target.getBoundingClientRect().top - anchorOffset);
    if (distance < smallestDistance) {
      smallestDistance = distance;
      activeId = target.id;
    }
  });

  activateSubnav(activeId);
}

function handleScroll() {
  updateBackToTopVisibility();
  syncSubnavWithScroll();
}

window.addEventListener("scroll", handleScroll, { passive: true });

backToTopButton?.addEventListener("click", () => {
  document.getElementById("workspace-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

updateBackToTopVisibility();

function setView(viewName) {
  if (!views[viewName]) {
    return;
  }

  mainNavItems.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewName);
  });

  sections.forEach((section) => {
    section.classList.toggle("active", section.dataset.view === viewName);
  });

  currentView = viewName;
  setText(titleNode, views[viewName]);
}

function activateSubnav(targetId) {
  subNavItems.forEach((button) => {
    button.classList.toggle("active", button.dataset.target === targetId);
  });
}

function setStepLocked(stepId, locked) {
  const step = document.querySelector(`[data-step="${stepId}"]`);
  if (!step) {
    return;
  }

  step.classList.toggle("locked", locked);
  step.setAttribute("aria-disabled", String(locked));

  step.querySelectorAll("button, input, select, textarea").forEach((control) => {
    control.disabled = locked;
  });
}

function unlockSteps(stepIds) {
  stepIds.forEach((stepId) => setStepLocked(stepId, false));
}

function goTo(viewName, targetId) {
  setView(viewName);
  activateSubnav(targetId);

  window.requestAnimationFrame(() => {
    const target = document.getElementById(targetId);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}

document.querySelectorAll(".nav-item, .nav-subitem").forEach((button) => {
  button.addEventListener("click", () => {
    goTo(button.dataset.view, button.dataset.target);
  });
});

document.querySelectorAll("[data-jump]").forEach((button) => {
  button.addEventListener("click", () => {
    goTo(button.dataset.jump, button.dataset.target);
  });
});

syncSubnavWithScroll();

const promptInput = document.getElementById("prompt-input");
const toneSelect = document.getElementById("tone-select");
const styleSelect = document.getElementById("style-select");
const channelSelect = document.getElementById("channel-select");
const audienceSelect = document.getElementById("audience-select");
const generateButton = document.getElementById("generate-button");
const savePromptButton = document.getElementById("save-prompt-button");
const cancelDraftButton = document.getElementById("cancel-draft-button");
const regenerateButton = document.getElementById("regenerate-button");
const saveDraftButton = document.getElementById("save-draft-button");
const exportButton = document.getElementById("export-button");
const exportFormatSelect = document.getElementById("export-format-select");
const sendButton = document.getElementById("send-button");
const recipientCategorySelect = document.getElementById("recipient-category-select");
const recipientEmailInput = document.getElementById("recipient-email-input");
const generatedTitleInput = document.getElementById("generated-title-input");
const generatedBodyInput = document.getElementById("generated-body-input");
const coverPreview = document.getElementById("cover-preview");
const coverLabel = document.getElementById("cover-label");
const coverUploadButton = document.getElementById("cover-upload-button");
const coverFileInput = document.getElementById("cover-file-input");
const assistantStatus = document.getElementById("assistant-status");
const assistantComposeNote = document.getElementById("assistant-compose-note");
const promptHistory = document.getElementById("prompt-history");
const promptSearch = document.getElementById("prompt-search");
const promptFilter = document.getElementById("prompt-filter");
const promptEmpty = document.getElementById("prompt-empty");
const metaChars = document.getElementById("meta-chars");
const metaTime = document.getElementById("meta-time");
const analyticsExportButton = document.getElementById("analytics-export-button");
const analyticsStatus = document.getElementById("analytics-status");
const assistantMetricPeriod = document.getElementById("assistant-metric-period");
const assistantMetricChannel = document.getElementById("assistant-metric-channel");
const assistantMetricList = document.getElementById("assistant-metric-list");
const assistantFeedbackList = document.getElementById("assistant-feedback-list");

[
  "assistant-review",
  "assistant-feedback",
  "copilot-analysis"
].forEach((stepId) => setStepLocked(stepId, true));

function topicFromPrompt(prompt) {
  const normalized = prompt.toLowerCase();

  if (normalized.includes("cedolin")) {
    return {
      title: "Cedolini disponibili nell'area documentale",
      subject: "i cedolini del mese",
      action: "accedere all'area documentale e consultare il cedolino nella sezione dedicata",
      benefit: "trovare il documento senza passaggi manuali o richieste al team HR"
    };
  }

  if (normalized.includes("ferie") || normalized.includes("permess")) {
    return {
      title: "Aggiornamento procedura ferie e permessi",
      subject: "la procedura di richiesta ferie e permessi",
      action: "inserire le nuove richieste dal percorso aggiornato nel portale",
      benefit: "ridurre errori e tempi di approvazione"
    };
  }

  if (normalized.includes("benefit")) {
    return {
      title: "Aggiornamento benefit aziendali",
      subject: "le informazioni sui benefit aziendali",
      action: "consultare la scheda aggiornata nell'area comunicazioni",
      benefit: "avere indicazioni più chiare su servizi, scadenze e modalità di accesso"
    };
  }

  return {
    title: "Nuova area documentale disponibile su NEXUM",
    subject: "la nuova area documentale NEXUM",
    action: "entrare in NEXUM e aprire la sezione Storico documenti",
    benefit: "consultare comunicazioni, cedolini e materiali condivisi in modo più semplice"
  };
}

function buildTitle(prompt, channel) {
  const topic = topicFromPrompt(prompt);

  if (channel === "News portale") {
    return topic.title.replace(" disponibile", "");
  }

  if (channel === "Notifica rapida") {
    return topic.title
      .replace("Nuova area documentale disponibile su NEXUM", "Area documentale aggiornata")
      .replace("Aggiornamento ", "");
  }

  return topic.title;
}

function buildBody(prompt, tone, style, channel, audience) {
  const topic = topicFromPrompt(prompt);
  const audienceLabel = audience.toLowerCase();
  const opening =
    tone === "Più istituzionale"
      ? `Gentili colleghi, vi informiamo che ${topic.subject} è ora disponibile.`
      : tone === "Più sintetico"
        ? `${topic.title}.`
        : `Ciao, ${topic.subject} è ora disponibile.`;

  const benefitLine =
    tone === "Più istituzionale"
      ? `L'aggiornamento consente a ${audienceLabel} di ${topic.benefit}, mantenendo un accesso ordinato e tracciabile.`
      : `La novità permette a ${audienceLabel} di ${topic.benefit}.`;

  const actionLine =
    style === "Avviso operativo"
      ? `Azione richiesta: ${topic.action}. In caso di dati non corretti, segnala l'anomalia al referente HR.`
      : style === "Aggiornamento breve"
        ? `Per procedere, ${topic.action}.`
        : `Puoi ${topic.action}; le informazioni restano raccolte nello stesso spazio e sono disponibili quando servono.`;

  if (channel === "Notifica rapida") {
    return `${opening} ${actionLine}`;
  }

  if (channel === "News portale") {
    return `${opening}\n\n${benefitLine}\n\n${actionLine}`;
  }

  const closing =
    tone === "Più istituzionale"
      ? "Grazie per la collaborazione."
      : "Grazie e buona consultazione.";

  return `${opening}\n\n${benefitLine}\n\n${actionLine}\n\n${closing}`;
}

function updateMeta() {
  if (!generatedBodyInput) {
    return;
  }

  const chars = generatedBodyInput.value.length;
  setText(metaChars, `${chars} caratteri`);
  setText(metaTime, `${Math.max(1, Math.round(chars / 500))} min lettura`);
}

let coverObjectUrl = "";

function resetCover(label = "Cover generata per il canale scelto") {
  if (coverObjectUrl) {
    URL.revokeObjectURL(coverObjectUrl);
    coverObjectUrl = "";
  }
  if (coverPreview) {
    coverPreview.style.backgroundImage = "";
    coverPreview.classList.remove("has-cover");
  }
  setText(coverLabel, label);
  if (coverFileInput) {
    coverFileInput.value = "";
  }
}

function tagsFor(channel, tone, favorite = false) {
  const tags = [];
  if (favorite) {
    tags.push("preferito");
  }
  if (channel === "Email interna") {
    tags.push("email");
  }
  if (channel === "News portale") {
    tags.push("portale");
  }
  if (tone === "Più sintetico") {
    tags.push("sintetico");
  }
  if (tone === "Più istituzionale") {
    tags.push("istituzionale");
  }
  if (tone === "Chiaro e diretto") {
    tags.push("chiaro");
  }
  return tags.join(" ");
}

function setFavoriteButtonState(button, favorite) {
  button.classList.toggle("active", favorite);
  button.setAttribute("aria-pressed", String(favorite));
  button.setAttribute("aria-label", favorite ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti");
}

function appendHistoryItem(title, prompt, channel, tone, favorite = false) {
  if (!promptHistory) {
    return;
  }

  const item = document.createElement("li");
  item.className = "history-item";
  item.dataset.tags = tagsFor(channel, tone, favorite);

  const main = document.createElement("div");
  main.className = "history-main";

  const strong = document.createElement("strong");
  strong.textContent = title;

  const meta = document.createElement("span");
  meta.textContent = `${channel} · ${tone} · adesso`;

  const action = document.createElement("button");
  action.className = "text-button";
  action.type = "button";
  action.dataset.reusePrompt = prompt;
  action.textContent = "Riusa";

  const favoriteButton = document.createElement("button");
  favoriteButton.className = "favorite-button";
  favoriteButton.type = "button";
  favoriteButton.dataset.favorite = "";
  favoriteButton.textContent = "★";
  setFavoriteButtonState(favoriteButton, favorite);

  const actions = document.createElement("div");
  actions.className = "history-actions";
  actions.append(favoriteButton, action);

  main.append(strong, meta);
  item.append(main, actions);
  promptHistory.prepend(item);
  applyPromptFilters();
}

function validatePrompt() {
  const prompt = promptInput?.value.trim() || "";
  if (prompt.length < 12) {
    setText(assistantComposeNote, "Aggiungi qualche dettaglio al prompt prima di generare.");
    promptInput?.focus();
    return false;
  }
  return true;
}

function generateDraft({ addToHistory = true, variant = false } = {}) {
  if (!validatePrompt()) {
    return;
  }

  const title = variant
    ? `${buildTitle(promptInput.value, channelSelect.value)} - variante`
    : buildTitle(promptInput.value, channelSelect.value);
  const body = buildBody(
    promptInput.value,
    toneSelect.value,
    styleSelect.value,
    channelSelect.value,
    audienceSelect.value
  );

  if (generatedTitleInput) {
    generatedTitleInput.value = title;
  }
  if (generatedBodyInput) {
    generatedBodyInput.value = variant
      ? body
          .replace(/^Ciao, /, "Buone notizie: ")
          .replace(/^Gentili colleghi, vi informiamo che /, "Vi informiamo che ")
          .replace(/^(.+)\.$/, "$1. Questa variante usa un'apertura più sintetica.")
      : body;
  }

  updateMeta();
  resetCover(variant ? "Cover rigenerata per la nuova variante" : "Cover generata per il canale scelto");
  setText(assistantStatus, variant ? "Variante pronta" : "Bozza aggiornata");
  setText(assistantComposeNote, "Bozza generata e pronta per la revisione.");
  if (recipientCategorySelect && audienceSelect) {
    recipientCategorySelect.value = audienceSelect.value;
  }

  if (addToHistory) {
    appendHistoryItem(title, promptInput.value, channelSelect.value, toneSelect.value);
  }

  unlockSteps(["assistant-review", "assistant-feedback"]);
  resetRatingState();
  goTo("assistant", "assistant-review");
}

generateButton?.addEventListener("click", () => {
  generateDraft();
});

regenerateButton?.addEventListener("click", () => {
  generateDraft({ addToHistory: false, variant: true });
});

function resetDraft() {
  setValue(generatedTitleInput, "");
  setValue(generatedBodyInput, "");
  setValue(recipientCategorySelect, "");
  setValue(recipientEmailInput, "");
  resetCover();
  setText(assistantStatus, "Bozza annullata");
  setText(assistantComposeNote, "Bozza annullata. Puoi modificare il prompt e generarne una nuova.");
  updateMeta();
  resetRatingState();
  setStepLocked("assistant-review", true);
  setStepLocked("assistant-feedback", true);
  goTo("assistant", "assistant-compose");
}

cancelDraftButton?.addEventListener("click", resetDraft);

coverUploadButton?.addEventListener("click", () => {
  coverFileInput?.click();
});

coverFileInput?.addEventListener("change", () => {
  const file = coverFileInput.files?.[0];
  if (!file) {
    return;
  }

  const supportedTypes = ["image/png", "image/jpeg", "image/webp"];
  if (!supportedTypes.includes(file.type)) {
    setText(assistantStatus, "Formato immagine non supportato. Usa PNG, JPG o WebP.");
    coverFileInput.value = "";
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    setText(assistantStatus, "Immagine troppo pesante. Scegli un file sotto 5 MB.");
    coverFileInput.value = "";
    return;
  }

  if (coverObjectUrl) {
    URL.revokeObjectURL(coverObjectUrl);
  }
  coverObjectUrl = URL.createObjectURL(file);
  if (coverPreview) {
    coverPreview.style.backgroundImage = `linear-gradient(rgba(15, 23, 32, 0.18), rgba(15, 23, 32, 0.42)), url("${coverObjectUrl}")`;
    coverPreview.classList.add("has-cover");
  }
  setText(coverLabel, file.name);
  setText(assistantStatus, "Cover sostituita.");
});

savePromptButton?.addEventListener("click", () => {
  if (!validatePrompt()) {
    return;
  }

  appendHistoryItem("Prompt salvato", promptInput.value, channelSelect.value, toneSelect.value, true);
  setText(assistantComposeNote, "Prompt salvato nello storico.");
});

saveDraftButton?.addEventListener("click", () => {
  setText(assistantStatus, "Bozza salvata");
});

exportButton?.addEventListener("click", () => {
  const format = exportFormatSelect?.value || "PDF";
  setText(assistantStatus, `${format} pronto per il download`);
});

function parseExplicitRecipients(value) {
  return value
    .split(/[\s,;]+/)
    .map((email) => email.trim())
    .filter(Boolean);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

sendButton?.addEventListener("click", () => {
  const category = recipientCategorySelect?.value || "";
  const explicitRecipients = parseExplicitRecipients(recipientEmailInput?.value || "");
  const invalidRecipients = explicitRecipients.filter((email) => !isValidEmail(email));

  if (!category && explicitRecipients.length === 0) {
    setText(assistantStatus, "Seleziona una categoria o indica almeno una persona.");
    recipientCategorySelect?.focus();
    return;
  }

  if (invalidRecipients.length > 0) {
    setText(assistantStatus, `Controlla questi indirizzi: ${invalidRecipients.join(", ")}`);
    recipientEmailInput?.focus();
    return;
  }

  if (!ratingSubmitted) {
    setText(assistantStatus, "Valuta la bozza prima dell'invio.");
    setText(ratingNote, "Seleziona e invia una valutazione prima di procedere.");
    ratingNote?.classList.remove("hidden");
    goTo("assistant", "assistant-feedback");
    return;
  }

  const parts = [];
  if (category) {
    parts.push(category);
  }
  if (explicitRecipients.length > 0) {
    parts.push(`${explicitRecipients.length} destinatari specifici`);
  }

  setText(assistantStatus, `Invio registrato per: ${parts.join(" + ")}`);
});

generatedBodyInput?.addEventListener("input", updateMeta);
updateMeta();

function applyPromptFilters() {
  if (!promptHistory) {
    return;
  }

  const query = (promptSearch?.value || "").trim().toLowerCase();
  const filter = promptFilter?.value || "";
  let visibleCount = 0;

  promptHistory.querySelectorAll(".history-item").forEach((item) => {
    const text = item.textContent.toLowerCase();
    const tags = item.dataset.tags || "";
    const matchesQuery = !query || text.includes(query);
    const matchesFilter = !filter || tags.includes(filter);
    const visible = matchesQuery && matchesFilter;
    item.classList.toggle("hidden", !visible);
    if (visible) {
      visibleCount += 1;
    }
  });

  promptEmpty?.classList.toggle("hidden", visibleCount > 0);
}

promptSearch?.addEventListener("input", applyPromptFilters);
promptFilter?.addEventListener("change", applyPromptFilters);

promptHistory?.addEventListener("click", (event) => {
  const favoriteButton = event.target.closest("[data-favorite]");
  if (favoriteButton) {
    const item = favoriteButton.closest(".history-item");
    const tags = new Set((item?.dataset.tags || "").split(" ").filter(Boolean));
    const favorite = favoriteButton.getAttribute("aria-pressed") !== "true";

    if (favorite) {
      tags.add("preferito");
    } else {
      tags.delete("preferito");
    }

    if (item) {
      item.dataset.tags = Array.from(tags).join(" ");
    }
    setFavoriteButtonState(favoriteButton, favorite);
    applyPromptFilters();
    return;
  }

  const button = event.target.closest("[data-reuse-prompt]");
  if (!button) {
    return;
  }

  if (promptInput) {
    promptInput.value = button.dataset.reusePrompt;
  }
  setText(assistantComposeNote, "Prompt caricato. Puoi modificarlo o generare una nuova bozza.");
  goTo("assistant", "assistant-compose");
});

let selectedRating = 0;
let ratingSubmitted = false;
const ratingButtons = document.querySelectorAll("[data-rating]");
const ratingSubmitButton = document.getElementById("rating-submit-button");
const ratingNote = document.getElementById("rating-note");
const ratingComment = document.getElementById("rating-comment");

function updateRating(value) {
  selectedRating = value;
  const toneClass =
    selectedRating <= 2
      ? "rating-low"
      : selectedRating === 3
        ? "rating-mid"
        : "rating-high";

  ratingButtons.forEach((button) => {
    const rating = Number(button.dataset.rating);
    const active = rating <= selectedRating;
    button.classList.toggle("active", active);
    button.classList.toggle("rating-low", active && toneClass === "rating-low");
    button.classList.toggle("rating-mid", active && toneClass === "rating-mid");
    button.classList.toggle("rating-high", active && toneClass === "rating-high");
    button.setAttribute("aria-pressed", String(active));
  });
  ratingNote?.classList.add("hidden");
}

ratingButtons.forEach((button) => {
  button.addEventListener("click", () => {
    updateRating(Number(button.dataset.rating));
  });
});

function resetRatingState() {
  selectedRating = 0;
  ratingSubmitted = false;
  updateRating(0);
  ratingButtons.forEach((button) => {
    button.disabled = false;
  });
  if (ratingComment) {
    ratingComment.disabled = false;
  }
  if (ratingSubmitButton) {
    ratingSubmitButton.disabled = false;
  }
  ratingNote?.classList.add("hidden");
}

updateRating(selectedRating);

ratingSubmitButton?.addEventListener("click", () => {
  if (selectedRating === 0) {
    setText(ratingNote, "Seleziona una valutazione prima di inviare.");
    ratingNote?.classList.remove("hidden");
    return;
  }

  setText(ratingNote, "Grazie, feedback registrato.");
  ratingNote?.classList.remove("hidden");
  ratingSubmitted = true;
  ratingButtons.forEach((button) => {
    button.disabled = true;
  });
  if (ratingComment) {
    ratingComment.disabled = true;
  }
  ratingSubmitButton.disabled = true;
});

analyticsExportButton?.addEventListener("click", () => {
  setText(analyticsStatus, "Report pronto per il download.");
  analyticsStatus?.classList.remove("hidden");
});

function updateAssistantAnalytics() {
  const period = assistantMetricPeriod?.value || "Ultimi 30 giorni";
  const channel = assistantMetricChannel?.value || "Tutti";
  const shortPeriod = period === "Ultimi 7 giorni";
  const currentMonth = period === "Mese corrente";
  const channelFactor = channel === "Tutti" ? 1 : channel === "Notifica rapida" ? 0.38 : 0.62;
  const generated = Math.round((shortPeriod ? 14 : currentMonth ? 31 : 38) * channelFactor);
  const reused = Math.max(2, Math.round((shortPeriod ? 4 : currentMonth ? 9 : 11) * channelFactor));
  const rating = channel === "Notifica rapida" ? "4,4" : channel === "News portale" ? "4,7" : "4,6";

  renderMetricList(assistantMetricList, [
    [String(generated), "Contenuti generati"],
    [String(reused), "Prompt riutilizzati"],
    [rating, "Rating medio"],
    [period, "Filtro temporale attivo"]
  ]);

  renderMetricList(assistantFeedbackList, [
    ["5/5", channel === "Tutti" ? "Testo pronto senza correzioni rilevanti" : `Output efficace per ${channel.toLowerCase()}`],
    ["4/5", shortPeriod ? "Richieste più sintetiche nei prompt recenti" : "Buona struttura, apertura da rendere più sintetica"]
  ]);
}

assistantMetricPeriod?.addEventListener("change", updateAssistantAnalytics);
assistantMetricChannel?.addEventListener("change", updateAssistantAnalytics);
updateAssistantAnalytics();

const uploadBox = document.getElementById("upload-box");
const uploadState = document.getElementById("upload-state");
const detectedConfidence = document.getElementById("detected-confidence");
const confidenceHint = document.getElementById("confidence-hint");
const analysisNote = document.getElementById("analysis-note");
const editingContext = document.getElementById("editing-context");
const recipientList = document.getElementById("recipient-list");
const splitState = document.getElementById("split-state");
const dispatchReady = document.getElementById("dispatch-ready");
const dispatchStatus = document.getElementById("dispatch-status");
const copilotMetricPeriod = document.getElementById("copilot-metric-period");
const copilotMetricStatus = document.getElementById("copilot-metric-status");
const copilotMetricList = document.getElementById("copilot-metric-list");
const documentSearch = document.getElementById("document-search");
const documentDeliveryFilter = document.getElementById("document-delivery-filter");
const documentConfidenceMode = document.getElementById("document-confidence-mode");
const documentConfidenceThreshold = document.getElementById("document-confidence-threshold");
const documentMonthFilter = document.getElementById("document-month-filter");
const documentYearFilter = document.getElementById("document-year-filter");
const documentHistory = document.getElementById("document-history");
const documentEmpty = document.getElementById("document-empty");
const documentSummaryList = document.getElementById("document-summary-list");
const documentPageInfo = document.getElementById("document-page-info");
const documentPrevButton = document.getElementById("document-prev-button");
const documentNextButton = document.getElementById("document-next-button");
const copilotAnalysisSection = document.getElementById("copilot-analysis");
const copilotDetailSection = document.getElementById("copilot-detail");
const detailTitle = document.getElementById("detail-title");
const detailPreviewTitle = document.getElementById("detail-preview-title");
const detailPreviewMeta = document.getElementById("detail-preview-meta");
const detailPreviewLines = document.getElementById("detail-preview-lines");
const detailEmployeeInput = document.getElementById("detail-employee-input");
const detailCompanyInput = document.getElementById("detail-company-input");
const detailFileInput = document.getElementById("detail-file-input");
const detailDateInput = document.getElementById("detail-date-input");
const detailPagesInput = document.getElementById("detail-pages-input");
const detailTypeInput = document.getElementById("detail-type-input");
const detailDescriptionInput = document.getElementById("detail-description-input");
const detailConfidenceInput = document.getElementById("detail-confidence-input");
const detailDeliveryStatusInput = document.getElementById("detail-delivery-status-input");
const detailEditButton = document.getElementById("detail-edit-button");
const detailSaveButton = document.getElementById("detail-save-button");
const detailCancelButton = document.getElementById("detail-cancel-button");
const detailSendButton = document.getElementById("detail-send-button");
const detailStatusMessage = document.getElementById("detail-status-message");
const detailSendDraft = document.getElementById("detail-send-draft");
const sendRecipientInput = document.getElementById("send-recipient-input");
const sendSubjectInput = document.getElementById("send-subject-input");
const sendBodyInput = document.getElementById("send-body-input");
const sendConfirmButton = document.getElementById("send-confirm-button");
const sendCancelButton = document.getElementById("send-cancel-button");
const sendStatusMessage = document.getElementById("send-status-message");
let currentAnalysisDocumentId = "cedolino-giulia-conti";
let activeDocumentId = currentAnalysisDocumentId;
let detailPreviewMode = "original";
let hasFocusedCopilotDocument = false;
let currentDocumentPage = 1;
const documentPageSize = 6;

const documentDetails = {
  "cedolino-marco-rinaldi": {
    title: "Cedolino mensile - Marco Rinaldi",
    batchId: "cedolini-aprile-2026",
    sourceTitle: "Lotto cedolini aprile 2026",
    employee: "Marco Rinaldi",
    company: "Eggon S.r.l.",
    file: "cedolini-aprile-2026.pdf",
    date: "30/04/2026",
    pages: "1",
    type: "Cedolino mensile",
    description: "Cedolino mensile estratto dal lotto di aprile.",
    confidence: "98%",
    deliveryStatus: "Non inviato",
    previewLines: [
      "Pagina 1: Marco Rinaldi - cedolino mensile",
      "Pagina 2: Elena Ferri - cedolino mensile",
      "Pagina 3: Giulia Conti - confidenza destinatario 82%"
    ],
    recipients: [
      { name: "Marco Rinaldi", page: "pagina 1", confidence: 98, status: "confirmed", documentId: "cedolino-marco-rinaldi" }
    ]
  },
  "cedolino-elena-ferri": {
    title: "Cedolino mensile - Elena Ferri",
    batchId: "cedolini-aprile-2026",
    sourceTitle: "Lotto cedolini aprile 2026",
    employee: "Elena Ferri",
    company: "Eggon S.r.l.",
    file: "cedolini-aprile-2026.pdf",
    date: "30/04/2026",
    pages: "1",
    type: "Cedolino mensile",
    description: "Cedolino mensile estratto dal lotto di aprile.",
    confidence: "95%",
    deliveryStatus: "Non inviato",
    previewLines: [
      "Pagina 1: Marco Rinaldi - cedolino mensile",
      "Pagina 2: Elena Ferri - cedolino mensile",
      "Pagina 3: Giulia Conti - confidenza destinatario 82%"
    ],
    recipients: [
      { name: "Elena Ferri", page: "pagina 2", confidence: 95, status: "confirmed", documentId: "cedolino-elena-ferri" }
    ]
  },
  "cedolino-giulia-conti": {
    title: "Cedolino mensile - Giulia Conti",
    batchId: "cedolini-aprile-2026",
    sourceTitle: "Lotto cedolini aprile 2026",
    employee: "Giulia Conti",
    company: "Eggon S.r.l.",
    file: "cedolini-aprile-2026.pdf",
    date: "30/04/2026",
    pages: "1",
    type: "Cedolino mensile",
    description: "Cedolino mensile estratto dal lotto di aprile.",
    confidence: "82%",
    deliveryStatus: "Non inviato",
    previewLines: [
      "Pagina 1: Marco Rinaldi - cedolino mensile",
      "Pagina 2: Elena Ferri - cedolino mensile",
      "Pagina 3: Giulia Conti - confidenza destinatario 82%"
    ],
    recipients: [
      { name: "Giulia Conti", page: "pagina 3", confidence: 82, status: "needs-review", documentId: "cedolino-giulia-conti" }
    ]
  },
  "contratto-onboarding": {
    title: "Contratto onboarding - Luca Bianchi",
    batchId: "contratto-onboarding",
    employee: "Luca Bianchi",
    company: "Nexum Labs",
    file: "onboarding-luca-bianchi.pdf",
    date: "12/04/2026",
    pages: "8",
    type: "Contratto",
    description: "Contratto di assunzione con allegati amministrativi.",
    confidence: "96%",
    deliveryStatus: "Non inviato",
    previewLines: [
      "Pagina 1: dati anagrafici e azienda",
      "Pagine 2-6: clausole contrattuali",
      "Pagine 7-8: allegati amministrativi"
    ],
    recipients: [
      { name: "Luca Bianchi", page: "documento completo", confidence: 96, status: "confirmed", documentId: "contratto-onboarding" }
    ]
  },
  "comunicazione-benefit": {
    title: "Comunicazione benefit - Dipendenti sede centrale",
    batchId: "comunicazione-benefit",
    employee: "Dipendenti sede centrale",
    company: "Eggon S.r.l.",
    file: "benefit-marzo-2026.pdf",
    date: "25/03/2026",
    pages: "2",
    type: "Comunicazione HR",
    description: "Comunicazione interna sui benefit aziendali.",
    confidence: "98%",
    deliveryStatus: "Inviato",
    previewLines: [
      "Pagina 1: riepilogo benefit",
      "Pagina 2: istruzioni di accesso al portale"
    ],
    recipients: [
      { name: "Dipendenti sede centrale", page: "documento completo", confidence: 98, status: "sent", documentId: "comunicazione-benefit" }
    ]
  },
  "cedolino-sara-martini": {
    title: "Cedolino mensile - Sara Martini",
    batchId: "cedolini-aprile-2026-b",
    employee: "Sara Martini",
    company: "Eggon S.r.l.",
    file: "cedolini-aprile-2026-b.pdf",
    date: "30/04/2026",
    pages: "1",
    type: "Cedolino mensile",
    description: "Cedolino mensile estratto dal secondo lotto di aprile.",
    confidence: "91%",
    deliveryStatus: "Non inviato",
    previewLines: [
      "Pagina 1: Sara Martini - cedolino mensile",
      "Pagina 2: Paolo Greco - cedolino mensile",
      "Pagina 3: Nadia Costa - confidenza destinatario 76%"
    ],
    recipients: [
      { name: "Sara Martini", page: "pagina 1", confidence: 91, status: "confirmed", documentId: "cedolino-sara-martini" }
    ]
  },
  "cedolino-paolo-greco": {
    title: "Cedolino mensile - Paolo Greco",
    batchId: "cedolini-aprile-2026-b",
    employee: "Paolo Greco",
    company: "Eggon S.r.l.",
    file: "cedolini-aprile-2026-b.pdf",
    date: "30/04/2026",
    pages: "1",
    type: "Cedolino mensile",
    description: "Cedolino mensile estratto dal secondo lotto di aprile.",
    confidence: "93%",
    deliveryStatus: "Inviato",
    previewLines: [
      "Pagina 1: Sara Martini - cedolino mensile",
      "Pagina 2: Paolo Greco - cedolino mensile",
      "Pagina 3: Nadia Costa - confidenza destinatario 76%"
    ],
    recipients: [
      { name: "Paolo Greco", page: "pagina 2", confidence: 93, status: "sent", documentId: "cedolino-paolo-greco" }
    ]
  },
  "cedolino-nadia-costa": {
    title: "Cedolino mensile - Nadia Costa",
    batchId: "cedolini-aprile-2026-b",
    employee: "Nadia Costa",
    company: "Eggon S.r.l.",
    file: "cedolini-aprile-2026-b.pdf",
    date: "30/04/2026",
    pages: "1",
    type: "Cedolino mensile",
    description: "Cedolino mensile estratto dal secondo lotto di aprile.",
    confidence: "76%",
    deliveryStatus: "Non inviato",
    previewLines: [
      "Pagina 1: Sara Martini - cedolino mensile",
      "Pagina 2: Paolo Greco - cedolino mensile",
      "Pagina 3: Nadia Costa - confidenza destinatario 76%"
    ],
    recipients: [
      { name: "Nadia Costa", page: "pagina 3", confidence: 76, status: "needs-review", documentId: "cedolino-nadia-costa" }
    ]
  },
  "contratto-maria-neri": {
    title: "Contratto onboarding - Maria Neri",
    batchId: "contratto-maria-neri",
    employee: "Maria Neri",
    company: "Nexum Labs",
    file: "onboarding-maria-neri.pdf",
    date: "18/04/2026",
    pages: "7",
    type: "Contratto",
    description: "Contratto di assunzione con allegati amministrativi.",
    confidence: "94%",
    deliveryStatus: "Non inviato",
    previewLines: [
      "Pagina 1: dati anagrafici e azienda",
      "Pagine 2-6: condizioni contrattuali",
      "Pagina 7: allegato amministrativo"
    ],
    recipients: [
      { name: "Maria Neri", page: "documento completo", confidence: 94, status: "confirmed", documentId: "contratto-maria-neri" }
    ]
  },
  "comunicazione-welfare": {
    title: "Comunicazione welfare - Team HR",
    batchId: "comunicazione-welfare",
    employee: "Team HR",
    company: "Eggon S.r.l.",
    file: "welfare-aprile-2026.pdf",
    date: "05/04/2026",
    pages: "2",
    type: "Comunicazione HR",
    description: "Comunicazione interna sul piano welfare aggiornato.",
    confidence: "97%",
    deliveryStatus: "Inviato",
    previewLines: [
      "Pagina 1: riepilogo piano welfare",
      "Pagina 2: modalita di accesso"
    ],
    recipients: [
      { name: "Team HR", page: "documento completo", confidence: 97, status: "sent", documentId: "comunicazione-welfare" }
    ]
  }
};

const copilotRun = {
  processed: false,
  recipients: []
};

let selectedRecipientId = "giulia-conti";

let currentDocumentState = {
  label: "Da verificare",
  statusClass: "",
  itemClass: "needs-review",
  stateTags: "verifica bassa-confidenza"
};

function isDocumentSent(detail) {
  return detail?.deliveryStatus === "Inviato" || (detail?.recipients || []).some((recipient) => recipient.status === "sent");
}

function displayDeliveryStatus(detail) {
  return isDocumentSent(detail) ? "Inviato" : "Non inviato";
}

function confidenceNumber(detail) {
  const parsed = Number.parseInt(String(detail?.confidence || "").replace("%", ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateParts(detail) {
  const match = String(detail?.date || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return {
    month: match?.[2] || "",
    year: match?.[3] || ""
  };
}

function syncCopilotFlowVisibility() {
  const visible = hasFocusedCopilotDocument;
  copilotAnalysisSection?.classList.toggle("is-hidden", !visible);

  subNavItems.forEach((button) => {
    if (button.dataset.view !== "copilot") {
      return;
    }

    if (button.dataset.target === "copilot-analysis") {
      button.classList.toggle("is-hidden", !visible);
    }
  });

  if (!visible) {
    activateSubnav(currentView === "copilot" ? "copilot-upload" : "workspace-top");
  } else {
    syncSubnavWithScroll();
  }
}

function createRecipient(name, confidence, page, status, note, documentId) {
  return {
    id: name.toLowerCase().replace(/\s+/g, "-"),
    documentId,
    name,
    confidence,
    page,
    status,
    note
  };
}

function getBatchDocumentIds(documentId) {
  const batchId = documentDetails[documentId]?.batchId || documentId;
  return Object.keys(documentDetails).filter((id) => (documentDetails[id].batchId || id) === batchId);
}

function recipientFromDetail(documentId) {
  const detail = documentDetails[documentId];
  const sourceRecipient = detail?.recipients?.[0];

  return createRecipient(
    detail?.employee || "Non disponibile",
    sourceRecipient?.confidence || confidenceNumber(detail),
    sourceRecipient?.page || "documento completo",
    sourceRecipient?.status || (isDocumentSent(detail) ? "sent" : "confirmed"),
    sourceRecipient?.status === "needs-review"
      ? "Richiede conferma operatore"
      : sourceRecipient?.status === "sent" || isDocumentSent(detail)
        ? "Invio già tracciato"
        : "Confermato da OCR",
    documentId
  );
}

function getCurrentRecipientDetailId() {
  return getCurrentRecipient()?.documentId || currentAnalysisDocumentId;
}

function documentStateFromDetail(detail) {
  const recipients = detail.recipients || [];
  const hasReview = recipients.some((recipient) => recipient.status === "needs-review");
  const hasSent = isDocumentSent(detail);

  if (hasSent) {
    return {
      label: "Inviato",
      statusClass: "sent",
      itemClass: "",
      stateTags: `inviato ${detail.type} ${detail.company} ${detail.employee}`
    };
  }

  if (hasReview) {
    return {
      label: "Da verificare",
      statusClass: "",
      itemClass: "needs-review",
      stateTags: `verifica bassa-confidenza ${detail.type} ${detail.company} ${detail.employee}`
    };
  }

  return {
    label: "Confermato",
    statusClass: "confirmed",
    itemClass: "confirmed",
    stateTags: `confermato ${detail.type} ${detail.company} ${detail.employee}`
  };
}

function resetCopilotRecipients() {
  copilotRun.recipients = [
    createRecipient("Marco Rinaldi", 98, "pagina 1", "confirmed", "Destinatario rilevato nello stesso lotto", "cedolino-marco-rinaldi"),
    createRecipient("Elena Ferri", 95, "pagina 2", "confirmed", "Destinatario rilevato nello stesso lotto", "cedolino-elena-ferri"),
    createRecipient("Giulia Conti", 82, "pagina 3", "needs-review", "Richiede conferma operatore", "cedolino-giulia-conti")
  ];
  selectedRecipientId = "giulia-conti";
  currentAnalysisDocumentId = "cedolino-giulia-conti";
}

function getCurrentRecipient() {
  return copilotRun.recipients.find((recipient) => recipient.id === selectedRecipientId);
}

function syncRecipientsIntoDocument() {
  if (copilotRun.recipients.length === 0) {
    return;
  }

  const previewLines = copilotRun.recipients.map((recipient) => (
    `${recipient.page}: ${recipient.name} - confidenza ${recipient.confidence}%`
  ));

  copilotRun.recipients.forEach((recipient) => {
    const detail = documentDetails[recipient.documentId];
    if (!detail) {
      return;
    }

    detail.employee = recipient.name;
    detail.confidence = `${recipient.confidence}%`;
    detail.deliveryStatus = recipient.status === "sent" ? "Inviato" : "Non inviato";
    detail.previewLines = previewLines;
    detail.recipients = [{
      name: recipient.name,
      page: recipient.page,
      confidence: recipient.confidence,
      status: recipient.status,
      documentId: recipient.documentId
    }];
  });
}

function updateEditingContext() {
  const recipient = getCurrentRecipient();
  if (!recipient) {
    setText(editingContext, "Dopo lo split potrai scegliere qualunque destinatario e aprire il relativo dettaglio invio.");
    return;
  }

  const state = recipient.status === "confirmed" ? "confermato da OCR" : "da confermare";
  setText(
    editingContext,
    `Invio selezionato: ${recipient.name} (${recipient.page}, ${state}). Apri il dettaglio per correggere i campi OCR consentiti.`
  );
}

function buildDocumentTags(documentId, state) {
  const detail = documentDetails[documentId];
  return [
    state.stateTags,
    detail.type,
    detail.company,
    detail.employee,
    detail.file,
    detail.date,
    displayDeliveryStatus(detail).toLowerCase().replace(" ", "-"),
    `confidenza-${confidenceNumber(detail)}`
  ]
    .join(" ")
    .toLowerCase();
}

function updateDocumentCard(documentId, state = documentStateFromDetail(documentDetails[documentId])) {
  const item = document.querySelector(`[data-document-id="${documentId}"]`);
  const status = item?.querySelector("[data-document-status]");
  const summary = item?.querySelector("[data-document-summary]");
  const meta = item?.querySelector(".document-meta");
  const detail = documentDetails[documentId];
  if (!item || !status || !detail) {
    return;
  }

  item.dataset.tags = buildDocumentTags(documentId, state);
  item.classList.toggle("needs-review", state.itemClass === "needs-review");
  item.classList.toggle("confirmed", state.itemClass === "confirmed");
  item.classList.toggle("sent", state.statusClass === "sent");
  status.textContent = state.label;
  status.className = state.statusClass
    ? `document-status ${state.statusClass}`
    : "document-status";

  if (summary) {
    summary.textContent = `${detail.employee} · ${detail.company} · confidenza ${detail.confidence || "Non disponibile"}`;
  }

  if (meta) {
    meta.replaceChildren();
    [
      `File: ${detail.file}`,
      `Data: ${detail.date}`,
      detail.pages === "1" ? "Pagina singola" : `Pagine: ${detail.pages}`
    ].forEach((value) => {
      const itemMeta = document.createElement("span");
      itemMeta.textContent = value;
      meta.append(itemMeta);
    });
  }
}

function updateCurrentDocumentCard() {
  updateDocumentCard(currentAnalysisDocumentId, currentDocumentState);
}

function updateAllDocumentCards() {
  applyDocumentFilters({ keepPage: true });
}

const detailEditableInputs = [
  detailEmployeeInput,
  detailCompanyInput,
  detailDateInput,
  detailTypeInput,
  detailDescriptionInput
];

const detailReadonlyInputs = [
  detailFileInput,
  detailPagesInput,
  detailConfidenceInput,
  detailDeliveryStatusInput
];

function setDetailEditMode(editing) {
  detailEditableInputs.forEach((input) => {
    if (input) {
      input.readOnly = !editing;
      input.disabled = !editing;
      input.tabIndex = editing ? 0 : -1;
    }
  });
  detailReadonlyInputs.forEach((input) => {
    if (input) {
      input.readOnly = true;
      input.disabled = true;
      input.tabIndex = -1;
    }
  });
  document.querySelector(".document-inspector")?.classList.toggle("is-editing", editing);
  detailEditButton?.classList.toggle("hidden", editing);
  detailSaveButton?.classList.toggle("hidden", !editing);
  detailCancelButton?.classList.toggle("hidden", !editing);
}

function setDetailValues(detail) {
  const inspector = document.querySelector(".document-inspector");
  inspector?.classList.toggle("confidence-low", confidenceNumber(detail) < 90);
  inspector?.classList.toggle("confidence-high", confidenceNumber(detail) >= 90);

  setText(detailTitle, detail.title);
  setValue(detailEmployeeInput, detail.employee);
  setValue(detailCompanyInput, detail.company);
  setValue(detailFileInput, detail.file);
  setValue(detailDateInput, detail.date);
  setValue(detailPagesInput, detail.pages);
  setValue(detailTypeInput, detail.type);
  setValue(detailDescriptionInput, detail.description);
  setValue(detailConfidenceInput, detail.confidence || "Non disponibile");
  setValue(detailDeliveryStatusInput, displayDeliveryStatus(detail));
}

function renderDetailPreview(detail) {
  setText(detailPreviewTitle, detail.title);
  const pageText = detail.pages === "1" ? "1 pagina" : `${detail.pages} pagine`;
  setText(detailPreviewMeta, `${detail.file} · ${pageText}`);

  document.querySelectorAll("[data-detail-preview]").forEach((button) => {
    button.classList.toggle("active", button.dataset.detailPreview === detailPreviewMode);
  });

  const recipients = detail.recipients || [];
  const selectedRecipient = recipients.find((recipient) => recipient.name === detail.employee) || recipients[0];
  const splitLines = selectedRecipient
    ? [`${selectedRecipient.page}: ${selectedRecipient.name} - ${detail.type}`]
    : [detail.previewLines?.[0]].filter(Boolean);
  const fullLines = detail.previewLines?.length ? detail.previewLines : splitLines;
  const lines = detailPreviewMode === "split"
      ? splitLines
      : fullLines;

  if (!detailPreviewLines) {
    return;
  }

  detailPreviewLines.replaceChildren();
  detailPreviewLines.classList.toggle("pdf-preview-mode", detailPreviewMode === "original");

  if (detailPreviewMode === "original") {
    const frame = document.createElement("div");
    frame.className = "pdf-placeholder-frame";

    const chrome = document.createElement("div");
    chrome.className = "pdf-placeholder-chrome";

    const title = document.createElement("strong");
    title.textContent = "Anteprima PDF originale";

    const hint = document.createElement("span");
    hint.textContent = "Viewer integrato previsto";

    const body = document.createElement("div");
    body.className = "pdf-placeholder-body";
    body.textContent = `${detail.file} - apertura del documento originale direttamente nell'applicativo.`;

    chrome.append(title, hint);
    frame.append(chrome, body);
    detailPreviewLines.append(frame);
    return;
  }

  (lines.length ? lines : ["Anteprima non disponibile"]).forEach((line) => {
    const item = document.createElement("span");
    item.textContent = line;
    detailPreviewLines.append(item);
  });
}

function updateDocumentDetail(documentId = activeDocumentId) {
  const detail = documentDetails[documentId];
  if (!detail || !copilotDetailSection) {
    return;
  }

  activeDocumentId = documentId;
  setDetailValues(detail);
  renderDetailPreview(detail);
  setDetailEditMode(false);
  documentHistory?.querySelectorAll("[data-document-detail]").forEach((button) => {
    button.classList.toggle("active", button.dataset.documentDetail === documentId);
  });
}

function hideSendDraft() {
  detailSendDraft?.classList.add("is-hidden");
}

function buildSendDraft(detail) {
  setValue(sendRecipientInput, detail.employee);
  setValue(sendSubjectInput, `${detail.type} disponibile`);
  setValue(
    sendBodyInput,
    `Gentile ${detail.employee},\n\nil documento "${detail.type}" del ${detail.date} è disponibile in allegato.\n\nCordiali saluti.`
  );
  setText(sendStatusMessage, "Il documento selezionato viene allegato automaticamente.");
  detailSendDraft?.classList.remove("is-hidden");
}

function showDocumentDetail(documentId, { openSend = false } = {}) {
  copilotDetailSection?.classList.remove("is-hidden");
  detailPreviewMode = "original";
  updateDocumentDetail(documentId);

  if (openSend) {
    buildSendDraft(documentDetails[documentId]);
  } else {
    hideSendDraft();
  }

  setText(detailStatusMessage, "Seleziona Modifica per correggere i campi consentiti dall'ADR.");
  goTo("copilot", "copilot-detail");
}

function saveDetailChanges() {
  const detail = documentDetails[activeDocumentId];
  if (!detail) {
    return;
  }

  detail.employee = detailEmployeeInput?.value.trim() || "Non disponibile";
  detail.company = detailCompanyInput?.value.trim() || "Non disponibile";
  detail.date = detailDateInput?.value.trim() || "Non disponibile";
  detail.type = detailTypeInput?.value.trim() || "Non disponibile";
  detail.description = detailDescriptionInput?.value.trim() || "Non disponibile";

  const recipient = copilotRun.recipients.find((item) => item.documentId === activeDocumentId);
  if (recipient) {
    recipient.name = detail.employee;
    recipient.status = recipient.status === "sent" ? "sent" : "confirmed";
    recipient.note = "Dati confermati dall'operatore";
    selectedRecipientId = recipient.id;
    currentAnalysisDocumentId = activeDocumentId;
  }

  detail.recipients = [{
    ...(detail.recipients?.[0] || {}),
    name: detail.employee,
    status: recipient?.status || detail.recipients?.[0]?.status || "confirmed",
    documentId: activeDocumentId
  }];
  detail.deliveryStatus = detail.recipients[0].status === "sent" ? "Inviato" : "Non inviato";

  syncRecipientsIntoDocument();
  updateAllDocumentCards();
  updateDocumentDetail(activeDocumentId);
  renderRecipientList();
  updateSplitAndDispatchState();
  setText(detailStatusMessage, "Modifiche salvate sui campi editabili. L'invio selezionato è pronto.");
}

function confirmDetailSend() {
  const detail = documentDetails[activeDocumentId];
  const recipient = sendRecipientInput?.value.trim() || "";
  const subject = sendSubjectInput?.value.trim() || "";
  const body = sendBodyInput?.value.trim() || "";

  if (!detail || !recipient || !subject || !body) {
    setText(sendStatusMessage, "Destinatario, oggetto e testo sono obbligatori prima dell'invio.");
    return;
  }

  detail.deliveryStatus = "Inviato";
  detail.recipients = (detail.recipients || []).map((item) => ({
    ...item,
    status: "sent",
    documentId: activeDocumentId
  }));

  const runRecipient = copilotRun.recipients.find((item) => item.documentId === activeDocumentId);
  if (runRecipient) {
    runRecipient.status = "sent";
    runRecipient.note = "Invio confermato dall'operatore";
    selectedRecipientId = runRecipient.id;
    currentAnalysisDocumentId = activeDocumentId;
    currentDocumentState = {
      label: "Inviato",
      statusClass: "sent",
      itemClass: "",
      stateTags: `inviato ${detail.type} ${detail.company} ${detail.employee}`
    };
    syncRecipientsIntoDocument();
    renderRecipientList();
    updateSplitAndDispatchState();
  }

  hideSendDraft();
  setText(sendStatusMessage, "Invio completato.");
  setText(detailStatusMessage, "Invio completato. Stato invio aggiornato.");
  updateAllDocumentCards();
  updateDocumentDetail(activeDocumentId);
  updateCopilotAnalytics();
}

function renderRecipientList() {
  if (!recipientList || copilotRun.recipients.length === 0) {
    return;
  }

  recipientList.replaceChildren();
  copilotRun.recipients.forEach((recipient) => {
    const item = document.createElement("li");
    item.className = `history-item ${
      recipient.status === "needs-review" ? "needs-review" : recipient.status === "sent" ? "sent" : "confirmed"
    }`;
    item.classList.toggle("selected", recipient.id === selectedRecipientId);

    const main = document.createElement("div");
    main.className = "history-main";

    const name = document.createElement("strong");
    name.textContent = recipient.name;

    const detail = document.createElement("span");
    detail.textContent = `${recipient.note} · ${recipient.page}`;

    main.append(name, detail);
    item.append(main);

    const actions = document.createElement("div");
    actions.className = "history-actions";

    const editButton = document.createElement("button");
    editButton.className = "text-button";
    editButton.type = "button";
    editButton.dataset.editRecipient = recipient.id;
    editButton.textContent = "Apri dettaglio";
    actions.append(editButton);

    if (recipient.status === "needs-review") {
      const button = document.createElement("button");
      button.className = "text-button";
      button.type = "button";
      button.dataset.confirmRecipient = recipient.id;
      button.textContent = "Conferma";
      actions.append(button);
    } else {
      const badge = document.createElement("span");
      badge.className = `document-status ${recipient.status === "sent" ? "sent" : "confirmed"}`;
      badge.textContent = recipient.status === "sent" ? "Inviato" : "OK";
      actions.append(badge);
    }

    item.append(actions);
    recipientList.append(item);
  });
  updateEditingContext();
}

function updateSplitAndDispatchState() {
  if (!copilotRun.processed) {
    return;
  }

  const total = copilotRun.recipients.length;
  const needsReview = copilotRun.recipients.filter((recipient) => recipient.status === "needs-review").length;
  const sent = copilotRun.recipients.filter((recipient) => recipient.status === "sent").length;
  const confirmed = total - needsReview;
  const selectedRecipient = getCurrentRecipient();

  setText(splitState, `${total} invii generati, ${needsReview} da verificare`);
  setText(
    dispatchReady,
    sent === total && total > 0
      ? `${total} inviati`
      : needsReview > 0
        ? `${confirmed} confermati, ${needsReview} in verifica`
        : `${total} confermati`
  );

  if (sent === total && total > 0) {
    setText(confidenceHint, "Invii completati");
    setText(dispatchStatus, "Tutti gli invii generati dallo split risultano completati.");
    return;
  }

  if (needsReview > 0) {
    setText(confidenceHint, "Verifica richiesta su almeno un invio");
    setText(
      dispatchStatus,
      selectedRecipient?.status === "needs-review"
        ? "Apri il dettaglio dell'invio selezionato per controllare i dati OCR e procedere."
        : "Puoi aprire il dettaglio dell'invio selezionato; resta almeno un altro destinatario da verificare."
    );
    return;
  }

  setText(confidenceHint, "Tutti i destinatari confermati");
  setText(dispatchStatus, "Apri il dettaglio dell'invio selezionato per confermare destinatario, oggetto e testo.");
}

function updateCopilotAnalytics() {
  const period = copilotMetricPeriod?.value || "Ultimi 30 giorni";
  const status = copilotMetricStatus?.value || "Tutti";
  const allEntries = Object.values(documentDetails);
  const visibleEntries = allEntries.filter((detail) => {
    if (status === "Inviato") {
      return displayDeliveryStatus(detail) === "Inviato";
    }

    if (status === "Non inviato") {
      return displayDeliveryStatus(detail) !== "Inviato";
    }

    if (status === "Sotto soglia") {
      return confidenceNumber(detail) < 90;
    }

    return true;
  });
  const periodFactor = period === "Ultimi 7 giorni" ? 0.42 : period === "Mese corrente" ? 0.78 : 1;
  const analyzed = Math.max(visibleEntries.length, Math.round(184 * periodFactor * (visibleEntries.length / allEntries.length)));
  const belowThreshold = visibleEntries.filter((detail) => confidenceNumber(detail) < 90).length;
  const sentEntries = visibleEntries.filter((detail) => displayDeliveryStatus(detail) === "Inviato").length;
  const correctRate = status === "Sotto soglia" ? "88%" : status === "Inviato" ? "99%" : "97%";
  const recipientRate = sentEntries > 0 && sentEntries === visibleEntries.length ? "96%" : "94%";
  const averageTime = period === "Ultimi 7 giorni" ? "16 sec" : "18 sec";

  renderMetricList(copilotMetricList, [
    [String(analyzed), "Documenti analizzati"],
    [correctRate, "Classificazioni corrette"],
    [String(Math.max(belowThreshold, status === "Sotto soglia" ? 1 : 0)), "Documenti sotto soglia di confidenza"],
    [recipientRate, "Destinatari riconosciuti automaticamente"],
    [averageTime, "Tempo medio analisi"]
  ]);
}

function getFilteredDocumentIds() {
  const query = (documentSearch?.value || "").trim().toLowerCase();
  const deliveryFilter = documentDeliveryFilter?.value || "";
  const confidenceMode = documentConfidenceMode?.value || "";
  const parsedThreshold = Number.parseInt(documentConfidenceThreshold?.value || "80", 10);
  const threshold = Number.isFinite(parsedThreshold) ? parsedThreshold : 80;
  const monthFilter = documentMonthFilter?.value || "";
  const yearFilter = documentYearFilter?.value || "";

  return Object.keys(documentDetails).filter((documentId) => {
    const detail = documentDetails[documentId];
    const searchableText = `${detail.title} ${detail.employee} ${detail.company} ${detail.file} ${detail.type}`.toLowerCase();
    const deliveryStatus = displayDeliveryStatus(detail) === "Inviato" ? "inviato" : "non-inviato";
    const confidence = confidenceNumber(detail);
    const parts = dateParts(detail);
    const matchesQuery = !query || searchableText.includes(query);
    const matchesDelivery = !deliveryFilter || deliveryStatus === deliveryFilter;
    const matchesConfidence = !confidenceMode
      || (confidenceMode === "lt" && confidence < threshold)
      || (confidenceMode === "gte" && confidence >= threshold);
    const matchesMonth = !monthFilter || parts.month === monthFilter;
    const matchesYear = !yearFilter || parts.year === yearFilter;
    return matchesQuery && matchesDelivery && matchesConfidence && matchesMonth && matchesYear;
  });
}

function updateDocumentSummary(filteredIds) {
  const details = filteredIds.map((documentId) => documentDetails[documentId]);
  const review = details.filter((detail) => detail.recipients?.some((recipient) => recipient.status === "needs-review")).length;
  const sent = details.filter((detail) => displayDeliveryStatus(detail) === "Inviato").length;
  const ready = details.length - review - sent;

  renderMetricList(documentSummaryList, [
    [String(details.length), "Risultati filtrati"],
    [String(review), "Da verificare"],
    [String(Math.max(ready, 0)), "Pronti per invio"],
    [String(sent), "Inviati"]
  ]);
}

function renderDocumentHistory(filteredIds) {
  if (!documentHistory) {
    return;
  }

  const pageCount = Math.max(1, Math.ceil(filteredIds.length / documentPageSize));
  currentDocumentPage = Math.min(Math.max(currentDocumentPage, 1), pageCount);
  const pageStart = (currentDocumentPage - 1) * documentPageSize;
  const pageIds = filteredIds.slice(pageStart, pageStart + documentPageSize);

  documentHistory.replaceChildren();
  pageIds.forEach((documentId) => {
    const detail = documentDetails[documentId];
    const state = documentStateFromDetail(detail);
    const row = document.createElement("li");
    row.className = `document-row document-item ${state.itemClass || state.statusClass || ""}`;
    row.dataset.documentId = documentId;

    const recipient = document.createElement("span");
    recipient.className = "document-cell-main";
    recipient.innerHTML = `<strong>${detail.employee}</strong><small>${detail.company}</small>`;

    const type = document.createElement("span");
    type.textContent = detail.type;

    const file = document.createElement("span");
    file.className = "document-cell-file";
    file.textContent = detail.file;

    const date = document.createElement("span");
    date.textContent = detail.date;

    const confidence = document.createElement("span");
    confidence.textContent = detail.confidence || "Non disponibile";

    const status = document.createElement("span");
    status.className = state.statusClass ? `document-status ${state.statusClass}` : "document-status";
    status.textContent = state.label;

    const actions = document.createElement("span");
    actions.className = "history-actions";

    const detailButton = document.createElement("button");
    detailButton.className = "text-button";
    detailButton.type = "button";
    detailButton.dataset.documentDetail = documentId;
    detailButton.textContent = "Consulta";

    actions.append(detailButton);
    row.append(recipient, type, file, date, confidence, status, actions);
    documentHistory.append(row);
  });

  setText(documentPageInfo, `Pagina ${currentDocumentPage} di ${pageCount} - ${filteredIds.length} risultati`);
  if (documentPrevButton) {
    documentPrevButton.disabled = currentDocumentPage <= 1;
  }
  if (documentNextButton) {
    documentNextButton.disabled = currentDocumentPage >= pageCount;
  }
}

function applyDocumentFilters({ keepPage = false } = {}) {
  if (!keepPage) {
    currentDocumentPage = 1;
  }

  const filteredIds = getFilteredDocumentIds();
  updateDocumentSummary(filteredIds);
  renderDocumentHistory(filteredIds);
  documentEmpty?.classList.toggle("hidden", filteredIds.length > 0);
}

function setCurrentDocumentState(label, tags, statusClass, itemClass) {
  currentDocumentState = {
    label,
    statusClass,
    itemClass,
    stateTags: tags
  };
  updateCurrentDocumentCard();
}

function loadDocumentIntoFlow(documentId) {
  const detail = documentDetails[documentId];
  if (!detail) {
    return;
  }

  hasFocusedCopilotDocument = true;
  syncCopilotFlowVisibility();
  currentAnalysisDocumentId = documentId;
  copilotRun.processed = true;
  copilotRun.recipients = getBatchDocumentIds(documentId).map(recipientFromDetail);
  const selectedRecipient = copilotRun.recipients.find((recipient) => recipient.documentId === documentId)
    || copilotRun.recipients.find((recipient) => recipient.status === "needs-review")
    || copilotRun.recipients[0];
  selectedRecipientId = selectedRecipient?.id || "";
  currentAnalysisDocumentId = selectedRecipient?.documentId || documentId;

  const selectedDetail = documentDetails[currentAnalysisDocumentId] || detail;
  setText(uploadState, `Invio ripreso: ${selectedDetail.title}`);
  setText(detectedConfidence, String(copilotRun.recipients.length));
  setText(confidenceHint, "Entry del lotto disponibili");

  currentDocumentState = documentStateFromDetail(selectedDetail);
  unlockSteps(["copilot-analysis"]);
  renderRecipientList();
  updateAllDocumentCards();
  updateSplitAndDispatchState();
  setText(analysisNote, "Invio ricaricato dallo storico. Apri il dettaglio per correggere i campi OCR o procedere all'invio.");
  if (!copilotDetailSection?.classList.contains("is-hidden")) {
    updateDocumentDetail(currentAnalysisDocumentId);
  }
  goTo("copilot", "copilot-analysis");
}

function fillCopilotResults() {
  uploadBox?.classList.remove("processing");
  hasFocusedCopilotDocument = true;
  syncCopilotFlowVisibility();
  unlockSteps(["copilot-analysis"]);
  copilotRun.processed = true;
  currentAnalysisDocumentId = "cedolino-giulia-conti";
  documentDetails[currentAnalysisDocumentId].deliveryStatus = "Non inviato";
  setText(uploadState, "Documento analizzato");
  setText(detectedConfidence, "3");
  setText(confidenceHint, "Entry generate; verifica richiesta");
  resetCopilotRecipients();
  syncRecipientsIntoDocument();
  updateAllDocumentCards();
  setText(analysisNote, "Il modello ha creato le entry per singolo destinatario. Apri il dettaglio dell'invio da correggere o conferma i casi sotto soglia.");

  setCurrentDocumentState(
    "Da verificare",
    "verifica bassa-confidenza",
    "",
    "needs-review"
  );
  syncRecipientsIntoDocument();
  renderRecipientList();
  updateSplitAndDispatchState();
  goTo("copilot", "copilot-analysis");
  updateCopilotAnalytics();
}

function processUpload() {
  hasFocusedCopilotDocument = true;
  syncCopilotFlowVisibility();
  currentAnalysisDocumentId = "cedolino-giulia-conti";
  uploadBox?.classList.add("processing");
  copilotRun.processed = false;
  copilotRun.recipients = [];
  setStepLocked("copilot-analysis", true);
  setText(uploadState, "Analisi automatica in corso");
  setText(detectedConfidence, "In corso");
  setText(confidenceHint, "OCR e classificazione in elaborazione");
  if (recipientList) {
    recipientList.innerHTML = `
      <li class="history-item">
        <div class="history-main">
          <strong>Analisi in corso</strong>
          <span>I destinatari verranno mostrati dopo lo split automatico.</span>
        </div>
      </li>
    `;
  }
  setText(splitState, "Analisi in corso");
  setText(dispatchReady, "Analisi in corso");
  setText(analysisNote, "Analisi automatica in corso. Le entry di invio saranno disponibili appena termina lo split.");
  setText(editingContext, "Analisi in corso: i destinatari verranno selezionabili dopo lo split.");
  setText(dispatchStatus, "Attendi il completamento dell'analisi.");

  window.setTimeout(fillCopilotResults, 500);
}

uploadBox?.addEventListener("click", processUpload);

recipientList?.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-recipient]");
  if (editButton) {
    const recipient = copilotRun.recipients.find((item) => item.id === editButton.dataset.editRecipient);
    if (!recipient) {
      return;
    }

    selectedRecipientId = recipient.id;
    currentAnalysisDocumentId = recipient.documentId;
    renderRecipientList();
    updateAllDocumentCards();
    updateSplitAndDispatchState();
    setText(analysisNote, `Invio selezionato: ${recipient.name}. Il dettaglio contiene i soli campi OCR modificabili dall'ADR.`);
    showDocumentDetail(recipient.documentId);
    return;
  }

  const button = event.target.closest("[data-confirm-recipient]");
  if (!button) {
    return;
  }

  const recipient = copilotRun.recipients.find((item) => item.id === button.dataset.confirmRecipient);
  if (recipient) {
    selectedRecipientId = recipient.id;
    recipient.status = "confirmed";
    currentAnalysisDocumentId = recipient.documentId;
    recipient.note = "Destinatario confermato dall'operatore";
  }

  syncRecipientsIntoDocument();
  if (copilotRun.recipients.some((item) => item.status === "needs-review")) {
    const detail = documentDetails[currentAnalysisDocumentId];
    setCurrentDocumentState(
      "Da verificare",
      `verifica bassa-confidenza ${detail.type} ${detail.company} ${detail.employee}`,
      "",
      "needs-review"
    );
  } else {
    const detail = documentDetails[currentAnalysisDocumentId];
    setCurrentDocumentState(
      "Confermato",
      `confermato ${detail.type} ${detail.company} ${detail.employee}`,
      "confirmed",
      "confirmed"
    );
  }
  renderRecipientList();
  updateSplitAndDispatchState();
  updateCopilotAnalytics();
});

documentSearch?.addEventListener("input", applyDocumentFilters);
documentDeliveryFilter?.addEventListener("change", applyDocumentFilters);
documentConfidenceMode?.addEventListener("change", applyDocumentFilters);
documentConfidenceThreshold?.addEventListener("input", applyDocumentFilters);
documentMonthFilter?.addEventListener("change", applyDocumentFilters);
documentYearFilter?.addEventListener("change", applyDocumentFilters);
copilotMetricPeriod?.addEventListener("change", updateCopilotAnalytics);
copilotMetricStatus?.addEventListener("change", updateCopilotAnalytics);
documentPrevButton?.addEventListener("click", () => {
  currentDocumentPage -= 1;
  applyDocumentFilters({ keepPage: true });
});
documentNextButton?.addEventListener("click", () => {
  currentDocumentPage += 1;
  applyDocumentFilters({ keepPage: true });
});
documentHistory?.addEventListener("click", (event) => {
  const detailButton = event.target.closest("[data-document-detail]");
  if (detailButton) {
    showDocumentDetail(detailButton.dataset.documentDetail);
    return;
  }
});

document.querySelectorAll("[data-detail-preview]").forEach((button) => {
  button.addEventListener("click", () => {
    detailPreviewMode = button.dataset.detailPreview;
    renderDetailPreview(documentDetails[activeDocumentId]);
  });
});

detailEditButton?.addEventListener("click", () => {
  setDetailEditMode(true);
  hideSendDraft();
  setText(detailStatusMessage, "Puoi modificare nome e cognome, azienda, data documento, tipologia e breve descrizione.");
});

detailCancelButton?.addEventListener("click", () => {
  updateDocumentDetail(activeDocumentId);
  setText(detailStatusMessage, "Modifica annullata.");
});

detailSaveButton?.addEventListener("click", saveDetailChanges);

detailSendButton?.addEventListener("click", () => {
  setDetailEditMode(false);
  buildSendDraft(documentDetails[activeDocumentId]);
});

sendCancelButton?.addEventListener("click", () => {
  hideSendDraft();
  setText(detailStatusMessage, "Invio annullato. Il documento resta non inviato.");
});

sendConfirmButton?.addEventListener("click", confirmDetailSend);

applyDocumentFilters();
updateAllDocumentCards();
updateCopilotAnalytics();
syncCopilotFlowVisibility();
