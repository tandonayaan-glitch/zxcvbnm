import { useState } from 'react'
import { KeyRound, Copy, Check } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/primitives'

export interface LinkedCredentials {
  playerName: string
  username: string
  password: string
}

/**
 * Shown once, right after an admin creates a linked login for a player (from the Players page
 * or the match-setup "add player" flow). The temporary password is displayed here and nowhere
 * else — it is never stored in plaintext and cannot be retrieved later (Firebase Auth only ever
 * holds the hash). If it is lost before the player activates, an admin re-issues access with
 * "Reset access" on the Users page, which generates a fresh temporary password.
 */
export function CredentialsDialog({
  credentials,
  onClose,
}: {
  credentials: LinkedCredentials
  onClose: () => void
}) {
  const [acked, setAcked] = useState(false)
  const [copied, setCopied] = useState<'username' | 'password' | null>(null)

  function copy(kind: 'username' | 'password', value: string) {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(kind)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <KeyRound size={18} /> Login created for {credentials.playerName}
        </span>
      }
      footer={
        <Button onClick={onClose} disabled={!acked} block>
          Done
        </Button>
      }
    >
      <p className="text-sm text-ink-600 dark:text-ink-400">
        Share these with {credentials.playerName} — the password is shown only this once and
        can't be retrieved later. On first login they keep this username and choose their own
        password.
      </p>
      <div className="mt-4 space-y-3">
        <CredentialRow
          label="Username"
          value={credentials.username}
          copied={copied === 'username'}
          onCopy={() => copy('username', credentials.username)}
        />
        <CredentialRow
          label="Temporary password"
          value={credentials.password}
          copied={copied === 'password'}
          onCopy={() => copy('password', credentials.password)}
        />
      </div>
      <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-ink-800 dark:text-ink-200">
        <input
          type="checkbox"
          checked={acked}
          onChange={(e) => setAcked(e.target.checked)}
          className="mt-0.5 h-4 w-4"
        />
        I've saved these credentials to share with the player.
      </label>
    </Modal>
  )
}

function CredentialRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string
  value: string
  copied: boolean
  onCopy: () => void
}) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-ink-500 dark:text-ink-400">{label}</div>
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded-lg border border-ink-200 dark:border-ink-800 bg-ink-50 dark:bg-ink-800/60 px-3 py-2 font-mono text-sm text-ink-900 dark:text-ink-50">
          {value}
        </code>
        <button
          onClick={onCopy}
          aria-label={`Copy ${label.toLowerCase()}`}
          className="rounded-lg border border-ink-300 dark:border-ink-700 p-2 text-ink-600 dark:text-ink-400 hover:bg-ink-50 dark:hover:bg-ink-800"
        >
          {copied ? <Check size={16} className="text-pitch-600" /> : <Copy size={16} />}
        </button>
      </div>
    </div>
  )
}
