import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { CalendarPlus, Video, MessageSquare } from 'lucide-react'
import { Avatar, Btn, Card, Dialog, EmptyState, Gate, PageHead, Skeleton, StateSwitcher, StatusBadge, Tabs, type DemoState } from '../../ui'
import { specialists as staticSpecialists } from '../../data'
import { api } from '../../api'

type Status = 'Confirmed' | 'Completed' | 'Cancelled'
type B = {
  id: number
  sp: string
  spName: string
  spInitials: string
  spSvc: 'move' | 'eat' | 'recover'
  when: string
  type: string
  status: Status
  ref: string
}

function formatSlotWhen(startsAtStr: string) {
  if (!startsAtStr) return 'Scheduled'
  const d = new Date(startsAtStr)
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const dow = dayNames[d.getDay()]
  const date = d.getDate()
  const mon = months[d.getMonth()]
  const h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const ap = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${dow} ${date} ${mon}, ${h12}:${m} ${ap}`
}

export default function MyBookings() {
  const nav = useNavigate()
  const [tab, setTab] = useState<'up' | 'past'>('up')
  const [rows, setRows] = useState<B[]>([])
  const [target, setTarget] = useState<B | null>(null)
  const [state, setState] = useState<DemoState>('loading')
  const [msg, setMsg] = useState('')

  const loadBookings = () => {
    setState('loading')
    api.getBookings()
      .then((res) => {
        const mapped: B[] = (res.bookings || []).map((b: any) => {
          const spName = b.specialistName || b.specialist_name || 'Dr. Mona Fathy'
          const initials =
            spName
              .replace(/^(Dr\.|Coach)\s+/i, '')
              .split(/\s+/)
              .slice(0, 2)
              .map((x: string) => x[0]?.toUpperCase())
              .join('') || 'SP'
          const spType = b.specialistType || b.specialist_type || 'physical_therapist'
          const spSvc = (spType === 'physical_therapist' ? 'recover' : spType === 'nutritionist' ? 'eat' : 'move') as any

          return {
            id: b.id,
            sp: String(b.specialistId || b.specialist_id),
            spName,
            spInitials: initials,
            spSvc,
            when: formatSlotWhen(b.startsAt || b.starts_at),
            type: (b.sessionType || b.session_type) === 'chat' ? 'Chat check-in' : 'Video call',
            status: (b.status.charAt(0).toUpperCase() + b.status.slice(1)) as Status,
            ref: b.notes || b.packageName || b.package_name || 'Knee review',
          }
        })
        setRows(mapped)
        setState('loaded')
      })
      .catch((err) => {
        console.error('Failed to load bookings:', err)
        setState('error')
      })
  }

  useEffect(() => {
    loadBookings()
  }, [])

  const list = rows.filter((r) => (tab === 'up' ? r.status === 'Confirmed' : r.status !== 'Confirmed'))
  const empty =
    tab === 'up' ? (
      <EmptyState title="No upcoming sessions" text="Book a session with your trainer, dietitian or physical therapist." action={<Btn to="/app/specialists"><CalendarPlus size={18} aria-hidden /> Book a session</Btn>} />
    ) : (
      <EmptyState title="No past sessions yet" text="Completed and cancelled sessions show up here." />
    )

  return (
    <div>
      <PageHead title="My bookings" sub="Free cancellation up to 12 hours before a session." action={<Btn to="/app/specialists">Book a session</Btn>} />
      {msg && <p role="status" className="mb-4 rounded-xl bg-sand font-semibold px-4 py-3">{msg}</p>}
      <div className="flex flex-wrap items-center gap-4 mb-5">
        <Tabs
          label="Bookings"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'up', label: `Upcoming (${rows.filter((r) => r.status === 'Confirmed').length})` },
            { id: 'past', label: 'Past' },
          ]}
        />
        {/* <StateSwitcher value={state} onChange={setState} /> */}
      </div>
      <Gate state={state} retry={loadBookings} skeleton={<div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div>} empty={<Card>{empty}</Card>}>
        {list.length === 0 ? (
          <Card>{empty}</Card>
        ) : (
          <ul className="space-y-3">
            {list.map((b) => {
              const TypeIcon = b.type === 'Video call' ? Video : MessageSquare
              return (
                <li key={b.id}>
                  <Card className="p-5 flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <Avatar initials={b.spInitials} svc={b.spSvc} />
                      <div className="min-w-0">
                        <p className="font-bold">{b.spName}</p>
                        <p className="text-[15px]">{b.when}</p>
                        <p className="text-[14px] text-ink-2 flex items-center gap-1.5"><TypeIcon size={14} aria-hidden /> {b.type} · {b.ref}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 md:justify-end">
                      <StatusBadge status={b.status} />
                      {b.status === 'Confirmed' && (
                        <>
                          <Btn variant="secondary" className="min-h-11 h-11 px-4" onClick={() => nav(`/app/specialists/${b.sp}/book?reschedule=1&bookingId=${b.id}`)}>Reschedule</Btn>
                          <Btn variant="ghost" className="min-h-11 h-11 px-4 underline" onClick={() => setTarget(b)}>Cancel</Btn>
                        </>
                      )}
                      {b.status === 'Completed' && <Btn variant="ghost" className="min-h-11 h-11 px-4 underline" to={`/app/specialists/${b.sp}`}>Book again</Btn>}
                    </div>
                  </Card>
                </li>
              )
            })}
          </ul>
        )}
      </Gate>

      <Dialog open={!!target} onClose={() => setTarget(null)} title="Cancel this session?">
        {target && (
          <>
            <p className="text-ink-2">
              {target.spName}, {target.when}. They will be told right away. This can't be undone, but you can book a new time.
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-3 mt-6 sm:justify-end">
              <Btn variant="secondary" onClick={() => setTarget(null)}>Keep session</Btn>
              <Btn
                className="!bg-[#a02a2a] hover:!bg-[#b93a3a]"
                onClick={async () => {
                  try {
                    await api.cancelBooking(target.id)
                    setRows((prev) => prev.map((r) => (r.id === target.id ? { ...r, status: 'Cancelled' } : r)))
                    setMsg('Session cancelled. It moved to Past.')
                  } catch (err: any) {
                    if (err?.code === 'TOO_LATE_TO_CANCEL') {
                      setMsg('Cannot cancel: Free cancellation is only allowed up to 12 hours before the session.')
                    } else {
                      setMsg(err?.message || 'Failed to cancel session.')
                    }
                  } finally {
                    setTarget(null)
                  }
                }}
              >
                Yes, cancel session
              </Btn>
            </div>
          </>
        )}
      </Dialog>
    </div>
  )
}
