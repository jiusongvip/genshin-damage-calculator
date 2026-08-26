// ============================================================================
// FAQ content — written to exceed the depth of competing calculator pages.
// Each answer targets a long-tail query around damage calculation.
// ============================================================================

export interface Faq {
  q: string;
  a: string;
}

export const FAQS: Faq[] = [
  {
    q: 'How is Genshin Impact damage calculated?',
    a: 'A single hit multiplies five independent factors: Total ATK, the skill\u2019s talent multiplier, a DMG Bonus factor (elemental goblet, weapon passives, set bonuses), a CRIT factor (1 + Crit Rate \u00d7 Crit DMG for expected damage), and two defensive factors \u2014 enemy DEF and enemy RES. The full formula is Damage = Total ATK \u00d7 Skill Multiplier \u00d7 (1 + DMG Bonus) \u00d7 CRIT \u00d7 Reaction \u00d7 DEF multiplier \u00d7 RES multiplier. Because every factor multiplies the others, stacking one factor very high has diminishing value compared to raising several factors together.',
  },
  {
    q: 'What is the Genshin damage formula?',
    a: 'The complete non-transformative formula is: Damage = Base ATK \u00d7 (1 + ATK%) + Flat ATK, then multiplied by Skill Multiplier, then by (1 + Total DMG Bonus), then by the CRIT factor (1 + CR \u00d7 CD for the expected value, or 1 + CD for a guaranteed crit), then by the reaction multiplier (1.5 for Vaporize, 2.0 for Melt, scaled further by Elemental Mastery), then by the DEF multiplier \u2014 (Character Level + 100) \u00f7 ((Character Level + 100) + (Enemy Level + 100) \u00d7 (1 \u2212 DEF Shred)) \u2014 and finally by the RES multiplier, which is 1 \u2212 RES above 0, 1 \u2212 RES/2 below 0, and 1/(1 + 4\u00d7RES) when RES is 0.75 or higher.',
  },
  {
    q: 'How accurate is this Genshin damage calculator?',
    a: 'The math follows the official damage formula, so against a target with the same level, resistance and buffs you set, results should match the in-game number within a point or two \u2014 the small gap comes from hidden rounding in the game. The bigger source of error is input: if your artifact sub-stats, talent level, or active buffs are entered slightly differently from your real build, the result will drift. Always double-check that the character level, enemy level, elemental resistance and reaction state match your actual test.',
  },
  {
    q: 'How does Elemental Mastery affect damage?',
    a: 'Elemental Mastery scales two different things. For amplifying reactions (Vaporize and Melt), EM multiplies the base reaction bonus by 2.78 \u00d7 EM \u00f7 (EM + 1400), so 100 EM adds roughly 18.5% to a Vaporize hit. For transformative reactions (Overload, Bloom, Hyperbloom, Swirl and friends), EM scales by 16 \u00d7 EM \u00f7 (EM + 2000). The catch is that EM has steep diminishing returns \u2014 the first 100 EM is worth far more than the next 100 \u2014 so for reaction carries, balance EM with CRIT and DMG bonus rather than stacking EM alone.',
  },
  {
    q: 'What is the difference between Crit Rate and Crit DMG?',
    a: 'Crit Rate is the chance a hit crits; Crit DMG is how much extra damage a crit deals. Expected damage is 1 + Crit Rate \u00d7 Crit DMG, so the two multiply each other \u2014 this is why the 1:2 ratio is the community rule of thumb: each point of Crit Rate costs twice as much as a point of Crit DMG, so a balanced build maximizes their product. At 60% Crit Rate and 120% Crit DMG, you have a 1.72\u00d7 crit multiplier; the same total investment pushed to 75% \u00d7 150% gives 2.125\u00d7 \u2014 a genuine upgrade from the same budget.',
  },
  {
    q: 'Vaporize vs Melt \u2014 which reaction is better?',
    a: 'Melt has the higher raw multiplier (2.0\u00d7 vs Vaporize\u2019s 1.5\u00d7 when the right element triggers), but in practice Vaporize teams often deal more sustained damage because Pyro and Hydro applications are easier to keep consistent, letting the reaction trigger on nearly every hit. Melt comps (Ganyu, Wriothesley) hit very hard per shot but are gated by how fast Cryo can be applied. For a single nuke screenshot, Melt wins; for overall team DPS, a well-built Vaporize rotation usually pulls ahead.',
  },
  {
    q: 'How does enemy DEF reduce my damage?',
    a: 'Enemy defense reduces damage by the DEF multiplier: (Character Level + 100) \u00f7 ((Character Level + 100) + (Enemy Level + 100) \u00d7 (1 \u2212 DEF Shred)). Against a same-level enemy this is exactly 0.5 \u2014 you deal half your pre-defense damage. Against a higher-level enemy it drops further, which is why level matters so much. DEF Shred (from Lisa, Ayaka\u2019s C4, Klee\u2019s C2, or Raiden\u2019s C2) directly raises the denominator\u2019s reduction term and is one of the rarest, most valuable buffs in the game.',
  },
  {
    q: 'How does resistance shred work?',
    a: 'Most enemies have 10% resistance to everything (physical enemies often have 70% physical RES). The Viridescent Venerer 4-piece set shreds 40% resistance, dropping a 10% RES enemy to \u221230%, which flips the multiplier from 0.9 to 1.15 \u2014 a roughly 28% damage increase, which is why an Anemo character holding VV is in almost every reaction team. Below 0, each point of shred is worth half, so additional shred past 0 has diminishing returns. Above 0.75 RES the formula changes to 1/(1 + 4\u00d7RES), which is why heavily resistant enemies feel nearly immune.',
  },
  {
    q: 'How do team buffs like Bennett work?',
    a: 'Bennett\u2019s Fantastic Voyage adds a large flat ATK bonus based on his base ATK (weapon + level, not artifacts), plus a heal and, at C1+, a 20% ATK bonus. Because flat ATK is added before your ATK% multipliers, Bennett\u2019s buff effectively multiplies your entire attack investment, which is why he is the single most used support. Other core buffs: Kazuha or Sucrose shred 40% RES with VV and add elemental DMG, Zhongli\u2019s shield shreds 20% RES, and the Noblesse Oblige 4-piece adds 20% ATK to the whole team.',
  },
  {
    q: 'How do I compare two weapons?',
    a: 'Set the same character, artifacts, buffs and enemy in this calculator, then switch only the weapon and watch the Expected Damage number. The difference between the two numbers, divided by the old number, is your percentage gain \u2014 e.g. going from 40,000 to 46,000 is a 15% upgrade. Pay attention to the secondary stat: a Crit weapon (like The Catch) is often competitive with a 5-star ATK% weapon because CRIT is so scarce. For HP- or DEF-scaling characters, the weapon\u2019s base ATK matters far less than its passive and sub-stat.',
  },
  {
    q: 'What weapon should I use for my character?',
    a: 'It depends on your stats and the rest of your build, which is exactly what this calculator answers. As a starting rule: prioritize a CRIT sub-stat weapon if your Crit Ratio is unbalanced, an ATK% weapon if your ATK is low, and a weapon whose passive matches your playstyle. For Vaporize and Melt carries, Elemental Mastery weapons (Dragon\u2019s Bane, Stringless) can outperform higher-rarity stat sticks. Enter your exact panel and compare \u2014 the number, not the rarity, is what matters.',
  },
  {
    q: 'How do I choose artifacts for maximum damage?',
    a: 'Start from the artifact set that matches the reaction you play (Crimson Witch for Vaporize Hu Tao, Blizzard Strayer for Freeze Ayaka, Emblem for burst DPS). Then get the correct main stats: ATK%/HP%/EM sands depending on scaling, an elemental DMG goblet, and a Crit circlet. Finally balance sub-stats toward a 1:2 Crit Ratio while keeping enough ER to burst on cooldown. This calculator\u2019s preset panel shows each popular character\u2019s recommended set and main stats so you can start from a proven template.',
  },
  {
    q: 'How much Crit Rate should I have?',
    a: 'Aim for at least 60% Crit Rate on a main DPS, and ideally 70-75% before external buffs. Below 60%, your damage feels inconsistent because most of your Crit DMG investment sits idle on non-crits. Blizzard Strayer Freeze builds can stop at 45% because the set and Cryo Resonance add up to 55% more against frozen enemies. Above 100% is wasted \u2014 this calculator caps Crit Rate at 100% automatically.',
  },
  {
    q: 'Why is my damage lower than I expected?',
    a: 'The three most common culprits are enemy level, resistance, and missing buffs. If you test against a level 90+ enemy instead of a low-level Hilichurl, the DEF multiplier alone cuts your damage roughly in half. Physical damage against Ruin Guards (70% RES) is also brutal. Finally, team buffs \u2014 VV shred, Bennett, Noblesse \u2014 are part of the "screenshot" numbers you see online; without them your hit will look much smaller. Replicate the exact enemy and buffs in this calculator and the gap should close.',
  },
  {
    q: 'What is a "damage per screenshot" or nuke build?',
    a: 'A nuke build maximizes one single amplified hit \u2014 usually a Melt or Vaporize burst \u2014 for the biggest number possible, often at the expense of Crit Rate and consistent DPS. It stacks Crit DMG extremely high, feeds the carry Bennett + Kazuha + a reaction enabler, and relies on fishing for the crit. These builds look impressive but are not representative of real team damage; use the Expected Damage figure here (which averages in Crit Rate) if you want a number that reflects actual output over time.',
  },
  {
    q: 'How can I increase my damage?',
    a: 'In rough order of return: level your main talent to 9 or 10, level the character to 90 for reaction and DEF scaling, fix your Crit Ratio toward 1:2, run an Anemo unit with Viridescent Venerer, add Bennett or an equivalent buffer, and level your weapon to 90. Artifact sub-stat farming comes last because it has the worst return per resin \u2014 a talent level is a guaranteed 6-7% gain, while a good artifact roll is a lottery. This calculator\u2019s multiplier breakdown shows exactly which factor is dragging your number down.',
  },
  {
    q: 'Which matters more, character level or talent level?',
    a: 'Talent level usually wins for raw damage per resource: each talent level is a guaranteed 6-7% multiplier increase on that skill. Character level matters most for reaction-based and DEF-scaling characters because the DEF multiplier and transformative reaction base damage both scale with level; going 80\u219290 raises transformative damage by roughly 34%. For a pure ATK/CRIT carry, level 80/90 with level 9 talents beats level 90 with level 6 talents.',
  },
  {
    q: 'What is the best free-to-play weapon?',
    a: 'The Catch (from Inazuma fishing) is the best free polearm and competitive with 5-stars on Raiden Shogun and Xiangling. For bows, the craftable Prototype Crescent and Hamayumi are solid. In general, free weapons that provide a CRIT sub-stat or a strong, always-on passive (The Catch, Fleuve Cendre Ferryman, the craftable Sapwood Blade for Dendro supports) beat higher base-ATK weapons with useless passives. Use this calculator to check whether your free option is close to a 5-star before you spend pulls.',
  },
  {
    q: 'Can I import my character with my UID?',
    a: 'This calculator includes a UID import that pulls your showcased characters from the public Enka.network service \u2014 no login required. Only the characters you set on your in-game profile showcase are visible. If a character doesn\u2019t load, update your in-game showcase and wait a few minutes for Enka to refresh. Importing your real build is the most accurate way to get a true damage number, because it removes every manual-entry error.',
  },
  {
    q: 'How do elemental reaction multipliers work?',
    a: 'Amplifying reactions multiply your entire hit: Vaporize is 1.5\u00d7 when Pyro triggers on Hydro (or 2.0\u00d7 reverse-Vaporize when Hydro triggers on Pyro), and Melt is 2.0\u00d7 when Pyro triggers on Cryo (1.5\u00d7 reverse). Elemental Mastery further scales this bonus by 2.78 \u00d7 EM \u00f7 (EM + 1400). Transformative reactions instead deal a separate fixed hit that ignores the attacker\u2019s ATK and talent multiplier and scales only with level, EM, and enemy RES \u2014 which is why Hyperbloom and Burgeon teams build full EM and ignore CRIT entirely.',
  },
  {
    q: 'What are transformative reactions and how much do they hit for?',
    a: 'Transformative reactions \u2014 Overload, Superconduct, Electro-Charged, Swirl, Bloom, Hyperbloom and Burgeon \u2014 deal their own damage independent of ATK and CRIT. Their damage = Level Multiplier \u00d7 base reaction coefficient \u00d7 (1 + EM bonus + reaction bonuses) \u00d7 RES multiplier. At level 90 the level multiplier is 1446.85, so a Hyperbloom (coefficient 6) with 800 EM deals roughly 30,000+ before resistance. Because they ignore CRIT, they are cheap to build and scale purely with EM and character level.',
  },
  {
    q: 'How do Aggravate, Spread, Hyperbloom and other Dendro reactions work?',
    a: 'Dendro introduced two families. Quicken (Aggravate and Spread) adds a flat damage bonus to the triggering Electro or Dendro hit that scales with level and EM but still benefits from CRIT and DMG bonus \u2014 so those characters build a normal CRIT set with an EM sands. Bloom-family reactions (Bloom, Hyperbloom, Burgeon) are transformative: they ignore CRIT entirely and want maximum EM and level on the single trigger character. The two families want opposite builds, so identify which reaction your team actually triggers before farming.',
  },
  {
    q: 'How is Raiden Shogun damage calculated?',
    a: 'Raiden\u2019s burst converts her Energy Recharge into DMG bonus and her skill provides burst DMG bonus, so ER is effectively a damage stat on her \u2014 which is why Emblem of Severed Fate and Engulfing Lightning are her best set and weapon. Her first Musou Shinsetsu slash has one of the highest multipliers in the game (over 700% at talent 10 with full Resolve stacks). Feed her Bennett\u2019s ATK buff, Kazuha\u2019s VV shred, and a Sara or Fischl, and her initial slash is where the screenshot numbers come from.',
  },
  {
    q: 'What is the highest single hit possible in Genshin Impact?',
    a: 'The practical answer is a Melt or reverse-Vaporize burst from a hyper-invested carry against a heavily debuffed, low-resistance target \u2014 historically Eula\u2019s physical burst and Hu Tao\u2019s Melt burst have set community records in the millions. Zhongli\u2019s Planet Befall has the highest raw single-hit multiplier (900% at talent 10) but has no amplifying reaction, so its ceiling is lower. The "highest hit" is mostly a showcase of buff stacking and luck, not a realistic build target.',
  },
  {
    q: 'Is EM or ATK% better for Hu Tao?',
    a: 'For a Vaporize Hu Tao, Elemental Mastery is usually better until you have roughly 100-200 EM, because her low base ATK makes ATK% scale poorly while her HP conversion already covers attack. Past that point, Crit and HP% pull ahead of both. A common optimal sands is HP% or EM with EM sub-stats, depending on your weapon \u2014 if you run Dragon\u2019s Bane (which grants EM), an HP% sands is best; with Staff of Homa, an EM sands often wins. Enter your exact weapon and this calculator\u2019s multiplier breakdown will show which stat is currently limiting you.',
  },
  {
    q: 'What is the difference between DPS and single-hit damage?',
    a: 'Single-hit damage is one number; DPS averages damage over a full rotation including cooldowns, energy, and how many hits land. A character with a huge burst but long downtime can have a lower DPS than a character with smaller but constant hits. This calculator reports per-hit and expected damage (which averages crits) \u2014 it does not yet model full rotation DPS. When comparing, keep the same skill and reaction so the comparison is apples-to-apples.',
  },
  {
    q: 'What enemy should I test my damage against?',
    a: 'The community standard is a level 90 enemy with 10% resistance \u2014 the "generic" benchmark \u2014 because it removes enemy-specific variance. Real bosses and the Spiral Abyss have higher effective HP and some have elevated resistances, so your in-abyss numbers will look smaller. If you want to compare builds fairly, always test against the same enemy at the same level; this calculator\u2019s enemy selector includes a generic level-90 target plus a few physical-resistant enemies for reality checks.',
  },
  {
    q: 'Does weapon refinement matter for damage?',
    a: 'Yes, and the value depends on the weapon\u2019s passive. Refinements raise the passive effect \u2014 for a stat-stick like Staff of Homa the difference between R1 and R5 is modest, but for passive-driven weapons (The Catch\u2019s burst bonus, Favonius\u2019 energy generation) each refinement is a meaningful jump. As a rough guide, going from R1 to R5 on a strong 5-star passive is typically a 10-25% final damage increase depending on how much of the passive you can actually trigger.',
  },
  {
    q: 'How often is this data updated?',
    a: 'Character base stats, weapon stats, and multipliers are maintained against the live game and updated within 48 hours of each version patch. New characters and weapons are added when they release. Because the damage formula itself rarely changes, most updates are data refreshes \u2014 the calculation engine stays the same. The version this snapshot targets is listed in the page header; if a new character is missing, check back shortly after the patch.',
  },
  {
    q: 'Is this calculator affiliated with HoYoverse?',
    a: 'No. This is an independent fan-made tool and is not affiliated with, endorsed by, or sponsored by HoYoverse, miHoYo, or Cognosphere. Genshin Impact and all related characters, weapons, and assets are the property of their respective owners. The tool is free, does not require an account, and never asks for your password \u2014 the UID import uses only the public Enka.network API, which reads your in-game showcase.',
  },
  {
    q: 'What is the best build for Raiden Shogun?',
    a: 'Raiden Shogun wants the Emblem of Severed Fate 4-piece set, an Energy Recharge sands, an Electro DMG (or ATK%) goblet, and a Crit circlet. Her best weapon is Engulfing Lightning, with The Catch as the outstanding free alternative. Because her kit converts Energy Recharge into DMG bonus, aim for roughly 220-250% ER while keeping a 1:2 Crit ratio around 60/120 before buffs. Stat priority: ER (until enough to burst on cooldown) > Crit Rate/DMG > ATK%. Use this calculator\u2019s Raiden preset, then toggle Bennett, Kazuha and Sara to see the full hypercarry number.',
  },
  {
    q: 'What is the best build for Hu Tao?',
    a: 'Hu Tao runs Crimson Witch of Flames 4-piece (or Shimenawa\u2019s Reminiscence), with an HP% or Elemental Mastery sands, a Pyro DMG goblet, and a Crit circlet. Staff of Homa is her best weapon; Dragon\u2019s Bane and Deathmatch are the best 4-star options. Because her base ATK is the lowest in the game (106), ATK% is nearly worthless on her \u2014 HP and EM scale far better. Aim for 30k+ HP, 100-200 EM, and a 70/140 or better Crit ratio. She must stay below 50% HP to activate her A4 Pyro DMG bonus, which is why she pairs so well with Zhongli\u2019s shield instead of a healer.',
  },
  {
    q: 'What is the best build for Neuvillette?',
    a: 'Neuvillette wants Marechaussee Hunter 4-piece (the set alone grants up to 36% free Crit Rate), an HP% sands, a Hydro DMG goblet, and a Crit DMG circlet. Tome of the Eternal Flow is his signature; the craftable Prototype Amber is a strong free option. Because he scales entirely off HP, stack HP% and Crit DMG while keeping Crit Rate around 40-64% (the set and a Crit weapon cover the rest). A typical target is 35k+ HP and a 64/250 Crit ratio. He is self-sufficient enough to solo-carry, so his teams mostly add off-field damage and interruption resistance.',
  },
  {
    q: 'What is the best build for Furina?',
    a: 'Furina builds Golden Troupe 4-piece for maximum off-field skill damage, with an HP% sands, a Hydro DMG goblet, and a Crit circlet. Splendor of Tranquil Waters is her signature; Fleuve Cendre Ferryman (the Fontaine fishing sword) and Festering Desire are the best free options. She scales off HP and wants enough Energy Recharge (180-220% depending on team) to keep her Burst up, plus a healthy Crit ratio. Her Burst\u2019s team-wide DMG bonus makes her one of the highest-value characters in the game \u2014 farm her ER first, then HP and Crit.',
  },
  {
    q: 'What is the best build for Arlecchino?',
    a: 'Arlecchino uses Fragment of Harmonic Whimsy 4-piece, an ATK% sands, a Pyro DMG goblet, and a Crit circlet. Crimson Moon Semblance is her signature; Deathmatch and White Tassel are the best 4-star options. She cannot be healed in combat, so her Bond of Life mechanic rewards aggressive play. Aim for a 70/140+ Crit ratio and 2,000+ ATK, and remember she wants a shielder rather than a healer in the team. Her Vaporize teams (with Xingqiu or Yelan) and Overload teams (with Chevreuse) both perform strongly.',
  },
  {
    q: 'What is the best build for Mavuika?',
    a: 'Mavuika, the Pyro Archon, builds Obsidian Codex 4-piece, an ATK% or EM sands, a Pyro DMG goblet, and a Crit circlet. A Thousand Blazing Suns is her signature claymore; Serpent Spine is an excellent 4-star alternative. She wants high ATK and Crit (a 70/160+ ratio) with some EM for her Vaporize and Melt nukes. Her Burst is one of the strongest single hits in the game, so the reference panel here uses her burst multiplier \u2014 toggle a Vaporize reaction and Bennett to see the full screenshot potential.',
  },
  {
    q: 'What is the best build for Navia?',
    a: 'Navia builds Nighttime Whispers 4-piece (or Archaic Petra + ATK% 2-piece sets), an ATK% sands, a Geo DMG goblet, and a Crit circlet. Verdict is her signature; Serpent Spine and Wolf\u2019s Gravestone are strong alternatives. She scales off ATK and Crit, and her damage is loaded into her Skill\u2019s crystallize-powered shotgun blasts. Aim for 70/150+ Crit and 2,200+ ATK, and run her with a second Geo unit plus two elemental teammates to generate the crystallize shards her Skill consumes.',
  },
  {
    q: 'What is the best build for Kazuha?',
    a: 'Kazuha\u2019s support build is Viridescent Venerer 4-piece with an Elemental Mastery sands, goblet, and circlet \u2014 as much EM as possible (800-1000). Freedom-Sworn is his best weapon; Iron Sting and Favonius Sword are the best free options. His value comes from two things: the VV set\u2019s 40% RES shred and his A4 passive that converts EM into an elemental DMG bonus for the whole team. He also needs enough ER (160-180%) to burst every rotation. This is why he is in almost every reaction team \u2014 no other single character adds so much team damage.',
  },
  {
    q: 'What is the best build for Nahida?',
    a: 'Nahida builds Deepwood Memories 4-piece, an Elemental Mastery sands, an EM goblet (or Dendro DMG if you reach high EM elsewhere), and an EM or Crit circlet. A Thousand Floating Dreams is her signature; Sacrificial Fragments and Magic Guide are the best 4-star options. Aim for 800-1000 EM while keeping enough Crit to make her Tri-Karma Purification hits matter. She is the single best Dendro enabler in the game \u2014 her skill links enemies and applies Dendro with near-perfect uptime, making her core to Hyperbloom, Aggravate, Spread, and Burgeon teams alike.',
  },
  {
    q: 'What is the best build for Zhongli?',
    a: 'Zhongli has two builds. As a shield support, run Tenacity of the Millelith 4-piece with full HP% main stats and the Black Tassel to maximize shield strength (50k+ HP). As a burst nuke, run Archaic Petra 2-piece + Noblesse Oblige 2-piece with an HP% or ATK% sands, Geo DMG goblet, and Crit circlet \u2014 Staff of Homa is his best nuke weapon. His Planet Befall has one of the highest single-hit multipliers in the game (900% at talent 10), but it has no amplifying reaction, so its ceiling is lower than Melt or Vaporize nukes.',
  },
  {
    q: 'What is the best build for Bennett?',
    a: 'Bennett\u2019s buff scales only off his base ATK (his own base ATK + his weapon\u2019s base ATK), so give him the highest base-ATK sword you have \u2014 Aquila Favonia or Mistsplitter Reforged are ideal. Artifacts matter far less: Noblesse Oblige 4-piece is standard for the team-wide 20% ATK bonus. Prioritize Energy Recharge (200%+) so his Burst is always ready, then HP% for stronger healing. Do not farm ATK% artifacts for him \u2014 they do not increase his buff at all, because artifact ATK is not base ATK.',
  },
  {
    q: 'What is the best build for Xiangling?',
    a: 'Xiangling builds Emblem of Severed Fate 4-piece, an Energy Recharge or ATK% sands, a Pyro DMG goblet, and a Crit circlet. The Catch is her best free weapon and competitive with 5-stars; Staff of Homa and Staff of the Scarlet Sands are premium options. Because her Pyronado snapshots buffs (it locks in ATK and DMG at cast time), drop Bennett\u2019s Burst first, then cast Pyronado inside it. Aim for 180-220% ER and a 60/120+ Crit ratio. She is widely considered the best 4-star DPS in the game.',
  },
  {
    q: 'Staff of Homa vs Engulfing Lightning \u2014 which is better?',
    a: 'They serve different characters. Staff of Homa (CRIT DMG sub-stat, HP + ATK passive) is the universal polearm for Hu Tao, Zhongli, Xiangling and Xiao \u2014 it is the best all-round polearm in the game. Engulfing Lightning (Energy Recharge sub-stat) is tailor-made for Raiden Shogun and anyone who converts ER into damage. For Raiden specifically, Engulfing Lightning edges out Homa at equal refinement; for everyone else, Homa wins. Use this calculator\u2019s A/B comparison: pick a character, pin Homa as baseline, then switch to Engulfing Lightning to see the exact percentage difference on your build.',
  },
  {
    q: 'Is The Catch good for Raiden Shogun?',
    a: 'Yes \u2014 The Catch is widely considered the best free weapon for Raiden Shogun and Xiangling. At R5 it provides 32% Burst DMG and 12% Burst Crit Rate, which lines up perfectly with Raiden\u2019s Burst-focused kit. A max-refined The Catch performs within roughly 10-15% of Engulfing Lightning on most builds, making it one of the best return-on-effort weapons in the game. You get it entirely free by fishing in Inazuma. The catch (pun intended): farming the R5 takes a few hours of fishing.',
  },
  {
    q: 'Is Staff of Homa worth pulling for?',
    a: 'Staff of Homa is the highest-value weapon in Genshin Impact because of how universal it is \u2014 it is BiS or near-BiS on Hu Tao, Zhongli, Xiangling, Xiao, Raiden and almost every other ATK- or HP-scaling polearm user. Its CRIT DMG sub-stat is always useful and its HP + ATK passive activates for every character. If you only pull one weapon banner in your account, this is the strongest single choice. The main downside is the weapon banner\u2019s pity system, which is less forgiving than the character banner.',
  },
  {
    q: 'Are constellations worth it in Genshin Impact?',
    a: 'It depends entirely on the character. Some constellations are massive power spikes (Raiden C2, Hu Tao C1, Furina C2, Nahida C2) while others are minor quality-of-life improvements. As a rule of thumb, a new character almost always beats a constellation unless that constellation is a well-documented breakpoint. Before pulling, check the specific character\u2019s constellation value: a good C1 or C2 can be a 20-40% damage increase, but most C3-C5 are small. The strongest constellations in the game are those that ignore DEF, add reactions, or remove a kit\u2019s core limitation.',
  },
  {
    q: 'Is Raiden Shogun C2 worth it?',
    a: 'Yes \u2014 Raiden\u2019s C2 is widely considered one of the single best constellations in Genshin Impact. It makes her Burst ignore 60% of the enemy\u2019s DEF, which is roughly a 40%+ damage increase on her Burst (DEF shred is one of the rarest and most valuable stats in the game). For context, most constellations are a 5-15% increase, so C2 Raiden is exceptional value. C3 (a +3 Burst talent level) is also strong. If you main Raiden, C2 is the single highest-value vertical investment you can make \u2014 far better than refining Engulfing Lightning.',
  },
  {
    q: 'Is Hu Tao C1 worth it?',
    a: 'Hu Tao\u2019s C1 is one of the best quality-of-life and damage constellations in the game. It removes the stamina cost of her charged attacks while her Skill is active, which both increases her damage (more charged attacks per rotation) and makes her dramatically easier to play (no stamina management, better dodging). It is roughly a 15-25% effective damage increase depending on play skill. Combined with her C1, Homa, and a proper Vaporize setup, she becomes one of the strongest single-target carries in the game. C1 is generally recommended before her weapon if you play her on-field.',
  },
  {
    q: 'Which constellation gives the biggest damage increase?',
    a: 'The biggest single-constellation damage spikes in Genshin Impact are: Raiden C2 (ignores 60% DEF, ~40% Burst damage), Nahida C2 (Dendro reactions can crit, huge for Bloom and Quicken teams), Furina C2 (her Burst stacks far faster, unlocking her full team buff), and Hu Tao C1 (removes charged-attack stamina cost). In general, constellations that shred DEF, enable reaction crits, or remove a character\u2019s core limitation are worth far more than flat stat increases. Always verify the specific breakpoint before spending \u2014 some characters peak at C1, others at C6.',
  },
  {
    q: 'What changed in Genshin Impact 7.0?',
    a: 'Version 7.0 (\u201cLuna VII\u201d / Everwinter Without Mercy) launched August 12, 2026 and opened the Snezhnaya region. It added the Cryo Traveler, new characters Odette and Alyosha, new Snezhnaya weapons and artifact sets (Scarlet Proof and Heart of the Furnace), new bosses (Immortal Construct and Chimeric Winged Lion), and the new Stellar-Conduct reaction for the Cryo Traveler. As with every patch, the damage formula itself is unchanged \u2014 only the character and weapon data expands. This calculator\u2019s data snapshot targets 7.0.',
  },
  {
    q: 'Is this calculator updated for version 7.0?',
    a: 'Yes \u2014 the data snapshot targets version 7.0 (the Snezhnaya patch). Character base stats, weapon stats, and talent multipliers are refreshed within 48 hours of each version patch, and new characters are added as they release. The calculation engine itself follows the official damage formula and does not change between versions. If a brand-new character is not yet listed, check back shortly after the patch \u2014 new 7.0 characters are added as their exact stats are confirmed.',
  },
  {
    q: 'Who are the new characters in version 7.0?',
    a: 'Version 7.0\u2019s Phase 1 introduced Odette (5-star) and the 4-star Electro character Alyosha, alongside an Arlecchino rerun. The Cryo Traveler also became available by touching a Statue of the Seven in Snezhnaya. Phase 2 features Ineffa and Flins reruns. Earlier 6.x patches added the Nod-Krai and Snezhnaya cast including Lauma, Flins, Aino (the first Hydro claymore), and Lohen. New characters are added to this calculator\u2019s roster as their exact base stats and multipliers are confirmed from the live game.',
  },
  {
    q: 'What is snapshotting in Genshin Impact?',
    a: 'Snapshotting means a deployed ability locks in (\u201csnapshots\u201d) the stats of its caster at the moment it is cast, and keeps those stats for its full duration \u2014 even after buffs expire. Xiangling\u2019s Pyronado, Fischl\u2019s Oz, and Beidou\u2019s Stormbreaker all snapshot. This is why the standard rotation is Bennett Burst first, then the snapshottable ability: the ability keeps Bennett\u2019s ATK buff for its entire duration. Not every ability snapshots (Xingqiu\u2019s Raincutter, for example, updates dynamically). Knowing which abilities snapshot lets you stack buffs far more efficiently.',
  },
  {
    q: 'How does Bennett\u2019s ATK buff scale?',
    a: 'Bennett\u2019s Fantastic Voyage adds a flat ATK bonus equal to a percentage of his base ATK \u2014 which is his own base ATK plus his weapon\u2019s base ATK only. Artifact ATK, ATK% sub-stats, and food do not count. This is why a high base-ATK sword (Aquila Favonia, Mistsplitter) is so valuable on him and why ATK% artifacts are wasted. His C1 adds a further 20% ATK. Because the buff is flat ATK added before your ATK% multipliers, it effectively multiplies your entire attack investment \u2014 which is why he is the most used support in the game.',
  },
  {
    q: 'How does Elemental Resonance affect damage?',
    a: 'Elemental Resonance is the passive bonus from having two characters of the same element. The damage-relevant ones are: Pyro Resonance (+25% ATK), Cryo Resonance (+15% Crit Rate against Cryo-affected or Frozen enemies), Geo Resonance (+15% DMG while shielded), and Hydro Resonance (+25% HP). Pyro and Cryo are the most impactful for carry damage. When comparing builds, remember to include resonance in your target stats \u2014 a Freeze Ayaka can run 45% Crit Rate because Cryo Resonance and Blizzard Strayer together add up to 55%.',
  },
  {
    q: 'What is the difference between on-field and off-field DPS?',
    a: 'An on-field DPS (also called a carry or hypercarry) deals damage through normal attacks, charged attacks or a Burst that requires them to stay on the field \u2014 Hu Tao, Neuvillette, Raiden and Mavuika are examples. An off-field DPS deals damage while another character is active \u2014 Xiangling\u2019s Pyronado, Fischl\u2019s Oz, Yelan\u2019s Burst and Xingqiu\u2019s Raincutter. Most strong teams pair one on-field carry with one or two off-field DPS plus a support, so all four characters contribute damage simultaneously. This calculator reports per-hit damage for whichever character you select \u2014 it does not yet sum a full rotation.',
  },
  {
    q: 'Can I calculate DPS (damage per second) instead of damage per hit?',
    a: 'This calculator reports per-hit and expected (crit-averaged) damage for a single skill \u2014 it does not yet model full rotation DPS, which would require cooldowns, energy, animation frames and hit counts for every character. For an honest apples-to-apples comparison, keep the same skill, reaction and enemy, and compare the expected damage number. If you need true rotation DPS, pair this calculator with a community spreadsheet or a full team simulator. Per-hit damage is the correct tool for weapon and artifact comparisons, which is what most players actually need.',
  },
  {
    q: 'How do I screenshot damage (nuke showcase)?',
    a: 'A damage-per-screenshot nuke maximizes one amplified hit. The recipe: pick a Melt or reverse-Vaporize Burst (Hu Tao, Mavuika, Childe or Eula for physical), stack Crit DMG extremely high (250%+), then layer Bennett, Kazuha (VV shred + DMG bonus), a reaction enabler, and food/potion buffs. Test against a low-resistance, low-level or debuffed enemy to inflate the number. These builds are not representative of real team DPS \u2014 they rely on fishing for the crit and often run under 50% Crit Rate. Use the Expected Damage figure in this calculator if you want a number that reflects actual output over time.',
  },
  {
    q: 'Why do my in-game numbers differ from the calculator?',
    a: 'The most common causes are: (1) enemy mismatch \u2014 testing against a different enemy level or resistance than you set here; (2) missing buffs \u2014 VV shred, Bennett, resonance and food are part of the \u201cscreenshot\u201d numbers you see online; (3) hidden rounding in the game; and (4) the calculator\u2019s reference panel using a talent-10, level-90 preset rather than your exact build. Import your UID for the closest match \u2014 that pulls your real panel through Enka.network. If the gap persists, double-check the reaction, enemy resistance and DEF shred settings.',
  },
];
