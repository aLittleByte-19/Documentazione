const views = {
  overview: "Overview operativa",
  assistant: "AI Assistant Generativo",
  copilot: "AI Co-Pilot per i CdL",
  audit: "Analisi invii"
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
    .filter((button) => button.dataset.view === currentView)
    .map((button) => document.getElementById(button.dataset.target))
    .filter(Boolean);

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

[
  "assistant-review",
  "assistant-feedback",
  "copilot-analysis",
  "copilot-dispatch"
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

const uploadBox = document.getElementById("upload-box");
const uploadState = document.getElementById("upload-state");
const detectedConfidence = document.getElementById("detected-confidence");
const confidenceHint = document.getElementById("confidence-hint");
const ocrEmployeeInput = document.getElementById("ocr-employee-input");
const ocrTypeInput = document.getElementById("ocr-type-input");
const ocrCompanyInput = document.getElementById("ocr-company-input");
const ocrFileInput = document.getElementById("ocr-file-input");
const ocrDateInput = document.getElementById("ocr-date-input");
const ocrPagesInput = document.getElementById("ocr-pages-input");
const ocrDescriptionInput = document.getElementById("ocr-description-input");
const ocrSnippet = document.getElementById("ocr-snippet");
const analysisNote = document.getElementById("analysis-note");
const editingContext = document.getElementById("editing-context");
const recipientList = document.getElementById("recipient-list");
const splitState = document.getElementById("split-state");
const dispatchMessage = document.getElementById("dispatch-message");
const dispatchReady = document.getElementById("dispatch-ready");
const dispatchButton = document.getElementById("dispatch-button");
const dispatchStatus = document.getElementById("dispatch-status");
const documentSearch = document.getElementById("document-search");
const documentFilter = document.getElementById("document-filter");
const documentHistory = document.getElementById("document-history");
const documentEmpty = document.getElementById("document-empty");
const detailPreviewTitle = document.getElementById("detail-preview-title");
const detailPreviewMeta = document.getElementById("detail-preview-meta");
const detailEmployee = document.getElementById("detail-employee");
const detailCompany = document.getElementById("detail-company");
const detailFile = document.getElementById("detail-file");
const detailDate = document.getElementById("detail-date");
const detailPages = document.getElementById("detail-pages");
const detailType = document.getElementById("detail-type");
const detailDescription = document.getElementById("detail-description");
const detailConfidence = document.getElementById("detail-confidence");
const detailRepository = document.getElementById("detail-repository");
const detailPreviewLines = document.getElementById("detail-preview-lines");
const detailRecipientList = document.getElementById("detail-recipient-list");
const detailDeliveryList = document.getElementById("detail-delivery-list");
const detailOcrText = document.getElementById("detail-ocr-text");
const detailAuditList = document.getElementById("detail-audit-list");
let currentAnalysisDocumentId = "cedolini-aprile-2026";
let activeDocumentId = currentAnalysisDocumentId;

const documentDetails = {
  "cedolini-aprile-2026": {
    title: "Lotto cedolini aprile 2026",
    employee: "Giulia Conti",
    company: "Eggon S.r.l.",
    file: "cedolini-aprile-2026.pdf",
    date: "30/04/2026",
    pages: "3",
    type: "Cedolino mensile",
    description: "Cedolini mensili con split per singolo dipendente.",
    confidence: "82%",
    repository: "Repository CdL / payroll",
    upload: "21/04/2026, 10:42",
    channel: "Email / Portale",
    deliveryStatus: "In verifica",
    proof: "Prova di consegna non ancora generata",
    ocr: "Riga paga aprile 2026, intestazione Eggon S.r.l., destinatario Giulia Conti, competenza 30/04/2026.",
    corrections: "Nessuna correzione manuale salvata",
    previewLines: [
      "Pagina 1: Marco Rinaldi - cedolino mensile",
      "Pagina 2: Elena Ferri - cedolino mensile",
      "Pagina 3: Giulia Conti - confidenza destinatario 82%"
    ],
    recipients: [
      { name: "Marco Rinaldi", page: "pagina 1", confidence: 98, status: "confirmed" },
      { name: "Elena Ferri", page: "pagina 2", confidence: 95, status: "confirmed" },
      { name: "Giulia Conti", page: "pagina 3", confidence: 82, status: "needs-review" }
    ],
    audit: [
      "Upload completato e duplicati non rilevati",
      "OCR e classificazione completati",
      "Una associazione destinatario sotto soglia"
    ]
  },
  "contratto-onboarding": {
    title: "Contratto onboarding",
    employee: "Luca Bianchi",
    company: "Nexum Labs",
    file: "onboarding-luca-bianchi.pdf",
    date: "12/04/2026",
    pages: "8",
    type: "Contratto",
    description: "Contratto di assunzione con allegati amministrativi.",
    confidence: "96%",
    repository: "Repository CdL / contratti",
    upload: "12/04/2026, 15:18",
    channel: "Portale",
    deliveryStatus: "Confermato",
    proof: "Metadati confermati, invio non richiesto",
    ocr: "Contratto di assunzione intestato a Luca Bianchi, azienda Nexum Labs, firma e allegati amministrativi presenti.",
    corrections: "Nessuna correzione manuale",
    previewLines: [
      "Pagina 1: dati anagrafici e azienda",
      "Pagine 2-6: clausole contrattuali",
      "Pagine 7-8: allegati amministrativi"
    ],
    recipients: [
      { name: "Luca Bianchi", page: "documento completo", confidence: 96, status: "confirmed" }
    ],
    audit: [
      "Documento caricato nel repository",
      "Classificazione contratto confermata",
      "Metadati disponibili nello storico"
    ]
  },
  "comunicazione-benefit": {
    title: "Comunicazione benefit",
    employee: "Dipendenti sede centrale",
    company: "Eggon S.r.l.",
    file: "benefit-marzo-2026.pdf",
    date: "25/03/2026",
    pages: "2",
    type: "Comunicazione HR",
    description: "Comunicazione interna sui benefit aziendali.",
    confidence: "98%",
    repository: "Repository HR / comunicazioni",
    upload: "25/03/2026, 09:05",
    channel: "Email interna",
    deliveryStatus: "Inviato",
    proof: "Prova di consegna archiviata",
    ocr: "Comunicazione interna sui benefit di marzo 2026 rivolta ai dipendenti della sede centrale Eggon.",
    corrections: "Nessuna correzione manuale",
    previewLines: [
      "Pagina 1: riepilogo benefit",
      "Pagina 2: istruzioni di accesso al portale"
    ],
    recipients: [
      { name: "Dipendenti sede centrale", page: "documento completo", confidence: 98, status: "sent" }
    ],
    audit: [
      "Classificazione comunicazione HR completata",
      "Invio email registrato",
      "Prova di consegna archiviata"
    ]
  }
};

const ocrInputs = [
  ocrEmployeeInput,
  ocrCompanyInput,
  ocrFileInput,
  ocrDateInput,
  ocrPagesInput,
  ocrTypeInput,
  ocrDescriptionInput
];

const copilotRun = {
  processed: false,
  recipients: []
};

let selectedRecipientId = "current-document-recipient";

let currentDocumentState = {
  label: "Da verificare",
  statusClass: "",
  itemClass: "needs-review",
  stateTags: "verifica bassa-confidenza"
};

function createRecipient(name, confidence, page, status, note) {
  return {
    id: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    confidence,
    page,
    status,
    note
  };
}

function documentStateFromDetail(detail) {
  const recipients = detail.recipients || [];
  const hasReview = recipients.some((recipient) => recipient.status === "needs-review");
  const hasSent = detail.deliveryStatus === "Inviato" || recipients.some((recipient) => recipient.status === "sent");

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

function resetCopilotRecipients(currentName = documentDetails[currentAnalysisDocumentId].employee) {
  selectedRecipientId = "current-document-recipient";
  copilotRun.recipients = [
    createRecipient("Marco Rinaldi", 98, "pagina 1", "confirmed", "Destinatario rilevato nello stesso lotto"),
    createRecipient("Elena Ferri", 95, "pagina 2", "confirmed", "Destinatario rilevato nello stesso lotto"),
    {
      ...createRecipient(currentName, 82, "pagina 3", "needs-review", "Documento corrente, dati modificabili sopra"),
      id: "current-document-recipient"
    }
  ];
}

function getCurrentRecipient() {
  return copilotRun.recipients.find((recipient) => recipient.id === selectedRecipientId);
}

function syncRecipientsIntoDocument() {
  if (copilotRun.recipients.length === 0) {
    return;
  }

  documentDetails[currentAnalysisDocumentId].recipients = copilotRun.recipients.map((recipient) => ({
    name: recipient.name,
    page: recipient.page,
    confidence: recipient.confidence,
    status: recipient.status
  }));
  documentDetails[currentAnalysisDocumentId].previewLines = copilotRun.recipients.map((recipient) => (
    `${recipient.page}: ${recipient.name} - confidenza ${recipient.confidence}%`
  ));
}

function updateEditingContext() {
  const recipient = getCurrentRecipient();
  if (!recipient) {
    setText(editingContext, "Dopo lo split potrai scegliere qualunque destinatario e correggere i dati associati.");
    return;
  }

  const state = recipient.status === "confirmed" ? "confermato da OCR" : "da confermare";
  setText(
    editingContext,
    `Stai modificando ${recipient.name} (${recipient.page}, ${state}). Usa "Modifica" su un'altra riga per correggere anche un destinatario già confermato.`
  );
}

function setOcrValue(input, value) {
  setModelValue(input, value);
}

function updateManualCorrectionState(input) {
  if (!input || typeof input.dataset.modelValue !== "string") {
    return false;
  }

  const changed = input.value.trim() !== input.dataset.modelValue.trim();
  input.closest(".field")?.classList.toggle("has-manual-correction", changed);
  return changed;
}

function countManualCorrections() {
  return ocrInputs.filter((input) => updateManualCorrectionState(input)).length;
}

function getDocumentValues() {
  return {
    employee: ocrEmployeeInput?.value || "Non disponibile",
    company: ocrCompanyInput?.value || "Non disponibile",
    file: ocrFileInput?.value || "Non disponibile",
    date: ocrDateInput?.value || "Non disponibile",
    pages: ocrPagesInput?.value || "Non disponibile",
    type: ocrTypeInput?.value || "Non disponibile",
    description: ocrDescriptionInput?.value || "Non disponibile"
  };
}

function buildCurrentDocumentTags() {
  const detail = documentDetails[currentAnalysisDocumentId];
  return [
    currentDocumentState.stateTags,
    countManualCorrections() > 0 ? "modificato correzione manuale" : "",
    detail.type,
    detail.company,
    detail.employee,
    detail.file,
    detail.date
  ]
    .join(" ")
    .toLowerCase();
}

function updateCurrentDocumentCard() {
  const item = document.querySelector(`[data-document-id="${currentAnalysisDocumentId}"]`);
  const status = item?.querySelector("[data-document-status]");
  const summary = item?.querySelector("[data-document-summary]");
  const meta = item?.querySelector(".document-meta");
  const detail = documentDetails[currentAnalysisDocumentId];
  if (!item || !status || !detail) {
    return;
  }

  item.dataset.tags = buildCurrentDocumentTags();
  item.classList.toggle("needs-review", currentDocumentState.itemClass === "needs-review");
  item.classList.toggle("confirmed", currentDocumentState.itemClass === "confirmed");
  item.classList.toggle("sent", currentDocumentState.statusClass === "sent");
  status.textContent = currentDocumentState.label;
  status.className = currentDocumentState.statusClass
    ? `document-status ${currentDocumentState.statusClass}`
    : "document-status";

  if (summary) {
    const recipientCount = documentDetails[currentAnalysisDocumentId].recipients?.length || 0;
    summary.textContent = recipientCount > 1
      ? `${detail.type} · ${detail.company} · ${recipientCount} destinatari · selezionato ${detail.employee}`
      : `${detail.type} · ${detail.company} · ${detail.employee} · confidenza ${detail.confidence || "82%"}`;
  }

  if (meta) {
    meta.replaceChildren();
    [
      `File: ${detail.file}`,
      `Data: ${detail.date}`,
      `Pagine: ${detail.pages}`
    ].forEach((value) => {
      const itemMeta = document.createElement("span");
      itemMeta.textContent = value;
      meta.append(itemMeta);
    });
  }

  applyDocumentFilters();
}

function updateOcrTextPreview() {
  const detail = documentDetails[currentAnalysisDocumentId];
  setText(
    ocrSnippet,
    `Testo riconosciuto: ${detail.type} intestato a ${detail.employee}, azienda ${detail.company}, documento ${detail.file} del ${detail.date}.`
  );
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

    const meta = document.createElement("div");
    meta.className = "recipient-meta";

    const confidence = document.createElement("span");
    confidence.textContent = `Confidenza ${recipient.confidence}%`;

    const status = document.createElement("span");
    status.textContent = recipient.status === "needs-review"
      ? "Conferma richiesta"
      : recipient.status === "sent"
        ? "Inviato"
        : "Confermato";

    meta.append(confidence, status);
    main.append(name, detail, meta);
    item.append(main);

    const actions = document.createElement("div");
    actions.className = "history-actions";

    const editButton = document.createElement("button");
    editButton.className = "text-button";
    editButton.type = "button";
    editButton.dataset.editRecipient = recipient.id;
    editButton.textContent = "Modifica";
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
  const manualCorrections = countManualCorrections();
  const correctionText = manualCorrections === 1
    ? "1 correzione manuale salvata"
    : `${manualCorrections} correzioni manuali salvate`;

  setText(splitState, `${total} documenti generati, ${needsReview} da verificare`);
  setText(
    dispatchReady,
    sent === total && total > 0
      ? `${total} inviati`
      : needsReview > 0
        ? `${confirmed} confermati, ${needsReview} in verifica`
        : `${total} confermati`
  );

  if (sent === total && total > 0) {
    unlockSteps(["copilot-dispatch"]);
    setText(confidenceHint, "Documento già inviato");
    setText(dispatchStatus, "Invio già completato. Le prove sono nello storico documenti.");
    if (dispatchButton) {
      dispatchButton.disabled = true;
      dispatchButton.textContent = "Documenti inviati";
    }
    return;
  }

  if (needsReview > 0) {
    setStepLocked("copilot-dispatch", true);
    setText(confidenceHint, manualCorrections > 0 ? `${correctionText}; conferma richiesta` : "Verifica richiesta sui dati sotto soglia");
    setText(dispatchStatus, "Conferma i casi segnalati prima di inviare tutto il lotto.");
    if (dispatchButton) {
      dispatchButton.disabled = true;
      dispatchButton.textContent = "Invia documenti confermati";
    }
    return;
  }

  unlockSteps(["copilot-dispatch"]);
  setText(confidenceHint, manualCorrections > 0 ? correctionText : "Tutti i destinatari confermati");
  setText(dispatchStatus, "Lotto pronto per l'invio.");
  if (dispatchButton) {
    dispatchButton.disabled = false;
    dispatchButton.textContent = "Invia documenti confermati";
  }
}

function markCurrentRecipientForReview() {
  if (!copilotRun.processed) {
    return;
  }

  const recipient = getCurrentRecipient();
  if (!recipient) {
    return;
  }

  recipient.status = "needs-review";
  recipient.note = "Nome aggiornato dai campi OCR";
  currentDocumentState = {
    label: "Da verificare",
    statusClass: "",
    itemClass: "needs-review",
    stateTags: "verifica bassa-confidenza modificato"
  };
  updateCurrentDocumentCard();
}

function syncOcrSummary({ recipientChanged = false } = {}) {
  documentDetails[currentAnalysisDocumentId] = {
    ...documentDetails[currentAnalysisDocumentId],
    ...getDocumentValues()
  };

  const currentRecipient = getCurrentRecipient();
  if (currentRecipient) {
    currentRecipient.name = documentDetails[currentAnalysisDocumentId].employee;
    documentDetails[currentAnalysisDocumentId].confidence = `${currentRecipient.confidence}%`;
  }

  if (recipientChanged) {
    markCurrentRecipientForReview();
  }

  const manualCorrections = countManualCorrections();
  documentDetails[currentAnalysisDocumentId].corrections = manualCorrections > 0
    ? `${manualCorrections} correzioni manuali salvate dall'operatore`
    : "Nessuna correzione manuale salvata";
  syncRecipientsIntoDocument();
  updateOcrTextPreview();
  if (copilotRun.processed) {
    const detail = documentDetails[currentAnalysisDocumentId];
    setText(dispatchMessage, `Oggetto: ${detail.type} disponibile. Il documento per ${detail.employee} è pronto nell'area riservata.`);
  }
  updateCurrentDocumentCard();
  renderRecipientList();
  updateEditingContext();
  updateSplitAndDispatchState();

  if (activeDocumentId === currentAnalysisDocumentId) {
    updateDocumentDetail(activeDocumentId);
  }
}

ocrInputs.forEach((input) => {
  input?.addEventListener("input", () => {
    updateManualCorrectionState(input);
    syncOcrSummary({ recipientChanged: input === ocrEmployeeInput });
    const manualCorrections = countManualCorrections();
    const fieldText = manualCorrections === 1 ? "campo" : "campi";
    setText(
      analysisNote,
      manualCorrections > 0
        ? `Correzione manuale registrata su ${manualCorrections} ${fieldText}. Le modifiche aggiornano destinatari, storico e invio.`
        : "I dati sono tornati all'estrazione originale del modello."
    );
  });
});

function updateDocumentDetail(documentId) {
  const detail = documentDetails[documentId];
  if (!detail) {
    return;
  }

  activeDocumentId = documentId;
  documentHistory?.querySelectorAll("[data-document-detail]").forEach((button) => {
    button.classList.toggle("active", button.dataset.documentDetail === documentId);
  });
  setText(detailPreviewTitle, detail.title);
  setText(detailPreviewMeta, `${detail.file} · ${detail.pages} pagine`);
  setText(detailEmployee, detail.employee);
  setText(detailCompany, detail.company);
  setText(detailFile, detail.file);
  setText(detailDate, detail.date);
  setText(detailPages, detail.pages);
  setText(detailType, detail.type);
  setText(detailDescription, detail.description);
  setText(detailConfidence, detail.confidence || "Non disponibile");
  setText(detailRepository, detail.repository || "Non disponibile");
  setText(detailOcrText, detail.ocr || "Testo OCR non disponibile.");

  if (detailPreviewLines) {
    detailPreviewLines.replaceChildren();
    (detail.previewLines || []).forEach((line) => {
      const item = document.createElement("span");
      item.textContent = line;
      detailPreviewLines.append(item);
    });
  }

  if (detailRecipientList) {
    detailRecipientList.replaceChildren();
    (detail.recipients || []).forEach((recipient) => {
      const item = document.createElement("li");
      item.className = `history-item ${
        recipient.status === "needs-review" ? "needs-review" : recipient.status === "sent" ? "sent" : "confirmed"
      }`;

      const main = document.createElement("div");
      main.className = "history-main";
      const name = document.createElement("strong");
      name.textContent = recipient.name;
      const meta = document.createElement("span");
      meta.textContent = `${recipient.page} · confidenza ${recipient.confidence}%`;
      main.append(name, meta);

      const status = document.createElement("span");
      status.className = `document-status ${
        recipient.status === "needs-review" ? "" : recipient.status === "sent" ? "sent" : "confirmed"
      }`;
      status.textContent = recipient.status === "needs-review"
        ? "Da verificare"
        : recipient.status === "sent"
          ? "Inviato"
          : "Confermato";
      item.append(main, status);
      detailRecipientList.append(item);
    });
  }

  if (detailDeliveryList) {
    detailDeliveryList.replaceChildren();
    [
      ["Stato", detail.deliveryStatus || "Non disponibile"],
      ["Canale", detail.channel || "Non disponibile"],
      ["Caricamento", detail.upload || "Non disponibile"],
      ["Prova", detail.proof || "Non disponibile"]
    ].forEach(([label, value]) => {
      const item = document.createElement("li");
      const strong = document.createElement("strong");
      const span = document.createElement("span");
      strong.textContent = label;
      span.textContent = value;
      item.append(strong, span);
      detailDeliveryList.append(item);
    });
  }

  if (detailAuditList) {
    detailAuditList.replaceChildren();
    [detail.corrections, ...(detail.audit || [])].filter(Boolean).forEach((value) => {
      const item = document.createElement("li");
      const strong = document.createElement("strong");
      const span = document.createElement("span");
      strong.textContent = value === detail.corrections ? "Correzioni" : "Evento";
      span.textContent = value;
      item.append(strong, span);
      detailAuditList.append(item);
    });
  }
}

function applyDocumentFilters() {
  if (!documentHistory) {
    return;
  }

  const query = (documentSearch?.value || "").trim().toLowerCase();
  const filter = documentFilter?.value || "";
  let visibleCount = 0;

  documentHistory.querySelectorAll(".document-item").forEach((item) => {
    const text = `${item.textContent} ${item.dataset.tags || ""}`.toLowerCase();
    const tags = item.dataset.tags || "";
    const matchesQuery = !query || text.includes(query);
    const matchesFilter = !filter || tags.includes(filter);
    const visible = matchesQuery && matchesFilter;
    item.classList.toggle("hidden", !visible);
    if (visible) {
      visibleCount += 1;
    }
  });

  documentEmpty?.classList.toggle("hidden", visibleCount > 0);
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

  currentAnalysisDocumentId = documentId;
  activeDocumentId = documentId;
  copilotRun.processed = true;
  copilotRun.recipients = (detail.recipients || []).map((recipient, index) => ({
    id: index === 0 && (detail.recipients || []).length === 1
      ? "current-document-recipient"
      : `${documentId}-recipient-${index}`,
    name: recipient.name,
    confidence: recipient.confidence,
    page: recipient.page,
    status: recipient.status,
    note: recipient.status === "needs-review"
      ? "Richiede conferma operatore"
      : recipient.status === "sent"
        ? "Invio già tracciato"
        : "Confermato da OCR"
  }));

  const recipientToEdit = copilotRun.recipients.find((recipient) => recipient.status === "needs-review")
    || copilotRun.recipients[0];
  selectedRecipientId = recipientToEdit?.id || "current-document-recipient";

  setOcrValue(ocrEmployeeInput, recipientToEdit?.name || detail.employee);
  setOcrValue(ocrCompanyInput, detail.company);
  setOcrValue(ocrFileInput, detail.file);
  setOcrValue(ocrDateInput, detail.date);
  setOcrValue(ocrPagesInput, detail.pages);
  setOcrValue(ocrTypeInput, detail.type);
  setOcrValue(ocrDescriptionInput, detail.description);
  setText(uploadState, `Documento ripreso: ${detail.title}`);
  setText(detectedConfidence, detail.confidence || "--");

  currentDocumentState = documentStateFromDetail(detail);
  unlockSteps(["copilot-analysis"]);
  renderRecipientList();
  updateOcrTextPreview();
  updateCurrentDocumentCard();
  updateSplitAndDispatchState();
  updateDocumentDetail(documentId);
  setText(analysisNote, "Dati parziali ricaricati dallo storico. Puoi correggere, confermare e proseguire il flusso.");
  goTo("copilot", "copilot-analysis");
}

function fillCopilotResults() {
  uploadBox?.classList.remove("processing");
  unlockSteps(["copilot-analysis"]);
  copilotRun.processed = true;
  setText(uploadState, "Documento analizzato");
  setText(detectedConfidence, "94%");
  setText(confidenceHint, "Verifica richiesta sul destinatario sotto soglia");
  setOcrValue(ocrEmployeeInput, "Giulia Conti");
  setOcrValue(ocrCompanyInput, "Eggon S.r.l.");
  setOcrValue(ocrFileInput, "cedolini-aprile-2026.pdf");
  setOcrValue(ocrDateInput, "30/04/2026");
  setOcrValue(ocrPagesInput, "3");
  setOcrValue(ocrTypeInput, "Cedolino mensile");
  setOcrValue(ocrDescriptionInput, "Cedolini mensili con split per singolo dipendente.");
  resetCopilotRecipients(ocrEmployeeInput?.value || "Giulia Conti");
  syncOcrSummary();
  setText(analysisNote, "Il modello ha compilato i dati. Puoi modificarli; il destinatario con confidenza bassa va confermato.");

  setCurrentDocumentState(
    "Da verificare",
    "verifica bassa-confidenza",
    "",
    "needs-review"
  );
  syncRecipientsIntoDocument();
  renderRecipientList();
  updateSplitAndDispatchState();
  updateDocumentDetail(currentAnalysisDocumentId);
  goTo("copilot", "copilot-analysis");
}

function processUpload() {
  currentAnalysisDocumentId = "cedolini-aprile-2026";
  activeDocumentId = currentAnalysisDocumentId;
  uploadBox?.classList.add("processing");
  copilotRun.processed = false;
  copilotRun.recipients = [];
  setStepLocked("copilot-analysis", true);
  setStepLocked("copilot-dispatch", true);
  setText(uploadState, "Analisi automatica in corso");
  setText(detectedConfidence, "In corso");
  setText(confidenceHint, "OCR e classificazione in elaborazione");
  setOcrValue(ocrEmployeeInput, "Analisi in corso");
  setOcrValue(ocrCompanyInput, "Analisi in corso");
  setOcrValue(ocrFileInput, "Analisi in corso");
  setOcrValue(ocrDateInput, "Analisi in corso");
  setOcrValue(ocrPagesInput, "Analisi in corso");
  setOcrValue(ocrTypeInput, "Analisi in corso");
  setOcrValue(ocrDescriptionInput, "Analisi in corso");
  setText(ocrSnippet, "Lettura del testo, classificazione e split del lotto in corso.");
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
  setText(analysisNote, "Analisi automatica in corso. I campi saranno modificabili appena termina l'estrazione.");
  setText(editingContext, "Analisi in corso: i destinatari verranno selezionabili dopo lo split.");
  setText(dispatchStatus, "Attendi il completamento dell'analisi.");
  if (dispatchButton) {
    dispatchButton.disabled = true;
    dispatchButton.textContent = "Invia documenti confermati";
  }

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
    setOcrValue(ocrEmployeeInput, recipient.name);
    documentDetails[currentAnalysisDocumentId].employee = recipient.name;
    documentDetails[currentAnalysisDocumentId].confidence = `${recipient.confidence}%`;
    renderRecipientList();
    updateOcrTextPreview();
    updateCurrentDocumentCard();
    updateDocumentDetail(currentAnalysisDocumentId);
    setText(analysisNote, `Destinatario selezionato: ${recipient.name}. Modifica il nome nel campo OCR se l'associazione non è corretta.`);
    goTo("copilot", "copilot-analysis");
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
    recipient.note = recipient.id === "current-document-recipient"
      ? "Destinatario confermato dall'operatore"
      : recipient.note;
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
      `confermato ${detail.type} ${detail.company} ${detail.employee}${countManualCorrections() > 0 ? " modificato manualmente" : ""}`,
      "confirmed",
      "confirmed"
    );
  }
  renderRecipientList();
  updateSplitAndDispatchState();
  updateDocumentDetail(currentAnalysisDocumentId);
});

dispatchButton?.addEventListener("click", () => {
  const detail = documentDetails[currentAnalysisDocumentId];
  const confirmedCount = copilotRun.recipients.filter((recipient) => recipient.status === "confirmed").length;
  setText(dispatchStatus, "Invio registrato. Prove di consegna disponibili nel dettaglio documento.");
  copilotRun.recipients.forEach((recipient) => {
    if (recipient.status === "confirmed") {
      recipient.status = "sent";
    }
  });
  detail.deliveryStatus = "Inviato";
  detail.proof = `Prova di consegna archiviata per ${confirmedCount} documenti`;
  detail.audit = [
    `Invio completato per ${confirmedCount} documenti`,
    "Prova di consegna archiviata",
    ...(detail.audit || [])
  ];
  if (dispatchButton) {
    dispatchButton.disabled = true;
    dispatchButton.textContent = "Documenti inviati";
  }
  setCurrentDocumentState(
    "Inviato",
    `inviato ${detail.type} ${detail.company} ${detail.employee}${countManualCorrections() > 0 ? " modificato manualmente" : ""}`,
    "sent",
    ""
  );
  syncRecipientsIntoDocument();
  renderRecipientList();
  updateDocumentDetail(currentAnalysisDocumentId);
  goTo("copilot", "copilot-documents");
});

documentSearch?.addEventListener("input", applyDocumentFilters);
documentFilter?.addEventListener("change", applyDocumentFilters);
documentHistory?.addEventListener("click", (event) => {
  const resumeButton = event.target.closest("[data-resume-document]");
  if (resumeButton) {
    loadDocumentIntoFlow(resumeButton.dataset.resumeDocument);
    return;
  }

  const button = event.target.closest("[data-document-detail]");
  if (!button) {
    return;
  }

  updateDocumentDetail(button.dataset.documentDetail);
});

document.querySelectorAll("[data-document-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    const tab = button.dataset.documentTab;
    document.querySelectorAll("[data-document-tab]").forEach((tabButton) => {
      tabButton.classList.toggle("active", tabButton === button);
    });
    document.querySelectorAll("[data-document-panel]").forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.documentPanel === tab);
    });
  });
});
applyDocumentFilters();
updateDocumentDetail(activeDocumentId);

const auditSearch = document.getElementById("audit-search");
const auditLog = document.getElementById("audit-log-list");
const deliveryPeriod = document.getElementById("delivery-period");
const deliveryChannelFilter = document.getElementById("delivery-channel-filter");
const deliveryKpiList = document.getElementById("delivery-kpi-list");

function prependAuditItem(title, detail) {
  if (!auditLog) {
    return;
  }

  const item = document.createElement("li");
  const strong = document.createElement("strong");
  const span = document.createElement("span");
  strong.textContent = title;
  span.textContent = detail;
  item.append(strong, span);
  auditLog.prepend(item);
}

auditSearch?.addEventListener("input", () => {
  const query = auditSearch.value.trim().toLowerCase();

  auditLog?.querySelectorAll("li").forEach((item) => {
    const visible = item.textContent.toLowerCase().includes(query);
    item.classList.toggle("hidden", !visible);
  });
});

function updateDeliveryAnalytics() {
  const period = deliveryPeriod?.value || "Ultimi 30 giorni";
  const channel = deliveryChannelFilter?.value || "Tutti";
  const isShortPeriod = period === "Ultimi 7 giorni";
  const isEmail = channel === "Email";
  const isPortal = channel === "Portale";
  const completed = isShortPeriod ? 38 : isPortal ? 24 : isEmail ? 118 : 142;
  const delivered = isPortal ? "91%" : "97%";
  const read = isPortal ? "86%" : isEmail ? "83%" : "81%";
  const retries = isPortal ? 1 : isEmail ? 1 : 2;

  if (deliveryKpiList) {
    const values = [
      [completed, "Invii completati"],
      [delivered, "Consegnati"],
      [read, "Letture confermate"],
      [retries, "Retry aperti"]
    ];
    deliveryKpiList.replaceChildren();
    values.forEach(([value, label]) => {
      const item = document.createElement("li");
      const strong = document.createElement("strong");
      const span = document.createElement("span");
      strong.textContent = value;
      span.textContent = label;
      item.append(strong, span);
      deliveryKpiList.append(item);
    });
  }

  if (auditLog) {
    auditLog.replaceChildren();
    [
      `${channel}: ${completed} invii nel periodo ${period.toLowerCase()}`,
      `Consegna media ${delivered}, lettura media ${read}`,
      `${retries} retry aperti, prove di consegna archiviate automaticamente`
    ].forEach((value, index) => {
      const item = document.createElement("li");
      const strong = document.createElement("strong");
      const span = document.createElement("span");
      strong.textContent = index === 0 ? "Volume" : index === 1 ? "Qualità" : "Operatività";
      span.textContent = value;
      item.append(strong, span);
      auditLog.append(item);
    });
  }
}

deliveryPeriod?.addEventListener("change", updateDeliveryAnalytics);
deliveryChannelFilter?.addEventListener("change", updateDeliveryAnalytics);
updateDeliveryAnalytics();
