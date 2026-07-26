import { useState } from 'react'
import QRCode from 'qrcode'
import { QrCode, Download } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Modal } from '@/components/ui/Modal'
import { useAsync } from '@/hooks/useAsync'

/** Shows a scannable QR code for the current page's canonical URL (or an explicit `url`) in a
 *  modal — for print flyers, scoreboards, team sheets, anywhere a spectator might scan rather
 *  than type a link. Generated client-side (`qrcode` package), no network call. */
export function QRCodeButton({
  title,
  url,
  className,
}: {
  title: string
  url?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const target = url ?? (typeof window !== 'undefined' ? window.location.href : '')
  const qr = useAsync(
    () => QRCode.toDataURL(target, { width: 320, margin: 2 }),
    [target, open],
  )

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Show QR code"
        title="QR code"
        className={cn(
          'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-ink-300 bg-white text-ink-600 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300 dark:hover:bg-ink-800',
          className,
        )}
      >
        <QrCode size={15} />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Scan to open" size="sm">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm font-medium text-ink-800 dark:text-ink-200">{title}</p>
          {qr.data ? (
            <img
              src={qr.data}
              alt={`QR code for ${title}`}
              width={240}
              height={240}
              className="rounded-lg border border-ink-100 dark:border-ink-800"
            />
          ) : (
            <div className="flex h-60 w-60 items-center justify-center text-sm text-ink-400 dark:text-ink-500">
              {qr.loading ? 'Generating…' : 'Could not generate QR code.'}
            </div>
          )}
          <p className="break-all text-xs text-ink-400 dark:text-ink-500">{target}</p>
          {qr.data && (
            <a
              href={qr.data}
              download="qr-code.png"
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300 dark:border-ink-700 px-3 py-1.5 text-sm font-medium text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800"
            >
              <Download size={14} /> Download PNG
            </a>
          )}
        </div>
      </Modal>
    </>
  )
}
