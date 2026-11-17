# 模块 D · 长句解析

> 这是四个模块里**最难**的一个。请按"先能跑、再变好"的顺序做，不要一开始就追求完美。

## 目标

点一个长句，告诉学生：**主干是什么、从句在哪、修饰语修饰谁、中文怎么翻。**

## 已提供

- `ParsePanel.tsx`：面板 UI 已就绪，链路已通（阅读区点句子 → 拿到 `sentenceId` + 句子原文）；
- 契约 `SentenceParse` / `ClauseSegment`（`src/types.ts`）；
- `ROLE_LABEL`：成分角色的中文名映射；
- 切句工具 `splitSentences()`，切词 `tokenizeWords()`（都带字符区间）。

你只需要替换 `ParsePanel.tsx` 里的 `analyzeSentence()`。

## 实现路线（由易到难，每步都能交付）

### 第 1 步：规则层（离线，必须完成）

1. **标记连词**：`that / which / who / whom / whose / when / where / why / because / although / though / while / if / unless / since / as / after / before / so that / such that / even though / in order that`
2. **切从句**：从连词位置到句子结束（或到下一个并列连词 `and / but / or`）作为候选从句区间；
3. **介词短语修饰语**：`(in|on|at|of|for|with|by|from|to|about|into|over|under|between|among|during|despite) + (the|a|an|this|that|these|those|his|her|its|their|our|my) + 名词`；
4. **主干抽取**：去掉上面两类区间后剩下的部分就是主干；找不到动词就标记为 `unknown` 并明说"未能识别"；
5. **中文讲解**：模板化生成，例如
   - `that 引导宾语从句，作 warns 的宾语`
   - `which 引导非限制性定语从句，补充说明 the report`
   - `in recent years 为时间状语，修饰整个主句`

### 第 2 步：可选的定语从句识别

`which/who` 前面有逗号 → 非限制性定语从句（讲解里要说明"补充说明，可去掉不影响主干"）。

### 第 3 步（可选）：大模型增强

- 只在 `.env.local` 里配了 `VITE_LLM_*` 时才走网络；
- **请求失败、超时、返回格式不对 → 必须静默回落到规则层结果**；
- 返回结果的 `source` 字段填 `'llm'`，面板上会显示"大模型增强"标签 —— 这是透明度要求；
- 注意隐私：如果要把用户文章发给第三方模型，必须在界面或文档中告知用户。

## 契约

```ts
interface SentenceParse {
  sentenceId: string
  text: string
  source: 'rule' | 'llm'      // 必填，界面会展示
  backbone: string             // 主干
  translationZh?: string       // 整句中文（可选）
  depth: 0 | 1 | 2             // 结构层级
  segments: ClauseSegment[]    // start/end 是句子文本内的字符偏移
  tips?: string[]              // 学习提示
}

interface ClauseSegment {
  start: number; end: number; text: string
  role: ClauseRole             // main / attributive-clause / adverbial / …
  noteZh: string               // 一句话讲清这里在干什么
}
```

## 验收标准

- [ ] 断网状态下点句子也能出解析结果（规则层不依赖网络）；
- [ ] 主干不是整句（否则等于没解析）；
- [ ] 每个 `segment` 的 `start/end` 能精确框住对应文字；
- [ ] 解析不出来的句子显示"未能解析"，**不编造**结构；
- [ ] 面板上正确显示 `source`（离线规则 / 大模型增强）。

## 不要做

- 不要为了"看起来聪明"硬造从句结构 —— 宁可显示"未识别"；
- 不要把解析结果写进文章正文（`Article.paragraphs` 不可变，解析是独立的一层）；
- 不要在前端硬编码 LLM 的 API key（`VITE_` 变量会被打包公开）。

## 建议的演示句（内置示例里已经有）

`The companies that understand this best have therefore stopped trying to expand the total pool of attention and started competing instead on the quality of the minutes they obtain, which is a far more difficult thing to measure and an even more difficult thing to defend.`

这句里有限制性定语从句 `that understand this best`、并列谓语、以及 `which` 引导的非限制性定语从句 —— 解析出来会很有说服力。
