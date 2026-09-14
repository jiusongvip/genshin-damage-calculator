import sharp from 'sharp';
import { readdirSync, statSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const IMG = path.resolve('public/images');
const OFFICIAL = path.join(IMG, 'official');

const ELEMENTS = ['pyro', 'hydro', 'electro', 'cryo', 'anemo', 'geo', 'dendro'];

function fmt(n) {
  return (n / 1024).toFixed(1).padStart(6) + ' KiB';
}

async function convert(file, out, width, quality) {
  const before = statSync(file).size;
  const buf = await sharp(readFileSync(file)).resize({ width }).webp({ quality }).toBuffer();
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
  await convert(f, f, 120, 80);
}

const banners = readdirSync(OFFICIAL).filter(
  (f) => f.endsWith('.webp') && !/-\d+\.webp$/.test(f) && statSync(path.join(OFFICIAL, f)).size > 20_000,
);

for (const b of banners) {
  const f = path.join(OFFICIAL, b);
  const base = b.replace(/\.webp$/, '');
  await convert(f, path.join(OFFICIAL, `${base}-450.webp`), 450, 72);
  await convert(f, path.join(OFFICIAL, `${base}-660.webp`), 660, 75);
  await convert(f, f, 900, 80);
}
