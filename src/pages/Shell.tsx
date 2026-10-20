import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, Link, useOutletContext } from 'react-router'
import { Bell, CalendarDays, ClipboardList, House, LineChart, Menu, Sparkles, Users, X, LogOut, Settings, UserRound, LayoutDashboard, ShieldCheck, Contact, Coins, ReceiptText, CreditCard, Clock } from 'lucide-react'
import { Btn, Card, EmptyState, Wordmark } from '../ui'
import WaitingForApproval from './specialist/WaitingForApproval'

import { RoleOnly, type Role, type RoleContextType } from '@/components/auth/RoleOnly'
export { RoleOnly, type Role }

type Ctx = RoleContextType
export const useRole = () => useOutletContext<Ctx>().role

const nav = [
  { to: '/app/today', label: 'Today', Icon: House },
  { to: '/app/specialists', label: 'Specialists', Icon: Users },
  { to: '/app/bookings', label: 'Bookings', Icon: CalendarDays },
  { to: '/app/plan', label: 'My plan', Icon: ClipboardList },
  { to: '/app/progress', label: 'Progress', Icon: LineChart },
  { to: '/app/ai-plan', label: 'AI plan', Icon: Sparkles },
]
const navs: Record<Role, typeof nav> = {
  Client: nav,
  Specialist: [
    { to: '/app/today', label: 'Today', Icon: House },
    { to: '/app/clients', label: 'Clients', Icon: Contact },
    { to: '/app/schedule', label: 'Schedule', Icon: CalendarDays },
  ],
  Admin: [
    { to: '/app/overview', label: 'Overview', Icon: LayoutDashboard },
    { to: '/app/users', label: 'Users', Icon: Users },
    { to: '/app/approvals', label: 'Approvals', Icon: ShieldCheck },
  ],
  Finance: [
    { to: '/app/finance/overview', label: 'Overview', Icon: LayoutDashboard },
    { to: '/app/finance/transactions', label: 'Ledger', Icon: ReceiptText },
    { to: '/app/finance/payouts', label: 'Payouts', Icon: Coins },
    { to: '/app/finance/subscriptions', label: 'Subscriptions', Icon: CreditCard },
  ],
}
const allNav = [...nav, ...navs.Specialist.slice(1), ...navs.Admin, ...navs.Finance]

import { api, IS_DEMO_MODE, getStoredUser, getToken, removeToken } from '../api'

function RoleSwitch({ role, setRole }: { role: Role; setRole: (r: Role) => void }) {
  if (!IS_DEMO_MODE) return null
  return (
    <div>
      <p className="label text-ink-2 uppercase mb-2">Demo role</p>
      <div role="radiogroup" aria-label="Demo role" className="grid grid-cols-2 gap-1 p-1 bg-paper border border-line rounded-xl">
        {(['Client', 'Specialist', 'Admin', 'Finance'] as Role[]).map((r) => (
          <button
            key={r}
            role="radio"
            aria-checked={role === r}
            onClick={() => setRole(r)}
            className={`min-h-10 rounded-lg text-[12px] font-bold cursor-pointer transition ${role === r ? 'bg-ink text-white' : 'hover:bg-ink/5 text-ink'}`}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  )
}

function Pop({ open, onClose, children, className = '' }: { open: boolean; onClose: () => void; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose()
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', h)
    document.addEventListener('keydown', k)
    return () => {
      document.removeEventListener('mousedown', h)
      document.removeEventListener('keydown', k)
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div ref={ref} className={`absolute right-0 top-14 bg-white border border-line rounded-2xl shadow-[0_12px_32px_rgba(20,22,26,0.14)] z-50 ${className}`}>
      {children}
    </div>
  )
}

const roleFromUser = (u: any): Role => {
  if (u?.role === 'admin') return 'Admin'
  if (u?.role === 'finance') return 'Finance'
  if (u?.role === 'specialist') return 'Specialist'
  return 'Client'
}

const DEMO_USERS: Record<Role, { id: number; name: string; email: string; role: string }> = {
  Client: { id: 1, name: 'Sara Hassan', email: 'sara@demo.com', role: 'client' },
  Specialist: { id: 2, name: 'Dr. Mona Fathy', email: 'mona@demo.com', role: 'specialist' },
  Admin: { id: 3, name: 'Admin team', email: 'admin@demo.com', role: 'admin' },
  Finance: { id: 4, name: 'Tamer Fahmy', email: 'finance@demo.com', role: 'finance' },
}

export default function Shell() {
  const [currentUser, setCurrentUser] = useState<any>(getStoredUser())
  const [role, setRole] = useState<Role>(roleFromUser(getStoredUser()))
  const [bell, setBell] = useState(false)
  const [menu, setMenu] = useState(false)
  const [moreOpen, setMore] = useState(false)
  const loc = useLocation()
  const go = useNavigate()
  const isSpecialistPending =
    role === 'Specialist' &&
    currentUser?.role === 'specialist' &&
    currentUser?.approvalStatus !== 'approved'

  const items = isSpecialistPending
    ? [{ to: '/app/today', label: 'Approval Status', Icon: Clock }]
    : navs[role]
  const title = isSpecialistPending
    ? 'Specialist Verification'
    : (allNav.find((n) => loc.pathname.startsWith(n.to))?.label ?? 'Rebound')
  const home = (r: Role) => {
    if (r === 'Admin') return '/app/overview'
    if (r === 'Finance') return '/app/finance/overview'
    return '/app/today'
  }

  const changeRole = async (r: Role) => {
    if (IS_DEMO_MODE) {
      const creds: Record<Role, { email: string; pass: string }> = {
        Client: { email: 'sara@demo.com', pass: 'demo1234' },
        Specialist: { email: 'mona@demo.com', pass: 'demo1234' },
        Admin: { email: 'admin@demo.com', pass: 'demo1234' },
        Finance: { email: 'finance@demo.com', pass: 'demo1234' },
      }
      try {
        const res = await api.login(creds[r].email, creds[r].pass)
        setCurrentUser(res.user)
      } catch {
        setCurrentUser(DEMO_USERS[r])
      }
    } else {
      setCurrentUser(DEMO_USERS[r])
    }
    setRole(r)
    go(home(r))
  }

  useEffect(() => {
    const initAuth = async () => {
      const token = getToken()
      if (token) {
        try {
          const user = await api.getMe()
          setCurrentUser(user)
          setRole(roleFromUser(user))
          return
        } catch {
          removeToken()
        }
      }
      if (IS_DEMO_MODE) {
        try {
          const res = await api.login('sara@demo.com', 'demo1234')
          setCurrentUser(res.user)
          setRole(roleFromUser(res.user))
        } catch {
          const initialRole = role || 'Client'
          setCurrentUser(DEMO_USERS[initialRole])
          setRole(initialRole)
        }
      } else {
        go('/login', { replace: true })
      }
    }
    initAuth()
  }, [])

  const name = currentUser?.name || (role === 'Client' ? 'Sara Hassan' : role === 'Specialist' ? 'Dr. Mona Fathy' : role === 'Finance' ? 'Tamer Fahmy' : 'Admin team')
  const initials =
    name
      .replace(/^(Dr\.|Coach)\s+/i, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w: string) => w[0]?.toUpperCase())
      .join('') || (role === 'Specialist' ? 'MF' : role === 'Finance' ? 'TF' : role === 'Admin' ? 'AD' : 'SH')

  useEffect(() => {
    setMore(false)
  }, [loc.pathname])

  return (
    <div className="min-h-screen bg-paper">
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[264px] bg-white border-r border-line flex-col p-5 z-30">
        <Link to={home(role)} className="px-3 h-12 flex items-center" aria-label="Rebound">
          <Wordmark />
        </Link>
        <nav className="mt-6 flex flex-col gap-1" aria-label="App">
          {items.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `min-h-12 px-4 rounded-full flex items-center gap-3 font-semibold transition ${isActive ? 'bg-ink text-white' : 'text-ink hover:bg-ink/5'}`}
            >
              <Icon size={20} aria-hidden /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto">
          <RoleSwitch role={role} setRole={changeRole} />
        </div>
      </aside>

      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-20 bg-paper border-b border-line h-16 lg:h-[72px] px-5 lg:px-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to={home(role)} className="lg:hidden" aria-label="Rebound">
              <span className="flex gap-[3px] items-end h-6" aria-hidden>
                <span className="w-[7px] h-6 rounded-full bg-move" />
                <span className="w-[7px] h-4 rounded-full bg-eat" />
                <span className="w-[7px] h-5 rounded-full bg-recover" />
              </span>
            </Link>
            <p className="h-display text-[24px] lg:text-[30px]" role="heading" aria-level={1}>
              {title}
            </p>
          </div>
          <div className="flex items-center gap-2 relative">
            <button
              onClick={() => { setBell(!bell); setMenu(false) }}
              aria-label="Notifications, 2 new"
              aria-expanded={bell}
              className="relative size-11 grid place-items-center rounded-xl bg-white border border-line cursor-pointer"
            >
              <Bell size={20} />
              <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full border-2 border-white bg-move text-[12px] font-extrabold leading-none text-ink">2</span>
            </button>
            <button
              onClick={() => { setMenu(!menu); setBell(false) }}
              aria-label="Profile menu"
              aria-expanded={menu}
              className="hidden size-11 place-items-center rounded-xl bg-sand font-display font-extrabold text-[14px] cursor-pointer lg:grid"
            >
              {initials}
            </button>
            <button
              onClick={() => { setMore(!moreOpen); setBell(false) }}
              aria-label={moreOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={moreOpen}
              className="grid size-11 place-items-center rounded-xl border border-line bg-white cursor-pointer lg:hidden"
            >
              {moreOpen ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
            </button>
            <Pop open={bell} onClose={() => setBell(false)} className="w-[320px] max-w-[calc(100vw-40px)] p-2">
              <p className="px-3 pt-2 pb-1 font-bold">Notifications</p>
              {({
                Client: [['Dr. Mona changed Tuesday\'s squats', '2 h ago'], ['Hana added a lentil soup swap', 'Yesterday']],
                Specialist: [['Laila Mostafa reported pain 8/10', '1 h ago'], ['Youssef Nabil reported pain 6/10', 'Yesterday']],
                Admin: [['3 specialists are waiting for approval', '20 min ago'], ['1 account was suspended', 'Yesterday']],
                Finance: [['October payouts ready for review', '1 h ago'], ['New Full Team subscription activated', '3 h ago']],
              }[role]).map(([t, w]) => (
                <div key={t} className="px-3 py-3 rounded-xl hover:bg-paper">
                  <p className="text-[15px] font-semibold">{t}</p>
                  <p className="text-[14px] text-ink-2">{w}</p>
                </div>
              ))}
            </Pop>
            <Pop open={menu} onClose={() => setMenu(false)} className="w-[240px] p-2">
              <div className="px-3 py-2 border-b border-line mb-1">
                <p className="font-bold">{name}</p>
                <p className="text-[14px] text-ink-2">{role}</p>
              </div>
              {[
                [UserRound, 'Profile'],
                [Settings, 'Settings'],
              ].map(([I, l]) => {
                const Icon = I as typeof Settings
                return (
                  <button key={l as string} className="w-full min-h-11 px-3 rounded-xl flex items-center gap-3 font-semibold hover:bg-paper cursor-pointer" onClick={() => setMenu(false)}>
                    <Icon size={18} aria-hidden /> {l as string}
                  </button>
                )
              })}
              <button className="w-full min-h-11 px-3 rounded-xl flex items-center gap-3 font-semibold hover:bg-paper cursor-pointer" onClick={() => { api.logout(); go('/login') }}>
                <LogOut size={18} aria-hidden /> Log out
              </button>
            </Pop>
          </div>
        </header>
        <main className="px-5 lg:px-10 py-8 pb-12 max-w-[1200px]">
          {isSpecialistPending ? (
            <WaitingForApproval
              user={currentUser}
              onApproved={async () => {
                const refreshed = await api.getMe()
                setCurrentUser(refreshed)
              }}
            />
          ) : (
            <Outlet context={{ role, setRole: changeRole }} />
          )}
        </main>
      </div>

      {moreOpen && (
        <div className="fixed inset-0 z-40 bg-ink/50 lg:hidden" onClick={() => setMore(false)}>
          <div role="dialog" aria-modal="true" aria-label="Navigation menu" className="absolute inset-y-0 right-0 flex w-[min(88vw,360px)] flex-col overflow-y-auto bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line pb-4">
              <p className="h-display text-[24px]">Menu</p>
              <button onClick={() => setMore(false)} aria-label="Close" className="size-11 grid place-items-center rounded-xl hover:bg-ink/5 cursor-pointer">
                <X size={22} aria-hidden />
              </button>
            </div>

            <div className="my-5 flex items-center gap-3 rounded-2xl bg-sand p-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-white font-display font-extrabold">{initials}</span>
              <div className="min-w-0">
                <p className="truncate font-bold">{name}</p>
                <p className="text-[14px] text-ink-2">{role}</p>
              </div>
            </div>

            <nav className="flex flex-col gap-1" aria-label="Mobile app">
              {items.map(({ to, label, Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setMore(false)}
                  className={({ isActive }) => `min-h-12 rounded-xl px-4 flex items-center gap-3 font-semibold ${isActive ? 'bg-ink text-white' : 'hover:bg-paper'}`}
                >
                  <Icon size={20} aria-hidden /> {label}
                </NavLink>
              ))}
            </nav>

            <div className="mt-5 border-t border-line pt-3">
              <button className="w-full min-h-12 px-4 rounded-xl flex items-center gap-3 font-semibold hover:bg-paper cursor-pointer" onClick={() => setMore(false)}>
                <UserRound size={20} aria-hidden /> Profile
              </button>
              <button className="w-full min-h-12 px-4 rounded-xl flex items-center gap-3 font-semibold hover:bg-paper cursor-pointer" onClick={() => setMore(false)}>
                <Settings size={20} aria-hidden /> Settings
              </button>
            </div>

            <div className="mt-auto pt-6">
              <RoleSwitch role={role} setRole={changeRole} />
              <button className="mt-4 w-full min-h-12 px-4 rounded-xl flex items-center gap-3 font-semibold hover:bg-paper cursor-pointer" onClick={() => { api.logout(); go('/login') }}>
                <LogOut size={20} aria-hidden /> Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
