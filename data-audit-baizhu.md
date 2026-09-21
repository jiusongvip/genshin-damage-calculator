# 数据准确性核验报告 — 首个角色：白术

核验日期：2026-09-20 · 数据快照：genshin-db v5.2.13（GI 7.0）
核验脚本：`npm run check:data`（`scripts/verify-baseline.mjs`）
回归测试：`src/lib/data-audit.test.ts`（16 项）

---

## 一、结论

**白术这个角色的"数字"本身是对的，但我们对他的建模和对外呈现是错的。**

- 三方独立数据源（genshin-db / damage.paimon.app / genshin.aspirine.su）全部确认：
  白术的 Lv90 基础属性、突破属性 28.8%、以及全部天赋倍率，我们**逐位对得上**。
- 但站点对外展示的白术数字（首页 **5,627**）既不是他的治疗量、也不是他的爆发伤害，
  而是**普攻四段连段 × ATK**——而 `characters.ts` 里写的是"爆发、按生命值缩放"。
- 顺带在全站扫描中查出 **6 类系统性数据缺陷**，其中 2 类会直接算错伤害。

---

## 二、核验方法（三层）

| 层 | 比对对象 | 手段 | 结果 |
|---|---|---|---|
| 基准层 | 角色基础属性 / 突破 / 天赋倍率 | 对 genshin-db 全自动逐字段比对（122 角色） | **233 处偏差** |
| 引擎层 | 同一面板下的逐击伤害 | 站点引擎 vs paimon.app 官方数值 | 公式本身正确（Klee 已交叉验证） |
| 口径层 | 反应系数 / DEF / RES | 对 KQM 公式 | 无差异 |

参照源可信度排序：genshin-db v5.2.13 → damage.paimon.app（Nuxt bundle `c052070.js`）→
genshin.aspirine.su（静态 `js/db.js`）→ Genshin Optimizer。

---

## 三、白术逐项核验

### ✅ 对得上的部分

| 字段 | 我们 | 三方一致值 | 位置 |
|---|---|---|---|
| Lv90 基础 HP / ATK / DEF | 13348 / 192.54 / 500 | 13348.04 / 192.54 / 499.56 | `levelStats.ts:106` |
| 突破属性 | hp% **0.288** | 0.288（paimon 与 aspirine 均为 28.8%） | `characters.ts:110` |
| 缩放 | `hp` | 技能与爆发均按生命值上限 | `characters.ts:110` |
| 1/2/4 段普攻（L10） | 0.672667 / 0.655646 / 0.974477 | 完全一致 | `generated/talents.ts` |
| 重击（L10） | 2.17872 | 一致 | 同上 |
| 元素战技 Skill DMG（L10） | 1.4256 | 一致 | 同上 |
| 元素爆发 Spiritvein DMG（L10） | 1.747152 | 一致 | 同上 |
| 伤害行元素 | 全部 `dendro` | 法器角色无物理普攻 | 同上 |

> 引擎层实测：白术爆发灵气脉一击 = 18,743（非暴击），
> 23840 HP × 1.747152 × DEF 0.5 × RES 0.9 —— 公式链路正确。

### ❌ 白术的 4 个问题

**1｜普攻第三段少算一半（真错，低 13%）**

genshin-db 的标签原文是 `3-Hit DMG|{param3:F1P}×2`，末尾那个 `×2` 表示这一下打两段。
paimon.app 的日文标签同样是 `3段ダメージ|{param3:F1P}×2`；
aspirine.su 更是直接把 `normal_hit_3` 建模成 `items:[{hits:2}]`。

而 `scripts/generate-talents.mjs` 用 `rawLabel.split('|')` 取标签时**把格式串整个丢掉了**，
`×2` 随之消失，`hits` 字段落回 1。

- 现状：第三段 0.405749，实际应为 0.811498
- 后果：普攻四段总倍率 **2.709 → 应为 3.114**（低 13%）

**2｜`skillName` 与 `skillMultiplier` 是死数据，且自相矛盾**

`characters.ts` 写的是 `skillName: 'Holistic Revivification (Burst)'`、`skillMultiplier: 1.6`。
但 `signatureTalent('baizhu')` 永远能解析出结果，于是这两个字段**从不生效**。
引擎实际挑的是**普攻连段 2.709**——既不是 1.6，也不是爆发的 1.747。

**3｜首页 5,627 的含义与卡片文案不符**

首页预设行的算法是 `resolvePreset` 面板 + 套装 buff，攻击类型取 `signatureTalent().key`。
白术解析到 `normal`，而普攻在 `ALT_SCALING_ATTACKS` 里没有例外，于是**回落 ATK**。

实测：`totalATK 1352 · totalHP 36174 · CR 40.0% · CD 182.2% · 倍率 2.709 → 5,627`

也就是说这个数字是"一套成型圣遗物下、以攻击力缩放的普攻四段连段"。
但卡片旁边写着 `Dendro healer + shield.` 和 `Jadefall's Splendor`，
读者会以为这是他的治疗量或爆发伤害。

> 另外：预设区正文写「Each number uses the character's highest-damage talent, **named on the card**」，
> 但卡片上只有 CR / CD / 武器名，**并没有天赋名**。

**4｜C2 / C6 不参与运算**

`src/data/constellations.ts` 的 `CONSTELLATION_EFFECTS` 只覆盖 5 个角色，不含白术。
C2 的额外灵气脉、C6 的 +8% 生命上限都不进引擎，用户勾选后数字不变。

---

## 四、全站系统性问题（按严重度）

### P0｜`×N` 多段倍率被丢弃 —— 51 行 / 33 个角色

同一根因（见三·1）。受影响的都是**被当作一击算的多段攻击**：

| 角色 | 行 | 实际段数 |
|---|---|---|
| keqing | Consecutive Slash DMG | ×8 |
| lohen | Skill DMG | ×6 |
| clorinde / wriothesley / wanderer | Skill DMG | ×5 |
| zhongli | 5-Hit DMG | ×4 |
| ayaka | 4-Hit DMG / Charged Attack DMG | ×3 / ×3 |
| **baizhu** | 3-Hit DMG | ×2 |
| … | 另 42 行 | 2–5 |

`HIT_COUNT_OVERRIDE` 里只有 3 条 Klee 的记录，**这 51 行一条都没被覆盖**。

### P0｜治疗加成被当成攻击力 —— Qiqi 白涨 22% ATK

genshin-db 里 Qiqi 的 `substatType = FIGHT_PROP_HEAL_ADD`（治疗加成 22.15%），
治疗加成**不影响伤害**。但 `characters.ts` 把它标成 `atk%`，
`levelStats.ts` 的 `spec` 又存了 `0.22`，于是引擎乘了个 1.22。

实测：`baseATK 961 → totalATK 1172`，比值 **1.2200**。

同一类型错误的还有 Jean、Jahoda，但它们的曲线值是 0，所以今天无害。

### P1｜突破属性曲线被舍入到 2 位小数 —— 63 个角色

`levelStats.ts` 的 `spec` 数组**每一位**都被舍入到 2 位小数：

| 真值 | 我们 | 角色举例 |
|---|---|---|
| 0.288 | 0.29 | baizhu, klee, zhongli, alhaitham… |
| 0.242 | 0.24 | diluc, yoimiya, furina, yelan… |
| 0.884 | 0.88 | hu-tao, neuvillette, ayaka, navia… |
| 0.2667 | 0.27 | bennett, kaeya, yun-jin |
| 0.072 / 0.144 / 0.216 | 0.07 / 0.14 / 0.22 | 全角色（中间档位同样被舍） |

注意：`characters.ts` 里的 `ascension.value` 存的是 **0.288 正确值**，
只有 `levelStats.ts` 是 0.29——**同一个字段在两个文件里不一致**（后者才是引擎实际用的）。
另外 `spec` 被舍的不只是末值，**中间档位同样被舍**（见上表最后一行），所以整条升级曲线都偏低。

### P1｜`characters.ts` 的基础属性有 44 处错误

虽然今天不显示（UI 走 `levelStats` 曲线），但它们是引擎的 fallback，
一旦某角色曲线缺失就会静默算错：

- **baseHP 错 17 个**：chevreuse 9898→11962、mika 10875→12506、lan-yan 10331→9244、alyosha 10875→11962、citlali 12655→11634…
- **baseATK 错 15 个**：citlali 236→**127**、lohen 304→344、alyosha 225→265、chevreuse 224→193、gaming 249→302…
- **baseDEF 错 12 个**：citlali 605→763、varesa 637→782、chevreuse 706→605、lan-yan 604→580…

多处数值看起来是从别的角色整行粘错的（alyosha 的 HP 与 chevreuse 的"正确值"同为 11962）。

### P1｜`ascension.value` 混用了两套单位约定 —— 15 个角色有隐患

`damage.ts` 的设计是：`levelStats.spec` 存**原始值**（含基础暴击），
`characters.ts` 的 `ascension.value` 存**已扣掉基础的值**，引擎只对前者做扣减。
两条路各自都算得对——但 `characters.ts` 里**两种约定混着用**：

- 存【已扣基础】（14 个）：mavuika、diluc、furina、yelan、mualani、yae-miko、clorinde、varesa、xiao、wanderer、itto、kinich、emilie、flins
- 存【原始值】（15 个）：hu-tao、arlecchino、yoimiya、lyney、neuvillette、ayato、keqing、cyno、ganyu、ayaka、eula、wriothesley、chasca、navia、lohen

后果：这 15 个角色一旦走 fallback（曲线缺失），会**白拿 +5% 暴击率或 +50% 暴击伤害**。
今天全部 122 个角色都有曲线，所以不发作——属于隐患而非现网错误。

> 说明：本报告脚本的 `ascension` 一列报出 34 处偏差，其中 14 处属于上面这个
> **有意为之**的扣减约定，不是错误。真正需要处理的 20 处是：
> 16 处 2 位小数舍入（0.88/0.24/0.29 之类）、3 处治疗加成、1 处 lauma（见下）。
> `lauma` 在 `characters.ts` 里写 EM 315，而 genshin-db 与 `levelStats.ts` 都是 115.2。

### P2｜`src/data/talents.ts` 声称自动生成，实际没有生成器 —— 88 处偏差

文件头写 `AUTO-GENERATED from genshin-db v5.2.13`，
但 `scripts/` 下**没有任何脚本会写这个文件**（`generate-talents.mjs` 只写 `generated/talents.ts`）。
它实际上是手工维护的，于是和生成器自己的规则脱节：

| 字段 | 偏差数 | 典型 |
|---|---|---|
| `normal` | 42 | lyney 3.721→14.24、sethos 3.499→11.54、yoimiya 6.158→7.32 |
| `charged` | 29 | 24 个角色记为 0 |
| `skill` | 9 | lisa 8.77→5.76、illuga 4.343→16.29、chiori 3.6→6.05 |
| `burst` | 8 | illuga 0→22.33、ineffa 0→12.18、nefer 8.087→18.20 |

**其中"`charged` = 0"值得单独说**：24 个角色记为 0，其中 **21 个是弓系角色**。
`signatureTalent()` 会跳过所有 ≤ 0 的键，于是**甘雨、宵宫、林尼、赛索斯、提纳里、
恰斯卡等以重击/瞄准射击为核心的角色，永远不可能以重击作为代表天赋**——
甘雨的首页数字是"普攻连段"。

**`normal` 的偏差是口径冲突，不是单纯算错**：
`talents.ts` 的 `normal` 只累加 `N-Hit DMG`，
而 `generated/talents.ts` 的 `normal` 分组还包含瞄准射击、Prop Arrow、Spiritbreath Thorn 等。
两个文件对"普攻"的定义不同，而首页用前者、伤害表用后者。

### P3｜4 个角色在 genshin-db 中查不到

`aether` / `lumine` / `manekin` / `manekina` —— 我们的 `talents.ts` 有条目，
但 genshin-db 里没有对应记录，无法自动核验（旅行者需要按元素分支查询）。

---

## 五、建议的修复顺序

1. **`×N` 修复**（改 `generate-talents.mjs`：从格式串解析 `×N` 写入 `hits`，重跑生成器）
   —— 一次修好 33 个角色的显示伤害，且这是"我们比竞品低"的正面修复。
2. **Qiqi 的突破属性**（`levelStats.spec` 0.22 被当成 ATK% 用）—— 唯一一个会算错伤害的类型错误。
3. **`spec` 曲线保留 3 位小数**（影响 63 个角色，顺带解决 16 处 ascension 舍入）。
4. **`characters.ts` 基础属性对齐 genshin-db** —— 44 处，纯数据替换；`lauma` 的 EM 315 → 115.2 一并修。
5. **统一 `ascension.value` 的单位约定**（建议全部改存原始值，扣减只在引擎里做一次），
   消除那 15 个角色的 fallback 隐患。
6. **`src/data/talents.ts` 要么补上生成器、要么改掉 "AUTO-GENERATED" 的抬头**，
   并统一 `normal` / `charged` 的定义（尤其是弓系角色 `charged: 0` 的问题）。
7. **文案**：首页预设区"named on the card"与实际不符；白术卡片需要说明数字口径。

---

## 六、复现方式

```bash
npm run check:data            # 全站基准比对，只列偏差（退出码 1 表示有偏差）
npm run check:data baizhu     # 单角色完整明细
npm run check:data -- --all   # 列出全部偏差行
npm test                      # 47 项，含 16 项数据审计
```

竞品原始数据已留档在 `.audit/`（已加入 `.gitignore`）：

| 文件 | 内容 |
|---|---|
| `c052070.js` | damage.paimon.app 的数据 bundle（含白术 stats + 天赋标签） |
| `paimon-home.html` | paimon.app 首页快照 |
| `aspirine-db.js` | genshin.aspirine.su 的静态数据库 |
| `baizhu-4.json` | paimon 的白术属性/突破表 |
| `baizhu-11.json` | paimon 的白术天赋原始标签 |
| `baseline-full.txt` | 本次全站 233 处偏差的完整输出 |

重新抓取：paimon 的 bundle 文件名会随发版变化，从首页 HTML 的 `/_nuxt/*.js` 里
找体积最大、且 `grep -c 白朮` 不为 0 的那个即可。

---

## 七、修复记录（2026-09-21）

按第五节顺序执行。**基准层偏差从 233 处降到 92 处，且剩余 92 处全部在
`src/data/talents.ts`（见第八节的待决项）——`characters.ts` 与 `levelStats.ts`
现在零偏差。**

### 7.1 `×N` 多段倍率（第五节第 1 项）✅

`scripts/generate-talents.mjs` 之前把 `attributes.labels` 当 `"label|format"` 切开后
只保留 label，格式串里的 `×N` 被丢掉。现在从格式串解析回来：

```js
function parseHits(fmt) {
  const m = fmt.match(/[×*]\s*(\d+)/);   // 只有 × 和 * 是真实分隔符
  return m ? Number(m[1]) : 1;           // 单独的 "x" 永远属于 "Max HP" 这类词
}
```

| 项目 | 结果 |
|---|---|
| 恢复的行 | 52 行 / 34 个角色 |
| Klee 3 条炸弹 | 数据集完全没标，仍由 `HIT_COUNT_OVERRIDE` 兜底 |
| 分隔符实测 | `×` 48 处、`*` 1 处（香菱 `4-Hit DMG\|{param4:F1P}*4`） |
| 白术普攻连段 | 2.709034 → **3.114288**（与 aspirine / paimon 一致） |

### 7.2 `levelStats.ts` 重建（第五节第 2、3 项）✅

新增 `scripts/generate-level-stats.mjs`（此前该文件抬头写着 AUTO-GENERATED
却**根本没有生成器**）。`spec` 现在保留 6 位小数，不再舍入到 2 位。

| 角色 | 修复前 | 修复后 | 说明 |
|---|---|---|---|
| baizhu | 0.29 | 0.288 | 2 位小数舍入 |
| hu-tao | 0.88 | 0.884 | CRIT DMG 含基础值 0.5 |
| diluc | 0.24 | 0.242 | CRIT Rate 含基础值 0.05 |
| bennett / kaeya / yun-jin / alyosha | 0.27 | 0.2667 | 充能效率被向上舍入 |
| qiqi | 0.22 | **0.2215** | 治疗加成，见 7.3 |
| jean / jahoda | 0 | **0.2215 / 0.1846** | 之前曲线写 0，等于谎报"没有突破属性" |

`spec` 单位约定澄清：EM 与治疗加成是**平坦值**（神里绫人 28.8 就是 28.8 EM），
CRIT 与百分比是**小数**（0.288 就是 28.8%）。上轮报告说"lauma 用 28.8 而非
0.288 说明单位不统一"是**我误判**——115.2 EM 是真实值，错的是
`characters.ts` 里的 315。

### 7.3 Qiqi 的治疗加成（第五节第 2 项）✅

`FIGHT_PROP_HEAL_ADD` 对应的是**治疗加成**，对伤害没有任何贡献。
新增 `SecondaryStatType = 'heal%'`，`statBag()` 里是显式 no-op：

```ts
case 'heal%':
  // Healing Bonus boosts healing, not damage. Intentionally ignored.
  break;
```

`characters.ts` 里 Qiqi / Jean / Jahoda 的 `ascension.type` 由 `atk%` 改为 `heal%`。

**首页 Qiqi 卡片：17,365 → 15,711（−9.5%）**，这是本轮唯一一处真正的伤害错误修复。
（Jean / Jahoda 曲线本来是 0，所以她们的数字没变——但数据不再说谎。）

### 7.4 `characters.ts` 基础属性与 ascension 约定（第五节第 4、5 项）✅

新增 `scripts/sync-character-stats.mjs`，只重写每条记录里的四个数值字段，
`note` / `skillName` / `bestWeapon` 等全部保留。

| 项目 | 数量 | 说明 |
|---|---|---|
| `baseHP` 错 | 17 | chevreuse 少 2064（9898 vs 11962） |
| `baseATK` 错 | 15 | citlali 236 → **126.76**（高估 86%） |
| `baseDEF` 错 | 12 | citlali 605 → 763 |
| `ascension.type` 错 | 4 | qiqi / jean / jahoda → `heal%`；lan-yan `dmg%` → `atk%` |
| `ascension.value` 混用约定 | 34 | 现统一为"原始值"（= 曲线 90 级值） |

`ascension.value` 之前混了三套：CRIT DMG 有的存原始总量（0.884）有的只存增量
（0.384）；CRIT Rate 大多存增量（0.192）但少数存了舍入后的总量（0.24）；
lauma 存 315 EM 而数据集是 115.2。因为曲线永远存在，`value` 只是兜底，
**没有任何数字因此出错**——但它是颗地雷。现已统一，并由测试锁死。

> 关于 `baseHP` / `baseATK` / `baseDEF`：`grep` 确认这三个字段在 `src/` 下
> **没有任何消费点**（引擎用曲线）。所以 citlali 的 baseATK 从 236 改到 126.76
> **不改变任何数字**——首页 Citlali 仍是 20,960。修它们是为了数据诚实，
> 外加让新测试可以断言"三者恒等于 90 级曲线值"。

### 7.5 格式串里的缩放属性（**报告外的额外发现**）✅

核验时发现格式串会**显式写出**非 ATK 的缩放属性，而我们一律按 ATK 算：

```
Yelan      Breakthrough Barb DMG  | {param7:F2P} Max HP
Xilonen    Blade Roller 1-Hit DMG | {param10:F1P} DEF
Gorou      Skill DMG (burst)      | {param1:P} DEF
Kuki       Single Instance DMG    | {param1:F1P} Max HP
Nefer      ...3-Hit DMG (Shades)  | {param11:F1P} Elemental Mastery
```

`generate-talents.mjs` 现在回读格式串：**恰好一个**属性词时才采用，多属性
（`ATK+Elemental Mastery`）保留原兜底并明确注释——单行模型只能带一个
`scaling`，硬选一个等于悄悄丢掉另一项。

| 结果 | 数值 |
|---|---|
| 受影响的行 | 86 行 / 36 角色 |
| 其中**影响伤害**的行 | **39 行 / 10 角色**（其余是治疗、护盾、HP 消耗等非伤害行） |
| 角色 | yelan, xilonen, gorou, yun-jin, lauma, kuki-shinobu, zibai, columbina, nefer, linnea |

### 7.6 文案与实现不符（第五节第 7 项）✅

| 位置 | 问题 | 处理 |
|---|---|---|
| `index.astro` 预设区 | 宣称天赋"named on the card"，但卡片只有 CR / CD / 武器名 | **把天赋名真正渲染到卡片上**（122 张全部有），文案同步改写为准确口径 |
| `FormulaSection.astro` | 宣称存在"highest-value-upgrades list" | 该功能不存在，改为描述真实存在的武器重算与百分比增益 |
| `DamageTable.tsx` `diff` 列 | 无任何调用方传 `diff`，`hasDiff` 恒为 false | **未改**——属死代码，不产生错误信息，留待后续决定是否补上或删除 |

### 7.7 本轮改动的用户可见影响（122 个首页数字）

| 变化幅度 | 数量 | 代表 |
|---|---|---|
| 显著（>1%） | 2 | **Qiqi −9.5%**、**Lan Yan −3.5%** |
| 细微（0.05%~0.2%） | 50 | 精度细化，如 Hu Tao CD 288% → 286.8% |
| 无变化 | 70 | — |

### 7.8 新增的工程保障

| 文件 | 作用 |
|---|---|
| `scripts/generate-level-stats.mjs` | 生成 `levelStats.ts`；`--ascension-report` 输出突破真值表 |
| `scripts/sync-character-stats.mjs` | 同步 `characters.ts`；`--dry-run` 只打印差异 |
| `scripts/generate-talents.mjs` | 补上 `×N` 与缩放属性解析 |
| `src/lib/data-audit.test.ts` | 16 项 → **55 项测试**，旧 bug 锚点全部翻转，新增"生成数据自洽"断言组 |
| `package.json` | `gen:data`（一键重生成全链路）、`check:data`、`test` |

新增的自洽断言（任何一处再次漂移都会立刻失败）：

* `characters.ts` 的 `baseHP/baseATK/baseDEF` 恒等于 90 级曲线
* `ascension.value` 恒等于 90 级 `curve.spec`
* 真实治疗加成角色恰好是 `jahoda / jean / qiqi` 三人
* `row.scaling` 遵循格式串（10 条抽样）
* 多段行的 `hits` 是 ≥1 的整数

### 7.9 验证结果

```bash
npm run check:data    # 233 处偏差 → 92 处，且只剩 talents.*
npm test              # 55 项全通过
npx tsc --noEmit      # 干净
npm run build         # 11 页构建成功
```

---

## 八、弓系的 `normal` / `charged` 定义（第五节第 6 项）——**已实施**

> 状态：**已按 A 变体（射击族归入 `charged`）实施完毕**。决策与落地见 8.5；
> 8.1–8.4 保留为决策前的原始分析，以便回溯当时为什么没直接重生成。

### 8.1 问题

`groupFor()` 只按标签文本判组：

```js
if (/Plunge/i.test(label)) return 'plunge';
if (/Charged|Equitable Judgment/i.test(label)) return 'charged';
return 'normal';   // ← 兜底
```

于是弓系角色的 `normal` 变成垃圾袋。以甘雨为例，全部落在 `normal`：

```
1-Hit … 6-Hit DMG          近战式连段（弓的近身连射）
Aimed Shot                 瞄准射击（未蓄力）
Aimed Shot Charge Level 1  瞄准射击蓄力 1 段   ← 应为 charged
Frostflake Arrow DMG       霜华矢
Frostflake Arrow Bloom DMG 霜华绽发
```

`normal` 求和 = **14.542**，而它本应是 6 段连射的 5.223。林尼同理（3.721 → 14.243）。

更糟的是**同一件事有两个分组**：

| 标签写法 | 归属 |
|---|---|
| `Fully-Charged Aimed Shot`（迪奥娜、安柏等） | `charged`（因为含 "Charged"） |
| `Aimed Shot Charge Level 1`（甘雨、林尼等） | `normal`（"Charge" 不是 "Charged"） |

所以 29 个弓系角色里，有的 `charged = 2.232`、有的是 `0`，纯粹取决于措辞。

### 8.2 竞品证据

aspirine.su 把瞄准射击作为**独立类别**，与 `normal` / `charged` 并列：

```
ganyu: normal_hit_1..6 / aimed / charged_aimed / ganyu_frostflake / ganyu_frostflake_bloom / plunge* / skill_dmg
       aimed 带 category:"attack", damageType:"aimed"
```

### 8.3 如果现在直接重生成 `talents.ts`

会移动 **23 个角色的首页代表天赋**，而且**会引入新错误**（因为 `normal` 仍是垃圾袋）：

| 角色 | 现在 | 重生成后 |
|---|---|---|
| klee | normal | burst |
| lyney | burst | normal |
| tartaglia | burst | normal |
| cyno | burst | normal |
| ororon | skill | normal |
| venti | skill | normal |
| chasca | burst | normal |
| xilonen | burst | normal |
| durin | normal | burst |
| zibai | burst | normal |
| varka | burst | normal |
| sandrone | burst | charged |
| nefer | skill | burst |
| ineffa | normal | burst |
| illuga | skill | burst |
| …另 8 个 | | |

### 8.4 三个选项

| 选项 | 做法 | 代价 |
|---|---|---|
| **A** | `aimed` 归入 `charged` | `normal` 变成纯近战连段（语义正确）；但 21 个弓系的 `charged` 从 0 跳到 2.232，`normal` 骤降 |
| **B** | 新增 `aimed` 独立分组 | 需同步 `TalentGroup`、`ORDER`、`GROUP_LABEL`、`GROUP_TO_TALENT`、`bucketOf`（映射到 `charged` 以共享天赋等级）；最贴近竞品与游戏内实际，改动面最大 |
| **C** | 只统一措辞，不改分组 | 把 `Fully-Charged Aimed Shot` 与 `Aimed Shot Charge Level 1` 归到同一组，消除"同一攻击两个组"的自相矛盾；风险最小，但 `normal` 仍是混合口径 |

我的建议是 **B**：它同时解决"垃圾袋"和"同物异组"，并且和竞品口径对齐；
代价是一次性改动 5 个消费点，且需要重跑全部弓系数字。

**在选定之前，`src/data/talents.ts` 保持不动**——它现在的数字虽然口径混乱，
但至少没有被换成另一批错数。

### 8.5 已实施：射击族归入 `charged`（A 变体）

最终没有选 B（新增 `aimed` 独立分组）。理由：新增分组要同步 `TalentGroup`、
`ORDER`、`GROUP_LABEL`、`GROUP_TO_TALENT`、`bucketOf` 五个消费点，而**弓系
`combat1` 里的"射击族"（未蓄力瞄准射击 + 各角色专属箭矢）本来就是重击射击的
完整形态**——它们与 `Fully-Charged Aimed Shot` 是同一动作的不同段数表述。归入
`charged` 语义正确，且改动面只有一条规则。

**规则**（`scripts/lib/talent-rules.mjs` 的 `groupFor`）：

```js
// 弓系 combat1 不只是连段：含整个远程射击族（瞄准射击 + 各角色专属箭矢）
if (weaponType === 'bow' && !/^\d+-Hit DMG$/i.test(label)) return 'charged';
```

关键约束：**必须限定弓系**。全站适用会误伤 19 行非弓系标签——阿贝多的
`Kesagiri` 之类重击命名、希诺宁的 `Blade Roller`（是真普攻）、凝光的
`Star Jade`。限定后命中 **44 行 / 21 个弓系角色，零非弓系误伤**。

语义抽查：甘雨 / 林尼 / 提纳里 / 赛索斯 → `charged`（正确）；宵宫 → `normal`
（正确，她的 `7.623` 连段仍高于 `3.394` 重击）。

### 8.6 实施中额外发现并修复的两个 bug

**(1) `NEVER_DAMAGE` 误杀真伤害行。** 原正则含 `Activation|Stacks?|Charges`，
但这两个词出现在**真伤害标签**里：

| 角色 | 标签 | 后果 |
|---|---|---|
| Lisa | `Stack 3 Conductive Hold DMG` | 她最大的技能伤害，`8.77` 被压到 `5.76` |
| Sayu | `Skill Activation DMG` | 她最大的爆发伤害 |
| Eula | `DMG Per Stack` | 爆发伤害行 |

修复：从 `NEVER_DAMAGE` 中移除这三个词。仅提栈但不造成伤害的行（如
`Maximum Stacks`）没有 `DMG` 字样，自然落到 `false`，无需额外白名单。

**(2) 通用 Plunge 行在 `combat2` / `combat3` 里重复。** 雷电将军 / 赛诺 /
洛恩 / 丝柯克在技能或爆发天赋里重复了一份通用下落攻击行，数值与各自
`combat1` 完全相同（`1.26378` / `2.527025` / `3.15639`）。它被当作"爆发最高
倍率"，用一个 3.16 的 plunge 盖掉了雷电将军 `7.21` 的 `Musou no Hitotachi`。

修复：**裸 plunge 名优先于天赋键**归 `plunge`。玛薇卡的
`Flamestrider Plunge DMG`（`3.162`，独立数值）不受影响。

### 8.7 落地结果

| 项 | 结果 |
|---|---|
| `talents.ts` 变化条目 | 70 个 |
| `check:data` 基准偏差 | `112` → **`4`**（仅 aether/lumine/manekin/manekina 四个 genshin-db 无数据的伪角色，不可消除） |
| 测试 | 55 项全绿 |
| 类型 | `tsc --noEmit` 干净 |
| 构建 | 11 页成功，首页 122 张卡片全部渲染天赋名 |
| 首页数字抽查 | 白术 6,468（+15.0%，`×N` 修复）· 七七 15,711（治疗加成修复）· 甘雨 45,792 `Charged Attack` · 雷电将军 18,212 `Elemental Burst` · 丽莎 15,219 `Elemental Skill` |

首页天赋标签分布：`Normal Attack combo` 59 · `Elemental Burst` 38 ·
`Elemental Skill` 18 · `Charged Attack` 7。

---

## 九、导航与 Diff 列（2026-09-21，非数据类修复）

### 9.1 导航栏：子页面上所有首页锚点链接都是死的

**症状**（用户报告）：在指南页点击导航栏的 `Guides`，跳不回首页的指南区。

**根因**：`Header` 与 `Footer` 由 `BaseLayout` 全站渲染，但导航项用的是**裸 hash**：

```html
<a href="#guides">Guides</a>   <!-- 错 -->
```

裸 hash 会针对**当前路径**解析。在 `/guides/builds/` 上，`#guides` 变成
`/guides/builds/#guides` —— 该页面没有这个锚点，浏览器什么也不做。链接看起来是活的，
实际是死的。`#calculator` / `#presets` / `#faq` / `#guide` 同理，共 **8 处**
（Header 4 + Footer 4）。

有意思的是，指南文章页自己的按钮用的是**正确**的 `/#calculator`，所以这个 bug
只藏在共享的导航/页脚里。

**修复**：新增 `src/lib/section-links.ts` 的 `sectionHref(hash, pathname)` —— 首页保留
裸 hash（点击不触发整页重载），其他页面返回根绝对路径（浏览器先回 `/` 再滚到锚点）。
Header 与 Footer 都改为调用它。

**核验**（构建产物逐页统计）：

| 页面 | 裸 hash | 根绝对 |
|---|---|---|
| `index.html` | 142 | 0 |
| 其余 10 页 | 0 | 12–14 |

### 9.2 `DamageTable` 的 Diff 列：从死代码接成可用功能

`diff` 字段、`Delta` 组件、表头与 `colSpan` 分支都已存在，但**没有任何调用方**设置
`diff`，所以 `hasDiff` 恒为 `false` —— 一整列永远不出现，而注释却在宣传它
（和之前 `FormulaSection` 宣传不存在的功能是同一类问题）。

选择**接线**而不是删除：站点的主张就是"改一个值，看它值多少"，Diff 列正是这句话的
可视化，而且管道已经铺好。

**做法**：固定基线时快照**算好的数字**（而不是输入），因此不需要跑第二遍引擎：

- `snapshotBaseline(characterId, groups)` → 按行 id 记 `expected`，按组记 Total DMG
- `overlayBaseline(groups, baseline, characterId)` → 把基线数字叠回当前表格
- 按钮在 Expected 面板；固定后该面板直接显示 `vs pinned 5,626 · +15.0%`

### 9.3 接线时挖出的一个真 bug：行 id 不是按角色命名空间的

探针发现生成的行 id 形如 `combat1-0-1-hit-dmg`，**在每个角色上都存在**——它只在
单个角色内唯一。于是：

- 基线必须携带 `characterId`，否则切到别的角色后，旧基线会**逐行匹配上**同名 id，
  静默报出一整屏错误的百分比（而不是明显失败）。
- 我最初用 `useEffect` 在切角色时清掉基线。**这是错的**：effect 在渲染**之后**才跑，
  所以切换的那一帧仍会用旧基线渲染，闪出一帧错误数据。改为在**渲染路径**上把关，
  并把该判断下沉进 `overlayBaseline`（`characterId` 是必填参数，不匹配直接原样返回）。

两条不变量都已固化为测试（见 9.4），因为它们用真实数据才能说明白。

### 9.4 测试与核验

| 项 | 结果 |
|---|---|
| 测试 | **55 → 73 项**（新增 `section-links` 6 项、`DamageTable` baseline 6 项、弓系分组 3 项、Diff 不变量 2 项等） |
| `tsc --noEmit` | 干净 |
| `npm run build` | 11 页成功 |
| 新增 `vitest.config.ts` | 排除 `.audit/**` —— 该目录是审计草稿区，里面的 `*.test.ts` 是探针，被默认收集会让 `npm test` 依赖草稿状态 |



