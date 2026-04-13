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

function setView(viewName) {
  mainNavItems.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewName);
  });

  sections.forEach((section) => {
    section.classList.toggle("active", section.dataset.view === viewName);
  });

  titleNode.textContent = views[viewName];
}

function activateSubnav(targetId) {
  subNavItems.forEach((button) => {
    button.classList.toggle("active", button.dataset.target === targetId);
  });
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

mainNavItems.forEach((button) => {
  button.addEventListener("click", () => {
    goTo(button.dataset.view, button.dataset.target);
  });
});

subNavItems.forEach((button) => {
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
const generatedTitleInput = document.getElementById("generated-title-input");
const generatedBodyInput = document.getElementById("generated-body-input");
const assistantStatus = document.getElementById("assistant-status");
const promptHistory = document.getElementById("prompt-history");
const metaChars = document.getElementById("meta-chars");
const metaTime = document.getElementById("meta-time");

function buildTitle(channel) {
  if (channel === "News portale") {
    return "Nuovo spazio documentale su NEXUM";
  }

  if (channel === "Notifica rapida") {
    return "Area documentale aggiornata";
  }

  return "Comunicazione interna pronta";
}

function buildBody(prompt, tone, style, channel, audience) {
  const promptText = prompt.trim() || "È disponibile un nuovo aggiornamento interno.";
  const toneText =
    tone === "Più istituzionale"
      ? "Tono formale e lineare."
      : tone === "Più sintetico"
        ? "Testo breve e diretto."
        : "Testo chiaro e rassicurante.";

  const styleText =
    style === "Avviso operativo"
      ? "Struttura da avviso operativo."
      : style === "Aggiornamento breve"
        ? "Formato breve."
        : "Formato informativo.";

  const channelText =
    channel === "Email interna"
      ? "Pronta per l'email interna."
      : channel === "News portale"
        ? "Pronta per il portale."
        : "Pronta come notifica.";

  return `${promptText} Destinatari: ${audience}. ${toneText} ${styleText} ${channelText}`;
}

function appendHistoryItem(title, audience, channel) {
  const item = document.createElement("li");
  item.className = "history-item";
  item.innerHTML = `
    <div class="history-main">
      <strong>${title}</strong>
      <span>Canale: ${channel} · Destinatari: ${audience} · Ultimo uso: adesso</span>
    </div>
    <div class="mini-actions">
      <span class="mini-pill">Duplica</span>
      <span class="mini-pill">Riusa</span>
    </div>
  `;
  promptHistory.prepend(item);
}

generateButton?.addEventListener("click", () => {
  const title = buildTitle(channelSelect.value);
  const body = buildBody(
    promptInput.value,
    toneSelect.value,
    styleSelect.value,
    channelSelect.value,
    audienceSelect.value
  );
  const chars = body.length;

  generatedTitleInput.value = title;
  generatedBodyInput.value = body;
  assistantStatus.textContent = "Aggiornata";
  metaChars.textContent = `${chars} caratteri`;
  metaTime.textContent = `${Math.max(1, Math.round(chars / 500))} min lettura`;

  appendHistoryItem(title, audienceSelect.value, channelSelect.value);
  goTo("assistant", "assistant-review");
});

const analyzeButton = document.getElementById("analyze-button");
const analysisStatus = document.getElementById("analysis-status");
const ocrSnippet = document.getElementById("ocr-snippet");
const recipientList = document.getElementById("recipient-list");
const dispatchMessage = document.getElementById("dispatch-message");

analyzeButton?.addEventListener("click", () => {
  analysisStatus.innerHTML = `
    <li><strong>Stato OCR</strong><span>Completato</span></li>
    <li><strong>Tipo documento</strong><span>Cedolino mensile</span></li>
    <li><strong>Pagine con alert</strong><span>2 da verificare</span></li>
  `;

  ocrSnippet.textContent =
    "Cedolino aprile 2026 rilevato. Estratti periodo, nominativo, matricola e netto.";

  recipientList.innerHTML = `
    <li class="history-item">
      <div class="history-main">
        <strong>Marco Rinaldi</strong>
        <span>Confidenza 98% · Split pronto</span>
      </div>
      <div class="mini-actions">
        <span class="mini-pill active">Confermato</span>
      </div>
    </li>
    <li class="history-item">
      <div class="history-main">
        <strong>Elena Ferri</strong>
        <span>Confidenza 95% · Split pronto</span>
      </div>
      <div class="mini-actions">
        <span class="mini-pill active">Confermato</span>
      </div>
    </li>
    <li class="history-item">
      <div class="history-main">
        <strong>Giulia Conti</strong>
        <span>Confidenza 82% · Richiede verifica manuale</span>
      </div>
      <div class="mini-actions">
        <span class="mini-pill">Verifica</span>
      </div>
    </li>
  `;

  dispatchMessage.textContent =
    "Oggetto: documentazione disponibile. Il documento del mese è pronto in area riservata.";

  goTo("copilot", "copilot-recipients");
});

const auditSearch = document.getElementById("audit-search");
const auditLog = document.getElementById("audit-log-list");

auditSearch?.addEventListener("input", () => {
  const query = auditSearch.value.trim().toLowerCase();

  auditLog.querySelectorAll("li").forEach((item) => {
    const visible = item.textContent.toLowerCase().includes(query);
    item.classList.toggle("hidden", !visible);
  });
});
