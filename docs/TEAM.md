# 团队协作手册（TEAM.md）

> **这份文档是给组员看的，请先读完再动手。**
> 目标：四个人各写一块，最后能**直接合并成能跑的东西**，而不是四份互不兼容的代码。
> 最后更新：2026-11-17 · 维护人：double-s846

---

## 0. 30 秒版

| 问题 | 答案 |
|---|---|
| 做什么 | 英文外刊精读工具：点词成卡、长句解析、朗读跟读、日历复习 |
| 技术栈 | **纯前端** Vite + React 19 + TypeScript。**没有后端、没有数据库、没有 API Key** |
| 数据存哪 | 浏览器 `localStorage`（不是服务端） |
| 怎么跑 | `npm install` → `npm run dev` → 打开 http://localhost:5173 |
| 我该改哪 | **只改 `src/features/<你的模块>/`**，别动别人的目录 |
| 提交怎么做 | 一个功能一个 commit，格式 `feat(模块): 说明` |

---

## 1. 三个已经定了的技术决策（别推翻，理由在这）

### ① 不做前后端分离，纯前端

**我们的判断**：后端对我们是纯负债。

- 赛题不要求联网协作，数据本地存完全够用；
- 有了后端就要部署、要域名、要备案/证书，评委还得配数据库 —— **"能跑起来"的风险全在这里**；
- 评分里「可运行闭环」占 **30 分**，是权重最高的一项。评委 `clone` 下来一条命令能跑，才是稳的。

所以：**任何需要"起一个服务"的方案一律不采纳。**

### ② 数据用 localStorage，不用 IndexedDB

localStorage 同步、简单、够用（几 MB 文本量级完全撑得住）。IndexedDB 是异步 API，会让简单的事情变复杂，收益为零。

**但有一个硬规矩：只有 `src/lib/storage.ts` 能碰 localStorage。** 其他地方一律用它的封装，原因：

- 换存储方案时只改一个文件；
- 统一带命名空间和 schema 版本号，不会读到脏数据；
- 统一 try/catch，隐私模式 / 配额满 / JSON 损坏时不会白屏。

### ③ 查词"直接调 API"是可以的，但必须做成三级降级

⚠️ **这是最容易踩的坑，请所有人认真看。**

有道 / 百度 / DeepL 这些接口**全都要 key**。评委 clone 我们的仓库时**不会有我们的 key**。
如果查词强依赖付费接口，评委点第一个词就 401 —— 30 分直接没了。

所以查词链路必须是：

```
① 内置离线词表 src/data/glossary/core.json   ← 不联网、不填 key，永远可用
       ↓ 没命中
② dictionaryapi.dev                          ← 免费、无需 key、开放 CORS
       ↓ 没命中
③ 有道/百度（.env 里的 key）                  ← 可选增强，没填自动跳过
       ↓ 全都没有
④ 让用户手动填释义
```

**实现已经在 `src/lib/dict.ts` 里写好了，直接调用 `lookup(word)` 即可**，不要去别处写 fetch。
`lookup` 返回的 `source` 字段必须显示在界面上 —— 这是比赛「AI / 外部依赖透明化」的要求，用户有权知道释义从哪来。

---

## 2. 模块划分与认领

> 分支名、已有提交归属、评审复核命令见 **[CONTRIBUTION.md](CONTRIBUTION.md)**。

已经实现的**地基**（不用你管，可以直接用）：

| 文件 | 作用 |
|---|---|
| `src/types.ts` | **全组数据契约**，唯一的业务类型来源 |
| `src/lib/storage.ts` | localStorage 封装（articles / vocab / progress / settings） |
| `src/lib/hooks.ts` | 把 storage 包成 React hook（`useVocab()` 等），数据变了界面自动刷新 |
| `src/lib/tokenize.ts` | 切段 / 切句 / 切词，**全部带字符区间** |
| `src/lib/article.ts` | 文本 → Article / Sentence（句子 id 是确定性的，刷新后仍能对上） |
| `src/lib/dict.ts` | 查词三级降级 |
| `src/lib/srs.ts` | 间隔重复计算、日历聚合（**已写好，模块 C 直接用**） |
| `src/features/reader/Reader.tsx` | 阅读器，点词 / 点句的回调已经接好 |
| `src/features/settings/` | 设置、主题、导出导入备份 |

**待认领的 4 个模块**：

| 模块 | 目录 | 要交付什么 | 难度 | 建议人 |
|---|---|---|---|---|
| **B 查词与生词本** | `src/features/vocab/` | 生词卡列表增强、搜索、按文章筛选、标签、批量删除、导出 CSV | 中 | 待填 |
| **C 复习队列与日历** | `src/features/review/` | 今日复习队列 UI、Again/Good/Easy 三档评分、日历热力图、每日目标完成度 | 中 | 待填 |
| **D 长句解析** | `src/features/parse/` | 真正实现 `analyzeSentence()`：切分从句与修饰语、标主干、给中文讲解 | **难** | 待填（建议最熟英语语法的） |
| **E 朗读与跟读** | `src/features/tts/` | 逐句朗读、当前句高亮跟随、自动滚动、语速与音色选择、暂停/继续 | 简单 | 待填（可与 C 合并给同一人） |

> 按"复杂少做、简单多做"配平：**D 单独一个人，E 可以和 C 给同一个人**，剩下两人各拿 B 一份。

### 每个模块的第一步（复制即用）

**模块 C 的第一步**：`lib/srs.ts` 里已经有 `buildReviewQueue()` / `reviewEntry()` / `monthGrid()` / `reviewCountByDay()`，你只需要写 UI：

1. 在 `src/features/review/ReviewPanel.tsx` 新建组件，用 `useVocab()` 拿数据；
2. `const queue = buildReviewQueue(vocab)` 得到今日待复习；
3. 显示卡片 → 点「没记住/记得/很简单」→ `vocabStore.upsert(reviewEntry(entry, grade))`；
4. 日历用 `monthGrid(year, month)` 生成 42 格，`reviewCountByDay(vocab)` 取每天次数上色。

**模块 D 的第一步**：打开 `src/features/parse/ParsePanel.tsx`，找到 `analyzeSentence()`，按文件顶部注释里的路线实现。**先做离线规则层，别一上来接大模型。**

**模块 E 的第一步**：新建 `src/features/tts/useTTS.ts`：

```ts
// 用浏览器原生能力，零依赖零费用
const utter = new SpeechSynthesisUtterance(text)
utter.lang = 'en-US'
utter.rate = settings.ttsRate
speechSynthesis.speak(utter)
// 逐句：onend 里取下一句；当前句 id 存 state，Reader 通过 props 高亮
```

---

## 3. 数据契约（改这个要打招呼）

完整定义在 `src/types.ts`，这里只列你一定会用到的：

```ts
Article          // 一篇文章：id / title / source / license / paragraphs[]
Paragraph        // 段落：id / index / text
Sentence         // 句子：id / paragraphId / start / end / text / index

VocabEntry       // 生词卡
  ├ word, lemma, phonetic, pos
  ├ glossZh, glossEn, glossSource        // source 必须显示给用户
  ├ context: { articleId, articleTitle, paragraphId, sentenceId, sentence }
  ├ box: 0|1|2|3|4|5                     // 复习盒子
  ├ dueAt, createdAt, reviews[]
  └ tags?: string[]

ReadingProgress  // articleId / readParagraphIds[] / percent / finished
SentenceParse    // 模块 D 的返回值：backbone / segments[] / translationZh / tips[]
Settings         // mode('flow'|'study') / theme / fontSize / lineHeight / ttsRate / dailyGoal
```

**三条铁律**：

1. **不要在 feature 里另建同名 interface**，会导致合并冲突和类型不一致；
2. **不要往存储里放 `Date` 对象**，统一 ISO 字符串（JSON 往返会变字符串，类型会骗人）；
3. **id 用 `createId()`**（`src/lib/id.ts`），不要自己写 `Math.random()`。

要加字段的流程：改 `types.ts` → 群里说一句"我加了 xxx 字段" → 别人 `git pull` → 再继续。

---

## 4. 协作流程

### 分支策略：一人一分支，PR 合入 main

```
main                    ← 集成分支，始终能跑，不要直接 push
 ├─ dev/double-s846     ← double-s846（地基 + 公共层维护）
 ├─ dev/<你的id>-b      ← 模块 B 负责人
 ├─ dev/<你的id>-c      ← 模块 C 负责人
 ├─ dev/<你的id>-d      ← 模块 D 负责人
 └─ dev/<你的id>-e      ← 模块 E 负责人
```

**为什么必须这样**：GitHub 的 PR 页面会自动统计"谁提交、改了多少文件、动了哪些目录"。
评审打开 PR 列表看到四条 PR 就是四份分工，比看 `git log` 直观，也比任何口头说明可信。
详细的分工归属表与复核命令见 **[CONTRIBUTION.md](CONTRIBUTION.md)**。

**你现在要做的**：

```bash
git fetch origin
git switch -c dev/<你的github-id>-<模块字母> origin/main   # 从 main 拉自己的分支，只做一次
```

**日常循环**：

```bash
git pull --rebase origin main     # 开工前先跟上主干
# ... 写代码 ...
git add -A
git commit -m "feat(review): 复习队列三档评分"
npm run lint && npm run typecheck && npm test && npm run build
git push -u origin dev/<你的id>-<模块字母>
```

然后去 GitHub 开 PR → 目标分支 `main`，按 [PR 模板](../.github/PULL_REQUEST_TEMPLATE.md) 填完。
**PR 里必须写清：做了什么、怎么验证的、AI 用了什么/人工改了什么。**

**红线**

- 不要直接往 `main` push（第一个 PR 合并后我会开分支保护）；
- 不要 force push `main`；
- 不要在一个 PR 里改别人模块的文件 —— 会被打回。

### 提交规范（评审要看，别乱写）

```
feat(vocab): 生词卡支持按文章筛选
fix(parse): 修正 that 从句在插入语后切分错误
docs: 补充模块 C 的契约说明
refactor(storage): 抽出 progressStore.get
```

括号里的 scope 用模块名：`core` / `reader` / `library` / `vocab` / `review` / `parse` / `tts` / `settings` / `docs`。
统一之后，`git log --grep="(review)"` 一条命令就能导出模块 C 的全部提交，写分工表不用回忆。

**为什么要小步提交**：比赛明确说"保留完整 Git 提交记录作为分工考核依据"。
最后一次性大提交 = 无法证明分工 = 白干。

### 提交前自查（四条全过才 push）

```bash
npm run lint
npm run typecheck
npm test          # 已有 20 个用例，改到 tokenize / srs 必须跑
npm run build
```

### 不要提交这些

- `node_modules/`、`dist/`、`.env`（已在 `.gitignore` 里，别 `-f` 强推）
- 真实 API key
- 大文件（图片 > 2MB、视频、字体包）

---

## 5. 时间表（截止 2026-12-06 提交）

| 阶段 | 时间 | 交付 |
|---|---|---|
| 地基（已完成） | 11/17 | 工程脚手架、契约、阅读器、查词、进度、设置 |
| **并行开发** | 11/18 – 11/23 | B / C / D / E 四个模块各自能独立跑 |
| 联调 | 11/24 – 11/26 | 合到 main，修冲突，整体走通一遍 |
| 补测与文档 | 11/27 – 11/29 | 继续补单测（tokenize/srs 已有 20 例）、README 补齐、**AI 使用记录整理** |
| 演示与打包 | 11/30 – 12/03 | 录 3–5 分钟演示视频、提交压缩包自测 |
| 缓冲 | 12/04 – 12/06 | 提交（别拖到 12/6 当天） |

**红线**：11/23 晚上还没跑通的模块，立刻降级为"简化版"，宁可少一个功能也不能没有可运行闭环。

---

## 6. AI 使用记录：随手写，别攒着

评委给了 **20 分**给"AI 使用透明化"，而且明确要求写"人工实质性修改内容"。这个分数最好拿也最容易丢。

**规则**：你每用 AI 生成/修改一段代码，当次就在 `docs/AI_USAGE.md` 的表格里加一行：

| 日期 | 成员 | 工具 | 用途/提示词 | 产出文件 | **人工改了什么** |
|---|---|---|---|---|---|
| 11-18 | 张三 | ChatGPT | "用 React 写一个日历热力图组件" | `features/review/Calendar.tsx` | 改成本地时区日期、修了 42 格补齐错位、删掉 chart 库改成 CSS grid |

最后那列是重点。写"没改，直接用了"是扣分的；写清"删了什么、修了什么、为什么改"才是评委想看的。

---

## 7. 常见问题

**Q：我能用别的 UI 库吗（Ant Design / Tailwind / MUI）？**
A：不建议。每加一个依赖都要进第三方许可证清单，而且会稀释我们"零配置可跑"的优势。现有 CSS 变量体系已经够用。

**Q：我能装 axios / dayjs / lodash 吗？**
A：先问。`fetch`、原生 `Date`、原生数组方法基本都能覆盖，目前项目**运行时依赖只有 react 和 react-dom**。

**Q：本地跑起来是白屏？**
A：① 看终端有没有报错；② Node 版本 ≥ 20.19；③ 删掉 `node_modules` 重装；④ 浏览器控制台看 `localStorage` 是否被禁用（隐私模式）。

**Q：`npm run lint` 报 `react-hooks/set-state-in-effect`？**
A：不要在 effect 里同步 `setState`。要么改成从 props 派生（`useMemo`），要么用 key 强制重建组件。这是 React 19 的新规则，故意卡严的。

**Q：我改完 `types.ts` 后别人代码报错？**
A：说明你改的是公共契约，先群里说，确认后再 push。

**Q：能不能把 localStorage 换成调接口存云端？**
A：不行，见 §1 决策①。要做也是比赛结束之后的迭代。

---

## 8. 现在就能做的第一件事

1. `git clone` 仓库，`npm install`，`npm run dev`，确认能看到 3 篇示例文章；
2. 点几个词、切一下流畅/学习模式、勾几个段落，感受一下现在的完成度；
3. 在群里认领 §2 表格里的一个模块；
4. 在你认领的模块目录里开始写，第一个 commit 就写 `feat(模块): 初始骨架`。

有问题随时在群里 @double-s846。
