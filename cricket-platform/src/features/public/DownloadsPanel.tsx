import { useRef, useState, type ChangeEvent } from 'react'
import { FileText, Trash2, Upload, Loader2, Download } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { confirmDialog } from '@/components/ui/confirm'
import { useAsync } from '@/hooks/useAsync'
import {
  listFolderDocuments,
  uploadDocument,
  deleteUploadedDocument,
  DocumentUploadError,
  type StoredDocument,
} from '@/services/storage.service'
import { formatDate } from '@/lib/format'

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DownloadsPanel({
  tournamentId,
  canManage,
}: {
  tournamentId: string
  canManage: boolean
}) {
  const toast = useToast()
  const folder = `tournamentDocuments/${tournamentId}`
  const docs = useAsync(() => listFolderDocuments(folder), [folder])
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [deletingPath, setDeletingPath] = useState<string | null>(null)

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      await uploadDocument(file, folder)
      toast.success('Document uploaded')
      docs.refetch()
    } catch (err) {
      toast.error(err instanceof DocumentUploadError ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(doc: StoredDocument) {
    if (!(await confirmDialog({ title: 'Remove document', message: `Remove “${doc.name}”? People will no longer be able to download it.`, confirmLabel: 'Remove' }))) return
    setDeletingPath(doc.path)
    try {
      await deleteUploadedDocument(doc.url)
      toast.success('Document removed')
      docs.refetch()
    } catch {
      toast.error('Could not remove document')
    } finally {
      setDeletingPath(null)
    }
  }

  const list = docs.data ?? []

  return (
    <div>
      {canManage && (
        <div className="mb-4">
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFile}
            className="hidden"
          />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300 dark:border-ink-700 px-3 py-1.5 text-sm font-medium text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800 disabled:opacity-50"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            Upload PDF
          </button>
        </div>
      )}

      {docs.loading ? (
        <p className="py-4 text-center text-sm text-ink-500 dark:text-ink-400">Loading…</p>
      ) : list.length === 0 ? (
        <p className="py-4 text-center text-sm text-ink-500 dark:text-ink-400">
          No documents yet.
        </p>
      ) : (
        <div className="space-y-2">
          {list.map((doc) => (
            <div
              key={doc.path}
              className="flex items-center gap-3 rounded-lg border border-ink-200 dark:border-ink-800 p-3"
            >
              <FileText size={18} className="shrink-0 text-ink-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-800 dark:text-ink-200">
                  {doc.name}
                </p>
                <p className="text-xs text-ink-400 dark:text-ink-500">
                  {formatSize(doc.size)} · {formatDate(doc.createdAt)}
                </p>
              </div>
              <a
                href={doc.url}
                target="_blank"
                rel="noreferrer"
                aria-label={`Download ${doc.name}`}
                className="rounded-md p-1.5 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20"
              >
                <Download size={16} />
              </a>
              {canManage && (
                <button
                  onClick={() => handleDelete(doc)}
                  disabled={deletingPath === doc.path}
                  aria-label={`Remove ${doc.name}`}
                  className="rounded-md p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                >
                  {deletingPath === doc.path ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
