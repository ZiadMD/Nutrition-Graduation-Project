import { CircleAlert, RefreshCw } from 'lucide-react'
import { Btn } from './Btn'

export function ErrorState({
  onRetry,
  title = 'We could not load this',
  text = 'Check your connection and try again. Nothing was lost.',
}: {
  onRetry: () => void
  title?: string
  text?: string
}) {
  return (
    <div role="alert" className="text-center py-12 px-6">
      <span className="mx-auto size-14 rounded-2xl bg-bad-tint grid place-items-center mb-4">
        <CircleAlert size={26} className="text-bad" aria-hidden />
      </span>
      <p className="h-display text-[22px]">{title}</p>
      <p className="text-ink-2 mt-2 max-w-sm mx-auto">{text}</p>
      <div className="mt-5">
        <Btn variant="secondary" onClick={onRetry}>
          <RefreshCw size={18} aria-hidden /> Try again
        </Btn>
      </div>
    </div>
  )
}
