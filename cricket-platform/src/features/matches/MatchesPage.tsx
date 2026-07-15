import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Swords, Trash2, Radio, Eye, Play, Pencil, Archive, ArchiveRestore, Upload } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LiveBadge,
  PageLoader,
} from '@/components/ui/primitives'
import { Tabs } from '@/components/ui/Tabs'
import { useAsync } from '@/hooks/useAsync'
import { usePaginated } from '@/hooks/usePaginated'
import { Pagination } from '@/components/ui/Pagination'
import { useToast } from '@/components/ui/toast'
import { listAllMatches, updateMatch } from '@/services/matches.service'
import { softDelete } from '@/services/trash.service'
import { importMatch } from '@/services/matchImport.service'
import { useAuthStore, canScore, ownerScope } from '@/store/authStore'
import { formatDate, ballsToOvers } from '@/lib/format'
import { MatchImportModal } from './MatchImportModal'
import type { InningsState, Match, MatchStatus } from '@/types'

function inningsLine(inn: InningsState, ballsPerOver: number): string {
  return `${inn.totalRuns}/${inn.wickets} (${ballsToOvers(inn.legalBalls, ballsPerOver)})`
}

export function MatchesPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const profile = useAuthStore((s) => s.profile)
  const scope = ownerScope(profile)
  const matches = useAsync(listAllMatches, [])
  const [tab, setTab] = useState<'all' | MatchStatus | 'archived'>('all')
  const [importOpen, setImportOpen] = useState(false)

  const filtered = useMemo(() => {
    let list = matches.data ?? []
    if (scope) list = list.filter((m) => m.ownerId === scope)
    if (tab === 'archived') return list.filter((m) => m.archived)
    list = list.filter((m) => !m.archived)
    if (tab === 'all') return list
    if (tab === 'live')
      return list.filter((m) => m.status === 'live' || m.status === 'innings_break')
    return list.filter((m) => m.status === tab)
  }, [matches.data, tab, scope])

  const { page, setPage, pageCount, pageItems, totalItems, pageSize } =
    usePaginated(filtered, 15)

  async function handleDelete(m: Match) {
    if (!confirm(`Move "${m.title}" to Trash? You can restore it from Trash later.`)) return
    await softDelete('match', m.id, profile)
    toast.success('Match moved to Trash')
    matches.refetch()
  }

  async function toggleArchive(m: Match) {
    await updateMatch(m.id, { archived: !m.archived })
    toast.success(m.archived ? 'Match unarchived' : 'Match archived')
    matches.refetch()
  }

  async function handleImport(json: string) {
    if (!profile) return
    const id = await importMatch(json, profile.id)
    toast.success('Match imported (archived — review then unarchive to publish)')
    setImportOpen(false)
    matches.refetch()
    navigate(`/match/${id}`)
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Matches"
        subtitle="Set up matches, score them live and publish scorecards."
        actions={
          canScore(profile) && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload size={16} /> Import
              </Button>
              <Button onClick={() => navigate('/matches/new')}>
                <Plus size={16} /> New match
              </Button>
            </div>
          )
        }
      />

      <Tabs
        className="mb-4"
        active={tab}
        onChange={(k) => setTab(k as typeof tab)}
        tabs={[
          { key: 'all', label: 'All' },
          { key: 'live', label: 'Live' },
          { key: 'setup', label: 'Upcoming' },
          { key: 'completed', label: 'Completed' },
          { key: 'archived', label: 'Archived' },
        ]}
      />

      <MatchImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleImport}
      />

      {matches.loading ? (
        <PageLoader />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Swords size={40} />}
          title="No matches here"
          description="Create a match to start scoring."
          action={
            canScore(profile) && (
              <Button onClick={() => navigate('/matches/new')}>
                <Plus size={16} /> New match
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-3">
          {pageItems.map((m) => {
            const live = m.status === 'live' || m.status === 'innings_break'
            return (
              <Card key={m.id} className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                      {live ? (
                        <LiveBadge />
                      ) : m.status === 'completed' ? (
                        <Badge tone="gray">Completed</Badge>
                      ) : m.status === 'abandoned' ? (
                        <Badge tone="red">Abandoned</Badge>
                      ) : (
                        <Badge tone="amber">Upcoming</Badge>
                      )}
                      {m.archived && <Badge tone="gray">Archived</Badge>}
                      {m.tournamentName && (
                        <span className="text-xs text-ink-400 dark:text-ink-500">
                          {m.tournamentName}
                        </span>
                      )}
                    </div>
                    <Link
                      to={`/match/${m.id}`}
                      className="font-semibold text-ink-900 dark:text-ink-50 hover:text-brand-700"
                    >
                      {m.teamA.name} vs {m.teamB.name}
                    </Link>
                    <div className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
                      {m.format} · {m.oversPerInnings} overs ·{' '}
                      {m.venue || 'Venue TBD'} · {formatDate(m.scheduledAt ?? m.createdAt)}
                    </div>
                    {m.innings.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium text-ink-700 dark:text-ink-300">
                        {m.innings.map((inn, i) => (
                          <span key={i}>
                            {inn.battingTeamId === m.teamA.id
                              ? m.teamA.shortName
                              : m.teamB.shortName}
                            : {inningsLine(inn, m.ballsPerOver)}
                          </span>
                        ))}
                      </div>
                    )}
                    {m.result && (
                      <div className="mt-1 text-sm font-semibold text-pitch-700">
                        {m.result.summary}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Link
                      to={`/match/${m.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300 dark:border-ink-700 px-3 py-2 text-sm font-medium text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800"
                    >
                      <Eye size={15} /> View
                    </Link>
                    {canScore(profile) && live && (
                      <Link
                        to={`/scoring/${m.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
                      >
                        <Radio size={15} /> Score
                      </Link>
                    )}
                    {canScore(profile) && m.status === 'setup' && (
                      <>
                        <Link
                          to={`/matches/new?edit=${m.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-300 dark:border-ink-700 px-3 py-2 text-sm font-medium text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800"
                        >
                          <Pencil size={15} /> Edit
                        </Link>
                        <Link
                          to={`/scoring/${m.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-pitch-600 px-3 py-2 text-sm font-semibold text-white hover:bg-pitch-700"
                        >
                          <Play size={15} /> Start
                        </Link>
                      </>
                    )}
                    {canScore(profile) && !live && (
                      <button
                        onClick={() => toggleArchive(m)}
                        aria-label={`${m.archived ? 'Unarchive' : 'Archive'} ${m.title}`}
                        title={m.archived ? 'Unarchive' : 'Archive'}
                        className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 dark:text-ink-400 dark:hover:bg-ink-800"
                      >
                        {m.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                      </button>
                    )}
                    {canScore(profile) && (
                      <button
                        onClick={() => handleDelete(m)}
                        aria-label={`Delete ${m.title}`}
                        title="Delete"
                        className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {filtered.length > 0 && (
        <Card className="mt-3">
          <Pagination
            page={page}
            pageCount={pageCount}
            totalItems={totalItems}
            pageSize={pageSize}
            onChange={setPage}
          />
        </Card>
      )}
    </div>
  )
}
