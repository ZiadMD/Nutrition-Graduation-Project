import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import {
  Building2,
  Copy,
  Check,
  Users,
  UserCheck,
  UserMinus,
  Activity,
  FileEdit,
  ArrowRight,
  ShieldCheck,
  Dumbbell,
  Apple,
  HeartPulse,
  RefreshCw,
} from 'lucide-react'
import { Card, PageHead, Skeleton, Btn, SVC } from '../../ui'
import { api } from '../../api'

/**
 * OrgAdmin Dashboard (/app/org)
 *
 * Provides a high-level operational overview for organization administrators:
 * - Organization identification & invite code distribution
 * - Seat utilization & capacity limits
 * - Aggregated engagement counts (active members, plan updates)
 * - Specialist assignment distribution across Move, Eat, and Recover
 *
 * Privacy Rule:
 * Org admins never see medical diagnoses, client profiles, injuries, or personal notes.
 * Only aggregate usage metrics and assignment linkages are surfaced.
 */
export default function OrgDashboard() {
  const [info, setInfo] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [infoRes, statsRes] = await Promise.all([
        api.getOrgInfo(),
        api.getOrgStats(),
      ])

      // Extract organization object and stats
      const orgData = infoRes?.organization || infoRes
      setInfo(orgData)
      setStats(statsRes)
    } catch (err: any) {
      console.error('Failed to load organization dashboard:', err)
      setError(err?.message || 'Could not load organization metrics. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const copyInviteCode = async () => {
    if (!info?.inviteCode) return
    try {
      await navigator.clipboard.writeText(info.inviteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Fallback if clipboard API is restricted
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHead title="Organization Dashboard" sub="Loading team analytics..." />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHead title="Organization Dashboard" sub="Operational metrics & capacity" />
        <Card className="p-8 text-center border-red-200 bg-red-50/50">
          <div className="size-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
            <RefreshCw size={24} />
          </div>
          <h2 className="text-lg font-bold text-ink">Failed to load dashboard data</h2>
          <p className="text-sm text-ink-2 mt-1 mb-6 max-w-md mx-auto">{error}</p>
          <Btn onClick={loadData}>Try again</Btn>
        </Card>
      </div>
    )
  }

  const seatsUsed = stats?.seatsUsed ?? info?.seatsUsed ?? 0
  const seatLimit = stats?.seatLimit ?? info?.seatLimit ?? 1
  const seatsRemaining = stats?.seatsRemaining ?? info?.seatsRemaining ?? Math.max(0, seatLimit - seatsUsed)
  const occupancyPercent = Math.min(100, Math.round((seatsUsed / seatLimit) * 100))

  const moveCount = stats?.assignmentsByField?.move ?? 0
  const eatCount = stats?.assignmentsByField?.eat ?? 0
  const recoverCount = stats?.assignmentsByField?.recover ?? 0
  const totalAssignments = moveCount + eatCount + recoverCount

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-move-tint text-move">
              <Building2 size={24} />
            </span>
            <div>
              <h1 className="h-display text-2xl sm:text-3xl font-bold text-ink">
                {info?.name || 'Organization Dashboard'}
              </h1>
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-2">
                {info?.type ? `${info.type.toUpperCase()} PARTNER` : 'B2B ORGANIZATION'}
              </span>
            </div>
          </div>
        </div>

        {/* Invite Code Pill */}
        <div className="flex items-center gap-3 bg-white border border-line p-2.5 px-4 rounded-2xl shadow-sm">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-2 block">
              Team Invite Code
            </span>
            <span className="font-mono text-base font-bold tracking-widest text-ink">
              {info?.inviteCode || '--------'}
            </span>
          </div>
          <Btn
            variant="secondary"
            onClick={copyInviteCode}
            className="text-xs h-9 px-3 gap-1.5 shrink-0"
            aria-label="Copy team invite code"
          >
            {copied ? (
              <>
                <Check size={14} className="text-ok" /> Copied
              </>
            ) : (
              <>
                <Copy size={14} /> Copy
              </>
            )}
          </Btn>
        </div>
      </div>

      {/* Invite Code Sharing Banner */}
      <div className="p-4 rounded-2xl bg-sand/60 border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
        <div className="flex items-start sm:items-center gap-3">
          <ShieldCheck size={20} className="text-ink shrink-0 mt-0.5 sm:mt-0" />
          <p className="text-ink-2">
            Share invite code <strong className="font-mono text-ink font-bold">{info?.inviteCode}</strong> with your colleagues or athletes so they can join via <strong className="text-ink">/join</strong> without paying.
          </p>
        </div>
        <Link
          to="/app/org/members"
          className="font-bold text-ink underline underline-offset-4 text-xs whitespace-nowrap self-end sm:self-auto"
        >
          View member roster &rarr;
        </Link>
      </div>

      {/* Seat Capacity Meter */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="text-base font-bold text-ink">Sponsored Seat Capacity</h2>
            <p className="text-xs text-ink-2">
              Seats are occupied by client members who registered with your organization code.
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold font-mono text-ink">
              {seatsUsed}
            </span>
            <span className="text-sm font-semibold text-ink-2"> / {seatLimit} seats</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-3 rounded-full bg-paper overflow-hidden border border-line">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              occupancyPercent >= 90
                ? 'bg-amber-500'
                : occupancyPercent >= 100
                ? 'bg-red-500'
                : 'bg-ink'
            }`}
            style={{ width: `${occupancyPercent}%` }}
          />
        </div>

        <div className="flex justify-between items-center text-xs text-ink-2 mt-2 font-medium">
          <span>{occupancyPercent}% utilized</span>
          <span>{seatsRemaining} seats remaining</span>
        </div>
      </Card>

      {/* Operational Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Members */}
        <Card className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-ink-2 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider">Total Members</span>
            <Users size={18} />
          </div>
          <div>
            <span className="text-3xl font-bold font-mono text-ink">
              {stats?.totalMembers ?? 0}
            </span>
            <p className="text-xs text-ink-2 mt-1">Sponsored accounts</p>
          </div>
        </Card>

        {/* Members With Assignment */}
        <Card className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-move mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-2">Assigned</span>
            <UserCheck size={18} />
          </div>
          <div>
            <span className="text-3xl font-bold font-mono text-ink">
              {stats?.membersWithAssignment ?? 0}
            </span>
            <p className="text-xs text-ink-2 mt-1">Has active care specialist</p>
          </div>
        </Card>

        {/* Members Without Assignment */}
        <Card className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-600 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-2">Unassigned</span>
            <UserMinus size={18} />
          </div>
          <div>
            <span className="text-3xl font-bold font-mono text-ink">
              {stats?.membersWithoutAssignment ?? 0}
            </span>
            <p className="text-xs text-ink-2 mt-1">Awaiting specialist match</p>
          </div>
        </Card>

        {/* Active Members (7d) */}
        <Card className="p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-600 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-2">Active (7 Days)</span>
            <Activity size={18} />
          </div>
          <div>
            <span className="text-3xl font-bold font-mono text-ink">
              {stats?.activeMembersLast7Days ?? 0}
            </span>
            <p className="text-xs text-ink-2 mt-1">Logged into platform</p>
          </div>
        </Card>
      </div>

      {/* Bottom Grid: Assignments by Field & Quick Actions */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Assignments Breakdown by Pillar */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-ink">Assignments by Pillar</h2>
              <p className="text-xs text-ink-2 mt-0.5">
                Distribution across Move, Eat, and Recover specialties
              </p>
            </div>
            <span className="text-xs font-bold uppercase tracking-wider bg-sand px-2.5 py-1 rounded-full text-ink">
              {totalAssignments} Active Links
            </span>
          </div>

          <div className="space-y-4 pt-2">
            {/* Move Pillar */}
            <div>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="font-bold flex items-center gap-2 text-ink">
                  <span className="size-2 rounded-full bg-move" />
                  Move (Fitness & Training)
                </span>
                <span className="font-mono font-bold text-ink">{moveCount}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-paper overflow-hidden border border-line">
                <div
                  className="h-full bg-move rounded-full transition-all duration-500"
                  style={{
                    width: totalAssignments > 0 ? `${(moveCount / totalAssignments) * 100}%` : '0%',
                  }}
                />
              </div>
            </div>

            {/* Eat Pillar */}
            <div>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="font-bold flex items-center gap-2 text-ink">
                  <span className="size-2 rounded-full bg-eat" />
                  Eat (Clinical Nutrition)
                </span>
                <span className="font-mono font-bold text-ink">{eatCount}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-paper overflow-hidden border border-line">
                <div
                  className="h-full bg-eat rounded-full transition-all duration-500"
                  style={{
                    width: totalAssignments > 0 ? `${(eatCount / totalAssignments) * 100}%` : '0%',
                  }}
                />
              </div>
            </div>

            {/* Recover Pillar */}
            <div>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="font-bold flex items-center gap-2 text-ink">
                  <span className="size-2 rounded-full bg-recover" />
                  Recover (Physical Therapy)
                </span>
                <span className="font-mono font-bold text-ink">{recoverCount}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-paper overflow-hidden border border-line">
                <div
                  className="h-full bg-recover rounded-full transition-all duration-500"
                  style={{
                    width: totalAssignments > 0 ? `${(recoverCount / totalAssignments) * 100}%` : '0%',
                  }}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Activity & Operational Quick Actions */}
        <Card className="p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-ink">Organization Operations</h2>
            <p className="text-xs text-ink-2 mt-0.5 mb-6">
              Manage your member roster and dedicated care team.
            </p>

            <div className="space-y-3">
              <Link
                to="/app/org/members"
                className="flex items-center justify-between p-3.5 rounded-xl border border-line hover:border-ink hover:bg-paper transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-lg bg-move-tint text-move flex items-center justify-center">
                    <Users size={18} />
                  </div>
                  <div>
                    <strong className="text-sm font-bold text-ink block">Member Management</strong>
                    <span className="text-xs text-ink-2">Assign specialists and review status</span>
                  </div>
                </div>
                <ArrowRight size={16} className="text-ink-2" />
              </Link>

              <Link
                to="/app/org/specialists"
                className="flex items-center justify-between p-3.5 rounded-xl border border-line hover:border-ink hover:bg-paper transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-lg bg-recover-tint text-recover flex items-center justify-center">
                    <Dumbbell size={18} />
                  </div>
                  <div>
                    <strong className="text-sm font-bold text-ink block">Specialist Roster</strong>
                    <span className="text-xs text-ink-2">Add internal trainers and therapists</span>
                  </div>
                </div>
                <ArrowRight size={16} className="text-ink-2" />
              </Link>
            </div>
          </div>

          {/* Privacy Footnote */}
          <div className="mt-6 pt-4 border-t border-line text-[11px] text-ink-2 flex items-center gap-2">
            <ShieldCheck size={14} className="shrink-0 text-ok" />
            <span>
              Clinical confidentiality active: Medical data and personal plans remain restricted.
            </span>
          </div>
        </Card>
      </div>
    </div>
  )
}
