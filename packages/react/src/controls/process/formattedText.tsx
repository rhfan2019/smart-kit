/**
 * The HTML subset of sap.m.FormattedText (default rendering rules of the SAPUI5 1.154 source), as used by FeedListItem:
 * the text is parsed by a small tokenizer (no DOM needed, so it renders on the server too) and turned into React
 * elements; nothing is ever written as raw HTML. Tags outside the subset are dropped together with their content,
 * attributes outside the allowed list are dropped, unsafe hrefs become "#", every element gets `position: static`
 * (FormattedText._sanitizeCSSPosition) and `disableStyleAttribute` drops all inline styles.
 */
import { createElement, Fragment, type CSSProperties, type ReactNode } from 'react';

/** Allowed elements (FormattedText `_defaultRenderingRules.ELEMENTS`). */
const ELEMENTS = new Set([
  'a', 'abbr', 'bdi', 'blockquote', 'br', 'cite', 'code', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'pre', 'strong', 'span', 'u', 's',
  'dl', 'dt', 'dd', 'ol', 'ul', 'li',
]);
/** Elements without content. */
const VOID = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'wbr', 'area', 'base', 'col', 'embed', 'source', 'track', 'param']);
/** Elements whose content is never text to show. */
const RAW = new Set(['script', 'style', 'textarea', 'title', 'template', 'noscript', 'iframe', 'object']);

export type FormattedNode =
  | { type: 'text'; text: string }
  | { type: 'el'; tag: string; attrs: Record<string, string>; children: FormattedNode[] };

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Decodes the HTML character references of a text or attribute value. */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function parseAttrs(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of src.matchAll(/([^\s=/"'>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
    out[m[1]!.toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return out;
}

/** The parsed tree of an HTML text (tolerant: unclosed elements end with their parent, stray end tags are ignored). */
export function parseHtml(html: string): FormattedNode[] {
  const root: FormattedNode = { type: 'el', tag: '#root', attrs: {}, children: [] };
  const stack: Array<Extract<FormattedNode, { type: 'el' }>> = [root];
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  let last = 0;
  let raw: string | null = null;
  for (const m of html.matchAll(re)) {
    const i = m.index ?? 0;
    const tag = m[2]?.toLowerCase();
    if (raw !== null) {
      // inside <script> and the like: skip everything up to the matching end tag
      if (m[1] === '/' && tag === raw) { raw = null; last = i + m[0].length; }
      continue;
    }
    if (i > last) stack[stack.length - 1]!.children.push({ type: 'text', text: decodeEntities(html.slice(last, i)) });
    last = i + m[0].length;
    if (!tag) continue; // a comment
    if (m[1] === '/') {
      const at = stack.map((x) => x.tag).lastIndexOf(tag);
      if (at > 0) stack.length = at;
      continue;
    }
    if (RAW.has(tag)) { raw = tag; continue; }
    const el: Extract<FormattedNode, { type: 'el' }> = { type: 'el', tag, attrs: parseAttrs(m[3] ?? ''), children: [] };
    stack[stack.length - 1]!.children.push(el);
    if (!VOID.has(tag) && !/\/\s*$/.test(m[3] ?? '')) stack.push(el);
  }
  if (raw === null && last < html.length) stack[stack.length - 1]!.children.push({ type: 'text', text: decodeEntities(html.slice(last)) });
  return root.children;
}

/** Whether an href is safe (as the default sap/base/security/URLListValidator: http, https, ftp, mailto or a relative URL). */
export function isSafeUrl(url: string): boolean {
  const u = url.trim();
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(u);
  return !scheme || ['http', 'https', 'ftp', 'mailto'].includes(scheme[1]!.toLowerCase());
}

/** An inline style string as a React style object; declarations that can load or run code are dropped. */
export function styleObject(css: string): CSSProperties {
  const out: Record<string, string> = {};
  for (const decl of css.split(';')) {
    const at = decl.indexOf(':');
    if (at < 0) continue;
    const prop = decl.slice(0, at).trim().toLowerCase();
    const value = decl.slice(at + 1).trim();
    if (!prop || !value || /url\s*\(|expression\s*\(|javascript:|@import/i.test(value)) continue;
    out[prop.startsWith('--') ? prop : prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = value.replace(/\s*!important\s*$/i, '');
  }
  return out as CSSProperties;
}

export interface FormattedTextOptions {
  /** Drops the `style` attributes. */
  disableStyleAttribute?: boolean;
  /** Turns the URLs of text outside links into links (sap.m.LinkConversion All / ProtocolOnly). */
  linkify?: (text: string) => ReactNode;
  /** CSS class of the links. */
  linkClassName?: string;
}

/** The plain text of a tree (FeedListItem._convertHtmlToPlainText). */
export function plainText(nodes: FormattedNode[]): string {
  return nodes.map((n) => (n.type === 'text' ? n.text : n.tag === 'br' ? '\n' : ELEMENTS.has(n.tag) ? plainText(n.children) : '')).join('');
}

/** The tree cut after `max` characters of plain text; line breaks become spaces (FeedListItem's collapsed text). */
export function truncateNodes(nodes: FormattedNode[], max: number): FormattedNode[] {
  let left = max;
  const cut = (list: FormattedNode[]): FormattedNode[] => {
    const out: FormattedNode[] = [];
    for (const n of list) {
      if (left <= 0) break;
      if (n.type === 'text') {
        const text = n.text.replace(/\n/g, ' ');
        out.push({ type: 'text', text: text.slice(0, left) });
        left -= text.length;
      } else if (n.tag === 'br') {
        out.push({ type: 'text', text: ' ' });
        left -= 1;
      } else if (ELEMENTS.has(n.tag)) {
        out.push({ ...n, children: cut(n.children) });
      }
    }
    return out;
  };
  return cut(nodes);
}

/** React elements of a parsed tree, with the FormattedText rules. */
export function renderNodes(nodes: FormattedNode[], o: FormattedTextOptions = {}, inLink = false, keyPrefix = 'f'): ReactNode[] {
  return nodes.map((n, i): ReactNode => {
    const key = `${keyPrefix}${i}`;
    if (n.type === 'text') return o.linkify && !inLink ? createElement(Fragment, { key }, o.linkify(n.text)) : n.text;
    if (!ELEMENTS.has(n.tag)) return null;
    const a = n.attrs;
    const style: CSSProperties = { ...(a.style && !o.disableStyleAttribute ? styleObject(a.style) : {}), position: 'static' };
    const props: Record<string, unknown> = { key, style };
    if (a.class) props.className = a.class;
    if (a.dir) props.dir = a.dir;
    if (n.tag === 'a') {
      props.href = a.href === undefined ? undefined : isSafeUrl(a.href) ? a.href : '#';
      // links without a target open in a new window, as in FormattedText
      props.target = a.target ?? (a.href !== undefined && isSafeUrl(a.href) ? '_blank' : undefined);
      if (props.target === '_blank') props.rel = 'noopener noreferrer';
      if (a.title) props.title = a.title;
      props.className = [o.linkClassName, a.class].filter(Boolean).join(' ') || undefined;
    }
    if (n.tag === 'br') return createElement('br', props);
    return createElement(n.tag, props, ...renderNodes(n.children, o, inLink || n.tag === 'a', `${key}-`));
  });
}
