# Glossario Angular

Questa workspace contiene l'interfaccia pubblica del glossario. Durante il build, `.github/site-src/glossary.json` viene copiato nell'artifact come `glossary-app/glossary.json`. Il browser carica questo file a runtime: le voci non sono incorporate nei bundle JavaScript.

## Aggiornare le voci

Per aggiornare le voci, sostituire `.github/site-src/glossary.json`, mantenendo invariata la seguente struttura. Non modificare la copia sotto `_site`, perché viene rigenerata a ogni build.

```json
{
  "title": "Glossario",
  "entries": [
    {
      "id": "termine",
      "term": "Termine",
      "definition": "Definizione in testo semplice.",
      "aliases": ["Alias"]
    }
  ]
}
```

Ogni voce deve contenere esattamente `id`, `term`, `definition` e `aliases`. `aliases` è sempre un array e può essere vuoto. Gli ID devono essere univoci e usare lettere minuscole, numeri e trattini. Termini, definizioni e alias sono sempre testo semplice; l'app non interpreta HTML.

## Verifica locale

```bash
cd .github/glossary-app
nvm use
npm ci
npx playwright install chromium
npm run validate:data
npm run build
cd ../..
python3 .github/site-src/update_index.py
cd .github/glossary-app
npm run capture:glossary-thumbnail
npm run test:e2e
cd ../..
python3 .github/preview_site.py --no-build
```

Chromium deve essere installato una sola volta. `npm run test:e2e` verifica glossario, home, viewer PDF, output statico e comportamento responsive. L'ultimo comando serve il sito su `http://127.0.0.1:8765`; per arrestarlo, premere `Ctrl+C`.

Il build Angular produce `dist/glossary-app/browser/index.html`. `update_index.py` lo pubblica come `_site/glossario.html` e colloca bundle, asset e JSON sotto `_site/glossary-app/`. `capture:glossary-thumbnail` fotografa la pagina appena assemblata in `_site/thumbs/glossario.png`; tutte le card Glossario delle diverse fasi usano la stessa anteprima aggiornata.

## Versioni

Angular 20 e PrimeNG 20.4 sono bloccati nel lockfile. PrimeNG 20.4 è la release community MIT usata dal progetto. PrimeNG 22 richiede invece una chiave PrimeUI valida e non va introdotto senza configurare la relativa licenza.
