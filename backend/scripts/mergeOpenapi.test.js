import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { Sequelize } from 'sequelize';
import fragments from '../openapi/index.js';
import { mergeOpenapi } from './mergeOpenapi.js';

const base = {
  openapi: '3.0.0',
  info: { title: 'test', version: '1.0.0' },
  paths: { '/health': { get: { responses: { 200: { description: 'ok' } } } } },
  components: { securitySchemes: { jwt: { type: 'http', scheme: 'bearer' } } },
};

describe('mergeOpenapi', () => {
  it('adds fragment paths, components and tags to the base document', () => {
    const merged = mergeOpenapi(base, [
      {
        tags: [{ name: 'things' }],
        paths: { '/things': { get: { responses: {} } } },
        components: { schemas: { Thing: { type: 'object' } } },
      },
      { paths: { '/things': { post: { responses: {} } } } },
    ]);

    expect(Object.keys(merged.paths)).toEqual(['/health', '/things']);
    expect(Object.keys(merged.paths['/things'])).toEqual(['get', 'post']);
    expect(merged.components.schemas.Thing).toEqual({ type: 'object' });
    expect(merged.components.securitySchemes).toEqual(base.components.securitySchemes);
    expect(merged.tags).toEqual([{ name: 'things' }]);
  });

  it('does not modify the base document', () => {
    const snapshot = structuredClone(base);
    mergeOpenapi(base, fragments);
    expect(base).toEqual(snapshot);
  });

  it('is idempotent', () => {
    const once = mergeOpenapi(base, fragments);
    expect(mergeOpenapi(once, fragments)).toEqual(once);
  });

  it('rejects an operation that is already defined differently', () => {
    const fragment = { paths: { '/health': { get: { responses: { 200: { description: 'different' } } } } } };
    expect(() => mergeOpenapi(base, [fragment])).toThrow('GET /health is defined twice');
  });

  it('rejects a component that is already defined differently', () => {
    const one = { components: { schemas: { Thing: { type: 'object' } } } };
    const other = { components: { schemas: { Thing: { type: 'string' } } } };
    expect(() => mergeOpenapi(base, [one, other])).toThrow('components.schemas.Thing is defined twice');
  });
});

// Every router that server.ts mounts, read from its import and app.use() lines so
// that a newly mounted router is checked without touching this test.
async function listMountedOperations() {
  const source = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  const files = new Map([...source.matchAll(/^import (\w+) from '(\.\/routes\/[^']+)';$/gm)].map((m) => [m[1], m[2]]));
  const mounts = [...source.matchAll(/^app\.use\('([^']+)', (\w+)\(sequelize\)\);/gm)];

  const sequelize = new Sequelize({ dialect: 'sqlite', logging: false });
  const operations = new Set();
  for (const [, mountPath, factoryName] of mounts) {
    const { default: factory } = await import(new URL(`../${files.get(factoryName)}`, import.meta.url).href);
    for (const layer of factory(sequelize).stack) {
      if (!layer.route) continue;
      const route = (mountPath + layer.route.path).replace(/\/$/, '').replace(/:(\w+)/g, '{$1}');
      for (const method of Object.keys(layer.route.methods)) {
        operations.add(`${method} ${route}`);
      }
    }
  }
  return [...operations].sort();
}

describe('OpenAPI fragments', () => {
  const spec = mergeOpenapi({ openapi: '3.0.0', info: base.info, paths: {} }, fragments);

  it('documents exactly the routes that server.ts mounts', async () => {
    // Routes that only exist with optional configuration are marked x-conditional.
    const documented = Object.entries(spec.paths)
      .flatMap(([route, operations]) =>
        Object.entries(operations)
          .filter(([, operation]) => !operation['x-conditional'])
          .map(([method]) => `${method} ${route}`)
      )
      .sort();

    const mounted = await listMountedOperations();
    expect(mounted.length).toBeGreaterThan(50);
    expect(documented).toEqual(mounted);
  });

  it('gives every operation a unique operationId', () => {
    const ids = Object.values(spec.paths).flatMap((operations) => Object.values(operations).map((o) => o.operationId));
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('declares every path parameter of an operation', () => {
    for (const [route, operations] of Object.entries(spec.paths)) {
      const expected = [...route.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
      for (const [method, operation] of Object.entries(operations)) {
        const declared = (operation.parameters ?? [])
          .filter((parameter) => parameter.in === 'path')
          .map((parameter) => parameter.name)
          .sort();
        expect(declared, `${method.toUpperCase()} ${route}`).toEqual(expected);
      }
    }
  });

  it('only references components that exist', () => {
    const refs = JSON.stringify(spec).matchAll(/"\$ref":"#\/components\/(\w+)\/(\w+)"/g);
    for (const [ref, section, name] of refs) {
      expect(spec.components[section]?.[name], ref).toBeDefined();
    }
  });
});
