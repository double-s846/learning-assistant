# 第三方依赖与许可证清单（THIRD_PARTY_LICENSES.md）

> 赛题要求「第三方资源需有明确许可声明」。本清单覆盖仓库内所有第三方代码依赖与外部服务。
> 生成方式：`npm ls --depth=0` + 读取各包 `package.json` 的 `license` 字段（2026-11-17）。

---

## 1. 运行时依赖（会被打包进最终产物）

| 包名 | 版本 | 许可证 | 用途 | 项目主页 |
|---|---|---|---|---|
| react | 19.3.1 | MIT | UI 框架 | https://react.dev |
| react-dom | 19.3.1 | MIT | DOM 渲染 | https://react.dev |
| pdfjs-dist | 5.4.624 | Apache-2.0 | 本地提取 PDF 文本、渲染原页图文，包含 worker、CMap、标准字体与图像解码器 | https://mozilla.github.io/pdf.js/ |

PDF.js 仅在选择 PDF 时加载，worker、CMap 和标准字体随构建产物发布，无需第三方 CDN。
其他界面继续使用 React、浏览器原生 API 和项目已有样式。
PDF.js 的 Foxit 标准字体使用 BSD 3-Clause，Liberation 字体使用 SIL OFL 1.1；
对应 `LICENSE_FOXIT`、`LICENSE_LIBERATION` 会与字体资源一起输出到构建产物。
图像解码器使用 PDF.js 包内的 JBIG2 / OpenJPEG / QCMS WASM 资源，随资源保留对应 `LICENSE_*` 文件。

## 2. 开发依赖（仅构建/检查时需要，不进入产物）

| 包名 | 版本 | 许可证 | 用途 |
|---|---|---|---|
| vite | 8.3.8 | MIT | 开发服务器与打包 |
| @vitejs/plugin-react | 6.3.0 | MIT | React 的 JSX 转换与 Fast Refresh |
| typescript | 5.9.3 | Apache-2.0 | 类型检查 |
| @types/react | 19.3.0 | MIT | React 类型定义 |
| @types/react-dom | 19.3.0 | MIT | ReactDOM 类型定义 |
| @types/node | 26.6.6 | MIT | Node 类型定义（供 vite.config.ts 使用） |
| eslint | 10.15.0 | MIT | 代码规范检查 |
| @eslint/js | 10.0.1 | MIT | ESLint 官方推荐规则集 |
| typescript-eslint | 8.73.0 | MIT | TypeScript 语法支持与规则 |
| eslint-plugin-react-hooks | 7.1.1 | MIT | React Hooks 规则（含 `set-state-in-effect`） |
| eslint-plugin-react-refresh | 0.5.8 | MIT | Fast Refresh 兼容性检查 |
| globals | 17.14.0 | MIT | 浏览器/Node 全局变量定义 |

### 间接依赖

依赖数量和精确版本见 `package-lock.json`；现有依赖使用 MIT / ISC / Apache-2.0 / BSD 类宽松许可证，
无 GPL / AGPL 类传染性许可证。逐项核对可执行：

```bash
npx license-checker --summary      # 或
npm ls --all --json | node -e "..."  # 读取各包 license 字段
```

## 3. 外部服务（非代码依赖，仅联网时调用）

| 服务 | 提供方 | 用途 | 费用 / Key | 条款 |
|---|---|---|---|---|
| [Free Dictionary API](https://dictionaryapi.dev) | dictionaryapi.dev（社区维护） | 查词降级链**第二级**，提供英文释义与音标 | 免费、无需注册、无需 key | 服务方公开的免费接口，数据源自 Wiktionary（CC BY-SA） |
| Web Speech API（`SpeechSynthesis`） | 浏览器内置 | TTS 朗读（模块 E） | 免费、本地合成、不联网 | 浏览器标准能力，无需授权 |
| localStorage / File API | 浏览器内置 | 数据持久化与备份导出 | 免费 | 浏览器标准能力 |

> **离线可用性**：即使上述两个外部服务都不可用（断网、接口下线），
> 应用的「阅读 / 查词（内置词表）/ 生词本 / 复习 / 进度」仍全部可用。
> 这是我们在 `src/lib/dict.ts` 里做三级降级的直接目的。

## 4. 内容与数据资源

| 资源 | 来源 | 许可证 | 位置 |
|---|---|---|---|
| 示例文章《The Attention Economy Is Running Out of Attention》 | 团队原创 | CC BY 4.0 | `src/data/sample-articles.ts` |
| 示例文章《Why Cities Are Planting More Trees Than Ever》 | 团队原创 | CC BY 4.0 | `src/data/sample-articles.ts` |
| 示例文章《The Fox and the Grapes》 | Aesop's Fables，George Fyler Townsend 英译（1867） | Public Domain | `src/data/sample-articles.ts` |
| 离线核心词表 `core.json` | 团队整理编写 | CC BY 4.0 | `src/data/glossary/core.json` |
| 站点图标 favicon.svg | 团队绘制 | MIT（随项目） | `public/favicon.svg` |
| 界面字体 | 使用系统字体栈（Georgia / Palatino / 宋体 / 思源系） | — | `src/styles/global.css` |
| PDF 文本提取所需标准字体与字符映射 | PDF.js 自带资源，仅在文档需要时加载 | BSD 3-Clause / SIL OFL 1.1 / Apache-2.0（各文件保留上游许可） | `pdfjs-dist/standard_fonts`、`pdfjs-dist/cmaps` |

界面不加载网络字体；PDF 专用字体资源不作为界面字体使用。

## 5. 本项目自身的许可

- **源代码**：MIT，见根目录 [LICENSE](../LICENSE)
- **示例文章与词表内容**：CC BY 4.0（可自由使用，需署名 "Learning Assistant Team"）

## 6. 维护约定

1. **新增依赖前先问**：任何新增都要在 `docs/TEAM.md` 里过一遍；
2. **新增后必须更新本文件**：包名 / 版本 / 许可证 / 用途四列都填；
3. **禁止引入 GPL / AGPL 依赖**：会让整个项目的许可变复杂；
4. **禁止引入来源不明的代码片段**：从 Stack Overflow 复制的片段需注明出处与许可证；
5. **禁止打包商业字体、商业图标库**。
