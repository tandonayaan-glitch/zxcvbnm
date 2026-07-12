import { useBgStore, bgToCss, toneAccent, configLuminance } from '@/store/bgStore'
import { useResolvedDark } from '@/store/prefsStore'

/**
 * Single global background layer rendered behind all content.
 * Layered system: base gradient/solid + two soft glow blobs whose accent
 * shifts subtly with match-state tone. Sits at -z-10 so cards stay readable.
 */
export function BackgroundLayer() {
  const config = useBgStore((s) => s.config)
  const tone = useBgStore((s) => s.tone)
  const accent = toneAccent(tone)
  const isDark = useResolvedDark()

  // Darken proportionally to how light the chosen background already is —
  // an already-dark pick (e.g. the "Midnight" preset) needs little to no
  // extra darkening, while light pastel ones need a lot. Never applied in
  // light mode, so every existing background looks exactly as before there.
  const luminance = configLuminance(config)
  const overlayOpacity = isDark ? Math.max(0, Math.min(0.85, (luminance - 0.08) * 1.05)) : 0

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
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          backgroundColor: '#04060c',
          mixBlendMode: 'multiply',
          opacity: overlayOpacity,
        }}
      />
    </div>
  )
}
