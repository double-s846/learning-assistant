/** AI-assisted: 初稿由 DeepSeek（2026-11-17）生成，人工修改点见 docs/AI_USAGE.md 第 3 节。 */
/**
 * 设置菜单：阅读模式 / 主题 / 字号 / 行距 / 语速 / 数据备份。
 *
 * 「流畅模式 ↔ 学习模式」是本赛题「兼顾阅读流畅性与学习深度」的直接落点，
 * 因此放在最显眼的位置（也出现在顶栏的 seg 切换里）。
 */

import { useRef, useState } from 'react'
import type { ReadingMode, Settings, ThemeMode } from '@/types'
import { clearAll, exportSnapshot, importSnapshot } from '@/lib/storage'

interface Props {
  open: boolean
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
  onClose: () => void
}

const THEMES: Array<{ value: ThemeMode; label: string }> = [
  { value: 'light', label: '纸白' },
  { value: 'sepia', label: '护眼' },
  { value: 'dark', label: '深色' },
]

const MODES: Array<{ value: ReadingMode; label: string }> = [
  { value: 'flow', label: '流畅' },
  { value: 'study', label: '学习' },
]

export function SettingsMenu({ open, settings, onChange, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  if (!open) return null

  async function handleExport() {
    setBusy(true)
    try {
      const snapshot = await exportSnapshot()
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `learning-assistant-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : '导出备份失败')
    } finally {
      setBusy(false)
    }
  }

  async function handleImportFile(file: File) {
    setBusy(true)
    try {
      const text = await file.text()
      const result = await importSnapshot(JSON.parse(text))
      window.alert(result.message)
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : '备份导入失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="scrim" style={{ background: 'transparent', backdropFilter: 'none' }} onClick={onClose} />
      <div className="menu" role="dialog" aria-label="设置">
        <div className="menu__row">
          <span>阅读模式</span>
          <div className="seg">
            {MODES.map((m) => (
              <button
                key={m.value}
                aria-pressed={settings.mode === m.value}
                onClick={() => onChange({ mode: m.value })}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="menu__row">
          <span>主题</span>
          <div className="seg">
            {THEMES.map((t) => (
              <button
                key={t.value}
                aria-pressed={settings.theme === t.value}
                onClick={() => onChange({ theme: t.value })}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="menu__row">
          <label htmlFor="font-size">字号 {settings.fontSize}px</label>
          <input
            id="font-size"
            type="range"
            min={14}
            max={26}
            step={1}
            value={settings.fontSize}
            onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
          />
        </div>

        <div className="menu__row">
          <label htmlFor="line-height">行距 {settings.lineHeight.toFixed(2)}</label>
          <input
            id="line-height"
            type="range"
            min={1.4}
            max={2.4}
            step={0.05}
            value={settings.lineHeight}
            onChange={(e) => onChange({ lineHeight: Number(e.target.value) })}
          />
        </div>

        <div className="menu__row">
          <label htmlFor="tts-rate">朗读语速 {settings.ttsRate.toFixed(1)}×</label>
          <input
            id="tts-rate"
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={settings.ttsRate}
            onChange={(e) => onChange({ ttsRate: Number(e.target.value) })}
          />
        </div>

        <div className="menu__row">
          <label htmlFor="daily-goal">每日目标 {settings.dailyGoal} 词</label>
          <input
            id="daily-goal"
            type="range"
            min={5}
            max={50}
            step={5}
            value={settings.dailyGoal}
            onChange={(e) => onChange({ dailyGoal: Number(e.target.value) })}
          />
        </div>

        <div className="menu__row" style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <button className="btn" onClick={() => void handleExport()} disabled={busy}>
            导出备份
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>
            导入备份
          </button>
        </div>

        <div className="menu__row">
          <button
            className="btn btn--ghost"
            disabled={busy}
            style={{ color: 'var(--danger)', fontSize: 12 }}
            onClick={async () => {
              if (window.confirm('确认清空所有本地数据？此操作不可撤销。')) {
                setBusy(true)
                try {
                  await clearAll()
                  location.reload()
                } catch (cause) {
                  window.alert(cause instanceof Error ? cause.message : '清空数据失败')
                  setBusy(false)
                }
              }
            }}
          >
            清空本地数据
          </button>
          <span className="hint">v0.1.0</span>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleImportFile(file)
            e.target.value = ''
          }}
        />
      </div>
    </>
  )
}
