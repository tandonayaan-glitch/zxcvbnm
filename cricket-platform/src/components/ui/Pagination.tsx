import { ChevronLeft, ChevronRight } from 'lucide-react'

export function Pagination({
  page,
  pageCount,
  totalItems,
  pageSize,
  onChange,
}: {
  page: number
  pageCount: number
  totalItems: number
  pageSize: number
  onChange: (page: number) => void
}) {
  if (pageCount <= 1) return null

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalItems)

  return (
    <div className="flex items-center justify-between gap-3 border-t border-ink-100 px-4 py-3 text-sm dark:border-ink-800">
      <span className="text-ink-500 dark:text-ink-400">
        Showing {from}–{to} of {totalItems}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="rounded-md p-1.5 text-ink-600 hover:bg-ink-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-ink-400 dark:hover:bg-ink-800"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="px-2 text-ink-700 dark:text-ink-300">
          Page {page} of {pageCount}
        </span>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Next page"
          className="rounded-md p-1.5 text-ink-600 hover:bg-ink-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-ink-400 dark:hover:bg-ink-800"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
