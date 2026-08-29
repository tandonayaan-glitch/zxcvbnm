import { useState } from 'react'
import {
  User,
  Palette,
  Lock,
  Info,
  Type,
  Zap,
  Contrast,
  LayoutGrid,
  Download,
  Sun,
  Moon,
  MonitorSmartphone,
  Eye,
  ShieldCheck,
  Bell,
  FlaskConical,
  History,
} from 'lucide-react'
import type { NotificationCategory } from '@/types'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  Textarea,
  PageLoader,
  EmptyState,
} from '@/components/ui/primitives'
import { ImageUploadField } from '@/components/ui/ImageUploadField'
import { ImageUsageIndicator } from '@/components/media/ImageUsageIndicator'
import { SignOutButton } from '@/components/ui/SignOutButton'
import { useToast } from '@/components/ui/toast'
import { useAuthStore } from '@/store/authStore'
import { auth } from '@/lib/firebase'
import { usePrefsStore, type TextScale, type ThemeMode } from '@/store/prefsStore'
import { BackgroundControl } from '@/components/background/BackgroundControl'
import { updateUserProfile } from '@/services/users.service'
import { changePassword, authErrorMessage } from '@/services/auth.service'
import { listMyAuditLogs } from '@/services/audit.service'
import { formatDate, formatDateTime, briefUA } from '@/lib/format'
import { downloadBlob, slugify } from '@/lib/download'
import { cn } from '@/lib/cn'
import { useAsync } from '@/hooks/useAsync'
import { useMySubscription } from '@/hooks/useMySubscription'

export function UserSettingsPage() {
  const toast = useToast()
  const profile = useAuthStore((s) => s.profile)
  const setProfile = useAuthStore((s) => s.setProfile)
  const { prefs, set: setPref, reset: resetPrefs } = usePrefsStore()
  const { tier: planTier } = useMySubscription()

  const [displayName, setDisplayName] = useState(profile?.displayName ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [photoURL, setPhotoURL] = useState(profile?.photoURL ?? '')
  const [email, setEmail] = useState(profile?.email ?? '')
  const [savingProfile, setSavingProfile] = useState(false)

  const [curPw, setCurPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  const myActivity = useAsync(
    () => (profile ? listMyAuditLogs(profile.id) : Promise.resolve([])),
    [profile?.id],
  )

  if (!profile) return null

  async function saveProfile() {
    if (!profile) return
    setSavingProfile(true)
    try {
      const patch = {
        displayName: displayName.trim() || profile.username,
        bio: bio.trim(),
        photoURL: photoURL.trim() || null,
        email: email.trim(),
      }
      await updateUserProfile(profile.id, patch)
      setProfile({ ...profile, ...patch })
      toast.success('Profile updated')
    } catch {
      toast.error('Could not update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  async function savePassword() {
    if (newPw !== confirmPw) return toast.error('New passwords do not match.')
    setSavingPw(true)
    try {
      await changePassword(curPw, newPw)
      setCurPw('')
      setNewPw('')
      setConfirmPw('')
      toast.success('Password changed')
    } catch (e) {
      toast.error(authErrorMessage(e))
    } finally {
      setSavingPw(false)
    }
  }

  function exportMyData() {
    if (!profile) return
    const data = {
      exportedAt: Date.now(),
      profile: {
        username: profile.username,
        displayName: profile.displayName,
        role: profile.role,
        bio: profile.bio ?? null,
        email: profile.email ?? null,
        createdAt: profile.createdAt,
      },
      preferences: prefs,
    }
    downloadBlob(
      `${slugify(profile.username)}-account-data.json`,
      JSON.stringify(data, null, 2),
      'application/json',
    )
  }

  const scales: { key: TextScale; label: string }[] = [
    { key: 'small', label: 'Small' },
    { key: 'normal', label: 'Normal' },
    { key: 'large', label: 'Large' },
    { key: 'xlarge', label: 'X-Large' },
  ]

  const lastSignInTime = auth.currentUser?.metadata.lastSignInTime
  const lastSignInMs = lastSignInTime ? Date.parse(lastSignInTime) : null

  const themes: { key: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { key: 'light', label: 'Light', icon: <Sun size={15} /> },
    { key: 'dark', label: 'Dark', icon: <Moon size={15} /> },
    { key: 'system', label: 'System', icon: <MonitorSmartphone size={15} /> },
  ]

  const notifyCategories: { key: NotificationCategory; label: string; hint: string }[] = [
    { key: 'match', label: 'Match updates', hint: 'A match you scored or own has finished.' },
    { key: 'tournament', label: 'Tournament updates', hint: 'Fixtures, standings and results.' },
    { key: 'player', label: 'Player profile changes', hint: 'Your linked player profile was merged or claimed.' },
    { key: 'account', label: 'Account & access', hint: 'Admin requests, invitations.' },
    { key: 'security', label: 'Security alerts', hint: 'Role changes, account suspension.' },
  ]
  function toggleNotifyCategory(cat: NotificationCategory, enabled: boolean) {
    const next = enabled
      ? prefs.notifyMuted.filter((c) => c !== cat)
      : [...prefs.notifyMuted, cat]
    setPref('notifyMuted', next)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" subtitle="Manage your profile, appearance and security." />

      {/* Profile */}
      <Card className="mb-4">
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <User size={18} /> Profile
            </span>
          }
        />
        <CardBody className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar name={displayName || profile.username} src={photoURL || null} size={56} />
            <div className="text-sm text-ink-500 dark:text-ink-400">
              Your avatar comes from the photo below (or your initials).
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Display name">
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </Field>
            <Field label="Email (optional)">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Photo">
                <ImageUploadField value={photoURL} onChange={setPhotoURL} folder="users" />
              </Field>
              <ImageUsageIndicator />
            </div>
            <div className="sm:col-span-2">
              <Field label="Bio">
                <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="A short bio…" />
              </Field>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={saveProfile} loading={savingProfile}>
              Save profile
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Appearance */}
      <Card className="mb-4">
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Palette size={18} /> Appearance &amp; accessibility
            </span>
          }
          subtitle="Synced to your account across devices."
        />
        <CardBody className="space-y-5">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-ink-700 dark:text-ink-300">
              <Sun size={15} /> Theme
            </div>
            <div className="grid grid-cols-3 gap-2">
              {themes.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setPref('theme', t.key)}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-sm font-semibold',
                    prefs.theme === t.key
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-ink-300 dark:border-ink-700 text-ink-600 dark:text-ink-400 hover:bg-ink-50 dark:hover:bg-ink-800',
                  )}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-ink-500 dark:text-ink-400">
              Dark mode currently themes the navigation and page background; individual
              page content will follow in a later update.
            </p>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-ink-700 dark:text-ink-300">
              <Type size={15} /> Text size
            </div>
            <div className="grid grid-cols-4 gap-2">
              {scales.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setPref('textScale', s.key)}
                  className={cn(
                    'rounded-lg border px-2 py-2 text-sm font-semibold',
                    prefs.textScale === s.key
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-ink-300 dark:border-ink-700 text-ink-600 dark:text-ink-400 hover:bg-ink-50 dark:hover:bg-ink-800',
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-ink-700 dark:text-ink-300">
              <LayoutGrid size={15} /> Density
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['comfortable', 'compact'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setPref('density', d)}
                  className={cn(
                    'rounded-lg border px-2 py-2 text-sm font-semibold capitalize',
                    prefs.density === d
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-ink-300 dark:border-ink-700 text-ink-600 dark:text-ink-400 hover:bg-ink-50 dark:hover:bg-ink-800',
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <ToggleRow
            icon={<Zap size={15} />}
            label="Reduced motion"
            hint="Minimise animations and transitions."
            value={prefs.reducedMotion}
            onChange={(v) => setPref('reducedMotion', v)}
          />
          <ToggleRow
            icon={<Contrast size={15} />}
            label="High contrast"
            hint="Darker secondary text and stronger links."
            value={prefs.highContrast}
            onChange={(v) => setPref('highContrast', v)}
          />
          <ToggleRow
            icon={<Eye size={15} />}
            label="Colour-blind friendly palette"
            hint="Swaps the green 'win' accent for teal, which stays distinct from red."
            value={prefs.colorBlind}
            onChange={(v) => setPref('colorBlind', v)}
          />
          <ToggleRow
            icon={<FlaskConical size={15} />}
            label="Beta features"
            hint="Opt into experimental features the platform team is trying out early."
            value={prefs.betaFeatures}
            onChange={(v) => setPref('betaFeatures', v)}
          />

          <div className="flex items-center justify-between border-t border-ink-100 dark:border-ink-800 pt-4">
            <div className="text-sm text-ink-600 dark:text-ink-400">Background theme</div>
            <BackgroundControl />
          </div>

          <div className="flex justify-end">
            <Button variant="ghost" onClick={resetPrefs}>
              Reset appearance
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Notifications */}
      <Card className="mb-4">
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Bell size={18} /> Notifications
            </span>
          }
          subtitle="Choose what shows up in your notification bell. Muted categories are still recorded, just hidden."
        />
        <CardBody className="space-y-4">
          {notifyCategories.map((c) => (
            <ToggleRow
              key={c.key}
              icon={<Bell size={15} />}
              label={c.label}
              hint={c.hint}
              value={!prefs.notifyMuted.includes(c.key)}
              onChange={(v) => toggleNotifyCategory(c.key, v)}
            />
          ))}
        </CardBody>
      </Card>

      {/* Security */}
      <Card className="mb-4">
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Lock size={18} /> Security
            </span>
          }
          subtitle="Change your password."
        />
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Current password">
              <Input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} autoComplete="current-password" />
            </Field>
            <Field label="New password">
              <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" />
            </Field>
            <Field label="Confirm new">
              <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={savePassword}
              loading={savingPw}
              disabled={!curPw || !newPw}
            >
              Change password
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Privacy & sessions */}
      <Card className="mb-4">
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <ShieldCheck size={18} /> Privacy &amp; sessions
            </span>
          }
        />
        <CardBody className="space-y-4">
          <div>
            <div className="text-sm font-medium text-ink-800 dark:text-ink-200">What's visible publicly</div>
            <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
              Your account (username, bio, email) is never shown on the public site — only
              your display name appears where you're credited as a scorer. Clear the email
              field above at any time if you'd rather not store one.
            </p>
          </div>
          <div className="flex items-center justify-between border-t border-ink-100 dark:border-ink-800 pt-4">
            <div>
              <div className="text-sm font-medium text-ink-800 dark:text-ink-200">This session</div>
              <div className="text-xs text-ink-500 dark:text-ink-400">
                Signed in {formatDateTime(lastSignInMs)}
              </div>
            </div>
            <SignOutButton variant="button" label="Sign out this device" />
          </div>
          <p className="text-xs text-ink-400 dark:text-ink-500">
            Firebase's client SDK doesn't expose a list of your other signed-in devices or a way to
            revoke them remotely — that needs a server-side Admin SDK, which this project doesn't
            run. Changing your password (above) invalidates password-based sign-in everywhere except
            devices that are already mid-session.
          </p>
        </CardBody>
      </Card>

      {/* Recent activity */}
      <Card className="mb-4">
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <History size={18} /> Recent activity
            </span>
          }
          subtitle="Logins, role changes and other actions on your account. Only you and the master admin can see this."
        />
        <CardBody className="p-0">
          {myActivity.loading ? (
            <PageLoader />
          ) : (myActivity.data ?? []).length === 0 ? (
            <div className="p-5">
              <EmptyState title="No activity yet" />
            </div>
          ) : (
            <div className="divide-y divide-ink-50 dark:divide-ink-800">
              {(myActivity.data ?? []).map((a) => (
                <div key={a.id} className="px-4 py-3">
                  <div className="text-sm font-medium text-ink-900 dark:text-ink-50">
                    {a.action}
                  </div>
                  {a.details && (
                    <div className="text-xs text-ink-500 dark:text-ink-400">{a.details}</div>
                  )}
                  <div className="mt-0.5 text-xs text-ink-400 dark:text-ink-500">
                    {formatDateTime(a.createdAt)}
                    {a.userAgent && (
                      <span title={a.userAgent}> · {briefUA(a.userAgent)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Account info */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Info size={18} /> Account
            </span>
          }
        />
        <CardBody>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-ink-500 dark:text-ink-400">Username</dt>
            <dd className="text-right font-medium text-ink-900 dark:text-ink-50">@{profile.username}</dd>
            <dt className="text-ink-500 dark:text-ink-400">Role</dt>
            <dd className="text-right">
              <Badge tone="blue">{profile.role.replace('_', ' ').toLowerCase()}</Badge>
            </dd>
            <dt className="text-ink-500 dark:text-ink-400">Plan</dt>
            <dd className="text-right">
              <Badge tone={planTier === 'premium' ? 'amber' : 'gray'}>{planTier}</Badge>
            </dd>
            <dt className="text-ink-500 dark:text-ink-400">Joined</dt>
            <dd className="text-right text-ink-700 dark:text-ink-300">{formatDate(profile.createdAt)}</dd>
          </dl>
          <div className="mt-4 flex justify-end border-t border-ink-100 dark:border-ink-800 pt-4">
            <Button variant="outline" onClick={exportMyData}>
              <Download size={16} /> Export my data (JSON)
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

function ToggleRow({
  icon,
  label,
  hint,
  value,
  onChange,
}: {
  icon: React.ReactNode
  label: string
  hint: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2 text-sm font-medium text-ink-800 dark:text-ink-200">
          {icon} {label}
        </div>
        <div className="text-xs text-ink-500 dark:text-ink-400">{hint}</div>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={cn(
          'relative h-6 w-11 rounded-full transition-colors',
          value ? 'bg-brand-600' : 'bg-ink-300',
        )}
        aria-pressed={value}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white dark:bg-ink-900 transition-transform',
            value ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  )
}
