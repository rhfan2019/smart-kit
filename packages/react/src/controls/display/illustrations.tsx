/**
 * The illustrations of IllustratedMessage: original drawings of this library on one shared composition (backdrop, ground,
 * sparkles) with one motif per type; several types share a base motif with a different badge. Colours come only from the
 * CSS custom properties `--sk-illustration-*`.
 */
import type { ReactNode } from 'react';

const LINE = { stroke: 'var(--sk-illustration-line)', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const SURFACE = 'var(--sk-illustration-surface)';
const SOFT = 'var(--sk-illustration-soft)';
const ACCENT = 'var(--sk-illustration-accent)';
const POSITIVE = 'var(--sk-illustration-positive)';
const NEGATIVE = 'var(--sk-illustration-negative)';
const CRITICAL = 'var(--sk-illustration-critical)';

// ---- base motifs
const cloud = <path d="M52 86h56a15 15 0 0 0 0-30a22 22 0 0 0-42-5a16 16 0 0 0-14 35z" fill={SURFACE} {...LINE} />;
const doc = (
  <>
    <path d="M56 28h34l14 14v52H56z" fill={SURFACE} {...LINE} />
    <path d="M90 28v14h14" fill={SOFT} {...LINE} />
  </>
);
const calendar = (
  <>
    <rect x="46" y="36" width="68" height="56" rx="5" fill={SURFACE} {...LINE} />
    <path d="M46 41a5 5 0 0 1 5-5h58a5 5 0 0 1 5 5v9H46z" fill={ACCENT} {...LINE} />
    <path d="M62 30v12M98 30v12" {...LINE} />
  </>
);
const table = (
  <>
    <rect x="38" y="34" width="84" height="58" rx="5" fill={SURFACE} {...LINE} />
    <path d="M38 48h84" {...LINE} />
    <path d="M66 34v58M94 34v58" {...LINE} stroke={SOFT} />
    <path d="M44 60h16M72 60h16M100 60h16M44 72h16M72 72h16M100 72h16" {...LINE} stroke={SOFT} strokeDasharray="3 4" />
  </>
);
const envelope = (
  <>
    <rect x="44" y="40" width="72" height="48" rx="4" fill={SURFACE} {...LINE} />
    <path d="M46 44l34 24 34-24" {...LINE} fill="none" />
  </>
);
const clipboard = (
  <>
    <rect x="52" y="32" width="56" height="64" rx="5" fill={SURFACE} {...LINE} />
    <rect x="68" y="27" width="24" height="10" rx="3" fill={ACCENT} {...LINE} />
  </>
);
const magnifier = (
  <>
    <circle cx="72" cy="54" r="22" fill={SURFACE} {...LINE} />
    <circle cx="72" cy="54" r="14" fill={SOFT} />
    <path d="M88 70l18 18" {...LINE} stroke={ACCENT} strokeWidth={7} />
  </>
);
const person = (cx: number, cy: number) => (
  <>
    <circle cx={cx} cy={cy - 10} r="8" fill={SURFACE} {...LINE} />
    <path d={`M${cx - 14} ${cy + 14}a14 14 0 0 1 28 0z`} fill={SURFACE} {...LINE} />
  </>
);
// ---- badges (bottom right)
const badge = (fill: string, mark: ReactNode) => (
  <>
    <circle cx="110" cy="84" r="11" fill={fill} {...LINE} />
    {mark}
  </>
);
const plus = badge(ACCENT, <path d="M110 78v12M104 84h12" {...LINE} stroke={SURFACE} />);
const check = (fill = POSITIVE) => badge(fill, <path d="M105 84l4 4 7-8" {...LINE} stroke={SURFACE} fill="none" />);
const cross = (fill = NEGATIVE) => badge(fill, <path d="M106 80l8 8M114 80l-8 8" {...LINE} stroke={SURFACE} />);
const bang = (fill: string) => (
  <>
    <path d="M80 58v12" {...LINE} stroke={fill} strokeWidth={4} />
    <circle cx="80" cy="78" r="2.5" fill={fill} />
  </>
);
const rows = (ys: number[], x = 60, w = 40) => ys.map((y) => <path key={y} d={`M${x} ${y}h${w}`} {...LINE} stroke={SOFT} strokeDasharray="3 5" />);

const MOTIFS: Record<string, ReactNode> = {
  NoSearchResults: <>{magnifier}<path d="M65 47l14 14M79 47L65 61" {...LINE} stroke={SURFACE} /></>,
  BeforeSearch: <>{magnifier}<path d="M64 50a10 10 0 0 1 8-6" {...LINE} stroke={SURFACE} fill="none" /><path d="M110 30v8M106 34h8" {...LINE} stroke={ACCENT} /></>,
  NoData: (
    <>
      <path d="M50 58h60v34a4 4 0 0 1-4 4H54a4 4 0 0 1-4-4z" fill={SURFACE} {...LINE} />
      <path d="M50 58l30-10 30 10-30 10z" fill={SOFT} {...LINE} />
      <path d="M50 58l-12-12M110 58l12-12M80 68v28" {...LINE} fill="none" />
    </>
  ),
  NoEntries: <>{doc}{rows([50, 60, 70], 64, 28)}<path d="M96 84l18-18 6 6-18 18h-6z" fill={ACCENT} {...LINE} /></>,
  NoFilterResults: (
    <>
      <path d="M46 36h68L88 64v22l-16 8V64z" fill={SURFACE} {...LINE} />
      <path d="M52 42h56" {...LINE} stroke={SOFT} strokeWidth={5} />
      {cross(ACCENT)}
    </>
  ),
  NoActivities: <>{calendar}{[60, 74, 88, 102].flatMap((x) => [62, 76].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="3" fill={SOFT} />))}</>,
  EmptyPlanningCalendar: <>{calendar}<path d="M54 60h24M70 70h30M58 80h18" {...LINE} stroke={SOFT} strokeWidth={5} /></>,
  AddPeopleToCalendar: <>{calendar}{person(80, 72)}{plus}</>,
  NoNotifications: (
    <>
      <path d="M62 80V60a18 18 0 0 1 36 0v20l6 6H56z" fill={SURFACE} {...LINE} />
      <circle cx="80" cy="92" r="4" fill={ACCENT} />
      <path d="M106 36h8l-8 9h8M116 24h5l-5 6h5" {...LINE} stroke={SOFT} fill="none" />
    </>
  ),
  NoMail: <>{envelope}<path d="M108 30l6 6M114 30l-6 6" {...LINE} stroke={SOFT} /></>,
  NewMail: <>{envelope}<circle cx="114" cy="40" r="8" fill={ACCENT} {...LINE} /></>,
  NoTasks: <>{clipboard}{[52, 66, 80].map((y) => <path key={y} d={`M60 ${y}h40`} {...LINE} stroke={SOFT} strokeDasharray="3 5" />)}</>,
  KeyTask: (
    <>
      {clipboard}
      {[52, 66, 80].map((y) => <path key={y} d={`M60 ${y}l3 3 5-6M74 ${y}h26`} {...LINE} stroke={y === 52 ? POSITIVE : SOFT} fill="none" />)}
      <path d="M110 70l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill={ACCENT} {...LINE} />
    </>
  ),
  Survey: <>{clipboard}{[52, 66, 80].map((y) => <g key={y}><circle cx="63" cy={y} r="4" fill={y === 66 ? ACCENT : SURFACE} {...LINE} /><path d={`M74 ${y}h26`} {...LINE} stroke={SOFT} /></g>)}</>,
  NoSavedItems: <><path d="M62 30h36v64L80 80 62 94z" fill={SURFACE} {...LINE} /><path d="M70 44h20" {...LINE} stroke={SOFT} strokeDasharray="3 5" /></>,
  NoChartData: (
    <>
      <path d="M46 30v62h70" {...LINE} fill="none" />
      {[[58, 70], [74, 58], [90, 76], [106, 64]].map(([x, y]) => <rect key={x} x={x! - 5} y={y} width="10" height={92 - y!} fill={SOFT} />)}
    </>
  ),
  NoColumnsSet: <>{table}<path d="M66 34v58M94 34v58" {...LINE} stroke={SURFACE} /><path d="M80 52v28" {...LINE} stroke={SOFT} strokeDasharray="3 5" /></>,
  AddingColumns: <>{table}{plus}</>,
  AddDimensions: (
    <>
      <path d="M80 30l30 15v32L80 92 50 77V45z" fill={SURFACE} {...LINE} />
      <path d="M50 45l30 15 30-15M80 60v32" {...LINE} fill="none" />
      {plus}
    </>
  ),
  FilteringColumns: <>{table}{badge(ACCENT, <path d="M104 79h12l-5 6v5l-2 1v-6z" {...LINE} stroke={SURFACE} fill={SURFACE} />)}</>,
  GroupingColumns: <>{table}{badge(ACCENT, <path d="M104 80h5M104 84h12M104 88h8" {...LINE} stroke={SURFACE} />)}</>,
  ResizingColumns: <>{table}{badge(ACCENT, <path d="M103 84h14M106 81l-3 3 3 3M114 81l3 3-3 3" {...LINE} stroke={SURFACE} fill="none" />)}</>,
  SortingColumns: <>{table}{badge(ACCENT, <path d="M106 90V78l-3 3M114 78v12l3-3" {...LINE} stroke={SURFACE} fill="none" />)}</>,
  UnableToLoad: <>{cloud}{bang(CRITICAL)}</>,
  UnableToLoadImage: (
    <>
      <rect x="44" y="34" width="72" height="56" rx="5" fill={SURFACE} {...LINE} />
      <path d="M48 84l20-22 14 14 10-10 20 18" {...LINE} stroke={SOFT} fill="none" />
      <circle cx="94" cy="50" r="6" fill={SOFT} />
      {cross(CRITICAL)}
    </>
  ),
  UnableToUpload: <>{cloud}<path d="M80 80V60M72 67l8-8 8 8" {...LINE} stroke={SOFT} strokeWidth={4} fill="none" />{cross()}</>,
  UploadToCloud: <>{cloud}<path d="M80 80V58M71 66l9-9 9 9" {...LINE} stroke={ACCENT} strokeWidth={4} fill="none" /></>,
  DragFilesToUpload: (
    <>
      <path d="M46 70v18a4 4 0 0 0 4 4h60a4 4 0 0 0 4-4V70" {...LINE} fill="none" strokeDasharray="4 5" />
      <path d="M66 26h22l10 10v28H66z" fill={SURFACE} {...LINE} />
      <path d="M82 70v14M76 78l6 6 6-6" {...LINE} stroke={ACCENT} strokeWidth={4} fill="none" />
    </>
  ),
  PageNotFound: <>{doc}<path d="M73 56a7 7 0 1 1 10 6c-3 2-3 4-3 7" {...LINE} stroke={ACCENT} strokeWidth={4} fill="none" /><circle cx="80" cy="78" r="2.5" fill={ACCENT} /></>,
  Achievement: (
    <>
      <path d="M70 70l-8 24 10-4 6 8 4-22M90 70l8 24-10-4-6 8-4-22" fill={ACCENT} {...LINE} />
      <circle cx="80" cy="54" r="22" fill={SURFACE} {...LINE} />
      <path d="M80 42l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z" fill={ACCENT} {...LINE} />
    </>
  ),
  SignOut: (
    <>
      <path d="M86 30H58v64h28" fill={SURFACE} {...LINE} />
      <path d="M58 30l20 8v64l-20-8" fill={SOFT} {...LINE} />
      <path d="M88 62h24M104 54l8 8-8 8" {...LINE} stroke={ACCENT} strokeWidth={4} fill="none" />
    </>
  ),
  UserHasSignedUp: <>{person(80, 66)}{check()}</>,
  ReceiveAppreciation: (
    <>
      <path d="M80 92L54 66a15 15 0 0 1 26-21a15 15 0 0 1 26 21z" fill={SURFACE} {...LINE} />
      <path d="M68 58a7 7 0 0 1 8-4" {...LINE} stroke={ACCENT} fill="none" />
      <path d="M112 34v8M108 38h8M44 40v6M41 43h6" {...LINE} stroke={ACCENT} />
    </>
  ),
};

/** The illustration types drawn by this library. */
export const ILLUSTRATION_TYPES = Object.keys(MOTIFS);

/** The SVG of an illustration type (falls back to NoSearchResults). */
export function Illustration({ type, className, label, labelledBy, describedBy }: { type: string; className?: string; label?: string; labelledBy?: string; describedBy?: string }) {
  return (
    <svg
      viewBox="0 0 160 120" className={className} focusable="false" data-sk-illustration={type}
      {...(label || labelledBy ? { role: 'img', 'aria-label': labelledBy ? undefined : label, 'aria-labelledby': labelledBy, 'aria-describedby': describedBy } : { 'aria-hidden': true })}
    >
      <circle cx="80" cy="58" r="46" fill="var(--sk-illustration-backdrop)" />
      <ellipse cx="80" cy="104" rx="50" ry="5" fill="var(--sk-illustration-ground)" />
      <circle cx="30" cy="36" r="3" fill={ACCENT} />
      <circle cx="132" cy="62" r="2" fill={SOFT} />
      <path d="M126 22v8M122 26h8" {...LINE} stroke={SOFT} />
      {MOTIFS[type] ?? MOTIFS.NoSearchResults}
    </svg>
  );
}
