import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/primitives'
import type { ScorecardConfig } from '@/types'

const TOGGLES: { key: keyof ScorecardConfig; label: string; hint?: string }[] = [
  { key: 'showResultBanner', label: 'Result banner' },
  { key: 'showMatchSummary', label: 'Match summary block' },
  { key: 'showBatting', label: 'Batting table' },
  { key: 'showBowling', label: 'Bowling table' },
  { key: 'showExtras', label: 'Extras line' },
  { key: 'showFallOfWickets', label: 'Fall of wickets' },
  { key: 'showPartnership', label: 'Partnership' },
  { key: 'showRunRate', label: 'Run rate' },
  { key: 'showRequiredRate', label: 'Required run rate' },
  { key: 'showOverSummary', label: 'Over summary' },
  { key: 'showBallByBall', label: 'Ball-by-ball commentary' },
  { key: 'showTeamColors', label: 'Team colours' },
  { key: 'publicVisible', label: 'Visible on public match page' },
]

export function ScorecardConfigModal({
  config,
  onClose,
  onSave,
}: {
  config: ScorecardConfig
  onClose: () => void
  onSave: (cfg: ScorecardConfig) => void | Promise<void>
}) {
  const [cfg, setCfg] = useState<ScorecardConfig>(config)
  const [saving, setSaving] = useState(false)

  const toggle = (key: keyof ScorecardConfig) =>
    setCfg((c) => ({ ...c, [key]: !c[key] }))

  async function submit() {
    setSaving(true)
    try {
      await onSave(cfg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Customize scorecard"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            Save preferences
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-ink-500 dark:text-ink-400">
        Choose which sections appear on this match's scorecard and public page.
      </p>
      <div className="space-y-1">
        {TOGGLES.map((t) => (
          <label
            key={t.key}
            className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 hover:bg-ink-50 dark:hover:bg-ink-800"
          >
            <span className="text-sm font-medium text-ink-800 dark:text-ink-200">{t.label}</span>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                toggle(t.key)
              }}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                cfg[t.key] ? 'bg-brand-600' : 'bg-ink-300'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white dark:bg-ink-900 transition-transform ${
                  cfg[t.key] ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </label>
        ))}
      </div>
    </Modal>
  )
}
