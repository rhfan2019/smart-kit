/**
 * Stage 1.5 validation of the edit seam (docs/05-data-provider.md §6): a direct-save strategy on top of the
 * EditStrategy interface and WriteDataProvider. Not part of any published package (v5 §6.4).
 */
import { ConcurrencyError, type DataProvider, type EditSession, type EditStrategy, type EntityPath, type Row } from '../../packages/core/src';

export class DirectEditStrategy implements EditStrategy {
  readonly kind = 'direct';
  constructor(private readonly provider: DataProvider) {}

  async begin(path: EntityPath, current: Row): Promise<EditSession> {
    const provider = this.provider;
    if (!provider.update) throw new Error('The data provider cannot write');
    let etag = current['@odata.etag'] as string | undefined;
    const original = { ...current };
    const values: Row = { ...current };
    return {
      path,
      values,
      set(property, value) {
        values[property] = value;
      },
      async save() {
        const patch = Object.fromEntries(Object.entries(values).filter(([k, v]) => !k.startsWith('@') && v !== original[k]));
        const result = await provider.update!(path, patch, { etag });
        etag = result.etag;
        Object.assign(original, values);
        return result;
      },
      async cancel() {
        Object.assign(values, original);
      },
    };
  }
}

export { ConcurrencyError };
