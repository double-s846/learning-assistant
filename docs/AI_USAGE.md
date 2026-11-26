# AI 使用记录（AI_USAGE.md）

> 赛题把「AI 使用透明化」列为**重点评分项（20%）**，要求明确 AI 辅助环节与人工实质性修改内容。
> 本文件按"场合 + 提示词 + 产出文件 + **人工改了什么**"逐条记录，随开发进度实时追加，不做事后补写。

---

## 1. 总述

**本项目明确使用 AI 辅助开发，并且不掩饰这一点。**

我们使用的边界：

| 用 AI 做什么 | 不用 AI 做什么 |
|---|---|
| 生成样板代码、组件骨架、样式初稿 | 决定产品范围与取舍（由团队讨论定） |
| 解释报错、给排查思路 | 决定数据结构契约（由负责人定并写注释说明理由） |
| 把重复逻辑改成通用函数 | 撰写示例文章正文、整理离线词表内容 |
| 起草文档结构 | 判断"某方案在评委环境能不能跑起来" |
| 辅助排查边界情况 | 最终验收（`typecheck` / `lint` / `build` 三条全绿才算完） |

**人工实质性修改的证据在哪里**：见 §3 表格的最后一列，以及 `git log` —— 每条提交都是人确认后才提交的，
提交信息里能看出哪些是 AI 初稿、哪些是人工返工（如 `fix(parse):`、`refactor(storage):` 类提交）。

## 2. 使用的 AI 工具

| 工具 | 版本/入口 | 用途 |
|---|---|---|
| DeepSeek Harness（deepseek 模型） | 网页工作区 | 工程脚手架、组件初稿、文档起草、报错排查 |
| 浏览器的开发者工具 AI 辅助（可选） | — | 个别 CSS 布局问题 |
| OpenAI Codex | 本地代码工作区 | PDF 导入功能、文本提取与浏览器验证（11-20） |
| GitHub Copilot（个别成员，可选） | — | 行内补全（仅补全，不生成整文件） |

> 若后续有成员使用其他工具（Claude / ChatGPT / 通义 / 文心等），请在此表追加一行。

## 3. 逐条使用记录

| 日期 | 成员 | 工具 | 用途 / 提示词摘要 | 产出文件 | **人工做的实质性修改** |
|---|---|---|---|---|---|
| 11-17 | double-s846 | DeepSeek Harness | "为外刊学习助手搭 Vite + React + TS 工程，写数据契约与存储层" | `package.json`、`tsconfig*.json`、`vite.config.ts`、`eslint.config.js`、`.gitignore` | ① TypeScript 拉到 7.0.2 与 `typescript-eslint`（要求 <6.1）冲突，人工降到 5.9 并锁定 `~5.9`；② 包管理器从计划的 pnpm 改为 npm（评委环境 pnpm 不一定装，npm 自带）；③ 去掉 URL 自动抓取方案（跨域要代理，与"零配置"冲突） |
| 11-17 | double-s846 | DeepSeek Harness | "设计全组共用的 TypeScript 数据契约，避免四个人类型冲突" | `src/types.ts` | 人工逐条复核字段语义：把 `glossSource` 从可选改为**必填**（强制界面展示释义来源，服务 AI 透明化评分）；把 `box` 从 `number` 收紧为 `0\|1\|2\|3\|4\|5` 字面量联合，让越界在编译期就报错 |
| 11-17 | double-s846 | DeepSeek Harness | "写 localStorage 封装，要能版本化、能订阅、能导出备份" | `src/lib/storage.ts` | 人工增加 `importSnapshot()` 的三个校验分支（非本应用备份 / 版本过高 / 字段缺失），这是 AI 初稿里没有的失败路径 |
| 11-17 | double-s846 | DeepSeek Harness | "写英文切段切句切词，要保留字符偏移" | `src/lib/tokenize.ts` | ① 人工补缩写表（AI 初稿只有 Mr./Dr.，补到 40+ 条含 U.S./e.g./a.m.）；② 修 `no-useless-escape`：字符组内 `\[` 改为直接放 `[`；③ **重写词形还原**：AI 初稿用"第一条匹配即返回"的正则表，导致 `deteriorating → deteriorat`（回填 `e` 的规则永远走不到），人工改成 `lemmaCandidates()` 有序候选链，由 `dict.ts` 逐个试词表；④ 修掉 `cities` 多产生 `citie` 候选的 bug |
| 11-17 | double-s846 | DeepSeek Harness | "查词如何在没有 API key 的情况下也能用？给出降级方案" | `src/lib/dict.ts`、`src/data/glossary/core.json` | ① 决定 ①②③ 三级降级顺序（AI 建议本地→付费，人工改为本地→免费→付费，因为评委没有付费 key）；② 为 `fetch` 加 `AbortController` 3.5s 超时（AI 初稿没有超时，弱网会一直转圈）；③ `fromPaidApi()` 故意留空并写明原因：签名密钥不能进前端 bundle |
| 11-17 | double-s846 | DeepSeek Harness | "写间隔重复与日历聚合工具" | `src/lib/srs.ts` | 人工把 `dayKey()` 从 `toISOString().slice(0,10)` 改为本地时区拼接 —— 原写法在东八区凌晨 0–8 点会把复习记录算到前一天 |
| 11-17 | double-s846 | DeepSeek Harness | "写阅读器、查词气泡、导入弹窗、生词本抽屉、设置菜单" | `src/features/**`、`src/App.tsx`、`src/styles/**` | ① React 19 新规则 `react-hooks/set-state-in-effect` 报错 3 处，人工重构：`useCollection` 改为惰性初始化 + 只订阅、`WordPopover` 改为父级 `key` 重建、`ParsePanel` 改为 `useMemo` 派生；② 把 `React.MouseEvent` 的全局命名空间引用改为 `import type { MouseEvent as ReactMouseEvent }`（`verbatimModuleSyntax` 下会编译失败）；③ 导入弹窗的"授权说明"从选填改为**必填**（对应评分项"来源合规"） |
| 11-17 | double-s846 | DeepSeek Harness | "起草 README、团队分工手册、产品说明、架构文档" | `README.md`、`docs/TEAM.md`、`docs/PRODUCT.md`、`docs/ARCHITECTURE.md`、本文件 | 人工填入真实约束：截止日期 12/06、评审权重 30/25/20/15/10、真实 Git 状态（仓库初始为空）、以及"沙箱内 git push 需本地执行"这一环境事实；删掉 AI 编造的"已完成的单元测试"段落 |
| 11-17 | double-s846 | DeepSeek Harness | "写 3 篇示例文章与离线核心词表" | `src/data/sample-articles.ts`、`src/data/glossary/core.json` | 人工确认授权：2 篇团队原创标 CC BY 4.0，1 篇 Aesop 标 Public Domain；人工检查词表释义（AI 初稿把 `peculiar` 只译"奇怪的"，补上"特有的"义项，因为文中是后者） |
| 11-17 | double-s846 | DeepSeek Harness | "给切句/切词/词形还原和间隔重复写单元测试" | `tests/tokenize.test.mjs`、`tests/srs.test.mjs` | ① 人工补充 AI 初稿没覆盖的边界：`a.m.` 缩写、`boxes`/`running` 的还原、`cities` 的候选污染、东八区凌晨 00:30 的 `dayKey`、盒 5 用 `easy` 不得越界；② 发现 `node --test tests/` 在某些受限环境会 `spawn EPERM`，人工加注说明可用 `node tests/xxx.test.mjs` 直接跑单文件；③ 测试跑出的 `cities → citie` 多余候选，回头修了 `tokenize.ts` 的生产代码 |
| 11-17 | double-s846 | DeepSeek Harness | "把阅读器改成装饰层插槽，避免三个模块同时改 Reader.tsx" | `src/features/reader/Reader.tsx`、`src/types.ts`、`src/App.tsx`、`src/features/vocab/WordPopover.tsx`、`src/features/reader/README.md` | ① 人工判断插槽**只给 class 名和 ReactNode、不给 DOM 操作权**（否则模块之间仍会互相踩）；② 人工把 `WordSelection` 拆成 `WordHit`（进 `types.ts`）+ 坐标，去掉 `Reader → features/vocab` 的反向依赖 —— AI 初稿让 Reader import 了 `WordSelection`，属于分层错误；③ 人工把配色/交互约定写进 `reader/README.md` 的 CSS 钩子表，避免各模块自己发明 class 名；④ 人工补 `cx()` 避免出现 `class="w undefined"` |
| 11-17 | double-s846 | DeepSeek Harness | "把成员、时间红线、进阶功能取舍写进 TEAM/CONTRIBUTION" | `docs/TEAM.md`、`docs/CONTRIBUTION.md`、`docs/PRODUCT.md`、`README.md` | 人工填入真实的四个 GitHub 账号与待认领状态；人工把"三条红线"从一句话扩成带处置措施的表格（11/23 降级、11/26 停止加功能、11/29 冻结）；人工按评分结构（闭环 30 + 文档 25 > 创新 15）决定进阶功能一律排除"需要 key / 需要后端"的项 |
| 11-17 | double-s846 | DeepSeek Harness | "写离线长句解析规则：切从句、抽主干、给中文讲解" | `src/lib/clause.ts`、`src/features/parse/ParsePanel.tsx`、`src/types.ts`、`tests/clause.test.mjs` | ① AI 初稿把介词短语也从主干里挖掉，产出 `the trees were not distributed neighbourhood` 这种读不通的主干，人工改为**只挖从句**；② 初稿的助动词断句把 `which had been laid out` 截成 `which had`，人工加"助动词链不重复断"；③ 挖除区间后留下 `Older streets, happened…`，人工加"连带吞掉两侧逗号"；④ 去掉 `even` 被误当连词（`even more difficult` 不是从句）；⑤ 人工把成分类型拆成 `kind: 'clause' \| 'modifier'`，一个字段同时决定"是否进主干"和"界面配色"；⑥ 人工规定**解析不出来就显示「未能切分」**，不许把整句当主干假装成功；⑦ 测试跑出 `When` 从句漏检（句首被跳过），人工补"句首 when/where/why 按状语从句处理" |

<!-- 追加格式：
| MM-DD | 姓名 | 工具 | 用途 / 提示词摘要 | 产出文件 | 人工做的实质性修改 |
-->

| 日期 | 成员 | 工具 | 用途 / 提示词摘要 | 产出文件 | 人工复核状态 |
|---|---|---|---|---|---|
| 11-20 | 本地开发（成员待填） | OpenAI Codex | “支持导入 PDF 论文，提取后进入已有阅读和查词流程” | `features/library/ImportDialog.tsx`、`pdf.ts`、`pdf-text.ts`、`App.tsx`、导入样式、依赖与相关测试/文档 | 尚待负责人复核；本次实现、排版整理与自动检查由 Codex 完成，未将其记为人工修改。PDF 本身在浏览器本地处理，不发送给 AI 或第三方服务。 |
| 11-20 | 本地开发（成员待填） | OpenAI Codex | “尽量保留 PDF 中的图片” | `features/reader/PdfPageFigure.tsx`、`Reader.tsx`、`library/pdf-pages.ts`、`pdf.ts`、`ImportDialog.tsx`、`lib/storage.ts`、`lib/article.ts`、`types.ts`、备份设置与测试 | 尚待负责人复核；采用原页渲染兼容照片和矢量图表，PDF 存于本机 IndexedDB，随 JSON 备份导出/恢复。自动测试由 Codex 执行，不冒称人工复核。 |
| 11-21 | 本地开发（成员待填） | OpenAI Codex | “正文继续使用阅读器文字显示，图片单独提取” | `library/pdf-figures.ts`、`pdf-pages.ts`、`pdf-text.ts`、`pdf.ts`、`reader/PdfPageFigure.tsx`、`Reader.tsx`、`lib/article.ts`、`types.ts`、图片区域测试与文档 | 尚待负责人复核；基于 PDF 绘图操作定位照片/矢量图表，尊重 Form 剪裁边界；以图片标记插入正文，仅渲染图像区域。保留本地文件和备份流程，旧版图文文章自动识别区域。实现与自动测试由 Codex 完成。 |

### 关于上表的两点说明

1. **"人工做的实质性修改"这一列记的是实际发生的事**：当次生成后立刻发现并改掉的问题
   （类型冲突、lint 规则冲突、正则分支不可达、时区 bug、必填项遗漏）。
   后续成员照这个粒度写即可 —— 讲清楚"我改了什么、为什么改"，不要只写"改了一下"。
2. **本表由负责人复核后提交**。AI 起草的部分在提交前需人工确认语义正确，
   复核结果记在下节清单里。

### 提交前复核清单（负责人填写）

- [ ] `src/types.ts` 的字段语义与业务一致（尤其 `glossSource` / `context.sentenceId`）
- [ ] `docs/AI_USAGE.md` 表格与真实 `git log` 对得上
- [ ] 示例文章的授权标注正确（2 篇 CC BY 4.0 + 1 篇 Public Domain）
- [ ] 离线词表释义与文章语境匹配（如 `peculiar` 取"特有的"而非"奇怪的"）
- [ ] 演示前跑通 `npm run lint && npm run typecheck && npm run build && npm test`

## 4. AI 未参与的部分（人工独立完成）

- **产品范围与取舍**：决定"不做后端、不做 URL 抓取、押双模式差异化"，见 `docs/PRODUCT.md` §5；
- **数据结构契约的业务语义**：`VocabEntry` 为什么要带 `context.sentenceId`（复习时回原文），
  为什么 `ReadingMode` 只有两个值而不是三个；
- **示例文章正文**：三篇文章的选题、写作、句子难度控制（刻意放入定语从句、插入语、分词状语，用于演示长句解析）；
- **离线词表的中文释义审核**：逐条检查义项是否匹配文章语境；
- **Git 提交与分工**：所有提交由人执行并编写提交信息；
- **验收判定**：`npm run lint` / `typecheck` / `build` 三条全绿才允许提交；
- **环境适配**：Windows 路径含中文与罗马数字 Ⅰ、npm 缓存目录受限、Git 认证等真实问题的排查。

## 5. 文件级标记

由 AI 生成初稿、人工修改后提交的文件，在文件头注释里带标记：

```ts
/**
 * AI-assisted: 初稿由 DeepSeek（2026-11-17）生成，人工修改点见 docs/AI_USAGE.md §3。
 */
```

当前带标记的文件：

- `src/lib/storage.ts`
- `src/lib/dict.ts`
- `src/lib/srs.ts`
- `src/lib/tokenize.ts`
- `src/features/reader/Reader.tsx`
- `src/features/vocab/WordPopover.tsx`
- `src/features/library/ImportDialog.tsx`
- `src/features/settings/SettingsMenu.tsx`

## 6. 对话与提示词留存

为保证可复核，关键提示词摘要已记录在 §3 的"用途 / 提示词摘要"列。
完整的对话记录（含报错排查过程）由成员自行留存截图，作为提交材料附件。

## 7. 2026-11-21 合并适配（Codex）

根据用户“把我的分支合并到 main”指令，将 `origin/main` 的阅读器装饰插槽和离线长句解析合入
`dev/jz-Gong10-c`。Codex 解决 `Reader.tsx` 与 README 冲突，保留 `WordHit`、
`ReaderDecorations`、句子编号和学习/流畅模式约束，同时保留复习日历、中文查词与 PDF 独立图片。
同步更新测试数量与模块 C 状态。冲突处理和自动验证由 Codex 完成，未记为人工修改；成员复核状态待填。

合并过程中 `main` 又通过 PR #3 集成同一批功能。再次同步时保留对方的阅读器代码、
测试明细、分工更新与技术债说明，仅补充交付状态和本次适配记录。

## 8. 待补充（团队分工后必做）

- [ ] 每位成员在使用 AI 后**当次**追加一行记录（不要攒到最后一周，写不出来）；
- [ ] 模块 B / C / D / E 的 AI 使用记录；
- [ ] 若接入大模型做长句解析，必须记录：调用的是哪家模型、是否把用户文章发到第三方、
      是否在界面上告知用户；
- [ ] 演示视频里如使用 AI 配音/AI 生成画面，需在此声明。


## 模块 D 增强（2026-11-26）

Codex 生成 ClauseMarks、接触从句/并列关系从句规则、LRU 缓存、回归测试与接入说明。迭代时改用原文 Range 高亮以避免文本复制和换行错位；为降低误判，接触从句限定为保守词表模式。尚无人工修改或浏览器验收记录，等待负责人复核。未启用 LLM、未修改 App/Reader。
