import { createServer } from 'node:http';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '../../..');
const siteRoot = resolve(repositoryRoot, '_site');
const thumbnailPath = resolve(siteRoot, 'thumbs/glossario.png');
const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.woff2', 'font/woff2'],
]);

await stat(resolve(siteRoot, 'glossario.html'));
await mkdir(dirname(thumbnailPath), { recursive: true });

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
    const pathname = decodeURIComponent(requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname);
    const filePath = resolve(siteRoot, `.${pathname}`);

    if (filePath !== siteRoot && !filePath.startsWith(`${siteRoot}${sep}`)) {
      response.writeHead(403).end('Forbidden');
      return;
    }

    const file = await readFile(filePath);
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': contentTypes.get(extname(filePath)) ?? 'application/octet-stream',
    });
    response.end(file);
  } catch {
    response.writeHead(404).end('Not found');
  }
});

await new Promise((resolveListening, rejectListening) => {
  server.once('error', rejectListening);
  server.listen(0, '127.0.0.1', resolveListening);
});

const address = server.address();
if (!address || typeof address === 'string') {
  server.close();
  throw new Error('Impossibile determinare la porta del server per la preview.');
}

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 800, height: 1131 },
    deviceScaleFactor: 1,
  });
  await page.goto(`http://127.0.0.1:${address.port}/glossario.html`, {
    waitUntil: 'networkidle',
  });
  await page.locator('.entry-card').first().waitFor({ state: 'visible' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: thumbnailPath,
    animations: 'disabled',
    fullPage: false,
  });
  console.log(`Anteprima glossario generata: ${thumbnailPath}`);
} finally {
  await browser?.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}
