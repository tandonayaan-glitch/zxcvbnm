import { useEffect, useRef, useState } from 'react'
import { Palette, Plus, X, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  useBgStore,
  bgToCss,
  BG_PRESETS,
  type BgMode,
} from '@/store/bgStore'

export function BackgroundControl({ dark = false }: { dark?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { config, setConfig, setStop, addStop, removeStop, applyPreset, reset } =
    useBgStore()

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const modeBtn = (mode: BgMode, label: string) => (
    <button
      onClick={() => setConfig({ mode })}
      className={cn(
        'flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors',
        config.mode === mode
          ? 'bg-brand-600 text-white'
          : 'bg-ink-100 text-ink-600 hover:bg-ink-200',
      )}
    >
      {label}
    </button>
  )

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
          dark
            ? 'border-white/20 bg-white/10 text-white hover:bg-white/20'
            : 'border-ink-300 bg-white text-ink-700 hover:bg-ink-50',
        )}
        title="Customize background"
      >
        <Palette size={15} />
        <span className="hidden sm:inline">Background</span>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-ink-200 bg-white p-4 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-ink-900">Background</h4>
            <button
              onClick={reset}
              className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-800"
            >
              <RotateCcw size={12} /> Reset
            </button>
          </div>

          {/* live preview */}
          <div
            className="mb-3 h-16 w-full rounded-lg border border-ink-200"
            style={{ background: bgToCss(config) }}
          />

          {/* mode */}
          <div className="mb-3 flex gap-1.5">
            {modeBtn('default', 'Default')}
            {modeBtn('solid', 'Solid')}
            {modeBtn('gradient', 'Gradient')}
          </div>

          {config.mode === 'solid' && (
            <div className="mb-3">
              <ColorRow
                color={config.solid}
                onChange={(c) => setConfig({ solid: c })}
              />
            </div>
          )}

          {config.mode === 'gradient' && (
            <div className="mb-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-600">
                  Gradient stops
                </span>
                <button
                  onClick={addStop}
                  disabled={config.stops.length >= 5}
                  className="inline-flex items-center gap-1 rounded-md bg-ink-100 px-1.5 py-0.5 text-xs text-ink-700 hover:bg-ink-200 disabled:opacity-40"
                >
                  <Plus size={12} /> Add
                </button>
              </div>
              {config.stops.map((s, i) => (
                <ColorRow
                  key={i}
                  color={s}
                  onChange={(c) => setStop(i, c)}
                  onRemove={
                    config.stops.length > 2 ? () => removeStop(i) : undefined
                  }
                />
              ))}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-ink-600">Angle</span>
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={config.angle}
                  onChange={(e) => setConfig({ angle: Number(e.target.value) })}
                  className="flex-1"
                />
                <span className="w-9 text-right text-xs text-ink-500">
                  {config.angle}°
                </span>
              </div>
            </div>
          )}

          {/* presets */}
          <div className="mt-2">
            <div className="mb-1.5 text-xs font-medium text-ink-600">Presets</div>
            <div className="flex flex-wrap gap-2">
              {BG_PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => applyPreset(p.config)}
                  className="h-8 w-8 rounded-full border border-ink-200 ring-offset-1 hover:ring-2 hover:ring-brand-400"
                  style={{ background: bgToCss(p.config) }}
                  title={p.name}
                />
              ))}
            </div>
          </div>

          <p className="mt-3 text-[11px] text-ink-400">
            Saved on this device. Cards stay readable on any background.
          </p>
        </div>
      )}
    </div>
  )
}

function ColorRow({
  color,
  onChange,
  onRemove,
}: {
  color: string
  onChange: (c: string) => void
  onRemove?: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : '#ffffff'}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-9 shrink-0 cursor-pointer rounded border border-ink-300"
      />
      <input
        value={color}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#rrggbb"
        className="w-full rounded-md border border-ink-300 px-2 py-1 font-mono text-xs text-ink-800 focus:border-brand-500 focus:outline-none"
      />
      {onRemove && (
        <button
          onClick={onRemove}
          className="shrink-0 rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-red-500"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
