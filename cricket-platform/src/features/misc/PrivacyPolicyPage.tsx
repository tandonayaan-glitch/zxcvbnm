import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardBody } from '@/components/ui/primitives'

export function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <PageHeader title="Privacy Policy" subtitle="Last updated: reflects the current build." />
      <Card>
        <CardBody className="prose prose-sm max-w-none space-y-4 text-sm text-ink-700 dark:text-ink-300">
          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
            This page describes what CricketHub actually stores and how, based on the app's real
            implementation. It is a starting template, not a substitute for legal review before
            operating this platform commercially or at scale.
          </p>

          <h2 className="text-base font-semibold text-ink-900 dark:text-ink-50">What we store</h2>
          <p>
            Cricket data — players, teams, clubs, tournaments, matches and ball-by-ball scoring —
            is stored in Firestore and, unless explicitly marked private, is public by design: this
            is how the site publishes live scores and statistics. Account data (username, display
            name, bio, email if you add one) is stored separately and is <strong>not</strong> shown
            on the public site; only your display name appears where you're credited as a scorer.
            Passwords are managed entirely by Firebase Authentication — nobody at CricketHub,
            including administrators, can see or recover your password.
          </p>

          <h2 className="text-base font-semibold text-ink-900 dark:text-ink-50">
            Who can see what
          </h2>
          <p>
            Your account (username, bio, email) is visible to other administrators on the Users
            &amp; Roles page, since managing access requires it. It is never shown on the public
            viewer site. Cricket data you create — players, teams, matches you score — is public
            unless a match is explicitly marked private.
          </p>

          <h2 className="text-base font-semibold text-ink-900 dark:text-ink-50">
            Your controls
          </h2>
          <ul className="list-inside list-disc space-y-1">
            <li>Export a copy of your account data as JSON at any time, from Settings.</li>
            <li>Change your password, display name, bio and email from Settings.</li>
            <li>
              Clear your email at any time if you'd rather CricketHub not store one for you.
            </li>
            <li>Sign out of your current session from Settings.</li>
          </ul>

          <h2 className="text-base font-semibold text-ink-900 dark:text-ink-50">
            What we don't do
          </h2>
          <p>
            CricketHub doesn't run advertising, doesn't sell data to third parties, and doesn't use
            third-party analytics/tracking cookies. Notifications, activity feeds and audit logs
            record actions taken within the app (e.g. "player merged," "admin request approved")
            for administrators, not behavioural tracking.
          </p>

          <h2 className="text-base font-semibold text-ink-900 dark:text-ink-50">
            Account deletion
          </h2>
          <p>
            To request deletion of your account, contact the administrator running your
            club/tournament instance of CricketHub. Historical match/scoring data your account
            contributed to may be retained (with your account de-linked) so completed matches and
            statistics for other players remain intact.
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
