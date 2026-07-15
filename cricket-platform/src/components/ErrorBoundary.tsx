import { Component, type ErrorInfo, type ReactNode } from 'react'
import { genId } from '@/lib/collections'
import { logClientError } from '@/services/errorLog.service'
import { useAuthStore } from '@/store/authStore'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
  referenceId: string | null
  copied: boolean
}

/**
 * Catches render errors anywhere below it so a single component failure shows
 * a recoverable message instead of blanking the whole app (white screen).
 * Each occurrence gets a short reference id (shown to the user, logged
 * best-effort to Firestore) so a report like "error abc123" is traceable
 * without this app having any real server-side crash reporting.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, referenceId: null, copied: false }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error, referenceId: genId('err_'), copied: false }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface for debugging; harmless in production.
    console.error('ErrorBoundary caught:', error, info.componentStack)
    const referenceId = this.state.referenceId ?? genId('err_')
    void logClientError({
      referenceId,
      message: error.message,
      stack: error.stack,
      route: window.location.pathname,
      userId: useAuthStore.getState().profile?.id ?? null,
    })
  }

  reset = () => this.setState({ error: null, referenceId: null, copied: false })

  reload = () => window.location.reload()

  copyDiagnostics = () => {
    const { error, referenceId } = this.state
    if (!error) return
    const report = [
      `Reference: ${referenceId}`,
      `Page: ${window.location.href}`,
      `Time: ${new Date().toISOString()}`,
      `Error: ${error.message}`,
      error.stack ? `Stack:\n${error.stack}` : null,
    ]
      .filter(Boolean)
      .join('\n')
    navigator.clipboard.writeText(report).then(() => {
      this.setState({ copied: true })
      setTimeout(() => this.setState({ copied: false }), 1500)
    })
  }

  render() {
    const { error, referenceId, copied } = this.state
    if (!error) return this.props.children

    return (
      <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-16 text-center">
        <div className="mb-3 text-4xl">🏏</div>
        <h1 className="text-xl font-bold text-ink-900 dark:text-ink-50">Something went wrong</h1>
        <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
          This page hit an unexpected error. Your data is safe — try again, reload, or go
          back home.
        </p>
        {referenceId && (
          <p className="mt-1 text-xs text-ink-400 dark:text-ink-500">
            Reference: <code className="font-mono">{referenceId}</code>
          </p>
        )}
        <pre className="mt-4 max-h-40 w-full overflow-auto rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-left text-xs text-red-700 dark:text-red-300">
          {error.message}
        </pre>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            onClick={this.reset}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Try again
          </button>
          <button
            onClick={this.reload}
            className="rounded-lg border border-ink-300 dark:border-ink-700 px-4 py-2 text-sm font-semibold text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800"
          >
            Reload page
          </button>
          <button
            onClick={this.copyDiagnostics}
            className="rounded-lg border border-ink-300 dark:border-ink-700 px-4 py-2 text-sm font-semibold text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800"
          >
            {copied ? 'Copied!' : 'Copy diagnostics'}
          </button>
          <a
            href="/"
            className="rounded-lg border border-ink-300 dark:border-ink-700 px-4 py-2 text-sm font-semibold text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-800"
          >
            Go home
          </a>
        </div>
      </div>
    )
  }
}
