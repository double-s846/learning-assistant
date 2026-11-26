# 模块 D 接入与验收

实现：ClauseMarks 正文标注、保守接触从句、显式并列关系从句、200 条 LRU 内存缓存。
未实现可选 LLM。未修改 App.tsx / Reader.tsx。

## 由公共层负责人接入

在 App.tsx 导入：
```tsx
import { ClauseMarks } from '@/features/parse/ClauseMarks'
```
在已有 decorations 返回对象中新增（原有属性保留）：
```tsx
renderSentenceOverlay: (sentence) =>
  settings.mode === 'study' ? <ClauseMarks sentence={sentence} /> : null,
```
现有 useMemo 依赖已包含 settings.mode。

正文用 CSS Custom Highlight API：从句紫色、修饰语绿色。浏览器不支持时保留面板分析，无正文标注；不复制文本、不拦截点击。其他 overlay 引入额外文本造成偏移不一致时主动跳过。尚未进行浏览器视觉验收。

## 检查

```sh
npm run lint
npm run typecheck
npm test
node --test src/features/parse/enhancements.test.mjs
npm run build
```

接入后人工验证：学习模式中点词、点句、长句换行、切换文章、三种主题、调整字号和行距；流畅模式移除标注。

局限：接触从句仅覆盖限定词 + 单个名词 + 人称代词 + 已知及物动词；不确定的词形不猜测。并列关系从句要求重复关系词。规则分析并非完整语法树。
