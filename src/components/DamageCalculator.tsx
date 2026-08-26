import { useMemo, useState } from 'react';
import { CHARACTERS } from '../data/characters';
import { weaponsForType } from '../data/weapons';
import { ENEMIES } from '../data/enemies';
import { DEFAULT_BUFFS, BUFF_PRESETS, resolvePreset } from '../data/presets';
import {
  computeDamage,
  computeFromPanel,
  formatNumber,
  formatPercent,
} from '../lib/damage';
import type {
  AmplifiedReaction,
  BuffState,
  ElementType,
  TransformativeReaction,
} from '../lib/damage';
import { fetchEnkaPanel } from '../lib/enka';
import type { ImportedPanel } from '../lib/enka';
import { adviseManual, advisePanel } from '../lib/advisor';

const ELEMENT_STYLES: Record<ElementType, { text: string; label: string }> = {
  pyro: { text: 'text-pyro', label: 'Pyro' },
  hydro: { text: 'text-hydro', label: 'Hydro' },
  electro: { text: 'text-electro', label: 'Electro' },
  cryo: { text: 'text-cryo', label: 'Cryo' },
  anemo: { text: 'text-anemo', label: 'Anemo' },
  geo: { text: 'text-geo', label: 'Geo' },
  dendro: { text: 'text-dendro', label: 'Dendro' },
  physical: { text: 'text-gray-300', label: 'Physical' },
};

// Group the full roster by element (5-star first) for a navigable selector.
const CHARACTER_GROUPS = (['pyro', 'hydro', 'electro', 'cryo', 'anemo', 'geo', 'dendro'] as const).map((el) => ({
  label: ELEMENT_STYLES[el].label,
  chars: CHARACTERS.filter((c) => c.element === el).sort((a, b) => b.rarity - a.rarity),
}));

const AMPLIFIED_OPTIONS: { value: AmplifiedReaction; label: string }[] = [
  { value: 'none', label: 'No reaction' },
  { value: 'vaporize', label: 'Vaporize (×1.5)' },
  { value: 'melt', label: 'Melt (×2.0)' },
];

const TRANSFORMATIVE_OPTIONS: { value: TransformativeReaction; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'overload', label: 'Overload' },
  { value: 'electroCharged', label: 'Electro-Charged' },
  { value: 'superconduct', label: 'Superconduct' },
  { value: 'swirl', label: 'Swirl' },
  { value: 'bloom', label: 'Bloom' },
  { value: 'hyperbloom', label: 'Hyperbloom' },
  { value: 'burgeon', label: 'Burgeon' },
];

function mergeBuffs(ids: string[]): BuffState {
  const merged: BuffState = { ...DEFAULT_BUFFS };
  for (const id of ids) {
    const preset = BUFF_PRESETS.find((b) => b.id === id);
    if (preset) Object.assign(merged, preset.buffs);
  }
  return merged;
}

function defaultAmplified(element: ElementType): AmplifiedReaction {
  if (element === 'pyro') return 'vaporize';
  if (element === 'cryo') return 'melt';
  return 'none';
}

export default function DamageCalculator() {
  const first = CHARACTERS[0];
  const [charId, setCharId] = useState(first.id);
  const [weaponId, setWeaponId] = useState(first.bestWeapon);
  const [enemyId, setEnemyId] = useState('hilichurl');
  const [amplified, setAmplified] = useState<AmplifiedReaction>(defaultAmplified(first.element));
  const [transformative, setTransformative] = useState<TransformativeReaction>('none');
  const [buffIds, setBuffIds] = useState<string[]>([]);
  const [skillMult, setSkillMult] = useState(first.skillMultiplier);
  const [charLevel, setCharLevel] = useState(90);
  const [uid, setUid] = useState('');
  const [imported, setImported] = useState<ImportedPanel | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [baseline, setBaseline] = useState<{ expected: number; label: string } | null>(null);

  const character = CHARACTERS.find((c) => c.id === charId) ?? first;
  const weaponOptions = weaponsForType(character.weaponType);
  const weapon = weaponOptions.find((w) => w.id === weaponId) ?? weaponOptions[0];
  const enemy = ENEMIES.find((e) => e.id === enemyId) ?? ENEMIES[0];

  const onSelectCharacter = (id: string) => {
    const c = CHARACTERS.find((x) => x.id === id);
    if (!c) return;
    setCharId(id);
    setWeaponId(c.bestWeapon);
    setSkillMult(c.skillMultiplier);
    setAmplified(defaultAmplified(c.element));
    setImported(null);
  };

  const toggleBuff = (id: string) => {
    setBuffIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const doImport = async () => {
    setImporting(true);
    setImportError('');
    const panel = await fetchEnkaPanel(uid);
    setImporting(false);
    if (!panel) {
      setImportError('Could not load that UID. Check the number and that your in-game showcase is public, then try again.');
      return;
    }
    setImported(panel);
    setCharLevel(panel.level);
    if (panel.characterId) {
      const c = CHARACTERS.find((x) => x.id === panel.characterId);
      if (c) {
        setCharId(c.id);
        setWeaponId(c.bestWeapon);
        setSkillMult(c.skillMultiplier);
      }
    }
  };

  const result = useMemo(() => {
    const buffs = mergeBuffs(buffIds);
    if (imported) {
      const panel = computeFromPanel({
        totalATK: imported.totalATK,
        critRate: imported.critRate,
        critDMG: imported.critDMG,
        dmgBonus: imported.dmgBonus || imported.physicalBonus,
        em: imported.em,
        skillMultiplier: skillMult,
        characterLevel: imported.level,
        enemy,
        element: imported.element ?? 'physical',
        amplified,
        transformative,
        defShred: buffs.defShred,
        resShred: buffs.resShred,
        reactionBonus: buffs.reactionBonus,
      });
      return {
        ...panel,
        totalATK: imported.totalATK,
        critRate: imported.critRate,
        critDMG: imported.critDMG,
        em: imported.em,
        dmgBonus: imported.dmgBonus || imported.physicalBonus,
      };
    }
    return computeDamage({
      character,
      weapon,
      artifacts: resolvePreset(character),
      buffs,
      enemy,
      characterLevel: charLevel,
      amplified,
      transformative,
    });
  }, [imported, buffIds, skillMult, enemy, amplified, transformative, character, weapon, charId, charLevel, first.id]);

  const { totalATK, critRate, critDMG, em, dmgBonus } = result;

  const buffNames = BUFF_PRESETS.filter((b) => buffIds.includes(b.id)).map((b) => b.label);

  const advice = useMemo(() => {
    const buffs = mergeBuffs(buffIds);
    if (imported) {
      return advisePanel({
        totalATK: imported.totalATK,
        critRate: imported.critRate,
        critDMG: imported.critDMG,
        dmgBonus: imported.dmgBonus || imported.physicalBonus,
        em: imported.em,
        skillMultiplier: skillMult,
        characterLevel: imported.level,
        enemy,
        element: imported.element ?? 'physical',
        amplified,
        transformative,
        defShred: buffs.defShred,
        resShred: buffs.resShred,
        reactionBonus: buffs.reactionBonus,
      });
    }
    return adviseManual({
      character,
      weapon,
      artifacts: resolvePreset(character),
      buffs,
      enemy,
      characterLevel: charLevel,
      amplified,
      transformative,
    });
  }, [imported, buffIds, skillMult, enemy, amplified, transformative, character, weapon, charId, charLevel, first.id]);

  const multipliers = useMemo(() => {
    const crit = 1 + critRate * critDMG;
    const dmg = 1 + dmgBonus;
    return [
      { name: 'ATK', value: totalATK, baseline: 2200, display: formatNumber(totalATK) },
      { name: 'Skill', value: skillMult, baseline: 4, display: `×${skillMult.toFixed(2)}` },
      { name: 'DMG Bonus', value: dmg, baseline: 1.466, display: `×${dmg.toFixed(3)}` },
      { name: 'Crit', value: crit, baseline: 1.7, display: `×${crit.toFixed(2)}` },
      { name: 'Reaction', value: result.reactionMultiplier, baseline: 1.3, display: `×${result.reactionMultiplier.toFixed(2)}` },
      { name: 'DEF', value: result.defMultiplier, baseline: 0.5, display: `×${result.defMultiplier.toFixed(3)}` },
      { name: 'RES', value: result.resMultiplier, baseline: 0.9, display: `×${result.resMultiplier.toFixed(3)}` },
    ];
  }, [totalATK, skillMult, dmgBonus, critRate, critDMG, result]);

  const delta = baseline ? (result.expected - baseline.expected) / baseline.expected : 0;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
      {/* ---------- Input panel ---------- */}
      <div className="panel p-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--muted)]">Character</span>
            <select
              className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-[var(--text)]"
              value={charId}
              onChange={(e) => onSelectCharacter(e.target.value)}
            >
              {CHARACTER_GROUPS.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.chars.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--muted)]">Weapon</span>
            <select
              className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-[var(--text)]"
              value={weapon?.id ?? ''}
              onChange={(e) => setWeaponId(e.target.value)}
            >
              {weaponOptions.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--muted)]">Enemy</span>
            <select
              className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-[var(--text)]"
              value={enemyId}
              onChange={(e) => setEnemyId(e.target.value)}
            >
              {ENEMIES.map((en) => (
                <option key={en.id} value={en.id}>{en.name} (Lv {en.level})</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--muted)]">Amplified reaction</span>
            <select
              className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-[var(--text)]"
              value={amplified}
              onChange={(e) => setAmplified(e.target.value as AmplifiedReaction)}
            >
              {AMPLIFIED_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--muted)]">Transformative reaction</span>
            <select
              className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-[var(--text)]"
              value={transformative}
              onChange={(e) => setTransformative(e.target.value as TransformativeReaction)}
            >
              {TRANSFORMATIVE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--muted)]">
              Skill multiplier <span className="text-[var(--muted)]/70">(e.g. 6.17 = 617%)</span>
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-[var(--text)]"
              value={skillMult}
              onChange={(e) => setSkillMult(Math.max(0, parseFloat(e.target.value) || 0))}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--muted)]">Character level</span>
            <input
              type="number"
              step="1"
              min="1"
              max="90"
              className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-[var(--text)]"
              value={charLevel}
              onChange={(e) => setCharLevel(Math.min(90, Math.max(1, parseInt(e.target.value, 10) || 90)))}
            />
          </label>
        </div>

        {/* Team buffs */}
        <div className="mt-5">
          <span className="mb-2 block text-sm font-medium text-[var(--muted)]">Team buffs (toggle to stack)</span>
          <div className="flex flex-wrap gap-2">
            {BUFF_PRESETS.map((b) => {
              const active = buffIds.includes(b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => toggleBuff(b.id)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? 'border-gold-400 bg-gold-400/15 text-gold-300'
                      : 'border-[var(--line)] bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--text)]'
                  }`}
                >
                  {b.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* UID import */}
        <div className="mt-6 border-t border-[var(--line)] pt-5">
          <span className="mb-2 block text-sm font-medium text-[var(--muted)]">
            Import your real build by UID <span className="text-[var(--muted)]/70">(via Enka.network, no login)</span>
          </span>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              placeholder="e.g. 600123456"
              className="flex-1 rounded-[10px] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-[var(--text)]"
              value={uid}
              onChange={(e) => setUid(e.target.value)}
            />
            <button
              type="button"
              onClick={doImport}
              disabled={importing}
              className="rounded-[10px] bg-gold-400 px-4 py-2.5 text-sm font-semibold text-[#0b1224] transition-colors hover:bg-gold-300 disabled:opacity-60"
            >
              {importing ? 'Loading…' : 'Import'}
            </button>
          </div>
          {importError && <p className="mt-2 text-sm text-pyro">{importError}</p>}
          {imported && (
            <p className="mt-2 text-sm text-dendro">
              Imported: {imported.characterName} (Lv {imported.level}) · {buffNames.length > 0 ? `with ${buffNames.join(' + ')}` : 'no team buffs'}
            </p>
          )}
        </div>
      </div>

      {/* ---------- Result panel ---------- */}
      <div className="flex flex-col gap-6">
        <div className="panel p-6 text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">Expected damage</p>
          <p className="tnum mt-2 text-5xl font-semibold tracking-tight text-gold-300">
            {formatNumber(result.expected)}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">averaged over crits · {result.reactionName}</p>

          {baseline && (
            <p className={`tnum mt-2 text-sm font-semibold ${delta >= 0 ? 'text-dendro' : 'text-pyro'}`}>
              {delta >= 0 ? '+' : ''}{formatPercent(delta)} vs baseline ({formatNumber(baseline.expected)})
            </p>
          )}

          <div className="mt-5 grid grid-cols-3 gap-3 border-t border-[var(--line)] pt-5">
            <div>
              <p className="text-xs text-[var(--muted)]">Non-crit</p>
              <p className="tnum text-lg font-semibold text-[var(--text)]">{formatNumber(result.nonCrit)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">Crit hit</p>
              <p className="tnum text-lg font-semibold text-gold-300">{formatNumber(result.critHit)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">Reaction</p>
              <p className="tnum text-lg font-semibold text-[var(--text)]">
                {result.transformative > 0 ? formatNumber(result.transformative) : '—'}
              </p>
            </div>
          </div>
          {result.transformative > 0 && (
            <p className="mt-1 text-xs text-[var(--muted)]">{result.transformativeName} reaction damage</p>
          )}

          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => setBaseline({ expected: result.expected, label: `${character.name} · ${weapon?.name}` })}
              className="rounded-[10px] border border-[var(--line)] px-4 py-2 text-xs font-medium text-[var(--muted)] transition-colors hover:border-gold-400/60 hover:text-gold-300"
            >
              Pin current as baseline (A)
            </button>
            {baseline && (
              <button
                type="button"
                onClick={() => setBaseline(null)}
                className="rounded-[10px] px-3 py-2 text-xs text-[var(--muted)] transition-colors hover:text-[var(--text)]"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Multiplier breakdown */}
        <div className="panel p-6">
          <h3 className="text-sm font-semibold text-[var(--text)]">Damage breakdown</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">Each multiplier's contribution — red bars mark your weakest links.</p>
          <div className="mt-4 space-y-3">
            {multipliers.map((m) => {
              const pct = Math.max((m.value / m.baseline) * 100, 4);
              const weak = m.value < m.baseline * 0.85;
              return (
                <div key={m.name}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--muted)]">{m.name}</span>
                    <span className={`tnum font-medium ${weak ? 'text-pyro' : 'text-[var(--text)]'}`}>{m.display}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
                    <div
                      className={`h-full rounded-full ${weak ? 'bg-pyro/70' : 'bg-gold-400/70'}`}
                      style={{ width: `${Math.min(pct, 150)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stat summary */}
        <div className="panel p-6">
          <h3 className="text-sm font-semibold text-[var(--text)]">Panel</h3>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div className="flex justify-between border-b border-[var(--line)] pb-2">
              <dt className="text-[var(--muted)]">Total ATK</dt>
              <dd className="tnum font-medium text-[var(--text)]">{formatNumber(totalATK)}</dd>
            </div>
            <div className="flex justify-between border-b border-[var(--line)] pb-2">
              <dt className="text-[var(--muted)]">Crit Rate</dt>
              <dd className="tnum font-medium text-[var(--text)]">{formatPercent(critRate)}</dd>
            </div>
            <div className="flex justify-between border-b border-[var(--line)] pb-2">
              <dt className="text-[var(--muted)]">Crit DMG</dt>
              <dd className="tnum font-medium text-[var(--text)]">{formatPercent(critDMG)}</dd>
            </div>
            <div className="flex justify-between border-b border-[var(--line)] pb-2">
              <dt className="text-[var(--muted)]">Elemental Mastery</dt>
              <dd className="tnum font-medium text-[var(--text)]">{Math.round(em)}</dd>
            </div>
            <div className="flex justify-between border-b border-[var(--line)] pb-2">
              <dt className="text-[var(--muted)]">DEF multiplier</dt>
              <dd className="tnum font-medium text-[var(--text)]">×{(result.defMultiplier).toFixed(3)}</dd>
            </div>
            <div className="flex justify-between border-b border-[var(--line)] pb-2">
              <dt className="text-[var(--muted)]">RES multiplier</dt>
              <dd className="tnum font-medium text-[var(--text)]">×{(result.resMultiplier).toFixed(3)}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-[var(--muted)]">
            <span className={ELEMENT_STYLES[character.element].text}>{ELEMENT_STYLES[character.element].label}</span> damage
            {' · '}vs {enemy.name}
            {' · '}{buffNames.length > 0 ? `Buffs: ${buffNames.join(', ')}` : 'No team buffs'}
          </p>
        </div>

        {/* Advisor */}
        {advice.length > 0 && (
          <div className="panel border-gold-400/40 bg-gold-400/5 p-6">
            <h3 className="text-sm font-semibold text-gold-300">Highest-value upgrades</h3>
            <ul className="mt-3 space-y-3">
              {advice.map((a, i) => (
                <li key={a.label} className="flex items-start gap-3">
                  <span className="tnum mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold-400/20 text-xs font-semibold text-gold-300">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--text)]">
                      {a.label} <span className="tnum ml-1 font-semibold text-dendro">+{formatPercent(a.gainPercent)}</span>
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">{a.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
