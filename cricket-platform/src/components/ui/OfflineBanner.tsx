import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

/**
 * Global connectivity banner. Firestore's persistent IndexedDB cache queues
 * writes while offline and syncs on reconnect, so this reassures the user
 * their actions aren't lost. Renders nothing while online.
 */
export function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-amber-500 px-4 py-1.5 text-center text-sm font-semibold text-white shadow-md print:hidden"
    >
      <WifiOff size={15} className="shrink-0" />
      You&rsquo;re offline — changes are saved on this device and will sync when
      you reconnect.
    </div>
  )
}
