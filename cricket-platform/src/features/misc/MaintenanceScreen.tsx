import { Wrench } from 'lucide-react'
import { formatDateTime } from '@/lib/format'
import type { MaintenanceConfig } from '@/types'

export function MaintenanceScreen({ config }: { config: MaintenanceConfig }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink-50 px-4 text-center dark:bg-ink-950">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
        <Wrench size={28} />
      </div>
      <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-50">
        Down for maintenance
      </h1>
      <p className="mt-2 max-w-md text-sm text-ink-600 dark:text-ink-400">
        {config.message || "We're making some improvements. Please check back shortly."}
      </p>
      {config.estimatedEndAt && (
        <p className="mt-3 text-xs font-medium text-ink-500 dark:text-ink-500">
          Expected back {formatDateTime(config.estimatedEndAt)}
        </p>
      )}
    </div>
  )
}
