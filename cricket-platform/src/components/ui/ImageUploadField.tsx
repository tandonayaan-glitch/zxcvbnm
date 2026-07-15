import { useRef, useState, type ChangeEvent } from 'react'
import { Upload, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/toast'
import { uploadImage, ImageUploadError } from '@/services/storage.service'
import { cn } from '@/lib/cn'

/**
 * A URL text field (existing manual-entry behaviour preserved) plus an "Upload"
 * button that picks a local image, validates/resizes/compresses it, uploads to
 * Firebase Storage, and fills the URL in. Falls back cleanly to manual URL entry
 * if Storage is unavailable — nothing here requires the upload path to succeed.
 */
export function ImageUploadField({
  value,
  onChange,
  folder,
  shape = 'circle',
}: {
  value: string
  onChange: (url: string) => void
  folder: string
  shape?: 'circle' | 'square'
}) {
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadImage(file, folder)
      onChange(url)
      toast.success('Image uploaded')
    } catch (err) {
      toast.error(err instanceof ImageUploadError ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://…"
        className="flex-1"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-ink-300 dark:border-ink-700 px-3 py-2 text-sm font-medium text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800 disabled:opacity-50"
      >
        {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
        Upload
      </button>
      {value && (
        <img
          src={value}
          alt=""
          className={cn(
            'h-9 w-9 shrink-0 border border-ink-200 object-cover dark:border-ink-700',
            shape === 'circle' ? 'rounded-full' : 'rounded-md',
          )}
        />
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  )
}
