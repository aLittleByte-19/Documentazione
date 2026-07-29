import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { GlossaryEntry, GlossaryGroup } from './glossary.models';
import { GlossaryService } from './glossary.service';

type LoadState = 'loading' | 'ready' | 'error';
type SearchScope = 'all' | 'term' | 'aliases' | 'definition';

interface FilterOption<T extends string> {
  label: string;
  value: T;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    SkeletonModule,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly glossaryService = inject(GlossaryService);
  private readonly feedbackDuration = 2200;
  private copyFeedbackTimer: number | undefined;

  readonly alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  readonly scopeOptions: FilterOption<SearchScope>[] = [
    { label: 'Tutti i campi', value: 'all' },
    { label: 'Solo termini', value: 'term' },
    { label: 'Solo alias', value: 'aliases' },
    { label: 'Solo definizioni', value: 'definition' },
  ];
  readonly state = signal<LoadState>('loading');
  readonly title = signal('Glossario');
  readonly entries = signal<GlossaryEntry[]>([]);
  readonly query = signal('');
  readonly searchScope = signal<SearchScope>('all');
  readonly letterFilter = signal('');
  readonly filtersOpen = signal(false);
  readonly errorMessage = signal('');
  readonly fragmentFeedback = signal('');
  readonly activeFragment = signal('');
  readonly copiedEntryId = signal('');
  readonly copyAnnouncement = signal('');
  readonly showBackToTop = signal(false);

  readonly totalCount = computed(() => this.entries().length);
  readonly availableLetters = computed(
    () => new Set(this.groupEntries(this.entries()).map((group) => group.letter)),
  );
  readonly filteredEntries = computed(() => {
    const tokens = this.normalize(this.query()).split(/\s+/).filter(Boolean);
    const scope = this.searchScope();
    const letter = this.letterFilter();

    return [...this.entries()]
      .filter((entry) => !letter || this.getEntryLetter(entry) === letter)
      .filter((entry) => this.matchesTokens(entry, tokens, scope))
      .sort((left, right) => this.compareEntries(left, right));
  });
  readonly visibleCount = computed(() => this.filteredEntries().length);
  readonly visibleGroups = computed(() => this.groupEntries(this.filteredEntries()));
  readonly hasActiveFilters = computed(
    () =>
      Boolean(this.query().trim()) ||
      Boolean(this.letterFilter()) ||
      this.searchScope() !== 'all',
  );
  readonly searchPlaceholder = computed(() => {
    switch (this.searchScope()) {
      case 'term':
        return 'Cerca tra i termini';
      case 'aliases':
        return 'Cerca tra gli alias';
      case 'definition':
        return 'Cerca nelle definizioni';
      default:
        return 'Cerca termine, alias o definizione';
    }
  });
  readonly countLabel = computed(() => {
    const total = this.totalCount();
    const visible = this.visibleCount();
    if (!this.hasActiveFilters()) {
      return `${total} ${total === 1 ? 'voce' : 'voci'}`;
    }
    return `${visible} di ${total} ${total === 1 ? 'voce' : 'voci'}`;
  });

  ngOnInit(): void {
    window.name = 'glossario';
    this.loadGlossary();
  }

  ngOnDestroy(): void {
    if (this.copyFeedbackTimer !== undefined) {
      window.clearTimeout(this.copyFeedbackTimer);
    }
  }

  @HostListener('window:hashchange')
  onHashChange(): void {
    if (this.state() === 'ready') {
      this.resolveCurrentFragment(true);
    }
  }

  onPageScroll(event: Event): void {
    this.showBackToTop.set((event.currentTarget as HTMLElement).scrollTop > 480);
  }

  @HostListener('document:click')
  closeFilters(): void {
    this.filtersOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  closeFiltersWithKeyboard(): void {
    if (this.filtersOpen()) {
      this.filtersOpen.set(false);
      document.querySelector<HTMLButtonElement>('.filter-toggle')?.focus();
    }
  }

  loadGlossary(): void {
    this.state.set('loading');
    this.errorMessage.set('');
    this.fragmentFeedback.set('');

    this.glossaryService.load().subscribe({
      next: (glossary) => {
        this.title.set(glossary.title);
        this.entries.set(glossary.entries);
        this.state.set('ready');
        window.setTimeout(() => this.resolveCurrentFragment(false));
      },
      error: (error: unknown) => {
        this.entries.set([]);
        this.errorMessage.set(this.describeLoadError(error));
        this.state.set('error');
      },
    });
  }

  updateQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.clearFragmentState();
  }

  updateSearchScope(event: Event): void {
    this.searchScope.set((event.target as HTMLSelectElement).value as SearchScope);
    this.clearFragmentState();
  }

  toggleFilters(event: MouseEvent): void {
    event.stopPropagation();
    this.filtersOpen.update((isOpen) => !isOpen);
  }

  keepFiltersOpen(event: MouseEvent): void {
    event.stopPropagation();
  }

  clearSearch(searchInput: HTMLInputElement): void {
    this.query.set('');
    searchInput.focus();
  }

  resetFilters(searchInput: HTMLInputElement): void {
    this.query.set('');
    this.searchScope.set('all');
    this.letterFilter.set('');
    this.filtersOpen.set(false);
    this.clearFragmentState();
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    searchInput.focus();
  }

  filterByLetter(letter: string): void {
    this.letterFilter.set(letter);
    this.clearFragmentState();
    const location = letter
      ? `${window.location.pathname}${window.location.search}#letter-${letter}`
      : `${window.location.pathname}${window.location.search}`;
    history.replaceState(null, '', location);
  }

  async copyEntryLink(entry: GlossaryEntry): Promise<void> {
    const fragment = `gls-${entry.id}`;
    const url = `${window.location.href.split('#')[0]}#${fragment}`;

    try {
      await navigator.clipboard.writeText(url);
      this.copiedEntryId.set(entry.id);
      this.copyAnnouncement.set(`Link a ${entry.term} copiato negli appunti.`);
      if (this.copyFeedbackTimer !== undefined) {
        window.clearTimeout(this.copyFeedbackTimer);
      }
      this.copyFeedbackTimer = window.setTimeout(() => {
        this.copiedEntryId.set('');
        this.copyAnnouncement.set('');
      }, this.feedbackDuration);
    } catch {
      this.copyAnnouncement.set('Copia non disponibile: il link è stato aperto nella pagina.');
      this.navigateToFragment(fragment, true);
    }
  }

  dismissFragmentFeedback(): void {
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    this.fragmentFeedback.set('');
    this.activeFragment.set('');
  }

  scrollToTop(): void {
    document.querySelector<HTMLElement>('.page-scroll')?.scrollTo({
      top: 0,
      behavior: this.prefersReducedMotion() ? 'auto' : 'smooth',
    });
    document.querySelector<HTMLElement>('.brand-link')?.focus({ preventScroll: true });
  }

  private matchesTokens(entry: GlossaryEntry, tokens: string[], scope: SearchScope): boolean {
    if (tokens.length === 0) {
      return true;
    }

    const fields =
      scope === 'term'
        ? [entry.term]
        : scope === 'aliases'
          ? entry.aliases
          : scope === 'definition'
            ? [entry.definition]
            : [entry.term, entry.definition, entry.id, ...entry.aliases];
    const normalizedFields = fields.map((field) => this.normalize(field));
    return tokens.every((token) => normalizedFields.some((field) => field.includes(token)));
  }

  private compareEntries(left: GlossaryEntry, right: GlossaryEntry): number {
    return left.term.localeCompare(right.term, 'it', { sensitivity: 'base' });
  }

  private getEntryLetter(entry: GlossaryEntry): string {
    const firstCharacter = entry.term.trim().charAt(0).toLocaleUpperCase('it');
    return /^[A-Z]$/.test(firstCharacter) ? firstCharacter : '#';
  }

  private groupEntries(entries: GlossaryEntry[]): GlossaryGroup[] {
    const groups = new Map<string, GlossaryEntry[]>();
    for (const entry of entries) {
      const letter = this.getEntryLetter(entry);
      groups.set(letter, [...(groups.get(letter) ?? []), entry]);
    }
    return [...groups].map(([letter, groupedEntries]) => ({ letter, entries: groupedEntries }));
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('it')
      .trim();
  }

  private resolveCurrentFragment(announceMissing: boolean): void {
    const fragment = this.readFragment();
    if (!fragment) {
      this.clearFragmentState();
      return;
    }

    const validEntry = fragment.startsWith('gls-')
      ? this.entries().some((entry) => `gls-${entry.id}` === fragment)
      : false;
    const requestedLetter = fragment.startsWith('letter-') ? fragment.slice('letter-'.length) : '';
    const validLetter = Boolean(requestedLetter && this.availableLetters().has(requestedLetter));

    if (!validEntry && !validLetter) {
      this.activeFragment.set('');
      this.fragmentFeedback.set(
        announceMissing
          ? 'La destinazione richiesta non esiste più nel glossario.'
          : 'La voce collegata non è presente nel glossario corrente.',
      );
      return;
    }

    if (validEntry) {
      this.query.set('');
      this.letterFilter.set('');
    } else {
      this.letterFilter.set(requestedLetter);
    }
    this.fragmentFeedback.set('');
    this.navigateToFragment(fragment, validEntry);
  }

  private navigateToFragment(fragment: string, focusTarget: boolean): void {
    if (window.location.hash !== `#${fragment}`) {
      history.pushState(null, '', `#${encodeURIComponent(fragment)}`);
    }
    this.activeFragment.set(fragment);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const target = document.getElementById(fragment);
        if (!target) {
          this.fragmentFeedback.set('La destinazione richiesta non è disponibile.');
          this.activeFragment.set('');
          return;
        }
        target.scrollIntoView({
          behavior: this.prefersReducedMotion() ? 'auto' : 'smooth',
          block: 'start',
        });
        if (focusTarget) {
          target.focus({ preventScroll: true });
        }
      });
    });
  }

  private clearFragmentState(): void {
    this.fragmentFeedback.set('');
    this.activeFragment.set('');
  }

  private readFragment(): string {
    if (!window.location.hash) {
      return '';
    }
    try {
      return decodeURIComponent(window.location.hash.slice(1));
    } catch {
      return '';
    }
  }

  private prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private describeLoadError(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 404) {
      return 'Il file glossary.json non è stato trovato.';
    }
    if (error instanceof Error && error.message) {
      return `I dati del glossario non sono validi: ${error.message}`;
    }
    return 'Non è stato possibile caricare il glossario.';
  }
}
