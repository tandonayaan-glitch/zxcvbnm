import { useEffect, useRef, useState } from 'react'
import { Radio, Video, VideoOff, Mic, MicOff, RotateCcw, Users } from 'lucide-react'
import { Button, Card, CardHeader, CardBody, Badge, Spinner } from '@/components/ui/primitives'
import { useToast } from '@/components/ui/toast'
import {
  startBroadcast,
  markBroadcastFailed,
  startRecording,
  setRecordingStatus,
  createMatchVideo,
  updateMatchVideo,
  subscribeBroadcast,
  type BroadcasterHandle,
  type RecorderHandle,
} from '@/services/broadcast.service'
import { uploadVideo, VideoUploadError } from '@/services/storage.service'
import { BROADCAST_STATUS_LABEL, RECORDING_STATUS_LABEL } from '@/domain/broadcast'
import type { Broadcast } from '@/types'

/**
 * Scorer-facing broadcast control. Uses the device camera/mic directly (`getUserMedia`) and
 * streams it peer-to-peer to each connected spectator over WebRTC — see
 * `services/broadcast.service.ts` for the full architecture/limitations. Simultaneously records
 * the outgoing stream locally (`MediaRecorder`) and uploads the result as the match's replay once
 * the broadcast stops.
 */
export function LiveBroadcastPanel({
  matchId,
  broadcasterName,
}: {
  matchId: string
  broadcasterName: string
}) {
  const toast = useToast()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const broadcasterRef = useRef<BroadcasterHandle | null>(null)
  const recorderRef = useRef<RecorderHandle | null>(null)

  const [broadcast, setBroadcast] = useState<Broadcast | null>(null)
  const [phase, setPhase] = useState<'idle' | 'starting' | 'live' | 'ending'>('idle')
  const [camOn, setCamOn] = useState(true)
  const [micOn, setMicOn] = useState(true)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => subscribeBroadcast(matchId, setBroadcast), [matchId])

  useEffect(() => {
    return () => {
      // Tab/route leaving mid-broadcast — best-effort cleanup so a dangling live doc doesn't
      // outlive the actual stream (spectators would otherwise see a "LIVE" badge for a stream
      // that stopped sending frames).
      streamRef.current?.getTracks().forEach((t) => t.stop())
      broadcasterRef.current?.stop().catch(() => {})
    }
  }, [])

  async function handleStart() {
    setError(null)
    setPhase('starting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: true,
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream

      const handle = await startBroadcast(
        matchId,
        broadcasterName,
        stream,
        () => {},
        (msg) => toast.error(msg),
      )
      broadcasterRef.current = handle

      recorderRef.current = startRecording(stream)
      await setRecordingStatus(matchId, 'recording', { startedAt: Date.now() })

      setPhase('live')
    } catch (err) {
      const msg =
        err instanceof DOMException
          ? 'Camera/microphone access was denied or unavailable.'
          : err instanceof Error
            ? err.message
            : 'Could not start the broadcast.'
      setError(msg)
      setPhase('idle')
      await markBroadcastFailed(matchId, msg).catch(() => {})
    }
  }

  async function handleStop() {
    setPhase('ending')
    try {
      await broadcasterRef.current?.stop()
      broadcasterRef.current = null

      if (recorderRef.current) {
        await setRecordingStatus(matchId, 'finalizing')
        const blob = await recorderRef.current.stop()
        recorderRef.current = null

        await setRecordingStatus(matchId, 'processing')
        const videoId = await createMatchVideo({ matchId, kind: 'live_recording', broadcastId: matchId })
        try {
          const url = await uploadVideo(blob, matchId)
          await updateMatchVideo(videoId, {
            status: 'ready',
            url,
            durationSec: Math.round(blob.size > 0 ? recordingDurationEstimate(broadcast) : 0),
          })
          await setRecordingStatus(matchId, 'ready', { videoId })
          toast.success('Replay is ready.')
        } catch (err) {
          const msg = err instanceof VideoUploadError ? err.message : 'Recording upload failed.'
          await updateMatchVideo(videoId, { status: 'failed' })
          await setRecordingStatus(matchId, 'failed', { error: msg })
          toast.error(msg)
        }
      }
    } finally {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      setPhase('idle')
    }
  }

  function toggleCam() {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    setCamOn(track.enabled)
  }
  function toggleMic() {
    const track = streamRef.current?.getAudioTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    setMicOn(track.enabled)
  }
  async function switchCamera() {
    if (!streamRef.current) return
    const next = facingMode === 'environment' ? 'user' : 'environment'
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: next }, audio: false })
      const newTrack = newStream.getVideoTracks()[0]
      const oldTrack = streamRef.current.getVideoTracks()[0]
      if (oldTrack) {
        streamRef.current.removeTrack(oldTrack)
        oldTrack.stop()
      }
      streamRef.current.addTrack(newTrack)
      if (videoRef.current) videoRef.current.srcObject = streamRef.current
      setFacingMode(next)
    } catch {
      toast.error('Could not switch camera.')
    }
  }

  const isLive = phase === 'live'

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Radio size={16} /> Live broadcast
          </span>
        }
        subtitle="Real peer-to-peer video from this device's camera — no separate streaming account required."
        action={isLive ? <Badge tone="red">{BROADCAST_STATUS_LABEL[broadcast?.status ?? 'live']}</Badge> : null}
      />
      <CardBody className="space-y-3">
        <div className="relative aspect-video overflow-hidden rounded-lg bg-ink-950">
          <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
          {!isLive && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-ink-400">
              Camera preview appears once you go live
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {isLive && (
          <div className="flex flex-wrap items-center gap-3 text-sm text-ink-600 dark:text-ink-300">
            <span className="inline-flex items-center gap-1">
              <Users size={14} /> {broadcast?.viewerCount ?? 0} watching
            </span>
            <span>
              Recording: {RECORDING_STATUS_LABEL[broadcast?.recording.status ?? 'not_started']}
            </span>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {phase !== 'live' && phase !== 'ending' ? (
            <Button onClick={handleStart} loading={phase === 'starting'} disabled={phase === 'starting'}>
              <Radio size={16} /> Go live
            </Button>
          ) : (
            <Button variant="danger" onClick={handleStop} loading={phase === 'ending'} disabled={phase === 'ending'}>
              Stop broadcast
            </Button>
          )}
          {isLive && (
            <>
              <Button variant="outline" size="md" onClick={toggleCam}>
                {camOn ? <Video size={16} /> : <VideoOff size={16} />}
              </Button>
              <Button variant="outline" size="md" onClick={toggleMic}>
                {micOn ? <Mic size={16} /> : <MicOff size={16} />}
              </Button>
              <Button variant="outline" size="md" onClick={switchCamera}>
                <RotateCcw size={16} />
              </Button>
            </>
          )}
        </div>
        {phase === 'ending' && (
          <p className="inline-flex items-center gap-2 text-sm text-ink-500">
            <Spinner size={14} /> Finalizing recording and uploading replay…
          </p>
        )}
      </CardBody>
    </Card>
  )
}

function recordingDurationEstimate(broadcast: Broadcast | null): number {
  if (!broadcast?.recording.startedAt) return 0
  return (Date.now() - broadcast.recording.startedAt) / 1000
}
