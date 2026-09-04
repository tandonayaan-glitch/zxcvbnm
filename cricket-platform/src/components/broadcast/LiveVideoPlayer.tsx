import { useEffect, useRef, useState } from 'react'
import { Radio, WifiOff } from 'lucide-react'
import { Spinner, LiveBadge } from '@/components/ui/primitives'
import { joinBroadcastAsViewer, type ViewerHandle } from '@/services/broadcast.service'

/** Spectator side of the live broadcast — connects over WebRTC and plays whatever the
 *  broadcaster's camera is actually sending, live. Shows real connection state; never
 *  shows a "LIVE" label unless the peer connection has actually delivered video. */
export function LiveVideoPlayer({ matchId }: { matchId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const handleRef = useRef<ViewerHandle | null>(null)
  const [state, setState] = useState<RTCPeerConnectionState>('new')

  useEffect(() => {
    let cancelled = false
    void joinBroadcastAsViewer(
      matchId,
      (stream) => {
        if (cancelled || !videoRef.current) return
        videoRef.current.srcObject = stream
      },
      (s) => {
        if (!cancelled) setState(s)
      },
    ).then((h) => {
      if (cancelled) {
        h.leave().catch(() => {})
      } else {
        handleRef.current = h
      }
    })
    return () => {
      cancelled = true
      handleRef.current?.leave().catch(() => {})
      handleRef.current = null
    }
  }, [matchId])

  const connected = state === 'connected'

  return (
    <div className="relative aspect-video overflow-hidden rounded-lg bg-ink-950">
      <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" />
      <div className="absolute left-3 top-3">
        {connected ? <LiveBadge /> : null}
      </div>
      {!connected && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-ink-300">
          {state === 'failed' || state === 'closed' || state === 'disconnected' ? (
            <>
              <WifiOff size={22} />
              <span>Couldn't connect to the live video.</span>
            </>
          ) : (
            <>
              <Spinner size={20} className="text-ink-300" />
              <span className="inline-flex items-center gap-1">
                <Radio size={14} /> Connecting to live stream…
              </span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
