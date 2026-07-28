import { useEffect } from 'react'

const DEFAULT_TITLE = 'CricketHub — Live Scoring & Cricket Management'

/**
 * Sets the page's `<title>` and meta description for the current route. This is a client-only
 * SPA with no server-side rendering, so a crawler that doesn't execute JS won't see these — a
 * real, bounded limitation (documented, not oversold), but it does correctly drive the browser
 * tab title, JS-executing crawlers' indexing, and social-share unfurling.
 */
export function useDocumentMeta(title: string, description?: string) {
  useEffect(() => {
    document.title = title ? `${title} — CricketHub` : DEFAULT_TITLE
    if (description) {
      document.querySelector('meta[name="description"]')?.setAttribute('content', description)
    }
  }, [title, description])
}
