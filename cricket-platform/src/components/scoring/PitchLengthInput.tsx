import { useEffect, useRef, useState } from 'react'
import { BOWLING_LENGTHS, BOWLING_LINES } from '@/domain/pitchMap'
import type { BattingStyle, BowlingLength, BowlingLine } from '@/types'
import { cn } from '@/lib/cn'

/**
 * Interactive pitch map for tagging a delivery's line and length. Drag or tap on a recognisable
 * cricket pitch (top-down, batter's stumps at the bottom) — the zone under the pointer lights up
 * and the line/length labels update live. Release to drop a pitch mark there; it animates into
 * place and is saved. Passing `line`/`length` reconstructs a saved delivery: the same zones stay
 * lit and the mark reappears with a short animation.
 *
 * Columns are the 5 `BowlingLine` values, rows the 6 `BowlingLength` values, matching
 * `domain/pitchMap.ts`. Leg/off columns are mirrored for a left-hand batter so "leg side" is
 * always the batter's real leg side.
 */

const W = 260
const H = 244
const PITCH_X = 66
const PITCH_W = W - PITCH_X * 2
const PITCH_Y = 16
const PITCH_H = H - PITCH_Y - 20

const LINE_LABELS: Record<BowlingLine, string> = {
  wide_leg: 'Wide down leg',
  leg: 'Leg stump',
  stump: 'Stumps',
  outside_off: 'Outside off',
  wide_off: 'Wide outside off',
}
const LENGTH_LABELS: Record<BowlingLength, string> = {
  full_toss: 'Full toss',
  yorker: 'Yorker',
  full: 'Full',
  good: 'Good length',
  short: 'Short',
  bouncer: 'Bouncer',
}

// Rows run bottom (batter) → top (bowler): full toss at the batter's feet, bouncer landing
// shortest. This is BOWLING_LENGTHS reversed for the y-axis.
const ROWS: BowlingLength[] = [...BOWLING_LENGTHS]

function colX(i: number) {
  return PITCH_X + (i + 0.5) * (PITCH_W / BOWLING_LINES.length)
}
function rowY(i: number) {
  // i = 0 is full_toss → nearest the batter (bottom).
  return PITCH_Y + PITCH_H - (i + 0.5) * (PITCH_H / ROWS.length)
}

export function PitchLengthInput({
  line,
  length,
  battingStyle,
  onChange,
}: {
  line?: BowlingLine
  length?: BowlingLength
  battingStyle?: BattingStyle
  onChange: (v: { line: BowlingLine; length: BowlingLength }) => void
}) {
  const leftHanded = battingStyle === 'left_hand'
  const cols = leftHanded ? [...BOWLING_LINES].reverse() : BOWLING_LINES
  const svgRef = useRef<SVGSVGElement>(null)

  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [sel, setSel] = useState<{ line?: BowlingLine; length?: BowlingLength }>({ line, length })
  const [revealKey, setRevealKey] = useState(0)

  useEffect(() => {
    setSel({ line, length })
    setRevealKey((k) => k + 1)
  }, [line, length])

  function toSvg(e: React.PointerEvent) {
    const rect = svgRef.current!.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    }
  }

  function cellAt(x: number, y: number): { line: BowlingLine; length: BowlingLength } {
    const cx = Math.max(0, Math.min(BOWLING_LINES.length - 1, Math.floor((x - PITCH_X) / (PITCH_W / BOWLING_LINES.length))))
    const fromTop = Math.max(0, Math.min(ROWS.length - 1, Math.floor((y - PITCH_Y) / (PITCH_H / ROWS.length))))
    const rowIdx = ROWS.length - 1 - fromTop
    return { line: cols[cx], length: ROWS[rowIdx] }
  }

  function onPointerDown(e: React.PointerEvent) {
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* setPointerCapture can reject an already-released/synthetic pointer id */
    }
    setDragging(true)
    setDrag(toSvg(e))
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return
    setDrag(toSvg(e))
  }
  function onPointerUp(e: React.PointerEvent) {
    if (!dragging) return
    setDragging(false)
    const p = toSvg(e)
    if (p.x >= PITCH_X - 12 && p.x <= PITCH_X + PITCH_W + 12 && p.y >= PITCH_Y && p.y <= PITCH_Y + PITCH_H + 12) {
      const cell = cellAt(p.x, p.y)
      setSel(cell)
      setRevealKey((k) => k + 1)
      onChange(cell)
    }
    setDrag(null)
  }

  const live = dragging && drag ? cellAt(drag.x, drag.y) : null
  const shownLine = live?.line ?? sel.line
  const shownLength = live?.length ?? sel.length

  const colIndex = (l?: BowlingLine) => (l ? cols.indexOf(l) : -1)
  const rowIndex = (l?: BowlingLength) => (l ? ROWS.indexOf(l) : -1)

  const markX = colIndex(sel.line) >= 0 ? colX(colIndex(sel.line)) : null
  const markY = rowIndex(sel.length) >= 0 ? rowY(rowIndex(sel.length)) : null

  return (
    <div className="select-none">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="mx-auto w-full max-w-[260px] touch-none"
        role="group"
        aria-label="Pitch map — tap or drag where the ball pitched"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* pitch surface */}
        <rect
          x={PITCH_X}
          y={PITCH_Y}
          width={PITCH_W}
          height={PITCH_H}
          rx={3}
          className="fill-amber-100 stroke-amber-300 dark:fill-amber-950/50 dark:stroke-amber-800"
          strokeWidth={1.5}
        />

        {/* highlighted row (length) + column (line) bands */}
        {rowIndex(shownLength) >= 0 && (
          <rect
            x={PITCH_X}
            y={PITCH_Y + PITCH_H - (rowIndex(shownLength) + 1) * (PITCH_H / ROWS.length)}
            width={PITCH_W}
            height={PITCH_H / ROWS.length}
            className="fill-brand-400/20 transition-all duration-150"
          />
        )}
        {colIndex(shownLine) >= 0 && (
          <rect
            x={PITCH_X + colIndex(shownLine) * (PITCH_W / BOWLING_LINES.length)}
            y={PITCH_Y}
            width={PITCH_W / BOWLING_LINES.length}
            height={PITCH_H}
            className="fill-brand-400/20 transition-all duration-150"
          />
        )}

        {/* grid lines */}
        {BOWLING_LINES.map((_, i) =>
          i === 0 ? null : (
            <line
              key={`c${i}`}
              x1={PITCH_X + i * (PITCH_W / BOWLING_LINES.length)}
              y1={PITCH_Y}
              x2={PITCH_X + i * (PITCH_W / BOWLING_LINES.length)}
              y2={PITCH_Y + PITCH_H}
              className="stroke-amber-300/70 dark:stroke-amber-800/70"
              strokeWidth={0.75}
            />
          ),
        )}
        {ROWS.map((_, i) =>
          i === 0 ? null : (
            <line
              key={`r${i}`}
              x1={PITCH_X}
              y1={PITCH_Y + i * (PITCH_H / ROWS.length)}
              x2={PITCH_X + PITCH_W}
              y2={PITCH_Y + i * (PITCH_H / ROWS.length)}
              className="stroke-amber-300/70 dark:stroke-amber-800/70"
              strokeWidth={0.75}
            />
          ),
        )}

        {/* creases + stumps: bowler end (top), batter end (bottom) */}
        <line x1={PITCH_X - 6} y1={PITCH_Y + 10} x2={PITCH_X + PITCH_W + 6} y2={PITCH_Y + 10} className="stroke-ink-400 dark:stroke-ink-500" strokeWidth={1} />
        <line x1={PITCH_X - 6} y1={PITCH_Y + PITCH_H - 10} x2={PITCH_X + PITCH_W + 6} y2={PITCH_Y + PITCH_H - 10} className="stroke-ink-400 dark:stroke-ink-500" strokeWidth={1} />
        {[-4, 0, 4].map((dx) => (
          <line key={`sb${dx}`} x1={W / 2 + dx} y1={PITCH_Y + 3} x2={W / 2 + dx} y2={PITCH_Y + 10} className="stroke-ink-500 dark:stroke-ink-300" strokeWidth={1.5} />
        ))}
        {[-4, 0, 4].map((dx) => (
          <line key={`st${dx}`} x1={W / 2 + dx} y1={PITCH_Y + PITCH_H - 10} x2={W / 2 + dx} y2={PITCH_Y + PITCH_H - 3} className="stroke-ink-500 dark:stroke-ink-300" strokeWidth={1.5} />
        ))}

        {/* batter marker at the crease */}
        <circle cx={W / 2 + (leftHanded ? -12 : 12)} cy={PITCH_Y + PITCH_H - 2} r={5} className="fill-ink-600 dark:fill-ink-300" />

        {/* live pointer dot */}
        {dragging && drag && (
          <circle cx={drag.x} cy={drag.y} r={6} className="fill-brand-500/80" />
        )}

        {/* committed pitch mark */}
        {!dragging && markX != null && markY != null && (
          <g key={revealKey} className="pm-reveal">
            <ellipse cx={markX} cy={markY} rx={9} ry={6} className="fill-brand-600/90 dark:fill-brand-400/90" />
            <ellipse cx={markX} cy={markY} rx={9} ry={6} className="fill-none stroke-white/70" strokeWidth={1} />
          </g>
        )}

        {/* end labels */}
        <text x={W / 2} y={PITCH_Y - 5} textAnchor="middle" className="fill-ink-400 text-[9px] dark:fill-ink-500">
          Bowler
        </text>
        <text x={W / 2} y={H - 6} textAnchor="middle" className="fill-ink-400 text-[9px] dark:fill-ink-500">
          Batter
        </text>
        {/* leg / off side hints */}
        <text x={PITCH_X - 10} y={PITCH_Y + PITCH_H / 2} textAnchor="middle" transform={`rotate(-90 ${PITCH_X - 10} ${PITCH_Y + PITCH_H / 2})`} className="fill-ink-400 text-[9px] dark:fill-ink-500">
          {leftHanded ? 'Off side' : 'Leg side'}
        </text>
        <text x={PITCH_X + PITCH_W + 10} y={PITCH_Y + PITCH_H / 2} textAnchor="middle" transform={`rotate(90 ${PITCH_X + PITCH_W + 10} ${PITCH_Y + PITCH_H / 2})`} className="fill-ink-400 text-[9px] dark:fill-ink-500">
          {leftHanded ? 'Leg side' : 'Off side'}
        </text>

        <style>{`
          .pm-reveal { animation: pmReveal 240ms ease-out; transform-box: fill-box; transform-origin: center; }
          @keyframes pmReveal { from { opacity: 0; transform: scale(0.4); } to { opacity: 1; transform: scale(1); } }
        `}</style>
      </svg>

      <div className="mt-1 flex items-center justify-center gap-2 text-[11px] text-ink-500 dark:text-ink-400">
        {shownLine || shownLength ? (
          <>
            <span
              className={cn(
                'rounded px-1.5 py-0.5 font-semibold',
                shownLength ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300' : 'text-ink-400',
              )}
            >
              {shownLength ? LENGTH_LABELS[shownLength] : 'Length?'}
            </span>
            <span
              className={cn(
                'rounded px-1.5 py-0.5 font-semibold',
                shownLine ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300' : 'text-ink-400',
              )}
            >
              {shownLine ? LINE_LABELS[shownLine] : 'Line?'}
            </span>
          </>
        ) : (
          'Tap or drag where the ball pitched'
        )}
      </div>
    </div>
  )
}
