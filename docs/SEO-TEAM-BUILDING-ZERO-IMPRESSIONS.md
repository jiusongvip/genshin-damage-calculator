# 诊断：/team-building/ 零展示（任务 2 · 调查，未改页面）

**基线**：`feat/single-character` @ `18a53fd`。以下所有代码侧结论都是在这个提交上实测的（`npm run build` 后检查 `dist/` 产物，而非只看源码）。
**GSC 数据窗口**：2026-09-11 → 09-19（9 天）。`/team-building/` 展示 0 次；同期首页 946、`/guides/damage-formula/` 483、`/guides/improve-damage/` 102，`/about/`、`/terms/` 各 1。

## 结论摘要

技术层面能造成"零展示"的硬性阻断**已全部排除**。最可疑的、也是唯一由代码侧证据支持的原因是**内链过少导致的收录/发现问题**：全站只有 **1 条**真实内链指向它，且挂在中等流量的 `/guides/improve-damage/` 上，导航和页脚都没有收录它——这让它接近一座孤岛。

**但"内链过少"只是当前最强假设，不能作为定论去改页面。** 三种不同的 GSC 收录状态指向三种不同的处理方向，必须先拿到下面第 1 步的分类结果才能定案（见"需要人工点开的步骤"）。

## 代码侧已排除的原因（附证据）

| 排查项 | 结果 | 证据 |
|---|---|---|
| 被 `noindex` 排除 | 否 | `dist/team-building/index.html` 实渲染 `<meta name="robots" content="index, follow">`；`SEO.astro:17` 默认 `noindex = false`，页面未传入该参数 |
| robots.txt 屏蔽 | 否 | `dist/robots.txt` 为 `User-agent: * / Allow: /`，并声明了 sitemap |
| 不在 sitemap | 否 | `dist/sitemap-0.xml` 含 `https://www.genshindamagecalculator.com/team-building/` |
| HTTP 头 `X-Robots-Tag` | 否 | `vercel.json` 无任何 robots / X-Robots-Tag / team-building 规则 |
| canonical 指向别处 | 否 | `team-building/index.astro:5` canonical = `…/team-building/`，与 sitemap 的 www 绝对 URL 一致 |

> 注：meta description 在 `dc92497` 从 182 改到 150 字符——与本问题**无关**，描述只影响点击率不影响是否展示，不在此处展开。

## 内链现状（唯一未被排除、且有代码证据的方向）

全站指向 `/team-building/` 的真实链接**只有一处**：

```
src/components/IncreaseDamageSection.astro:144
  <a href="/team-building/" ...>team building guide</a>
```

- 该组件仅被 `src/pages/guides/improve-damage.astro` 使用；构建产物里只有 `dist/guides/improve-damage/index.html` 出现这条链接。
- **首页、导航、页脚均无指向该页的链接**（`grep team-building` 在 `src/components/`、`src/layouts/` 中只命中上面这一个文件）。
- `src/lib/section-links.test.ts` 里的两处只是测试夹具字符串，非真实链接。

后果：Google 主要通过链接发现 URL。946 次展示的首页不链向它，唯一入口在 102 次展示的引导页深处，抓取预算与发现频次都被压到很低。

## 需要人工点开的步骤（无 GSC 访问权限，交回给用户）

1. **GSC → 编制索引 → 网页**，搜这个 URL，记录它落在哪一类。这一步直接决定处理方向：
   - "已抓取 — 目前尚未编入索引" / "已发现 — 目前尚未编入索引" → **印证内链过少/发现问题**，走下面的"处理建议 A"。
   - "重复网页，Google 选择的规范网页与用户指定的不同" → 需查被判重对象，另议。
   - "已编入索引" → **不是发现问题**，是查询需求/排名问题，走"处理建议 B"，此时**加内链无济于事**。
2. **GSC → 网址检查**，输入完整 URL，记录「网页可编入索引吗」的结论 + 上次抓取时间。若"上次抓取"是数周前或从未抓取 → 偏发现/抓取频率问题（A）；若近期抓取过却零展示 → 偏内容/排名问题（B）。

## 处理建议（拿到第 1 步分类后再执行，勿提前改页面）

**A — 若为发现/未编入索引（内链假设成立）**：从首页和导航给该页稳定的入口（例如主页相关区块加一条内链），把 `/team-building/` 从"仅 1 条深层链接"提到全站可达。属内链结构调整，风险低、可回退。

**B — 若已编入索引却零展示**：问题在查询需求匹配或排名位置，与内链无关。此时应重看该页 target 的关键词与标题，而不是加链接。**不要在未分类前动页面。**

## 交付状态

本文件为任务 2 产出。调查到此为止——按 brief 要求，**在 GSC 第 1 步分类结论回来之前不修改 `/team-building/` 页面**。
