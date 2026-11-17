/// <reference types="vite/client" />

/**
 * 环境变量类型声明。与 .env.example 保持一致。
 * 注意：所有 VITE_ 前缀的变量都会被打进前端 bundle，
 * 因此**任何真正的密钥都不应放在前端**（见 docs/AI_USAGE.md「已知限制」）。
 */
interface ImportMetaEnv {
  readonly VITE_YOUDAO_APP_KEY?: string
  readonly VITE_YOUDAO_APP_SECRET?: string
  readonly VITE_BAIDU_APP_ID?: string
  readonly VITE_BAIDU_KEY?: string
  readonly VITE_LLM_BASE_URL?: string
  readonly VITE_LLM_API_KEY?: string
  readonly VITE_LLM_MODEL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
