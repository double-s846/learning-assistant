# 开工清单（ONBOARDING.md）

> **读完这一节就能开工**，不需要再问别人。
> 每个人的任务、第一个提交写什么、怎么自测、什么算完成，都写在这里。
> 遇到文档没覆盖的问题，群里 @double-s846。

---

## 0. 所有人先做这五步（10 分钟）

```bash
# ① 接受 GitHub 协作邀请（现在三个人都还没点，不接受推不了代码）
#    打开 https://github.com/double-s846/learning-assistant/invitations 点 Accept

# ② 克隆（如果你还没克隆）
git clone https://github.com/double-s846/learning-assistant.git
cd learning-assistant

# ③ 装依赖 + 跑起来
npm install
npm run dev          # 打开 http://localhost:5173，应该能看到 3 篇示例文章

# ④ 从**最新的 main** 拉自己的分支（分支名见下面各人的小节）
git fetch origin
git switch -c dev/<你的分支名> origin/main

# ⑤ 确认四条检查全绿（这是你的基线，改之前先确认它是绿的）
npm run lint && npm run typecheck && npm test && npm run build
```

> ⚠️ **务必从 `origin/main` 拉分支**。`main` 已经包含了阅读器插槽重构和长句解析，
> 从旧提交拉分支会导致 `Reader.tsx` 的 props 对不上、编译报错。

---

## 通用规则（四条，违反会直接冲突）

| 规则 | 原因 |
|---|---|
| **只改 `src/features/<你的模块>/`** | 四个人同时改同一文件等于手工合并不可能 |
| **不改 `src/features/reader/Reader.tsx`** | 它已改成"装饰层插槽"，别人通过 `decorations` 接入，你不需要也不应该动它 |
| **不直接读写 `localStorage`** | 一律用 `src/lib/storage.ts`（及其 `useVocab()` 等 hook），否则订阅不触发、界面不刷新 |
| **不用 `toISOString().slice(0,10)` 当日历 key** | 东八区凌晨 0–8 点会算到前一天，已经在 `srs.dayKey()` 里处理好了 |

**提交前**：`npm run lint && npm run typecheck && npm test && npm run build`，四条全绿再 push。

---

# 1. Selena14111 · 模块 B（查词与生词本）

**分支**：`dev/Selena14111-b` · **目录**：`src/features/vocab/`

> ⚠️ 你之前建的分支指向旧提交，请先删了重拉（还没写代码，删了不丢东西）：
> ```bash
> git fetch origin
> git branch -D dev/Selena14111-b
> git push origin --delete dev/Selena14111-b
> git switch -c dev/Selena14111-b origin/main
> git push -u origin dev/Selena14111-b
> ```

## 你已经有这些（别重写）

| 文件 | 内容 |
|---|---|
| `VocabDrawer.tsx` | 生词本抽屉：列表 / 释义 / 原句 / 来源标签 / 删除 / 回到原文 |
| `WordPopover.tsx` | 点词气泡：查词、手填释义、加入生词本 |
| `lib/dict.ts` | `lookup(word)` 四级降级查词，返回 `source` 标明释义来源 |
| `lib/storage.ts` | `vocabStore.all/upsert/removeById` + `useVocab()` |
| `lib/article.ts` | `countOccurrences(article, lemma)` 该词在本文出现几次 |

## 交付清单（按顺序做，每项一个 commit）

| # | 做什么 | 验收标准 |
|---|---|---|
| 1 | **搜索框**：按单词/释义实时过滤 | 输入 3 个字母就过滤，清空恢复 |
| 2 | **按文章筛选**：下拉选文章 | 选完后只剩那篇文章里收藏的词 |
| 3 | **按复习盒子筛选**：盒子 0–5 | 能筛出"还没掌握（盒子 < 3）" |
| 4 | **删除与批量删除** | 删除后阅读区下划线**立刻消失**（走订阅，不刷新页面） |
| 5 | **标签**：给生词打标签（`VocabEntry.tags`），按标签筛选 | 字段已在契约里，直接写 |
| 6 | **导出 CSV**：`word,lemma,pos,glossZh,source,article,createdAt,box` | 用 `Blob` 下载，Excel 打开中文不乱码（加 UTF-8 BOM） |
| 7 | **整句翻译**（进阶）：点「翻译这句」→ 调免费翻译接口 → 显示在气泡下方 | 失败时静默隐藏，不打断阅读 |

## 第一个提交

`feat(vocab): 生词本支持搜索与按文章筛选`

## 参考实现

`src/features/vocab/README.md`（交接契约）。样式类的 CSS 钩子见 `src/features/reader/README.md`。

---

# 2. JiZhen Gong（jz-Gong10）· 模块 C（复习与日历）

**分支**：`dev/jz-Gong10-c` · **目录**：`src/features/review/`

> 建分支：`git switch -c dev/jz-Gong10-c origin/main`

## 你已经有这些（算法全部写好了，你只写界面）

`src/lib/srs.ts`（已有 9 个单测）：

| 函数 | 作用 |
|---|---|
| `buildReviewQueue(vocab)` | 今日待复习队列，已按到期时间排序 |
| `reviewEntry(entry, grade)` | 应用「没记住/记得/很简单」，返回新卡片（纯函数，不改原对象） |
| `monthGrid(year, month)` | 42 格月历（含前后补齐空格） |
| `reviewCountByDay(vocab)` | 每天复习次数 → 热力图上色 |
| `addedCountByDay(vocab)` | 每天新增生词数 |
| `countMastered(vocab)` | 已掌握（盒子 5）数量 |
| `dayKey(date)` | 本地时区 `YYYY-MM-DD` |
| `GRADE_LABEL` | 三档评分中文名 |

**入口已经接好**：顶栏「复习」按钮 → `ReviewPanel`（`src/features/review/ReviewPanel.tsx`）。
这个文件里现在是占位内容，把中间的 `<div className="card">…` 换成你的实现即可，**不用改 `App.tsx`**。

## 交付清单

| # | 做什么 | 验收标准 |
|---|---|---|
| 1 | **复习卡片**：正面只显示单词（先回想），点击翻面 | 翻面显示释义 + 原句 + 出处 |
| 2 | **三档评分按钮** → `vocabStore.upsert(reviewEntry(entry, grade))` | 点「记得」后卡片 `box` +1，`dueAt` 变 1 天后 |
| 3 | **队列走完的完成态** | 显示"今日完成，明天再来"+ 今日复习张数 |
| 4 | **日历热力图**：`monthGrid` + `reviewCountByDay` | 格子颜色深浅与当天复习次数对应，悬停显示明细 |
| 5 | **记忆曲线**：用 `reviews[].fromBox/toBox` 画折线 | 能看出"哪些词反复回到盒子 0" |
| 6 | **每日目标完成度**：今日复习数 / `Settings.dailyGoal` | 进度条或环形 |

## 第一个提交

`feat(review): 复习队列卡片与三档评分`

## 三个别做错的地方

1. 日期只用 `srs.ts` 的函数；
2. 不要删 `VocabEntry.reviews` 历史（日历和记忆曲线都依赖它）；
3. 不要改 `Reader.tsx`。

---

# 3. zouyujing20070207 · 模块 D（长句解析 · 增强）

**分支**：`dev/zouyujing20070207-d` · **目录**：`src/features/parse/` + `src/lib/clause.ts`

> 建分支：`git switch -c dev/zouyujing20070207-d origin/main`

## 先说清楚现状：规则层已经做完了

上一轮我把**离线规则层**实现并提交了（`src/lib/clause.ts`，8 个单测全过，面板能上色）。
所以你不是从零开始，你接手的是**"已能跑，继续做深"**。

先读这两个文件，20 分钟能读懂：

1. `src/features/parse/README.md` —— 规则怎么判定、已知局限、可扩展点；
2. `docs/ARCHITECTURE.md` 第 6 节 —— 五条"非显然判定"为什么必须那么写。

## 交付清单（按价值排序，至少完成前 3 项）

| # | 做什么 | 验收标准 |
|---|---|---|
| 1 | **正文内联标注**：新建 `ClauseMarks.tsx`，用 `renderSentenceOverlay` 把成分下划线画进正文 | 学习模式下正文里直接看到从句被框出（现在只在面板里画）；接线由负责人在 `App.tsx` 加一行，你只要把组件写好 |
| 2 | **接触从句识别**：`名词 + (that 省略) + 主语 + 谓语`（the minutes they obtain） | 新增不少 3 个测试用例 |
| 3 | **并列从句**：`and / but` 后再跑一次起点扫描 | `which is A and which is B` 能切出两个 |
| 4 | **解析结果缓存**：同一句不重复算（`Map<sentenceId, SentenceParse>`） | 面板反复开关不重复解析 |
| 5 | **可选 LLM 增强**：配了 `VITE_LLM_*` 才请求，失败**静默回落**规则层 | 断网/无 key 时行为与现在完全一致；成功时 `source` 标为 `'llm'`，界面显示「大模型增强」 |
| 6 | **补测试到 15+ 例** | `npm test` 全绿 |

## 第一个提交

`feat(parse): 正文内联标注 ClauseMarks`

## 红线

- **解析不出来就显示「未能切分」，不许编造结构** —— 这是这个模块的底线；
- 不要把 LLM key 写进前端代码；
- 不要改 `Reader.tsx`（用插槽），不要改 `App.tsx`（接线找负责人）。

---

# 4. double-s846 · 公共层 + 模块 E（朗读跟读）+ 集成

**分支**：`dev/double-s846`

已完成：工程地基、数据契约、存储层、切句切词、查词降级、SRS 算法、阅读器与插槽重构、
双模式、导入、设置备份、**长句解析规则层**、28 个单测、全部文档。

待做：**模块 E（TTS 朗读跟读）** + 集成 + 演示视频。

> 注：E 暂由负责人承担（工作量小、且要改 `App.tsx` 的 `decorations` 装配）。
> 如需换人，改 `docs/TEAM.md` 成员表那一行即可。

---

## 遇到问题

| 现象 | 原因 | 处理 |
|---|---|---|
| `git push` 报 403 | 没接受协作邀请 | 去 GitHub 点 Accept |
| `npm run dev` 白屏 | Node 版本 < 20.19 / 依赖没装全 | `node -v`，然后 `rm -rf node_modules && npm install` |
| `npm run lint` 报 `set-state-in-effect` | 在 `useEffect` 里同步 `setState` | 改成 `useMemo` 派生，或用 `key` 强制重建组件 |
| 改了数据但界面不刷新 | 直接读了 storage，没走 hook | 用 `useVocab()` / `useArticles()` |
| 类型报错在 `Reader.tsx` | 分支从旧 main 拉的 | 删分支从 `origin/main` 重拉 |
| 不确定某个文件归谁 | 看 `docs/CONTRIBUTION.md` 的目录归属表 | 不确定就在群里问，别猜 |

## 每周节奏（对齐三条红线）

- **每天**：早上 `git pull --rebase origin main`，晚上 push；
- **11/23**：自己模块必须跑通，跑不通就降级；
- **11/26**：全部合进 main；
- **11/29**：功能冻结，只修 bug。

细节见 `docs/TEAM.md` §5。
