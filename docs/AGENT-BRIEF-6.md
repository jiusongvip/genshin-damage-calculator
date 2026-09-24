# Agent brief #6 — 天赋元素归位、第二批自身状态、数据长尾

基线：`main` @ `f878ab6`（brief #5 的 Task 1–6 已全部合入，工作区干净）。下文每条判断都在这个
commit 上核过。**开工前先在 HEAD 上把下面六条命令全跑一遍，把结果写进你第一个 commit 的描述**，
后面每个任务都拿它当回归基线。

```
npm test
npm run lint
npm run build
npm run check:data
npm run check:images
npm run test:e2e
```

开工基线（owner 已跑）：单测 **14 文件 / 473 条全绿**，e2e **11 个 spec**。

## 铁律（不可协商，沿用 brief #2 / #3 / #5）

> 只建模「自身增益、足够无条件、明确是数值」的效果。其余只展示文本、不生效 ——
> 缺一个 buff 好过错一个 buff。

**准确度以竞品为准（owner 定的裁判规则，本期新增）。** 我们没法向读者证明谁更准，所以
**默认 damage.paimon.app 是对的**：每个任务改完都要做逐跳对照，对不上就是我们的错。
唯一例外 —— 你能指出竞品与 KQM 不一致的**那一步**（写清哪一步、引 KQM 公式来源），才允许
判定竞品错；这必须写在 commit 正文里。**不许靠放宽容差过关**（容差照旧：≤0.5% 通过，
0.5–2% 注释写原因，>2% 必须修）。为了对上 paimon 而改 `src/lib/damage.ts` 的引擎公式仍然禁止。

配套规则沿用 brief #5：**状态由用户声明**，我们不替用户猜覆盖率；倍率与比例一律
从 `src/data/generated/` 读，**不许在 `src/data/*.ts` 里硬编码游戏数值**。

v2 方案 §6 的八条既有约定照旧有效，逐条遵守。

**本期与往期的唯一不同**：Task 1 会**故意改变大量角色的数字**（见该任务的「数字会变」）。
除此之外其他任务的数字一律不许变，规则照旧。

**不在范围内**：`docs/DESIGN-5-energy-rotation.md` 的 M1（轮内 DPS）继续冻结；引擎公式改动
（`src/lib/damage.ts` 的六乘区/反应/防御算法）；UI 视觉改版；新增语言。

---

## Task 1 — 天赋表元素归位（最先做，正确性债）

### 现象

`scripts/generate-talents.mjs:150-153` 给**每个 combat talent 只算一个元素**（`groupElement`），
取自该天赋 `descriptionRaw` 里**第一个** `<color=…>…DMG</color>` span。于是宵宫的整套
`combat1`（普攻 / 重击 / 下落）都被标成 `pyro` —— 那个 span 其实来自重击「Charge Level 1」那句
「deals Pyro DMG」，她的普攻本来是**物理、E 才附魔**。

后果有两头：

1. **默认全关时虚高**：`main` 上宵宫、甘雨、菲谢尔、温迪、枫原万叶、夜兰、迪奥娜、五郎、
   珐露珊、柯莱等角色的普攻白拿了元素杯增伤。
2. **和 brief #5 的附魔机制直接冲突**：`src/data/selfStates.ts:139` 的 `infusedElement` 只把
   `row.element === 'physical'` 的行改色。已被写死成元素的角色**既无处声明开关，也永远改不回来**。

规模（原型 `.audit/brief-6/section-element-proto.mjs` 实测，全量 122 角色）：**27 个非法器角色、
59 处组级变化，方向全部是「元素 → 物理」，0 处反向**。法器角色的常驻元素是对的，不在此列。

| 类别 | 角色 |
| --- | --- |
| `combat1` 整套被染色 | arlecchino, yoimiya, lyney, amber, furina, yelan, tartaglia, sigewinne, fischl, kujou-sara, sethos, ororon, ganyu, diona, aloy, venti, kazuha, chasca, faruzan, xilonen, gorou, tighnari, collei, sandrone, iansan, linnea, jahoda |

### 附带发现：爆发重述的下落行和普攻下落混在同一组

raiden-shogun / cyno / lohen / skirk 的 `combat1` 下落**本来就是 physical**（没问题）。它们的问题在
`combat2` / `combat3` 里又各重述了一遍 `Plunge DMG`、`Low/High Plunge DMG`（游戏内是开 Q 后被强化的
那套下落，元素与倍率都不同），`groupFor` 把它们也归进 `plunge` 组 —— 于是读者的「Plunging Attack」
区里出现 **6 行下落、同一攻击两个数**，且没有任何说明哪套是开状态后的。

这**不属于** Task 1 的归位范围（那些行的元素是对的，是状态元素），但它是 Task 2「状态专属行」的
直接论据：状态改写的行要么挂到状态名下、要么在标签上写明属于哪个状态。Task 2 的设计稿里必须处理。

### 要做的

owner 已经跑过原型验证（脚本：`.audit/brief-6/section-element-proto.mjs`，gitignored，直接拿去用）。
按下面的机制改，**全量 122 角色产生 59 处组级变化，方向全部是「元素 → 物理」，0 处反向**；
标准小节零缺失。也就是说这不是判断活，是把小节解析实现进生成器。

1. **元素改成按 `combat1` 的小节解析**，不再一个 talent 一个元素。规则（写进
   `scripts/lib/talent-rules.mjs`，生成器与 `verify-baseline.mjs` 共用这一个来源，不要各写一份）：

   - **小节边界**：`combat1.descriptionRaw` 里**独占一行、且文本不含 "DMG" 的彩色标签**是小节标题。
     不能用颜色切 —— 岩元素 `#FFD780` 和小节标题同色；也不能用「下一个彩色 span」切 ——
     芙宁娜的 `Arkhe:` 和 Xilonen 的 `Nightsoul's Blessing:` 这类**额外小节**会把它们的元素
     span 漏给上一个标准小节（原型的第一版就是这么错的，芙宁娜重击被判成水）。
   - **元素**：`normal` / `charged` / `plunge` 各自取本小节内第一个含 "DMG" 的彩色 span 的元素。
   - **兜底**（小节里没有元素 span 时）：`normal` / `charged` 按武器类型定（法器 → 角色元素，
     其余 → **physical**）；`plunge` → **physical**。
     注意是**兜底**不是覆盖：下落行有元素 span 时按文本走 —— 法器角色的下落攻击本来就是元素
     （白术 `combat1` 原文「Deals AoE **Dendro DMG**」），实现时把 plunge 一律写成 physical 会算错。
   - `skill` / `burst`（`combat2` / `combat3`）：**保持现有解析，不要动**。
   - 这套规则自动做对了三类原本要手写白名单的情况：宵宫（普攻无 span → 物理、重击 Charge Level 1
     有火 span → 火）、甘雨（普攻物理、霜华矢那一组留冰）、amber 满蓄力留火。
   - **只在这些情况才需要显式表** `PERMANENT_INFUSION`：常驻附魔写在标准小节之外的（被动文本里）。
     原型跑完后落到的残余角色就是它的内容，**每条带出处注释**，核不实不进表。

2. **交叉核对原型的 59 处变化**：先看下面「分类以 paimon 为准」那段，把竞品值填进表，
   再落数据。表里每个角色记 `normal / charged / plunge` 三列（我们的现值、原型给的拟值、竞品值）：

   **分类以 paimon 的裁判值定**：竞品默认状态（不开任何技能）下该角色对应行的元素圆点就是答案。
   两者冲突时按 paimon 落数据，冲突写进表的「原因」列（例：游戏内文本读成物理、竞品给元素）。
   反过来不成立 —— 我们不许为了好看改竞品，也不许靠放宽容差过关。


3. 重新生成并核对：`npm run gen:talents` → `npm run check:data` → 六条命令。
   把 `.audit/` 里的 before/after 对比脚本留着（不进 git），PR 描述给变化表。

4. **把规则钉住**：`src/lib/data-audit.test.ts` 新增一条断言 —— 非法器角色若不在
   `PERMANENT_INFUSION` 里，其 `normal` / `charged` / `plunge` 行必须是 `physical`。
   这样以后重新生成数据时漂移会直接红。

> 取竞品值的现实约束：brief #3 记录过 browser-use 在 paimon 上点不动、切角色会卡住，
> Tabbit 可用。先试 Tabbit；**取不到就退化成抽样 3–5 个角色**（宵宫 / 甘雨 / 菲谢尔 / 万叶 /
> 五郎），其余按游戏内文本判定，并在表里如实标「未取得竞品值」。**不许因为取不到就跳过对照。**

### 数字会变（本任务唯一允许）

给一张表：上面 31 个角色，默认状态（全关）下**头条期望伤害**的变化，前 → 后 → 变化 %。
方向必须是**下降或不变**（拿掉白蹭的元素增伤）。若某个角色反而升了，说明该行原本吃了
错误的**元素精通/反应**路径，停下来在 commit 正文写清原因。

paimon 逐跳复核 3 个角色（宵宫 / 甘雨 / 菲谢尔）：不开任何状态时应与 paimon 的普攻行对上，
容差和禁令照 brief #5 Task 5。**分类以 paimon 为准**：若某个你判成「纯标错、游戏内是物理」的
角色，paimon 不开任何状态时给出的仍是元素伤害，那就按 paimon 的来（进白名单），并在表里注明
「与游戏内文本理解不一致，依竞品裁判规则采纳 paimon」。反过来不成立 —— 我们不许主动改竞品。

---

## Task 2 — 第二批角色自身状态（依赖 Task 1）

Task 1 把附魔从数据里拿掉之后，这些主 C 在默认状态下会**偏低**（这是对的：没开技能就该低）。
本任务给它们补回开关。

### 先设计再动手

第一批的 `SelfState` 只有三种能力（`infusion` / `effects` / `rowBonus`）。第二批全是
**改倍率结构**的，现有接口不够。先在 commit 里交一段设计（接口草案 + 每个状态走哪个能力），
**owner 认可后再实现**。不许为了让宵宫上得去而改 `rowBonus` 的既有语义。

候选新增能力（草案，按需取用、命名可改）：

```ts
/** 用另一组倍率行替换（达达利亚近战、流浪者空居力重击）——按 rowId 映射。 */
rowReplace?: (row, levels, input) => { multiplier: number; element?: ElementType } | null;
/** 倍率乘系数（宵宫 E 的「普攻伤害提升」若拿到结构化参数）。 */
rowMultiplierMul?: (row, levels, input) => number;
/** 这一行只在某个状态下存在（雷电/赛诺/丝柯克/罗罕开 Q 后的那套下落）。 */
requiresState?: string;
```

`requiresState` 是 Task 1「附带发现」逼出来的需求：那四个角色的爆发重述行现在和普攻下落混在同一组，
读者看到同一攻击两个数。选一个角色（建议雷电将军，数据最全）先把这条做通 —— 关着的行是灰的或干脆
不列，开了才出现，别再用「两行并存」糊过去。做不通就在文档里写明为什么，并把这一组行**只保留
`combat1` 那套**（保守），不许留两个数并列。

### 目标角色（按主 C 价值排序，做完 4 个即可交差）

| 角色 | 状态 | 已知数据情况 |
| --- | --- | --- |
| 宵宫 | E 焰庭花火 | 附魔可做；**「普攻伤害提升」在 genshin-db 无结构化参数**（`combat2` 只有 `Blazing Arrow DMG`），见待拍板 Q2 |
| 阿蕾奇诺 | E/Q 生命之契 + 附魔 | 需要一个数值输入（生命之契），倍率增益来源要先核 |
| 流浪者 | E 羽荡虚空 | 附魔 + 重击结构替换（`combat2` 有 `Kuugo: Fushoudan/Toufukai DMG` 两条独立行） |
| 达达利亚 | E 近战 | 附魔 + 整套普攻倍率替换，genshin-db 是否有近战表要先查 |
| 雷电 / 赛诺 / 丝柯克 / 罗罕 | 开 Q 期间的下落 | Task 1 把这几条 plunge 打回 physical 后的开关 |
| 莱内 | E 焰火 | 重击附魔 |

### 硬性要求

- 数值来源仍是生成数据：给 `scripts/generate-state-params.mjs` 加新的 char/key，产物进
  `src/data/generated/stateParams.ts`。**手填数字只允许出现在 `PERMANENT_INFUSION` 的
  元素名和 note 文本里。**
- `draft.ts` 的 `stateOn` / `stateInputs` 已有 URL key（`ss` / `si`）与 `sanitizeStates`，
  新状态带输入的必须补往返测试。
- UI 复用 Character 页的「Active state」卡片和 `NumberField`，不新增颜色；没有已建模状态的
  角色不显示卡片；卡片底部那行「More character states coming」保留。
- **默认全关**：本任务不得改变任何角色的默认数字。
- 每个状态一条单测（开关前后的行元素 / 倍率 / `BuffState` 变化，来源写进注释）+ 一条 e2e
  （`e2e/self-states.spec.ts` 里加，模式照第一批：开 → 元素圆点变色 → 头条上升 → 关掉恢复原数）。
- 与 paimon 逐跳对照（容差 0.5%），paimon 的开关名照实记在注释里。

---

## Task 3 — 武器被动补全（P4 长尾，纯体力活，可批量）

现状：`src/data/weaponPassives.ts` 的 `WEAPON_PASSIVE_EFFECTS` 建模 **91 / 213** 把，其余只在
UI 展示文本不生效。规则在该文件头部注释里已经写清（`stat` + `valueIndex` + `maxStacks` +
`note`），先读它再动手。

- 按武器类型分批（法器 → 单手剑 → 双手剑 → 弓 → 长柄），**每 20 把一个 commit**。
- 每条必填 `note`：条件类效果简化掉了什么、假设了什么。**拿不准的整条不建模**，铁律优先。
- 新增单测 `src/data/weaponPassives.test.ts`：断言每个建模条目的 `valueIndex` 落在
  `generated/weaponPassives.ts` 对应精炼 `values` 数组范围内，且 5 档精炼都存在。
  这一条现在是缺的，槽位数写错会静默算错。
- 数字会变吗：**不会**（默认无武器被动，用户不选档就不生效）。若某个默认数字动了，停下。
- **每批一次竞品对照**：从这批新建模的武器里挑 1 把有档位可选的（例：四风原典 / 和璞鸢 /
  狼的末路），把该武器 + 层数在 paimon 上选到同一档，逐跳对照 ≤0.5%。对不上就是 `valueIndex`
  或 `maxStacks` 取错槽位 —— 按竞品改我们的映射，paimon 的层数选项名照实记进注释。
  每个批次的 commit 正文带这一行对照结果。

---

## Task 4 — 命座 / 角色被动 / 圣遗物套装长尾（P5）

现状实测：`CONSTELLATION_EFFECTS` 覆盖 **33** 个角色、`PASSIVE_EFFECTS` **19** 个、
`ARTIFACT_SETS` **45** 套（`two` / `four` 成对，条件类按 `note` 里的假设定档）。

按**角色页访问量顺序**补，不要按字母序：

- 命座：先补热门主 C（本期点名 5 个：胡桃、雷电将军、宵宫、那维莱特、阿蕾奇诺），
  每个角色逐命对照 genshin-db 文本，条件类走 `only` 限定（brief #5 Task 2 的 `scopedSelfBuffs`
  已经是这个形状，直接复用）。
- 角色被动 A1/A4：同上，先补上面 5 个角色的 A 系列。
- 套装：把 `two: {}` 的空位过一遍，确认是「真无伤害效果」还是「漏了」；漏的补上并写 `note`。
- 全部遵守铁律，**核不实只展示文本**。
- 数字会变吗：**默认不变**（命座默认 C0，套装默认不勾）。
- **竞品对照按角色交差**：本期点名的 5 个角色，每个各做一次 —— 在 paimon 上开到同一命座档
  （建议 C2 或有伤害效果的那一命，别只测 C6）+ 同一套 4 件套，逐跳对照 ≤0.5%。
  套装条件类两侧假设不一致时（例：我们假设满层、paimon 有独立开关），**按 paimon 的开关语义
  对齐后再比**，并把两侧设置写进 `src/lib/competitor.test.ts` 的注释。

---

## Task 5 — 文档收尾

- `docs/single-character-calculator.md`：
  - 顶部基线改成本期完成时的 commit；
  - §11 的「已知数据问题（待处理）」改写成**已修的规则**（非法器默认物理 + `PERMANENT_INFUSION`
    白名单 + 附魔走状态开关），并给出白名单全表；
  - §11 第二批名单按 Task 2 实际完成情况更新（做掉的移入第一批表，砍掉的写明原因）；
  - §5 分期表 P4/P5 的「部分完成」数字刷新到本期结束值。
- `docs/DESIGN-5-energy-rotation.md` §5：补一行本期结论（M1 是否仍冻结）。
- `src/components/ComparisonSection.astro`：若本期让「附魔需用户声明」成为可对外的差异点，
  照 §9 的规则实地核对后再改，写错竞品比不写更糟。

---

## 待拍板（owner 已给建议，实现按此执行；不认可就在这个文件里改）

- **Q1 重击分段元素不同（甘雨霜华矢、宵宫一段蓄力）**：Task 1 的小节解析已经消掉大部分顾虑 ——
  甘雨与宵宫的 `charged` 组内所有行本来就同元素（霜华矢与满蓄力都是对应元素），不需要拆行。
  剩下的顾虑只在**同组内出现两种元素**时成立：生成时若检测到同一 `(角色, 组)` 里元素不一致，
  按 `Low/High Plunge` 的先例拆行；genshin-db 没有独立参数就整行取物理、把元素那档写进 note。
  不要凭想象补参数。
- **Q2 宵宫 E 的普攻增伤**：genshin-db 没有这个结构化参数。**建议只加附魔、不加增伤**，
  宁低不错；不接受在本期开「手填常数」这个例外（一开例外，铁律就废了）。
- **Q3 Task 2 做几个**：建议 4 个封顶，宁少而对。

---

## 顺序与提交

Task 1 → 2 →（3、4 可并行穿插）→ 5。Task 2 硬依赖 Task 1（附魔先从数据里拿掉，才能作为开关加回来）。

- 每个 Task 至少一个独立 commit，conventional commits 格式，正文写「为什么」。
- 每个 Task 结束时六条命令全绿，**且该任务的竞品对照已做完（表填进 commit 正文）**，
  数字和开工基线对比写进 commit 正文。**没有竞品对照的 Task 视为未完成。**
  **除 Task 1 与 Task 2
  开关打开后的变化外，其他数字一律不许变**：任取胡桃、班尼特、宵宫，对比默认状态下的
  伤害表每一行，Task 3/4 前后必须完全一致。
- 判断控制台是否干净必须重启 dev server，不能看 HMR 之后的状态（v2 §6.8）。
- 不要 push、不要开 PR，做完交给 owner 审。

## 做完后回报

一段话 + 一张表：每个 Task 的状态、commit hash、测试数变化、没做完或砍掉的项及原因。
必须附：Task 1 的 31 角色三分类表（含「竞品值」列）+ 默认头条数字变化表、Task 2 的每个状态
设计草案与 paimon 逐跳对照表、Task 3 的新增建模武器清单 + 每批的武器对照行、Task 4 的角色清单
+ 每角色的命座/套装对照行。

**每个 Task 都必须带竞品对照，没有对照的 Task 视为未完成**（铁律：准确度以 paimon 为准）。
唯二例外是 Task 5（纯文档）和取不到竞品值时如实标注的抽样角色。
