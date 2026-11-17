# 外刊学习助手 · Learning Assistant

> **码力同行 · 开源实践挑战** 参赛作品 —— 赛道一（基础创新项目）**赛题 1：外刊学习助手**
>
> 一句话：**在同一个阅读界面里，同时给出「阅读流畅性」和「学习深度」。**

一个纯前端的英文外刊精读工具。粘贴原文 → 点词成卡 → 点句看结构 → 朗读跟读 → 按日历复习。
**不需要后端、不需要数据库、不需要任何 API Key**，`npm install && npm run dev` 即可运行。

---

## 目录

- [为什么做这个](#为什么做这个)
- [快速开始](#快速开始)
- [功能清单（对照赛题要求）](#功能清单对照赛题要求)
- [核心设计：流畅模式 / 学习模式](#核心设计流畅模式--学习模式)
- [目录结构](#目录结构)
- [数据、隐私与备份](#数据隐私与备份)
- [内容来源与授权](#内容来源与授权)
- [第三方依赖与许可证](#第三方依赖与许可证)
- [AI 使用声明](#ai-使用声明)
- [团队分工](#团队分工)
- [开发约定](#开发约定)
- [路线图](#路线图)

---

## 为什么做这个

读外刊的人有个共同的矛盾：**想读得顺，就得关掉所有辅助；想学得深，就得不断停下来查词。**
市面上的工具大多只解决一半——要么是纯阅读器（不沉淀词汇），要么是纯背单词 App（脱离语境）。

我们的做法不是再堆功能，而是让**同一份正文**同时支撑两种读法：

| 模式 | 适合什么时候 | 界面行为 |
|---|---|---|
| **流畅模式** | 通读、抓主旨、练速度 | 隐藏生词下划线、句子不可点、只留正文与朗读 |
| **学习模式** | 精读、抠长难句、积累词汇 | 生词下划线、点词查义、点句看结构、逐句朗读高亮 |

同一个词在两种模式下共享同一份数据：流畅模式里攒下的生词，切到学习模式立刻能看到它在原文哪里出现。

---

## 快速开始

**环境要求**：Node.js ≥ 20.19（推荐 22 / 24），npm ≥ 10。

```bash
# 1. 克隆
git clone https://github.com/double-s846/learning-assistant.git
cd learning-assistant

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev
# 浏览器打开 http://localhost:5173
```

其他命令：

```bash
npm run build      # 生产构建（含 TypeScript 类型检查），产物在 dist/
npm run preview    # 本地预览构建产物
npm run typecheck  # 仅做类型检查
npm run lint       # ESLint 检查
npm test           # 单元测试（node:test，覆盖切句/切词/词形还原/间隔重复/长句解析）
```

**当前测试覆盖**：28 个用例，全部针对"错了也很难在界面上看出来"的纯函数 ——
切句的缩写与小数边界、字符区间能否精确还原原文、词形还原候选链、SRS 盒子在 0/5 边界的进退、
日历 key 的本地时区处理、长句解析的从句切分与主干抽取。

> **不需要配置任何环境变量。** `.env.example` 里列出的 key 全是可选增强项，
> 不填也能完整跑通全部核心流程（详见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) 的「三级降级」）。
>
> 首次启动会自动灌入 3 篇示例文章，所以打开页面即可直接体验，不用先自己找文章。

---

## 功能清单（对照赛题要求）

图例：✅ 已完成 · 🚧 进行中 · 📋 规划中

### 基础功能

| # | 赛题要求 | 状态 | 实现位置 |
|---|---|---|---|
| 1 | **文章获取与阅读器**：支持字号、行距、主题（浅色/深色/护眼） | ✅ | `features/reader`、`features/settings` |
| 2 | **阅读流畅性与学习深度**双模式 | ✅ | `types.ts` 的 `ReadingMode`、顶栏切换 |
| 3 | **点击查词**：内置离线词表 + 在线词典三级降级 | ✅ | `lib/dict.ts`、`features/vocab/WordPopover.tsx` |
| 4 | **生词本与生词卡**：记录原句与出处 | ✅ | `lib/storage.ts`、`features/vocab/VocabDrawer.tsx` |
| 5 | **生词卡日历 + 复习到期提醒** | 🚧 | `lib/srs.ts` 已就绪，UI 由模块 C 实现 |
| 6 | **阅读进度与打勾标记**：段落级已读、文章百分比 | ✅ | `features/reader/Reader.tsx`、侧栏进度条 |
| 7 | **长句解析**：切分句子成分并给出中文讲解 | ✅ | `lib/clause.ts`（离线规则层）、`features/parse` |
| 8 | **TTS 朗读**：逐句朗读 + 当前句高亮 | 📋 | 模块 E，使用浏览器原生 `SpeechSynthesis` |

### 进阶功能

| # | 要求 | 状态 | 说明 |
|---|---|---|---|
| 9 | 数据持久化、刷新不丢失 | ✅ | `localStorage`，命名空间 + schema 版本号 |
| 10 | 数据可导出 / 导入（防丢失） | ✅ | 设置菜单 → 导出 / 导入备份 JSON |
| 11 | 深色模式、响应式布局 | ✅ | CSS 变量主题，≤860px 单栏 |
| 12 | 查词来源透明化 | ✅ | 生词卡与气泡均标注「内置离线词表 / 免费在线词典」 |
| 13 | 离线可用 | ✅ | 内置词表 + 公版示例文章，断网也可完整阅读与查词 |

---

## 核心设计：流畅模式 / 学习模式

这不是一个「开关」，而是**同一套数据、两种渲染策略**：

```
                 ┌─────────────────────────┐
   同一份正文  →  │ ReadingMode = 'flow'    │  只渲染段落与句子，不渲染任何辅助层
   (Article)     │ ReadingMode = 'study'   │  叠加：生词下划线 / 点词查义 / 句级解析入口
                 └─────────────────────────┘
```

实现上只依赖 `src/types.ts` 里的 `ReadingMode` 与 `Reader.tsx` 中的条件渲染，
**新增任何辅助功能时都不需要改数据结构**——这是后续模块能并行开发的前提。

---

## 目录结构

```
learning-assistant/
├─ src/
│  ├─ types.ts                 ★ 全组共用数据契约（唯一业务类型来源）
│  ├─ App.tsx                  应用外壳（薄，只做编排）
│  ├─ main.tsx                 React 入口
│  ├─ components/              跨模块通用组件（当前为空，按需新增）
│  ├─ data/
│  │  ├─ sample-articles.ts    内置 3 篇示例文章（含授权说明）
│  │  └─ glossary/core.json    内置离线词表（查词第一级降级）
│  ├─ lib/                     ★ 无 UI 的纯逻辑层
│  │  ├─ storage.ts            唯一直接访问 localStorage 的文件
│  │  ├─ hooks.ts              storage 的 React 订阅封装
│  │  ├─ tokenize.ts           切段 / 切句 / 切词（全部带字符区间）
│  │  ├─ article.ts            文本 → Article/Sentence
│  │  ├─ dict.ts               查词三级降级
│  │  ├─ srs.ts                间隔重复与日历统计
│  │  └─ id.ts                 id 生成
│  ├─ features/                ★ 按功能模块切分，一人一个目录
│  │  ├─ reader/               阅读器（已实现）
│  │  ├─ library/              文章库、导入（已实现）
│  │  ├─ vocab/                查词气泡、生词本（模块 B）
│  │  ├─ review/               复习队列与日历（模块 C）
│  │  ├─ parse/                长句解析（模块 D）
│  │  ├─ tts/                  朗读跟读（模块 E）
│  │  └─ settings/             设置与备份（已实现）
│  └─ styles/                  全局样式与主题变量
├─ docs/                       产品、架构、分工、AI 使用记录
├─ tests/                      单元测试（node:test，无需测试框架）
├─ public/                     静态资源
├─ index.html
└─ package.json
```

**约定：每个人只改自己 `features/<模块>/` 下的文件**，公共层（`types.ts` / `lib/`）改动需先在群里同步。

---

## 数据、隐私与备份

- 全部数据存在**浏览器本地**（`localStorage`，命名空间 `la:v1:*`），不上传任何服务器。
- 没有账号体系，不采集任何个人信息，无埋点、无统计脚本。
- 换浏览器 / 清缓存会丢数据，因此提供**导出 / 导入 JSON 备份**（设置菜单 → 导出备份）。
- 数据结构带 `schemaVersion`，未来升级会写迁移函数，导入旧备份时会提示版本不兼容。

---

## 内容来源与授权

赛题要求「模型、数据集、代码来源可溯源」，因此仓库内所有内容都标注来源：

| 内容 | 来源 | 授权 |
|---|---|---|
| 示例文章《The Attention Economy…》 | 团队原创 | CC BY 4.0 |
| 示例文章《Why Cities Are Planting More Trees…》 | 团队原创 | CC BY 4.0 |
| 示例文章《The Fox and the Grapes》 | Aesop's Fables, trans. George Fyler Townsend (1867) | Public Domain |
| 内置离线词表 `glossary/core.json` | 团队整理编写 | CC BY 4.0 |
| 项目源代码 | 团队开发 | MIT（见 [LICENSE](LICENSE)） |

> 用户自行导入的文章，版权归原作者所有；本项目仅提供本地阅读与笔记工具，不存储、不分发用户导入的内容。
> 界面上每篇文章都会显示其授权字段，导入时该字段为必填项。

---

## 第三方依赖与许可证

完整清单（含每个依赖的许可证类型与用途）见 **[docs/THIRD_PARTY_LICENSES.md](docs/THIRD_PARTY_LICENSES.md)**。摘要：

| 依赖 | 版本 | 许可证 | 用途 |
|---|---|---|---|
| [react](https://react.dev) / react-dom | 19.3 | MIT | UI 框架 |
| [vite](https://vite.dev) | 8.3 | MIT | 构建工具 |
| [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react) | 6.3 | MIT | React 编译插件 |
| [typescript](https://www.typescriptlang.org) | 5.9 | Apache-2.0 | 类型系统 |
| [eslint](https://eslint.org) 及插件 | 10.x / 8.x | MIT | 代码规范检查 |

**外部服务**（非代码依赖，仅在联网时使用）：

| 服务 | 用途 | 费用 | 许可证/条款 |
|---|---|---|---|
| [dictionaryapi.dev](https://dictionaryapi.dev) | 查词降级链第二级（英文释义） | 免费、无需 key | 服务方公开免费 API |
| 浏览器 Web Speech API | TTS 朗读（模块 E） | 免费、本地合成 | 浏览器内置能力 |

---

## AI 使用声明

本项目**明确使用 AI 辅助开发**，并按赛题要求逐条记录在 **[docs/AI_USAGE.md](docs/AI_USAGE.md)**，其中包括：

- 使用了哪些 AI 工具、在哪些环节使用；
- 每个由 AI 生成或改写的文件（文件头有 `AI-assisted` 标记）；
- **人工做了哪些实质性修改**（重构、修 bug、改交互、补类型、删掉不可用的方案）；
- AI 未参与的部分（例：数据结构设计决策、离线词表内容、示例文章撰写、Git 提交与联调）。

> 一句话原则：**AI 用来加速，不用来替代判断。** 任何 AI 产出的代码都经过人工阅读、修改，并通过 `npm run typecheck`、`npm run lint`、`npm run build`。

---

## 团队分工

详细分工、协作约定、提交规范见 **[docs/TEAM.md](docs/TEAM.md)**；
每个提交归属哪个成员、哪个目录，以及评审如何用三条命令复核，见 **[docs/CONTRIBUTION.md](docs/CONTRIBUTION.md)**。

| 成员 | GitHub | 个人分支 | 负责模块 |
|---|---|---|---|
| double-s846 | [@double-s846](https://github.com/double-s846) | `dev/double-s846` | 公共层与架构、阅读器、设置、**模块 D 长句解析**、集成、文档与测试 |
| 宫霁祯 | [@jz-Gong10](https://github.com/jz-Gong10) | `dev/jz-Gong10-<模块>` | 待认领（B 查词与生词本 / C 复习与日历 / E 朗读跟读） |
| Selena | [@Selena14111](https://github.com/Selena14111) | `dev/Selena14111-<模块>` | 待认领（同上） |
| zouyujing | [@zouyujing20070207](https://github.com/zouyujing20070207) | `dev/zouyujing20070207-<模块>` | 待认领（同上） |

**协作方式**：一人一分支 → 开 PR → 以 **Merge commit** 合入 `main`（不用 Squash，否则提交粒度被压平、分工统计失真）。
PR 记录即分工证据，同时承载 AI 使用说明（见 [PR 模板](.github/PULL_REQUEST_TEMPLATE.md)）。
阅读器采用**装饰层插槽**，B / D / E 三个模块都不需要改 `Reader.tsx`（见 [插槽说明](src/features/reader/README.md)）。

---

## 开发约定

1. **类型先行**：任何新功能先看 `src/types.ts` 有没有对应契约，没有就先加契约再写实现。
2. **不碰 localStorage**：只用 `src/lib/storage.ts`（及其 hook）。
3. **不重复切文本**：句子 / 单词列表一律来自 `src/lib/tokenize.ts`。
4. **提交粒度**：一个功能点一个 commit，格式 `feat(模块): 说明` / `fix(模块): 说明` / `docs: 说明`。
5. **提交前自查**：`npm run lint && npm run typecheck && npm run build` 三条都过。
6. **AI 记录随手写**：用了 AI 就在当次往 `docs/AI_USAGE.md` 加一行。

---

## 路线图

- [x] 工程地基、数据契约、存储层
- [x] 阅读器、导入、双模式、进度打勾、设置与备份
- [x] 查词三级降级、生词卡基础版
- [x] 单元测试（`npm test`，28 个用例覆盖 tokenize / srs / clause）
- [x] **长句解析规则层**（模块 D）：从句切分 + 主干抽取 + 成分中文讲解，离线可用
- [ ] 复习队列 + 日历热力图（模块 C）
- [ ] TTS 逐句朗读与高亮跟读（模块 E）
- [ ] 长句解析的 LLM 增强（可选，需自备 key，失败自动回落规则层）
- [ ] storage / dict 的测试（需先补 localStorage 与 fetch 的打桩）
- [ ] 演示视频与评测评分解读（`docs/DEMO.md`）

---

## 许可

源代码采用 [MIT License](LICENSE)。
示例文章与词表采用 CC BY 4.0（详见 [内容来源与授权](#内容来源与授权)）。
