/**
 * RadialMicroChart (sap.suite.ui.microchart, 1.154): a ring filled to a percentage, the percentage in the middle or,
 * when the chart is small, beside it (docs/15 MC-51 … MC-53). The percentage is `percentage` or fraction / total,
 * rounded down to one decimal and shown between 0 % and 100 % (RadialMicroChart.setPercentage, _generateTextContent).
 */
import { clamp01, colorOf, finite, MicroChartRoot, Num, stateText, type HorizontalAlignmentType, type MicroChartBaseSettings, type MicroChartColor, type MicroCtx, type Rendered } from './microCore';

export interface $RadialMicroChartSettings extends MicroChartBaseSettings {
  /** The total value (360 degrees). */
  total?: number;
  /** The fraction of the total that is shown. */
  fraction?: number;
  /** The percentage shown; when set, `total` and `fraction` are not considered. */
  percentage?: number;
  /**
   * The colour of the filled path.
   * @defaultValue 'Neutral'
   */
  valueColor?: MicroChartColor;
  /**
   * The alignment of the content.
   * @defaultValue 'Left'
   */
  alignContent?: HorizontalAlignmentType;
}

function draw(p: $RadialMicroChartSettings, { t, pct, compact }: MicroCtx): Rendered | undefined {
  let percent: number | undefined;
  if (finite(p.percentage)) percent = p.percentage;
  else if (finite(p.total)) percent = finite(p.fraction) && p.total !== 0 ? (p.fraction / p.total) * 100 : 0;
  if (percent === undefined) return undefined;
  percent = Math.min(100, Math.max(0, Math.floor(percent * 10) / 10));
  const f = clamp01(percent / 100);
  const text = pct(percent / 100, 1);
  const color = p.valueColor ?? 'Neutral';
  // MC-53: below the S size the percentage moves to the right of the ring; hidden when there is no room.
  const label = <span className={compact ? 'sk-microchart__side' : 'sk-microchart__center'} data-sk-fit><Num>{text}</Num></span>;
  return {
    mark: colorOf(color === 'None' ? 'Neutral' : color),
    aria: text + stateText(t, color),
    body: (
      <>
        <span className="sk-microchart__ring">
          <svg className="sk-microchart__circle" viewBox="0 0 40 40" focusable="false">
            <circle className="sk-microchart__ring-track" cx={20} cy={20} r={17} strokeWidth={6} pathLength={100} />
            {f > 0 && <circle className="sk-microchart__ring-mark" data-sk-microchart-bar="value" cx={20} cy={20} r={17} strokeWidth={6} pathLength={100} strokeDasharray={`${f * 100} 100`} transform="rotate(-90 20 20)" />}
          </svg>
          {!compact && label}
        </span>
        {compact && label}
      </>
    ),
  };
}

/** sap.suite.ui.microchart.RadialMicroChart */
export function RadialMicroChart(p: $RadialMicroChartSettings) {
  return <MicroChartRoot kind="radial" base={p} draw={(c) => draw(p, c)} extraClass={`sk-microchart--align-${p.alignContent ?? 'Left'}`} />;
}
