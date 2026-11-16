/**
 * Edit strategies (ADR-018): direct save (PATCH + ETag, POST) and draft (Common.DraftRoot actions).
 * See docs/05-data-provider.md §6.
 */
import type { DataProvider } from '../data/provider';
import type { Message } from '../data/messages';
import type { MetaModel } from '../model/types';
import { keyPredicate, resolveEntityPath, type EntityPath } from '../query/entityPath';
import { sourceInfo, type QuerySource, type Row } from '../query/request';

export interface EditSession {
  /** Path of the instance being edited: the draft instance for drafts, the entity itself otherwise. */
  readonly path: EntityPath;
  readonly draft: boolean;
  /** A new object (create mode). */
  readonly isNew: boolean;
  /** Working copy. */
  readonly values: Row;
  /** Properties changed since the session started. */
  readonly changed: ReadonlySet<string>;
  set(property: string, value: unknown): void;
  /** Draft: sends the pending changes to the draft (background save). Direct save: nothing to do. */
  flush(): Promise<{ messages: Message[] }>;
  /** Saves (direct) or activates (draft); returns the active entity and its path. Throws ConcurrencyError on stale ETags. */
  save(): Promise<{ row: Row; etag?: string; path: EntityPath; messages: Message[] }>;
  /** Discards the changes (and the draft). */
  cancel(): Promise<void>;
}

export interface EditStrategy {
  readonly kind: 'direct' | 'draft' | (string & {});
  /** Starts editing an existing entity; `current` is its last read state. */
  begin(path: EntityPath, current: Row): Promise<EditSession>;
  /** Starts creating a new entity in an entity set or a collection navigation. */
  create(target: QuerySource, initial?: Row): Promise<EditSession>;
}

const isData = (k: string, v: unknown) => !k.startsWith('@') && (v === null || typeof v !== 'object');

function requireWrite(provider: DataProvider): Required<DataProvider> {
  if (!provider.update || !provider.create || !provider.remove || !provider.invoke) throw new Error('The data provider cannot write');
  return provider as Required<DataProvider>;
}

/** Direct save: PATCH with If-Match for existing entities, POST for new ones. */
export class DirectEditStrategy implements EditStrategy {
  readonly kind = 'direct';
  constructor(private readonly provider: DataProvider) {}

  async begin(path: EntityPath, current: Row): Promise<EditSession> {
    const p = requireWrite(this.provider);
    let etag = current['@odata.etag'] as string | undefined;
    const values: Row = Object.fromEntries(Object.entries(current).filter(([k, v]) => isData(k, v)));
    const changed = new Set<string>();
    return {
      path, draft: false, isNew: false, values, changed,
      set(property, value) { values[property] = value; changed.add(property); },
      async flush() { return { messages: [] }; },
      async save() {
        const patch = Object.fromEntries([...changed].map((k) => [k, values[k]]));
        const r = await p.update(path, patch, { etag });
        etag = r.etag;
        changed.clear();
        return { row: r.row, etag: r.etag, path, messages: r.messages ?? [] };
      },
      async cancel() { changed.clear(); },
    };
  }

  async create(target: QuerySource, initial: Row = {}): Promise<EditSession> {
    const p = requireWrite(this.provider);
    const values: Row = { ...initial };
    const changed = new Set<string>(Object.keys(initial));
    let created: EntityPath | undefined;
    return {
      get path() { return created ?? ''; },
      draft: false, isNew: true, values, changed,
      set(property, value) { values[property] = value; changed.add(property); },
      async flush() { return { messages: [] }; },
      async save() {
        const body = Object.fromEntries([...changed].filter((k) => values[k] !== undefined && values[k] !== '').map((k) => [k, values[k]]));
        const r = await p.create(target, body);
        created = r.path;
        changed.clear();
        return { row: r.row, etag: r.etag, path: r.path, messages: r.messages ?? [] };
      },
      async cancel() { changed.clear(); },
    };
  }
}

/** Path of the draft (IsActiveEntity=false) or active (true) instance with the same key. */
export function siblingPath(model: MetaModel, path: EntityPath, active: boolean): EntityPath {
  const r = resolveEntityPath(model, path);
  const type = model.entityTypes[r.typeName]!;
  if (!type.keys.includes('IsActiveEntity')) return path;
  return `${r.entitySet}${keyPredicate(type, { ...r.key, IsActiveEntity: active })}`;
}

/** Whether a row is a draft instance. */
export const isDraftRow = (row: Row | undefined) => row?.IsActiveEntity === false || row?.IsActiveEntity === 'false';

/**
 * Draft: begin = EditAction (or resume the user's own draft), changes are PATCHed to the draft instance (flush),
 * save = PreparationAction + ActivationAction, cancel = DELETE of the draft.
 */
export class DraftEditStrategy implements EditStrategy {
  readonly kind = 'draft';
  constructor(private readonly model: MetaModel, private readonly provider: DataProvider) {}

  private draftOf(path: EntityPath) {
    const r = resolveEntityPath(this.model, path);
    const root = this.model.entitySets[r.entitySet]?.draft;
    if (!root) throw new Error(`Entity set ${r.entitySet} is not draft-enabled`);
    return root;
  }

  private session(draftPath: EntityPath, row: Row, isNew: boolean): EditSession {
    const p = requireWrite(this.provider);
    const model = this.model;
    const draft = this.draftOf(draftPath);
    const values: Row = Object.fromEntries(Object.entries(row).filter(([k, v]) => isData(k, v)));
    const changed = new Set<string>();
    let pending = new Set<string>();
    let flushing: Promise<{ messages: Message[] }> | undefined;
    const flush = async (): Promise<{ messages: Message[] }> => {
      await flushing;
      if (!pending.size) return { messages: [] };
      const props = pending;
      pending = new Set();
      flushing = p.update(draftPath, Object.fromEntries([...props].map((k) => [k, values[k]])), {}).then((r) => ({ messages: r.messages ?? [] }));
      try {
        return await flushing;
      } catch (e) {
        for (const k of props) pending.add(k);
        throw e;
      } finally {
        flushing = undefined;
      }
    };
    return {
      path: draftPath, draft: true, isNew, values, changed,
      set(property, value) { values[property] = value; changed.add(property); pending.add(property); },
      flush,
      async save() {
        const flushed = await flush();
        const messages = [...flushed.messages];
        if (draft.preparationAction) {
          const prep = await p.invoke(draft.preparationAction, { path: draftPath, parameters: { SideEffectsQualifier: '' } });
          messages.push(...(prep.messages ?? []));
        }
        if (!draft.activationAction) throw new Error('The draft root has no ActivationAction');
        const r = await p.invoke(draft.activationAction, { path: draftPath });
        const active = r.row ?? {};
        const activePath = siblingPath(model, draftPath, true);
        changed.clear();
        return { row: active, etag: active['@odata.etag'] as string | undefined, path: activePath, messages: [...messages, ...(r.messages ?? [])] };
      },
      async cancel() {
        await flushing?.catch(() => undefined);
        await p.remove(draftPath);
        changed.clear();
        pending.clear();
      },
    };
  }

  async begin(path: EntityPath, current: Row): Promise<EditSession> {
    const p = requireWrite(this.provider);
    const draft = this.draftOf(path);
    if (isDraftRow(current)) return this.session(path, current, false);
    if (!draft.editAction) throw new Error('The draft root has no EditAction');
    const r = await p.invoke(draft.editAction, { path: siblingPath(this.model, path, true), parameters: { PreserveChanges: true } });
    const row = r.row ?? {};
    return this.session(siblingPath(this.model, path, false), row, false);
  }

  async create(target: QuerySource, initial: Row = {}): Promise<EditSession> {
    const p = requireWrite(this.provider);
    const r = await p.create(target, initial);
    const info = sourceInfo(this.model, target);
    const path = `${info.entitySet}${keyPredicate(this.model.entityTypes[info.typeName]!, r.row)}`;
    return this.session(path, r.row, true);
  }
}

/** The strategy for an entity set: draft when it is draft-enabled, direct save otherwise (ADR-018). */
export function editStrategyFor(model: MetaModel, entitySet: string, provider: DataProvider): EditStrategy {
  return model.entitySets[entitySet]?.draft ? new DraftEditStrategy(model, provider) : new DirectEditStrategy(provider);
}
