import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { GlossaryDocument, GlossaryEntry } from './glossary.models';

@Injectable({ providedIn: 'root' })
export class GlossaryService {
  private readonly http = inject(HttpClient);
  private readonly collator = new Intl.Collator('it', { sensitivity: 'base' });

  load(): Observable<GlossaryDocument> {
    return this.http.get<unknown>('glossary.json').pipe(map((value) => this.validate(value)));
  }

  private validate(value: unknown): GlossaryDocument {
    if (!this.isRecord(value) || typeof value['title'] !== 'string' || !value['title'].trim()) {
      throw new Error('Il glossario non contiene un titolo valido.');
    }

    if (!Array.isArray(value['entries'])) {
      throw new Error('Il glossario non contiene un elenco di voci valido.');
    }

    const ids = new Set<string>();
    const entries = value['entries'].map((entry, index) => this.validateEntry(entry, index, ids));
    entries.sort((left, right) => this.collator.compare(left.term, right.term));

    return { title: value['title'].trim(), entries };
  }

  private validateEntry(value: unknown, index: number, ids: Set<string>): GlossaryEntry {
    if (!this.isRecord(value)) {
      throw new Error(`La voce ${index + 1} non è un oggetto valido.`);
    }

    const id = this.requiredString(value['id'], `ID della voce ${index + 1}`);
    const term = this.requiredString(value['term'], `termine della voce ${index + 1}`);
    const definition = this.requiredString(
      value['definition'],
      `definizione della voce ${index + 1}`,
    );

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
      throw new Error(`L'ID "${id}" non è valido.`);
    }

    if (ids.has(id)) {
      throw new Error(`L'ID "${id}" è duplicato.`);
    }
    ids.add(id);

    if (!Array.isArray(value['aliases'])) {
      throw new Error(`Gli alias della voce "${term}" non sono validi.`);
    }

    const aliases = value['aliases'].map((alias, aliasIndex) =>
      this.requiredString(alias, `alias ${aliasIndex + 1} della voce "${term}"`),
    );

    if (new Set(aliases).size !== aliases.length) {
      throw new Error(`La voce "${term}" contiene alias duplicati.`);
    }

    return { id, term, definition, aliases };
  }

  private requiredString(value: unknown, label: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`${label} non valido.`);
    }
    return value.trim();
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
