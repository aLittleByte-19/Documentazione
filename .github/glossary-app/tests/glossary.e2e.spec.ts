import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('renders every JSON entry and passes the serious accessibility scan', async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  page.on('pageerror', (error) => runtimeErrors.push(error.message));

  await page.goto('/glossario.html');
  const glossary = await page.evaluate(async () => (await fetch('/glossary-app/glossary.json')).json());

  await expect(page.getByRole('heading', { level: 1, name: 'Glossario' })).toBeVisible();
  await expect(page).toHaveTitle('Glossario | aLittleByte');
  await expect(page.locator('.entry-card')).toHaveCount(glossary.entries.length);
  await expect(page.locator('.result-count')).toHaveText(`${glossary.entries.length} voci`);
  await expect(page.locator('#p-license-host')).toHaveCount(0);
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', 'assets/solo_logo.png');

  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact ?? '')),
  ).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});

test('uses the same pipe title convention across the site', async ({ page }) => {
  await page.goto('/glossario.html');
  const glossaryContextStyle = await page.locator('.brand-context').evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      borderLeftColor: style.borderLeftColor,
      color: style.color,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      letterSpacing: style.letterSpacing,
      lineHeight: style.lineHeight,
      paddingLeft: style.paddingLeft,
    };
  });

  await page.goto('/index.html');
  await expect(page).toHaveTitle('Documentazione | aLittleByte');

  const viewerHref = await page.locator('a[href$=".html"]').evaluateAll((links) =>
    links
      .map((link) => link.getAttribute('href'))
      .find((href) => href && !href.endsWith('index.html') && !href.endsWith('glossario.html')),
  );

  expect(viewerHref).toBeTruthy();
  await page.goto(viewerHref!);
  await expect(page).toHaveTitle(/.+ \| aLittleByte$/);
  const viewerTitleStyle = await page.locator('#document-title').evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      borderLeftColor: style.borderLeftColor,
      color: style.color,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      letterSpacing: style.letterSpacing,
      lineHeight: style.lineHeight,
      paddingLeft: style.paddingLeft,
    };
  });
  expect(glossaryContextStyle).toEqual(viewerTitleStyle);
});

test('searches content and restores the complete list', async ({ page }) => {
  await page.goto('/glossario.html');
  const search = page.getByRole('searchbox', { name: 'Cerca nel glossario' });

  await search.fill('entity resolution');
  await expect(page.locator('.entry-card')).toHaveCount(2);
  await expect(page.locator('.result-count')).toHaveText(/2 di \d+ voci/);
  await expect(page.getByRole('button', { name: 'Cancella ricerca' })).toBeVisible();

  await search.fill('risultato-impossibile-xyz');
  await expect(page.getByRole('heading', { name: 'Nessun risultato' })).toBeVisible();

  await page.locator('.empty-state .secondary-action').click();
  await expect(search).toHaveValue('');
  await expect(page.locator('.result-count')).toHaveText(/\d+ voci/);
  await expect(page.getByRole('button', { name: 'Cancella ricerca' })).toHaveCount(0);
});

test('combines the field menu with the alphabet filter', async ({ page }) => {
  await page.goto('/glossario.html');
  const search = page.getByRole('searchbox', { name: 'Cerca nel glossario' });

  await page.getByRole('button', { name: 'Mostra le voci con iniziale W' }).click();
  await expect(page.locator('.letter-section')).toHaveCount(1);
  await expect(page.locator('.letter-heading h2')).toHaveText('W');
  await expect(page.locator('.entry-card')).toHaveCount(3);
  await expect(page.locator('.result-count')).toHaveText('3 di 120 voci');

  await page.getByRole('button', { name: 'Tutte' }).click();
  const filters = page.getByRole('button', { name: 'Filtri di ricerca' });
  await filters.click();
  await expect(filters).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('radio', { name: 'Solo termini' }).check();
  await expect(search).toHaveAttribute('placeholder', 'Cerca tra i termini');
  const reset = page.getByRole('button', { name: 'Azzera filtri' });
  await reset.hover();
  await expect.poll(() => reset.evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    color: getComputedStyle(element).color,
  }))).toEqual({ background: 'rgb(251, 247, 238)', color: 'rgb(128, 98, 29)' });

  await search.fill('scannerizzati');
  await expect(page.getByRole('heading', { name: 'Nessun risultato' })).toBeVisible();

  await page.getByRole('radio', { name: 'Solo definizioni' }).check();
  await expect(search).toHaveAttribute('placeholder', 'Cerca nelle definizioni');
  await expect(page.locator('.entry-card')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'OCR (Riconoscimento Ottico dei Caratteri)' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(filters).toHaveAttribute('aria-expanded', 'false');
});

test('handles valid and missing fragments with visible feedback', async ({ page }) => {
  await page.goto('/glossario.html#gls-angular');
  const angularEntry = page.locator('#gls-angular');

  await expect(angularEntry).toHaveClass(/is-fragment-target/);
  await expect(angularEntry).toBeFocused();
  await expect(angularEntry).toHaveCSS('outline-style', 'none');
  await expect(angularEntry).toHaveCSS('background-color', 'rgb(251, 247, 238)');
  await expect(angularEntry).toHaveCSS('border-color', 'rgba(179, 139, 54, 0.35)');
  await expect(angularEntry.locator('h3')).toHaveCSS('color', 'rgb(21, 60, 94)');

  await page.goto('/glossario.html#gls-voce-che-non-esiste');
  await expect(page.getByText(/La destinazione richiesta non esiste|La voce collegata non è presente/)).toBeVisible();
  await page.getByRole('button', { name: 'Mostra il glossario' }).click();
  await expect(page).not.toHaveURL(/#/);
});

test('copies a canonical entry link and exposes the back-to-top control', async ({ context, page }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: 'http://127.0.0.1:8765',
  });
  await page.goto('/glossario.html');

  const copyButton = page.locator('#gls-angular .copy-button');
  await expect(copyButton).toHaveAttribute('aria-label', 'Copia link a Angular');
  await copyButton.hover();
  await expect.poll(() => copyButton.evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    color: getComputedStyle(element).color,
  }))).toEqual({ background: 'rgb(251, 247, 238)', color: 'rgb(128, 98, 29)' });
  await copyButton.click();
  await expect(copyButton).toHaveAttribute('aria-label', 'Link copiato');
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toMatch(
    /\/glossario\.html#gls-angular$/,
  );

  await page.locator('.page-scroll').evaluate((element) => element.scrollTo(0, element.scrollHeight));
  const backToTop = page.getByRole('button', { name: "Torna all'inizio" });
  await expect(backToTop).toBeVisible();
  const box = await backToTop.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
  await backToTop.hover();
  await expect.poll(() => backToTop.evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    color: getComputedStyle(element).color,
  }))).toEqual({ background: 'rgb(255, 255, 255)', color: 'rgb(128, 98, 29)' });
  await backToTop.click();
  await expect.poll(() => page.locator('.page-scroll').evaluate((element) => element.scrollTop)).toBeLessThan(10);
});

test('shows loading and retry states without inactive clear controls', async ({ page }) => {
  await page.route('**/glossary.json', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.continue();
  });
  await page.goto('/glossario.html');
  await expect(page.locator('.skeleton-card').first()).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Cerca nel glossario' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Cancella ricerca' })).toHaveCount(0);
  await expect(page.locator('.entry-card').first()).toBeVisible();

  await page.unroute('**/glossary.json');
  await page.route('**/glossary.json', (route) => route.abort());
  await page.reload();
  await expect(page.getByText('Caricamento non riuscito.')).toBeVisible();
  await page.unroute('**/glossary.json');
  await page.getByRole('button', { name: 'Riprova' }).click();
  await expect(page.locator('.entry-card').first()).toBeVisible();
});

test('keeps the 375px layout within the viewport and targets at least 44px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/glossario.html');
  await expect(page.locator('.entry-card').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Filtra per iniziale' })).toBeVisible();

  const dimensions = await page.evaluate(() => {
    const visibleInteractive = [...document.querySelectorAll<HTMLElement>('a, button, input')].filter(
      (element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
      },
    );
    return {
      overflows: document.documentElement.scrollWidth > window.innerWidth,
      brandLines: document.querySelector('.brand-name')?.getClientRects().length ?? 0,
      headerBottom: document.querySelector('.site-header')?.getBoundingClientRect().bottom ?? 0,
      scrollerTop: document.querySelector('.page-scroll')?.getBoundingClientRect().top ?? 0,
      scrollerOverflow: getComputedStyle(document.querySelector<HTMLElement>('.page-scroll')!).overflowY,
      scrollerScrollable: document.querySelector<HTMLElement>('.page-scroll')!.scrollHeight >
        document.querySelector<HTMLElement>('.page-scroll')!.clientHeight,
      viewportScrollLocked: getComputedStyle(document.body).overflowY === 'hidden',
      windowScrollY: window.scrollY,
      undersized: visibleInteractive
        .map((element) => ({
          label: element.getAttribute('aria-label') || element.textContent?.trim() || element.tagName,
          width: element.getBoundingClientRect().width,
          height: element.getBoundingClientRect().height,
        }))
        .filter((item) => item.width < 44 || item.height < 44),
    };
  });

  const controlStyles = await page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>('#glossary-search');
    const icon = document.querySelector<SVGElement>('.search-field p-inputicon svg');
    const inputBox = input?.getBoundingClientRect();
    const iconBox = icon?.getBoundingClientRect();

    return {
      searchCenterDelta: inputBox && iconBox
        ? Math.abs((inputBox.top + inputBox.height / 2) - (iconBox.top + iconBox.height / 2))
        : null,
      wrongButtonCursors: [...document.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
        .filter((button) => getComputedStyle(button).cursor !== 'pointer')
        .map((button) => button.getAttribute('aria-label') || button.textContent?.trim()),
    };
  });

  expect(dimensions.overflows).toBe(false);
  expect(dimensions.brandLines).toBe(1);
  expect(Math.abs(dimensions.scrollerTop - dimensions.headerBottom)).toBeLessThanOrEqual(1);
  expect(dimensions.scrollerOverflow).toBe('auto');
  expect(dimensions.scrollerScrollable).toBe(true);
  expect(dimensions.viewportScrollLocked).toBe(true);
  expect(dimensions.windowScrollY).toBe(0);
  expect(dimensions.undersized).toEqual([]);
  expect(controlStyles.searchCenterDelta).not.toBeNull();
  expect(controlStyles.searchCenterDelta).toBeLessThanOrEqual(0.5);
  expect(controlStyles.wrongButtonCursors).toEqual([]);
});

test('keeps the tablet layout within 768px', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/glossario.html');
  await expect(page.locator('.entry-card').first()).toBeVisible();

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflows).toBe(false);
  await expect(page.locator('.brand-name')).toHaveText('aLittleByte');
  await expect(page.locator('.brand-context')).toHaveText('Glossario');
});

test('honours reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/glossario.html');
  await expect(page.locator('.entry-card').first()).toBeVisible();

  const motion = await page.evaluate(() => {
    const alphabetLink = document.querySelector<HTMLElement>('.alphabet-nav button');
    return {
      scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
      transitionDuration: alphabetLink ? getComputedStyle(alphabetLink).transitionDuration : '',
    };
  });
  expect(motion.scrollBehavior).toBe('auto');
  expect(Number.parseFloat(motion.transitionDuration)).toBeLessThanOrEqual(0.00001);
});
