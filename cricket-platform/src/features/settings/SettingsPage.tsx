import { useEffect, useState } from 'react'
import { RefreshCw, Save, Wrench } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  PageLoader,
  Select,
  Switch,
  Textarea,
} from '@/components/ui/primitives'
import { useToast } from '@/components/ui/toast'
import { getSettings, saveSettings } from '@/services/settings.service'
import { recomputeAllStats } from '@/services/stats.service'
import type { AppSettings, MaintenanceConfig } from '@/types'

export function SettingsPage() {
  const toast = useToast()
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [recomputing, setRecomputing] = useState(false)

  useEffect(() => {
    getSettings().then(setSettings)
  }, [])

  if (!settings) return <PageLoader />

  async function save() {
    setSaving(true)
    try {
      await saveSettings(settings!)
      toast.success('Settings saved')
    } catch {
      toast.error('Could not save settings')
    } finally {
      setSaving(false)
    }
  }

  async function recompute() {
    setRecomputing(true)
    try {
      await recomputeAllStats()
      toast.success('All player & team stats recomputed')
    } catch {
      toast.error('Recompute failed')
    } finally {
      setRecomputing(false)
    }
  }

  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) =>
    setSettings((s) => (s ? { ...s, [k]: v } : s))

  const setMaintenance = <K extends keyof MaintenanceConfig>(k: K, v: MaintenanceConfig[K]) =>
    setSettings((s) => (s ? { ...s, maintenance: { ...s.maintenance, [k]: v } } : s))

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" subtitle="Platform defaults and maintenance." />

      <Card className="mb-4">
        <CardHeader title="Platform" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Platform name">
            <Input
              value={settings.appName}
              onChange={(e) => set('appName', e.target.value)}
            />
          </Field>
          <Field label="Default overs per innings">
            <Input
              type="number"
              min={1}
              value={settings.defaultOvers}
              onChange={(e) => set('defaultOvers', Number(e.target.value))}
            />
          </Field>
          <Field label="New matches are">
            <Select
              value={settings.defaultPublicMatches ? 'public' : 'private'}
              onChange={(e) =>
                set('defaultPublicMatches', e.target.value === 'public')
              }
            >
              <option value="public">Public by default</option>
              <option value="private">Private by default</option>
            </Select>
          </Field>
          <Field label="Trash retention (days)">
            <Input
              type="number"
              min={1}
              value={settings.trashRetentionDays}
              onChange={(e) => set('trashRetentionDays', Number(e.target.value))}
            />
          </Field>
        </CardBody>
        <div className="flex justify-end border-t border-ink-100 dark:border-ink-800 px-5 py-3">
          <Button onClick={save} loading={saving}>
            <Save size={16} /> Save settings
          </Button>
        </div>
      </Card>

      <Card className="mb-4">
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <Wrench size={18} /> Maintenance mode
              {settings.maintenance.enabled && <Badge tone="red">Active</Badge>}
            </span>
          }
          subtitle="While enabled, everyone except the master admin sees a maintenance screen instead of the app."
        />
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-ink-800 dark:text-ink-200">
              Enable maintenance mode
            </span>
            <Switch
              checked={settings.maintenance.enabled}
              onChange={(v) => setMaintenance('enabled', v)}
              label="Enable maintenance mode"
            />
          </div>
          <Field label="Message shown to visitors">
            <Textarea
              value={settings.maintenance.message}
              onChange={(e) => setMaintenance('message', e.target.value)}
              placeholder="We're making some improvements. Please check back shortly."
            />
          </Field>
          <Field label="Estimated end time (optional)">
            <input
              type="datetime-local"
              value={
                settings.maintenance.estimatedEndAt
                  ? new Date(
                      settings.maintenance.estimatedEndAt -
                        new Date().getTimezoneOffset() * 60000,
                    )
                      .toISOString()
                      .slice(0, 16)
                  : ''
              }
              onChange={(e) =>
                setMaintenance(
                  'estimatedEndAt',
                  e.target.value ? new Date(e.target.value).getTime() : null,
                )
              }
              className="w-full rounded-lg border border-ink-300 dark:border-ink-700 bg-white dark:bg-ink-900 px-3 py-2 text-sm text-ink-800 dark:text-ink-200 focus:border-brand-500 focus:outline-none"
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Stats maintenance"
          subtitle="Rebuild cached statistics from all completed matches."
        />
        <CardBody>
          <Button variant="outline" onClick={recompute} loading={recomputing}>
            <RefreshCw size={16} /> Recompute all stats
          </Button>
        </CardBody>
      </Card>
    </div>
  )
}
