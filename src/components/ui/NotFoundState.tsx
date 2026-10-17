import { useNavigate } from 'react-router'
import { getToken } from '../../api/client'
import { Btn } from './Btn'

export function NotFoundState({ home, homeLabel, full = false }: { home?: string; homeLabel?: string; full?: boolean }) {
  const go = useNavigate()
  const hasAuth = !!getToken()
  const targetHome = home ?? (hasAuth ? '/app' : '/')
  const targetLabel = homeLabel ?? (hasAuth ? 'Back to Dashboard' : 'Back home')
  return (
    <div className={`text-center px-6 ${full ? 'min-h-screen grid place-items-center' : 'py-16'}`}>
      <div>
        <p className="num text-[88px] sm:text-[120px] leading-none">404</p>
        <h1 className="h-display text-[26px] mt-4">We can't find that page</h1>
        <p className="text-ink-2 mt-2 max-w-sm mx-auto">The link may be old, or the page may have moved. Go back, or start from the home page.</p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <Btn variant="secondary" onClick={() => go(-1)}>Go back</Btn>
          <Btn to={targetHome}>{targetLabel}</Btn>
        </div>
      </div>
    </div>
  )
}
