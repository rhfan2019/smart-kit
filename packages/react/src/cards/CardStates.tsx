/** Loading placeholder, "no items" and error states of card contents (each card shows its own, CD-11). */
import { useText } from '../context/SmartKitProvider';

/** Loading placeholder: grey bars in the shape of the content (SAPUI5 card content placeholders). */
export function CardPlaceholder({ kind, rows }: { kind: 'list' | 'table' | 'object' | 'timeline' | 'analytical' | 'calendar'; rows: number }) {
  const t = useText();
  const items = Array.from({ length: Math.max(1, rows) }, (_, i) => i);
  return (
    <div className={`sk-card__placeholder sk-card__placeholder--${kind}`} role="progressbar" aria-busy="true" aria-label={t('table.loading')}>
      {kind === 'analytical' ? (
        <div className="sk-card__ph-chart" />
      ) : (
        items.map((i) => (
          <div key={i} className="sk-card__ph-row">
            {(kind === 'timeline' || kind === 'list') && <span className="sk-card__ph-icon" />}
            <span className="sk-card__ph-lines">
              <span className="sk-card__ph-bar" />
              <span className="sk-card__ph-bar sk-card__ph-bar--short" />
            </span>
          </div>
        ))
      )}
    </div>
  );
}

export function CardMessage({ kind }: { kind: 'noItems' | 'error' }) {
  const t = useText();
  return (
    <div className={`sk-card__message sk-card__message--${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {t(kind === 'error' ? 'card.error' : 'card.noItems')}
    </div>
  );
}
