import { useState, useEffect } from 'react'
import {
  Users,
  UserPlus,
  Plus,
  AlertCircle,
  CheckCircle2,
  Mail,
  Dumbbell,
  Apple,
  HeartPulse,
  Lock,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react'
import { Card, PageHead, Btn, Dialog, Field, PasswordInput, inputCls, Skeleton, EmptyState } from '../../ui'
import { api } from '../../api'

interface OrgSpecialist {
  specialistId: number
  name: string
  email: string
  type: string
  field: 'Move' | 'Eat' | 'Recover'
  bio?: string
  credentials?: string
  activeClientCount: number
}

/**
 * Org Specialists Roster (/app/org/specialists)
 *
 * Provides organization administrators with specialist oversight:
 * - View existing internal organization specialists (trainers, dietitians, therapists)
 * - Monitor active client caseload per specialist
 * - Add a new specialist with temporary credentials
 * - Prompts admin to securely share temporary credentials upon creation
 */
export default function OrgSpecialists() {
  const [specialists, setSpecialists] = useState<OrgSpecialist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add Specialist Modal State
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [type, setType] = useState<'trainer' | 'nutritionist' | 'physical_therapist'>('trainer')
  const [bio, setBio] = useState('')
  const [credentials, setCredentials] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Created Specialist Confirmation Dialog State
  const [createdSpecInfo, setCreatedSpecInfo] = useState<{
    name: string
    email: string
    password: string
    field: string
  } | null>(null)
  const [copiedPass, setCopiedPass] = useState(false)

  // Success Toast
  const [successToast, setSuccessToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setSuccessToast(msg)
    setTimeout(() => setSuccessToast(null), 3500)
  }

  const loadSpecialists = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.getOrgSpecialists()
      setSpecialists(res?.specialists || [])
    } catch (err: any) {
      console.error('Failed to load organization specialists:', err)
      setError(err?.message || 'Could not load organization specialists.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSpecialists()
  }, [])

  const handleCreateSpecialist = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError(null)

    if (!name.trim() || !email.trim() || !password) {
      setCreateError('Please fill out all required fields.')
      return
    }

    if (password.length < 8) {
      setCreateError('Temporary password must be at least 8 characters.')
      return
    }

    setCreating(true)
    try {
      await api.createOrgSpecialist({
        name: name.trim(),
        email: email.trim(),
        password,
        type,
        bio: bio.trim() || undefined,
        credentials: credentials.trim() || undefined,
      })

      // Store created info to present the credentials confirmation dialog
      const fieldName =
        type === 'trainer' ? 'Move' : type === 'nutritionist' ? 'Eat' : 'Recover'

      setCreatedSpecInfo({
        name: name.trim(),
        email: email.trim(),
        password,
        field: fieldName,
      })

      // Reset form fields
      setName('')
      setEmail('')
      setPassword('')
      setType('trainer')
      setBio('')
      setCredentials('')
      setCreateOpen(false)

      showToast('Specialist created successfully and auto-approved.')
      loadSpecialists()
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create specialist.')
    } finally {
      setCreating(false)
    }
  }

  const copyPassword = async () => {
    if (!createdSpecInfo?.password) return
    try {
      await navigator.clipboard.writeText(createdSpecInfo.password)
      setCopiedPass(true)
      setTimeout(() => setCopiedPass(false), 2500)
    } catch {
      // Fallback
    }
  }

  const getPillarIcon = (field: string) => {
    switch (field) {
      case 'Move':
        return <Dumbbell size={18} />
      case 'Eat':
        return <Apple size={18} />
      case 'Recover':
        return <HeartPulse size={18} />
      default:
        return <Users size={18} />
    }
  }

  const getPillarBadge = (field: string) => {
    switch (field) {
      case 'Move':
        return 'bg-move-tint text-move border-move/20'
      case 'Eat':
        return 'bg-eat-tint text-eat border-eat/20'
      case 'Recover':
        return 'bg-recover-tint text-recover border-recover/20'
      default:
        return 'bg-sand text-ink border-line'
    }
  }

  const getRoleLabel = (type: string) => {
    switch (type) {
      case 'trainer':
        return 'Personal Trainer & Coach'
      case 'nutritionist':
        return 'Dietitian & Nutritionist'
      case 'physical_therapist':
        return 'Physical Therapist'
      default:
        return type
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="h-display text-2xl sm:text-3xl font-bold text-ink">
            Organization Specialists
          </h1>
          <p className="text-sm text-ink-2 mt-1">
            Dedicated trainers, nutritionists, and physical therapists affiliated with your organization.
          </p>
        </div>

        <Btn
          onClick={() => {
            setCreateError(null)
            setCreateOpen(true)
          }}
          className="gap-2 self-start sm:self-auto shrink-0"
        >
          <Plus size={18} /> Add Specialist
        </Btn>
      </div>

      {/* Success Toast */}
      {successToast && (
        <div className="p-3.5 rounded-xl bg-ok/10 border border-ok/20 text-ok text-sm font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
          <Btn variant="secondary" onClick={loadSpecialists} className="text-xs h-8">
            Retry
          </Btn>
        </div>
      )}

      {/* Specialists Grid */}
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      ) : specialists.length === 0 ? (
        <Card className="p-10 text-center">
          <EmptyState
            title="No organization specialists yet"
            text="Add your internal personal trainers, clinical dietitians, or physical therapists to start assigning them to your members."
          />
          <Btn
            onClick={() => setCreateOpen(true)}
            className="mt-6 gap-2"
          >
            <Plus size={18} /> Add First Specialist
          </Btn>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {specialists.map((sp) => (
            <Card key={sp.specialistId} className="p-6 flex flex-col justify-between hover:shadow-sm transition-all">
              <div>
                {/* Pillar Tag & Caseload */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${getPillarBadge(
                      sp.field
                    )}`}
                  >
                    {getPillarIcon(sp.field)}
                    <span>{sp.field}</span>
                  </span>

                  <span className="text-xs font-semibold text-ink-2 bg-sand px-2.5 py-1 rounded-full">
                    {sp.activeClientCount}{' '}
                    {sp.activeClientCount === 1 ? 'client' : 'clients'}
                  </span>
                </div>

                {/* Name & Title */}
                <h2 className="text-lg font-bold text-ink leading-tight">{sp.name}</h2>
                <p className="text-xs font-medium text-ink-2 mt-0.5">
                  {getRoleLabel(sp.type)}
                </p>

                {/* Email */}
                <div className="flex items-center gap-1.5 text-xs text-ink-2 mt-3 pt-3 border-t border-line">
                  <Mail size={14} className="shrink-0" />
                  <span className="truncate">{sp.email}</span>
                </div>

                {/* Bio / Credentials Preview */}
                {sp.bio && (
                  <p className="text-xs text-ink-2 mt-2.5 line-clamp-3 leading-relaxed">
                    {sp.bio}
                  </p>
                )}
              </div>

              {/* Status footer */}
              <div className="mt-5 pt-3 border-t border-line flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1 text-ok font-semibold">
                  <CheckCircle2 size={14} /> Auto-approved
                </span>
                <span className="text-ink-2">Available for booking</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Specialist Modal */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add Organization Specialist"
      >
        <form onSubmit={handleCreateSpecialist} className="space-y-4 pt-1">
          <p className="text-sm text-ink-2">
            Register a coach or clinician affiliated with your organization. They are automatically approved and receive upcoming schedule booking slots immediately.
          </p>

          {createError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-600" />
              <span>{createError}</span>
            </div>
          )}

          <Field label="Full Legal Name">
            {(p) => (
              <input
                {...p}
                className={inputCls}
                placeholder="e.g. Dr. Tarek Mansour"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            )}
          </Field>

          <Field label="Specialist Email">
            {(p) => (
              <input
                {...p}
                type="email"
                className={inputCls}
                placeholder="specialist@apex.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            )}
          </Field>

          <Field label="Temporary Password" helper="Must be at least 8 characters">
            {(p) => (
              <PasswordInput
                {...p}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            )}
          </Field>

          <Field label="Pillar & Discipline">
            {(p) => (
              <select
                {...p}
                className={inputCls}
                value={type}
                onChange={(e) =>
                  setType(e.target.value as 'trainer' | 'nutritionist' | 'physical_therapist')
                }
              >
                <option value="trainer">Move: Personal Trainer & Coach</option>
                <option value="nutritionist">Eat: Dietitian & Nutritionist</option>
                <option value="physical_therapist">Recover: Physical Therapist</option>
              </select>
            )}
          </Field>

          <Field label="Credentials & Licensure (Optional)">
            {(p) => (
              <input
                {...p}
                className={inputCls}
                placeholder="e.g. BSc Physiotherapy, CSCS Certified"
                value={credentials}
                onChange={(e) => setCredentials(e.target.value)}
              />
            )}
          </Field>

          <Field label="Professional Bio (Optional)">
            {(p) => (
              <textarea
                {...p}
                rows={2}
                className={`${inputCls} h-auto py-2`}
                placeholder="Brief introduction or coaching philosophy..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            )}
          </Field>

          <div className="flex justify-end gap-2.5 pt-3">
            <Btn
              type="button"
              variant="secondary"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              Cancel
            </Btn>
            <Btn type="submit" disabled={creating}>
              {creating ? 'Creating Specialist...' : 'Create Specialist'}
            </Btn>
          </div>
        </form>
      </Dialog>

      {/* Post-Creation Temporary Password Confirmation Dialog */}
      <Dialog
        open={Boolean(createdSpecInfo)}
        onClose={() => setCreatedSpecInfo(null)}
        title="Specialist Created Successfully"
      >
        <div className="space-y-4 pt-1">
          <div className="size-12 rounded-2xl bg-ok/10 text-ok flex items-center justify-center mx-auto mb-2">
            <CheckCircle2 size={28} />
          </div>

          <p className="text-center text-sm text-ink-2">
            <strong>{createdSpecInfo?.name}</strong> has been added as a{' '}
            <strong>{createdSpecInfo?.field}</strong> specialist under your organization.
          </p>

          <div className="p-4 rounded-xl bg-paper border border-line space-y-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-2 block">
                Login Email
              </span>
              <span className="text-sm font-semibold text-ink font-mono select-all">
                {createdSpecInfo?.email}
              </span>
            </div>

            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-2 block mb-1">
                Temporary Password
              </span>
              <div className="flex items-center justify-between gap-2 bg-white p-2.5 rounded-lg border border-line">
                <span className="font-mono text-sm font-bold text-ink select-all">
                  {createdSpecInfo?.password}
                </span>
                <button
                  type="button"
                  onClick={copyPassword}
                  className="p-1 text-ink-2 hover:text-ink text-xs font-semibold inline-flex items-center gap-1"
                >
                  {copiedPass ? (
                    <>
                      <Check size={14} className="text-ok" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy size={14} /> Copy
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs leading-relaxed flex items-start gap-2">
            <Lock size={16} className="shrink-0 mt-0.5" />
            <span>
              <strong>Important:</strong> Please share this temporary password securely with the specialist. They can log in immediately at <strong className="font-semibold">rebound.eg/login</strong> to manage their schedule and assigned clients.
            </span>
          </div>

          <div className="pt-2">
            <Btn
              onClick={() => setCreatedSpecInfo(null)}
              className="w-full"
            >
              Done
            </Btn>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

