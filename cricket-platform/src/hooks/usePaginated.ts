import { useMemo, useState } from 'react'

/**
 * Client-side pagination over an already-fetched array. Page clamps to the
 * valid range automatically (e.g. after a filter shrinks the list), so
 * callers don't need to reset `page` themselves when filters change.
 */
export function usePaginated<T>(items: T[], pageSize = 20) {
  const [page, setPage] = useState(1)
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const clampedPage = Math.min(Math.max(1, page), pageCount)
  const pageItems = useMemo(
    () => items.slice((clampedPage - 1) * pageSize, clampedPage * pageSize),
    [items, clampedPage, pageSize],
  )
  return {
    page: clampedPage,
    setPage,
    pageCount,
    pageItems,
    totalItems: items.length,
    pageSize,
  }
}
