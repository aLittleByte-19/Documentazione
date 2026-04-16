const views = {
  overview: "Overview operativa",
  assistant: "AI Assistant Generativo",
  copilot: "AI Co-Pilot per i CdL",
  audit: "Invii e Audit"
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

function setText(node, value) {
  if (node) {
    node.textContent = value;
  }
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

window.addEventListener("scroll", updateBackToTopVisibility, { passive: true });

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

activateSubnav("overview-status");

const promptInput = document.getElementById("prompt-input");
const toneSelect = document.getElementById("tone-select");
const styleSelect = document.getElementById("style-select");
const channelSelect = document.getElementById("channel-select");
const audienceSelect = document.getElementById("audience-select");
const generateButton = document.getElementById("generate-button");
const savePromptButton = document.getElementById("save-prompt-button");
const regenerateButton = document.getElementById("regenerate-button");
const saveDraftButton = document.getElementById("save-draft-button");
const exportButton = document.getElementById("export-button");
const sendButton = document.getElementById("send-button");
const recipientCategorySelect = document.getElementById("recipient-category-select");
const recipientEmailInput = document.getElementById("recipient-email-input");
const generatedTitleInput = document.getElementById("generated-title-input");
const generatedBodyInput = document.getElementById("generated-body-input");
const assistantStatus = document.getElementById("assistant-status");
const assistantComposeNote = document.getElementById("assistant-compose-note");
const promptHistory = document.getElementById("prompt-history");
const promptSearch = document.getElementById("prompt-search");
const promptFilter = document.getElementById("prompt-filter");
const promptEmpty = document.getElementById("prompt-empty");
const metaChars = document.getElementById("meta-chars");
const metaTime = document.getElementById("meta-time");

[
  "assistant-review",
  "assistant-feedback",
  "copilot-analysis",
  "copilot-recipients",
  "copilot-dispatch"
].forEach((stepId) => setStepLocked(stepId, true));

function buildTitle(channel) {
  if (channel === "News portale") {
    return "Nuova area documentale su NEXUM";
  }

  if (channel === "Notifica rapida") {
    return "Area documentale aggiornata";
  }

  return "Nuova area documentale disponibile su NEXUM";
}

function buildBody(prompt, tone, style, channel, audience) {
  const base = prompt.trim();
  const toneLine =
    tone === "Più istituzionale"
      ? "Il messaggio mantiene un registro formale e rassicurante."
      : tone === "Più sintetico"
        ? "Il testo va dritto al punto e riduce i passaggi secondari."
        : "Il testo usa un tono chiaro, diretto e vicino alle persone.";

  const styleLine =
    style === "Avviso operativo"
      ? "Include cosa cambia e cosa deve fare il destinatario."
      : style === "Aggiornamento breve"
        ? "Privilegia una struttura breve, adatta a una lettura rapida."
        : "Spiega il beneficio e il contesto in modo semplice.";

  const channelLine =
    channel === "Email interna"
      ? "Chiusura pronta per l'invio via email interna."
      : channel === "News portale"
        ? "Formato adatto alla pubblicazione sul portale."
        : "Formato adatto a una notifica rapida.";

  return `${base} Destinatari: ${audience}. ${toneLine} ${styleLine} ${channelLine}`;
}

function updateMeta() {
  if (!generatedBodyInput) {
    return;
  }

  const chars = generatedBodyInput.value.length;
  setText(metaChars, `${chars} caratteri`);
  setText(metaTime, `${Math.max(1, Math.round(chars / 500))} min lettura`);
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

  main.append(strong, meta);
  item.append(main, action);
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
    ? `${buildTitle(channelSelect.value)} - variante`
    : buildTitle(channelSelect.value);
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
      ? `${body} Versione alternativa con apertura più sintetica.`
      : body;
  }

  updateMeta();
  setText(assistantStatus, variant ? "Variante pronta" : "Bozza aggiornata");
  setText(assistantComposeNote, "Bozza generata e pronta per la revisione.");
  if (recipientCategorySelect && audienceSelect) {
    recipientCategorySelect.value = audienceSelect.value;
  }

  if (addToHistory) {
    appendHistoryItem(title, promptInput.value, channelSelect.value, toneSelect.value);
  }

  unlockSteps(["assistant-review", "assistant-feedback"]);
  goTo("assistant", "assistant-review");
}

generateButton?.addEventListener("click", () => {
  generateDraft();
});

regenerateButton?.addEventListener("click", () => {
  generateDraft({ addToHistory: false, variant: true });
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
  setText(assistantStatus, "Esportazione pronta");
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

let selectedRating = 4;
const ratingButtons = document.querySelectorAll("[data-rating]");
const ratingSubmitButton = document.getElementById("rating-submit-button");
const ratingNote = document.getElementById("rating-note");

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

updateRating(selectedRating);

ratingSubmitButton?.addEventListener("click", () => {
  setText(ratingNote, `Valutazione registrata: ${selectedRating} su 5.`);
  ratingNote?.classList.remove("hidden");
});

const uploadBox = document.getElementById("upload-box");
const uploadState = document.getElementById("upload-state");
const detectedType = document.getElementById("detected-type");
const detectedPeriod = document.getElementById("detected-period");
const detectedCompany = document.getElementById("detected-company");
const detectedRecipients = document.getElementById("detected-recipients");
const detectedConfidence = document.getElementById("detected-confidence");
const ocrSnippet = document.getElementById("ocr-snippet");
const analysisNote = document.getElementById("analysis-note");
const recipientList = document.getElementById("recipient-list");
const splitState = document.getElementById("split-state");
const dispatchMessage = document.getElementById("dispatch-message");
const dispatchReady = document.getElementById("dispatch-ready");
const dispatchButton = document.getElementById("dispatch-button");
const dispatchStatus = document.getElementById("dispatch-status");

function fillCopilotResults() {
  uploadBox?.classList.remove("processing");
  unlockSteps(["copilot-analysis", "copilot-recipients"]);
  setText(uploadState, "Documento analizzato");
  setText(detectedType, "Cedolino mensile");
  setText(detectedPeriod, "Aprile 2026");
  setText(detectedCompany, "Eggon S.r.l.");
  setText(detectedRecipients, "3 rilevati");
  setText(detectedConfidence, "94%");
  setText(
    ocrSnippet,
    "Rilevati periodo di competenza, azienda, nominativi, matricole e importi netti. Una pagina richiede conferma del destinatario."
  );
  setText(analysisNote, "Il modello ha compilato i metadati. Resta da verificare solo il destinatario sotto soglia.");
  setText(splitState, "3 documenti generati, 1 da verificare");
  setText(dispatchMessage, "Oggetto: documento disponibile. Il cedolino di aprile è pronto nell'area riservata.");
  setText(dispatchReady, "2 confermati, 1 in verifica");
  setText(dispatchStatus, "Verifica il caso segnalato prima di inviare tutto il lotto.");

  if (dispatchButton) {
    dispatchButton.disabled = true;
  }

  if (recipientList) {
    recipientList.innerHTML = `
      <li class="history-item confirmed">
        <div class="history-main">
          <strong>Marco Rinaldi</strong>
          <span>Confidenza 98% · split pronto</span>
        </div>
      </li>
      <li class="history-item confirmed">
        <div class="history-main">
          <strong>Elena Ferri</strong>
          <span>Confidenza 95% · split pronto</span>
        </div>
      </li>
      <li class="history-item needs-review">
        <div class="history-main">
          <strong>Giulia Conti</strong>
          <span>Confidenza 82% · verifica destinatario</span>
        </div>
        <button class="text-button" type="button" data-confirm-recipient>Conferma</button>
      </li>
    `;
  }

  goTo("copilot", "copilot-analysis");
}

function processUpload() {
  uploadBox?.classList.add("processing");
  setStepLocked("copilot-dispatch", true);
  setText(uploadState, "Analisi automatica in corso");
  setText(detectedType, "Analisi in corso");
  setText(detectedPeriod, "Analisi in corso");
  setText(detectedCompany, "Analisi in corso");
  setText(detectedRecipients, "Analisi in corso");
  setText(detectedConfidence, "--");
  setText(ocrSnippet, "OCR e classificazione stanno leggendo il documento.");
  setText(dispatchStatus, "Attendi il completamento dell'analisi.");
  if (dispatchButton) {
    dispatchButton.disabled = true;
  }

  window.setTimeout(fillCopilotResults, 500);
}

uploadBox?.addEventListener("click", processUpload);

recipientList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-confirm-recipient]");
  if (!button) {
    return;
  }

  const item = button.closest(".history-item");
  item?.classList.remove("needs-review");
  item?.classList.add("confirmed");
  button.remove();
  setText(splitState, "3 documenti confermati");
  setText(dispatchReady, "3 confermati");
  setText(dispatchStatus, "Lotto pronto per l'invio.");
  unlockSteps(["copilot-dispatch"]);
  if (dispatchButton) {
    dispatchButton.disabled = false;
  }
});

dispatchButton?.addEventListener("click", () => {
  setText(dispatchStatus, "Invio registrato. Prove di consegna disponibili in audit.");
  prependAuditItem("Lotto cedolini aprile 2026", "Invio completato e prova di consegna archiviata");
  goTo("audit", "audit-log");
});

const auditSearch = document.getElementById("audit-search");
const auditLog = document.getElementById("audit-log-list");

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
