import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { RELEASE_NOTES, CURRENT_VERSION } from '@/lib/releaseNotes'

const SEEN_KEY = 'crickethub.whatsnew.seenVersion'

function lastSeenVersion(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY)
  } catch {
    return null
  }
}

/** Small header button that opens a "What's new" panel of curated release highlights.
 *  Shows a dot badge until the current version has been opened once. */
export function WhatsNewButton() {
  const [open, setOpen] = useState(false)
  const [unseen, setUnseen] = useState(false)

  useEffect(() => {
    setUnseen(lastSeenVersion() !== CURRENT_VERSION)
  }, [])

  function handleOpen() {
    setOpen(true)
    setUnseen(false)
    try {
      localStorage.setItem(SEEN_KEY, CURRENT_VERSION)
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        aria-label="What's new"
        title="What's new"
        className="relative rounded-md p-2 text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800"
      >
        <Sparkles size={18} />
        {unseen && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand-500" />
        )}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="What's new" size="sm">
        <div className="space-y-5">
          {RELEASE_NOTES.map((note) => (
            <div key={note.version}>
              <div className="mb-2 flex items-baseline gap-2">
                <span className="text-sm font-semibold text-ink-900 dark:text-ink-50">
                  v{note.version}
                </span>
                <span className="text-xs text-ink-400 dark:text-ink-500">{note.date}</span>
              </div>
              <ul className="space-y-1.5">
                {note.highlights.map((h, i) => (
                  <li
                    key={i}
                    className="flex gap-2 text-sm text-ink-700 dark:text-ink-300"
                  >
                    <span className="text-brand-500">•</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Modal>
    </>
  )
}
