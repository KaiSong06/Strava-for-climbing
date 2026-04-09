/**
 * Generate `docs/openapi.json` from the Zod-backed registry in
 * `src/lib/openapi.ts`.
 *
 * Run via: `npm run docs:openapi` (from the api/ directory).
 *
 * Writes the pretty-printed OpenAPI 3.1 document to the repo root at
 * ../docs/openapi.json. Safe to run repeatedly.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildOpenApiDocument } from '../src/lib/openapi';

function main(): void {
  const doc = buildOpenApiDocument();
  const outPath = resolve(__dirname, '../../docs/openapi.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  // eslint-disable-next-line no-console
  process.stdout.write(`openapi spec written to ${outPath}\n`);
}

main();
