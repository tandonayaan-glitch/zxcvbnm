import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/primitives'

export function TermsOfServicePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <PageHeader title="Terms of Service" subtitle="Last updated: reflects the current build." />
      <Card>
        <CardBody className="prose prose-sm max-w-none space-y-4 text-sm text-ink-700 dark:text-ink-300">
          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
            This page is a starting template reflecting CricketHub's actual features. It is not a
            substitute for legal review before operating this platform commercially or at scale.
          </p>

          <h2 className="text-base font-semibold text-ink-900 dark:text-ink-50">Using CricketHub</h2>
          <p>
            CricketHub is a cricket scoring and club/tournament management platform. Accounts are
            issued by an administrator (self-signup creates a viewer-level account; scoring/admin
            access is granted by an administrator). You're responsible for keeping your password
            confidential and for the accuracy of the match data you score.
          </p>

          <h2 className="text-base font-semibold text-ink-900 dark:text-ink-50">
            Content you submit
          </h2>
          <p>
            Match scores, player and team details, and other cricket data you enter become part of
            the public record shown on this platform unless explicitly marked private. Don't submit
            content you don't have the right to share, and don't use the platform to harass,
            impersonate, or misrepresent real people or results.
          </p>

          <h2 className="text-base font-semibold text-ink-900 dark:text-ink-50">
            No warranty
          </h2>
          <p>
            CricketHub is provided "as is." Live scoring, statistics and derived analytics
            (including any heuristic estimates such as win-probability) are best-effort and may
            contain errors — they are not a substitute for official match records where those are
            required.
          </p>

          <h2 className="text-base font-semibold text-ink-900 dark:text-ink-50">
            Account suspension
          </h2>
          <p>
            An administrator may suspend or ban an account for misuse (falsified scores, abusive
            content, unauthorized access attempts). Suspended accounts lose scoring/management
            access; publicly visible historical data isn't retroactively altered.
          </p>

          <h2 className="text-base font-semibold text-ink-900 dark:text-ink-50">Changes</h2>
          <p>
            These terms may be updated as the platform evolves — see the changelog for what's
            changed recently.
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
