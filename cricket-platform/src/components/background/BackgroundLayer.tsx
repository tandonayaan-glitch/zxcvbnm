import { useBgStore, bgToCss, toneAccent } from '@/store/bgStore'

/**
 * Single global background layer rendered behind all content.
 * Layered system: base gradient/solid + two soft glow blobs whose accent
 * shifts subtly with match-state tone. Sits at -z-10 so cards stay readable.
 */
export function BackgroundLayer() {
  const config = useBgStore((s) => s.config)
  const tone = useBgStore((s) => s.tone)
  const accent = toneAccent(tone)

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ background: bgToCss(config) }}
    >
      <div
        className="absolute -left-32 -top-32 h-96 w-96 rounded-full blur-3xl"
        style={{ background: accent.a }}
      />
      <div
        className="absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full blur-3xl"
        style={{ background: accent.b }}
      />
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(15,23,42,0.04) 1px, transparent 0)',
          backgroundSize: '22px 22px',
        }}
      />
    </div>
  )
}
