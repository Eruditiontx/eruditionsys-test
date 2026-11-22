// Merges the hand-written OpenAPI fragments in backend/openapi/ into the spec
// that `tsoa spec-and-routes` generates (public/swagger.json).
//
// tsoa only sees the classes in controllers/. The Express routers in routes/
// are described by the fragments instead, and this script adds them to the
// generated document so /api-docs covers the whole API.
//
// Usage: node scripts/mergeOpenapi.js [path/to/swagger.json]

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

/**
 * Copy every entry of `source` into `target`. An entry that already exists is
 * accepted only when it is identical, which keeps the merge idempotent while
 * still catching two definitions of the same thing.
 */
function mergeEntries(target, source, describe) {
  for (const [key, value] of Object.entries(source)) {
    if (key in target && !isDeepStrictEqual(target[key], value)) {
      throw new Error(`OpenAPI merge conflict: ${describe(key)} is defined twice`);
    }
    target[key] = value;
  }
}

/**
 * Merge OpenAPI fragments into a base document and return the result.
 * The base document is not modified.
 *
 * A fragment may contain `tags`, `paths` and `components`.
 */
export function mergeOpenapi(base, fragments) {
  const doc = structuredClone(base);
  doc.paths ??= {};
  doc.components ??= {};
  doc.tags ??= [];

  for (const fragment of fragments) {
    for (const tag of fragment.tags ?? []) {
      const existing = doc.tags.find((entry) => entry.name === tag.name);
      if (!existing) {
        doc.tags.push(tag);
      } else if (!isDeepStrictEqual(existing, tag)) {
        throw new Error(`OpenAPI merge conflict: tag "${tag.name}" is defined twice`);
      }
    }

    for (const [route, operations] of Object.entries(fragment.paths ?? {})) {
      doc.paths[route] ??= {};
      mergeEntries(doc.paths[route], operations, (method) => `${method.toUpperCase()} ${route}`);
    }

    for (const [section, entries] of Object.entries(fragment.components ?? {})) {
      doc.components[section] ??= {};
      mergeEntries(doc.components[section], entries, (name) => `components.${section}.${name}`);
    }
  }

  if (doc.tags.length === 0) {
    delete doc.tags;
  }
  return doc;
}

async function main() {
  const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const specPath = path.resolve(process.argv[2] ?? path.join(backendDir, 'public/swagger.json'));

  const { default: fragments } = await import('../openapi/index.js');
  const base = JSON.parse(readFileSync(specPath, 'utf8'));
  const merged = mergeOpenapi(base, fragments);
  writeFileSync(specPath, JSON.stringify(merged, null, '\t') + '\n');

  const count = Object.values(merged.paths).reduce((sum, operations) => sum + Object.keys(operations).length, 0);
  console.log(`Merged ${fragments.length} OpenAPI fragments into ${specPath} (${count} operations)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
