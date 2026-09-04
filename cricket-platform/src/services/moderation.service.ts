import { collection, doc, getDocs, setDoc, updateDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { COL, genId, pruneUndefined } from '@/lib/collections'
import type { ContentReport, ReportTargetType, ReportStatus } from '@/types'

function reportsCol() {
  return collection(db, COL.contentReports)
}

export async function reportContent(
  targetType: ReportTargetType,
  targetId: string,
  reason: string,
): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('You must be signed in to report content.')
  const id = genId('rpt_')
  const report: ContentReport = {
    id,
    targetType,
    targetId,
    reason,
    reporterId: uid,
    status: 'pending',
    createdAt: Date.now(),
  }
  await setDoc(doc(reportsCol(), id), pruneUndefined(report))
}

/** Master-admin only (enforced by firestore.rules) — every report, newest first. */
export async function listAllReports(): Promise<ContentReport[]> {
  const snap = await getDocs(reportsCol())
  return snap.docs.map((d) => d.data() as ContentReport).sort((a, b) => b.createdAt - a.createdAt)
}

export function subscribeAllReports(cb: (reports: ContentReport[]) => void): Unsubscribe {
  return onSnapshot(reportsCol(), (snap) => {
    cb(snap.docs.map((d) => d.data() as ContentReport).sort((a, b) => b.createdAt - a.createdAt))
  })
}

export async function setReportStatus(id: string, status: ReportStatus): Promise<void> {
  const uid = auth.currentUser?.uid
  await updateDoc(doc(reportsCol(), id), { status, reviewedAt: Date.now(), reviewedBy: uid ?? null })
}
