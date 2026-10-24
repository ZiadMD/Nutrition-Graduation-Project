// MySpecialists.tsx — Dedicated view for active care team specialists.
//
// Shows specialists actively assigned to this member (either via B2B organization
// assignment or B2C active care team). Handles empty states differently for org
// members (waiting for org assignment) vs individuals (browse directory).

import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Building2, CalendarDays, UserCheck, AlertCircle } from 'lucide-react'
import { Avatar, Btn, Card, EmptyState, PageHead, Tag } from '../../ui'
import { api, getStoredUser } from '../../api'

function getInitials(name = '') {
  return name
    .replace(/^(Dr\.|Coach)\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
}

function fieldToSvc(field: string): 'move' | 'eat' | 'recover' {
  const f = field.toLowerCase()
  if (f === 'move') return 'move'
  if (f === 'eat') return 'eat'
  return 'recover'
}

export default function MySpecialists() {
  const user = getStoredUser()
  const isOrgMember = Boolean(user?.organization || user?.organizationId)

  const [loading, setLoading] = useState(true)
  const [specialists, setSpecialists] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  const loadData = () => {
    setLoading(true)
    setError(null)
    api
      .getMySpecialists()
      .then((res) => {
        setSpecialists(res.specialists || [])
      })
      .catch((err: any) => {
        setError(err?.message || 'Could not load your care team specialists.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])

  return (
    <div>
      <PageHead
        title="My specialists"
        sub="Your personal care team supporting your training, nutrition, and recovery."
      />

      {loading ? (
        <Card className="p-8 text-center">
          <p className="text-ink-2">Loading your care team...</p>
        </Card>
      ) : error ? (
        <Card className="p-6 text-center">
          <div className="flex flex-col items-center gap-3">
            <AlertCircle size={32} className="text-bad" />
            <p className="text-ink font-semibold">{error}</p>
            <Btn variant="secondary" onClick={loadData}>
              Try again
            </Btn>
          </div>
        </Card>
      ) : specialists.length === 0 ? (
        <Card className="p-4 sm:p-8">
          {isOrgMember ? (
            <EmptyState
              title="Your organization hasn't assigned you a specialist yet"
              text="Your care team will appear here once an administrator in your organization assigns a trainer, nutritionist, or physical therapist."
            />
          ) : (
            <EmptyState
              title="No active specialists yet"
              text="Explore the specialist directory to choose your trainer, nutritionist, or physical therapist and begin your personalized plan."
              action={
                <Btn to="/app/specialists">
                  <UserCheck size={18} className="mr-2" /> Browse specialists
                </Btn>
              }
            />
          )}
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {specialists.map((sp) => {
            const svc = fieldToSvc(sp.field || sp.type)
            return (
              <Card key={sp.specialistId} className="p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar initials={getInitials(sp.name)} svc={svc} />
                      <div>
                        <h3 className="font-bold text-[18px] text-ink">{sp.name}</h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <Tag svc={svc}>{sp.field || sp.type}</Tag>
                          {sp.orgName && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-sand px-2 py-0.5 rounded-full text-ink border border-line">
                              <Building2 size={11} className="text-move" /> {sp.orgName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {sp.bio && (
                    <p className="text-ink-2 text-[14px] mt-4 line-clamp-3 leading-relaxed">
                      {sp.bio}
                    </p>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-line flex items-center justify-between gap-3">
                  <Link
                    to={`/app/specialists/${sp.specialistId}`}
                    className="text-[14px] font-semibold underline underline-offset-4 text-ink hover:text-ink-2"
                  >
                    View profile
                  </Link>
                  <Btn
                    to={`/app/specialists/${sp.specialistId}/book`}
                    className="gap-2 text-[14px]"
                  >
                    <CalendarDays size={16} /> Book a session
                  </Btn>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

