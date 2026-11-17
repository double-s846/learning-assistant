# 技术架构（ARCHITECTURE.md）

---

## 1. 分层

```
┌────────────────────────────────────────────────────────────┐
│  features/          按业务功能切分，一人一个目录              │
│  reader · library · vocab · review · parse · tts · settings │
└───────────────┬────────────────────────────────────────────┘
                │ 只通过 lib 提供的接口读写
┌───────────────▼────────────────────────────────────────────┐
│  lib/               无 UI 的纯逻辑（可在 Node 里单测）       │
│  storage · hooks · tokenize · article · dict · srs · id     │
└───────────────┬────────────────────────────────────────────┘
                │
┌───────────────▼────────────────────────────────────────────┐
│  浏览器能力                                                  │
│  localStorage · fetch · Web Speech API · File API           │
└────────────────────────────────────────────────────────────┘
```

**依赖方向单向向下**：feature 可以 import lib，lib 绝不 import feature。
`types.ts` 位于最底层，被所有层引用，因此它是**唯一允许被多人同时修改的文件**（改前需沟通）。

---

## 2. 数据流

```
用户粘贴正文
   │
   ▼
buildArticle()            lib/article.ts
   ├─ splitParagraphs()   lib/tokenize.ts   → Paragraph[]（id 随机生成）
   ├─ estimateReadingMinutes()
   └─ Article
   │
   ▼
articlesStore.add()       lib/storage.ts  → localStorage["la:v1:articles"]
   │
   ▼  useArticles() 订阅
Reader 渲染
   ├─ getSentencesByParagraph()   句子在段落文本内的字符区间
   └─ tokenizeWords()             每句切成词/非词片段（带区间）
        │
        ├─ 点词 → lookup() → WordPopover → vocabStore.upsert()
        └─ 点句 → ParsePanel（模块 D）
```

**关键点：字符区间（start/end）是全局唯一的定位方式。**
句子、单词、解析片段、TTS 高亮全部基于同一套偏移量，因此不会出现"高亮位置和点击位置对不上"。
任何需要定位的功能，都必须复用 `lib/tokenize.ts` 的结果，不允许自己再切一次文本。

---

## 3. 存储设计

| key | 类型 | 说明 |
|---|---|---|
| `la:v1:articles` | `Article[]` | 文章与段落 |
| `la:v1:vocab` | `VocabEntry[]` | 生词卡（含复习历史，所以卡片本身是自增的） |
| `la:v1:progress` | `ReadingProgress[]` | 每篇文章的段落勾选与百分比 |
| `la:v1:settings` | `Settings` | 阅读偏好 |
| `la:v1:seeded` | `boolean` | 是否已灌入示例文章 |

**设计取舍**：

- **不做规范化关系表**：生词卡内嵌 `context` 与 `reviews`，读一张卡就能渲染，不需要 join。代价是更新一个 review 要重写整个数组 —— 在几百张卡的量级下完全可接受。
- **`schemaVersion`**：`BackupSnapshot` 带版本号，未来结构升级时写迁移函数，导入旧备份能识别不兼容。
- **失败降级**：所有读写都 try/catch。隐私模式或配额满时，`write()` 返回 `false` 并打印可读告警，页面不崩溃。

---

## 4. 查词：三级降级

```
lookup(word)
  ├─ ① glossary[word] ?? glossary[guessLemma(word)]   命中 → 立即返回（source: 'local'）
  ├─ ② GET dictionaryapi.dev/api/v2/entries/en/{lemma}  3.5s 超时，AbortController
  ├─ ③ 有道 / 百度（.env 有 key 才尝试）                默认返回 null（见"已知限制"）
  └─ ④ 全空 → glossZh='' source='manual'，UI 引导手填
```

- 结果在内存 `Map` 里缓存，同词不重复请求；
- ② 是**免费、无需 key、开放 CORS** 的公共接口，因此评委环境即使没有我们任何配置也能用；
- `source` 字段被强制展示在 UI 上，属于"外部依赖透明化"的一部分。

`guessLemma()` 是**极简规则还原**（ies→y、ed/ing 去尾、s 去尾），不是完整 NLP。
它的作用是让 `deteriorating` 能落到 `deteriorate` 命中词表；命中不了就原样交给 ②，不会假装成功。

---

## 5. 间隔重复（SRS）

Leitner 六盒模型，不是 SM-2：

| 盒子 | 0 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| 间隔（天） | 当天 | 1 | 2 | 4 | 8 | 16 |

- `again` → 回到盒 0（当天重现）
- `good` → 前进一盒
- `easy` → 前进两盒

**为什么不用 SM-2**：SM-2 需要用户给 0–5 的难度自评，参数不直观、演示时解释成本高；
Leitner 三个按钮就能讲明白，评委 10 秒理解，而正确性对学习效果影响不大。

所有日期运算集中在 `lib/srs.ts`，且用**本地时区**生成 `YYYY-MM-DD`（`dayKey()`）。
**不要用 `toISOString().slice(0,10)` 当日历 key** —— 在东八区凌晨会算到前一天，是经典 bug。

---

## 6. 性能与可访问性

**性能**

- 句子切分结果用 `Map` 缓存（key 含文章 id 与段落数），渲染时不重算；
- 段落组件不做虚拟滚动：单篇外刊通常 5–15 段，DOM 量级 < 2000 节点，无需虚拟化；
- 构建产物：JS ≈ 262 KB（gzip 85 KB），CSS ≈ 11.6 KB（gzip 3.2 KB），无第三方 UI 库。

**可访问性**

- 切换按钮用 `aria-pressed`，弹层用 `role="dialog"` + `aria-modal`，Esc 关闭；
- 焦点样式用 `:focus-visible`，鼠标用户不受打扰；
- 尊重 `prefers-reduced-motion`，关闭所有过渡动画；
- 段落勾选用真 `<button>`，可键盘操作。

---

## 7. 已知限制（如实记录）

| 限制 | 原因 | 后续 |
|---|---|---|
| 有道/百度接口未真正实现 | 二者都需要签名，签名密钥**不能放在前端**（`VITE_` 变量会被打进 bundle 公开）。要支持必须在赛题范围外引入服务端代理 | 保留 `fromPaidApi()` 钩子与 `.env.example` 声明 |
| URL 自动抓取未实现 | 跨域限制 + 外刊付费墙 | 赛后可选：自建代理或浏览器插件 |
| 查词按**单词**粒度，不是划词短语 | 短语查询需要分词/短语词典，超出范围 | 可在模块 B 扩展"选中短语 → 整句翻译" |
| 无自动化测试 | 时间优先给功能闭环 | 路线图已列：`node:test` 覆盖 tokenize / srs / storage |
| TTS 音色跨设备不通用 | 音色列表由浏览器/系统提供 | 只存 `ttsVoice` 名称，取不到时回落到默认音色 |

---

## 8. 测试策略（规划中）

优先级从高到低，因为这些函数的**边界条件最容易被忽略**：

1. `tokenize.splitSentences()`：缩写（Mr./e.g.）、小数（3.14）、引号收尾、连续标点；
2. `tokenize.guessLemma()`：ies/ed/ing 的三类正则分支；
3. `srs.scheduleNext()`：三档评分在盒 0 与盒 5 边界的进退；
4. `srs.dayKey()`：本地时区跨天（用固定 `TZ=Asia/Shanghai` 跑）；
5. `storage.importSnapshot()`：非法 JSON、版本过高、字段缺失。

运行方式（待接入）：`node --test`，无需额外测试框架。
