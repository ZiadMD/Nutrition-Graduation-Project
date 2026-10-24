import { useState, useEffect } from 'react'
import {
  Search,
  Users,
  UserPlus,
  X,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Building2,
  RefreshCw,
  Plus,
} from 'lucide-react'
import { Card, PageHead, Btn, Dialog, Field, inputCls, TableSkeleton, EmptyState } from '../../ui'
import { api } from '../../api'

interface AssignedSpecialist {
  specialistId: number
  name: string
  type: string
  field: 'Move' | 'Eat' | 'Recover'
}

interface OrgMember {
  id: number
  name: string
  email: string
  status: string
  joinedAt: string
  assignedSpecialists: AssignedSpecialist[]
}

interface OrgSpecialist {
  specialistId: number
  name: string
  email: string
  type: string
  field: 'Move' | 'Eat' | 'Recover'
  activeClientCount: number
}

/**
 * Org Members Management (/app/org/members)
 *
 * Provides organization administrators with member roster oversight:
 * - Searchable member directory
 * - Active specialist assignment status with Move / Eat / Recover badges
 * - "Assign specialist" action per member
 * - "End assignment" action with confirmation dialog
 *
 * Privacy Rule & Amendment 3:
 * Members rows NEVER link to client profiles, medical notes, or clinical data.
 * All actions are strictly assignment and account metadata management.
 */
export default function OrgMembers() {
  const [members, setMembers] = useState<OrgMember[]>([])
  const [specialists, setSpecialists] = useState<OrgSpecialist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Assign Specialist Dialog State
  const [assignDialogMember, setAssignDialogMember] = useState<OrgMember | null>(null)
  const [selectedSpecialistId, setSelectedSpecialistId] = useState<number | ''>('')
  const [assignError, setAssignError] = useState<string | null>(null)
  const [assigning, setAssigning] = useState(false)

  // End Assignment Dialog State
  const [endingTarget, setEndingTarget] = useState<{
    member: OrgMember
    specialist: AssignedSpecialist
  } | null>(null)
  const [ending, setEnding] = useState(false)
  const [endError, setEndError] = useState<string | null>(null)

  // Global success flash message
  const [successToast, setSuccessToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setSuccessToast(msg)
    setTimeout(() => setSuccessToast(null), 3500)
  }

  // Load members & specialists from server
  const loadData = async (query = searchQuery) => {
    setLoading(true)
    setError(null)
    try {
      const [membersRes, specialistsRes] = await Promise.all([
        api.getOrgMembers(query),
        api.getOrgSpecialists(),
      ])

      const memberList = membersRes?.members || []
      const specialistList = specialistsRes?.specialists || []

      setMembers(memberList)
      setSpecialists(specialistList)
    } catch (err: any) {
      console.error('Failed to load organization members:', err)
      setError(err?.message || 'Could not load organization members.')
    } finally {
      setLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    loadData(searchQuery)
  }, [searchQuery])

  // Handle assigning a specialist to a member
  const handleAssignSpecialist = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assignDialogMember || !selectedSpecialistId) return

    setAssignError(null)
    setAssigning(true)

    const specialist = specialists.find((s) => s.specialistId === Number(selectedSpecialistId))
    const existingFieldSpec = assignDialogMember.assignedSpecialists.find(
      (s) => s.field === specialist?.field
    )

    if (existingFieldSpec) {
      setAssignError(
        `This member already has a ${specialist?.field} specialist (${existingFieldSpec.name}). End that assignment first.`
      )
      setAssigning(false)
      return
    }

    try {
      await api.assignOrgMember(assignDialogMember.id, Number(selectedSpecialistId))
      showToast(
        `Successfully assigned ${specialist?.name || 'specialist'} to ${assignDialogMember.name}.`
      )
      setAssignDialogMember(null)
      setSelectedSpecialistId('')
      // Refresh roster
      loadData(searchQuery)
    } catch (err: any) {
      if (err?.code === 'FIELD_ALREADY_ASSIGNED') {
        setAssignError(
          `This member already has a ${specialist?.field || ''} specialist. End that assignment first.`
        )
      } else {
        setAssignError(err?.message || 'Failed to assign specialist.')
      }
    } finally {
      setAssigning(false)
    }
  }

  // Handle ending an existing assignment
  const handleEndAssignment = async () => {
    if (!endingTarget) return

    setEndError(null)
    setEnding(true)
    try {
      await api.endOrgAssignment(endingTarget.member.id, endingTarget.specialist.specialistId)
      showToast(
        `Ended assignment with ${endingTarget.specialist.name} for ${endingTarget.member.name}.`
      )
      setEndingTarget(null)
      // Refresh roster
      loadData(searchQuery)
    } catch (err: any) {
      setEndError(err?.message || 'Failed to end assignment.')
    } finally {
      setEnding(false)
    }
  }

  const getFieldBadgeStyle = (field: string) => {
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="h-display text-2xl sm:text-3xl font-bold text-ink">
            Organization Members
          </h1>
          <p className="text-sm text-ink-2 mt-1">
            Manage your sponsored team members and their assigned Move, Eat, and Recover specialists.
          </p>
        </div>

        {/* Member Count Pill */}
        <div className="flex items-center gap-2 bg-white border border-line px-3.5 py-1.5 rounded-full shadow-sm self-start sm:self-auto">
          <Users size={16} className="text-ink-2" />
          <span className="text-xs font-bold text-ink">
            {members.length} {members.length === 1 ? 'Member' : 'Members'}
          </span>
        </div>
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
          <Btn variant="secondary" onClick={() => loadData(searchQuery)} className="text-xs h-8">
            Retry
          </Btn>
        </div>
      )}

      {/* Search Bar & Filters */}
      <Card className="p-4">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-2 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search members by name or email address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`${inputCls} pl-10`}
          />
        </div>
      </Card>

      {/* Members Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={6} />
          </div>
        ) : members.length === 0 ? (
          <div className="p-10">
            <EmptyState
              title={searchQuery ? 'No matching members found' : 'No members registered yet'}
              text={
                searchQuery
                  ? `No members match "${searchQuery}". Clear your search query to see all members.`
                  : 'Share your organization invite code so your colleagues or athletes can register for sponsored access.'
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-paper text-ink-2 text-xs uppercase font-bold tracking-wider">
                  <th className="py-3.5 px-5">Member</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Joined Date</th>
                  <th className="py-3.5 px-5">Assigned Specialists</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {members.map((member) => (
                  <tr key={member.id} className="hover:bg-sand/30 transition-colors">
                    {/* Member Name & Email - NO links to clinical pages (Amendment 3) */}
                    <td className="py-4 px-5">
                      <div className="font-bold text-ink text-base">{member.name}</div>
                      <div className="text-xs text-ink-2 mt-0.5">{member.email}</div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          member.status === 'active'
                            ? 'bg-ok/10 text-ok'
                            : 'bg-bad-tint text-[#a02a2a]'
                        }`}
                      >
                        {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                      </span>
                    </td>

                    {/* Joined Date */}
                    <td className="py-4 px-4 whitespace-nowrap text-xs text-ink-2">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={14} className="text-ink-2" />
                        {member.joinedAt
                          ? new Date(member.joinedAt).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : 'Recently'}
                      </div>
                    </td>

                    {/* Assigned Specialists with Field Badges & End Action */}
                    <td className="py-4 px-5">
                      {member.assignedSpecialists && member.assignedSpecialists.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {member.assignedSpecialists.map((sp) => (
                            <span
                              key={sp.specialistId}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${getFieldBadgeStyle(
                                sp.field
                              )}`}
                            >
                              <span>
                                <strong className="font-bold">{sp.field}:</strong> {sp.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => setEndingTarget({ member, specialist: sp })}
                                className="size-4 rounded hover:bg-black/10 inline-flex items-center justify-center transition-colors ml-0.5"
                                title={`End assignment with ${sp.name}`}
                                aria-label={`End assignment with ${sp.name}`}
                              >
                                <X size={12} />
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-ink-2 italic">No specialists assigned</span>
                      )}
                    </td>

                    {/* Actions: Assign Specialist */}
                    <td className="py-4 px-5 text-right whitespace-nowrap">
                      <Btn
                        variant="secondary"
                        onClick={() => {
                          setAssignDialogMember(member)
                          setSelectedSpecialistId('')
                          setAssignError(null)
                        }}
                        className="text-xs h-8 px-3 gap-1"
                      >
                        <UserPlus size={14} /> Assign
                      </Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Assign Specialist Dialog */}
      <Dialog
        open={Boolean(assignDialogMember)}
        onClose={() => {
          setAssignDialogMember(null)
          setSelectedSpecialistId('')
          setAssignError(null)
        }}
        title={`Assign Specialist`}
      >
        <form onSubmit={handleAssignSpecialist} className="space-y-4 pt-1">
          <p className="text-sm text-ink-2">
            Assign an organization specialist to <strong>{assignDialogMember?.name}</strong>. Each
            member may have at most one specialist per field (Move, Eat, or Recover).
          </p>

          {assignError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-600" />
              <span>{assignError}</span>
            </div>
          )}

          <Field label="Choose Specialist">
            {(p) => (
              <select
                {...p}
                className={inputCls}
                value={selectedSpecialistId}
                onChange={(e) => setSelectedSpecialistId(Number(e.target.value) || '')}
                required
              >
                <option value="">Select an organization specialist...</option>
                {specialists.map((sp) => {
                  const alreadyAssigned = assignDialogMember?.assignedSpecialists.some(
                    (a) => a.field === sp.field
                  )
                  return (
                    <option key={sp.specialistId} value={sp.specialistId}>
                      {sp.name} — {sp.field} ({sp.type.replace('_', ' ')})
                      {alreadyAssigned ? ' [Field already assigned]' : ''}
                    </option>
                  )
                })}
              </select>
            )}
          </Field>

          {specialists.length === 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
              No specialists are registered under your organization yet. Add specialists on the Specialist Roster page first.
            </p>
          )}

          <div className="flex justify-end gap-2.5 pt-2">
            <Btn
              type="button"
              variant="secondary"
              onClick={() => {
                setAssignDialogMember(null)
                setSelectedSpecialistId('')
                setAssignError(null)
              }}
              disabled={assigning}
            >
              Cancel
            </Btn>
            <Btn
              type="submit"
              disabled={assigning || !selectedSpecialistId || specialists.length === 0}
            >
              {assigning ? 'Assigning...' : 'Confirm Assignment'}
            </Btn>
          </div>
        </form>
      </Dialog>

      {/* End Assignment Confirmation Dialog */}
      <Dialog
        open={Boolean(endingTarget)}
        onClose={() => {
          setEndingTarget(null)
          setEndError(null)
        }}
        title="End Specialist Assignment"
      >
        <div className="space-y-4 pt-1">
          <p className="text-sm text-ink-2">
            Are you sure you want to end the <strong>{endingTarget?.specialist.field}</strong>{' '}
            assignment with <strong>{endingTarget?.specialist.name}</strong> for{' '}
            <strong>{endingTarget?.member.name}</strong>?
          </p>

          <div className="p-3 rounded-xl bg-sand/60 border border-line text-xs text-ink-2 leading-relaxed">
            This will remove the specialist from the member's care team. Existing past session records and notes will remain securely archived.
          </div>

          {endError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-red-600" />
              <span>{endError}</span>
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-2">
            <Btn
              type="button"
              variant="secondary"
              onClick={() => {
                setEndingTarget(null)
                setEndError(null)
              }}
              disabled={ending}
            >
              Cancel
            </Btn>
            <Btn
              type="button"
              variant="primary"
              className="bg-bad text-white hover:bg-[#852222]"
              onClick={handleEndAssignment}
              disabled={ending}
            >
              {ending ? 'Ending...' : 'End Assignment'}
            </Btn>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

