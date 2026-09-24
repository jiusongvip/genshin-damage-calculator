import type { ArtifactBuild, DamageResult, SecondaryStatType } from '../../lib/damage';
import { formatNumber, formatPercent } from '../../lib/damage';
import { NO_ARTIFACTS } from '../../data/presets';
import { ARTIFACT_SETS } from '../../data/artifactSets';
import { bennettAtkBonusRatio } from '../../data/partyBuffs';
import type { PartyState } from '../../data/partyBuffs';
import { ElementIcon } from '../ElementIcon';
import type { WeaponPassiveData } from '../../data/generated/weaponPassives';
import type { WeaponPassiveEffect } from '../../data/weaponPassives';
import { BuffSwitch, Glyph, IconSelect, Num, NumberField, Pct } from './primitives';
import { ELEMENTS, MAIN_OPTIONS, PIECE_ROWS, SECONDARY_LABEL, STAT_GLYPH, SUB_OPTIONS } from './constants';
import type { PieceKey } from './constants';
import { ELEMENT_LABEL } from '../../data/elements';
import { formatMainValue, mainValueFor } from './draft';

/** The hand-typed stat bonuses from M3 §1a — a subset of the draft's top-level fields. */
export interface ManualStatBuffs {
  atkPercent: number;
  flatATK: number;
  hpPercent: number;
  flatHP: number;
  defPercent: number;
  flatDEF: number;
  er: number;
}

export interface EquipmentPanelProps {
  /** Static data for the equipped weapon's passive, if it has one. */
  weaponPassive: WeaponPassiveData | undefined;
  weaponName: string | undefined;
  /** Modelled effect — absent means "not modelled for damage". */
  weaponEffect: WeaponPassiveEffect | undefined;
  weaponMaxStacks: number;
  /** Description of the selected refinement. */
  weaponRefDesc: string;
  weaponRefine: number;
  weaponStacks: number;
  onWeaponRefine: (refine: number) => void;
  onWeaponStacks: (stacks: number) => void;

  artifacts: ArtifactBuild;
  onClearArtifacts: () => void;
  onArtifact: (patch: Partial<ArtifactBuild>) => void;
  onPieceSet: (piece: PieceKey, value: string) => void;
  onPieceSub: (pieceIdx: number, slot: number, type: SecondaryStatType | 'none') => void;
  onPieceSubValue: (pieceIdx: number, slot: number, raw: number, percent: boolean) => void;

  /** Stat totals shown in the footer line — "With artifacts: …". */
  result: Pick<DamageResult, 'totalATK' | 'critRate' | 'critDMG' | 'em'>;
  /** Shared pill-button class helper. */
  chip: (active: boolean) => string;

  /** Declared teammate buffs (M3 §1b). */
  party: PartyState;
  onParty: (patch: Partial<PartyState>) => void;
  /** Hand-typed stat bonuses (M3 §1a). */
  manual: ManualStatBuffs;
  onManual: (patch: Partial<ManualStatBuffs>) => void;
}

/**
 * The Equipment tab: weapon passive (refinement, stacks) plus the artifact
 * build — five pieces with set + main stat, and four sub-stats each.
 */
export function EquipmentPanel({
  weaponPassive,
  weaponName,
  weaponEffect,
  weaponMaxStacks,
  weaponRefDesc,
  weaponRefine,
  weaponStacks,
  onWeaponRefine,
  onWeaponStacks,
  artifacts,
  onClearArtifacts,
  onArtifact,
  onPieceSet,
  onPieceSub,
  onPieceSubValue,
  result,
  chip,
  party,
  onParty,
  manual,
  onManual,
}: EquipmentPanelProps) {
  return (
    <>
      {weaponPassive && (
        <section className="panel p-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h3 className="text-sm font-semibold text-[var(--text)]">
              {weaponPassive.effectName}
              <span className="ml-2 text-xs font-normal text-[var(--muted)]">{weaponName}</span>
            </h3>
            <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
              Refinement
              <select
                value={weaponRefine}
                onChange={(e) => onWeaponRefine(parseInt(e.target.value, 10))}
                className="h-8 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 text-sm text-[var(--text)]"
              >
                {[1, 2, 3, 4, 5].map((r) => (
                  <option key={r} value={r}>
                    R{r}
                  </option>
                ))}
              </select>
            </label>
            {weaponEffect ? (
              weaponMaxStacks > 1 ? (
                <span className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                  Stacks
                  {Array.from({ length: weaponMaxStacks + 1 }, (_, i) => i).map((i) => (
                    <button key={i} type="button" onClick={() => onWeaponStacks(i)} className={chip(weaponStacks === i)}>
                      {i}
                    </button>
                  ))}
                </span>
              ) : (
                <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                  <input type="checkbox" checked={weaponStacks > 0} onChange={(e) => onWeaponStacks(e.target.checked ? 1 : 0)} />
                  Applied
                </label>
              )
            ) : (
              <span className="text-[11px] text-pyro">Not modelled for damage — set it manually in the zones below.</span>
            )}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{weaponRefDesc}</p>
          {weaponEffect?.note && <p className="mt-1 text-[11px] italic text-[var(--muted)]">{weaponEffect.note}</p>}
        </section>
      )}

      <section className="panel p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-base font-semibold text-[var(--text)]">
            Artifacts <span className="text-xs font-normal text-[var(--muted)]">sample build — edit to match your own</span>
          </h3>
          <button type="button" onClick={onClearArtifacts} className="text-[11px] text-[var(--muted)] underline underline-offset-2 hover:text-forest-600">
            clear
          </button>
        </div>

        {/* Artifact pieces — 5 slots, each picks a set (+ main stat where selectable) */}
        <div className="mt-2 rounded-[12px] border border-[var(--line)] p-2.5">
          <span className="text-xs font-medium text-[var(--muted)]">
            Pieces <span className="text-[10px] font-normal">— set bonuses come from 2 or 4 matching pieces. Sets without a modelable damage effect (healing, shield, RES-only, plunging-only) are not listed.</span>
          </span>
          <div className="mt-2 space-y-2">
            {PIECE_ROWS.map((row) => {
              const mainOpt = row.mainSlot ? MAIN_OPTIONS.find((m) => m.slot === row.mainSlot) : undefined;
              return (
                <div key={row.piece} className="flex items-center gap-2">
                  <span className="w-12 shrink-0 text-[11px] text-[var(--muted)]">{row.label}</span>
                  <div className="min-w-0 flex-1">
                    <IconSelect
                      value={(artifacts.sets?.[row.piece] ?? '') || 'none'}
                      onChange={(v) => onPieceSet(row.piece, v)}
                      options={[
                        { value: 'none', label: 'No set' },
                        ...ARTIFACT_SETS.map((s) => ({
                          value: s.id,
                          label: s.name,
                          icon: (
                            <img
                              src={`/images/artifact-sets/${s.id}-${row.piece}.webp`}
                              alt=""
                              width="48"
                              height="48"
                              className="h-7 w-7 object-contain"
                              loading="lazy"
                              decoding="async"
                            />
                          ),
                        })),
                      ]}
                    />
                  </div>
                  {mainOpt ? (
                    <div className="w-36 shrink-0">
                      <IconSelect
                        value={artifacts[mainOpt.slot].value > 0 ? artifacts[mainOpt.slot].type : 'none'}
                        onChange={(v) => {
                          if (v === 'none') onArtifact({ [mainOpt.slot]: { ...NO_ARTIFACTS[mainOpt.slot] } } as Partial<ArtifactBuild>);
                          else onArtifact({ [mainOpt.slot]: { type: v as SecondaryStatType, value: mainValueFor(v as SecondaryStatType) } } as Partial<ArtifactBuild>);
                        }}
                        options={[
                          { value: 'none', label: 'None' },
                          ...mainOpt.options.map((o) => ({
                            value: o as string,
                            label: `${SECONDARY_LABEL[o]} · ${formatMainValue(o)}`,
                            icon: <Glyph name={STAT_GLYPH[o]} className="h-5 w-5" />,
                          })),
                        ]}
                      />
                    </div>
                  ) : (
                    <span className="w-36 shrink-0 text-right text-[11px] text-[var(--muted)]">{row.fixed}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sub-stats — four per piece, pieces across, slots down */}
        <div className="mt-3">
          <span className="text-xs font-medium text-[var(--muted)]">
            Sub-stats <span className="text-[10px] font-normal">— four per piece</span>
          </span>
          <div className="mt-2 grid grid-cols-5 gap-2">
            {PIECE_ROWS.map((row, pieceIdx) => (
              <div key={row.piece} className="min-w-0">
                <span className="mb-1 block text-center text-[10px] text-[var(--muted)]">{row.label}</span>
                <div className="space-y-1.5">
                  {[0, 1, 2, 3].map((slot) => {
                    const sub = artifacts.pieceSubs?.[pieceIdx]?.[slot];
                    const opt = SUB_OPTIONS.find((o) => o.type === sub?.type);
                    return (
                      <div key={slot} className="flex items-center gap-1">
                        <select
                          value={sub?.type ?? 'none'}
                          aria-label={`${row.label} sub-stat ${slot + 1}`}
                          onChange={(e) => onPieceSub(pieceIdx, slot, e.target.value as SecondaryStatType | 'none')}
                          className="h-8 w-full min-w-0 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-1 text-[11px] text-[var(--text)]"
                        >
                          <option value="none">—</option>
                          {SUB_OPTIONS.map((o) => (
                            <option key={o.type} value={o.type}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <NumberField
                          label={`${row.label} sub-stat ${slot + 1}`}
                          hideLabel
                          stepper={false}
                          disabled={!sub}
                          className="shrink-0"
                          inputClassName="w-[4.5ch] text-right text-[11px]"
                          value={sub ? (opt?.percent ? Number((sub.value * 100).toFixed(2)) : sub.value) : 0}
                          onChange={(v) => onPieceSubValue(pieceIdx, slot, v, !!opt?.percent)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-2 border-t border-[var(--line)] pt-2 text-[11px] text-[var(--muted)]">
          With artifacts: ATK <strong className="text-[var(--text)]">{formatNumber(result.totalATK)}</strong> · CRIT{' '}
          <strong className="text-[var(--text)]">{formatPercent(result.critRate)}</strong> /{' '}
          <strong className="text-[var(--text)]">{formatPercent(result.critDMG)}</strong> · EM{' '}
          <strong className="text-[var(--text)]">{Math.round(result.em)}</strong>
        </p>
      </section>

      {/* ============ Party buffs (M3) + manual stat buffs ============ */}
      <section className="panel p-4">
        <h3 className="text-base font-semibold text-[var(--text)]">
          Party buffs{' '}
          <span className="text-xs font-normal text-[var(--muted)]">— declare who is in your team; we never guess</span>
        </h3>

        <div className="mt-3 space-y-3">
          <BuffSwitch
            on={!!party.bennett}
            onChange={(v) => onParty({ bennett: v ? 1 : 0 })}
            title="Bennett — Fantastic Voyage"
            desc="Flat ATK = Bennett's base ATK × his burst's ATK Bonus Ratio (read from his talent table)."
          >
            <div className="grid grid-cols-2 gap-2">
              <Num label="Bennett base ATK" value={party.bennettBase} onChange={(v) => onParty({ bennettBase: v })} max={3000} />
              <Num label="Burst level" value={party.bennettLevel} onChange={(v) => onParty({ bennettLevel: v })} min={1} max={15} step={1} />
            </div>
            <p className="mt-1 text-[11px] text-forest-600">
              +{formatNumber(party.bennettBase * bennettAtkBonusRatio(party.bennettLevel))} ATK
            </p>
          </BuffSwitch>

          <div className="flex items-center gap-2">
            <IconSelect
              value={party.partyElement}
              onChange={(v) => onParty({ partyElement: v })}
              options={ELEMENTS.map((el) => ({
                value: el,
                label: `${ELEMENT_LABEL[el]} (swirled)`,
                icon: <ElementIcon el={el} className="h-5 w-5" />,
              }))}
              className="mt-0 w-full"
            />
          </div>

          <BuffSwitch
            on={!!party.kazuha}
            onChange={(v) => onParty({ kazuha: v ? 1 : 0 })}
            title="Kazuha — Poetics of Fuu (A4)"
            desc={`Elemental DMG +${((party.kazuhaEM * 0.0004) * 100).toFixed(2)}% to the swirled element, from ${Math.round(party.kazuhaEM)} EM.`}
          >
            <Num label="Kazuha EM" value={party.kazuhaEM} onChange={(v) => onParty({ kazuhaEM: v })} max={2000} />
          </BuffSwitch>

          <BuffSwitch
            on={!!party.viridescent}
            onChange={(v) => onParty({ viridescent: v ? 1 : 0 })}
            title="Viridescent Venerer 4pc"
            desc="Enemy RES −40% to the swirled element (see the picker above)."
          />

          <BuffSwitch
            on={!!party.zhongli}
            onChange={(v) => onParty({ zhongli: v ? 1 : 0 })}
            title="Zhongli — Dominus Legion"
            desc="Enemy RES −20% to all elements and Physical."
          />

          <BuffSwitch
            on={!!party.noblesse}
            onChange={(v) => onParty({ noblesse: v ? 1 : 0 })}
            title="Noblesse Oblige 4pc"
            desc="ATK +20% (a teammate wearing it)."
          />

          <BuffSwitch
            on={!!party.pyroResonance}
            onChange={(v) => onParty({ pyroResonance: v ? 1 : 0 })}
            title="Elemental Resonance — Blazing Ember"
            desc="ATK +25%."
          />

          <BuffSwitch
            on={!!party.hydroResonance}
            onChange={(v) => onParty({ hydroResonance: v ? 1 : 0 })}
            title="Elemental Resonance — Bountiful Chips"
            desc="HP +25%."
          />
        </div>

        {/* Manual stat inputs (M3 §1a) — anything not covered by a switch. */}
        <div className="mt-4 border-t border-[var(--line)] pt-3">
          <h4 className="text-sm font-semibold text-[var(--text)]">Manual stat buffs</h4>
          <p className="mt-0.5 text-[11px] text-[var(--muted)]">Add flat or percent stats directly.</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Pct label="ATK%" value={manual.atkPercent} onChange={(v) => onManual({ atkPercent: v })} min={-100} max={2000} />
            <Num label="Flat ATK" value={manual.flatATK} onChange={(v) => onManual({ flatATK: v })} max={100000} />
            <Pct label="Energy Recharge" value={manual.er} onChange={(v) => onManual({ er: v })} min={-100} max={2000} />
            <Pct label="HP%" value={manual.hpPercent} onChange={(v) => onManual({ hpPercent: v })} min={-100} max={2000} />
            <Num label="Flat HP" value={manual.flatHP} onChange={(v) => onManual({ flatHP: v })} max={100000} />
            <Pct label="DEF%" value={manual.defPercent} onChange={(v) => onManual({ defPercent: v })} min={-100} max={2000} />
            <Num label="Flat DEF" value={manual.flatDEF} onChange={(v) => onManual({ flatDEF: v })} max={100000} />
          </div>
        </div>

        <p className="mt-3 text-[11px] italic text-[var(--muted)]">More party buffs coming.</p>
      </section>
    </>
  );
}

