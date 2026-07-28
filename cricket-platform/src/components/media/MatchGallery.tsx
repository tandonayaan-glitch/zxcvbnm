import { EntityGallery } from '@/components/media/EntityGallery'

/** Match-scoped photo gallery — thin wrapper over `EntityGallery` for the `matches/{id}` Storage
 *  folder convention. */
export function MatchGallery({ matchId, canManage }: { matchId: string; canManage: boolean }) {
  return (
    <EntityGallery folder={`matches/${matchId}`} title="Match photos" canManage={canManage} />
  )
}
