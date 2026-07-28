import { useState } from 'react'
import { Code2, Copy } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/toast'

function copy(text: string, onDone: () => void, onFail: () => void) {
  navigator.clipboard.writeText(text).then(onDone).catch(onFail)
}

/** Offers `<iframe>` embed snippets for this match — a compact live score card and the full
 *  scorecard — pointing at the chrome-free `/embed/match/:id` and `/embed/scorecard/:id` routes. */
export function EmbedButton({ matchId, className }: { matchId: string; className?: string }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const scoreSnippet = `<iframe src="${origin}/embed/match/${matchId}" width="320" height="150" style="border:0" title="Live score"></iframe>`
  const scorecardSnippet = `<iframe src="${origin}/embed/scorecard/${matchId}" width="480" height="600" style="border:0" title="Scorecard"></iframe>`

  function onCopy(text: string) {
    copy(
      text,
      () => toast.success('Embed code copied'),
      () => toast.error('Could not copy — select and copy manually'),
    )
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Embed this match"
        title="Embed"
        className={cn(
          'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ink-300 bg-white text-ink-600 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300 dark:hover:bg-ink-800',
          className,
        )}
      >
        <Code2 size={15} />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Embed this match" size="md">
        <div className="space-y-4">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium text-ink-800 dark:text-ink-200">
                Live score card
              </span>
              <button
                onClick={() => onCopy(scoreSnippet)}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
              >
                <Copy size={12} /> Copy
              </button>
            </div>
            <textarea
              readOnly
              value={scoreSnippet}
              rows={2}
              onFocus={(e) => e.target.select()}
              aria-label="Live score card embed code"
              className="w-full resize-none rounded-lg border border-ink-200 bg-ink-50 p-2 font-mono text-xs text-ink-700 dark:border-ink-800 dark:bg-ink-800/60 dark:text-ink-300"
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium text-ink-800 dark:text-ink-200">
                Full scorecard
              </span>
              <button
                onClick={() => onCopy(scorecardSnippet)}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
              >
                <Copy size={12} /> Copy
              </button>
            </div>
            <textarea
              readOnly
              value={scorecardSnippet}
              rows={2}
              onFocus={(e) => e.target.select()}
              aria-label="Full scorecard embed code"
              className="w-full resize-none rounded-lg border border-ink-200 bg-ink-50 p-2 font-mono text-xs text-ink-700 dark:border-ink-800 dark:bg-ink-800/60 dark:text-ink-300"
            />
          </div>
        </div>
      </Modal>
    </>
  )
}
