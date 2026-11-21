# 模块 B · 查词与生词本

## 目标

让"点词 → 理解 → 沉淀 → 再见到"这条链路完整且顺手。

## 已提供（可直接用，不用重写）

| 文件 | 内容 |
|---|---|
| `src/lib/dict.ts` | `lookup(word)` 离线词库、免费英文词典与中文机器翻译降级；`DICT_SOURCE_LABEL` 来源中文名 |
| `src/lib/storage.ts` | `vocabStore.all() / upsert() / removeById() / subscribe()` |
| `src/lib/hooks.ts` | `useVocab()` 拿数据并自动订阅变化 |
| `src/lib/article.ts` | `findSentence()` / `countOccurrences()`（该词在本文出现几次） |
| `WordPopover.tsx` | 点词气泡：已实现查词、手动补释义、加入生词本 |
| `VocabDrawer.tsx` | 生词本抽屉基础版：列表 / 释义 / 原句 / 来源 / 删除 / 回到原文 |

## 你要做的（按优先级）

1. **搜索与筛选**：按单词、按文章、按复习盒子、按标签筛选；输入即过滤。
2. **标签系统**：给生词打标签（考研 / TOEFL / 学术写作），写入 `VocabEntry.tags`。
3. **批量操作**：多选删除、批量改标签。
4. **导出 CSV**：`word,lemma,pos,glossZh,source,article,createdAt,box`，用 `Blob` 下载。
5. **语境提示增强**：在卡片上用 `countOccurrences()` 显示"本文出现 3 次"。
6. （可选）**整句翻译入口**：选一句话 → 调免费翻译接口 → 显示在气泡下方，失败要静默。

## 契约

```ts
interface VocabEntry {
  id, word, lemma, phonetic?, pos?
  glossZh: string          // 必需
  glossEn?: string
  glossSource: DictSource  // 必需，且必须显示在 UI 上
  context: { articleId, articleTitle, paragraphId, sentenceId, sentence }
  createdAt, box, dueAt, reviews
  tags?: string[]
}
```

## 验收标准

- [ ] 生词本里能搜索、能按文章筛选、能导出 CSV；
- [ ] 删除一张卡后，阅读区的下划线**立刻消失**（走订阅，不刷新页面）；
- [ ] 每张卡都显示释义来源；
- [ ] `npm run lint && npm run typecheck && npm run build` 全绿。

## 不要做

- 不要改 `lib/dict.ts` 的降级顺序（本地 → 免费 → 付费 → 手填）；
- 不要在组件里直接 `localStorage.setItem`；
- 不要引入 UI 组件库。
