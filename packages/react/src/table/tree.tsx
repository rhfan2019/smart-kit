/**
 * Tree tables (docs/26 §3.10): `SmartTable tableType="TreeTable"` reads the visible nodes of a recursive hierarchy
 * with TopLevels (Levels plus ExpandLevels of the toggled nodes) and shows them in tree order, indented by
 * DistanceFromRoot, with an expand / collapse toggle in the first column. Methods and the event follow
 * sap.ui.table.TreeTable (ADR-032).
 */
import { ActionIcon } from '@mantine/core';
import { hierarchyNodeOf, type HierarchyNode, type HierarchyRequest, type RecursiveHierarchyModel, type Row } from '@rhfan2019/smart-kit-core';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useText } from '../context/SmartKitProvider';

/** sap.ui.comp.smarttable.TableType. */
export type TableType = 'AnalyticalTable' | 'ResponsiveTable' | 'Table' | 'TreeTable';

/** Instance methods of a tree table (sap.ui.table.TreeTable), through `ref`. Row indexes count the visible rows. */
export interface SmartTableRef {
  /** Expands the node(s) at the row index(es); leaves and expanded nodes stay as they are. */
  expand(rowIndex: number | number[]): void;
  collapse(rowIndex: number | number[]): void;
  /** Collapses all nodes: only the roots stay visible. */
  collapseAll(): void;
  /** Expands all nodes down to `level` (1: the roots only); single expansions and collapses are dropped. */
  expandToLevel(level: number): void;
  isExpanded(rowIndex: number): boolean;
}

/** sap.ui.table.TreeTable#toggleOpenState; `rowContext` is the row data. */
export interface ToggleOpenStateEvent {
  rowIndex: number;
  rowContext: Row;
  expanded: boolean;
}

/** Expansion state: levels from the roots and single nodes expanded (1) or collapsed (0) apart from them. */
interface TreeState {
  levels: number;
  nodes: Record<string, number>;
}

export interface TreeModel {
  /** Visible rows in tree order. */
  rows: Row[];
  nodeOf(row: Row): HierarchyNode | undefined;
  toggle(row: Row): void;
  api: SmartTableRef;
}

/** Expansion state of a tree table; its `request` part goes into the TopLevels request. */
export function useTreeState(initialLevel: number) {
  const [state, setState] = useState<TreeState>({ levels: Math.max(1, initialLevel), nodes: {} });
  const request: Pick<HierarchyRequest, 'levels' | 'expandLevels'> = useMemo(
    () => ({ levels: state.levels, expandLevels: Object.entries(state.nodes).map(([nodeId, levels]) => ({ nodeId, levels })) }),
    [state],
  );
  return { state, setState, request };
}

/**
 * Visible rows of a TopLevels result. Descendants of nodes collapsed with ExpandLevels Levels 0 are also hidden
 * here, for services that only add levels (fe-mockserver-core) and while the next result is loading.
 */
export function useTree(o: {
  hierarchy: RecursiveHierarchyModel | undefined;
  rows: Row[];
  tree: ReturnType<typeof useTreeState>;
  onToggleOpenState?(e: ToggleOpenStateEvent): void;
}): TreeModel {
  const { hierarchy: h, tree } = o;
  const { state, setState } = tree;
  const visible = useMemo(() => {
    const out: { row: Row; node: HierarchyNode }[] = [];
    if (!h) return out;
    let hideBelow: number | undefined;
    for (const row of o.rows) {
      const node = hierarchyNodeOf(h, row);
      if (hideBelow !== undefined && node.level > hideBelow) continue;
      hideBelow = undefined;
      if (state.nodes[node.id] === 0 && node.drillState === 'expanded') {
        out.push({ row, node: { ...node, drillState: 'collapsed', descendants: 0 } });
        hideBelow = node.level;
      } else out.push({ row, node });
    }
    return out;
  }, [h, o.rows, state.nodes]);
  const nodes = useMemo(() => new Map(visible.map((v) => [v.row, v.node])), [visible]);

  const setOpen = (node: HierarchyNode, open: boolean) => {
    if (node.drillState === 'leaf' || (node.drillState === 'expanded') === open) return false;
    setState((s) => {
      const nodes = { ...s.nodes };
      // Nodes above `levels` are open by default: closing them needs Levels 0, opening them only drops that.
      const byLevels = node.level + 1 < s.levels;
      if (open === byLevels) delete nodes[node.id];
      else nodes[node.id] = open ? 1 : 0;
      return { ...s, nodes };
    });
    return true;
  };
  const latest = useRef({ visible, onToggle: o.onToggleOpenState });
  latest.current = { visible, onToggle: o.onToggleOpenState };
  const each = (rowIndex: number | number[], open: boolean) => {
    for (const i of Array.isArray(rowIndex) ? rowIndex : [rowIndex]) {
      const v = latest.current.visible[i];
      if (v) setOpen(v.node, open);
    }
  };
  const api: SmartTableRef = {
    expand: (i) => each(i, true),
    collapse: (i) => each(i, false),
    collapseAll: () => setState({ levels: 1, nodes: {} }),
    expandToLevel: (level) => setState({ levels: Math.max(1, Math.floor(level)), nodes: {} }),
    isExpanded: (i) => latest.current.visible[i]?.node.drillState === 'expanded',
  };
  return {
    rows: useMemo(() => visible.map((v) => v.row), [visible]),
    nodeOf: (row) => nodes.get(row),
    toggle: (row) => {
      const rowIndex = latest.current.visible.findIndex((v) => v.row === row);
      const node = nodes.get(row);
      if (!node) return;
      const open = node.drillState !== 'expanded';
      if (setOpen(node, open)) latest.current.onToggle?.({ rowIndex, rowContext: row, expanded: open });
    },
    api,
  };
}

/** Indentation and toggle in the first cell of a tree row. */
export function TreeCell({ node, onToggle, children }: { node: HierarchyNode | undefined; onToggle(): void; children: ReactNode }) {
  const t = useText();
  if (!node) return <>{children}</>;
  const expanded = node.drillState === 'expanded';
  const label = expanded ? t('table.collapseNode') : t('table.expandNode');
  return (
    <span className="sk-tree" style={{ '--sk-tree-level': node.level } as CSSProperties} data-sk-tree-level={node.level} data-sk-drill-state={node.drillState}>
      {node.drillState === 'leaf' ? <span className="sk-tree__spacer" aria-hidden /> : (
        <ActionIcon size="sm" variant="subtle" className="sk-tree__toggle" aria-expanded={expanded} aria-label={label} title={label} data-sk-tree-toggle
          onClick={(e) => { e.stopPropagation(); onToggle(); }}>
          {expanded ? <ChevronDown className="sk-icon" /> : <ChevronRight className="sk-icon" />}
        </ActionIcon>
      )}
      <span className="sk-tree__content">{children}</span>
    </span>
  );
}
