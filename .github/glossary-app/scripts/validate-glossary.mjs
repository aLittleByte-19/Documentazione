import { readFile } from 'node:fs/promises';

const glossaryPath = new URL('../../site-src/glossary.json', import.meta.url);
const glossary = JSON.parse(await readFile(glossaryPath, 'utf8'));

assert(isRecord(glossary), 'La radice deve essere un oggetto JSON.');
assert(nonEmptyString(glossary.title), 'title deve essere una stringa non vuota.');
assert(Array.isArray(glossary.entries), 'entries deve essere un array.');
assert(
  Object.keys(glossary).every((key) => ['title', 'entries'].includes(key)),
  'Il JSON pubblico deve contenere soltanto title ed entries.',
);

const ids = new Set();
const collator = new Intl.Collator('it', { sensitivity: 'base' });
for (const [index, entry] of glossary.entries.entries()) {
  const label = `entries[${index}]`;
  assert(isRecord(entry), `${label} deve essere un oggetto.`);
  assert(
    Object.keys(entry).sort().join(',') === 'aliases,definition,id,term',
    `${label} deve contenere esattamente id, term, definition e aliases.`,
  );
  assert(nonEmptyString(entry.id), `${label}.id deve essere una stringa non vuota.`);
  assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id), `${label}.id non è valido.`);
  assert(!ids.has(entry.id), `${label}.id è duplicato: ${entry.id}.`);
  ids.add(entry.id);
  assert(nonEmptyString(entry.term), `${label}.term deve essere una stringa non vuota.`);
  assert(
    nonEmptyString(entry.definition),
    `${label}.definition deve essere una stringa non vuota.`,
  );
  assert(Array.isArray(entry.aliases), `${label}.aliases deve essere un array.`);
  assert(entry.aliases.every(nonEmptyString), `${label}.aliases contiene un valore non valido.`);
  assert(
    new Set(entry.aliases.map((alias) => alias.toLocaleLowerCase('it'))).size ===
      entry.aliases.length,
    `${label}.aliases contiene duplicati.`,
  );

  if (index > 0) {
    const previous = glossary.entries[index - 1];
    assert(
      collator.compare(previous.term, entry.term) <= 0,
      `Le voci non sono ordinate: ${previous.term} precede ${entry.term}.`,
    );
  }
}

console.log(`Contratto glossary.json valido: ${glossary.entries.length} voci, ${ids.size} ID univoci.`);

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
