import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceDirectory = new URL('../../site-src/', import.meta.url);
const publicDirectory = new URL('../public/', import.meta.url);
const sourceGlossary = new URL('glossary.json', sourceDirectory);
const publicGlossary = new URL('glossary.json', publicDirectory);

await rm(publicDirectory, { recursive: true, force: true });
await mkdir(publicDirectory, { recursive: true });
await writeFile(publicGlossary, await readFile(sourceGlossary));
await cp(new URL('assets/', sourceDirectory), new URL('assets/', publicDirectory), {
  recursive: true,
});

console.log(`Asset preparati per ${workspaceDirectory}`);
