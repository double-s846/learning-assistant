# 分支合并适配指南（MERGE-NOTES.md）

> 写给**已经从旧 main 拉了分支**的人：合并最新 main 之后，有 3 处必须改，否则编译不过。
> 如果你的分支是从最新 `origin/main` 拉的，这份文档可以跳过。

---

## 为什么会有这个文件

`main` 在 11-21 之后合入了两批重要改动：

1. **阅读器装饰层插槽重构**（`Reader.tsx` 的 props 全变了）
2. **长句解析规则层**（`ParsePanel` 多了一个必填 prop）

任何从 `2621897` 或更早提交拉出来的分支，合并 main 后都会在这两处报类型错误。
**这不是合并失败，是接口升级的预期结果。**

---

## 一、`Reader` 的 props 变化

| 旧（2621897 及更早） | 新（main） | 怎么改 |
|---|---|---|
| `vocab={vocab}` | 删掉 | 生词下划线改由 `decorations.wordClassName` 提供 |
| `onSentenceClick={(sentenceId, text) => …}` | `onSentenceClick={(sentence) => …}` | 回调参数变成整个 `Sentence` 对象，用 `sentence.id` / `sentence.text` |
| —（无） | `decorations={…}` | 新增，见下 |
| —（无） | `sentenceClickable={settings.mode === 'study'}` | 新增，流畅模式下不可点句 |
| `onWordClick(payload, event)` | `onWordClick(hit, event)` | `payload` 改名为 `WordHit`（字段相同，在 `types.ts`） |

`decorations` 最小写法（生词下划线 + 解析焦点句）：

```tsx
const decorations = useMemo<ReaderDecorations>(() => {
  const savedLemmas = new Set(vocab.map((v) => v.lemma))
  const focusedSentenceId = parseTarget?.sentenceId
  return {
    wordClassName: (word) =>
      settings.mode === 'study' && savedLemmas.has(word.toLowerCase()) ? 'w--saved' : undefined,
    sentenceClassName: (sentence) =>
      sentence.id === focusedSentenceId ? 'sent--focus' : undefined,
  }
}, [vocab, settings.mode, parseTarget])
```

```tsx
<Reader
  article={article}
  settings={settings}
  decorations={decorations}
  readParagraphIds={progress?.readParagraphIds ?? []}
  sentenceClickable={settings.mode === 'study'}
  onWordClick={handleWordClick}
  onToggleParagraph={toggleParagraph}
  onSentenceClick={(sentence) => setParseTarget({ sentenceId: sentence.id, text: sentence.text })}
/>
```

**为什么不能再传 `vocab`**：旧实现让 `Reader` 直接 import 了 `features/vocab` 的 `WordSelection`，
形成了 `reader → vocab` 的反向依赖。重构后双方都只依赖 `types.ts` 的 `WordHit`。
这样 B / D / E 三个模块都不用改 `Reader.tsx`（详见 `src/features/reader/README.md`）。

---

## 二、`ParsePanel` 多了一个必填 prop

```tsx
// 旧
<ParsePanel open={parseTarget !== null} sentence={parseTarget?.text ?? ''} onClose={…} />

// 新
<ParsePanel
  open={parseTarget !== null}
  sentenceId={parseTarget?.sentenceId ?? ''}
  sentence={parseTarget?.text ?? ''}
  onClose={…}
/>
```

`sentenceId` 现在直接来自 `Sentence.id`（确定性生成，刷新后不变），解析结果与真实句子对得上。

---

## 三、自己模块里的写法变化

| 场景 | 改法 |
|---|---|
| 想在正文里标"当前朗读句" | 在 `decorations.sentenceClassName` 里返回 class，**不要改 `Reader.tsx`** |
| 想拿某句的 DOM 节点（自动滚动） | `document.querySelector('[data-sentence-id="…"]')`，这个属性已经加好了 |
| 想在正文里画成分标注 | 用 `decorations.renderSentenceOverlay`，见 `src/features/parse/README.md` |
| 需要新的插槽 | 在群里提，由公共层加，别在自己的分支改 `Reader.tsx` |

---

## 四、合并命令（在你的分支上执行）

```bash
git fetch origin
git switch dev/<你的分支>
git merge origin/main          # 别用 rebase，避免把已推送的历史改写
# 解决上面 3 处冲突/编译错误
npm run lint && npm run typecheck && npm test && npm run build
git push
```

报错对照：

| 编译错误 | 原因 | 处理 |
|---|---|---|
| `Property 'vocab' does not exist on type 'Props'` | Reader props 变了 | 删掉 `vocab`，改用 `decorations` |
| `Property 'sentenceId' is missing` | ParsePanel 新增必填 prop | 补 `sentenceId={…}` |
| `Argument of type '(sentenceId: any, text: any) => void' is not assignable` | 回调签名变了 | 改成 `(sentence) => …` |
| `Cannot find name 'WordHit'` | 类型位置变了 | 从 `@/types` 导入 |

---

## 五、这次踩到的流程问题（记录下来，别再发生）

**根因：功能分支没合进 `main` 就开始并行开发。**
`dev/double-s846` 上的插槽重构与长句解析只在分支里，没进 `main`，其他人从 `main` 拉分支，
自然拿到旧接口，各自在旧 `App.tsx` 上改，合并时才集中爆发。

**以后的规矩**：

1. 公共层（`types.ts` / `lib/` / `Reader.tsx` / `App.tsx`）的改动，**当天合进 `main`**，不隔夜；
2. 任何人开始写代码前先跑一次 `git pull origin main`，编译不过就先解决，别带着旧接口写；
3. 公共层改动在群里说一句"我改了 X，接口变化是 Y"，别人合并时就有心理准备。

> 这三个错都在同一类：**把"我的分支能跑"当成"项目能跑"**。
> `main` 才是唯一标准，分支永远只是暂存区。
