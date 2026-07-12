import { useRef, useState } from 'react'
import { Upload, FileWarning } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/primitives'
import { previewMatchImport, type MatchImportPreview } from '@/services/matchImport.service'

export function MatchImportModal({
  open,
  onClose,
  onImport,
}: {
  open: boolean
  onClose: () => void
  onImport: (json: string) => Promise<void>
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [json, setJson] = useState('')
  const [preview, setPreview] = useState<MatchImportPreview | null>(null)
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)

  function reset() {
    setJson('')
    setPreview(null)
    setError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleClose() {
    reset()
    onClose()
  }

  function readText(text: string) {
    setJson(text)
    try {
      setPreview(previewMatchImport(text))
      setError('')
    } catch (e) {
      setPreview(null)
      setError(e instanceof Error ? e.message : 'Invalid file')
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => readText(String(reader.result ?? ''))
    reader.readAsText(file)
  }

  async function confirmImport() {
    if (!preview) return
    setImporting(true)
    try {
      await onImport(json)
      reset()
    } finally {
      setImporting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Import a match"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={importing}>
            Cancel
          </Button>
          <Button onClick={confirmImport} disabled={!preview} loading={importing}>
            Import
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-ink-600 dark:text-ink-300">
          Restore a match previously saved with the match page's "Export JSON" button —
          a full copy including every ball, created here as a new archived match you can
          review before publishing.
        </p>
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-ink-300 p-6 text-center text-sm text-ink-500 hover:border-brand-400 dark:border-ink-700 dark:text-ink-400">
          <Upload size={20} />
          Choose a match export .json file
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={onFile}
          />
        </label>
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
            <FileWarning size={16} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}
        {preview && (
          <div className="rounded-lg border border-pitch-200 bg-pitch-50 p-3 text-sm text-pitch-800 dark:border-pitch-800 dark:bg-pitch-900/20 dark:text-pitch-300">
            <div className="font-semibold">
              {preview.teamA} vs {preview.teamB}
            </div>
            <div className="text-xs text-pitch-700 dark:text-pitch-400">
              {preview.title} · {preview.status} · {preview.deliveryCount} deliveries
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
