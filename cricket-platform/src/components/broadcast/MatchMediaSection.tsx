import { useEffect, useRef, useState } from 'react'
import { Video, Upload, Scissors, Trash2, Play } from 'lucide-react'
import { Card, CardHeader, CardBody, Button, Badge, EmptyState } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/toast'
import { LiveVideoPlayer } from './LiveVideoPlayer'
import { ReplayPlayer, type ReplayPlayerHandle } from './ReplayPlayer'
import {
  subscribeBroadcast,
  subscribeMatchVideos,
  createMatchVideo,
  updateMatchVideo,
  subscribeClips,
  createClip,
  deleteClip,
} from '@/services/broadcast.service'
import { uploadVideo, VideoUploadError } from '@/services/storage.service'
import { isBroadcastLive, isRecordingReady, formatDuration } from '@/domain/broadcast'
import type { Broadcast, BallMeta, Clip, Delivery, MatchVideo } from '@/types'

export function MatchMediaSection({
  matchId,
  matchStatus,
  canManage,
  deliveries,
  ballMeta,
}: {
  matchId: string
  matchStatus: string
  /** Whoever can score/own this match — the only role allowed to upload/delete videos & clips. */
  canManage: boolean
  deliveries: Delivery[]
  ballMeta: BallMeta[]
}) {
  const toast = useToast()
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null)
  const [videos, setVideos] = useState<MatchVideo[]>([])
  const [clips, setClips] = useState<Clip[]>([])
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [clipModal, setClipModal] = useState<{ deliveryId?: string; startSec: number } | null>(null)
  const playerRef = useRef<ReplayPlayerHandle>(null)

  useEffect(() => subscribeBroadcast(matchId, setBroadcast), [matchId])
  useEffect(() => subscribeMatchVideos(matchId, setVideos), [matchId])
  useEffect(() => subscribeClips(matchId, setClips), [matchId])

  const readyVideos = videos.filter((v) => isRecordingReady(v.status) && v.url)
  const activeVideo = readyVideos.find((v) => v.id === activeVideoId) ?? readyVideos[0] ?? null
  const live = isBroadcastLive(broadcast?.status ?? 'not_started')

  const keyMoments = deliveries
    .map((d) => ({ delivery: d, meta: ballMeta.find((m) => m.id === d.id) }))
    .filter((x) => x.meta?.videoTimestampSec != null && (x.delivery.wicket || x.delivery.totalRuns >= 4))

  async function handleUploadFile(file: File) {
    setUploading(true)
    try {
      const videoId = await createMatchVideo({ matchId, kind: 'uploaded', visibility: 'public' })
      await updateMatchVideo(videoId, { status: 'processing' })
      const url = await uploadVideo(file, matchId)
      await updateMatchVideo(videoId, { status: 'ready', url, title: file.name })
      toast.success('Video uploaded.')
    } catch (err) {
      toast.error(err instanceof VideoUploadError ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Video size={16} /> Video
          </span>
        }
        action={
          canManage && (
            <label className="cursor-pointer">
              <input
                type="file"
                accept="video/webm,video/mp4"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleUploadFile(f)
                  e.target.value = ''
                }}
              />
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300 px-3 py-1.5 text-sm font-semibold text-ink-700 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800">
                <Upload size={14} /> {uploading ? 'Uploading…' : 'Upload video'}
              </span>
            </label>
          )
        }
      />
      <CardBody className="space-y-4">
        {live ? (
          <LiveVideoPlayer matchId={matchId} />
        ) : activeVideo ? (
          <>
            <ReplayPlayer ref={playerRef} video={activeVideo} />
            {readyVideos.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {readyVideos.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setActiveVideoId(v.id)}
                    className={
                      'rounded-full px-2.5 py-1 text-xs font-semibold ' +
                      (v.id === (activeVideo?.id ?? '')
                        ? 'bg-brand-600 text-white'
                        : 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300')
                    }
                  >
                    {v.kind === 'live_recording' ? 'Replay' : v.title || 'Video'}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <EmptyState
            icon={<Video size={28} />}
            title={matchStatus === 'live' ? 'No live broadcast right now' : 'No video yet'}
            description={
              matchStatus === 'live'
                ? 'The scorer has not started a live broadcast for this match.'
                : 'A replay will appear here once the scorer records or uploads one.'
            }
          />
        )}

        {activeVideo && clips.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-semibold text-ink-700 dark:text-ink-200">Clips</p>
            <div className="flex flex-wrap gap-2">
              {clips
                .filter((c) => c.videoId === activeVideo.id)
                .map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-ink-100 px-2.5 py-1 text-xs font-medium text-ink-700 dark:bg-ink-800 dark:text-ink-200"
                  >
                    <button
                      onClick={() => playerRef.current?.seekTo(c.startSec)}
                      className="inline-flex items-center gap-1 hover:text-brand-600"
                    >
                      <Play size={12} /> {c.title} ({formatDuration(c.endSec - c.startSec)})
                    </button>
                    {canManage && (
                      <button
                        onClick={() => void deleteClip(c.id).catch(() => toast.error('Could not delete clip.'))}
                        className="text-ink-400 hover:text-red-600"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </span>
                ))}
            </div>
          </div>
        )}

        {activeVideo && canManage && (
          <Button variant="outline" size="sm" onClick={() => setClipModal({ startSec: 0 })}>
            <Scissors size={14} /> Create clip
          </Button>
        )}

        {keyMoments.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-semibold text-ink-700 dark:text-ink-200">
              Ball-to-video: key moments
            </p>
            <div className="space-y-1.5">
              {keyMoments.map(({ delivery, meta }) => (
                <div
                  key={delivery.id}
                  className="flex items-center justify-between rounded-lg border border-ink-200 px-3 py-2 text-sm dark:border-ink-800"
                >
                  <span>
                    <span className="font-mono text-ink-500">{delivery.displayOver}</span>{' '}
                    {delivery.commentary}
                    {delivery.wicket && <Badge tone="red" className="ml-2">Wicket</Badge>}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!activeVideo || activeVideo.kind !== 'live_recording'}
                    onClick={() => playerRef.current?.seekTo(meta!.videoTimestampSec!)}
                  >
                    <Play size={14} /> Watch
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardBody>

      {clipModal && activeVideo && (
        <ClipModal
          matchId={matchId}
          video={activeVideo}
          onClose={() => setClipModal(null)}
          onCreated={() => setClipModal(null)}
        />
      )}
    </Card>
  )
}

function ClipModal({
  matchId,
  video,
  onClose,
  onCreated,
}: {
  matchId: string
  video: MatchVideo
  onClose: () => void
  onCreated: () => void
}) {
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [startSec, setStartSec] = useState(0)
  const [endSec, setEndSec] = useState(10)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (endSec <= startSec) {
      toast.error('End time must be after start time.')
      return
    }
    setSaving(true)
    try {
      await createClip({
        matchId,
        videoId: video.id,
        title: title.trim() || 'Clip',
        startSec,
        endSec,
      })
      toast.success('Clip saved.')
      onCreated()
    } catch {
      toast.error('Could not save clip.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Create clip">
      <div className="space-y-3 p-5">
        <p className="text-sm text-ink-500 dark:text-ink-400">
          A clip is a saved time range into this video — it plays back by seeking, nothing is
          re-encoded or exported separately.
        </p>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink-700 dark:text-ink-200">Title</label>
          <input
            className="w-full rounded-lg border border-ink-300 px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-900"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Six over long-on"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700 dark:text-ink-200">
              Start (seconds)
            </label>
            <input
              type="number"
              min={0}
              className="w-full rounded-lg border border-ink-300 px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-900"
              value={startSec}
              onChange={(e) => setStartSec(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700 dark:text-ink-200">
              End (seconds)
            </label>
            <input
              type="number"
              min={0}
              className="w-full rounded-lg border border-ink-300 px-3 py-2 text-sm dark:border-ink-700 dark:bg-ink-900"
              value={endSec}
              onChange={(e) => setEndSec(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Save clip
          </Button>
        </div>
      </div>
    </Modal>
  )
}
