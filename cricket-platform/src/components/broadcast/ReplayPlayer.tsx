import { useRef, useImperativeHandle, forwardRef } from 'react'
import { formatDuration } from '@/domain/broadcast'
import type { MatchVideo } from '@/types'

export interface ReplayPlayerHandle {
  seekTo: (sec: number) => void
}

/** Plays a finalized `MatchVideo` (live-recording replay or an uploaded video) with standard
 *  HTML5 controls. `seekTo` (via ref) is how ball-to-video jumps land on the right instant. */
export const ReplayPlayer = forwardRef<ReplayPlayerHandle, { video: MatchVideo; startAt?: number }>(
  function ReplayPlayer({ video, startAt }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null)

    useImperativeHandle(ref, () => ({
      seekTo: (sec: number) => {
        const el = videoRef.current
        if (!el) return
        el.currentTime = sec
        void el.play().catch(() => {})
      },
    }))

    if (!video.url) return null

    return (
      <div className="space-y-1">
        <video
          ref={videoRef}
          src={video.url}
          controls
          playsInline
          poster={video.thumbnailURL ?? undefined}
          className="aspect-video w-full rounded-lg bg-ink-950"
          onLoadedMetadata={(e) => {
            if (startAt != null) e.currentTarget.currentTime = startAt
          }}
        />
        {video.durationSec != null && (
          <p className="text-xs text-ink-500 dark:text-ink-400">
            Duration: {formatDuration(video.durationSec)}
          </p>
        )}
      </div>
    )
  },
)
