// Exports $metadata of the running test services into packages/core/test/samples (docs/08-test-services.md §4).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const base = process.env.MOCK_URL ?? 'http://localhost:4400';
const out = join(import.meta.dirname, '../packages/core/test/samples');
mkdirSync(out, { recursive: true });
const jobs = [];
for (const service of ['purchasing', 'northwind']) {
  for (const lang of service === 'purchasing' ? ['en', 'zh'] : ['en']) {
    for (const format of ['xml', 'json']) {
      jobs.push({ service, lang, format, url: `${base}/odata/${service}/$metadata${format === 'json' ? '?$format=json' : ''}` });
    }
  }
}
for (const j of jobs) {
  const res = await fetch(j.url, { headers: { 'Accept-Language': j.lang, Accept: j.format === 'json' ? 'application/json' : 'application/xml' } });
  if (!res.ok) throw new Error(`${j.url}: HTTP ${res.status}`);
  let text = await res.text();
  if (j.format === 'json') text = JSON.stringify(JSON.parse(text), null, 1);
  const file = join(out, `${j.service}.${j.lang}.${j.format}`);
  writeFileSync(file, text);
  console.log(`${file} (${text.length} bytes)`);
}
