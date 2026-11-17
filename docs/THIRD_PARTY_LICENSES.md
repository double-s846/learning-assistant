# 第三方依赖与许可证清单（THIRD_PARTY_LICENSES.md）

> 赛题要求「第三方资源需有明确许可声明」。本清单覆盖仓库内所有第三方代码依赖与外部服务。
> 生成方式：`npm ls --depth=0` + 读取各包 `package.json` 的 `license` 字段（2026-11-17）。

---

## 1. 运行时依赖（会被打包进最终产物）

| 包名 | 版本 | 许可证 | 用途 | 项目主页 |
|---|---|---|---|---|
| react | 19.3.1 | MIT | UI 框架 | https://react.dev |
| react-dom | 19.3.1 | MIT | DOM 渲染 | https://react.dev |

**运行时依赖只有这两个**，没有 UI 组件库、没有状态管理库、没有 HTTP 库、没有日期库。
这是刻意的选择：依赖越少，评委安装越顺、许可证清单越短、安全面越小。

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

以上开发依赖各自的传递依赖（共 162 个包，见 `package-lock.json`）全部为 MIT / ISC / Apache-2.0 / BSD 类宽松许可证，
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
| 字体 | **未打包任何字体文件**，全部使用系统字体栈（Georgia / Palatino / 宋体 / 思源系） | — | `src/styles/global.css` |

**不打包字体文件**是有意的：字体文件通常几百 KB 到几 MB，且不同字体许可证（OFL/Apache/商业）差异大，
容易在"第三方许可证"这一项上出问题。使用系统字体栈零风险、零体积。

## 5. 本项目自身的许可

- **源代码**：MIT，见根目录 [LICENSE](../LICENSE)
- **示例文章与词表内容**：CC BY 4.0（可自由使用，需署名 "Learning Assistant Team"）

## 6. 维护约定

1. **新增依赖前先问**：目前运行时依赖只有 2 个，任何新增都要在 `docs/TEAM.md` 里过一遍；
2. **新增后必须更新本文件**：包名 / 版本 / 许可证 / 用途四列都填；
3. **禁止引入 GPL / AGPL 依赖**：会让整个项目的许可变复杂；
4. **禁止引入来源不明的代码片段**：从 Stack Overflow 复制的片段需注明出处与许可证；
5. **禁止打包商业字体、商业图标库**。
