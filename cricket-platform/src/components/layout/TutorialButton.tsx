import { useEffect, useState, type ReactNode } from 'react'
import {
  HelpCircle,
  LayoutDashboard,
  Swords,
  Radio,
  Trophy,
  Phone,
  LayoutGrid,
  Star,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/primitives'
import { cn } from '@/lib/cn'

const SEEN_KEY = 'crickethub.tutorial.seen'

function hasSeenTutorial(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

function markTutorialSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1')
  } catch {
    /* ignore */
  }
}

interface Step {
  icon: ReactNode
  title: string
  body: string
}

const STEPS: Step[] = [
  {
    icon: <LayoutDashboard size={28} />,
    title: 'Your dashboard',
    body: 'Live matches, recent results, top performers and more — all in one place, right after you sign in. Drag widgets around or hide the ones you don’t need with "Customize".',
  },
  {
    icon: <Swords size={28} />,
    title: 'Create a match',
    body: '"New match" walks you through picking teams, squads and match rules in a few short steps — ready to score in under a minute.',
  },
  {
    icon: <Radio size={28} />,
    title: 'Score ball by ball',
    body: 'The live scoring screen updates the scorecard, commentary and stats in real time as you go, with Undo always one tap away.',
  },
  {
    icon: <Trophy size={28} />,
    title: 'Tournaments',
    body: 'Run leagues and knockouts with fixtures, standings and a public tournament page that anyone can follow — no sign-in needed to watch.',
  },
  {
    icon: <Phone size={28} />,
    title: 'Becoming a Tournament Manager',
    body: 'Hosting your own tournament needs a verified phone number and Tournament Manager access. Verify your phone and request access from Account Settings.',
  },
  {
    icon: <LayoutGrid size={28} />,
    title: 'Tournament dashboard',
    body: 'Once you manage a tournament, a "Tournament" tab appears next to your dashboard’s "Global" tab (or swipe on mobile) — the same dashboard, scoped to just your tournament.',
  },
  {
    icon: <Star size={28} />,
    title: 'Premium features',
    body: 'Some analytics and tools are part of CricketHub Premium. Wherever a feature is locked, you’ll see exactly what it unlocks and can upgrade from there.',
  },
]

/** Header button that opens a first-time-user walkthrough (auto-opens once per
 *  browser for anyone who hasn't seen it), and can be reopened any time after —
 *  same self-contained button+Modal shape as `WhatsNewButton`, one flag in
 *  localStorage rather than a Firestore field, matching this codebase's existing
 *  local-only pattern for personal, low-stakes UI state (`favStore`,
 *  `dashboardLayoutStore`, `WhatsNewButton`'s own "seen version" flag). */
export function TutorialButton() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!hasSeenTutorial()) setOpen(true)
  }, [])

  function close() {
    markTutorialSeen()
    setOpen(false)
    setStep(0)
  }

  function replay() {
    setStep(0)
    setOpen(true)
  }

  const isLast = step === STEPS.length - 1
  const current = STEPS[step]

  return (
    <>
      <button
        onClick={replay}
        aria-label="Show tutorial"
        title="Show tutorial"
        className="rounded-md p-2 text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800"
      >
        <HelpCircle size={18} />
      </button>

      <Modal
        open={open}
        onClose={close}
        title="Welcome to CricketHub"
        size="sm"
        footer={
          <div className="flex w-full items-center justify-between">
            <Button variant="ghost" size="sm" onClick={close}>
              Skip
            </Button>
            <div className="flex items-center gap-2">
              {step > 0 && (
                <Button variant="outline" size="sm" onClick={() => setStep((s) => s - 1)}>
                  Back
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => (isLast ? close() : setStep((s) => s + 1))}
              >
                {isLast ? 'Get started' : 'Next'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
            {current.icon}
          </span>
          <h4 className="text-base font-semibold text-ink-900 dark:text-ink-50">
            {current.title}
          </h4>
          <p className="text-sm text-ink-600 dark:text-ink-400">{current.body}</p>
          <div className="mt-2 flex gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  i === step ? 'bg-brand-500' : 'bg-ink-200 dark:bg-ink-700',
                )}
              />
            ))}
          </div>
        </div>
      </Modal>
    </>
  )
}
