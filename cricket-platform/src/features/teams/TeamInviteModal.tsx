import { useState } from 'react'
import { Mail } from 'lucide-react'
import { Button, Field, Input, Textarea } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/store/authStore'
import { getPublicProfile } from '@/services/users.service'
import { createTeamInvitation } from '@/services/teamInvitations.service'
import type { Team } from '@/types'

export function TeamInviteModal({ team, onClose }: { team: Team; onClose: () => void }) {
  const toast = useToast()
  const profile = useAuthStore((s) => s.profile)
  const [username, setUsername] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function send() {
    setError('')
    const u = username.trim()
    if (!u) return setError('Enter a username.')
    if (!profile) return
    setSaving(true)
    try {
      const target = await getPublicProfile(u)
      if (!target) {
        setError(`No user found with username "${u}".`)
        return
      }
      if (team.playerIds.some((pid) => pid === target.id)) {
        setError('This user is already on the roster.')
        return
      }
      await createTeamInvitation(team.id, team.name, target.id, target.username, message, 7, profile)
      toast.success(`Invitation sent to @${target.username}`)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send invitation')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Invite a player to ${team.name}`} size="sm">
      <div className="space-y-3">
        <Field label="Username" hint="They'll get a link to accept and join the roster.">
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. rsharma"
            autoFocus
          />
        </Field>
        <Field label="Message (optional)">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            placeholder="Looking forward to having you on the team!"
          />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={send} loading={saving}>
            <Mail size={15} /> Send invite
          </Button>
        </div>
      </div>
    </Modal>
  )
}
