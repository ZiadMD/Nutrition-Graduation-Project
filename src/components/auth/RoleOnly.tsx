import type { ReactNode } from 'react'
import { useOutletContext } from 'react-router'
import { Card } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'
import { Btn } from '../ui/Btn'

export type Role = 'Client' | 'Specialist' | 'Admin' | 'Finance'
export type RoleContextType = { role: Role; setRole: (r: Role) => void }

export function RoleOnly({ role: need, children }: { role: Role; children: ReactNode }) {
  const { role, setRole } = useOutletContext<RoleContextType>()
  if (role === need) return <>{children}</>
  return (
    <Card>
      <EmptyState
        title={`This page is for the ${need.toLowerCase()} view`}
        text={`You are looking at Rebound as ${role === 'Client' ? 'a client' : role === 'Specialist' ? 'a specialist' : role === 'Finance' ? 'a finance officer' : 'an admin'}. Switch your account to see this page.`}
        action={<Btn onClick={() => setRole(need)}>Switch to {need.toLowerCase()} view</Btn>}
      />
    </Card>
  )
}
