import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

/**
 * Catches render errors anywhere below it so a single component failure shows
 * a recoverable message instead of blanking the whole app (white screen).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface for debugging; harmless in production.
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-16 text-center">
        <div className="mb-3 text-4xl">🏏</div>
        <h1 className="text-xl font-bold text-ink-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-ink-500">
          This page hit an unexpected error. Your data is safe — try again or go
          back home.
        </p>
        <pre className="mt-4 max-h-40 w-full overflow-auto rounded-lg bg-red-50 p-3 text-left text-xs text-red-700">
          {error.message}
        </pre>
        <div className="mt-5 flex gap-2">
          <button
            onClick={this.reset}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-lg border border-ink-300 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50"
          >
            Go home
          </a>
        </div>
      </div>
    )
  }
}
