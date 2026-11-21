# 分工与提交归属（CONTRIBUTION.md）

> 赛题要求「保留完整 Git 提交记录作为分工考核依据」。这份文档把**提交记录翻译成人能读的分工表**，
> 并提供评审可直接复核的命令。任何人不需要信任我们的说法，跑一行命令就能验证。

---

## 1. 一页看懂：谁做了什么

**团队**：码力同行 · 开源实践挑战 —— 赛道一（基础创新项目）赛题 1「外刊学习助手」，共 4 人。

| 成员 | GitHub | 个人分支 | 提交数 | 负责范围 |
|---|---|---|---|---|
| double-s846（负责人） | [@double-s846](https://github.com/double-s846) | `dev/double-s846` | 16 | **地基与架构**：工程脚手架、数据契约、存储层、文本处理、查词降级、SRS 算法、阅读器与装饰层插槽、双模式、导入、设置与备份、**长句解析规则层**、单元测试、全部文档、集成（含跨分支冲突解决）与演示；**模块 E 朗读跟读** |
| Selena | [@Selena14111](https://github.com/Selena14111) | `dev/Selena14111-b` | 0 | **模块 B** 生词本搜索、按文章/盒子筛选、标签、批量删除、CSV 导出 |
| 宫霁祯 | [@jz-Gong10](https://github.com/jz-Gong10) | `dev/jz-Gong10-c` | 见 §4 Git 记录 | **模块 C** 复习卡片、三档评分、热力图与每日目标 ＋ **PDF 论文图文导入** ＋ 中文查词自动翻译降级；记忆曲线待补 |
| zouyujing | [@zouyujing20070207](https://github.com/zouyujing20070207) | `dev/zouyujing20070207-d` | 0 | **模块 D** 长句解析增强：正文内联标注、接触/并列从句识别、解析缓存、可选 LLM 增强、补测试 |

> 说明：
> 1. 早期提交的 author 均为 `double-s846`（地基与公共层）。宫霁祯从 `dev/jz-Gong10-c` 起以自己账号提交，
>    已体现在上方记录中；其余成员开始提交后同样自动出现。
> 2. 提交数以 `git shortlog -sne` 的输出为准（见 §4），本表随开发进展更新。
> 3. 分支名已固定，**不要改名**，否则 PR 记录会断。
> 4. PDF 导入与中文翻译属于「进阶功能」，由宫霁祯在模块 C 之外一并完成，已在 `docs/AI_USAGE.md` 记录。
> 4. 每人的具体交付清单与验收标准见 [ONBOARDING.md](ONBOARDING.md)。

---

## 2. 分支模型

```
main                                  ← 集成分支，始终保持"能跑"。受保护：不允许直接 push
 ├─ dev/double-s846                   ← 负责人（公共层 + 模块 E 朗读 + 集成 + 演示）
 ├─ dev/Selena14111-b                 ← Selena       · 模块 B 查词与生词本
 ├─ dev/jz-Gong10-c                   ← 宫霁祯        · 模块 C 复习与日历
 └─ dev/zouyujing20070207-d           ← zouyujing    · 模块 D 长句解析增强
```

**分支与模块已经固定，不再变更。** 每人的交付清单见 [ONBOARDING.md](ONBOARDING.md)。
D 的规则层由负责人先行完成（避免卡住基础功能点），接手人做增强 —— 分工表里如实写成两段。

**规则**

1. **一人一分支**，长期存在，不要每天新建，也不要改名（改名会让 PR 记录断开）。
2. 所有改动先提交到自己的 `dev/...`，再开 PR 合入 `main`；**不允许**直接往 `main` push。
3. `main` 必须始终能跑：PR 合并前至少自测 `npm run lint && npm run typecheck && npm test && npm run build`。
4. **禁止 force push `main`**；个人分支允许 `--force-with-lease`（只用于整理自己未合并的提交）。
5. **合并方式全组统一为 Merge commit**（不用 Squash）：Squash 会把一个人的 N 个提交压成 1 个，
   `git shortlog` 就统计不出工作量，分工证据直接失效。
6. **不允许在自己的分支里改 `src/features/reader/Reader.tsx`**：那是三个模块的交汇点，
   已改成装饰层插槽（`decorations`），通过 `src/App.tsx` 装配。需要新插槽就提，由公共层加。
7. **分支必须从最新的 `origin/main` 拉**：`main` 已包含插槽重构与长句解析，
   从旧提交拉分支会导致 `Reader.tsx` 的 props 对不上、编译报错。

**为什么这样分**：GitHub 的 PR 页面会自动统计「这个 PR 由谁提交、改了多少文件、涉及哪些目录」，
评审打开 PR 列表就能看到四个人的四条 PR，比看 `git log` 直观得多，也比任何"分工说明"可信。

**时间红线**（错过就降级，不讨价还价）：11/23 模块各自跑通 → 11/26 全部合进 main →
11/29 功能冻结只修 bug。详见 [TEAM.md §5](TEAM.md#5-时间表截止-2026-12-06-提交)。

---

## 3. 已发生的提交明细（地基，double-s846）

| # | 提交 | 日期 | 类型 | 内容 | 文件数 / 行数 |
|---|---|---|---|---|---|
| 1 | `538704d` | 11-17 | chore | 初始化仓库与工程配置（Vite 8 + React 19 + TS 5.9、ESLint、tsconfig、MIT） | 14 / +3180 |
| 2 | `933147a` | 11-17 | feat(core) | 领域契约、存储层、切段切句切词、查词三级降级、SRS、示例文章与离线词表 | 11 / +1383 |
| 3 | `ad53a27` | 11-17 | feat(app) | 阅读器外壳、双模式、查词气泡、导入、生词本、设置与备份、模块交接 README | 15 / +2323 |
| 4 | `a2a076a` | 11-17 | docs | README、TEAM、PRODUCT、ARCHITECTURE、AI_USAGE、THIRD_PARTY_LICENSES | 6 / +957 |
| 5 | `b38f680` | 11-17 | test(core) | 20 个纯函数单元测试 + 修正词形还原候选链 | 5 / +317 −38 |
| 6 | `099b999` | 11-17 | docs | 测试说明、AI 记录修正、路线图更新 | 4 / +45 −12 |
| 7 | `ecee3a2` | 11-17 | docs | 一人一分支模型：CONTRIBUTION、PR 模板、TEAM 分支策略、README 分工表 | 4 / +237 −13 |
| 8 | *(本次)* | 11-17 | refactor(reader) | 阅读器装饰层插槽重构：抽出 `ReaderDecorations`，`WordHit` 上移契约，解耦 features/vocab | — |
| 9 | *(本次)* | 11-17 | docs | 成员与占位分支、时间红线、进阶功能取舍、插槽使用说明 | — |

> 第 8、9 条的具体 hash 以 `git log --oneline` 为准（本文件随分支一起提交，无法自引自身的 hash）。

**范围对应关系**（评审可按目录核对）：

| 目录 / 文件 | 归属 |
|---|---|
| `package.json`、`tsconfig*.json`、`vite.config.ts`、`eslint.config.js` | double-s846 |
| `src/types.ts`、`src/lib/**`、`src/data/**` | double-s846（**公共层，改动需全组同意**） |
| `src/features/reader/**`、`library/**`、`settings/**` | double-s846 |
| `src/features/vocab/**` | double-s846 搭基线 → **模块 B 扩展** |
| `src/features/review/**` | **模块 C**：jz-Gong10 实现复习面板与日历热力图 |
| `src/features/parse/**` | double-s846 搭契约与面板 → **模块 D 实现解析** |
| `src/features/tts/**` | **模块 E**（当前仅 README） |
| `tests/**`、`docs/**`、`README.md` | double-s846 起草 → 各成员补充自己模块的部分 |

---

## 4. 评审怎么复核（三条命令）

任何人都可以在本地跑，不需要权限：

```bash
# ① 每人提交了多少次、改了多少行
git shortlog -sne --all

# ② 某个成员的具体提交
git log --author="<github-id>" --oneline --stat

# ③ 某个模块目录是谁在改（分工与目录是否对得上）
git log --oneline -- src/features/review
```

GitHub 网页上还可以看：

- **Insights → Contributors**：各成员提交数与改动量；
- **Pull requests（已合并）**：每条 PR 的作者、文件清单、审查记录；
- **Network / Branches**：个人分支的存在与提交进度。

---

## 5. 提交信息规范（与模块对应，便于统计）

```
feat(vocab): 生词卡支持按文章筛选
fix(parse): 修正 that 从句在插入语后的切分
test(core): 补 storage 导出导入的用例
docs(review): 说明复习队列的评分规则
refactor(storage): 抽出 progressStore.get
```

括号里的 scope 必须用模块名：`core` / `reader` / `library` / `vocab` / `review` / `parse` / `tts` / `settings` / `docs`。
这样 `git log --grep="(review)"` 就能一条命令导出模块 C 的全部提交，写分工表时不用回忆。

---

## 6. 每条 PR 必须写清的三件事

见 [`.github/PULL_REQUEST_TEMPLATE.md`](../.github/PULL_REQUEST_TEMPLATE.md)：

1. **做了什么**（对应哪个模块、哪个赛题功能点）；
2. **怎么验证的**（自测命令 + 手工操作步骤）；
3. **是否用了 AI**（用了什么、产出哪些文件、人工改了什么 —— 同步写进 `docs/AI_USAGE.md`）。

第 3 条是硬要求：AI 使用透明化占 20 分，PR 记录是最难篡改的证据。

---

## 7. 待办

- [x] 补全成员与 GitHub 账号（4 人已登记）；
- [x] 全组统一合并方式：**Merge commit**（见 §2 规则 5）；
- [ ] 认领模块后，把 `<模块>` 占位改成 `b` / `c` / `e`，并把提交数从 0 开始更新；
- [ ] 每位成员第一次提交后，把提交范围补进 §3 的表格；
- [ ] 演示视频录制前，跑一次 §4 的三条命令，把输出存进 `docs/_evidence/`（可选，加分）。
