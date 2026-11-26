# 模块 D · 长句解析增强

## 已实现

1. `ClauseMarks.tsx` 通过 App 的 `decorations.renderSentenceOverlay` 接入正文，仅学习模式启用。CSS Custom Highlight API 使用原文 Range；无重复正文、不影响点词和选区，组件卸载时清理标注。
2. `src/lib/clause.ts` 支持限定名词 + 主语代词 + 常见及物动词的接触从句，包括简单助动词结构；如 `the minutes they obtain`、`the book she has read`。
3. 支持重复关系词的并列从句，如 `which is cheap and which is useful`；抽取主干时同时移除两者之间的连接词。
4. `cache.ts`：200 条 LRU 规则缓存，按原文区分，同文不同句子 ID 不串数据，返回副本防止修改污染。LLM 成功结果另有最多 50 条内存缓存。
5. `llm.ts`：可选 OpenAI-compatible chat completions 接口，配置 `VITE_LLM_BASE_URL` 和 `VITE_LLM_MODEL` 才请求。8 秒超时、取消、网络错误、HTTP 错误、JSON/字段异常均静默回到离线结果。LLM 仅补充中文讲解和翻译，不允许修改规则成分区间。

## 降级及限制

没有 key、没有网络也能使用规则层。浏览器不支持 CSS Custom Highlight API 时保留面板内标注。其他 overlay 添加额外正文导致偏移不一致时跳过正文标注。

这不是完整 NLP：接触从句仅支持有限词表和句型；复杂嵌套、歧义及未知动词可能漏识别。无法切分时显示「未能切分」，不通过模型编造结构。主干属于规则近似，需结合上下文核对。

## 配置

复制 `.env.example` 为 `.env.local`，设置兼容网关 BASE_URL（例如 `https://your-gateway.example/v1`）及 MODEL，再重启 Vite。网关须支持浏览器 CORS。

`VITE_*` 会进入前端构建，不能保密。推荐网关持有服务商密钥，`VITE_LLM_API_KEY` 留空；不要在前端配置长期私密密钥。

## 验证

`npm run lint`、`npm run typecheck`、`npm test`、`npm run build`。
D 测试通过 `tests/parse-enhancements.test.mjs` 纳入统一测试命令。
页面验收项目见 `INTEGRATION.md`。当前无需负责人再手动接入 App，Reader.tsx 未修改。
