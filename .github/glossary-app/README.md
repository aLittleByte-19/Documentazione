# Glossario Angular

Questa workspace contiene l'unica interfaccia pubblica del glossario. Il contenuto non è incorporato nei componenti: viene letto da `../site-src/glossary.json` durante il build e pubblicato come `glossary-app/glossary.json`.

## Aggiornare le voci

Sostituire soltanto `.github/site-src/glossary.json`, mantenendo questo contratto non versionato:

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

Gli ID devono essere univoci e usare lettere minuscole, numeri e trattini. Termini, definizioni e alias sono sempre testo semplice; l'app non interpreta HTML.

## Verifica locale

```bash
cd .github/glossary-app
nvm use
npm ci
npm run validate:data
npm run build
cd ../..
python3 .github/site-src/update_index.py
cd .github/glossary-app
npm run capture:glossary-thumbnail
cd ../..
python3 .github/preview_site.py --no-build
```

Per i test browser e per la miniatura del glossario, installare una volta Chromium con `npx playwright install chromium`. `npm run test:e2e` verifica glossario, home, viewer PDF, output statico e responsive dalla workspace Angular.

Il build Angular genera un index temporaneo. `update_index.py` lo copia in `_site/glossario.html` e colloca bundle, asset e JSON in `_site/glossary-app/`. `capture:glossary-thumbnail` fotografa sempre la pagina appena assemblata in `_site/thumbs/glossario.png`; tutte le card Glossario delle diverse fasi usano la stessa anteprima aggiornata.

## Versioni

Angular 20 e PrimeNG 20.4 sono bloccati nel lockfile. PrimeNG 20.4 è la release community MIT usata dal progetto. PrimeNG 22 richiede invece una chiave PrimeUI valida e non va introdotto senza configurare la relativa licenza.
