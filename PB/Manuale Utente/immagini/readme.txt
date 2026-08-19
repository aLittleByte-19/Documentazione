Schermate da catturare per il Manuale Utente
===========================================

Salvare i PNG in questa cartella, a larghezza desktop, tema chiaro,
senza dati personali reali. Poi, nel file "Manuale Utente.tex",
sostituire ogni \screenshottodo{nome}{...}{...} con:

  \begin{figure}[H]
  \centering
  \includegraphics[width=\textwidth]{immagini/nome.png}
  \caption{...}
  \label{fig:nome}
  \end{figure}

Elenco dei file (allineato all'appendice del manuale):

  shell-completa.png
  sidebar-navigazione.png
  header-tema.png
  overview-hero.png
  overview-metriche.png
  assistant-composizione.png
  assistant-avanzamento.png
  assistant-revisione.png
  assistant-modifica.png
  assistant-valutazione.png
  assistant-azioni.png
  assistant-filtri.png
  assistant-configurazioni.png
  assistant-storico.png
  copilot-caricamento.png
  copilot-avanzamento.png
  copilot-storico.png
  copilot-filtri.png
  copilot-dettaglio.png
  copilot-revisione.png
  copilot-messaggio.png
  copilot-metriche.png

L'applicazione locale è su https://localhost:8443
(overview, assistant, copilot).
