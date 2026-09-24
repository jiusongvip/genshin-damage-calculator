# Agent brief #4 — 计算器组件打磨（不改整体视觉）

基线：`feat/single-character` @ `cd0ffcd`。
如果 brief #3 已经先合进来，以合入后的 HEAD 为准，但**范围不变**。

## 目标与边界

面板现在看起来像 Excel：每个字段都是同一种满宽米色输入框，没有重点。
本期**只改组件本身**，让它们更好用、更精致。

**不许动**（老板没批整体改版）：

- 配色：不新增颜色，唯一例外是下文 C5 要补的一个 `--color-physical` 中性灰；
- 字体、页面布局、区块顺序、Tab 结构、导航；
- 计算逻辑和数据：本期任何数字都不应改变。

## 开工前

1. 在 HEAD 上跑一遍，记下基线：
   `npm test` · `npm run lint` · `npm run build` · `npm run test:e2e`
2. 截「改之前」的图：首页 `/?c=hu-tao`，分别在 390px 和 1280px 宽度下，
   截 Damage 和 Multipliers 两个 Tab。再加一张角色页 `/characters/hu-tao/`。
   存到 `.audit/brief-4/before/`（这个目录已被 gitignore）。

## 通用规则

- **元素色只用于数据可视化**：`global.css` 里的注释写明了
  「data-viz only, not accents」。所以元素色只能用在圆点、进度条这类图形上，
  **不能拿来当文字颜色**——浅色底上对比度也不够。
- 所有可交互控件都要能用键盘操作，有可见的焦点样式，有 accessible name。
- 改完的组件要同时在首页计算器和 131 个角色页里核对：角色页复用了 `DamageTable`，而且是服务端预渲染的。
- e2e 如果因为改了 DOM 而失败，先读懂那条测试**想保护的是什么**，再改选择器。
  不许为了变绿而删断言或放宽断言。

---

## C1 — 统一的数字输入 `NumberField`（最先做，其余几项都依赖它）

**现状**：`primitives.tsx` 里有 `Num`（59 行）和 `Pct`（16 行）两个组件，
另外还有 5 处手写的 `<input type="number">`：`ScenarioBar.tsx` 的等级、天赋、
敌人等级三处，`BaseZone.tsx:50`，`EquipmentPanel.tsx:211`。
这些输入框样式各不相同，而且都是满宽、右对齐、米色底。

**要做的**：在 `primitives.tsx` 新建一个 `NumberField`，把上面这些全部换掉。
`Num` 和 `Pct` 改成它的薄包装，或者直接删掉，调用方统一迁移过来。

```ts
interface NumberFieldProps {
  label: string;           // 可见标签；同时是 accessible name，getByLabel 要能命中
  value: number;           // 存储值（Pct 场景是 0.25 这种小数）
  onChange: (v: number) => void;
  min?: number; max?: number; step?: number;
  unit?: '%' | '×' | 's';  // 有 '%' 时显示值 = 存储值 × 100，输入时再除回去，沿用 Pct 的语义
  icon?: ReactNode;
  stepper?: boolean;       // 是否显示 − / + 按钮，默认 true
  hideLabel?: boolean;     // 标签视觉上隐藏，但保留 sr-only
}
```

行为要求：

- **边打字边保留本地字符串，失焦或按 Enter 才提交并钳制范围**。
  现在的实现每按一个键就 `parseFloat` 并钳制，清空输入框的瞬间会被重置
  （等级会跳回 90）。`e2e/scenario-bar.spec.ts` 里的 `retype` 注释描述的就是这个坑。
  修好之后，`retype` 这个变通写法应该可以简化，但先保证原测试照常通过。
- − / + 按钮：按一次走一个 `step`，到 `min` / `max` 时置灰（disabled）。
  aria-label 写成 `Decrease <label>` / `Increase <label>`。
- 方向键上下调一个 step；按住 Shift 调 10 个 step。
- 数字列用 `tnum`（等宽数字）。

视觉要求：

- **宽度跟着内容走**，不再占满一行：输入区大约 `6ch`–`9ch`，加上两侧按钮，
  整个控件宽度固定，放在格子里靠左对齐。
- 默认状态边框透明，底色用 `--surface-2` 或更浅；悬停时显示 `--line` 边框；
  聚焦时显示 `forest-500` 的 ring。
- 单位紧贴在数字后面，用 muted 色。

验收：vitest 为 `NumberField` 的提交与钳制逻辑写单测（如果逻辑抽成纯函数就测纯函数）；
所有调用点迁移完毕；`grep 'type="number"'` 只剩 `NumberField` 内部这一处。

## C2 — 命座改成分段按钮

**现状**：`ScenarioBar.tsx:140` 用的是原生 `<select>`。

**要做的**：改成 7 格分段按钮 `C0 … C6`，用 `role="radiogroup"`，
每一格是 `role="radio"` + `aria-checked`，左右方向键可以切换，只有选中的那格在 Tab 序列里（roving tabindex）。

- 选中格用 `bg-forest-600 text-white`，和现在 Tab 选中态的色值一致，不引入新色。
- 已建模和未建模的命座**不要**用颜色区分——`constellation-note` 已经负责提示，它的位置和文案保持不变。
- 在 390px 宽度下 7 格要放得下，不能换行：每格最少 36px 宽，点击热区最少 36px 高。
- `scenario-bar.spec.ts:19` 的注释提到命座是原生 select，改完后同步更新这条注释；
  `disclosure.spec.ts` 用 `cn=` URL 参数驱动，不受影响。

## C3 — 天赋等级

**现状**：三个没有可见标签的数字框挤在一行，标题是「Talents — Normal / Skill / Burst (cap 10)」。

**要做的**：

- 三个 `NumberField`，可见标签分别是 `Normal`、`Skill`、`Burst`，范围 1–15，带步进按钮。
- 当前 C3/C5 带来的 +3，现在只在下方用一行 `talentBonusNote` 文字提示。
  改成在对应那个字段旁边显示一个小角标，例如 `→ 13`，悬停时显示完整说明。
  需要的数据是 `effectiveTalentLevels(...)`（在 `draft.ts` 里），由父组件传进来。
  角标出现之后，`talentBonusNote` 这行文字删掉。
- 「(cap 10)」挪到标题的 `title` 提示里，不再占一行可见文字。

## C4 — 头条结果块

**现状**（`ScenarioBar.tsx` 末尾）：Expected 数字 `text-3xl`，放在一个 190px 宽的格子里；
暴击和不暴击两个数在手机上**没有标签**，只是两个裸数字（`hidden lg:inline`）。

**要做的**：

- 保留 `.damage-number` 这套金色渐变样式，字号放大一档（`text-4xl`），数字作为这个块的视觉中心。
- 副数字**在任何宽度下都带标签**：`Non-CRIT 8,329`、`CRIT 32,218`，标签用 muted 小字，数字用 `tnum`。
- 在 Expected 标签旁边加一个元素圆点，颜色取当前伤害的元素
  （`draft.elementOverride ?? character.element`），让读者知道这个数字是哪个元素的。
- 块的宽度、位置、在 lg 断点下的排布都不变。

## C5 — 伤害明细表

文件：`DamageTable.tsx`、`calculator/DamagePanel.tsx`。

1. **元素圆点**：每一行标签前面加一个 6px 圆点，颜色取 `row.element`。
   在 `global.css` 的 `@theme` 里补一个 `--color-physical`，取中性灰，
   亮度和其他元素色相近。当前的「选中行」圆点（forest 色）改成：选中行左侧加一条 2px 的 forest 竖线，免得和元素圆点冲突。
2. **数据条按元素着色**：`ValueBar` 现在统一用 `bg-forest-500/15`，改成对应元素色的 15–20% 不透明度。
   分组合计行保留 forest 色，用来和单跳区分。
3. **非伤害行收进分组标题**：`r.text !== undefined` 的行（CD、Duration、Energy 等）
   不再单独占一行，改成分组标题右侧的小标签（chip），例如 `CD 16s · Duration 9s`，
   一行放不下时就换行。
   注意：`disclosure.spec.ts:75/84` 在数 `#damage-table tbody tr` 的行数，先读懂它们要保护什么再调整。
4. **去掉纵向内部滚动**：`DamagePanel.tsx:96` 的 `max-h-[46vh] overflow-y-auto` 删掉，表格完整展开，由页面整体滚动。
   横向滚动和两侧的渐隐遮罩保留（`layout.spec.ts:60` 在保护这个行为）。
   `DamagePanel.tsx:190` 那个 200px 的小滚动区顺便检查一下，内容不多的话也去掉。
5. 文字颜色一律不变：CRIT 列保持 `text-forest-600`，其余列保持现状。

## C6 — Tab 切换（可选，前五项都完成后再做）

`SingleCalculator.tsx` 约 585 行的四个胶囊按钮，改成一个共享底色的分段控件：
外层容器 `bg-[var(--surface-2)] rounded-full p-1`，选中项是白底加轻阴影，未选中项 muted、无边框。
加上 `role="tablist"` / `role="tab"` / `aria-selected`。

---

## 顺序与提交

C1 → C2 → C3 → C4 → C5 → C6。每一项单独一个 commit，用 conventional commits 格式，例如 `feat(ui): …`。

- 每一项做完：`npm test`、`npm run lint`、`npm run build`、`npm run test:e2e` 全绿。
- 检查控制台是否干净时，**必须重启 dev server**，不能看 HMR 之后的状态。
- 全部做完后，按「开工前」同样的条件截「改之后」的图，存到 `.audit/brief-4/after/`。
- 数字不许变：任取 3 个角色（胡桃、班尼特、雷电将军），对比改动前后头条数字和伤害表每一行，必须完全一致。
- 不要 push，不要开 PR。

## 做完后回报

一张表：每个组件的状态、commit hash、删掉或改动的 e2e 断言及理由。
再附上前后对比截图的路径。
