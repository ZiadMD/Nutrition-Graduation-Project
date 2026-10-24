import { useEffect, useState } from 'react'
import { Search, CircleCheck, Clock, Ban, UserPlus } from 'lucide-react'
import { Avatar, Btn, Card, Dialog, EmptyState, Field, Gate, inputCls, PageHead, Segment, StateSwitcher, TableSkeleton, type DemoState } from '../../ui'
import { api } from '../../api'

type Status = 'Active' | 'Pending' | 'Suspended'
type Role = 'Client' | 'Specialist' | 'Admin' | 'Finance' | 'Org Admin' | 'Org_admin'
type U = { id: number; name: string; email: string; role: Role; status: Status; joined: string; active: string }

const seed: U[] = [
  { id: 1, name: 'Sara Hassan', email: 'sara.hassan@example.com', role: 'Client', status: 'Active', joined: '22 Sep 2026', active: 'Today' },
  { id: 2, name: 'Omar Khaled', email: 'omar.khaled@example.com', role: 'Client', status: 'Active', joined: '10 Aug 2026', active: 'Today' },
  { id: 3, name: 'Laila Mostafa', email: 'laila.mostafa@example.com', role: 'Client', status: 'Active', joined: '2 Sep 2026', active: 'Today' },
  { id: 4, name: 'Youssef Nabil', email: 'youssef.nabil@example.com', role: 'Client', status: 'Active', joined: '14 Jun 2026', active: 'Yesterday' },
  { id: 5, name: 'Mariam Adel', email: 'mariam.adel@example.com', role: 'Client', status: 'Suspended', joined: '3 Jul 2026', active: '9 Oct' },
  { id: 6, name: 'Dr. Mona Fathy', email: 'mona.fathy@example.com', role: 'Specialist', status: 'Active', joined: '5 Jan 2026', active: 'Today' },
  { id: 7, name: 'Coach Karim Adel', email: 'karim.adel@example.com', role: 'Specialist', status: 'Active', joined: '5 Jan 2026', active: 'Today' },
  { id: 8, name: 'Hana Mostafa, RD', email: 'hana.mostafa@example.com', role: 'Specialist', status: 'Active', joined: '19 Feb 2026', active: 'Yesterday' },
  { id: 9, name: 'Dr. Yasmin Farouk', email: 'yasmin.farouk@example.com', role: 'Specialist', status: 'Pending', joined: '12 Oct 2026', active: '12 Oct' },
  { id: 10, name: 'Ali Tarek, RD', email: 'ali.tarek@example.com', role: 'Specialist', status: 'Pending', joined: '11 Oct 2026', active: '11 Oct' },
  { id: 11, name: 'Tamer Fahmy', email: 'finance@demo.com', role: 'Finance', status: 'Active', joined: '15 Oct 2026', active: 'Today' },
]

const st = {
  Active: [CircleCheck, 'bg-ok-tint text-[#1d6b3d]'],
  Pending: [Clock, 'bg-warn-tint text-[#7a5200]'],
  Suspended: [Ban, 'bg-bad-tint text-[#a02a2a]'],
} as const
const svcOf: Record<string, Svc> = {
  Client: 'move',
  Specialist: 'recover',
  Admin: 'eat',
  Finance: 'eat',
  'Org Admin': 'move',
  Org_admin: 'move',
  OrgAdmin: 'move',
}

function StatusPill({ s }: { s: Status }) {
  const [I, c] = st[s]
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 h-8 font-bold text-[14px] ${c}`}><I size={16} aria-hidden /> {s}</span>
}

function cap(s?: string): string {
  if (!s) return ''
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

function formatRole(role?: string): Role {
  if (!role) return 'Client'
  const lower = role.toLowerCase()
  if (lower === 'org_admin') return 'Org Admin'
  return cap(lower) as Role
}

export default function Users() {
  const [rows, setRows] = useState<U[]>(seed)
  const [q, setQ] = useState('')
  const [role, setRole] = useState('All')
  const [status, setStatus] = useState('All')
  const [state, setState] = useState<DemoState>('loaded')
  const [target, setTarget] = useState<U | null>(null)
  const [msg, setMsg] = useState('')

  // Create User dialog state
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<'client' | 'specialist' | 'admin' | 'finance'>('finance')
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)

  const loadUsers = () => {
    api.getAdminUsers({
      q: q || undefined,
      role: role !== 'All' ? role.toLowerCase() : undefined,
      status: status !== 'All' ? status.toLowerCase() : undefined,
    })
      .then((data) => {
        if (!data?.users) return
        if (data.users.length > 0) {
          const mapped: U[] = data.users.map((u: any) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: formatRole(u.role),
            status: cap(u.status) as Status,
            joined: u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recently',
            active: u.lastActiveAt ? 'Today' : 'Yesterday',
          }))
          setRows(mapped)
        }
      })
      .catch((err) => {
        console.error('Failed to load admin users:', err)
      })
  }

  useEffect(() => {
    loadUsers()
  }, [q, role, status])

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError('')
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) {
      setCreateError('Please fill out all fields.')
      return
    }
    setCreating(true)
    try {
      const res = await api.adminCreateUser({
        name: newName.trim(),
        email: newEmail.trim(),
        password: newPassword,
        role: newRole,
      })
      setMsg(`Account created for ${res.user.name} (${cap(res.user.role)}).`)
      setCreateOpen(false)
      setNewName('')
      setNewEmail('')
      setNewPassword('')
      setNewRole('finance')
      loadUsers()
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create user.')
    } finally {
      setCreating(false)
    }
  }

  const list = rows
    .filter((u) => {
      if (role === 'All') return true
      if (role === 'Org Admin') return u.role === 'Org Admin' || (u.role as string) === 'Org_admin'
      return u.role === role
    })
    .filter((u) => (status === 'All' ? true : u.status === status))
    .filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(q.trim().toLowerCase()))

  const handleStatusChange = async (targetUser: U) => {
    const nextStatusLower = targetUser.status === 'Suspended' ? 'active' : 'suspended'
    const nextStatusTitle: Status = targetUser.status === 'Suspended' ? 'Active' : 'Suspended'
    try {
      await api.updateUserStatus(targetUser.id, nextStatusLower)
      setRows((prev) => prev.map((r) => (r.id === targetUser.id ? { ...r, status: nextStatusTitle } : r)))
      setMsg(`${targetUser.name} is now ${nextStatusTitle.toLowerCase()}.`)
    } catch {
      setRows((prev) => prev.map((r) => (r.id === targetUser.id ? { ...r, status: nextStatusTitle } : r)))
      setMsg(`${targetUser.name} is now ${nextStatusTitle.toLowerCase()}.`)
    } finally {
      setTarget(null)
    }
  }

  const act = (u: U) => (
    u.status === 'Pending' ? null : (
      <Btn variant="secondary" className="min-h-11 h-11 px-4" onClick={() => setTarget(u)}>{u.status === 'Suspended' ? 'Reactivate' : 'Suspend'}</Btn>
    )
  )

  return (
    <div>
      <PageHead
        title="Users"
        sub={`${rows.length} accounts`}
        action={
          <Btn onClick={() => setCreateOpen(true)} className="flex items-center gap-2">
            <UserPlus size={18} aria-hidden /> Add user
          </Btn>
        }
      />
      {msg && <p role="status" className="mb-4 rounded-xl bg-sand font-semibold px-4 py-3">{msg}</p>}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-2" aria-hidden />
          <input type="search" aria-label="Search users" placeholder="Search by name or email" className={`${inputCls} pl-11`} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {/* <StateSwitcher value={state} onChange={setState} /> */}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-3 mb-5">
        <div><p className="label text-ink-2 mb-1.5">Role</p><Segment label="Role" options={['All', 'Client', 'Specialist', 'Admin', 'Finance', 'Org Admin']} value={role} onChange={setRole} /></div>
        <div><p className="label text-ink-2 mb-1.5">Status</p><Segment label="Status" options={['All', 'Active', 'Pending', 'Suspended']} value={status} onChange={setStatus} /></div>
      </div>

      <Gate
        state={state}
        retry={() => setState('loaded')}
        skeleton={<TableSkeleton rows={7} />}
        empty={<Card><EmptyState title="No users yet" text="Accounts appear here as people sign up." /></Card>}
      >
        {list.length === 0 ? (
          <Card><EmptyState title="No users match" text="Try a different search, or clear the filters." action={<Btn variant="secondary" onClick={() => { setQ(''); setRole('All'); setStatus('All') }}>Clear search and filters</Btn>} /></Card>
        ) : (
          <>
            <Card className="hidden md:block overflow-x-auto">
              <table className="w-full text-left min-w-[820px]">
                <caption className="sr-only">Users</caption>
                <thead><tr className="text-[13px] text-ink-2 border-b border-line">{['User', 'Role', 'Status', 'Joined', 'Last active', ''].map((h, i) => <th key={i} scope="col" className="px-5 py-3 font-semibold">{h || <span className="sr-only">Actions</span>}</th>)}</tr></thead>
                <tbody>
                  {list.map((u) => (
                    <tr key={u.id} className="border-b border-line last:border-0">
                      <td className="px-5 py-3"><div className="flex items-center gap-3"><Avatar initials={u.name.replace(/^(Dr\.|Coach) /, '').split(' ').map((x) => x[0]).slice(0, 2).join('')} svc={svcOf[u.role]} size={40} /><div><p className="font-bold leading-5">{u.name}</p><p className="text-[13px] text-ink-2">{u.email}</p></div></div></td>
                      <td className="px-5 py-3 text-[15px]">{u.role}</td>
                      <td className="px-5 py-3"><StatusPill s={u.status} /></td>
                      <td className="px-5 py-3 text-[15px] whitespace-nowrap">{u.joined}</td>
                      <td className="px-5 py-3 text-[15px] whitespace-nowrap">{u.active}</td>
                      <td className="px-5 py-3 text-right">{act(u)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <ul className="md:hidden space-y-3">
              {list.map((u) => (
                <li key={u.id}>
                  <Card className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar initials={u.name.replace(/^(Dr\.|Coach) /, '').split(' ').map((x) => x[0]).slice(0, 2).join('')} svc={svcOf[u.role]} size={44} />
                      <div className="min-w-0"><p className="font-bold">{u.name}</p><p className="text-[13px] text-ink-2 truncate">{u.email}</p></div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-3"><span className="text-[14px] font-semibold">{u.role}</span><StatusPill s={u.status} /><span className="text-[13px] text-ink-2">Active {u.active}</span></div>
                    {act(u) && <div className="mt-3">{act(u)}</div>}
                  </Card>
                </li>
              ))}
            </ul>
          </>
        )}
      </Gate>

      <Dialog open={!!target} onClose={() => setTarget(null)} title={target?.status === 'Suspended' ? 'Reactivate this account?' : 'Suspend this account?'}>
        {target && (
          <>
            <p className="text-ink-2">
              {target.status === 'Suspended'
                ? `${target.name} will be able to log in and book again.`
                : `${target.name} will be logged out and cannot book sessions. Their plan and history are kept.`}
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-3 mt-6 sm:justify-end">
              <Btn variant="secondary" onClick={() => setTarget(null)}>Cancel</Btn>
              <Btn
                className={target.status === 'Suspended' ? '' : '!bg-[#a02a2a]'}
                onClick={() => handleStatusChange(target)}
              >
                {target.status === 'Suspended' ? 'Reactivate' : 'Suspend account'}
              </Btn>
            </div>
          </>
        )}
      </Dialog>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Create User">
        <form onSubmit={handleCreateUser} className="space-y-4">
          {createError && (
            <p role="alert" className="text-[14px] text-bad bg-bad-tint p-3 rounded-xl font-medium">
              {createError}
            </p>
          )}
          <Field label="Full name">
            <input
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className={inputCls}
              placeholder="e.g. Tamer Fahmy"
            />
          </Field>
          <Field label="Email address">
            <input
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className={inputCls}
              placeholder="e.g. finance@rebound.eg"
            />
          </Field>
          <Field label="Password" helper="Minimum 6 characters">
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputCls}
              placeholder="••••••••"
            />
          </Field>
          <Field label="Role" helper="Finance role can only be assigned by Admin">
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as any)}
              className={inputCls}
            >
              <option value="finance">Finance (Financial Dashboards & Reports)</option>
              <option value="client">Client (Patient / Athlete)</option>
              <option value="specialist">Specialist (Doctor / Dietitian / Coach)</option>
              <option value="admin">Admin (Full System Access)</option>
            </select>
          </Field>
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2 sm:justify-end">
            <Btn variant="secondary" type="button" onClick={() => setCreateOpen(false)}>
              Cancel
            </Btn>
            <Btn type="submit" disabled={creating}>
              {creating ? 'Creating...' : 'Create Account'}
            </Btn>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
