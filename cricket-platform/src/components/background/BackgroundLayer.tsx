import { useBgStore, bgToCss, toneAccent, configLuminance } from '@/store/bgStore'
import { useResolvedDark } from '@/store/prefsStore'

/**
 * Single global background layer rendered behind all content.
 * Layered system: base gradient/solid + two soft glow blobs whose accent
 * shifts subtly with match-state tone. Sits at -z-10 so cards stay readable.
 *
 * Dark mode: the light presets (pale blue/green gradients) don't belong on a
 * dark theme, and the old approach of laying a `multiply` blend over them left
 * the whole content area a flat, washed-out grey that didn't match the
 * `ink-900`/`ink-950` app-shell chrome. Instead we render a base built straight
 * from the ink token scale so the content viewport reads as the *same* dark
 * surface as the sidebar and header. An already-dark custom pick (e.g. the
 * "Midnight" preset) is kept exactly as the user chose it.
 */

/** ink-950 → ink-900 → ink-950. Matches `.dark body` / the app-shell chrome. */
const DARK_BASE = 'linear-gradient(135deg, #020617, #0f172a 55%, #020617)'

export function BackgroundLayer() {
  const config = useBgStore((s) => s.config)
  const tone = useBgStore((s) => s.tone)
  const accent = toneAccent(tone)
  const isDark = useResolvedDark()

  // Light mode: unchanged — whatever the user picked. Dark mode: a token-based
  // dark base, unless the pick is itself already dark (luminance well under
  // half), in which case it's honoured as-is.
  const base =
    isDark && configLuminance(config) >= 0.22 ? DARK_BASE : bgToCss(config)

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ background: base }}
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
          backgroundImage: isDark
            ? 'radial-gradient(circle at 1px 1px, rgba(148,163,184,0.05) 1px, transparent 0)'
            : 'radial-gradient(circle at 1px 1px, rgba(15,23,42,0.04) 1px, transparent 0)',
          backgroundSize: '22px 22px',
        }}
      />
    </div>
  )
}
