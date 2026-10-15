import { useEffect, useState } from 'react'
import { Navigate, Link } from 'react-router'
import { CircleCheck, OctagonAlert, TriangleAlert } from 'lucide-react'
import { Card, PageHead } from '../ui'
import { useRole } from './Shell'
import ClientToday from './client/Today'
import { api } from '../api'

const CLIENT_IDS: Record<string, string> = { 'Sara Hassan': 'sara', 'Omar Khaled': 'omar', 'Laila Mostafa': 'laila' }

function SpecialistToday() {
  const [loading, setLoading] = useState(true)
  const [bookedSessions, setBookedSessions] = useState<any[]>([])

  const defaultRows = [
    ['Sara Hassan', 'sara', 'Knee review', '16:00', 'warn'],
    ['Omar Khaled', 'omar', 'Lower back check-in', '17:00', 'ok'],
    ['Laila Mostafa', 'laila', 'Shoulder program, week 3', '18:30', 'bad'],
  ]

  useEffect(() => {
    let active = true
    Promise.all([
      api.getSpecialistSchedule().catch(() => ({ slots: [] })),
      api.getSpecialistClients().catch(() => ({ clients: [] })),
    ]).then(([schedData, clientData]) => {
      if (!active) return
      const slots = schedData.slots || []
      const clientsList = clientData.clients || []
      const clientMap = new Map(clientsList.map((c: any) => [c.id, c]))

      const booked = slots.filter((s: any) => s.booking && s.booking.client)
      if (booked.length > 0) {
        const rows = booked.map((s: any) => {
          const c = clientMap.get(s.booking.client.id)
          const name = s.booking.client.name
          const id = String(s.booking.client.id)
          const session = s.booking.sessionType || 'Session review'
          const time = s.startsAt ? new Date(s.startsAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '16:00'
          const pain = c?.latestPain ?? 3
          const status = pain >= 7 ? 'bad' : pain >= 4 ? 'warn' : 'ok'
          return [name, id, session, time, status]
        })
        setBookedSessions(rows)
      } else if (clientsList.length > 0) {
        // If no booked slots today, show the specialist's assigned clients
        const rows = clientsList.slice(0, 3).map((c: any) => {
          const status = (c.latestPain ?? 0) >= 7 ? 'bad' : (c.latestPain ?? 0) >= 4 ? 'warn' : 'ok'
          return [c.name, String(c.id), c.goal || 'Session check-in', '16:00', status]
        })
        setBookedSessions(rows)
      }
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  const rows = bookedSessions.length > 0 ? bookedSessions : defaultRows

  const st = {
    ok: ['Mild', 'bg-ok-tint text-[#1d6b3d]', CircleCheck],
    warn: ['Moderate', 'bg-warn-tint text-[#7a5200]', TriangleAlert],
    bad: ['Needs doctor', 'bg-bad-tint text-[#a02a2a]', OctagonAlert],
  } as const

  const needsAttention = rows.filter((r) => r[4] === 'warn' || r[4] === 'bad').length

  return (
    <div>
      <PageHead
        title="Today's sessions"
        sub={`${rows.length} clients, ${needsAttention} need${needsAttention === 1 ? 's' : ''} your attention first`}
      />
      <Card className="overflow-x-auto">
        <table className="w-full text-left min-w-[560px]">
          <thead>
            <tr className="text-[13px] text-ink-2 border-b border-line">
              {['Client', 'Session', 'Time', 'Pain report'].map((h) => (
                <th key={h} className="px-5 py-3 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([n, id, s, t, k]) => {
              const [lbl, cls, I] = st[k as keyof typeof st]
              const clientHref = `/app/clients/${CLIENT_IDS[n] || id}`
              return (
                <tr key={n + t} className="border-b border-line last:border-0">
                  <td className="px-5 py-4 font-bold">
                    <Link to={clientHref} className="underline underline-offset-4 inline-flex min-h-11 items-center">
                      {n}
                    </Link>
                  </td>
                  <td className="px-5 py-4">{s}</td>
                  <td className="px-5 py-4 num">{t}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 h-8 font-bold text-[14px] ${cls}`}>
                      <I size={16} aria-hidden /> {lbl}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

export function Today() {
  const role = useRole()
  return role === 'Client' ? <ClientToday /> : role === 'Specialist' ? <SpecialistToday /> : <Navigate to="/app/overview" replace />
}

