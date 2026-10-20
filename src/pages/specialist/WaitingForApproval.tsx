import { useState } from 'react'
import {
  Clock,
  ShieldCheck,
  ShieldAlert,
  FileText,
  CheckCircle2,
  RefreshCw,
  LogOut,
  Mail,
  Building2,
  Calendar,
  AlertTriangle,
} from 'lucide-react'
import { Btn, Card, Tag } from '../../ui'
import { api, removeToken } from '../../api'

interface WaitingForApprovalProps {
  user: any
  onApproved?: () => void
}

export default function WaitingForApproval({ user, onApproved }: WaitingForApprovalProps) {
  const [checking, setChecking] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  const isRejected = user?.approvalStatus === 'rejected'

  const checkStatus = async () => {
    setChecking(true)
    setStatusMsg(null)
    try {
      const refreshedUser = await api.getMe()
      if (refreshedUser?.approvalStatus === 'approved') {
        setStatusMsg('🎉 Congratulations! Your account has been approved.')
        if (onApproved) {
          onApproved()
        } else {
          window.location.reload()
        }
      } else if (refreshedUser?.approvalStatus === 'rejected') {
        setStatusMsg('Application status: Rejected. Please contact compliance.')
      } else {
        setStatusMsg('Application is still in review by the medical compliance team.')
      }
    } catch {
      setStatusMsg('Unable to refresh status right now. Please try again.')
    } finally {
      setChecking(false)
    }
  }

  const handleLogout = () => {
    removeToken()
    window.location.href = '/login'
  }

  const roleLabel =
    user?.type === 'physical_therapist'
      ? 'Physical Therapist'
      : user?.type === 'nutritionist'
      ? 'Clinical Dietitian'
      : 'Personal Trainer'

  const svcType =
    user?.type === 'physical_therapist'
      ? 'recover'
      : user?.type === 'nutritionist'
      ? 'eat'
      : 'move'

  const docs = Array.isArray(user?.documents) && user.documents.length > 0
    ? user.documents
    : [
        { name: 'Syndicate_Licence_Registration.pdf', size: 'PDF, 1.2 MB' },
        { name: 'University_Degree_Certificate.pdf', size: 'PDF, 0.8 MB' },
        { name: 'National_ID_Card.jpg', size: 'JPG, 0.4 MB' },
      ]

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
      {/* Top Status Header */}
      <Card className="p-6 sm:p-8 mb-6 border-line relative overflow-hidden">
        <div
          className={`absolute top-0 left-0 right-0 h-1.5 ${
            isRejected ? 'bg-[#a02a2a]' : 'bg-[#e07a38]'
          }`}
        />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div
              className={`size-12 rounded-2xl flex items-center justify-center shrink-0 ${
                isRejected
                  ? 'bg-bad-tint text-[#a02a2a]'
                  : 'bg-warn-tint text-[#8c4e00]'
              }`}
            >
              {isRejected ? <ShieldAlert size={26} /> : <Clock size={26} className="animate-pulse" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold tracking-wide uppercase ${
                    isRejected
                      ? 'bg-bad-tint text-[#a02a2a] border border-[#a02a2a]/20'
                      : 'bg-warn-tint text-[#8c4e00] border border-[#8c4e00]/20'
                  }`}
                >
                  {isRejected ? 'Needs Revision' : 'Waiting for Approval'}
                </span>
                <Tag svc={svcType}>{roleLabel}</Tag>
              </div>
              <h1 className="h-display text-[26px] sm:text-[30px] mt-1 text-ink">
                {isRejected ? 'Application Not Approved' : 'Your account is under review'}
              </h1>
            </div>
          </div>
        </div>

        <p className="text-ink-2 text-[15px] sm:text-[16px] leading-relaxed mb-6">
          {isRejected
            ? 'Our clinical compliance team reviewed your submitted documents and could not verify your syndicate registration or credentials. Please review the details below or contact our team.'
            : 'Thank you for applying to join Rebound. We verify the identity, medical syndicate license, and degree qualifications of every practitioner before granting access to patient charts and booking tools.'}
        </p>

        {/* Verification Progress Tracker */}
        <div className="bg-sand/60 border border-line rounded-2xl p-5 mb-6">
          <p className="font-bold text-[14px] text-ink mb-3 uppercase tracking-wider text-xs">
            Licensing & Review Timeline
          </p>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 size={20} className="text-[#1d6b3d] shrink-0 mt-0.5" />
              <div>
                <p className="text-[14px] font-bold text-ink">Application & Credentials Submitted</p>
                <p className="text-[13px] text-ink-2">
                  Dossier received with legal identification and credentials.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div
                className={`size-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  isRejected ? 'bg-[#a02a2a] text-white' : 'bg-[#e07a38] text-white animate-pulse'
                }`}
              >
                {isRejected ? <AlertTriangle size={12} /> : <div className="size-2 bg-white rounded-full" />}
              </div>
              <div>
                <p className="text-[14px] font-bold text-ink">
                  {isRejected ? 'Compliance Verification Flagged' : 'Medical Board Verification (In Progress)'}
                </p>
                <p className="text-[13px] text-ink-2">
                  {isRejected
                    ? 'Our compliance director flagged issues with the credentials. See email for feedback.'
                    : 'Our clinical team is checking your Syndicate registration and practice certificates against Egyptian official health registries (typically 24–48 hours).'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 opacity-60">
              <div className="size-5 rounded-full border-2 border-line bg-paper flex items-center justify-center shrink-0 mt-0.5" />
              <div>
                <p className="text-[14px] font-bold text-ink">Clinical Workspace Activation</p>
                <p className="text-[13px] text-ink-2">
                  Patient care roster, video consultation rooms, and calendar slots will unlock automatically once approved.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Btn onClick={checkStatus} disabled={checking}>
            <RefreshCw size={18} className={checking ? 'animate-spin' : ''} />
            {checking ? 'Checking Status...' : 'Check Approval Status'}
          </Btn>
          <Btn variant="secondary" onClick={handleLogout}>
            <LogOut size={18} /> Log out
          </Btn>
        </div>

        {statusMsg && (
          <div className="mt-4 p-3 rounded-xl bg-paper border border-line text-[14px] font-medium text-ink flex items-center gap-2">
            <span className="size-2 rounded-full bg-ink animate-ping" />
            {statusMsg}
          </div>
        )}
      </Card>

      {/* Submitted Dossier Details Card */}
      <Card className="p-6 sm:p-7 border-line">
        <h2 className="font-bold text-[18px] text-ink mb-4 flex items-center gap-2">
          <FileText size={20} className="text-ink-2" />
          Submitted Application Dossier
        </h2>

        <div className="grid sm:grid-cols-2 gap-4 pb-5 border-b border-line text-[14px]">
          <div>
            <p className="text-ink-2 text-xs font-semibold uppercase">Practitioner Name</p>
            <p className="font-bold text-ink text-[16px] mt-0.5">{user?.name || 'Dr. Specialist'}</p>
          </div>
          <div>
            <p className="text-ink-2 text-xs font-semibold uppercase">Account Email</p>
            <p className="font-medium text-ink mt-0.5">{user?.email || 'N/A'}</p>
          </div>
          <div>
            <p className="text-ink-2 text-xs font-semibold uppercase">National ID / Passport</p>
            <p className="font-mono font-medium text-ink mt-0.5">{user?.nationalId || 'Verified on file'}</p>
          </div>
          <div>
            <p className="text-ink-2 text-xs font-semibold uppercase">Syndicate License ID</p>
            <p className="font-mono font-medium text-ink mt-0.5">{user?.syndicateId || 'Egyptian Health Syndicate'}</p>
          </div>
          <div>
            <p className="text-ink-2 text-xs font-semibold uppercase">Practice City & Experience</p>
            <p className="font-medium text-ink mt-0.5">
              {user?.city || 'Cairo'} · {user?.yearsExperience || 5} years experience
            </p>
          </div>
          <div>
            <p className="text-ink-2 text-xs font-semibold uppercase">Standard Session Rate</p>
            <p className="font-bold text-ink mt-0.5">
              {user?.rateEgp ? `${user.rateEgp} EGP / session` : '500 EGP / session'}
            </p>
          </div>
        </div>

        {/* Attached Documents */}
        <div className="pt-4">
          <p className="text-ink-2 text-xs font-semibold uppercase mb-3">Submitted Legal Documents</p>
          <div className="grid sm:grid-cols-2 gap-2.5">
            {docs.map((doc: any, i: number) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-xl border border-line bg-paper"
              >
                <FileText size={18} className="text-ink-2 shrink-0" />
                <div className="overflow-hidden">
                  <p className="font-semibold text-[13px] text-ink truncate">{doc.name || 'Document'}</p>
                  <p className="text-[11px] text-ink-2">{doc.size || 'PDF, 1.0 MB'} · Under Review</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Clinical compliance contact prompt */}
        <div className="mt-6 pt-4 border-t border-line flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[13px] text-ink-2">
          <span>Need to update your license documents or have questions?</span>
          <a
            href="mailto:compliance@rebound.eg?subject=Specialist%20Verification%20Inquiry"
            className="inline-flex items-center gap-1.5 font-bold text-ink hover:underline underline-offset-4"
          >
            <Mail size={15} /> compliance@rebound.eg
          </a>
        </div>
      </Card>
    </div>
  )
}
