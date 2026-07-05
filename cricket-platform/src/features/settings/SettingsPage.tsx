import { useEffect, useState } from 'react'
import { RefreshCw, Save } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  PageLoader,
  Select,
} from '@/components/ui/primitives'
import { useToast } from '@/components/ui/toast'
import { getSettings, saveSettings } from '@/services/settings.service'
import { recomputeAllStats } from '@/services/stats.service'
import type { AppSettings } from '@/types'

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
        </CardBody>
        <div className="flex justify-end border-t border-ink-100 px-5 py-3">
          <Button onClick={save} loading={saving}>
            <Save size={16} /> Save settings
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Maintenance"
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
