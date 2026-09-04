/* ==================================================================
 * Pure helpers for the media/broadcast engine's state machines. No I/O —
 * see services/broadcast.service.ts for the Firestore/WebRTC side.
 * ================================================================== */
import type { Broadcast, BroadcastStatus, RecordingStatus } from '@/types'

export function isBroadcastLive(status: BroadcastStatus): boolean {
  return status === 'live' || status === 'reconnecting' || status === 'paused'
}

export function canStartBroadcast(status: BroadcastStatus | undefined): boolean {
  return !status || status === 'not_started' || status === 'ended' || status === 'failed'
}

export const BROADCAST_STATUS_LABEL: Record<BroadcastStatus, string> = {
  not_started: 'Not started',
  starting: 'Starting…',
  live: 'LIVE',
  reconnecting: 'Reconnecting…',
  paused: 'Paused',
  ending: 'Ending…',
  ended: 'Ended',
  failed: 'Failed',
}

export const RECORDING_STATUS_LABEL: Record<RecordingStatus, string> = {
  not_started: 'Not started',
  starting: 'Starting…',
  recording: 'Recording',
  finalizing: 'Finalizing…',
  processing: 'Processing…',
  ready: 'Replay ready',
  failed: 'Recording failed',
  deleted: 'Deleted',
}

/** A recording is only safe to offer for playback once it's actually `ready` — never show
 *  "Replay Ready" from any other state, per the platform's explicit no-fake-progress rule. */
export function isRecordingReady(status: RecordingStatus): boolean {
  return status === 'ready'
}

/** Seconds elapsed since a live broadcast's recording began, for automatic ball-to-video
 *  timestamping. Returns null when there's no live recording to time against — callers must
 *  never fabricate a timestamp when this is null. */
export function recordingElapsedSec(broadcast: Broadcast | null, atMs: number): number | null {
  if (!broadcast) return null
  if (broadcast.recording.status !== 'recording') return null
  if (!broadcast.recording.startedAt) return null
  const elapsed = (atMs - broadcast.recording.startedAt) / 1000
  return elapsed >= 0 ? Math.round(elapsed) : null
}

export function formatDuration(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const mm = String(m).padStart(h > 0 ? 2 : 1, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}
