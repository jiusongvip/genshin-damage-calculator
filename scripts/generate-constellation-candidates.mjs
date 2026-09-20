// ============================================================================
// Extract candidate constellation / passive buffs from the generated text.
//
// The descriptions are prose, so this does NOT decide the damage model — it
// scans for explicit, numeric, self-buff sentences and writes a review list.
// High-confidence candidates are unconditional and unambiguous; everything
// conditional (when/after/stacks/party/for Xs) is tagged low. A human merges
// the ones that are safe into src/data/constellations.ts.
//
// Run: node scripts/generate-constellation-candidates.mjs
// ============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src/data/generated/constellations.ts'), 'utf8');

const sliceObject = (marker) => {
  const i = src.indexOf(marker);
  const j = src.indexOf(';\n', i);
  const json = src.slice(src.indexOf('{', i), j);
  return JSON.parse(json);
};

const CONSTELLATIONS = sliceObject('export const CONSTELLATIONS');
const PASSIVES = sliceObject('export const PASSIVES');

const charsSrc = readFileSync(join(root, 'src/data/characters.ts'), 'utf8');
const ELEMENT = {};
for (const line of charsSrc.split('\n')) {
  const m = line.match(/\{ id: '([^']+)'.*?element: '(\w+)'/);
  if (m) ELEMENT[m[1]] = m[2];
}

const ELEMENT_ADJ = { pyro: 'Pyro', hydro: 'Hydro', electro: 'Electro', cryo: 'Cryo', anemo: 'Anemo', geo: 'Geo', dendro: 'Dendro', physical: 'Physical' };

const CONDITIONAL = /(when|after|if |while|for \d|for its duration|triggered|trigger|for each|stack|nearby party|party member|excluding|during|upon|on hit|against opponent|opponents? (?:with|affected)|regenerat|heal|shield|energy|cooldown|duration|chance|random)/i;

// Each rule: a regex with the value in group 1, and the stat it maps to.
const RULES = [
  { stat: 'critDMG', pct: true, re: /CRIT DMG (?:is )?increased by (\d+(?:\.\d+)?)%/gi },
  { stat: 'critRate', pct: true, re: /CRIT Rate (?:is )?increased by (\d+(?:\.\d+)?)%/gi },
  { stat: 'atkPercent', pct: true, re: /\bATK (?:is )?increased by (\d+(?:\.\d+)?)%/gi },
  { stat: 'hpPercent', pct: true, re: /(?:Max HP|HP) (?:is )?increased by (\d+(?:\.\d+)?)%/gi },
  { stat: 'defPercent', pct: true, re: /\bDEF (?:is )?increased by (\d+(?:\.\d+)?)%/gi },
  { stat: 'er', pct: true, re: /Energy Recharge (?:is )?increased by (\d+(?:\.\d+)?)%/gi },
  { stat: 'em', pct: false, re: /Elemental Mastery (?:is )?increased by (\d+(?:\.\d+)?)/gi },
  { stat: 'defIgnore', pct: true, re: /ignore (\d+(?:\.\d+)?)% of opponents' DEF/gi },
  { stat: 'resShred', pct: true, re: /([A-Za-z-]+) RES(?: is)? (?:reduced|decreased) by (\d+(?:\.\d+)?)%/gi, valueGroup: 2, elementGroup: 1 },
  { stat: 'naDmgBonus', pct: true, re: /Normal Attack DMG (?:is )?increased by (\d+(?:\.\d+)?)%/gi },
  { stat: 'caDmgBonus', pct: true, re: /Charged Attack DMG (?:is )?increased by (\d+(?:\.\d+)?)%/gi },
  { stat: 'skillDmgBonus', pct: true, re: /Elemental Skill DMG (?:is )?increased by (\d+(?:\.\d+)?)%/gi },
  { stat: 'burstDmgBonus', pct: true, re: /Elemental Burst DMG (?:is )?increased by (\d+(?:\.\d+)?)%/gi },
  { stat: 'dmgBonus', pct: true, re: /(Pyro|Hydro|Electro|Cryo|Anemo|Geo|Dendro|Physical) DMG Bonus (?:is )?increased by (\d+(?:\.\d+)?)%/gi, valueGroup: 2, elementGroup: 1 },
];

const rows = [];
for (const [id, list] of Object.entries(CONSTELLATIONS)) {
  for (const c of list) rows.push({ id, source: `C${c.level}`, name: c.name, text: c.description });
}
for (const [id, list] of Object.entries(PASSIVES)) {
  list.forEach((p, i) => rows.push({ id, source: `passive${i + 1}`, name: p.name, text: p.description }));
}

const candidates = [];
for (const row of rows) {
  if (!row.text) continue;
  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    let m;
    while ((m = rule.re.exec(row.text))) {
      const raw = m[rule.valueGroup ?? 1];
      const value = parseFloat(raw) / (rule.pct ? 100 : 1);
      // Element-specific RES shred is only safe if it matches the character.
      if (rule.elementGroup) {
        const adj = m[rule.elementGroup];
        if (ELEMENT_ADJ[ELEMENT[row.id]] !== adj) continue;
      }
      const conditional = CONDITIONAL.test(row.text);
      candidates.push({ id: row.id, source: row.source, name: row.name, stat: rule.stat, value, conditional, snippet: m[0] });
    }
  }
}

const high = candidates.filter((c) => !c.conditional);
const low = candidates.filter((c) => c.conditional);

const fmt = (c) => `| ${c.id} | ${c.source} · ${c.name} | ${c.stat} | ${c.value} | ${c.snippet.replace(/\|/g, '/')} |`;

const md = `# Constellation / passive candidate buffs

Auto-extracted from the generated descriptions. **High** = unconditional and
explicit; **Low** = contains a conditional/party/heal/energy marker and needs a
human read. Nothing here is applied yet — merge the safe ones into
\`src/data/constellations.ts\`.

Generated: ${new Date().toISOString().slice(0, 10)}

## High confidence (${high.length})

| character | source | stat | value | matched |
|---|---|---|---|---|
${high.map(fmt).join('\n')}

## Low confidence (${low.length}) — needs review

| character | source | stat | value | matched |
|---|---|---|---|---|
${low.map(fmt).join('\n')}
`;

writeFileSync(join(root, 'constellation-candidates.md'), md);
console.log(`candidates: ${candidates.length} (high ${high.length}, low ${low.length})`);
console.log(`characters with >=1 high: ${new Set(high.map((c) => c.id)).size}`);
