import type { ReactNode } from 'react'
import type { DemoState } from './StateSwitcher'
import { ErrorState } from './ErrorState'

export function Gate({
  state,
  skeleton,
  empty,
  retry,
  children,
}: {
  state: DemoState
  skeleton: ReactNode
  empty: ReactNode
  retry: () => void
  children: ReactNode
}) {
  if (state === 'loading') return <div aria-busy="true" aria-label="Loading">{skeleton}</div>
  if (state === 'empty') return <>{empty}</>
  if (state === 'error') return <ErrorState onRetry={retry} />
  return <>{children}</>
}
