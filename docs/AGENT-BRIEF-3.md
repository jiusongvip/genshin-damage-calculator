# Agent brief #3 — genshin-damage-calculator

基线：`feat/single-character` @ `cd0ffcd`。下文所有判断都是在这个 commit 上核过的。
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

## 背景：v2 方案进度

`docs/single-character-calculator.md`（v2 方案）写于 `8e00ce7`，此后 P0–P5
基本完成：每跳伤害表、点行联动六乘区、天赋 1–15、命座、武器精炼 + 被动
（91/213 建模）、套装 45 套、敌人分元素抗性 + 减抗减防、131 个角色页、Diff 模式。

本 brief 覆盖剩下的部分。**不在范围内**：`docs/DESIGN-5-energy-rotation.md`
的 M1（轮内 DPS）—— 还在等产品拍板，一行实现代码都不要写。

## 铁律（不可协商，沿用 brief #2）

> 只建模「自身增益、足够无条件、明确是数值」的效果。其余只展示文本、不生效 ——
> 缺一个 buff 好过错一个 buff。

本期新增一条配套规则：**队友增益由用户声明**。用户勾选「我队里有班尼特大招」、
填了「万叶精通 1000」，我们就按声明算；我们不替用户猜他队里有谁、增益覆盖率多少。

v2 方案 §6 的八条既有约定照旧有效（`addBuffs` 相加不覆盖、基础暴击不重复加、
重启 dev server 再看控制台等），逐条遵守。

---

## Task 0 — 修回归：状态不再写回 URL（最先做）

**现象**：`cd6dce0`（fix(data): rebuild the stat and talent pipeline）把
`SingleCalculator.tsx` 里写 URL 的 `useEffect`（`window.history.replaceState`）
整段删掉了，读 URL 的部分（`SingleCalculator.tsx` 约 442–530 行）还在。结果：

- 用户改完配置复制地址栏，分享出去的是空链接 —— 首页和 FAQ 宣传的「可分享 URL」实际失效；
- 角色页进 `/?c=<id>` 仍然能用（只读），所以 e2e 没报警。

提交信息里没提 URL，判断为误删。

**要做的**：

1. 旧实现可参考：`git show cd6dce0^:src/components/SingleCalculator.tsx`，约 1022–1095 行。
   **不要原样贴回**：删掉之后 Draft 又多了字段（`tl` 天赋等级、`row`/`ce`/`cs`
   选中行、`erm` 分元素抗性、`wr`/`ws` 精炼与层数等），以当前读取端为准。
2. 把序列化/反序列化抽成 `src/components/calculator/draft.ts` 里的一对纯函数
   `draftToQuery(draft, defaults)` / `draftFromQuery(params, defaults)`，
   SingleCalculator 只负责调用。Task 3 的本地存档要复用它们。
3. 规则：值等于该角色默认值时不写（URL 保持短）；读取端认识的每个 key，写入端都必须写。
4. 测试：
   - vitest：随机/手工构造若干 Draft，`draftFromQuery(draftToQuery(d)) ≡ d`（往返恒等），
     至少覆盖天赋等级、选中行、分元素抗性、圣遗物副词条、命座 + 被动；
   - e2e：改几个设置 → `page.reload()` → 头条伤害数字不变。

## Task 1 — 队伍增益面板（DESIGN-5 里的 M3）

对标 paimon 的 EQUIPMENT › PARTY BUFFS。这是我们裸数字看起来偏低的主要剩余原因：
班尼特、万叶这些现在完全没有入口。

### 1a. 手填属性（缺的补上，已有的不重复）

`Draft` 里已经有 `dmgBonus`、`critRate`、`critDMG`、`em`、`defShred`、`resShred`
等，但**没有** `BuffState` 的 `atkPercent`、`flatATK`、`hpPercent`、`flatHP`、
`defPercent`、`flatDEF`、`er`。补上这几项作为手填输入，折进
`SingleCalculator.tsx` 的 `nonWeaponBuffs`（约 221 行）那一串 `addBuffs` 补丁里。
URL key 自拟，简短、不与现有冲突，写进 Task 0 的序列化。

### 1b. 常见队友增益，做成开关

放在 Equipment 标签页，一个「Party buffs」卡片。每项 = 开关 + 必要时一两个输入框 +
一行说明文字。**只做下面这张表**，数值开工时逐条对照 genshin-db 或游戏内文本核实，
核不实的整条砍掉并在 PR 里说明。

| 增益 | 用户输入 | 效果 | 限制 |
| --- | --- | --- | --- |
| 班尼特 Q | 班尼特基础攻击（角色+武器，默认 90 级班尼特 + 674 基攻剑）、Q 等级（默认 10）、是否 C1 | 固定攻击 = 基础攻击 × 比例（C1 再 +20%） | 比例**从 `talentRowsFor('bennett')` 的 `ATK Bonus Ratio` 行读**，不要硬编码 |
| 万叶 A4 | 万叶精通（默认 800） | 精通 × 0.04% 元素伤害加成 | 只作用于用户选定的被扩散元素 |
| 翠绿之影 4 件 | 被扩散元素 | 该元素抗性 −40% | 同上 |
| 钟离护盾 | — | 全元素 + 物理抗性 −20% | |
| 纳西妲 A1 | 分享的精通（0–250） | 精通 + 输入值 | |
| 昔日宗室之仪 4 件 | — | 攻击 +20% | |
| 讨龙英杰谭 | 精炼 1–5 | 攻击 +24/30/36/42/48% | |
| 元素共鸣：火 | — | 攻击 +25% | |
| 元素共鸣：水 | — | 生命 +25% | |
| 元素共鸣：冰 | — | 暴击率 +15% | 文案注明「对冰附着/冻结敌人」 |
| 元素共鸣：岩 | — | 伤害 +15%，岩抗 −20% | 文案注明「护盾存在时 / 命中后」 |
| 元素共鸣：草 | 档位（50/80/100） | 精通 + 档位值 | |

**不做**：芙宁娜（气氛值是随时间变化的机制，不符合铁律；如果 genshin-db 的天赋数据里
有清晰的「每点气氛值增伤」行，可以做成「用户填气氛值」，否则留到以后）、
申鹤、云堇、夜兰等其余角色。在卡片底部写一行「More party buffs coming」即可，不要列名单。

### 1c. 按元素生效必须逐跳判断

**坑**：伤害表里同一角色的不同跳元素不同（例：普攻物理、战技火）。万叶 A4、翠绿、
岩共鸣这类只对某元素生效的增益，**不能**折进全局 `baseBuffs`，否则物理跳也吃到火伤加成。

现成的先例：`src/lib/damage-groups.ts:132` 的套装效果就是逐跳按
`row.element` 解析的：`addBuffs(baseBuffs, resolveSetBuffs(setPicks, row.element, …))`。
队伍增益照同样模式做一个 `resolvePartyBuffs(picks, element)`，在这里和
`SingleCalculator` 的头条计算两处都接上。`BuffState.resShred` 目前是单值，
按元素解析后填进去即可，不必改引擎结构。

### 1d. 验收

- 纯函数 `resolvePartyBuffs` 有单测：每项开关单独打开时 `BuffState` 的变化正确；
  对不匹配元素的跳，按元素生效的项贡献为 0。
- 班尼特 Q：用一组已知数（基础攻击、Q 等级）断言固定攻击值，数值来源写进注释。
- 所有开关状态进 URL（Task 0），往返测试覆盖。
- e2e：打开火共鸣，头条伤害上升；胡桃的物理普攻行不受万叶 A4（火）影响。
- 队伍增益默认全关 —— 零输入的首屏数字不能变（`damage.test.ts` 现有断言全绿即证明）。

## Task 2 — 竞品逐跳交叉验证（v2 方案 §8）

`src/lib/competitor.test.ts` 已经有**可莉**（普攻逐跳 0.5% 容差）和剧变反应的对照。
照同样格式再加三个角色，每个挑一种风险类型：

| 角色 | 覆盖的风险 |
| --- | --- |
| 雷电将军 | 充能转雷伤（A4）+ 薙草之稻光，二次属性转换 |
| 胡桃 | 生命值缩放 + 战技转攻击（atkFromHP 类） |
| 班尼特 | Task 1 的班尼特 Q 数值，用 paimon 的队伍增益页对照 |

做法：

1. 用浏览器打开 damage.paimon.app，按注释里将要写的那组条件配置好面板
   （等级、天赋、武器 + 精炼 + 层数、敌人等级与抗性、所有加成项），读出每一跳。
2. 在测试文件头部注释里写下**读取日期和完整面板**，格式照可莉那段。
3. 我们这边用引擎复现同一面板，逐跳断言：差异 ≤0.5% 通过；0.5–2% 在注释里写原因；
   **>2% 不允许靠调容差过关**，要么查出原因修掉，要么在 PR 里单独报告。
4. 不许为了对上 paimon 去改引擎公式 —— 除非你能指出我们哪一步和 KQM 不一致。
   paimon 自己也可能错，那种情况照实写下来。

产出：测试文件 + PR 描述里一张「角色 / 跳 / 我们 / paimon / 差异 / 原因」表。

## Task 3 — 本地存档（v2 方案 P6 的剩余部分）

Diff 模式已经有了（内存里的 baseline，同角色才比较）。补上：

1. **存档**：Scenario bar 上加「Save」，用户起个名字，存到 localStorage。
   存的就是 Task 0 的 query string + 名字 + 时间戳，不另造格式。最多 20 条，超出提示删旧的。
2. **读取**：下拉列出存档，点一条等于导航到那个 query。
3. **和存档比较**：列表里每条多一个「Compare」，把那条存档算出来的结果设为
   Diff baseline。角色不同时沿用现有逻辑（`activeBaseline` 为空，面板文案已处理）。
4. localStorage 所有读写都包 try/catch：隐私窗口或存储被禁用时，功能隐藏，页面照常工作。
5. 不做登录、不做云端、不做单独的 COMPARE 页。

验收：e2e 保存 → 改配置 → 读取 → 数字复原；Compare 后表格出现 diff 列。

## Task 4 — 更新竞品对比表

`src/components/ComparisonSection.astro` 的表已过期（例：「Every value editable …
(level, weapon, set, multiplier)」、paimon 的多个格子）。

1. 行的方向（v2 方案 §9）：
   - 保留我们赢的：六乘区摊开可编辑、点一跳看它的六乘区构成、零输入起步、
     可分享 URL（Task 0 修好后才能写 ✓）、不用注册；
   - 如实写我们输的：没有圣遗物优化器、没有云端存档、武器/命座建模覆盖不全。
2. **每个格子都要实地核对**，打开对应站点看过再填。核不了的格子填 `~` 并在
   frontmatter 注释里写「未核实」，或者直接删掉这一行。宁可少一行，不能写错别人。
3. 在文件头注释写上核对日期。

## Task 5 — 文档收尾

- `docs/single-character-calculator.md`：第 5 节分期表加一列「状态」，
  按实际情况标完成/部分完成/未做，顶部基线改成本期完成时的 commit。
- `docs/DESIGN-5-energy-rotation.md` §5 第 1 问：注明「M3 已在 brief #3 Task 1 实现」。

---

## 顺序与提交

Task 0 → 1 → 2 → 3 → 4 → 5。Task 2 的班尼特部分依赖 Task 1；Task 3 依赖 Task 0；
Task 4 依赖 Task 0 和 Task 3 的结论。

- 每个 Task 至少一个独立 commit，conventional commits 格式，照仓库现有风格写正文（为什么，而不只是做了什么）。
- 每个 Task 结束时六条命令全绿，数字和开工时的基线对比，写进 commit 正文。
- 判断控制台是否干净，必须重启 dev server，不能看 HMR 之后的状态。
- 不要 push、不要开 PR，做完交给 owner 审。

## 做完后回报

一段话 + 一张表：每个 Task 的状态、commit hash、测试数变化、没做完或砍掉的项及原因。
