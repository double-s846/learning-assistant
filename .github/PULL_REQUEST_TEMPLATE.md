# Pull Request 说明

<!--
  提交 PR 前请把下面每一节填完。
  这份模板同时是「分工证据」和「AI 使用透明化」的载体，请不要留空。
-->

## 1. 这个 PR 做了什么

- 对应模块：<!-- core / reader / library / vocab / review / parse / tts / settings / docs -->
- 对应赛题功能点：<!-- 例如：生词卡日历与复习提醒（基础功能第 5 项） -->
- 主要改动：
  - 
  - 

## 2. 怎么验证的

**自动检查**（本地已执行，全部通过）：

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`

**手工操作步骤**（让 reviewer 能照着点一遍）：

1. 
2. 
3. 

**截图 / 录屏**（有界面改动时贴一张）：

## 3. AI 使用情况（必填）

- 是否使用 AI 辅助：<!-- 是 / 否 -->
- 使用的工具：<!-- 例如 DeepSeek Harness / ChatGPT / Copilot -->
- 产出文件：
  - 
- **人工做的实质性修改**（改了什么、为什么改）：
  - 
- [ ] 已在 `docs/AI_USAGE.md` 追加对应记录

## 4. 是否影响他人

- [ ] 修改了 `src/types.ts`（数据契约）
- [ ] 修改了 `src/lib/**`（公共逻辑）
- [ ] 新增了第三方依赖（需同步更新 `docs/THIRD_PARTY_LICENSES.md`）
- [ ] 以上都没有

> 勾选了前三项中任意一项的，合并前必须在群里说一声，让其他人 `git pull --rebase`。

## 5. 自检

- [ ] 只改动了自己模块目录（`src/features/<模块>/`）以及必要的文档
- [ ] 没有提交 `node_modules/`、`dist/`、`.env` 或真实密钥
- [ ] 提交信息符合 `feat(scope): 说明` 格式
- [ ] 没有为了"过检查"而注释掉类型或加 `any`
