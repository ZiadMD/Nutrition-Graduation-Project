import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Search, ChevronRight } from 'lucide-react'
import { Avatar, Btn, Card, EmptyState, Gate, inputCls, PageHead, Segment, StateSwitcher, TableSkeleton, type DemoState } from '../../ui'
import { clients as mockClients, overLimit } from '../../data'
import { Flag, PainTrend } from './parts'
import { api } from '../../api'

export default function Clients() {
  const [q, setQ] = useState('')
  const [f, setF] = useState('All')
  const [state, setState] = useState<DemoState>('loaded')
  const [allClients, setAllClients] = useState<any[]>(mockClients)

  useEffect(() => {
    let active = true
    api.getSpecialistClients(q)
      .then((data) => {
        if (!active) return
        if (data?.clients && data.clients.length > 0) {
          setAllClients(data.clients)
        }
      })
      .catch((err) => {
        console.error('Failed to load specialist clients:', err)
      })
    return () => { active = false }
  }, [q])

  const checkOver = (c: any) => (c.flagged !== undefined ? c.flagged : overLimit(c))

  const list = allClients
    .filter((c) => (f === 'Needs attention' ? checkOver(c) : f === 'On track' ? !checkOver(c) : true))
    .filter((c) => `${c.name} ${c.goal || ''}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => Number(checkOver(b)) - Number(checkOver(a)))
  const flagged = allClients.filter(checkOver).length

  return (
    <div>
      <PageHead title="Clients" sub={`${allClients.length} clients. ${flagged} above their safe pain limit.`} />
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-2" aria-hidden />
          <input type="search" aria-label="Search clients" placeholder="Search by name or goal" className={`${inputCls} pl-11`} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Segment label="Filter" options={['All', 'Needs attention', 'On track']} value={f} onChange={setF} />
        {/* <StateSwitcher value={state} onChange={setState} /> */}
      </div>

      <Gate
        state={state}
        retry={() => setState('loaded')}
        skeleton={<TableSkeleton rows={6} />}
        empty={<Card><EmptyState title="No clients yet" text="When someone books a session with you, they show up here with their plan and pain reports." /></Card>}
      >
        {list.length === 0 ? (
          <Card>
            <EmptyState title="No clients match" text="Try a different name, or clear the filter." action={<Btn variant="secondary" onClick={() => { setQ(''); setF('All') }}>Clear search and filter</Btn>} />
          </Card>
        ) : (
          <>
            <Card className="hidden md:block overflow-x-auto">
              <table className="w-full text-left min-w-[860px]">
                <caption className="sr-only">Clients, sorted with pain flags first</caption>
                <thead>
                  <tr className="text-[13px] text-ink-2 border-b border-line">
                    {['Client', 'Goal', 'Week', 'Pain trend', 'Last check-in', 'Flag'].map((h) => <th key={h} scope="col" className="px-5 py-3 font-semibold">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {list.map((c) => (
                    <tr key={c.id} className={`border-b border-line last:border-0 hover:bg-paper ${overLimit(c) ? 'bg-bad-tint/40' : ''}`}>
                      <td className="px-5 py-3">
                        <Link to={`/app/clients/${c.id}`} className="flex items-center gap-3 min-h-11 font-bold underline-offset-4 hover:underline">
                          <Avatar initials={c.initials} svc="recover" size={40} /> {c.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-[15px] max-w-[200px]">{c.goal}</td>
                      <td className="px-5 py-3 whitespace-nowrap"><span className="num">{c.week}</span> <span className="text-ink-2">of {c.of}</span></td>
                      <td className="px-5 py-3"><PainTrend c={c} /></td>
                      <td className="px-5 py-3 text-[15px] whitespace-nowrap">{c.lastCheckin}</td>
                      <td className="px-5 py-3"><Flag c={c} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <ul className="md:hidden space-y-3">
              {list.map((c) => (
                <li key={c.id}>
                  <Link to={`/app/clients/${c.id}`} className={`block rounded-2xl border border-line p-4 ${overLimit(c) ? 'bg-bad-tint/40' : 'bg-white'}`}>
                    <div className="flex items-center gap-3">
                      <Avatar initials={c.initials} svc="recover" size={44} />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold">{c.name}</p>
                        <p className="text-[14px] text-ink-2 truncate">{c.goal}</p>
                      </div>
                      <ChevronRight size={20} aria-hidden />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px]">
                      <span>Week <span className="num">{c.week}</span> of {c.of}</span>
                      <PainTrend c={c} />
                      <span className="text-ink-2">{c.lastCheckin}</span>
                    </div>
                    <div className="mt-3"><Flag c={c} /></div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Gate>
    </div>
  )
}
