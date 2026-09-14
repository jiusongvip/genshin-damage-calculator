import sharp from 'sharp';
import { readdirSync, statSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const IMG = path.resolve('public/images');
const OFFICIAL = path.join(IMG, 'official');

const ELEMENTS = ['pyro', 'hydro', 'electro', 'cryo', 'anemo', 'geo', 'dendro'];

function fmt(n) {
  return (n / 1024).toFixed(1).padStart(6) + ' KiB';
}

async function convert(file, out, width, quality, skipIfNotSmaller = false) {
  const before = statSync(file).size;
  const buf = await sharp(readFileSync(file)).resize({ width }).webp({ quality }).toBuffer();
  if (skipIfNotSmaller && buf.length >= before * 0.98) {
    console.log(`${path.relative(IMG, out).replaceAll('\\', '/').padEnd(40)} skipped (already optimal, ${fmt(before)})`);
    return;
  }
  writeFileSync(out, buf);
  const label = path.relative(IMG, out).replaceAll('\\', '/');
  console.log(`${label.padEnd(40)} src ${fmt(before)} -> ${fmt(buf.length)}${out === file ? ' (in place)' : ''}`);
}

for (const dir of [IMG, OFFICIAL]) {
  for (const f of readdirSync(dir)) {
    if (f.endsWith('.tmp')) rmSync(path.join(dir, f), { force: true });
  }
}

for (const el of ELEMENTS) {
  const f = path.join(IMG, `element-${el}.webp`);
  await convert(f, f, 120, 80, true);
}

const banners = readdirSync(OFFICIAL).filter(
  (f) => f.endsWith('.webp') && !/-\d+\.webp$/.test(f),
);

for (const b of banners) {
  const f = path.join(OFFICIAL, b);
  const base = b.replace(/\.webp$/, '');
  for (const [w, q] of [[450, 68], [540, 72], [720, 74]]) {
    await convert(f, path.join(OFFICIAL, `${base}-${w}.webp`), w, q);
  }
  await convert(f, f, 900, 74, true);
}
