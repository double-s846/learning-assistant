# 模块 E · 朗读与跟读（TTS）

## 目标

点「朗读」→ 从当前段落开始逐句读，读到的句子高亮并在视口内自动滚动。

## 已提供

- `Settings.ttsRate`（语速，设置面板已可调）与 `Settings.ttsVoice`（音色名）；
- 句子结构 `Sentence { id, paragraphId, start, end, text }`，句子 id **确定性**（刷新不变），可直接用来做高亮定位；
- `getSentencesByParagraph(article)` 拿整篇句子，按段落分组。

## 技术选型：用浏览器原生 `SpeechSynthesis`

```ts
const utter = new SpeechSynthesisUtterance(sentence.text)
utter.lang = 'en-US'
utter.rate = settings.ttsRate
if (settings.ttsVoice) {
  const v = speechSynthesis.getVoices().find((x) => x.name === settings.ttsVoice)
  if (v) utter.voice = v
}
utter.onend = () => playNext()   // 逐句推进
speechSynthesis.speak(utter)
```

**为什么不用云 TTS**：云 TTS 要 key、要计费、要联网，意味着评分项的"可运行闭环"会依赖外部服务。
原生 API 免费、离线、零配置，音质对"跟读"场景足够。

## 你要做的

1. `useTTS.ts`：封装 `speak / pause / resume / stop`、当前句 id、播放状态；
2. `TTSPanel.tsx` 或顶栏按钮：播放 / 暂停 / 上一句 / 下一句 / 语速 / 音色选择；
3. **当前句高亮**：把 `activeSentenceId` 通过 props 传给 `Reader`（需要小改 `Reader.tsx`，认领后配合改，避免多人同时改同一文件）；
4. **自动滚动**：`element.scrollIntoView({ block: 'center', behavior: 'smooth' })`，尊重 `prefers-reduced-motion`；
5. **跟读模式（加分）**：读完一句暂停 N 秒，留时间用户自己复述。

## 已知坑（务必处理）

| 坑 | 处理方式 |
|---|---|
| `getVoices()` 首次返回空数组 | 监听 `voiceschanged` 事件重新取 |
| Chrome 要求用户手势后才能播放 | 必须在按钮点击回调里调用 `speak()`，不能在 `useEffect` 里自动播 |
| 切换文章/卸载组件时声音不停 | 在 `useEffect` 的 cleanup 里调 `speechSynthesis.cancel()` |
| 长句读太久用户想跳过 | 提供"下一句"按钮，内部先 `cancel()` 再 `speak()` 新句 |
| Safari 的 `onend` 有时不触发 | 加超时兜底，或用 `onboundary` 判断尾音 |
| 音色名跨设备不通用 | 取不到就静默回落到默认音色，不要报错 |

## 验收标准

- [ ] 点播放能听到英文朗读，当前句有高亮；
- [ ] 句与句之间自动推进，读完自动停；
- [ ] 切换文章或关闭页面时声音立刻停止；
- [ ] 语速滑块实时生效；
- [ ] 刷新页面后语速设置仍在（存 `Settings`）。

## 不要做

- 不要引入云 TTS SDK / 播放器库；
- 不要在 `useEffect` 里自动开始播放；
- 不要改 `Sentence` 的数据结构。
