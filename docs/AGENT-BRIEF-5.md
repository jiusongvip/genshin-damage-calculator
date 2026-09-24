# Agent brief #5 — 数字自洽、窄屏修复、角色自身状态

基线：`main` @ `056347d`（brief #3、#4 已合入并上线）。下文所有判断都是在这个 commit
和线上站点（2026-09-23）上核过的。
**开工前先在 HEAD 上把下面六条命令全跑一遍，把结果写进你第一个 commit 的描述**，
后面每个任务都拿它当回归基线。

```
npm test
npm run lint
npm run build
npm run check:data
npm run check:images
npm run test:e2e
```

## 铁律（不可协商，沿用 brief #2 / #3）

> 只建模「自身增益、足够无条件、明确是数值」的效果。其余只展示文本、不生效 ——
> 缺一个 buff 好过错一个 buff。

配套规则沿用 brief #3：**状态由用户声明**。本期新增的「角色自身状态」（胡桃开 E、
雷神开 Q）和队伍增益一样是开关，用户开了就按开了算，我们不替用户猜覆盖率。

v2 方案 §6 的八条既有约定照旧有效，逐条遵守。

**不在范围内**：`docs/DESIGN-5-energy-rotation.md` 的 M1（轮内 DPS）继续冻结；
新增武器被动建模；本文 Task 4 末尾列出的「第二批」角色。

---

## Task 1 — 同一个角色只能有一个数（最先做）

### 现象（线上可复现）

首页默认胡桃，同一屏出现三个对不上的数：

| 位置 | 数字 | 代码路径 |
| --- | --- | --- |
| 头条 Expected | 17,885 | `SingleCalculator.tsx` 的 `result`（约 237 行） |
| 伤害表 Normal Attack · Total DMG | 14,242 | `draftToGroups` → `damage-groups.ts` |
| 首页参考卡片（Normal Attack combo） | 14,805 | `pages/index.astro` 约 32 行，自己调 `computeDamage` |

角色页还有第四条路径：`character-pages.ts` 的 `headlineWithWeapon`（82 行）。

### 根因

1. `defaultsFor`（`draft.ts:142`）把 `attackType` 设为 `signatureTalent()` 的 key
   （胡桃是 `normal`），倍率取整套普攻之和 6.713，但 `elementOverride` / `scalingOverride`
   留空 → 头条按**角色元素（火）**算。伤害表按每一跳自己的 `row.element` 算，胡桃普攻是**物理**。
   多出来的就是火伤杯 + 魔女 2 件。雷电将军同样中招。
2. `changeAttackType`（`SingleCalculator.tsx:113`）也把两个 override 清成 null，用户手动切攻击类型会再次触发同一个 bug。
3. `signatureTalent()` 还在读 `src/data/talents.ts` 那张「每角色四个数字」的旧表（v2 方案 §2 点名的瓶颈），
   首页卡片和角色页的武器排名又各自拼一遍 buff（缺命座、被动、武器被动等），所以和计算器对不上。

### 要做的

1. 新增一个纯函数 `signatureRow(charId, effLevels)`，**只读生成数据**（`talentRowsFor`），返回
   `{ group, multiplier, element, scaling, label, rowId | null }`：
   - 规则保持现有语义：比较各组的代表倍率（普攻 = 所有伤害跳之和，重击取和，战技/爆发取最大一跳），
     平局按 Burst > Skill > Charged > Normal；`SIGNATURE_OVERRIDE` 照旧生效。
   - 普攻组取和时，组内各跳的 `element` / `scaling` 必须一致；不一致就退化为该组最大的一跳，并在注释里说明。
2. `defaultsFor` 和 `changeAttackType` 都改用它，把 `elementOverride` / `scalingOverride` 填成签名行的值。
   战技/爆发签名直接设 `activeRowId`，让表里那一行高亮。
3. **首页卡片、角色页头条、角色页武器排名全部改成走 `resolveBuild(defaultsFor(c))` + `draftToGroups`**，
   不再自己拼 `computeDamage`。武器排名只替换 `draft.weaponId` 后复用同一路径。
4. `damage.ts:584` 的 `signatureTalent` 兜底：确认调用方都已传 `skillMultiplier` 后删掉；删不掉就改成调 `signatureRow`。
   `src/data/talents.ts` 旧表在没有调用方之后删除（`check:data` 如依赖它，一并迁移）。

### 验收

- 新测试遍历**全部已发布角色**，对默认 Draft 断言：
  `头条 expected` === 伤害表里某一行的 `expected`（或普攻组 Total），误差 0；
  首页卡片数 === 头条数；角色页头条 === 头条数。
- 首页卡片数字会变（胡桃会落到约 14,2xx）——**这是预期**。在 commit 正文里列一张
  「角色 / 旧卡片数 / 新卡片数」表，至少列变化最大的 15 个，并解释为什么变。
- `damage.test.ts` 引擎回归（班尼特 + 西风剑 1,609 等）全绿；如果某条断言依赖旧签名逻辑，读懂它想保护什么再改。
- e2e：`/?c=hu-tao` 打开，头条数字等于表中 Total DMG 那一格。

## Task 2 — 元素限定的自身增益要逐跳生效

**坑**：`PASSIVE_EFFECTS` / `CONSTELLATION_EFFECTS`（`src/data/constellations.ts`）里用的是通用
`dmgBonus`。例：胡桃 A4 `{ dmgBonus: 0.33 }`，游戏里是「火元素伤害 +33%」，
现在打开后物理普攻也吃到。Task 1 让元素按跳判定之后，这个问题会更显眼。

**要做的**：

1. 逐条审计两张表：凡是游戏文本限定了元素（或限定了攻击类型）的条目，改成带元素/攻击类型的声明，
   例如 `{ element: 'pyro', buffs: { dmgBonus: 0.33 } }`。
2. 解析照 brief #3 的先例：`resolveSetBuffs` / `resolvePartyBuffs` 是逐跳按 `row.element` 解析的，
   新增的解析函数在 `damage-groups.ts` 和头条计算两处都接上，不要折进全局 `baseBuffs`。
3. 核不实的条目（文本读不出是否限元素）改成只展示文本、不生效，PR 里列出来。

**验收**：单测覆盖「对不匹配元素的跳贡献为 0」；胡桃开 A4 时物理普攻行数字不变、火伤行上升。

## Task 3 — 窄屏与矮屏布局

只修下面三处，**不动配色、字体、区块顺序**（brief #4 的边界照旧）。

1. **手机 Tab 条折行**：375px 下 Character / Equipment / Multipliers / Damage 折成两行
   （`SingleCalculator.tsx:472` 的 tablist）。要求 375px 一行放下：缩小内边距/字号，
   或允许 tablist 自身横向滚动（不许出现页面级横向滚动）。热区高度不低于 36px。
2. **手机伤害表看不到数字**：375px 下只露出招式名，NON-CRIT 被切一半，Average 要横滑才能看到。
   改成：`sm` 以下只显示两列「招式 | Average」，不暴击/暴击作为 muted 小字放在 Average 格里
   （`8,329 / 32,218`，`tnum`）。`sm` 及以上保持现状。
   `DamageTable.tsx:158` 的「Scroll sideways…」提示在窄屏不再需要时去掉；
   `layout.spec.ts:60` 保护的横向渐隐遮罩，先读懂它保护什么，在仍会横滑的宽度上保留。
   **角色页复用 `DamageTable` 且服务端预渲染**，两处都要核。
3. **矮屏桌面的内滚动**：`#calc-panel`（`SingleCalculator.tsx:524`）是固定壳里的 `lg:overflow-y-auto`，
   1280×720 这类窗口里伤害表只剩约 300px 可见。保留固定壳在高屏上的行为，
   但视口高度不足时（自定阈值，建议 `min-height: 820px` 的媒体查询）退回页面整体滚动。

**验收**：
- e2e：375×812 下 tablist 高度 ≤ 单行按钮高度 + padding；伤害表第一行的 Average 数字在视口内可见，且 `document.scrollingElement.scrollWidth <= innerWidth`。
- e2e：1280×720 下切到 Damage，`#calc-panel` 没有内部纵向滚动条（`scrollHeight <= clientHeight` 或 overflow 为 visible）。
- 截图前后对比存到 `.audit/brief-5/before|after/`（375 / 1280×720 / 1280×1080 三档，首页胡桃 + 角色页胡桃）。

## Task 4 — 角色自身状态开关（第一批）

### 为什么

现在胡桃面板攻击力 1,498，是**没开 E** 的状态；实战伤害几乎全在 E 里（生命值转攻击 + 火附魔）。
代码里没有「技能状态」这个概念，所以热门主 C 的数字系统性偏低，普攻元素也是错的。

### 数据模型

- `Draft` 新增 `stateOn: string[]`（开启的状态 id）和 `stateInputs: Record<string, number>`（层数类输入）。
  URL key 自拟（建议 `st` / `si`），写进 `draftToQuery` / `draftFromQuery`，往返测试覆盖。
- 每个状态声明为：

```ts
interface SelfState {
  id: string;                 // 'hu-tao-e'
  label: string;              // 'Paramita Papilio (E active)'
  note: string;               // 一行说明，展示在开关下面
  infusion?: ElementType;     // 普攻/重击/下落的物理跳改成该元素（法器本来就是元素，不受影响）
  buffs?: (ctx) => Partial<BuffState>;  // 数值从 talentRowsFor(charId) 读，按有效天赋等级取
  rowMultiplierAdd?: ...;     // 仅雷神愿力这类「给某些跳加倍率」的情况
  input?: { label: string; min: number; max: number; default: number };
}
```

- 倍率与比例**一律从 `talentRowsFor()` 的行读**（例：胡桃 `combat2-1-atk-increase`、
  雷神 `combat3-1-resolve-bonus`），按有效天赋等级取值，**不许硬编码**。
- 附魔在 `draftToGroups` 里逐跳处理：状态开启且 `row.group ∈ {normal, charged, plunge}` 且 `row.element === 'physical'`
  → 该跳按附魔元素算。Task 2 的元素限定增益随之自动正确。
- 引擎缺的字段按需新增到 `BuffState`，只加不改：例如胡桃 E 的「攻击力提升不超过基础攻击的 400%」
  需要一个 `atkFromHPMax` 之类的上限（照 `dmgBonusFromHPMax` 的先例）。`addBuffs` 相加语义保持。

### 第一批：只做这几个

| 角色 | 状态 | 效果 | 用户输入 |
| --- | --- | --- | --- |
| 胡桃 | E 彼岸蝶舞 | 攻击 + 生命值×比例（上限 400% 基础攻击）、火附魔 | — |
| 雷电将军 | E 雷罚恶曜之眼 | 爆发伤害 + 比例 × 元素爆发能量（90） | — |
| 雷电将军 | Q 奥义·梦想真说 | 愿力层数加到梦想一刀与梦想一心各跳倍率 | 愿力层数 0–60（默认 60） |
| 迪卢克 | Q 黎明 | 火附魔（A4 的火伤加成如已在 `PASSIVE_EFFECTS`，确认元素限定） | — |
| 神里绫华 | 冲刺 · 霰步 | 冰附魔 | — |
| 诺艾尔 | Q 大扫除 | 攻击 + 防御×比例、岩附魔 | — |

开工时逐条对照 genshin-db 生成数据和游戏内文本核实；**核不实的整条砍掉**，PR 里说明。

### UI

Character 标签页，「Constellations & ascension passives」上方加一张「Active state」卡片，
样式复用队伍增益卡片的开关 + 输入框（`NumberField`），不新增颜色。没有已建模状态的角色不显示这张卡片。
卡片底部一行「More character states coming」，不列名单。

**默认全关**：零输入首屏数字除 Task 1 预期的变化外不能再变。

### 第二批（本期不做，只写进文档）

会改变倍率结构或随时间变化的：宵宫 E（普攻倍率 ×）、那维莱特 A1（重击倍率随层数）、
阿蕾奇诺（生命之契）、流浪者 E。写进 `docs/single-character-calculator.md` 的待办，不写代码。

### 验收

- 每个状态一条单测：开关前后 `BuffState` / 行元素 / 行倍率的变化正确，数值来源写进注释。
- 胡桃 E：用一组已知面板（生命值、基础攻击、E 等级）断言攻击力增量，含一条触发 400% 上限的用例。
- e2e：`/?c=hu-tao` 打开 E，普攻行元素圆点变火、头条上升；关掉恢复原数。

## Task 5 — 补上 brief #3 Task 2 的交叉验证

brief #3 的 Task 2 没做：`src/lib/competitor.test.ts` 目前只有可莉和剧变反应。本期连同 Task 4 一起补：

| 角色 | 面板 | 覆盖的风险 |
| --- | --- | --- |
| 胡桃 | **开 E** | 生命值转攻击 + 上限、火附魔 |
| 雷电将军 | **开 E + Q，愿力 60** | 充能转雷伤（A4）+ 薙草之稻光 + 愿力倍率 |
| 班尼特 | 队伍增益：班尼特 Q | brief #3 Task 1 的固定攻击 |

做法、容差和禁令照 brief #3 Task 2 原文：注释写读取日期和完整面板；逐跳 ≤0.5% 通过、
0.5–2% 注释写原因、**>2% 不许靠放宽容差过关**；不许为了对上 paimon 改引擎公式，
除非能指出和 KQM 不一致的那一步。paimon 如需开相同状态，照实记录它的开关名。

产出：测试文件 + PR 描述里一张「角色 / 跳 / 我们 / paimon / 差异 / 原因」表。

## Task 6 — 文档收尾

- `docs/single-character-calculator.md`：
  - 第 5 节分期表加一列「状态」（brief #3 Task 5 遗留），按实际标完成/部分完成/未做；
  - 顶部基线改成本期完成时的 commit；
  - 新增一节「角色自身状态」，写第一批已做、第二批待做。
- `docs/DESIGN-5-energy-rotation.md` §5：注明 M1 仍冻结，理由是单跳数字的交叉验证（Task 5）优先。

---

## 顺序与提交

Task 1 → 2 → 3 → 4 → 5 → 6。Task 2 依赖 Task 1 的逐跳元素；Task 5 的胡桃、雷神部分依赖 Task 4。
Task 3 与其他任务无依赖，可以穿插，但单独 commit。

- 每个 Task 至少一个独立 commit，conventional commits 格式，正文写「为什么」。
- 每个 Task 结束时六条命令全绿，数字和开工时的基线对比，写进 commit 正文。
  除 Task 1 列表中说明的卡片变化、以及状态开关打开后的变化外，**其他数字不许变**：
  任取胡桃、班尼特、雷电将军，对比默认状态下伤害表每一行，必须和开工时一致。
- 判断控制台是否干净，必须重启 dev server，不能看 HMR 之后的状态。
- 不要 push、不要开 PR，做完交给 owner 审。

## 做完后回报

一段话 + 一张表：每个 Task 的状态、commit hash、测试数变化、没做完或砍掉的项及原因。
附上 Task 1 的卡片数字变化表、Task 5 的交叉验证表、Task 3 的前后截图路径。
