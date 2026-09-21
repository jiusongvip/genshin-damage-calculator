import type { ArtifactBuild, DamageResult, SecondaryStatType } from '../../lib/damage';
import { formatNumber, formatPercent } from '../../lib/damage';
import { NO_ARTIFACTS } from '../../data/presets';
import { ARTIFACT_SETS } from '../../data/artifactSets';
import type { WeaponPassiveData } from '../../data/generated/weaponPassives';
import type { WeaponPassiveEffect } from '../../data/weaponPassives';
import { Glyph, IconSelect } from './primitives';
import { MAIN_OPTIONS, PIECE_ROWS, SECONDARY_LABEL, STAT_GLYPH, SUB_OPTIONS } from './constants';
import type { PieceKey } from './constants';
import { formatMainValue, mainValueFor } from './draft';

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
                        <input
                          type="number"
                          inputMode="decimal"
                          disabled={!sub}
                          value={sub ? (opt?.percent ? Number((sub.value * 100).toFixed(2)) : sub.value) : ''}
                          onChange={(e) => onPieceSubValue(pieceIdx, slot, parseFloat(e.target.value) || 0, !!opt?.percent)}
                          className="h-8 w-14 shrink-0 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-1 text-right text-[11px] text-[var(--text)] disabled:opacity-40"
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
    </>
  );
}
