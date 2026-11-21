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

## 6. 长句解析：离线规则层

`src/lib/clause.ts` —— **纯函数，零网络，可在 Node 里单测**（`tests/clause.test.mjs`）。

```
analyzeSentence(text, { sentenceId })
   ├─ ① 扫描连词，判定从句起点与角色
   │     which/who/whom/whose        → 定语从句
   │     because/although/while/…    → 状语从句
   │     that（按前一个词判定）        → 报告类动词→宾语从句；抽象名词→同位语；其余→定语
   ├─ ② 从句终点：下一个连词 / 冒号分号 / 逗号（已成形）/ 定语从句遇到助动词
   ├─ ③ 介词短语修饰语：介词 + ≤6 词，遇标点·助动词·连词·并列·代词即止
   ├─ ④ 主干 = 原文挖掉 kind='clause' 的区间（介词短语保留，否则读不通）
   └─ ⑤ 无可切分 → 提示"可能是简单句"，面板标「未能切分」，不伪造结构
```

**几个非显然的判定**（写下来是因为它们决定了解析质量）：

| 判定 | 为什么必须这么写 |
|---|---|
| 定语从句遇到**助动词**就断 | `The companies that understand this best \| have therefore stopped…`：`have` 才是外层谓语，不在这里断，从句会吞掉整个后半句 |
| 助动词**链**不重复断 | `which had been laid out` 的 `been` 属于同一个助动词链，断了就只剩 `which had` |
| 主干**保留**介词短语 | 早期版本把介词短语也挖掉，得到 `the trees were not distributed neighbourhood` —— 主干读不通就毫无价值 |
| 挖除时吞掉两侧逗号 | 否则 `Older streets, which…, happened…` 会剩成 `Older streets, happened…`，看起来像缺谓语 |
| `kind: 'clause' \| 'modifier'` | 一个字段同时决定「是否从主干剔除」和「界面配色」，避免两处逻辑走偏 |

**已知局限**（也写在 `src/features/parse/README.md`）：省略 that 的接触从句识别不出；
`that` 的歧义靠词表判定，生僻动词会误判；并列从句只标第一个。

---

## 7. 性能与可访问性

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

## 8. 已知限制（如实记录）

| 限制 | 原因 | 后续 |
|---|---|---|
| 有道/百度接口未真正实现 | 二者都需要签名，签名密钥**不能放在前端**（`VITE_` 变量会被打进 bundle 公开）。要支持必须在赛题范围外引入服务端代理 | 保留 `fromPaidApi()` 钩子与 `.env.example` 声明 |
| URL 自动抓取未实现 | 跨域限制 + 外刊付费墙 | 赛后可选：自建代理或浏览器插件 |
| 查词按**单词**粒度，不是划词短语 | 短语查询需要分词/短语词典，超出范围 | 可在模块 B 扩展"选中短语 → 整句翻译" |
| 无自动化测试 | ~~已解决~~ | 现有 44 例，见 §9 |
| TTS 音色跨设备不通用 | 音色列表由浏览器/系统提供 | 只存 `ttsVoice` 名称，取不到时回落到默认音色 |
| **分层倒挂**：`lib/article.ts` 依赖 `features/library/pdf-pages` | PDF 导入由模块 C 引入，切片工具放在了 feature 目录，`lib` 反过来 import 了它 | 应把 `pdf-pages.ts` 下沉到 `lib/`；时间成本 > 收益，暂记为技术债 |
| **备份接口改为异步**：`exportSnapshot` / `importSnapshot` / `clearAll` 返回 Promise | PDF 原文件存在 IndexedDB，导出/导入要读写 Blob，无法同步完成 | 所有调用方必须 `await`，新增调用点时注意 |
| `SCHEMA_VERSION` 由 1 升到 2 | 新增可选字段 `pdf` / `pdfFigure`；旧 v1 备份无需迁移（字段可选） | 导入旧备份仍兼容 |
| PDF 导入依赖 `pdfjs-dist`（Apache-2.0，按需动态加载） | 运行时依赖从 2 个变成 3 个，主 bundle 不变 | 许可证登记见 `THIRD_PARTY_LICENSES.md`；若评审质疑体积，说明是懒加载 |

---

## 9. 测试策略

已落地 **44 个用例**，运行方式 `npm test`（Node 内置 `node:test` + 原生 TypeScript 类型擦除，
**不引入任何测试框架**）：

| 测试文件 | 用例数 | 覆盖 |
|---|---|---|
| `tests/tokenize.test.mjs` | 12 | 切段 / 切句 / 切词 / 词形还原 |
| `tests/srs.test.mjs` | 9 | 间隔重复、日历聚合、本地时区 |
| `tests/clause.test.mjs` | 8 | 长句解析：从句切分、主干抽取、区间一致 |
| `tests/pdf-text.test.mjs` | 5 | PDF 双栏顺序、断行修复、中文换行 |
| `tests/pdf-figures.test.mjs` | 6 | PDF 图片区域识别、剪裁边界、整页扫描件去重 |
| `tests/pdf-pages.test.mjs` | 2 | 页码 / 图片标记切分 |
| `tests/translate.test.mjs` | 2 | 翻译降级（失败返回 null） |

选这些用例的原则：**只测"错了也很难在界面上看出来"的纯函数。**

| 被测点 | 为什么必须测 |
|---|---|
| `splitSentences()`：缩写（Mr./e.g./a.m.）、小数（3.14）、引号收尾、连续标点 | 切错一句不会报错，只会让高亮和「点句解析」错位 |
| 字符区间能否精确还原原文（`text.slice(start,end) === text`） | 这是整条标注链路的地基 |
| `lemmaCandidates()`：ies/ed/ing/双写辅音 | 还原错了会归错卡片、查不到词 |
| `scheduleNext()`：盒 0 与盒 5 边界 | 越界后复习间隔会算成负数或 NaN |
| `dayKey()`：本地时区跨天 | 用 `toISOString().slice(0,10)` 在东八区凌晨会算到前一天 |
| `analyzeSentence()`：从句区间与原文一致、成分不重叠、主干 ≠ 整句 | 解析错了界面照样显示得"很像那么回事"，比崩溃更危险 |

待补（需要先打桩，优先级较低）：

- `storage.importSnapshot()`：非法 JSON、版本过高、字段缺失 —— 需要 `localStorage` 打桩；
- `dict.lookup()` 的降级顺序 —— 需要 `fetch` 打桩。
