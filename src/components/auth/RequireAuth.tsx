import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { getToken, IS_DEMO_MODE } from '../../api'

export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation()
  if (!getToken() && !IS_DEMO_MODE) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return <>{children}</>
}
