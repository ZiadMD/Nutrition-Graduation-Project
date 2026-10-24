import { useEffect, useState } from 'react'
import {
  Headset,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Search,
  Filter,
  ShieldAlert,
  Send,
  Lock,
  MessageSquare,
  UserX,
  CreditCard,
  CalendarX,
  RefreshCw,
} from 'lucide-react'
import { Btn, Card, Chip, Gate, inputCls, PageHead, Skeleton } from '../../ui'
import { api } from '../../api'
import { useLanguage } from '../../context/LanguageContext'

export default function AdminSupport() {
  const { t, isRtl } = useLanguage()

  const [loading, setLoading] = useState(true)
  const [tickets, setTickets] = useState<any[]>([])
  const [metrics, setMetrics] = useState({
    totalOpen: 0,
    urgentCount: 0,
    inProgressCount: 0,
    resolvedCount: 0,
    disputesCount: 0,
  })

  // Filter states
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Inspect drawer
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null)
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null)
  const [ticketMessages, setTicketMessages] = useState<any[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [replyMessage, setReplyMessage] = useState('')
  const [isInternalNote, setIsInternalNote] = useState(false)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const loadTickets = async () => {
    setLoading(true)
    try {
      const res = await api.getAdminSupportTickets({
        status: statusFilter,
        category: categoryFilter,
        priority: priorityFilter,
        q: searchQuery,
      })
      setTickets(res.tickets || [])
      setMetrics(res.metrics)
    } catch (err) {
      console.error('Failed to load admin support tickets:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTickets()
  }, [statusFilter, categoryFilter, priorityFilter, searchQuery])

  const openTicketDetail = async (id: number) => {
    setSelectedTicketId(id)
    setLoadingDetail(true)
    setActionSuccess(null)
    try {
      const res = await api.getSupportTicket(id)
      setSelectedTicket(res.ticket)
      setTicketMessages(res.messages || [])
    } catch (err) {
      console.error('Failed to load ticket detail:', err)
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTicketId || !replyMessage.trim()) return
    setActionLoading(true)
    try {
      const res = await api.sendTicketMessage(selectedTicketId, replyMessage.trim(), isInternalNote)
      setTicketMessages((prev) => [...prev, res.message])
      setReplyMessage('')
      setIsInternalNote(false)
      loadTickets()
    } catch (err) {
      console.error('Failed to send admin message:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedTicketId) return
    setActionLoading(true)
    try {
      const res = await api.updateAdminSupportTicket(selectedTicketId, { status: newStatus })
      setSelectedTicket(res.ticket)
      setActionSuccess(`Status updated to ${newStatus}`)
      loadTickets()
    } catch (err) {
      console.error('Failed to update status:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleTriggerAction = async (action: 'suspend_user' | 'cancel_booking' | 'flag_refund') => {
    if (!selectedTicketId) return
    const confirmMsg =
      action === 'suspend_user'
        ? 'Are you sure you want to suspend this user account?'
        : action === 'cancel_booking'
        ? 'Are you sure you want to cancel this booking and free the slot?'
        : 'Approve refund request for finance reconciliation?'
    if (!window.confirm(confirmMsg)) return

    setActionLoading(true)
    try {
      const res = await api.executeAdminTicketAction(selectedTicketId, action)
      setActionSuccess(res.actionMessage)
      openTicketDetail(selectedTicketId)
      loadTickets()
    } catch (err: any) {
      alert(err?.message || 'Action failed')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <PageHead
        title={t('nav.support')}
        sub="Monitor platform inquiries, dispute resolutions, and user conduct reports."
      />

      {/* KPI Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <p className="text-[13px] font-bold text-ink-2 uppercase tracking-wide">
            {t('support.status_open')}
          </p>
          <p className="num text-[36px] font-extrabold text-ink mt-1">{metrics.totalOpen}</p>
          <p className="text-[12px] text-ink-2 mt-1">Pending support triage</p>
        </Card>

        <Card className="p-5 bg-bad-tint/30 border-bad/30">
          <p className="text-[13px] font-bold text-bad uppercase tracking-wide flex items-center gap-1.5">
            <AlertTriangle size={15} /> {t('support.prio_urgent')}
          </p>
          <p className="num text-[36px] font-extrabold text-bad mt-1">{metrics.urgentCount}</p>
          <p className="text-[12px] text-bad mt-1">High priority or conduct flags</p>
        </Card>

        <Card className="p-5">
          <p className="text-[13px] font-bold text-ink-2 uppercase tracking-wide">
            {t('support.status_in_progress')}
          </p>
          <p className="num text-[36px] font-extrabold text-ink mt-1">
            {metrics.inProgressCount}
          </p>
          <p className="text-[12px] text-ink-2 mt-1">Active investigations</p>
        </Card>

        <Card className="p-5">
          <p className="text-[13px] font-bold text-ok uppercase tracking-wide">
            {t('support.status_resolved')}
          </p>
          <p className="num text-[36px] font-extrabold text-ok mt-1">{metrics.resolvedCount}</p>
          <p className="text-[12px] text-ok mt-1">Closed successfully</p>
        </Card>
      </div>

      {/* Filters and Search Bar */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'All' },
              { id: 'open', label: t('support.status_open') },
              { id: 'in_progress', label: t('support.status_in_progress') },
              { id: 'resolved', label: t('support.status_resolved') },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id)}
                className={`px-3.5 py-1.5 rounded-full text-[13px] font-bold border transition cursor-pointer ${
                  statusFilter === st.id
                    ? 'bg-ink text-white border-ink'
                    : 'bg-white border-line text-ink-2 hover:border-ink'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className={`${inputCls} w-auto text-[13px] font-semibold`}
            >
              <option value="all">All Categories</option>
              <option value="session_dispute">{t('support.cat_session_dispute')}</option>
              <option value="specialist_conduct">{t('support.cat_specialist_conduct')}</option>
              <option value="client_conduct">{t('support.cat_client_conduct')}</option>
              <option value="billing_refund">{t('support.cat_billing_refund')}</option>
              <option value="technical_issue">{t('support.cat_technical_issue')}</option>
              <option value="general_inquiry">{t('support.cat_general_inquiry')}</option>
            </select>

            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <Search
                size={16}
                className={`absolute top-1/2 -translate-y-1/2 text-ink-2 ${
                  isRtl ? 'right-3' : 'left-3'
                }`}
              />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ticket or user..."
                className={`${inputCls} ${isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'} text-[13px]`}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Tickets Table / Queue */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center text-ink-2">
            <CheckCircle2 size={40} className="mx-auto mb-2 text-ok" />
            <p className="font-bold text-ink text-[16px]">All clear!</p>
            <p className="text-[13px]">No tickets match the selected filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14px]">
              <thead className="bg-paper border-b border-line text-ink-2 text-[12px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-5">Ticket</th>
                  <th className="py-3 px-5">Reporter</th>
                  <th className="py-3 px-5">Category & Subject</th>
                  <th className="py-3 px-5">Priority</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {tickets.map((tk) => (
                  <tr key={tk.id} className="hover:bg-paper/50 transition">
                    <td className="py-4 px-5">
                      <span className="num font-bold text-ink">{tk.ticketNumber}</span>
                    </td>
                    <td className="py-4 px-5">
                      <p className="font-bold text-ink">{tk.reporterName}</p>
                      <span className="text-[12px] text-ink-2 capitalize">{tk.reporterRole}</span>
                    </td>
                    <td className="py-4 px-5 max-w-xs">
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-sand text-ink mb-1">
                        {tk.category.replace('_', ' ')}
                      </span>
                      <p className="font-semibold text-ink truncate">{tk.subject}</p>
                      {tk.targetUserName && (
                        <p className="text-[12px] text-bad mt-0.5">
                          Target: {tk.targetUserName}
                        </p>
                      )}
                    </td>
                    <td className="py-4 px-5">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase ${
                          tk.priority === 'urgent'
                            ? 'bg-bad text-white'
                            : tk.priority === 'high'
                            ? 'bg-warn-tint text-warn'
                            : 'bg-paper text-ink'
                        }`}
                      >
                        {tk.priority}
                      </span>
                    </td>
                    <td className="py-4 px-5">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[12px] font-bold ${
                          tk.status === 'resolved'
                            ? 'bg-ok-tint text-ok'
                            : tk.status === 'in_progress'
                            ? 'bg-warn-tint text-warn'
                            : 'bg-sand text-ink'
                        }`}
                      >
                        {tk.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-right">
                      <Btn
                        variant="secondary"
                        onClick={() => openTicketDetail(tk.id)}
                        className="text-[13px] py-1.5 px-3 min-h-0"
                      >
                        Inspect
                      </Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Inspect Ticket Slide-over / Modal */}
      {selectedTicketId && selectedTicket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-xs"
          onClick={() => setSelectedTicketId(null)}
        >
          <div
            className="relative flex flex-col w-full max-w-3xl max-h-[92vh] bg-white rounded-3xl border border-line shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-line bg-paper">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-move-tint text-move grid place-items-center">
                  <Headset size={20} />
                </div>
                <div>
                  <span className="num font-extrabold text-[18px]">
                    {selectedTicket.ticketNumber}
                  </span>
                  <span className="ml-2 px-2.5 py-0.5 rounded-full text-[12px] font-bold bg-sand text-ink">
                    {selectedTicket.category.replace('_', ' ')}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedTicketId(null)}
                className="size-9 rounded-lg grid place-items-center hover:bg-ink/5 transition cursor-pointer text-ink-2"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {actionSuccess && (
                <div className="p-3.5 rounded-xl bg-ok-tint border border-ok text-ok text-[14px] font-bold flex items-center gap-2">
                  <CheckCircle2 size={16} /> {actionSuccess}
                </div>
              )}

              {/* Context Summary */}
              <div className="grid sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-paper border border-line text-[13px]">
                <div>
                  <span className="text-ink-2 block font-semibold">Reporter:</span>
                  <p className="font-bold text-ink">{selectedTicket.reporterName}</p>
                  <span className="text-ink-2">{selectedTicket.reporterEmail}</span>
                </div>
                <div>
                  <span className="text-ink-2 block font-semibold">Target User:</span>
                  <p className="font-bold text-bad">
                    {selectedTicket.targetUserName || 'None'}
                  </p>
                </div>
                <div>
                  <span className="text-ink-2 block font-semibold">Status:</span>
                  <div className="flex items-center gap-2 mt-1">
                    <select
                      value={selectedTicket.status}
                      onChange={(e) => handleUpdateStatus(e.target.value)}
                      className={`${inputCls} h-8 py-0 px-2 text-[12px] font-bold`}
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Quick Moderation Actions */}
              <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-sand/40 border border-line">
                <span className="text-[12px] font-bold text-ink-2 mr-2">Admin Actions:</span>
                {selectedTicket.targetUserId && (
                  <Btn
                    variant="danger"
                    onClick={() => handleTriggerAction('suspend_user')}
                    disabled={actionLoading}
                    className="text-[12px] py-1 px-3 min-h-0 inline-flex items-center gap-1.5"
                  >
                    <UserX size={14} /> Suspend User
                  </Btn>
                )}
                {selectedTicket.bookingId && (
                  <Btn
                    variant="secondary"
                    onClick={() => handleTriggerAction('cancel_booking')}
                    disabled={actionLoading}
                    className="text-[12px] py-1 px-3 min-h-0 inline-flex items-center gap-1.5"
                  >
                    <CalendarX size={14} /> Cancel & Free Booking
                  </Btn>
                )}
                <Btn
                  variant="secondary"
                  onClick={() => handleTriggerAction('flag_refund')}
                  disabled={actionLoading}
                  className="text-[12px] py-1 px-3 min-h-0 inline-flex items-center gap-1.5"
                >
                  <CreditCard size={14} /> Approve Refund Flag
                </Btn>
              </div>

              {/* Messages Thread */}
              <div>
                <p className="text-[14px] font-bold mb-3 flex items-center gap-2">
                  <MessageSquare size={16} /> Conversation & Audit History
                </p>
                <div className="space-y-3">
                  {ticketMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-4 rounded-2xl border text-[14px] ${
                        msg.isInternal
                          ? 'bg-amber-50 border-amber-200'
                          : msg.senderRole === 'admin'
                          ? 'bg-paper border-line'
                          : 'bg-white border-line'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5 text-[12px]">
                        <span className="font-bold flex items-center gap-1.5">
                          {msg.isInternal && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded">
                              <Lock size={11} /> Internal Note
                            </span>
                          )}
                          {msg.senderName} ({msg.senderRole})
                        </span>
                        <span className="text-ink-2">{msg.createdAt?.slice(0, 16)}</span>
                      </div>
                      <p className="leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Admin Reply Form */}
              <form onSubmit={handleSendReply} className="space-y-3 pt-3 border-t border-line">
                <div className="flex items-center justify-between">
                  <label className="text-[13px] font-bold text-ink">
                    {isInternalNote ? 'Add Staff Note' : 'Send Public Reply to Client'}
                  </label>
                  <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isInternalNote}
                      onChange={(e) => setIsInternalNote(e.target.checked)}
                      className="rounded"
                    />
                    Internal note only (hidden from client)
                  </label>
                </div>

                <textarea
                  required
                  rows={3}
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder={
                    isInternalNote
                      ? 'Add internal notes or investigation findings...'
                      : 'Type a message to the client...'
                  }
                  className={`${inputCls} h-auto py-2.5`}
                />

                <div className="flex justify-end gap-2">
                  <Btn type="submit" disabled={actionLoading || !replyMessage.trim()}>
                    <Send size={15} /> {isInternalNote ? 'Save Note' : 'Send Reply'}
                  </Btn>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
