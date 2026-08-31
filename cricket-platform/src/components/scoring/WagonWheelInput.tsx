import { useEffect, useRef, useState } from 'react'
import type { BattingStyle, ShotZone } from '@/types'
import { usePrefsStore } from '@/store/prefsStore'
import { cn } from '@/lib/cn'

/**
 * Interactive wagon wheel for tagging where a shot went. Drag outward from the batter (mouse or
 * touch) — including an upward "down the ground" swipe — and the trajectory ray follows the
 * pointer live while the sector under it lights up. Release to lock it in: the ray draws itself
 * out from the batter and the marker travels along it to land in that sector (a real placement
 * motion, not a static reveal). Tapping a sector selects it directly (a zero-length drag).
 * Passing `value` reconstructs a previously saved shot — same sector, same marker — replaying
 * the same placement animation so a reopened ball visibly shows where it went.
 *
 * `ShotZone` is 1–8 clockwise from straight-down-the-ground, with 4/5 straddling the straight
 * boundary and 8/1 straddling straight-behind (see `src/types`). Leg/off are mirrored for a
 * left-hand batter so "drag to leg side" always means the batter's own leg side.
 */

const SIZE = 260
const C = SIZE / 2
const R_OUTER = 116
const R_INNER = 16
const MIN_DRAG = 14 // px in svg units before a drag counts as a direction (below this = a tap)

const ZONE_LABELS: Record<ShotZone, string> = {
  1: 'Fine leg',
  2: 'Square leg',
  3: 'Mid-wicket',
  4: 'Long-on',
  5: 'Long-off',
  6: 'Extra cover',
  7: 'Point',
  8: 'Third man',
}

/** Zones ordered by the 45° slice they occupy, starting at due-south (behind the batter) and
 *  going clockwise. Index = floor(angleFromSouthClockwise / 45). */
const ZONE_BY_SLICE: ShotZone[] = [1, 2, 3, 4, 5, 6, 7, 8]

function zoneCenterAngleDeg(zone: ShotZone): number {
  // Midpoint of the zone's slice, measured clockwise from due-south.
  return (ZONE_BY_SLICE.indexOf(zone) + 0.5) * 45
}

/** svg point for a zone's marker, at a given radius, honouring batting hand. */
function zonePoint(zone: ShotZone, radius: number, leftHanded: boolean) {
  return angleToPoint(zoneCenterAngleDeg(zone), radius, leftHanded)
}

/** Convert "degrees clockwise from due-south" to an svg coordinate. Left-hand batters see the
 *  wheel mirrored so leg/off stay on the batter's real sides. */
function angleToPoint(angleClockwiseFromSouth: number, radius: number, leftHanded: boolean) {
  const a = (angleClockwiseFromSouth * (leftHanded ? -1 : 1) * Math.PI) / 180
  // due-south is (0, +1); clockwise rotation for a right-hander moves toward -x (west).
  return {
    x: C - Math.sin(a) * radius,
    y: C + Math.cos(a) * radius,
  }
}

function zoneFromPoint(x: number, y: number, leftHanded: boolean): ShotZone {
  const dx = x - C
  const dy = y - C
  // angle clockwise from due-south; mirror x for a left-hander.
  const deg =
    (Math.atan2((leftHanded ? -1 : 1) * -dx, dy) * 180) / Math.PI
  const norm = ((deg % 360) + 360) % 360
  return ZONE_BY_SLICE[Math.min(7, Math.floor(norm / 45))]
}

function sectorPath(zone: ShotZone, radius: number, leftHanded: boolean): string {
  const startDeg = ZONE_BY_SLICE.indexOf(zone) * 45
  const p1 = angleToPoint(startDeg, radius, leftHanded)
  const p2 = angleToPoint(startDeg + 45, radius, leftHanded)
  const sweep = leftHanded ? 0 : 1
  return `M ${C} ${C} L ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${radius} ${radius} 0 0 ${sweep} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} Z`
}

export function WagonWheelInput({
  value,
  battingStyle,
  onChange,
}: {
  value?: ShotZone
  battingStyle?: BattingStyle
  onChange: (zone: ShotZone) => void
}) {
  const leftHanded = battingStyle === 'left_hand'
  const reducedMotion = usePrefsStore((s) => s.prefs.reducedMotion)
  const svgRef = useRef<SVGSVGElement>(null)
  // Ref mirror of `dragging` so a fast flick (pointerdown → pointerup before React re-renders)
  // still commits — the state is only for rendering the live ray.
  const draggingRef = useRef(false)
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [committed, setCommitted] = useState<ShotZone | undefined>(value)
  // Re-key the reveal animation whenever the reconstructed value changes.
  const [revealKey, setRevealKey] = useState(0)

  useEffect(() => {
    setCommitted(value)
    setRevealKey((k) => k + 1)
  }, [value])

  function toSvg(e: React.PointerEvent): { x: number; y: number } {
    const rect = svgRef.current!.getBoundingClientRect()
    const scale = SIZE / rect.width
    return { x: (e.clientX - rect.left) * scale, y: (e.clientY - rect.top) * scale }
  }

  function onPointerDown(e: React.PointerEvent) {
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* setPointerCapture can reject an already-released/synthetic pointer id */
    }
    draggingRef.current = true
    setDragging(true)
    setDrag(toSvg(e))
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!draggingRef.current) return
    setDrag(toSvg(e))
  }
  function onPointerUp(e: React.PointerEvent) {
    if (!draggingRef.current) return
    draggingRef.current = false
    setDragging(false)
    const p = toSvg(e)
    const dist = Math.hypot(p.x - C, p.y - C)
    // A tap on a sector still counts (it's a zero-length drag); a tap on the batter in the
    // dead centre doesn't, so you can't set an accidental direction by touching the middle.
    if (dist >= R_INNER) {
      const zone = zoneFromPoint(p.x, p.y, leftHanded)
      setCommitted(zone)
      setRevealKey((k) => k + 1)
      onChange(zone)
    }
    setDrag(null)
  }

  const liveDist = drag ? Math.hypot(drag.x - C, drag.y - C) : 0
  const liveZone =
    drag && (liveDist >= MIN_DRAG || dragging)
      ? zoneFromPoint(drag.x, drag.y, leftHanded)
      : undefined
  const highlightZone = liveZone ?? committed

  // Endpoint of the "locked-in" ray/marker.
  const marker = committed != null ? zonePoint(committed, R_OUTER - 12, leftHanded) : null
  // Endpoint of the live ray while dragging (clamped to the wheel).
  const liveEnd = drag
    ? (() => {
        const dx = drag.x - C
        const dy = drag.y - C
        const d = Math.max(1, Math.hypot(dx, dy))
        const r = Math.min(d, R_OUTER - 4)
        return { x: C + (dx / d) * r, y: C + (dy / d) * r }
      })()
    : null

  const labelPos = highlightZone
    ? zonePoint(highlightZone, R_OUTER + 0.5, leftHanded)
    : null

  return (
    <div className="select-none">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="mx-auto w-full max-w-[260px] touch-none"
        role="group"
        aria-label="Wagon wheel — drag from the batter toward where the shot went"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* field */}
        <circle cx={C} cy={C} r={R_OUTER} className="fill-pitch-50 stroke-pitch-300 dark:fill-pitch-950/40 dark:stroke-pitch-800" strokeWidth={1.5} />
        <circle cx={C} cy={C} r={R_OUTER * 0.6} className="fill-none stroke-pitch-200 dark:stroke-pitch-900" strokeWidth={1} strokeDasharray="3 4" />

        {/* sectors (each individually selectable) */}
        {ZONE_BY_SLICE.map((z) => {
          const active = highlightZone === z
          return (
            <path
              key={z}
              d={sectorPath(z, R_OUTER, leftHanded)}
              className={cn(
                'transition-colors duration-150',
                active
                  ? 'fill-brand-400/40 stroke-brand-500'
                  : 'fill-transparent stroke-pitch-200/70 dark:stroke-pitch-800/70 hover:fill-brand-400/10',
              )}
              strokeWidth={active ? 1.5 : 0.75}
            />
          )
        })}

        {/* pitch strip runs "up the ground" toward the bowler at the top; the batter is at
            centre, so straight-down-the-ground is straight up on screen (long-on / long-off
            boundary) and fine leg / third man sit behind, toward the bottom. */}
        <rect x={C - 7} y={C - 44} width={14} height={48} rx={2} className="fill-amber-100 stroke-amber-300 dark:fill-amber-950/50 dark:stroke-amber-800" strokeWidth={0.75} />
        {[-3, 0, 3].map((dx) => (
          <line key={dx} x1={C + dx} y1={C - 44} x2={C + dx} y2={C - 40} className="stroke-ink-400 dark:stroke-ink-500" strokeWidth={1} />
        ))}
        <circle cx={C} cy={C} r={R_INNER} className="fill-white stroke-ink-300 dark:fill-ink-900 dark:stroke-ink-700" strokeWidth={1.5} />
        <circle cx={C} cy={C} r={4} className="fill-ink-700 dark:fill-ink-200" />
        {/* a little bat, on the batter's off side */}
        <line x1={C + (leftHanded ? -4 : 4)} y1={C - 3} x2={C + (leftHanded ? -11 : 11)} y2={C + 7} className="stroke-ink-500 dark:stroke-ink-300" strokeWidth={2.5} strokeLinecap="round" />

        {/* live drag ray */}
        {dragging && liveEnd && (
          <g>
            <line
              x1={C}
              y1={C}
              x2={liveEnd.x}
              y2={liveEnd.y}
              className="stroke-brand-500"
              strokeWidth={3}
              strokeLinecap="round"
            />
            <circle cx={liveEnd.x} cy={liveEnd.y} r={5} className="fill-brand-500" />
          </g>
        )}

        {/* committed ray + marker — the marker travels from the batter out along the ray to
            its landing sector. Replays whenever `revealKey` changes (a fresh commit, or a
            saved value being reconstructed). SMIL is used rather than a CSS keyframe because
            it animates the geometry itself and re-fires cleanly on the keyed remount; when the
            user prefers reduced motion it's dropped entirely and the marker is drawn in place. */}
        {!dragging && committed != null && marker && (() => {
          const rayLen = Math.hypot(marker.x - C, marker.y - C)
          return (
            <g key={revealKey}>
              <line
                x1={C}
                y1={C}
                x2={marker.x}
                y2={marker.y}
                className="stroke-brand-600 dark:stroke-brand-400"
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray={rayLen}
                strokeDashoffset={reducedMotion ? 0 : rayLen}
              >
                {!reducedMotion && (
                  <animate
                    attributeName="stroke-dashoffset"
                    from={rayLen}
                    to="0"
                    dur="0.34s"
                    begin="0s"
                    fill="freeze"
                    calcMode="spline"
                    keyTimes="0;1"
                    keySplines="0.4 0 0.2 1"
                  />
                )}
              </line>
              <circle
                cx={marker.x}
                cy={marker.y}
                r={6}
                className="fill-brand-600 dark:fill-brand-400"
              >
                {!reducedMotion && (
                  <>
                    {/* keySplines must stay within [0,1] on both axes — SMIL rejects the
                        overshoot control points CSS cubic-bezier() would allow. This is a
                        strong ease-out (decelerate into place). */}
                    <animate attributeName="cx" from={C} to={marker.x} dur="0.42s" begin="0s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.16 1 0.3 1" />
                    <animate attributeName="cy" from={C} to={marker.y} dur="0.42s" begin="0s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.16 1 0.3 1" />
                    {/* a quick pop on the radius: grow past 6 then settle back */}
                    <animate attributeName="r" values="3;7;6" dur="0.42s" begin="0s" fill="freeze" calcMode="spline" keyTimes="0;0.65;1" keySplines="0.2 0.8 0.3 1;0.4 0 0.6 1" />
                  </>
                )}
              </circle>
            </g>
          )
        })()}

        {/* current zone label */}
        {labelPos && highlightZone && (
          <text
            x={Math.max(30, Math.min(SIZE - 30, labelPos.x))}
            y={Math.max(12, Math.min(SIZE - 6, labelPos.y))}
            textAnchor="middle"
            className="fill-ink-700 text-[11px] font-semibold dark:fill-ink-200"
          >
            {ZONE_LABELS[highlightZone]}
          </text>
        )}

      </svg>

      <div className="mt-1 text-center text-[11px] text-ink-500 dark:text-ink-400">
        {committed != null ? (
          <>
            Shot placement: <span className="font-semibold text-ink-700 dark:text-ink-200">{ZONE_LABELS[committed]}</span>
            {leftHanded && <span className="ml-1 text-ink-400">(left-hand)</span>}
          </>
        ) : (
          'Drag from the batter toward where the shot went'
        )}
      </div>
    </div>
  )
}
