import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/primitives'

export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <div className="text-6xl font-black text-ink-200">404</div>
      <h1 className="mt-2 text-xl font-bold text-ink-900">Page not found</h1>
      <p className="mt-1 text-sm text-ink-500">
        The page you're looking for doesn't exist or has moved.
      </p>
      <Link to="/" className="mt-6">
        <Button>Back to home</Button>
      </Link>
    </div>
  )
}
