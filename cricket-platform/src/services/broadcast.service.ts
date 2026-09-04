/* ==================================================================
 * Live broadcast signaling (WebRTC) + client-side recording capture.
 *
 * There is no media server in this project (no Cloudflare Stream / WHIP-WHEP
 * SFU account configured) — video goes browser-to-browser over WebRTC,
 * using Firestore purely as the signaling channel to exchange SDP offers/
 * answers and ICE candidates. This is real, live peer-to-peer video, not a
 * simulation — see the architecture note on `Broadcast` in types/index.ts
 * for exactly what that does and doesn't guarantee (mesh topology, no
 * server-side relay/recording fallback).
 * ================================================================== */
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { COL, genId, pruneUndefined } from '@/lib/collections'
import type { Broadcast, Clip, MatchVideo, RecordingStatus } from '@/types'

const RTC_CONFIG: RTCConfiguration = {
  // Public STUN only — there's no TURN relay configured (would need a paid provider), so
  // a connection between two peers both behind symmetric/strict NATs can fail to establish.
  // That failure surfaces as the viewer's connection state going 'failed', handled by callers
  // as a real, disclosed limitation rather than silently retried forever.
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

function broadcastRef(matchId: string) {
  return doc(db, COL.broadcasts, matchId)
}
function viewersCol(matchId: string) {
  return collection(db, COL.broadcasts, matchId, COL.broadcastViewers)
}
function viewerRef(matchId: string, connId: string) {
  return doc(viewersCol(matchId), connId)
}

export function subscribeBroadcast(
  matchId: string,
  cb: (b: Broadcast | null) => void,
): Unsubscribe {
  return onSnapshot(broadcastRef(matchId), (snap) => {
    cb(snap.exists() ? (snap.data() as Broadcast) : null)
  })
}

export async function getBroadcast(matchId: string): Promise<Broadcast | null> {
  const snap = await getDoc(broadcastRef(matchId))
  return snap.exists() ? (snap.data() as Broadcast) : null
}

async function setBroadcastStatus(
  matchId: string,
  patch: Partial<Broadcast>,
): Promise<void> {
  await updateDoc(broadcastRef(matchId), pruneUndefined({ ...patch, updatedAt: Date.now() }))
}

/* ------------------------- Broadcaster side ------------------------- */

export interface BroadcasterHandle {
  stop: () => Promise<void>
}

/** Starts a live broadcast: creates the `Broadcast` doc, then listens for viewer signaling
 *  docs and opens one `RTCPeerConnection` per connecting viewer, sending `localStream`'s
 *  tracks to each. Returns a handle whose `stop()` tears everything down cleanly. */
export async function startBroadcast(
  matchId: string,
  broadcasterName: string,
  localStream: MediaStream,
  onViewerCountChange: (count: number) => void,
  onError: (message: string) => void,
): Promise<BroadcasterHandle> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('You must be signed in to broadcast.')

  const now = Date.now()
  const initial: Broadcast = {
    matchId,
    status: 'starting',
    broadcasterUid: uid,
    broadcasterName,
    startedAt: now,
    endedAt: null,
    viewerCount: 0,
    recording: { status: 'not_started' },
    updatedAt: now,
  }
  await setDoc(broadcastRef(matchId), initial)

  const peers = new Map<string, RTCPeerConnection>()
  const unsubs: Unsubscribe[] = []

  const updateCount = () => onViewerCountChange(peers.size)

  const unsubViewers = onSnapshot(viewersCol(matchId), (snap) => {
    for (const change of snap.docChanges()) {
      const connId = change.doc.id
      if (change.type === 'removed') {
        peers.get(connId)?.close()
        peers.delete(connId)
        updateCount()
        continue
      }
      if (change.type !== 'added') continue
      if (peers.has(connId)) continue
      const data = change.doc.data() as { offer?: { type: RTCSdpType; sdp: string } }
      if (!data.offer) continue

      const pc = new RTCPeerConnection(RTC_CONFIG)
      peers.set(connId, pc)
      for (const track of localStream.getTracks()) pc.addTrack(track, localStream)

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') updateCount()
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          peers.delete(connId)
          updateCount()
        }
      }
      pc.onicecandidate = (e) => {
        if (!e.candidate) return
        void setDoc(
          doc(collection(viewerRef(matchId, connId), COL.broadcasterCandidates), genId('c_')),
          e.candidate.toJSON(),
        ).catch(() => {})
      }

      void (async () => {
        try {
          await pc.setRemoteDescription(data.offer as RTCSessionDescriptionInit)
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          await updateDoc(viewerRef(matchId, connId), {
            answer: { type: answer.type, sdp: answer.sdp },
            connectedAt: Date.now(),
          })
        } catch {
          onError('A viewer failed to connect.')
          pc.close()
          peers.delete(connId)
          updateCount()
        }
      })()

      const unsubCandidates = onSnapshot(
        collection(viewerRef(matchId, connId), COL.viewerCandidates),
        (candSnap) => {
          for (const c of candSnap.docChanges()) {
            if (c.type !== 'added') continue
            void pc.addIceCandidate(new RTCIceCandidate(c.doc.data() as RTCIceCandidateInit)).catch(() => {})
          }
        },
      )
      unsubs.push(unsubCandidates)
    }
  })
  unsubs.push(unsubViewers)

  await setBroadcastStatus(matchId, { status: 'live' })

  const stop = async () => {
    for (const u of unsubs) u()
    for (const pc of peers.values()) pc.close()
    peers.clear()
    await setBroadcastStatus(matchId, { status: 'ended', endedAt: Date.now(), viewerCount: 0 })
  }

  return { stop }
}

export async function markBroadcastFailed(matchId: string, message: string): Promise<void> {
  await setBroadcastStatus(matchId, { status: 'failed', error: message, endedAt: Date.now() })
}

/* --------------------------- Viewer side --------------------------- */

export interface ViewerHandle {
  leave: () => Promise<void>
}

/** Connects as a spectator to a live broadcast: creates its own `RTCPeerConnection`, writes an
 *  offer for the broadcaster to answer, and calls `onStream` once the remote video track
 *  arrives. `onStateChange` reports raw `RTCPeerConnectionState` so the UI can distinguish
 *  connecting/connected/failed rather than assuming success. */
export async function joinBroadcastAsViewer(
  matchId: string,
  onStream: (stream: MediaStream) => void,
  onStateChange: (state: RTCPeerConnectionState) => void,
): Promise<ViewerHandle> {
  const connId = genId('v_')
  const pc = new RTCPeerConnection(RTC_CONFIG)
  const remoteStream = new MediaStream()

  pc.ontrack = (e) => {
    remoteStream.addTrack(e.track)
    onStream(remoteStream)
  }
  pc.onconnectionstatechange = () => onStateChange(pc.connectionState)

  const vRef = viewerRef(matchId, connId)
  pc.onicecandidate = (e) => {
    if (!e.candidate) return
    void setDoc(
      doc(collection(vRef, COL.viewerCandidates), genId('c_')),
      e.candidate.toJSON(),
    ).catch(() => {})
  }

  const offer = await pc.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: true })
  await pc.setLocalDescription(offer)

  await setDoc(vRef, {
    id: connId,
    viewerUid: auth.currentUser?.uid ?? null,
    offer: { type: offer.type, sdp: offer.sdp },
    answer: null,
    createdAt: Date.now(),
    connectedAt: null,
  })

  const unsubDoc = onSnapshot(vRef, (snap) => {
    const data = snap.data() as { answer?: { type: RTCSdpType; sdp: string } | null } | undefined
    if (data?.answer && !pc.currentRemoteDescription) {
      void pc.setRemoteDescription(data.answer as RTCSessionDescriptionInit).catch(() => {})
    }
  })
  const unsubCandidates = onSnapshot(
    collection(vRef, COL.broadcasterCandidates),
    (candSnap) => {
      for (const c of candSnap.docChanges()) {
        if (c.type !== 'added') continue
        void pc.addIceCandidate(new RTCIceCandidate(c.doc.data() as RTCIceCandidateInit)).catch(() => {})
      }
    },
  )

  const leave = async () => {
    unsubDoc()
    unsubCandidates()
    pc.close()
    await deleteDoc(vRef).catch(() => {})
  }

  return { leave }
}

/* --------------------------- Recording --------------------------- */

export interface RecorderHandle {
  stop: () => Promise<Blob>
}

const RECORDER_MIME_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
]

function pickRecorderMimeType(): string {
  for (const m of RECORDER_MIME_CANDIDATES) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m
  }
  return ''
}

/** Captures the broadcaster's own outgoing stream locally via `MediaRecorder`, independent of
 *  whether any viewer is connected — recording continues if every spectator leaves, since it
 *  never touches the peer connections at all. It does NOT survive the broadcaster's tab/device
 *  going away before `stop()` is called — there's no server-side capture without a media
 *  provider, and this module never claims otherwise. */
export function startRecording(stream: MediaStream): RecorderHandle {
  const mimeType = pickRecorderMimeType()
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }
  recorder.start(1000)

  const stop = () =>
    new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType || 'video/webm' }))
      recorder.stop()
    })

  return { stop }
}

/* ----------------------- Broadcast doc: recording status ----------------------- */

export async function setRecordingStatus(
  matchId: string,
  status: RecordingStatus,
  patch: Partial<Broadcast['recording']> = {},
): Promise<void> {
  const b = await getBroadcast(matchId)
  await setBroadcastStatus(matchId, {
    recording: { ...(b?.recording ?? { status: 'not_started' }), status, ...patch },
  })
}

/* ----------------------------- Match videos ----------------------------- */

function videosCol() {
  return collection(db, COL.matchVideos)
}

export async function createMatchVideo(input: {
  matchId: string
  kind: MatchVideo['kind']
  broadcastId?: string | null
  title?: string
  visibility?: MatchVideo['visibility']
}): Promise<string> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('You must be signed in.')
  const ref = doc(videosCol())
  const now = Date.now()
  const video: MatchVideo = {
    id: ref.id,
    matchId: input.matchId,
    kind: input.kind,
    status: 'not_started',
    visibility: input.visibility ?? 'public',
    broadcastId: input.broadcastId ?? null,
    title: input.title,
    createdBy: uid,
    createdAt: now,
    updatedAt: now,
  }
  await setDoc(ref, pruneUndefined(video))
  return ref.id
}

export async function updateMatchVideo(id: string, patch: Partial<MatchVideo>): Promise<void> {
  await updateDoc(doc(videosCol(), id), pruneUndefined({ ...patch, updatedAt: Date.now() }))
}

export function subscribeMatchVideos(
  matchId: string,
  cb: (videos: MatchVideo[]) => void,
): Unsubscribe {
  // Client-side filter (not a query) — a match has at most a handful of videos, and this
  // avoids needing a composite index for matchId + deletedAt.
  return onSnapshot(videosCol(), (snap) => {
    cb(
      snap.docs
        .map((d) => d.data() as MatchVideo)
        .filter((v) => v.matchId === matchId && !v.deletedAt)
        .sort((a, b) => b.createdAt - a.createdAt),
    )
  })
}

/* -------------------------------- Clips -------------------------------- */

function clipsCol() {
  return collection(db, COL.clips)
}

export async function createClip(input: {
  matchId: string
  videoId: string
  title: string
  startSec: number
  endSec: number
  deliveryId?: string | null
}): Promise<string> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('You must be signed in.')
  const ref = doc(clipsCol())
  const clip: Clip = {
    id: ref.id,
    matchId: input.matchId,
    videoId: input.videoId,
    title: input.title,
    startSec: input.startSec,
    endSec: input.endSec,
    deliveryId: input.deliveryId ?? null,
    createdBy: uid,
    createdAt: Date.now(),
  }
  await setDoc(ref, pruneUndefined(clip))
  return ref.id
}

export function subscribeClips(matchId: string, cb: (clips: Clip[]) => void): Unsubscribe {
  return onSnapshot(clipsCol(), (snap) => {
    cb(
      snap.docs
        .map((d) => d.data() as Clip)
        .filter((c) => c.matchId === matchId)
        .sort((a, b) => b.createdAt - a.createdAt),
    )
  })
}

export async function deleteClip(id: string): Promise<void> {
  await deleteDoc(doc(clipsCol(), id))
}
