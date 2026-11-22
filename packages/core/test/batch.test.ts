// Several writes in one $batch request (JSON format), and the fallback to single requests.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildModel, ConcurrencyError, ODataError, ODataV4Provider, RolledBackError, writeAll, type BatchOperation, type DataProvider, type FetchLike } from '../src';

const model = buildModel(readFileSync(join(import.meta.dirname, 'fixtures/shop.xml'), 'utf8'));
const response = (status: number, body: unknown) => ({ ok: status < 400, status, statusText: '', headers: { get: () => null }, text: async () => JSON.stringify(body) });

const OPS: BatchOperation[] = [
  { kind: 'update', path: 'Products(1)', patch: { Name: 'a' }, etag: 'W/"1"' },
  { kind: 'create', target: { entitySet: 'Products' }, row: { Name: 'b' } },
  { kind: 'remove', path: 'Products(2)', etag: 'W/"2"' },
  { kind: 'invoke', action: 'Shop.release', path: 'Products(3)', parameters: { Note: 'x' } },
];

describe('ODataV4Provider.batch', () => {
  it('is there only when the service is said to answer $batch', () => {
    const fetch: FetchLike = async () => response(200, {});
    expect(new ODataV4Provider({ serviceUrl: '/odata/', model, fetch }).batch).toBeUndefined();
    expect(new ODataV4Provider({ serviceUrl: '/odata/', model, fetch, batch: 'json' }).batch).toBeTypeOf('function');
  });

  it('sends the operations as one JSON batch and maps each response back', async () => {
    const sent: { url: string; body: any; headers: Record<string, string> }[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
    const fetch: FetchLike = async (url, init) => {
      sent.push({ url, body: JSON.parse(init!.body!), headers: init!.headers! });
      return response(200, {
        responses: [
          { id: '1', status: 200, headers: { etag: 'W/"9"', 'sap-messages': JSON.stringify([{ code: 'W1', message: 'careful', numericSeverity: 3 }]) }, body: { ID: 1, Name: 'a' } },
          { id: '2', status: 201, headers: {}, body: { ID: 31, Name: 'b', '@odata.etag': 'W/"1"' } },
          { id: '3', status: 204, headers: {} },
          { id: '4', status: 412, headers: {}, body: { error: { code: 'PreconditionFailed', message: 'stale' } } },
        ],
      });
    };
    const provider = new ODataV4Provider({ serviceUrl: '/odata/', model, fetch, batch: 'json', headers: () => ({ 'X-CSRF': 't' }) });
    const r = await provider.batch!(OPS);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.url).toBe('/odata/$batch');
    expect(sent[0]!.headers).toMatchObject({ 'Content-Type': 'application/json', Prefer: 'continue-on-error', 'X-CSRF': 't' });
    expect(sent[0]!.body.requests.map((x: { id: string; method: string; url: string; atomicityGroup?: string }) => [x.id, x.method, x.url, x.atomicityGroup])).toEqual([
      ['1', 'PATCH', 'Products(1)', undefined],
      ['2', 'POST', 'Products', undefined],
      ['3', 'DELETE', 'Products(2)', undefined],
      ['4', 'POST', 'Products(3)/Shop.release', undefined],
    ]);
    expect(sent[0]!.body.requests[0].headers['If-Match']).toBe('W/"1"');
    expect(sent[0]!.body.requests[3].body).toEqual({ Note: 'x' });
    expect(r[0]).toMatchObject({ ok: true, row: { ID: 1 }, etag: 'W/"9"', messages: [{ type: 'warning', code: 'W1' }] });
    expect(r[1]).toMatchObject({ ok: true, path: 'Products(31)', etag: 'W/"1"' });
    expect(r[2]).toMatchObject({ ok: true });
    expect(r[3]!.ok).toBe(false);
    expect((r[3] as { error: unknown }).error).toBeInstanceOf(ConcurrencyError);
  });

  it('atomic: one change set; the operation that failed carries the error, the others were rolled back', async () => {
    let groups: unknown[] = [];
    const fetch: FetchLike = async (_url, init) => {
      groups = JSON.parse(init!.body!).requests.map((x: { atomicityGroup?: string }) => x.atomicityGroup);
      return response(200, { responses: [{ id: '2', atomicityGroup: 'g1', status: 400, body: { error: { code: 'VALIDATION_FAILED', message: 'no', details: [{ code: 'MANDATORY', message: 'Name is mandatory', target: 'Name' }] } } }] });
    };
    const r = await new ODataV4Provider({ serviceUrl: '/odata/', model, fetch, batch: 'json' }).batch!(OPS.slice(0, 3), { atomic: true });
    expect(groups).toEqual(['g1', 'g1', 'g1']);
    expect(r.map((x) => x.ok)).toEqual([false, false, false]);
    const errors = r.map((x) => (x as { error: unknown }).error);
    expect(errors[0]).toBeInstanceOf(RolledBackError);
    expect(errors[1]).toBeInstanceOf(ODataError);
    expect((errors[1] as ODataError).details[0]).toMatchObject({ code: 'MANDATORY', target: 'Name' });
    expect(errors[2]).toBeInstanceOf(RolledBackError);
  });
});

describe('writeAll', () => {
  const calls: string[] = [];
  const plain: DataProvider = {
    query: async () => ({ rows: [] }),
    read: async () => ({}),
    update: async (path) => { calls.push(`update ${path}`); if (path === 'Products(1)') throw new ODataError({ status: 400, message: 'bad' }); return { row: {} }; },
    create: async () => { calls.push('create'); return { row: { ID: 5 }, path: 'Products(5)' }; },
    remove: async (path) => { calls.push(`remove ${path}`); return {}; },
    invoke: async (action, o) => { calls.push(`invoke ${action} ${o?.path}`); return { row: { ID: 3 } }; },
  };

  it('without $batch: one request after another, each with its own outcome', async () => {
    calls.length = 0;
    const r = await writeAll(plain, OPS);
    expect(calls).toEqual(['update Products(1)', 'create', 'remove Products(2)', 'invoke Shop.release Products(3)']);
    expect(r.map((x) => x.ok)).toEqual([false, true, true, true]);
    expect(r[1]).toMatchObject({ path: 'Products(5)' });
  });

  it('without $batch, atomic: stops at the first failure', async () => {
    calls.length = 0;
    const r = await writeAll(plain, OPS, { atomic: true });
    expect(calls).toEqual(['update Products(1)']);
    expect(r.map((x) => x.ok)).toEqual([false, false, false, false]);
  });

  it('with $batch: one request for several operations, the plain request for one; a failed batch fails them all', async () => {
    calls.length = 0;
    const batched: DataProvider = { ...plain, batch: async (ops) => { calls.push(`batch ${ops.length}`); return ops.map(() => ({ ok: true as const })); } };
    expect((await writeAll(batched, OPS)).every((x) => x.ok)).toBe(true);
    await writeAll(batched, OPS.slice(2, 3));
    expect(calls).toEqual(['batch 4', 'remove Products(2)']);
    const broken: DataProvider = { ...plain, batch: async () => { throw new ODataError({ status: 503, message: 'down' }); } };
    expect((await writeAll(broken, OPS)).map((x) => x.ok)).toEqual([false, false, false, false]);
    expect(await writeAll(broken, [])).toEqual([]);
  });
});
