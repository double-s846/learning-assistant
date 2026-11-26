# 模块 D 接入与验收

实现：ClauseMarks 正文标注、保守接触从句、显式并列关系从句、200 条 LRU 内存缓存。
已实现可选 LLM 中文讲解与翻译增强，结构始终沿用规则结果。已按用户要求接入 App.tsx，Reader.tsx 保持不变。

## 已完成的 App 接入

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

正文用 CSS Custom Highlight API：从句紫色、修饰语绿色。浏览器不支持时保留面板分析，无正文标注；不复制文本、不拦截点击。其他 overlay 引入额外文本造成偏移不一致时主动跳过。用户启动 5180 端口后已完成核心浏览器验收，见下方记录。

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

## 2026-11-26 验收记录

- 统一 `npm test`：58 项通过（包含 D 新增 14 项）。lint、typecheck、build 通过。
- 浏览器实际验证：学习模式显示从句/修饰语标注；窄屏正文跨行标注正常；流畅模式移除标注；返回学习模式恢复标注；点词 canopy 正常打开离线词典；点标点打开长句面板；面板中文讲解与主干正常呈现；Esc 关闭；深色主题标注可读。
- LLM：模拟兼容接口验证成功响应、格式异常、HTTP/网络失败、8 秒超时、请求取消、缓存隔离。未配置真实服务商端点，未进行付费服务联调。
- 未额外覆盖：其他浏览器版本、全部字号/行距组合、所有复杂英文句型。规则层不承诺完整语法分析。

PowerShell 若拦截 npm.ps1，请用 `npm.cmd run dev -- --host 127.0.0.1 --port 5180`；无需更改执行策略。
