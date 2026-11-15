// Deterministic invented demo data (English only). Nothing here comes from a real system.

/** Seeded PRNG (mulberry32). */
export class Fake {
  constructor(seed) {
    this.s = seed >>> 0;
  }
  /** [0, 1) */
  double() {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** integer in [0, n) */
  next(n) {
    return Math.floor(this.double() * n);
  }
  pick(items) {
    return items[this.next(items.length)];
  }
  chance(p) {
    return this.double() < p;
  }
  between(min, maxInclusive) {
    return min + this.next(maxInclusive - min + 1);
  }
  dec(min, max, scale) {
    return round(min + this.double() * (max - min), scale);
  }
  word() {
    return this.pick(START) + this.pick(MID) + this.pick(END);
  }
  companyName() {
    return `${this.word()} ${this.pick(TRADE)} ${this.pick(LEGAL)}`;
  }
  personName() {
    return `${this.pick(FIRST)} ${this.pick(LAST)}`;
  }
  firstName() {
    return this.pick(FIRST);
  }
  lastName() {
    return this.pick(LAST);
  }
  place() {
    const p = this.pick(PLACES);
    return { country: p[0], city: this.pick(p[1]) };
  }
  phone() {
    return `+${this.between(10, 99)} ${this.between(100, 999)} ${this.between(1000, 9999)}`;
  }
  /** weighted([[value, weight], ...]) */
  weighted(items) {
    const total = items.reduce((s, [, w]) => s + w, 0);
    let x = this.next(total);
    for (const [v, w] of items) {
      if (x < w) return v;
      x -= w;
    }
    return items[items.length - 1][0];
  }
}

/** Rounds half away from zero to `scale` digits (as a number). */
export function round(v, scale) {
  const f = 10 ** scale;
  return (Math.sign(v) * Math.round(Math.abs(v) * f + Number.EPSILON)) / f;
}

const START = ['Bra', 'Cor', 'Del', 'Fen', 'Gal', 'Hal', 'Ker', 'Lum', 'Mar', 'Nor', 'Ost', 'Pel', 'Quin', 'Ros', 'Sel', 'Tav', 'Ul', 'Ver', 'Wes', 'Zan', 'Ash', 'Bel', 'Cal', 'Dun'];
const MID = ['a', 'e', 'i', 'o', 'u', 'an', 'en', 'or', 'ar', 'il', 'ul', 'es'];
const END = ['dor', 'ford', 'mont', 'vale', 'wick', 'ton', 'ley', 'brook', 'dale', 'tech', 'line', 'gate', 'field', 'stone', 'mark', 'port'];
const TRADE = ['Industrial', 'Components', 'Supply', 'Metals', 'Plastics', 'Logistics', 'Electronics', 'Tooling', 'Packaging', 'Chemicals', 'Systems', 'Materials', 'Fasteners', 'Textiles'];
const LEGAL = ['Ltd', 'Inc', 'GmbH', 'AG', 'Co.', 'LLC', 'S.A.', 'B.V.'];
const FIRST = ['Alex', 'Morgan', 'Robin', 'Jamie', 'Taylor', 'Casey', 'Jordan', 'Riley', 'Avery', 'Quinn', 'Drew', 'Sam', 'Kai', 'Noa', 'Eli', 'Lou'];
const LAST = ['Harlow', 'Penrose', 'Whitcombe', 'Ardent', 'Marlow', 'Kestrel', 'Fairbank', 'Linden', 'Thorne', 'Ellery', 'Corwin', 'Hale', 'Vance', 'Sorrell'];
const PLACES = [
  ['DE', ['Hamburg', 'Munich', 'Cologne', 'Leipzig']],
  ['US', ['Chicago', 'Denver', 'Austin', 'Portland']],
  ['CN', ['Shanghai', 'Shenzhen', 'Suzhou', 'Chengdu']],
  ['FR', ['Lyon', 'Lille', 'Nantes']],
  ['JP', ['Osaka', 'Nagoya', 'Yokohama']],
  ['GB', ['Leeds', 'Bristol', 'Glasgow']],
  ['IT', ['Turin', 'Bologna']],
  ['NL', ['Utrecht', 'Eindhoven']],
];

/** Calendar date helpers on "YYYY-MM-DD" strings (UTC, no time zone effects). */
export const day = {
  toNum: (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000,
  fromNum: (n) => new Date(n * 86400000).toISOString().slice(0, 10),
  add: (s, days) => day.fromNum(day.toNum(s) + days),
};
