# Agent brief #2 — genshin-damage-calculator

Baseline: `origin/feat/single-character` @ `1b1514f`. Every number below was
measured on that commit. Re-measure before trusting anything if it has moved.

## Current state (verified, all green)

```
npm test             100 passed
npm run lint         0 errors, 0 warnings, 3 hints
npm run build        11 pages
npm run check:data   4 mismatches — all four are the out-of-scope characters below
npm run check:images 595 paths, all resolve
npm run test:e2e     48 passed, 2 skipped (desktop 1280 + mobile 390 projects)
```

## Execution note — deviation from "Out of scope" below (owner, 2026-09-22)

The "Out of scope" ruling (do not add talent data for
`aether`/`lumine`/`manekin`/`manekina`) was **reversed by the owner**: "那四个
角色也做 也补充". Task 1 was therefore executed as *data*, with the guard kept
as a fallback:

- **`aether` / `lumine` now have real per-hit data.** genshin-db splits the
  Traveler's kits by element (`Traveler (Anemo)` …), so `talents('Aether')`
  found nothing and every figure fell back to the placeholder. The generator
  and the verifier now share a `TALENT_NAME_OVERRIDE` (scripts/lib/talent-rules)
  mapping both siblings to the Anemo kit; `check:data` verifies them.
- **`manekin` / `manekina` cannot be filled** — they are v6.1 Miliastra
  Wonderland test characters with no talent table in any dataset. The
  `hasTalentData` guard from Task 1 is kept exactly for them: the headline, the
  mobile sticky bar and the per-hit table show a "no talent data" notice instead
  of a placeholder number. `scripts/verify-baseline.mjs` lists them via
  `NO_TALENT_DATA` (reported, not failed) so a future dataset that gains their
  rows shows up as a real mismatch to fix.

The "4 mismatches — all four are the out-of-scope characters" line in the block
above is superseded: `check:data` now reports 0 mismatches.


Data: 122 characters · 213 weapons · 45 artifact sets · 35 enemies.
`SingleCalculator.tsx` is 927 lines, with the pieces in `src/components/calculator/`.

## House rule — not negotiable

From `src/data/constellations.ts` and `src/data/weaponPassives.ts`:

> "Only effects that are self-buffs, unconditional enough to model, and clearly
> numeric are listed. Everything else is shown as text but applies nothing —
> better a missing buff than a wrong one."

A wrong number is worse than a missing one. Conditional, stacking, team-wide or
ambiguous → leave it unmodelled and write why into `note`. The UI already
discloses unmodelled effects, so an honest gap costs nothing.

## Out of scope

`aether`, `lumine`, `manekin`, `manekina` have no per-hit talent table in
genshin-db. The owner has decided not to support them: **do not add talent data
for them, do not remove them from the roster.** Task 1 is the only work allowed
on them.

---

## Task 1 — Stop the four unsupported characters printing a made-up number

**This is a live bug, verified in a browser on `1b1514f`:**

| `/?c=` | headline | rows in `#damage-table` |
|---|---:|---:|
| `aether` | 5,761 | **0** |
| `lumine` | 5,761 | **0** |
| `manekin` | 23,643 | **0** |
| `manekina` | 23,643 | **0** |
| `hu-tao` (control) | 17,885 | 29 |

With no talent rows, every figure falls back to the placeholder
`skillMultiplier` in `characters.ts`. The result is a confident number that
traces to no talent, above an empty table. The previous brief claimed this was
"already guarded" — that was wrong, the guard was never on this branch. Treat
the claim as retracted.

**Do.** In the calculator, derive `hasTalentData` from
`talentRowsFor(character.id)` being non-empty, and when it is false replace —
not merely hide — the number in all three places that render one:

1. the headline result card in `ScenarioBar.tsx`,
2. the compact sticky result bar shown below `lg`,
3. the per-hit table in `DamagePanel.tsx`.

Wording: say there is no talent data for this character and suggest picking
another. Same muted register as the existing disclosure text, not a warning
banner.

**Acceptance.** `e2e/disclosure.spec.ts` gains a case asserting `/?c=aether`
renders no `.damage-number` and does contain the notice, plus a control case
that `/?c=hu-tao` still renders its headline and >10 table rows. Add a unit test
that `talentRowsFor` returns empty for exactly these four ids, so the list
cannot drift silently.

---

## Task 2 — Weapon passives, by how much they are actually used

Breadth landed but depth was diluted. Measured:

| | before | now |
|---|---|---|
| Weapons shipped | 63 | **213** |
| With a modelled passive | 50 (79%) | **55 (26%)** |
| Weapons with passive text only | 13 | **158** |

That is the correct outcome of brief #1 (it explicitly forbade bulk-guessing 152
passives) and the disclosure UI makes it honest. But a visitor holding one of
those 158 still gets a number that is too low.

**Do.** Work `src/data/weaponPassives.ts` → `WEAPON_PASSIVE_EFFECTS` in
usage order, not alphabetical order. Two tiers, ~40–50 weapons total:

1. **5★ signature weapons** — each one is the best-in-slot for a specific
   carry, so each modelled passive fixes that character's whole result.
2. **High-use 4★** — the craftable and event families most accounts actually
   run: Prototype, Blackcliff, Favonius, Sacrificial, Lithic, the Fontaine and
   Natlan craftables.

Follow the existing entry shape: name the stat, point `valueIndex` at the right
slot in `src/data/generated/weaponPassives.ts`, set `maxStacks`, and reduce
conditional effects to their reliable core with the omission stated in `note`.
Leave the long tail unmodelled — disclosure covers it.

**Acceptance.** A test asserting every `WEAPON_PASSIVE_EFFECTS` key exists in
`WEAPONS`, every `valueIndex` is in range for that weapon's refinement array,
and every entry whose game effect is conditional carries a `note`. Report the
new coverage percentage in the commit message.

---

## Task 3 — Constellations, by character popularity

Untouched by the last round and still the largest single source of
under-reporting:

| | covered | roster |
|---|---:|---:|
| `CONSTELLATION_EFFECTS` | 26 | 122 (21%) |
| `PASSIVE_EFFECTS` | 14 | 122 (11%) |

**Do.** `src/data/constellations.ts`, ordered by main-DPS popularity — Hu Tao,
Raiden, Nahida, Yelan, Yoimiya, Ayaka, Arlecchino, Neuvillette, Furina,
Mavuika and the current-patch carries — not by roster order. Per character,
model only the constellations that are numeric self-buffs; mark the rest
text-only, which the UI already renders.

**Watch out:** the headline figure uses the character's *signature* attack. For
Baizhu, C0 and C6 both read 6,902 and that is **correct** — his C3/C5 raise
Burst and Skill while his signature is the Normal Attack combo, and his
Skill/Burst produce no damage rows. Verify constellation work against the
per-hit table, never the headline alone. Hu Tao is the good control: C0 14,242
→ C6 25,655.

**Acceptance.** Per character added, a unit test pinning one hit's damage at C0
and at the constellation level that changes it.

---

## Task 4 — Fix the brief in the repo

`docs/AGENT-BRIEF.md` (brief #1) is not in this branch and its "already guarded"
line is what caused Task 1's regression to ship. Commit **this** file as
`docs/AGENT-BRIEF-2.md` and delete or supersede #1 if it appears. A brief that
states something is done must be checked against the branch it targets.

---

## Task 5 — Energy and rotation DPS

The tool reports single-hit damage; players compare damage per rotation. This
needs an ER/energy model in `src/lib/damage.ts` plus a rotation input, and is a
design task before it is a coding task — write the model down and get it agreed
before implementing.

Related, lower priority: an "external buffs" input for teammate buffs (Bennett,
Kazuha) that does **not** bring back the team calculator, and splitting the
24-screen homepage into separate routes for LCP/CLS and SEO.

---

## Order

1 (bug, hours) → 2 (highest value per hour) → 3 (largest gap, slowest) → 4
(do alongside 1) → 5 (design first).

Two notes for whoever picks this up:

- **`playwright.config.ts` has no way to use a preinstalled browser.** In a
  sandbox that ships one, the config must be edited or wrapped. Consider adding
  `launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined }`
  so CI and sandboxes can both run the suite unmodified.
- The badge row in the header is exactly full at 1536px — `e2e/layout.spec.ts`
  says so in a comment. Any growth in the title, a badge or the nav links will
  fail that test. That is intended; widen the gate rather than shrinking the
  brand name, which is the regression those tests exist to prevent.
