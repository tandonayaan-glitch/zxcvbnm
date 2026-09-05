import { Bookmark, Plus, X } from 'lucide-react'
import { useSavedFiltersStore } from '@/store/savedFiltersStore'
import { promptDialog } from '@/components/ui/prompt'

/**
 * Lets a user name and restore the current combination of filter dropdowns on a page
 * ("My Club", "Current Season"…). `current` must be the exact shape `onApply` expects back.
 */
export function SavedFiltersBar({
  pageKey,
  current,
  onApply,
}: {
  pageKey: string
  current: Record<string, string>
  onApply: (filters: Record<string, string>) => void
}) {
  const list = useSavedFiltersStore((s) => s.list(pageKey))
  const saveFilter = useSavedFiltersStore((s) => s.saveFilter)
  const removeFilter = useSavedFiltersStore((s) => s.removeFilter)

  async function handleSave() {
    const name = await promptDialog({
      title: 'Save current filter',
      label: 'Filter name',
      placeholder: 'e.g. My Club, Current Season',
      confirmLabel: 'Save',
      maxLength: 40,
    })
    if (!name?.trim()) return
    saveFilter(pageKey, name.trim(), current)
  }

  const isAllDefault = Object.values(current).every((v) => v === 'all')

  if (list.length === 0 && isAllDefault) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {list.length > 0 && (
        <Bookmark size={14} className="shrink-0 text-ink-400 dark:text-ink-500" />
      )}
      {list.map((f) => (
        <span
          key={f.name}
          className="flex items-center gap-1 rounded-full border border-ink-300 bg-white px-3 py-1 text-sm dark:border-ink-700 dark:bg-ink-900"
        >
          <button
            type="button"
            onClick={() => onApply(f.filters)}
            className="text-ink-700 hover:text-brand-700 dark:text-ink-300 dark:hover:text-brand-400"
          >
            {f.name}
          </button>
          <button
            type="button"
            onClick={() => removeFilter(pageKey, f.name)}
            aria-label={`Remove saved filter ${f.name}`}
            className="text-ink-400 hover:text-red-500 dark:text-ink-500"
          >
            <X size={12} />
          </button>
        </span>
      ))}
      {!isAllDefault && (
        <button
          type="button"
          onClick={handleSave}
          className="flex items-center gap-1 rounded-full border border-dashed border-ink-300 px-3 py-1 text-sm text-ink-500 hover:border-brand-400 hover:text-brand-600 dark:border-ink-700 dark:text-ink-400 dark:hover:text-brand-400"
        >
          <Plus size={12} /> Save current filter
        </button>
      )}
    </div>
  )
}
