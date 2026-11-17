# 模块 C · 复习队列与日历

## 目标

把"查过的词"变成"记住的词"。这是留存的关键，也是赛题明确要求的基础功能。

## 已提供（算法全部写好了，你只写 UI）

`src/lib/srs.ts`：

| 函数 | 作用 |
|---|---|
| `buildReviewQueue(entries, now?)` | 今日待复习队列，按到期时间排序 |
| `reviewEntry(entry, grade, now?)` | 应用一次评分，返回新的生词卡（纯函数） |
| `scheduleNext()` | 底层：算新盒子与下次到期时间 |
| `isDue(entry)` | 是否到期 |
| `monthGrid(year, month)` | 生成 42 格（6×7）的月历网格，含前后补齐 |
| `reviewCountByDay(entries)` | 每天复习次数，用于热力格上色 |
| `addedCountByDay(entries)` | 每天新增生词数 |
| `dayKey(date)` | 本地时区 YYYY-MM-DD（**别自己写**） |
| `countMastered(entries)` | 已掌握（盒子 5）数量 |
| `GRADE_LABEL` | 三档评分的中文名 |

间隔规则：盒 0→1→2→4→8→16 天；`again` 退回盒 0，`good` 前进一盒，`easy` 前进两盒。

## 你要做的

1. **复习面板** `ReviewPanel.tsx`
   - 顶部：今日待复习 N 张、已掌握 M 张、每日目标完成度（`Settings.dailyGoal`）；
   - 卡片：正面只显示单词（先回想），点一下翻面显示释义 + 原句；
   - 三个按钮：没记住 / 记得 / 很简单 → `vocabStore.upsert(reviewEntry(entry, grade))`；
   - 队列走完显示"今日完成，明天再来"。
2. **日历热力图** `CalendarHeatmap.tsx`
   - `monthGrid()` 生成格子，`reviewCountByDay()` + `addedCountByDay()` 上色；
   - 鼠标悬停显示"11-20：复习 8 张，新增 3 词"；
   - 点击某天 → 筛选那天的记录。
3. **入口**：在 `src/App.tsx` 顶栏加一个「复习」按钮（认领后我会配合改，避免冲突）。

## 验收标准

- [ ] 新加的生词当天就出现在复习队列里；
- [ ] 点"记得"后，该卡的 `box` +1、`dueAt` 变成 1 天后（可在生词本里看到"盒子 1"）；
- [ ] 点"没记住"后，`box` 回到 0；
- [ ] 日历格子的颜色深浅与当天复习次数对应；
- [ ] 刷新页面后队列和日历不变（数据来自 storage）。

## 不要做

- 不要自己实现日期加减（一定用 `srs.ts` 的 `addDays` / `dayKey`）；
- 不要用 `toISOString().slice(0,10)` 当日历 key（东八区凌晨会算错天）；
- 不要把复习历史从 `VocabEntry.reviews` 里删掉（日历统计依赖它）。
