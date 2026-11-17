# 分工与提交归属（CONTRIBUTION.md）

> 赛题要求「保留完整 Git 提交记录作为分工考核依据」。这份文档把**提交记录翻译成人能读的分工表**，
> 并提供评审可直接复核的命令。任何人不需要信任我们的说法，跑一行命令就能验证。

---

## 1. 一页看懂：谁做了什么

| 成员 | GitHub | 个人分支 | 提交数 | 负责范围 |
|---|---|---|---|---|
| double-s846 | [@double-s846](https://github.com/double-s846) | `dev/double-s846` | 7 | **地基与架构**：工程脚手架、数据契约、存储层、文本处理、查词降级、SRS 算法、阅读器、双模式、导入、设置与备份、单元测试、分支规范与全部文档 |
| （待填） | （待填） | `dev/<id>-b` | 0 | 模块 B · 查词与生词本扩展 |
| （待填） | （待填） | `dev/<id>-c` | 0 | 模块 C · 复习队列与日历 |
| （待填） | （待填） | `dev/<id>-d` | 0 | 模块 D · 长句解析 |
| （待填） | （待填） | `dev/<id>-e` | 0 | 模块 E · TTS 朗读跟读 |

> 当前仓库的全部历史提交 author 均为 `double-s846`，因为地基由该成员一人搭建（含并行开发所需的公共层）。
> 其他成员开始提交后，会以各自 GitHub 账号出现在提交记录中，无需额外标注。

---

## 2. 分支模型

```
main                    ← 集成分支，始终保持"能跑"。受保护：不允许直接 push 大改动
 ├─ dev/double-s846     ← double-s846 的个人分支（地基 + 后续公共层维护）
 ├─ dev/<id>-b          ← 模块 B 负责人
 ├─ dev/<id>-c          ← 模块 C 负责人
 ├─ dev/<id>-d          ← 模块 D 负责人
 └─ dev/<id>-e          ← 模块 E 负责人
```

**规则**

1. **一人一分支**，长期存在，不要每天新建。
2. 所有改动先提交到自己的 `dev/<id>-*`，再开 PR 合入 `main`；
   **不允许**直接往 `main` push（第一次由负责人手动合并的除外）。
3. `main` 必须始终能跑：PR 合并前，CI 之外至少自测 `npm run lint && npm run typecheck && npm test && npm run build`。
4. **禁止 force push `main`**；个人分支允许 `--force-with-lease`（只能用于整理自己的未合并提交）。
5. 合并方式用 **Squash and merge 或 Merge commit 二选一，全组统一**（推荐 Merge commit，保留每个成员的提交粒度，分工更清楚）。

**为什么这样分**：GitHub 的 PR 页面会自动统计「这个 PR 由谁提交、改了多少文件、涉及哪些目录」，
评审打开 PR 列表就能看到四个人的四条 PR，比看 `git log` 直观得多，也比任何"分工说明"可信。

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

**范围对应关系**（评审可按目录核对）：

| 目录 / 文件 | 归属 |
|---|---|
| `package.json`、`tsconfig*.json`、`vite.config.ts`、`eslint.config.js` | double-s846 |
| `src/types.ts`、`src/lib/**`、`src/data/**` | double-s846（**公共层，改动需全组同意**） |
| `src/features/reader/**`、`library/**`、`settings/**` | double-s846 |
| `src/features/vocab/**` | double-s846 搭基线 → **模块 B 扩展** |
| `src/features/review/**` | **模块 C**（当前仅 README 与算法依赖） |
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

- [ ] 补全上表「成员 / GitHub / 分支」三列（认领模块后填写）；
- [ ] 每位成员第一次提交后，把提交范围补进 §3 的表格；
- [ ] 全组统一合并方式（Squash 还是 Merge commit），写进本节；
- [ ] 演示视频录制前，跑一次 §4 的三条命令，把输出存进 `docs/_evidence/`（可选，加分）。
