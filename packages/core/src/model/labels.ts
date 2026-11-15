/** Turns a property or type name into words: OrderDate → "Order Date", unit_price → "Unit Price", CategoryID → "Category ID". */
export function humanize(name: string): string {
  const cleaned = name.replace(/^_+/, '').replace(/[_-]+/g, ' ');
  const words = cleaned
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/\s+/)
    .filter(Boolean);
  return words.map((w) => (w === w.toUpperCase() ? w : w[0]!.toUpperCase() + w.slice(1))).join(' ');
}

/** Naive English plural used only for derived TypeNamePlural. */
export function pluralize(word: string): string {
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/i.test(word)) return `${word}es`;
  return `${word}s`;
}
