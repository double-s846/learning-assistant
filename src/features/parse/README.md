# 模块 D · 长句解析（已实现，可扩展）

> **状态：规则层已完成并通过 8 个单元测试**，由 double-s846 实现。
> 下面记录它怎么工作、已知局限、以及后续可以怎么加固 —— 交给下一个接手的人。

## 目标

点一个长句，告诉学生四件事：**主干是什么、从句在哪、修饰语修饰谁、中文怎么理解。**

## 现在有什么

| 文件 | 作用 |
|---|---|
| `src/lib/clause.ts` | **解析引擎**（纯函数，无 UI、无网络，可在 Node 里单测） |
| `src/features/parse/ParsePanel.tsx` | 面板 UI：原句按成分上色、主干高亮、成分清单、阅读提示 |
| `tests/clause.test.mjs` | 8 个用例，全部用内置示例文章里的真实长句 |

链路：阅读区点句子 → `App.tsx` 记下 `{ sentenceId, text }` → `ParsePanel` 调
`analyzeSentence(text, { sentenceId })` → 渲染；同时 `decorations.sentenceClassName`
给这一句加 `sent--focus` 底色，关掉面板也知道是哪句。

## 规则层怎么判定（面试/评审都可能问）

1. **找从句起点**：扫描连词表。
   - `which / who / whom / whose` → 定语从句
   - `because / although / though / while / unless / until / since / after / before / once / as` → 状语从句
   - `that` 有歧义，按**前一个词**判定：报告类动词（warns/argues/notes…）→ 宾语从句；
     抽象名词（fact/idea/claim…）→ 同位语从句；其余 → 定语从句
   - 句首的 `that/which` 直接跳过（更可能是限定词或疑问词）
2. **找从句终点**：下一个连词、冒号分号、逗号（从句已成形时），
   或**定语从句遇到助动词**（`The companies that understand this best | have therefore stopped…`
   里的 `have` 才是外层谓语）。助动词链（`had been`）不会误断。
3. **介词短语**：介词 + 最多 6 个词，遇标点/助动词/连词/并列连词/代词即止；
   不在冠词上截断（避免 `according to the wealth of a` 这种半截短语）。
4. **主干**：只挖掉**从句**（`kind: 'clause'`），介词短语保留 —— 否则主干会读不通。
   挖除时连带吞掉两侧空格与逗号，避免 `Older streets, happened to…` 这种残渣。
5. **诚实兜底**：一个成分都切不出来时，提示"未识别到从句，本句可能是简单句"，
   面板上标「未能切分」并说明主干是整句近似，**不伪造结构**。

## 契约

```ts
interface SentenceParse {
  sentenceId: string
  text: string
  source: 'rule' | 'llm'       // 界面会显示"离线规则分析 / 大模型增强"
  backbone: string             // 主干
  depth: 0 | 1 | 2
  segments: ClauseSegment[]    // start/end 是句内字符偏移
  tips?: string[]
}

interface ClauseSegment {
  start: number; end: number; text: string
  role: ClauseRole
  kind: 'clause' | 'modifier'  // 决定是否从主干剔除，也决定配色
  noteZh: string               // 一句话中文讲解
}
```

## 已知局限（如实记录）

| 局限 | 后果 | 怎么补 |
|---|---|---|
| 省略 that 的接触从句（the minutes they obtain） | 不单独标注 | 需要词性标注才能可靠识别，暂不做 |
| `that` 的歧义靠前一个词的词表判定 | 生僻动词会误判成定语从句 | 往 `REPORTING_VERBS` 里加词即可 |
| 并列从句只标第一个 | 第二个从句算进主干 | 按 `and/but` 再切一层 |
| 没有整句中文翻译 | `translationZh` 为空 | 见下（可选增强） |
| 介词短语最多标 2 个 | 长句修饰语标不全 | 放宽上限，注意噪音 |

## 后续可扩展（按性价比排序）

1. **接触从句识别**：`名词 + (that 省略) + 主语 + 谓语` 的模式匹配；
2. **并列从句**：`and / but` 后再跑一次起点扫描；
3. **整句翻译（可选增强）**：配置 `VITE_LLM_*` 后才启用，**失败必须静默回落到规则层**，
   界面上把 `source` 标成「大模型增强」—— 这是透明度要求；
4. **正文内联标注**：用 `renderSentenceOverlay` 把成分下划线画进正文（现在只在面板里画）。

## 验收标准（已达成）

- [x] 断网也能出解析结果（规则层零网络依赖）
- [x] 主干不等于整句（有断言）
- [x] 每个成分的 `start/end` 能精确切回原文（有断言）
- [x] 成分之间不重叠（有断言）
- [x] 解析不出来时显示"未能切分"，不编造

## 不要做

- 不要改 `Reader.tsx`（用 `decorations` 插槽）；
- 不要在规则层失败时硬造结构 —— 宁可显示"未识别"；
- 不要把 LLM 的 key 写进前端（`VITE_` 变量会被打包公开）。
