# 模块 · 阅读器（Reader）

> 这个目录是**公共层**，由负责架构的成员维护。其他模块**不要修改** `Reader.tsx`。

## 为什么不能改

`Reader.tsx` 是三个模块的交汇点：

| 模块 | 想在这里做什么 |
|---|---|
| B 生词本 | 给已存的词加下划线 |
| D 长句解析 | 给句子加成分标注、把某句标为焦点 |
| E 朗读跟读 | 给"当前正在朗读的句子"加高亮、自动滚动 |

三个人同时改同一段 JSX，等于制造一道手工无法合并的冲突。所以阅读器改成
**"只渲染正文 + 装饰层插槽"**：所有"在这一句/这个词上加点什么"的需求都通过
`decorations` 传进来，谁都不用碰这个文件。

## 插槽 API

```ts
interface ReaderDecorations {
  /** 句子级 class（TTS 当前句、解析焦点句） */
  sentenceClassName?: (sentence: Sentence) => string | undefined

  /** 单词级 class（生词下划线、词频标记）；word 是原始词形，未小写化 */
  wordClassName?: (word: string, sentence: Sentence) => string | undefined

  /** 句子内部的额外渲染，渲染在句子文本之前（成分下划线、朗读进度点） */
  renderSentenceOverlay?: (sentence: Sentence) => ReactNode

  /** 段落尾部追加内容（阅读时长、笔记入口） */
  renderParagraphExtra?: (paragraph: Paragraph) => ReactNode
}
```

其余 props：

```ts
interface Props {
  article: Article
  settings: Settings
  decorations?: ReaderDecorations        // 不传 = 纯正文
  readParagraphIds?: string[]            // 不传 = 不显示段落勾选按钮
  sentenceClickable?: boolean            // 流畅模式传 false，避免误触
  onToggleParagraph?: (paragraphId: string) => void
  onWordClick?: (hit: WordHit, event: ReactMouseEvent<HTMLSpanElement>) => void
  onSentenceClick?: (sentence: Sentence) => void
}
```

`WordHit` 定义在 `src/types.ts`（含 articleId / paragraphId / sentenceId / 原句），
所以阅读器不依赖任何 feature 模块，依赖方向保持单向。

## 各模块怎么用

**模块 B（生词下划线）** —— 已接好，见 `src/App.tsx` 的 `decorations`：

```tsx
const savedLemmas = new Set(vocab.map((v) => v.lemma))
decorations={{ wordClassName: (w) => savedLemmas.has(w.toLowerCase()) ? 'w--saved' : undefined }}
```

**模块 D（长句成分标注）**：

```tsx
decorations={{
  sentenceClassName: (s) => s.id === focusedId ? 'sent--focus' : undefined,
  renderSentenceOverlay: (s) => <ClauseMarks sentence={s} segments={parseOf(s.id)?.segments} />,
}}
```

**模块 E（朗读高亮 + 自动滚动）**：

```tsx
decorations={{
  sentenceClassName: (s) => s.id === activeSentenceId ? 'sent--speaking' : undefined,
}}
```
自动滚动建议在 `useEffect` 里按 `data-sentence-id` 查节点后
`scrollIntoView({ block: 'center' })`；如果需要一个稳定的选择器，
**在群里说一声，我加一个 `data-sentence-id` 属性**（这是公共层该做的事）。

## 现有的 CSS 钩子

| class | 含义 |
|---|---|
| `.w` | 可点单词 |
| `.w--saved` | 已加入生词本（下划线） |
| `.w--active` | 当前选中的词 |
| `.sent` | 句子容器 |
| `.sent--focus` | 句子焦点（长句解析） |
| `.para` / `.para--read` | 段落 / 已读段落 |
| `.para__check` | 段落勾选按钮 |

新增视觉状态请直接加新 class 并在 `src/styles/app.css` 追加样式（**不要在 JSX 里写行内样式**）。
