import { useEffect, useMemo, useRef, useState } from 'react';
import { RELEASED_CHARACTERS as CHARACTERS } from '../data/characters';
import { NO_ARTIFACTS } from '../data/presets';
import { addBuffs, computeDamage, formatNumber } from '../lib/damage';
import type {
  ArtifactBuild,
  BuffState,
  ElementType,
  SecondaryStatType,
} from '../lib/damage';
import { ELEMENT_LABEL } from '../data/elements';
import type { TalentKey } from '../data/talents';
import { talentRowsFor } from '../data/generated/talents';
import { CONSTELLATION_TALENT_BONUS } from '../data/generated/constellationTalents';
import { weaponPassiveFor } from '../data/generated/weaponPassives';
import { weaponPassiveMaxStacks, WEAPON_PASSIVE_EFFECTS } from '../data/weaponPassives';
import { resolveSetBuffs } from '../data/artifactSets';
import { resolvePartyBuffs } from '../data/partyBuffs';
import type { PartyState } from '../data/partyBuffs';
import { constellationsFor, passivesFor } from '../data/generated/constellations';
import { CONSTELLATION_EFFECTS, PASSIVE_EFFECTS } from '../data/constellations';
import { overlayBaseline, snapshotBaseline } from './DamageTable';
import type { DamageRowVm, DamageGroupVm, DamageBaseline } from './DamageTable';
import { draftToGroups, resolveBuild } from '../lib/draft-build';
import {
  addScenario,
  loadScenarios,
  removeScenario,
  storageAvailable,
} from '../lib/scenarios';
import type { Scenario } from '../lib/scenarios';
import { ElementIcon } from './ElementIcon';
import {
  AMPLIFIED,
  ELEMENT_BG,
  ELEMENTS,
  GROUP_TO_TALENT,
  NO_TALENT_NOTE,
  REACHABLE_REACTIONS,
  TRANSFORMATIVE,
} from './calculator/constants';
import {
  bucketOf,
  clamp,
  defaultsFor,
  draftFromQuery,
  draftToQuery,
  effectiveTalentLevels,
  EMPTY_SETS,
  signatureMultiplierAt,
} from './calculator/draft';
import type { Draft } from './calculator/draft';
import { zoneRefs } from './calculator/primitives';
import { DamagePanel } from './calculator/DamagePanel';
import { EquipmentPanel } from './calculator/EquipmentPanel';
import { CharacterPassives, CharacterStats } from './calculator/CharacterPanel';
import { ScenarioBar } from './calculator/ScenarioBar';
import { BaseZone } from './calculator/zones/BaseZone';
import { BonusZone } from './calculator/zones/BonusZone';
import { CritZone } from './calculator/zones/CritZone';
import { DefZone } from './calculator/zones/DefZone';
import { ReactionZone } from './calculator/zones/ReactionZone';
import { ResZone } from './calculator/zones/ResZone';


export default function SingleCalculator() {
  const initial = CHARACTERS[0];
  const [draft, setDraft] = useState<Draft>(() => defaultsFor(initial));
  const [query, setQuery] = useState('');
  const [elementFilter, setElementFilter] = useState<'all' | ElementType>('all');
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerDialog = useRef<HTMLDialogElement | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [tab, setTab] = useState<'character' | 'equipment' | 'multipliers' | 'damage'>('damage');

  // Resolve the draft into the concrete build (character / weapon / enemy /
  // zone-floor stats / pre-set base buffs). Shared with the "Compare against a
  // saved scenario" flow so a stored panel diffs identically to a live one.
  const build = useMemo(() => resolveBuild(draft), [draft]);
  const { character, weaponOptions, weapon, enemy, whiteboard, ownEM, baseBuffs, setPicks } = build;

  const weaponPassive = weaponPassiveFor(draft.weaponId);
  const weaponEffect = WEAPON_PASSIVE_EFFECTS[draft.weaponId];
  const weaponMaxStacks = weaponPassiveMaxStacks(draft.weaponId);
  const weaponRefDesc =
    weaponPassive?.refinements[Math.min(Math.max(draft.weaponRefine, 1), 5) - 1]?.description ?? '';

  const constellations = useMemo(() => constellationsFor(character.id) ?? [], [character.id]);
  const ascensionPassives = useMemo(() => passivesFor(character.id) ?? [], [character.id]);
  const consModelled = CONSTELLATION_EFFECTS[character.id] ?? {};
  const passiveModelled = PASSIVE_EFFECTS[character.id] ?? {};

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  /** Merge a partial patch into the draft — what the zone components call. */
  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  /** Merge a partial patch into the declared party-buff state. */
  const setParty = (p: Partial<PartyState>) => setDraft((d) => ({ ...d, party: { ...d.party, ...p } }));

  /** Changing the attack type re-derives the signature multiplier and drops
   *  whatever row was loaded from the per-hit table. */
  const changeAttackType = (t: TalentKey) =>
    setDraft((d) => ({
      ...d,
      attackType: t,
      skillMult:
        signatureMultiplierAt(character.id, t, effectiveTalentLevels(character.id, d.talentLevels, d.constellation)) ||
        d.skillMult,
      activeRowId: null,
      elementOverride: null,
      scalingOverride: null,
    }));

  /** From a chain step in the damage tab, reveal and highlight its zone. */
  const jumpToZone = (id: string) => {
    setHighlight(id);
    setTab('multipliers');
    requestAnimationFrame(() => zoneRefs.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  };

  /** Editing the multiplier by hand detaches it from the picked row. */
  const changeSkillMult = (v: number) => setDraft((d) => ({ ...d, skillMult: v, activeRowId: null }));

  /** Raising the constellation re-derives the signature multiplier — unless a
   *  table row is loaded, in which case that row owns the multiplier. */
  const changeConstellation = (cn: number) =>
    setDraft((d) => ({
      ...d,
      constellation: cn,
      skillMult: d.activeRowId
        ? d.skillMult
        : signatureMultiplierAt(character.id, d.attackType, effectiveTalentLevels(character.id, d.talentLevels, cn)) || d.skillMult,
    }));

  /** Picking "Custom…" seeds the level from the preset it replaces. */
  const changeEnemy = (id: string) =>
    setDraft((d) => (id === 'custom' ? { ...d, customEnemy: true, enemyLevel: enemy.level } : { ...d, customEnemy: false, enemyId: id }));

  const setArtifact = (patch: Partial<ArtifactBuild>) =>
    setDraft((d) => ({ ...d, artifacts: { ...d.artifacts, ...patch } }));

  /** Which set an artifact piece belongs to ('' = off-piece). */
  const setPieceSet = (piece: 'flower' | 'plume' | 'sands' | 'goblet' | 'circlet', value: string) => {
    setDraft((d) => ({
      ...d,
      artifacts: {
        ...d.artifacts,
        sets: { ...(d.artifacts.sets ?? EMPTY_SETS), [piece]: value === 'none' ? '' : value },
      },
    }));
  };

  /** Set / clear one sub-stat slot on a piece (pieceIdx, slot 0-3). */
  const setPieceSub = (pieceIdx: number, slot: number, type: SecondaryStatType | 'none') => {
    setDraft((d) => {
      const pieceSubs = Array.from({ length: 5 }, (_, i) => [...(d.artifacts.pieceSubs?.[i] ?? [])]);
      const piece = pieceSubs[pieceIdx];
      if (type === 'none') piece[slot] = undefined;
      else piece[slot] = { type, value: piece[slot]?.value ?? 0 };
      return { ...d, artifacts: { ...d.artifacts, pieceSubs } };
    });
  };

  const setPieceSubValue = (pieceIdx: number, slot: number, raw: number, percent: boolean) => {
    setDraft((d) => {
      const pieceSubs = Array.from({ length: 5 }, (_, i) => [...(d.artifacts.pieceSubs?.[i] ?? [])]);
      const cur = pieceSubs[pieceIdx][slot];
      if (!cur) return d;
      pieceSubs[pieceIdx][slot] = { type: cur.type, value: clamp(percent ? raw / 100 : raw, 0, 100000) };
      return { ...d, artifacts: { ...d.artifacts, pieceSubs } };
    });
  };

  const pickCharacter = (id: string) => {
    const c = CHARACTERS.find((x) => x.id === id);
    if (!c) return;
    setDraft(defaultsFor(c));
  };

  // The element and attack type the zones currently describe — used to filter
  // element- and attack-type-specific artifact set and party bonuses.
  const activeElement: ElementType = draft.elementOverride ?? character.element;
  const activeAttack: TalentKey = draft.attackType;

  const buffs: BuffState = useMemo(
    () =>
      addBuffs(
        baseBuffs,
        resolveSetBuffs(setPicks, activeElement, activeAttack),
        resolvePartyBuffs(draft.party, activeElement),
      ),
    [baseBuffs, setPicks, activeElement, activeAttack, draft.party],
  );

  // Reactions this character can trigger, with their current values, so the
  // numbers are visible at a glance instead of one selected at a time.
  const reactionPreviews = useMemo(() => {
    const reach = REACHABLE_REACTIONS[character.element] ?? { amplified: [], transformative: [] };
    const tName = Object.fromEntries(TRANSFORMATIVE.map((o) => [o.value, o.label])) as Record<string, string>;
    const aName = Object.fromEntries(AMPLIFIED.map((o) => [o.value, o.label])) as Record<string, string>;
    const common = {
      character,
      weapon,
      artifacts: draft.artifacts,
      buffs,
      enemy,
      characterLevel: draft.level,
      attackType: draft.attackType,
      skillMultiplier: draft.skillMult,
      element: draft.elementOverride ?? undefined,
      scaling: draft.scalingOverride ?? undefined,
    };
    const amplified = reach.amplified.map((key) => ({
      key,
      label: aName[key] ?? key,
      multiplier: computeDamage({ ...common, amplified: key, transformative: 'none' }).reactionMultiplier,
    }));
    const transformative = reach.transformative.map((key) => ({
      key,
      label: key === 'swirl' ? `${tName[key]} (${ELEMENT_LABEL[draft.swirlElement]})` : tName[key] ?? key,
      value: computeDamage({ ...common, amplified: 'none', transformative: key, swirlElement: draft.swirlElement }).transformative,
    }));
    return { amplified, transformative };
  }, [character, weapon, draft.artifacts, buffs, enemy, draft.level, draft.attackType, draft.skillMult, draft.elementOverride, draft.scalingOverride, draft.swirlElement]);

  const result = useMemo(
    () =>
      computeDamage({
        character,
        weapon,
        artifacts: draft.artifacts,
        buffs,
        enemy,
        characterLevel: draft.level,
        attackType: draft.attackType,
        skillMultiplier: draft.skillMult,
        element: draft.elementOverride ?? undefined,
        scaling: draft.scalingOverride ?? undefined,
        amplified: draft.amplified,
        additive: draft.additive,
        transformative: draft.transformative,
        swirlElement: draft.transformative === 'swirl' ? draft.swirlElement : undefined,
      }),
    [character, weapon, draft.artifacts, buffs, enemy, draft.level, draft.attackType, draft.skillMult, draft.elementOverride, draft.scalingOverride, draft.amplified, draft.additive, draft.transformative, draft.swirlElement],
  );

  const baseDamage =
    result.baseStat * result.skillMultiplier * (1 + result.baseDmgBonus) + result.additive + draft.flatBaseDmg;
  const dmgMult = Math.max(0, 1 + result.dmgBonus - draft.dmgReduction);
  const critMult =
    draft.critMode === 'crit'
      ? 1 + result.critDMG
      : draft.critMode === 'nonCrit'
        ? 1
        : 1 + result.critRate * result.critDMG;
  const hit = baseDamage * dmgMult * critMult * result.reactionMultiplier * result.defMultiplier * result.resMultiplier;
  const expected = Math.min(hit, 20_000_000);
  const capped = hit > 20_000_000;

  // ---- Per-hit damage table ------------------------------------------------
  const talentRows = useMemo(() => talentRowsFor(character.id) ?? [], [character.id]);
  // Without per-hit rows every figure would fall back to the placeholder
  // multiplier in characters.ts — a confident number tracing to no talent.
  const hasTalentData = talentRows.length > 0;

  const consTalent = CONSTELLATION_TALENT_BONUS[character.id] ?? {};
  /** This level feeds the engine only via the effect table or its own talent bump. */
  const bumpAtLevel = (l: number) => (l === 3 || l === 5 ? consTalent[l] : undefined);
  const constellationNote =
    draft.constellation > 0 && !consModelled[draft.constellation] && !bumpAtLevel(draft.constellation)
      ? `C${draft.constellation} not modelled — its text is shown, but it does not change the number.`
      : '';
  const damageGroups: DamageGroupVm[] = useMemo(() => draftToGroups(draft, build), [draft, build]);

  // ---- Diff mode -----------------------------------------------------------
  const [baseline, setBaseline] = useState<DamageBaseline | null>(null);

  // ---- Saved scenarios (localStorage) --------------------------------------
  // Start with the row visible and collapse it only once storage proves itself
  // unavailable. The server render has no storage to probe, so it must match the
  // first client paint — revealing *after* mount would grow the island and shove
  // the marketing anchor targets down mid-scroll.
  const [scenarios, setScenarios] = useState<Scenario[] | null>([]);
  const [comparingId, setComparingId] = useState<string | null>(null);

  useEffect(() => {
    setScenarios(storageAvailable() ? loadScenarios() : null);
  }, []);

  const saveScenario = (name: string) =>
    setScenarios(addScenario(name, character.id, draftToQuery(draft, defaultsFor(character))));

  const scenarioDraft = (s: Scenario): Draft => {
    const c = CHARACTERS.find((x) => x.id === s.charId) ?? character;
    return draftFromQuery(new URLSearchParams(s.query), defaultsFor(c));
  };

  const loadScenario = (id: string) => {
    const s = scenarios?.find((x) => x.id === id);
    if (s) setDraft(scenarioDraft(s));
  };

  // Diff against a saved scenario without leaving the current one: rebuild the
  // stored draft's rows and pin them as the baseline. Row ids are per-character,
  // so the overlay only lights up when the saved scenario shares this character.
  const compareScenario = (id: string) => {
    const s = scenarios?.find((x) => x.id === id);
    if (!s) return;
    const saved = scenarioDraft(s);
    setBaseline(snapshotBaseline(saved.charId, draftToGroups(saved)));
    setComparingId(id);
  };

  const clearCompare = () => {
    setBaseline(null);
    setComparingId(null);
  };

  const deleteScenario = (id: string) => {
    setScenarios(removeScenario(id));
    if (comparingId === id) clearCompare();
  };

  // Row ids are only unique *within* a character — `combat1-0-1-hit-dmg` exists
  // on every character — so a baseline applied to a different one would match
  // every row and print nonsense. `overlayBaseline` enforces that; this only
  // mirrors it for the panel copy. The state is kept rather than cleared, so
  // switching away and back restores the comparison.
  const activeBaseline = baseline && baseline.characterId === character.id ? baseline : null;

  const groupsWithDiff: DamageGroupVm[] = useMemo(
    () => overlayBaseline(damageGroups, baseline, character.id),
    [damageGroups, baseline, character.id],
  );

  /** Baseline damage for the hit currently loaded into the multipliers, so the
   *  Expected panel can show "6,468 · +15.0% vs pinned" directly. */
  const baselineForActiveRow =
    activeBaseline && draft.activeRowId ? activeBaseline.rows.get(draft.activeRowId) : undefined;

  const pickRow = (vm: DamageRowVm) => {
    setDraft((d) => {
      const row = talentRows.find((r) => r.id === vm.id);
      if (!row || !row.isDamage) return d;
      const lv = effectiveTalentLevels(character.id, d.talentLevels, d.constellation)[bucketOf(row.group)];
      const value = (row.values[lv - 1] ?? 0) * Math.max(1, row.hits);
      return {
        ...d,
        activeRowId: row.id,
        attackType: GROUP_TO_TALENT[row.group],
        skillMult: value,
        elementOverride: row.element,
        scalingOverride: row.scaling,
      };
    });
  };

  const changeTalentLevel = (group: 'normal' | 'skill' | 'burst', lv: number) => {
    setDraft((d) => {
      const level = Math.round(clamp(lv, 1, 15));
      const next = { ...d, talentLevels: { ...d.talentLevels, [group]: level } };
      if (d.activeRowId) {
        const row = talentRows.find((r) => r.id === d.activeRowId);
        if (row && bucketOf(row.group) === group) {
          const lv = effectiveTalentLevels(character.id, next.talentLevels, next.constellation)[group];
          next.skillMult = (row.values[lv - 1] ?? 0) * Math.max(1, row.hits);
        }
      } else {
        next.skillMult = signatureMultiplierAt(character.id, d.attackType, effectiveTalentLevels(character.id, next.talentLevels, next.constellation)) || next.skillMult;
      }
      return next;
    });
  };

  // ---- URL state -----------------------------------------------------------
  // The calculator mirrors its editable state into the address bar so a shared
  // link reproduces the exact panel (draftToQuery / draftFromQuery in draft.ts).
  const restored = useRef(false);
  const skipFirstWrite = useRef(true);

  // Restore from URL once, on mount. The character's own defaults are the base,
  // so a bare `?c=<id>` still loads that character's weapon, attack type and preset.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const params = new URLSearchParams(window.location.search);
    const target = CHARACTERS.find((c) => c.id === params.get('c')) ?? initial;
    setDraft(draftFromQuery(params, defaultsFor(target)));
  }, [initial]);

  // Write back on every edit. The first pass is skipped so we don't wipe the
  // incoming link before the restore above has committed its state.
  useEffect(() => {
    if (!restored.current) return;
    if (skipFirstWrite.current) {
      skipFirstWrite.current = false;
      return;
    }
    const qs = draftToQuery(draft, defaultsFor(character));
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [draft, character]);

  // Picker dialog wiring.
  useEffect(() => {
    const d = pickerDialog.current;
    if (!d) return;
    if (pickerOpen && !d.open) d.showModal();
    if (!pickerOpen && d.open) d.close();
  }, [pickerOpen]);

  const roster = CHARACTERS.filter(
    (c) =>
      (elementFilter === 'all' || c.element === elementFilter) &&
      (query.trim() === '' || c.name.toLowerCase().includes(query.trim().toLowerCase())),
  );
  const groups = ELEMENTS.map((el) => ({ el, rows: roster.filter((c) => c.element === el) })).filter((g) => g.rows.length > 0);

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
      active ? 'border-forest-600 bg-forest-600/10 text-forest-700' : 'border-[var(--line)] text-[var(--muted)] hover:text-[var(--text)]'
    }`;

  return (
    <div className="mx-auto flex w-full flex-col lg:h-[calc(100dvh-7rem)] lg:min-h-0">
      {/* ============ Scenario bar ============ */}
      <ScenarioBar
        character={character}
        weapon={weapon}
        weaponOptions={weaponOptions}
        enemy={enemy}
        level={draft.level}
        constellation={draft.constellation}
        talentLevels={draft.talentLevels}
        talentEffective={effectiveTalentLevels(character.id, draft.talentLevels, draft.constellation)}
        customEnemy={draft.customEnemy}
        enemyLevel={draft.enemyLevel}
        constellationNote={constellationNote}
        expected={expected}
        nonCrit={result.nonCrit}
        critHit={result.critHit}
        hasTalentData={hasTalentData}
        onOpenPicker={() => setPickerOpen(true)}
        onLevel={(v) => set('level', v)}
        onConstellation={changeConstellation}
        onTalentLevel={changeTalentLevel}
        onWeapon={(v) => set('weaponId', v)}
        onEnemy={changeEnemy}
        onEnemyLevel={(v) => set('enemyLevel', v)}
        scenarios={scenarios}
        comparingId={comparingId}
        onSave={saveScenario}
        onLoad={loadScenario}
        onCompare={compareScenario}
        onClearCompare={clearCompare}
        onDelete={deleteScenario}
      />
      {/* ============ Tabs + build tools ============ */}
      <div className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ['character', 'Character'],
              ['equipment', 'Equipment'],
              ['multipliers', 'Multipliers'],
              ['damage', 'Damage'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-full px-3.5 py-1 text-sm font-medium transition-colors ${
                tab === id ? 'bg-forest-600 text-white' : 'border border-[var(--line)] text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>


      {/* ============ Tab content — scrolls inside the fixed shell ============ */}
      <div className="mt-3 min-h-0 flex-1 lg:overflow-y-auto lg:pr-1">

      {/* ============ Constellations & passives (Character tab) ============ */}
      {tab === 'character' && (
        <CharacterPassives
          constellations={constellations}
          ascensionPassives={ascensionPassives}
          consModelled={consModelled}
          consBumpLevels={[3, 5].filter((l) => !!consTalent[l as 3 | 5])}
          passiveModelled={passiveModelled}
          activeCons={draft.constellation}
          passiveOn={draft.passiveOn}
          onTogglePassive={(i, on) => set('passiveOn', on ? [...draft.passiveOn, i] : draft.passiveOn.filter((x) => x !== i))}
        />
      )}

      {/* ============ Character picker ============ */}
      {pickerOpen && (
        <dialog
          ref={pickerDialog}
          className="picker-dialog"
          onClose={() => setPickerOpen(false)}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPickerOpen(false);
          }}
        >
          <div className="flex max-h-[80vh] flex-col p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-[var(--text)]">Choose a character</h2>
              <button type="button" onClick={() => setPickerOpen(false)} aria-label="Close" className="rounded-full px-2 py-1 text-sm text-[var(--muted)] hover:text-[var(--text)]">✕</button>
            </div>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a character…"
              className="mt-3 h-9 w-full rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 text-sm text-[var(--text)]"
              aria-label="Search characters"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setElementFilter('all')}
                title="All"
                aria-label="All elements"
                className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
                  elementFilter === 'all' ? 'border-forest-600 bg-forest-600/10 text-forest-700' : 'border-[var(--line)] text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <circle cx="6" cy="6" r="2.4" />
                  <circle cx="12" cy="6" r="2.4" />
                  <circle cx="18" cy="6" r="2.4" />
                  <circle cx="6" cy="12" r="2.4" />
                  <circle cx="12" cy="12" r="2.4" />
                  <circle cx="18" cy="12" r="2.4" />
                  <circle cx="6" cy="18" r="2.4" />
                  <circle cx="12" cy="18" r="2.4" />
                  <circle cx="18" cy="18" r="2.4" />
                </svg>
              </button>
              {ELEMENTS.map((el) => (
                <button
                  key={el}
                  type="button"
                  onClick={() => setElementFilter(el)}
                  title={ELEMENT_LABEL[el]}
                  aria-label={ELEMENT_LABEL[el]}
                  aria-pressed={elementFilter === el}
                  className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
                    elementFilter === el ? 'border-forest-600 bg-forest-600/10' : 'border-[var(--line)] hover:border-forest-400'
                  }`}
                >
                  <ElementIcon el={el} className="h-5 w-5" />
                </button>
              ))}
            </div>
            <div className="mt-3 flex-1 overflow-y-auto pr-1">
              {groups.map((g) => (
                <div key={g.el} className="mb-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                    <ElementIcon el={g.el} className="h-4 w-4" />
                    {ELEMENT_LABEL[g.el]}
                    <span className="text-xs font-normal text-[var(--muted)]">({g.rows.length})</span>
                  </h3>
                  <div className="mt-2 grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))' }}>
                    {g.rows.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { pickCharacter(c.id); setPickerOpen(false); }}
                        title={c.name}
                        className={`relative aspect-square overflow-hidden rounded-xl ring-1 transition-all ${c.id === character.id ? 'ring-2 ring-forest-500' : 'ring-[var(--line)] hover:ring-forest-400'}`}
                      >
                        <span className={`absolute inset-0 bg-linear-to-b ${ELEMENT_BG[c.element] ?? ELEMENT_BG.physical}`} aria-hidden="true" />
                        <img src={`/images/portraits/${c.id}.webp`} alt={`${c.name} portrait`} width="256" height="256" loading="lazy" decoding="async" className={`relative h-full w-full object-cover ${c.id === character.id ? 'opacity-70' : ''}`} />
                        <ElementIcon el={c.element} className="absolute right-1.5 top-1.5 h-6 w-6" />
                        {c.id === character.id && (
                          <span className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-forest-600 text-xs font-bold text-white shadow" aria-hidden="true">✓</span>
                        )}
                        <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 to-transparent px-2 pb-1.5 pt-6 text-left">
                          <span className="block truncate text-[11px] font-semibold text-white drop-shadow">{c.name}</span>
                        </span>
                      </button>
                ))}
              </div>
            </div>
              ))}
            </div>
          </div>
        </dialog>
      )}

      {/* ============ Compact sticky result (mobile) ============ */}
      <div className="sticky top-2 z-40 mt-4 lg:hidden">
        <div className="calc-bar rounded-2xl px-4 py-2.5">
          {hasTalentData ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-forest-600">Damage</span>
              <span className="damage-number tnum text-2xl">{formatNumber(expected)}</span>
              <span className="tnum text-[11px] text-[var(--muted)]">
                {formatNumber(result.nonCrit)} / {formatNumber(result.critHit)}
              </span>
            </div>
          ) : (
            <span data-testid="no-talent-note" className="text-[11px] leading-tight text-[var(--muted)]">
              {NO_TALENT_NOTE}
            </span>
          )}
        </div>
      </div>

      <div>
        <div className={tab === 'multipliers' ? 'grid grid-cols-1 content-start gap-2.5 sm:grid-cols-2 lg:grid-cols-3' : tab === 'equipment' ? 'grid grid-cols-1 items-start gap-3 lg:grid-cols-2' : 'space-y-4'}>
          {tab === 'character' && <CharacterStats result={result} />}

          {tab === 'multipliers' && (
          <>
          <BaseZone
            value={formatNumber(baseDamage)}
            changed={draft.statOverride != null}
            onReset={() => set('statOverride', null)}
            onEnter={setHighlight}
            scaling={result.scaling}
            whiteboardStat={whiteboard.baseStat}
            statOverride={draft.statOverride}
            attackType={draft.attackType}
            skillMult={draft.skillMult}
            baseDmgBonus={draft.baseDmgBonus}
            flatBaseDmg={draft.flatBaseDmg}
            onPatch={patch}
            onAttackType={changeAttackType}
            onSkillMult={changeSkillMult}
          />

          <BonusZone
            value={`×${dmgMult.toFixed(3)}`}
            changed={!!(draft.dmgBonus || draft.naDmgBonus || draft.caDmgBonus || draft.skillDmgBonus || draft.burstDmgBonus || draft.dmgReduction)}
            onReset={() => setDraft((d) => ({ ...d, dmgBonus: 0, naDmgBonus: 0, caDmgBonus: 0, skillDmgBonus: 0, burstDmgBonus: 0, dmgReduction: 0 }))}
            onEnter={setHighlight}
            dmgBonus={draft.dmgBonus}
            dmgReduction={draft.dmgReduction}
            naDmgBonus={draft.naDmgBonus}
            caDmgBonus={draft.caDmgBonus}
            skillDmgBonus={draft.skillDmgBonus}
            burstDmgBonus={draft.burstDmgBonus}
            onPatch={patch}
          />

          <CritZone
            value={`×${critMult.toFixed(3)}`}
            changed={!!(draft.critRate || draft.critDMG || draft.critMode !== 'expected')}
            onReset={() => setDraft((d) => ({ ...d, critRate: 0, critDMG: 0, critMode: 'expected' }))}
            onEnter={setHighlight}
            critRate={draft.critRate}
            critDMG={draft.critDMG}
            critMode={draft.critMode}
            critRateRaw={result.critRateRaw}
            onPatch={patch}
          />

          <ReactionZone
            value={result.reactionMultiplier > 1 ? `×${result.reactionMultiplier.toFixed(3)}` : '—'}
            changed={!!(draft.amplified !== 'none' || draft.additive !== 'none' || draft.transformative !== 'none' || draft.em || draft.reactionBonus)}
            onReset={() => setDraft((d) => ({ ...d, amplified: 'none', additive: 'none', transformative: 'none', em: 0, reactionBonus: 0, ampReactionBonus: 0, transformReactionBonus: 0 }))}
            onEnter={setHighlight}
            amplified={draft.amplified}
            additive={draft.additive}
            transformative={draft.transformative}
            swirlElement={draft.swirlElement}
            em={draft.em}
            ownEM={ownEM}
            reactionBonus={draft.reactionBonus}
            ampReactionBonus={draft.ampReactionBonus}
            transformReactionBonus={draft.transformReactionBonus}
            onPatch={patch}
          />

          <DefZone
            value={`×${result.defMultiplier.toFixed(3)}`}
            changed={!!(draft.defShred || draft.defIgnore)}
            onReset={() => setDraft((d) => ({ ...d, defShred: 0, defIgnore: 0 }))}
            onEnter={setHighlight}
            defShred={draft.defShred}
            defIgnore={draft.defIgnore}
            onPatch={patch}
          />

          <ResZone
            value={`×${result.resMultiplier.toFixed(3)}`}
            changed={!!(draft.resShred || Object.keys(draft.enemyResMap).length)}
            onReset={() => setDraft((d) => ({ ...d, resShred: 0, enemyResMap: {} }))}
            onEnter={setHighlight}
            resShred={draft.resShred}
            enemyResMap={draft.enemyResMap}
            resistances={enemy.resistances}
            onPatch={patch}
          />
          </>
          )}

          {/* Artifacts — added on top of the character's own stats */}
          {tab === 'equipment' && (
          <EquipmentPanel
            weaponPassive={weaponPassive}
            weaponName={weapon?.name}
            weaponEffect={weaponEffect}
            weaponMaxStacks={weaponMaxStacks}
            weaponRefDesc={weaponRefDesc}
            weaponRefine={draft.weaponRefine}
            weaponStacks={draft.weaponStacks}
            onWeaponRefine={(r) => set('weaponRefine', r)}
            onWeaponStacks={(n) => set('weaponStacks', n)}
            artifacts={draft.artifacts}
            onClearArtifacts={() => set('artifacts', { ...NO_ARTIFACTS })}
            onArtifact={setArtifact}
            onPieceSet={setPieceSet}
            onPieceSub={setPieceSub}
            onPieceSubValue={setPieceSubValue}
            result={result}
            chip={chip}
            party={draft.party}
            onParty={setParty}
            manual={{
              atkPercent: draft.atkPercent,
              flatATK: draft.flatATK,
              hpPercent: draft.hpPercent,
              flatHP: draft.flatHP,
              defPercent: draft.defPercent,
              flatDEF: draft.flatDEF,
              er: draft.er,
            }}
            onManual={(p) => patch(p as Partial<Draft>)}
          />
          )}

          {tab === 'damage' && (
          <DamagePanel
            groups={groupsWithDiff}
            onPickRow={pickRow}
            hasTalentData={hasTalentData}
            result={result}
            expected={expected}
            capped={capped}
            baseDamage={baseDamage}
            dmgMult={dmgMult}
            critMult={critMult}
            baseline={baseline}
            baselineForActiveRow={baselineForActiveRow}
            onToggleBaseline={() => {
              setBaseline(activeBaseline ? null : snapshotBaseline(character.id, damageGroups));
              setComparingId(null);
            }}
            reactionPreviews={reactionPreviews}
            amplified={draft.amplified}
            transformative={draft.transformative}
            onPatch={patch}
            highlight={highlight}
            onJumpToZone={jumpToZone}
          />
          )}
        </div>

      </div>

      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {hasTalentData
          ? `${character.name} expected damage ${formatNumber(expected)}.`
          : `${character.name} has no talent data — pick another character.`}
      </p>
    </div>
  );
}
