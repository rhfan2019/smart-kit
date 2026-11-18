/**
 * ProcessFlow (sap.suite.ui.commons.ProcessFlow), docs/26 §3.6: lanes as columns, nodes placed in rows by their
 * parent/child relations, SVG connectors with arrowheads. Lanes and nodes are data arrays (ADR-032 rule 4). There is no
 * `zoomLevel` property (as in UI5): the level follows the width until a ref method sets it.
 */
import { useCallback, useEffect, useImperativeHandle, useMemo, useReducer, useRef, useState, type CSSProperties, type ReactNode, type Ref } from 'react';
import type { MessageKey } from '../../i18n/messages.en';
import { useControlText } from '../context';
import { cx, pressKeys } from './shared';
import { TEXTS } from './texts';

/** sap.suite.ui.commons.ProcessFlowZoomLevel: One is the most detailed, Four the smallest. */
export type ProcessFlowZoomLevel = 'One' | 'Two' | 'Three' | 'Four';
export const ProcessFlowZoomLevel = { One: 'One', Two: 'Two', Three: 'Three', Four: 'Four' } as const;

/** sap.suite.ui.commons.ProcessFlowNodeState */
export type ProcessFlowNodeState = 'Positive' | 'Negative' | 'Critical' | 'Neutral' | 'Planned' | 'PlannedNegative';
export const ProcessFlowNodeState = {
  Positive: 'Positive', Negative: 'Negative', Critical: 'Critical', Neutral: 'Neutral', Planned: 'Planned', PlannedNegative: 'PlannedNegative',
} as const;

/** sap.suite.ui.commons.ProcessFlowNodeType: Aggregated nodes are drawn as a stack. */
export type ProcessFlowNodeType = 'Single' | 'Aggregated';
export const ProcessFlowNodeType = { Single: 'Single', Aggregated: 'Aggregated' } as const;

/** sap.suite.ui.commons.ProcessFlowConnectionLabelState */
export type ProcessFlowConnectionLabelState = 'Positive' | 'Negative' | 'Critical' | 'Neutral';
export const ProcessFlowConnectionLabelState = { Positive: 'Positive', Negative: 'Negative', Critical: 'Critical', Neutral: 'Neutral' } as const;

/** One segment of a lane's state donut. */
export interface ProcessFlowLaneState {
  state: ProcessFlowNodeState;
  /** Percentage 0–100. */
  value: number;
}

/** sap.suite.ui.commons.ProcessFlowLaneHeader */
export interface ProcessFlowLaneHeader {
  laneId: string;
  /** Icon in the middle of the donut (a React node, e.g. a lucide icon). */
  iconSrc?: ReactNode;
  text?: string;
  /** Column order; default the array order. */
  position?: number;
  /** Segments of the donut around the icon. */
  state?: ProcessFlowLaneState[];
  /** Zoom level of this header; default the level of the ProcessFlow. */
  zoomLevel?: ProcessFlowZoomLevel;
  onPress?: () => void;
}

/** sap.suite.ui.commons.ProcessFlowConnectionLabel: a label on a connector (shown with `showLabels`). */
export interface ProcessFlowConnectionLabel {
  text?: string;
  icon?: ReactNode;
  /** Where several labels meet, the one with the highest priority is shown (default 0). */
  priority?: number;
  /** Default 'Neutral'. */
  state?: ProcessFlowConnectionLabelState;
  /** Default true. */
  enabled?: boolean;
}

/** A child entry of a node: its id and an optional connection label. */
export interface ProcessFlowChild {
  nodeId: string | number;
  connectionLabel?: ProcessFlowConnectionLabel;
}

/** sap.suite.ui.commons.ProcessFlowNode */
export interface ProcessFlowNode {
  nodeId: string | number;
  laneId: string;
  title?: string;
  /** Shown instead of the title at zoom level Four. */
  titleAbbreviation?: string;
  /** Default 'Neutral'. */
  state?: ProcessFlowNodeState;
  stateText?: string;
  /** Default 'Single'. */
  type?: ProcessFlowNodeType;
  /** Child node ids, or `{ nodeId, connectionLabel }`. */
  children?: Array<string | number | ProcessFlowChild>;
  /** Parent node ids (connections drawn from them to this node). */
  parents?: Array<string | number>;
  texts?: string[];
  highlighted?: boolean;
  focused?: boolean;
  selected?: boolean;
  /** Any application data. */
  tag?: unknown;
  /** Custom content per zoom level (replaces the standard node content). */
  zoomLevelOneContent?: ReactNode;
  zoomLevelTwoContent?: ReactNode;
  zoomLevelThreeContent?: ReactNode;
  zoomLevelFourContent?: ReactNode;
}

/** Second argument of `onLabelPress`: the connection the label belongs to. */
export interface ProcessFlowLabelPressInfo {
  sourceNode: ProcessFlowNode;
  targetNode: ProcessFlowNode;
}

export interface ProcessFlowProps {
  lanes?: ProcessFlowLaneHeader[];
  nodes?: ProcessFlowNode[];
  /** Nodes with a folded top-right corner (default false). */
  foldedCorners?: boolean;
  /** Scrolls inside its own box (default true); false lets the content overflow. */
  scrollable?: boolean;
  /** Ctrl + mouse wheel zooms (default true). */
  wheelZoomable?: boolean;
  /** Shows the connection labels (default false). */
  showLabels?: boolean;
  onNodePress?: (node: ProcessFlowNode) => void;
  onLabelPress?: (label: ProcessFlowConnectionLabel, info: ProcessFlowLabelPressInfo) => void;
  onHeaderPress?: (lane: ProcessFlowLaneHeader) => void;
  /** Inconsistent data: a node in an unknown lane, or a child or parent id that does not exist. */
  onError?: (e: { text: string }) => void;
  ref?: Ref<ProcessFlowRef>;
  'aria-label'?: string;
}

/** Instance methods of ProcessFlow (via `ref`). */
export interface ProcessFlowRef {
  zoomIn(): ProcessFlowZoomLevel;
  zoomOut(): ProcessFlowZoomLevel;
  getZoomLevel(): ProcessFlowZoomLevel;
  setZoomLevel(level: ProcessFlowZoomLevel): void;
  /** Id of the node that has the keyboard focus (or the `focused` node). */
  getFocusedNode(): string | number | undefined;
  /** Highlights the path from one node to another and dims the rest; `(null, null)` clears it. */
  setSelectedPath(sourceNodeId: string | number | null, targetNodeId: string | number | null): boolean;
  /** true: each root starts on the first free row of its lane (compact); false (default): below the previous tree. */
  optimizeLayout(isOptimized: boolean): void;
  /** Redraws (the data is already reactive; kept for UI5 code). */
  updateModel(): void;
  updateNodesOnly(): void;
  applyNodeDisplayState(): void;
}

const LEVELS: ProcessFlowZoomLevel[] = ['One', 'Two', 'Three', 'Four'];
const TONE: Record<ProcessFlowNodeState, string> = {
  Positive: 'positive', Negative: 'negative', Critical: 'critical', Neutral: 'info', Planned: 'neutral', PlannedNegative: 'negative',
};
const shift = (z: ProcessFlowZoomLevel, d: number) => LEVELS[Math.max(0, Math.min(3, LEVELS.indexOf(z) + d))];
const planned = (s: ProcessFlowNodeState | undefined) => s === 'Planned' || s === 'PlannedNegative';
const childOf = (c: string | number | ProcessFlowChild): ProcessFlowChild => (typeof c === 'object' ? c : { nodeId: c });

/** Initial zoom by width (UI5: Two from 1024, Three from 600, else Four), in rem of 16. */
export function zoomForWidth(widthRem: number): ProcessFlowZoomLevel {
  return widthRem >= 64 ? 'Two' : widthRem >= 37.5 ? 'Three' : 'Four';
}

/** Node box inside its cell, in cell units (the CSS keeps the same proportions). */
const X0 = 0.12;
const X1 = 0.88;
const Y0 = 0.12;
const Y1 = 0.88;

interface Placed { node: ProcessFlowNode; col: number; row: number }
interface Edge { from: string; to: string; label?: ProcessFlowConnectionLabel }
interface Line {
  key: string; d: string; planned: boolean; dimmed: boolean; highlighted: boolean; edge: Edge;
  lx: number; ly: number; ax: number; ay: number; dir: 'right' | 'down' | 'left';
}

/** The connections of `children` and `parents`, without duplicates. */
function edgesOf(nodes: ProcessFlowNode[]): Edge[] {
  const out = new Map<string, Edge>();
  for (const n of nodes) {
    for (const c of n.children ?? []) {
      const ch = childOf(c);
      out.set(`${n.nodeId}>${ch.nodeId}`, { from: String(n.nodeId), to: String(ch.nodeId), label: ch.connectionLabel });
    }
    for (const parent of n.parents ?? []) if (!out.has(`${parent}>${n.nodeId}`)) out.set(`${parent}>${n.nodeId}`, { from: String(parent), to: String(n.nodeId) });
  }
  return [...out.values()];
}

/** Columns from the lanes, rows from a depth-first walk: a child starts on its parent's row; siblings go below. */
export function layoutProcessFlow(lanes: ProcessFlowLaneHeader[], nodes: ProcessFlowNode[], optimized = false) {
  const sorted = lanes.map((l, i) => ({ l, i })).sort((a, b) => (a.l.position ?? a.i) - (b.l.position ?? b.i)).map((x) => x.l);
  const col = new Map(sorted.map((l, i) => [l.laneId, i]));
  const byId = new Map(nodes.map((n) => [String(n.nodeId), n]));
  const edges = edgesOf(nodes);
  const errors: string[] = [];
  for (const n of nodes) if (!col.has(n.laneId)) errors.push(`Node ${n.nodeId}: unknown lane ${n.laneId}`);
  for (const e of edges) for (const id of [e.from, e.to]) if (!byId.has(id)) errors.push(`Connection ${e.from} → ${e.to}: unknown node ${id}`);
  const kids = new Map<string, string[]>();
  for (const e of edges) kids.set(e.from, [...(kids.get(e.from) ?? []), e.to]);
  const referenced = new Set(edges.map((e) => e.to));
  const next = sorted.map(() => 0);
  const placed = new Map<string, Placed>();
  const place = (id: string, min: number): number => {
    const node = byId.get(id);
    if (!node || placed.has(id)) return min - 1;
    const c = col.get(node.laneId);
    if (c === undefined) return min - 1;
    const row = Math.max(min, next[c]);
    next[c] = row + 1;
    placed.set(id, { node, col: c, row });
    let r = row;
    for (const child of kids.get(id) ?? []) r = Math.max(r, place(child, r) + 1);
    return Math.max(row, r - 1);
  };
  let start = 0;
  for (const n of nodes) if (!referenced.has(String(n.nodeId))) start = Math.max(start, place(String(n.nodeId), optimized ? 0 : start) + 1);
  for (const n of nodes) start = Math.max(start, place(String(n.nodeId), optimized ? 0 : start) + 1);
  const rows = Math.max(1, ...[...placed.values()].map((p) => p.row + 1));
  return { lanes: sorted, placed, rows, edges, errors };
}

/** Node ids on a path from `source` to `target` (breadth-first over the connections). */
export function pathBetween(edges: Edge[], source: string, target: string): string[] | undefined {
  const prev = new Map<string, string>([[source, '']]);
  const queue = [source];
  while (queue.length) {
    const id = queue.shift()!;
    if (id === target) {
      const path = [id];
      for (let p = prev.get(id); p; p = prev.get(p)) path.unshift(p);
      return path;
    }
    for (const e of edges) if (e.from === id && !prev.has(e.to)) {
      prev.set(e.to, id);
      queue.push(e.to);
    }
  }
  return undefined;
}

function connectors(placed: Map<string, Placed>, edges: Edge[], isHighlighted: (id: string) => boolean, anyHighlighted: boolean): Line[] {
  const lines: Line[] = [];
  for (const edge of edges) {
    const a = placed.get(edge.from);
    const b = placed.get(edge.to);
    if (!a || !b) continue;
    const highlighted = anyHighlighted && isHighlighted(edge.from) && isHighlighted(edge.to);
    const base = { key: `${edge.from}>${edge.to}`, planned: planned(b.node.state), dimmed: anyHighlighted && !highlighted, highlighted, edge };
    if (b.col > a.col) {
      const sy = a.row + 0.5;
      const ey = b.row + 0.5;
      const mx = b.col - (1 - X1 + X0) / 2;
      lines.push({ ...base, d: `M${a.col + X1} ${sy}H${mx}V${ey}H${b.col + X0}`, lx: mx, ly: (sy + ey) / 2, ax: b.col + X0, ay: ey, dir: 'right' });
    } else if (b.col === a.col) {
      const x = a.col + 0.5;
      lines.push({ ...base, d: `M${x} ${a.row + Y1}V${b.row + Y0}`, lx: x, ly: (a.row + Y1 + b.row + Y0) / 2, ax: x, ay: b.row + Y0, dir: 'down' });
    } else {
      const x = a.col + 0.5;
      const ey = b.row + 0.5;
      lines.push({ ...base, d: `M${x} ${a.row + Y1}V${ey}H${b.col + X1}`, lx: x, ly: ey, ax: b.col + X1, ay: ey, dir: 'left' });
    }
  }
  return lines;
}

/** Labels at the same place: only the one with the highest priority. */
function visibleLabels(lines: Line[]): Line[] {
  const best = new Map<string, Line>();
  for (const l of lines) {
    if (!l.edge.label) continue;
    const k = `${l.lx.toFixed(2)}:${l.ly.toFixed(2)}`;
    const cur = best.get(k);
    if (!cur || (l.edge.label.priority ?? 0) > (cur.edge.label?.priority ?? 0)) best.set(k, l);
  }
  return [...best.values()];
}

/** The donut around the lane icon: one arc per state, the rest of the ring in the track colour. */
function LaneDonut({ states, label }: { states: ProcessFlowLaneState[]; label?: string }) {
  let offset = 0;
  return (
    <svg className="sk-process-flow__donut" viewBox="0 0 36 36" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <circle className="sk-process-flow__donut-track" cx="18" cy="18" r="15.9155" />
      {states.map((s, i) => {
        const v = Math.max(0, Math.min(100, s.value));
        const el = (
          <circle key={i} className={`sk-process-flow__donut-arc sk-process-flow__donut-arc--${TONE[s.state]}`} cx="18" cy="18" r="15.9155"
            strokeDasharray={`${v} ${100 - v}`} strokeDashoffset={25 - offset} />
        );
        offset += v;
        return el;
      })}
    </svg>
  );
}

const pct = (v: number, of: number) => `${(v / of) * 100}%`;

export function ProcessFlow(p: ProcessFlowProps) {
  const t = useControlText(TEXTS);
  const root = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<ProcessFlowZoomLevel>('Two');
  const manual = useRef(false);
  const focusedId = useRef<string | number | undefined>(undefined);
  const [path, setPath] = useState<Set<string> | null>(null);
  const [optimized, setOptimized] = useState(false);
  const [, redraw] = useReducer((x: number) => x + 1, 0);

  const { lanes, placed, rows, edges, errors } = useMemo(() => layoutProcessFlow(p.lanes ?? [], p.nodes ?? [], optimized), [p.lanes, p.nodes, optimized]);
  const errorText = errors.join('\n');
  const onError = p.onError;
  useEffect(() => {
    if (errorText) onError?.({ text: errorText });
  }, [errorText, onError]);

  // initial level by width, until a ref method or the wheel sets one
  useEffect(() => {
    const el = root.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry?.contentRect.width ?? 0;
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      if (!manual.current && w > 0) setZoom(zoomForWidth(w / rem));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const step = useCallback((d: number) => {
    manual.current = true;
    setZoom((z) => shift(z, d));
  }, []);

  const wheel = p.wheelZoomable !== false;
  useEffect(() => {
    const el = root.current;
    if (!el || !wheel) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      step(e.deltaY < 0 ? -1 : 1);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [wheel, step]);

  useImperativeHandle(p.ref, () => ({
    zoomIn: () => {
      step(-1);
      return shift(zoom, -1);
    },
    zoomOut: () => {
      step(1);
      return shift(zoom, 1);
    },
    getZoomLevel: () => zoom,
    setZoomLevel: (l) => {
      manual.current = true;
      setZoom(l);
    },
    getFocusedNode: () => focusedId.current ?? (p.nodes ?? []).find((n) => n.focused)?.nodeId,
    setSelectedPath: (source, target) => {
      if (source === null || target === null) {
        setPath(null);
        return true;
      }
      const ids = pathBetween(edges, String(source), String(target));
      setPath(ids ? new Set(ids) : null);
      return !!ids;
    },
    optimizeLayout: (on) => setOptimized(on),
    updateModel: redraw,
    updateNodesOnly: redraw,
    applyNodeDisplayState: redraw,
  }), [zoom, step, edges, p.nodes]);

  const isHighlighted = (id: string) => (path ? path.has(id) : !!placed.get(id)?.node.highlighted);
  const anyHighlighted = !!path || (p.nodes ?? []).some((n) => n.highlighted);
  const lines = connectors(placed, edges, isHighlighted, anyHighlighted);
  const cols = Math.max(1, lanes.length);
  const stateText = (s: ProcessFlowNodeState) => t(`ctl.processFlow.state${s}` as MessageKey);
  const style = { '--sk-process-flow-cols': cols, '--sk-process-flow-rows': rows } as CSSProperties;

  return (
    <div
      ref={root}
      className={cx('sk-process-flow', `sk-process-flow--zoom-${zoom.toLowerCase()}`, p.scrollable === false && 'sk-process-flow--static')}
      role="group"
      aria-label={p['aria-label'] ?? t('ctl.processFlow.label')}
      data-zoom-level={zoom}
    >
      <div className="sk-process-flow__canvas" style={style}>
        <div className="sk-process-flow__lanes">
          {lanes.map((lane) => {
            const label = lane.state?.length ? lane.state.map((s) => t('ctl.processFlow.laneState', { state: stateText(s.state), value: s.value })).join(', ') : undefined;
            const content = (
              <>
                <span className="sk-process-flow__lane-icon">
                  <LaneDonut states={lane.state ?? []} label={label} />
                  {lane.iconSrc && <span className="sk-process-flow__lane-glyph" aria-hidden="true">{lane.iconSrc}</span>}
                </span>
                {lane.text && <span className="sk-process-flow__lane-text">{lane.text}</span>}
              </>
            );
            const cls = cx('sk-process-flow__lane', lane.zoomLevel && `sk-process-flow__lane--zoom-${lane.zoomLevel.toLowerCase()}`);
            const press = lane.onPress || p.onHeaderPress ? () => { lane.onPress?.(); p.onHeaderPress?.(lane); } : undefined;
            return press
              ? <button key={lane.laneId} type="button" className={`${cls} sk-process-flow__lane--active`} data-lane-id={lane.laneId} onClick={press}>{content}</button>
              : <div key={lane.laneId} className={cls} data-lane-id={lane.laneId}>{content}</div>;
          })}
        </div>
        <div className="sk-process-flow__grid">
          <svg className="sk-process-flow__lines" viewBox={`0 0 ${cols} ${rows}`} preserveAspectRatio="none" aria-hidden="true">
            {lines.map((l) => (
              <path key={l.key} d={l.d} vectorEffect="non-scaling-stroke" data-connection={l.key}
                className={cx('sk-process-flow__line', l.planned && 'sk-process-flow__line--planned', l.dimmed && 'sk-process-flow__line--dimmed', l.highlighted && 'sk-process-flow__line--highlighted')} />
            ))}
          </svg>
          {lines.map((l) => (
            <span key={`arrow-${l.key}`} aria-hidden="true"
              className={cx('sk-process-flow__arrow', `sk-process-flow__arrow--${l.dir}`, l.dimmed && 'sk-process-flow__arrow--dimmed', l.highlighted && 'sk-process-flow__arrow--highlighted')}
              style={{ insetInlineStart: pct(l.ax, cols), insetBlockStart: pct(l.ay, rows) }} />
          ))}
          {p.showLabels && visibleLabels(lines).map((l) => {
            const label = l.edge.label!;
            const source = placed.get(l.edge.from)!.node;
            const target = placed.get(l.edge.to)!.node;
            return (
              <button key={`label-${l.key}`} type="button"
                className={cx('sk-process-flow__label', `sk-process-flow__label--${TONE[label.state ?? 'Neutral']}`, l.dimmed && 'sk-process-flow__label--dimmed')}
                style={{ insetInlineStart: pct(l.lx, cols), insetBlockStart: pct(l.ly, rows) }}
                disabled={label.enabled === false}
                onClick={() => p.onLabelPress?.(label, { sourceNode: source, targetNode: target })}>
                {label.icon && <span className="sk-process-flow__label-icon" aria-hidden="true">{label.icon}</span>}
                {label.text}
              </button>
            );
          })}
          {[...placed.values()].map(({ node, col, row }) => (
            <ProcessFlowNodeBox key={String(node.nodeId)} node={node} col={col} row={row} zoom={zoom} folded={!!p.foldedCorners}
              highlighted={path ? path.has(String(node.nodeId)) : !!node.highlighted}
              dimmed={anyHighlighted && !isHighlighted(String(node.nodeId))} onPress={p.onNodePress}
              onFocus={() => { focusedId.current = node.nodeId; }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ProcessFlowNodeBox(p: {
  node: ProcessFlowNode; col: number; row: number; zoom: ProcessFlowZoomLevel; folded: boolean; highlighted: boolean; dimmed: boolean;
  onPress?: ProcessFlowProps['onNodePress']; onFocus: () => void;
}) {
  const { node } = p;
  const state = node.state ?? 'Neutral';
  const custom = { One: node.zoomLevelOneContent, Two: node.zoomLevelTwoContent, Three: node.zoomLevelThreeContent, Four: node.zoomLevelFourContent }[p.zoom];
  const title = p.zoom === 'Four' ? (node.titleAbbreviation ?? node.title) : node.title;
  const press = p.onPress ? () => p.onPress?.(node) : undefined;
  return (
    <div
      className={cx(
        'sk-process-flow__node', `sk-process-flow__node--${TONE[state]}`, planned(state) && 'sk-process-flow__node--planned',
        node.type === 'Aggregated' && 'sk-process-flow__node--aggregated', p.folded && 'sk-process-flow__node--folded',
        node.selected && 'sk-process-flow__node--selected', p.highlighted && 'sk-process-flow__node--highlighted',
        node.focused && 'sk-process-flow__node--focused', p.dimmed && 'sk-process-flow__node--dimmed', press && 'sk-process-flow__node--active',
      )}
      style={{ gridColumn: p.col + 1, gridRow: p.row + 1 }}
      role={press ? 'button' : 'group'}
      tabIndex={press ? 0 : undefined}
      aria-label={[node.title, node.stateText].filter(Boolean).join(', ') || undefined}
      aria-pressed={press ? !!node.selected : undefined}
      onClick={press}
      onKeyDown={press ? pressKeys(press) : undefined}
      onFocus={p.onFocus}
      data-node-id={node.nodeId}
      data-state={state}
    >
      {custom ?? (
        <>
          <span className="sk-process-flow__node-title">{title}</span>
          {p.zoom !== 'Four' && node.stateText && <span className="sk-process-flow__node-state">{node.stateText}</span>}
          {(p.zoom === 'One' || p.zoom === 'Two') && node.texts?.map((x, i) => <span key={i} className="sk-process-flow__node-text">{x}</span>)}
        </>
      )}
    </div>
  );
}
