import { ballsToOvers, runRate } from '@/lib/format'
import type { Match } from '@/types'

/**
 * Broadcast-style score overlay (a "lower third") for the live video — real data straight from
 * the same authoritative `Match`/`InningsState` the scoring engine writes, not a separate
 * presentation model. Rendered as a plain absolutely-positioned HTML overlay on top of the
 * `<video>` element (no canvas/compositing — this is a browser overlay, not baked into the
 * video stream itself, so it only appears to viewers watching on this site, not to anyone who
 * screen-records or re-streams the raw feed elsewhere).
 */
export function ScoreOverlay({ match, name }: { match: Match; name: (id?: string | null) => string }) {
  const inn = match.innings[match.currentInnings]
  if (!inn) return null

  const battingShort = inn.battingTeamId === match.teamA.id ? match.teamA.shortName : match.teamB.shortName
  const crr = runRate(inn.totalRuns, inn.legalBalls, match.ballsPerOver)
  const overs = ballsToOvers(inn.legalBalls, match.ballsPerOver)

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/60 to-transparent px-3 pb-2 pt-8 text-white">
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-white/70">{battingShort}</div>
          <div className="text-2xl font-extrabold leading-none">
            {inn.totalRuns}/{inn.wickets}
            <span className="ml-1.5 text-sm font-medium text-white/70">({overs} ov)</span>
          </div>
          {inn.strikerId && (
            <div className="mt-1 text-xs text-white/80">
              {name(inn.strikerId)}* · {name(inn.nonStrikerId)}
            </div>
          )}
        </div>
        <div className="text-right text-xs text-white/80">
          <div>CRR {crr.toFixed(2)}</div>
          {inn.bowlerId && <div className="mt-0.5">{name(inn.bowlerId)} bowling</div>}
          {inn.target != null && <div className="mt-0.5 font-semibold text-amber-300">Target {inn.target}</div>}
        </div>
      </div>
    </div>
  )
}
