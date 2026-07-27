import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

const repositoryRoot = resolve(process.cwd(), '../..');
const generatedSiteRoot = join(repositoryRoot, '_site');

async function firstViewerHref(page: Page): Promise<string> {
  await page.goto('/index.html');
  const href = await page.locator('a[href$=".html"]').evaluateAll((links) =>
    links
      .map((link) => link.getAttribute('href'))
      .find((candidate) =>
        Boolean(candidate && !candidate.endsWith('index.html') && !candidate.endsWith('glossario.html')),
      ),
  );

  expect(href).toBeTruthy();
  return href!;
}

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  }));
  return nested.flat();
}

test('generated HTML is complete and every phase glossary uses the live thumbnail', async () => {
  const generatedFiles = await walk(generatedSiteRoot);
  const htmlFiles = generatedFiles.filter((file) => file.endsWith('.html'));

  expect(htmlFiles.length).toBeGreaterThan(1);
  for (const htmlFile of htmlFiles) {
    const html = await readFile(htmlFile, 'utf8');
    expect(html, htmlFile).toMatch(/<html\b[^>]*\blang="it"[^>]*>/i);
    expect(html, htmlFile).toMatch(/<title>[^<]+ \| aLittleByte<\/title>/);
    expect(html, htmlFile).toMatch(/<link\s+rel="icon"[^>]*solo_logo\.png/i);
    expect(html, htmlFile).not.toContain('{{');
  }

  const phaseDirectories = (await readdir(repositoryRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && ['candidatura', 'rtb', 'pb'].includes(entry.name.toLowerCase()))
    .map((entry) => join(repositoryRoot, entry.name));
  const phaseFiles = (await Promise.all(phaseDirectories.map(walk))).flat();
  const sourceGlossaries = phaseFiles.filter((file) => basename(file).toLowerCase() === 'glossario.pdf');
  const home = await readFile(join(generatedSiteRoot, 'index.html'), 'utf8');
  const glossaryCards = home.match(/<a class="doc-item[^"]*" href="glossario\.html"/g) ?? [];
  const glossaryPreviews = home.match(/src="thumbs\/glossario\.png"/g) ?? [];

  expect(sourceGlossaries.length).toBeGreaterThan(0);
  expect(glossaryCards).toHaveLength(sourceGlossaries.length);
  expect(glossaryPreviews).toHaveLength(sourceGlossaries.length);

  const thumbnail = await readFile(join(generatedSiteRoot, 'thumbs', 'glossario.png'));
  expect(thumbnail.subarray(1, 4).toString('ascii')).toBe('PNG');
  expect(thumbnail.readUInt32BE(16)).toBe(800);
  expect(thumbnail.readUInt32BE(20)).toBe(1131);

  const sourceGlossary = await readFile(join(repositoryRoot, '.github/site-src/glossary.json'));
  const deployedGlossary = await readFile(join(generatedSiteRoot, 'glossary-app/glossary.json'));
  expect(deployedGlossary.equals(sourceGlossary)).toBe(true);
});

test('home navigation, back-to-top and primary local resources work', async ({ page }) => {
  const runtimeErrors: string[] = [];
  const failedLocalResponses: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('response', (response) => {
    if (response.url().startsWith('http://127.0.0.1:8765/') && response.status() >= 400) {
      failedLocalResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto('/index.html');
  await expect(page.getByRole('heading', { level: 1, name: 'aLittleByte - Gruppo 19' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'GLOSSARIO', exact: true })).toHaveAttribute('href', 'glossario.html');
  await expect(page.locator('img[src="thumbs/glossario.png"]').first()).toBeVisible();

  await page.getByRole('link', { name: 'ABOUT' }).click();
  await expect(page).toHaveURL(/#about$/);
  await expect(page.locator('#about')).toBeVisible();

  await page.locator('#page-scroll').evaluate((element) => element.scrollTo(0, element.scrollHeight));
  const backToTop = page.getByRole('button', { name: 'Torna in alto' });
  await expect(backToTop).toBeVisible();
  await backToTop.click();
  await expect.poll(() => page.locator('#page-scroll').evaluate((element) => element.scrollTop)).toBeLessThan(10);

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(
    accessibility.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact ?? '')),
  ).toEqual([]);
  expect(runtimeErrors).toEqual([]);
  expect(failedLocalResponses).toEqual([]);
});

test('home remains within a 375px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/index.html');
  await expect(page.getByRole('heading', { level: 1, name: 'aLittleByte - Gruppo 19' })).toBeVisible();

  const metrics = await page.evaluate(() => ({
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    glossaryPreviewVisible: Boolean(document.querySelector<HTMLImageElement>('img[src="thumbs/glossario.png"]')?.naturalWidth),
    headerBottom: document.querySelector('header')?.getBoundingClientRect().bottom ?? 0,
    scrollerTop: document.querySelector('#page-scroll')?.getBoundingClientRect().top ?? 0,
    scrollerOverflow: getComputedStyle(document.querySelector<HTMLElement>('#page-scroll')!).overflowY,
    scrollerScrollable: document.querySelector<HTMLElement>('#page-scroll')!.scrollHeight >
      document.querySelector<HTMLElement>('#page-scroll')!.clientHeight,
    viewportScrollLocked: getComputedStyle(document.body).overflowY === 'hidden',
    windowScrollY: window.scrollY,
  }));
  expect(metrics.horizontalOverflow).toBe(false);
  expect(metrics.glossaryPreviewVisible).toBe(true);
  expect(Math.abs(metrics.scrollerTop - metrics.headerBottom)).toBeLessThanOrEqual(1);
  expect(metrics.scrollerOverflow).toBe('auto');
  expect(metrics.scrollerScrollable).toBe(true);
  expect(metrics.viewportScrollLocked).toBe(true);
  expect(metrics.windowScrollY).toBe(0);
});

test('PDF viewer loads a document and its primary controls work', async ({ page, request }) => {
  const runtimeErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  page.on('pageerror', (error) => runtimeErrors.push(error.message));

  const viewerHref = await firstViewerHref(page);
  await page.goto(viewerHref);
  await expect(page.locator('.pdf-page.is-rendered').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#page-total')).not.toHaveText('/ 0');
  await expect(page.locator('#page-count')).toHaveText(/\d+ pagin/);

  const zoomInput = page.getByRole('textbox', { name: 'Zoom percentuale' });
  await expect(zoomInput).toHaveValue('100');
  await page.getByRole('button', { name: 'Aumenta zoom' }).click();
  await expect(zoomInput).toHaveValue('110');

  const originalPdf = await page.locator('#open-pdf-link').getAttribute('href');
  expect(originalPdf).toBeTruthy();
  const pdfResponse = await request.get(new URL(originalPdf!, page.url()).href);
  expect(pdfResponse.ok()).toBe(true);
  expect(pdfResponse.headers()['content-type']).toContain('application/pdf');

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(
    accessibility.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact ?? '')),
  ).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});

test('PDF viewer sidebar works without mobile overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const viewerHref = await firstViewerHref(page);
  await page.goto(viewerHref);
  await expect(page.locator('.pdf-page.is-rendered').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('body')).toHaveClass(/sidebar-collapsed/);

  const sidebarToggle = page.getByRole('button', { name: 'Mostra o nascondi anteprime' });
  await expect(sidebarToggle).toHaveAttribute('aria-pressed', 'false');
  await sidebarToggle.click();
  await expect(page.locator('body')).not.toHaveClass(/sidebar-collapsed/);
  await expect(sidebarToggle).toHaveAttribute('aria-pressed', 'true');

  const metrics = await page.evaluate(() => ({
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    undersizedControls: [...document.querySelectorAll<HTMLElement>('button, .toolbar a, .brand')]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          label: element.getAttribute('aria-label') || element.textContent?.trim(),
          width: rect.width,
          height: rect.height,
        };
      })
      .filter((control) => control.width < 44 || control.height < 44),
  }));
  expect(metrics.horizontalOverflow).toBe(false);
  expect(metrics.undersizedControls).toEqual([]);
});
