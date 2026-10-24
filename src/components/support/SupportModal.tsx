import React, { useEffect, useState } from 'react'
import {
  X,
  LifeBuoy,
  Send,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  CreditCard,
  Bug,
  HelpCircle,
  CalendarX,
  Lock,
} from 'lucide-react'
import { Btn, Card, Chip, inputCls, Skeleton } from '../index'
import { api } from '../../api'
import { useLanguage } from '../../context/LanguageContext'

interface SupportModalProps {
  open: boolean
  onClose: () => void
  initialCategory?: string
  initialTargetUserId?: number | null
  initialTargetName?: string
  initialBookingId?: number | null
}

const CATEGORIES = [
  { id: 'session_dispute', icon: CalendarX, key: 'support.cat_session_dispute' },
  { id: 'specialist_conduct', icon: ShieldAlert, key: 'support.cat_specialist_conduct' },
  { id: 'billing_refund', icon: CreditCard, key: 'support.cat_billing_refund' },
  { id: 'technical_issue', icon: Bug, key: 'support.cat_technical_issue' },
  { id: 'general_inquiry', icon: HelpCircle, key: 'support.cat_general_inquiry' },
]

export function SupportModal({
  open,
  onClose,
  initialCategory = 'general_inquiry',
  initialTargetUserId = null,
  initialTargetName = '',
  initialBookingId = null,
}: SupportModalProps) {
  const { t, isRtl } = useLanguage()
  const [activeTab, setActiveTab] = useState<'new' | 'list'>('new')

  // Form states
  const [category, setCategory] = useState(initialCategory)
  const [priority, setPriority] = useState('medium')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // My Tickets states
  const [myTickets, setMyTickets] = useState<any[]>([])
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null)
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null)
  const [ticketMessages, setTicketMessages] = useState<any[]>([])
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)

  useEffect(() => {
    if (initialCategory) setCategory(initialCategory)
  }, [initialCategory])

  useEffect(() => {
    if (open && activeTab === 'list') {
      loadMyTickets()
    }
  }, [open, activeTab])

  const loadMyTickets = async () => {
    setLoadingTickets(true)
    try {
      const res = await api.getMySupportTickets()
      setMyTickets(res.tickets || [])
    } catch (err) {
      console.error('Failed to load user tickets:', err)
    } finally {
      setLoadingTickets(false)
    }
  }

  const loadTicketDetail = async (id: number) => {
    setSelectedTicketId(id)
    try {
      const res = await api.getSupportTicket(id)
      setSelectedTicket(res.ticket)
      setTicketMessages(res.messages || [])
    } catch (err) {
      console.error('Failed to load ticket detail:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      await api.createSupportTicket({
        category,
        priority,
        subject,
        description,
        targetUserId: initialTargetUserId,
        bookingId: initialBookingId,
      })
      setSuccessMsg(t('support.ticket_created_success'))
      setSubject('')
      setDescription('')
      setTimeout(() => {
        setActiveTab('list')
        setSuccessMsg(null)
      }, 1500)
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to submit ticket.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTicketId || !replyText.trim()) return
    setSendingReply(true)
    try {
      const res = await api.sendTicketMessage(selectedTicketId, replyText.trim())
      setTicketMessages((prev) => [...prev, res.message])
      setReplyText('')
      loadMyTickets()
    } catch (err) {
      console.error('Failed to send reply:', err)
    } finally {
      setSendingReply(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-2xl max-h-[90vh] bg-white rounded-3xl border border-line shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-line bg-paper">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-move-tint text-move grid place-items-center">
              <LifeBuoy size={20} />
            </div>
            <div>
              <h3 className="h-display text-[20px] leading-tight">
                {t('support.modal_title')}
              </h3>
              <p className="text-[13px] text-ink-2">
                {initialTargetName ? `${t('support.report_specialist')}: ${initialTargetName}` : 'Rebound Care & Operations'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-9 rounded-lg grid place-items-center hover:bg-ink/5 transition cursor-pointer text-ink-2"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="flex border-b border-line bg-white px-5 pt-2 gap-4">
          <button
            onClick={() => {
              setActiveTab('new')
              setSelectedTicketId(null)
            }}
            className={`pb-3 font-bold text-[14px] border-b-2 transition cursor-pointer ${
              activeTab === 'new'
                ? 'border-ink text-ink'
                : 'border-transparent text-ink-2 hover:text-ink'
            }`}
          >
            {t('support.tab_new_ticket')}
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`pb-3 font-bold text-[14px] border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === 'list'
                ? 'border-ink text-ink'
                : 'border-transparent text-ink-2 hover:text-ink'
            }`}
          >
            {t('support.tab_my_tickets')}
            {myTickets.length > 0 && (
              <span className="size-5 rounded-full bg-sand text-[11px] grid place-items-center font-bold text-ink">
                {myTickets.length}
              </span>
            )}
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {activeTab === 'new' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {successMsg && (
                <div className="p-4 rounded-xl bg-ok-tint border border-ok text-ok text-[14px] font-semibold flex items-center gap-2">
                  <CheckCircle2 size={18} /> {successMsg}
                </div>
              )}
              {errorMsg && (
                <div className="p-4 rounded-xl bg-bad-tint border border-bad text-bad text-[14px] font-semibold flex items-center gap-2">
                  <AlertCircle size={18} /> {errorMsg}
                </div>
              )}

              {/* Category selector */}
              <div>
                <label className="block text-[13px] font-bold text-ink mb-2">
                  {t('support.category')}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CATEGORIES.map((c) => {
                    const Icon = c.icon
                    const selected = category === c.id
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCategory(c.id)}
                        className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition cursor-pointer ${
                          selected
                            ? 'border-ink bg-paper shadow-xs ring-1 ring-ink'
                            : 'border-line hover:border-ink/40 bg-white'
                        }`}
                      >
                        <Icon size={16} className={selected ? 'text-ink' : 'text-ink-2'} />
                        <span className="text-[13px] font-semibold leading-tight text-ink">
                          {t(c.key)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-[13px] font-bold text-ink mb-1.5">
                  {t('support.priority')}
                </label>
                <div className="flex gap-2">
                  {['low', 'medium', 'high', 'urgent'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-bold border capitalize transition cursor-pointer ${
                        priority === p
                          ? 'bg-ink text-white border-ink'
                          : 'bg-white border-line text-ink-2 hover:border-ink'
                      }`}
                    >
                      {t(`support.prio_${p}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-[13px] font-bold text-ink mb-1">
                  {t('support.subject')}
                </label>
                <input
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={t('support.subject_placeholder')}
                  className={inputCls}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[13px] font-bold text-ink mb-1">
                  {t('support.description')}
                </label>
                <textarea
                  required
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('support.desc_placeholder')}
                  className={`${inputCls} h-auto py-2.5`}
                />
              </div>

              <div className="pt-2">
                <Btn type="submit" disabled={submitting} className="w-full">
                  {submitting ? t('support.submitting') : t('support.submit_ticket')}
                </Btn>
              </div>
            </form>
          )}

          {activeTab === 'list' && (
            <div>
              {selectedTicketId ? (
                /* Ticket Detail & Conversation View */
                <div className="space-y-4">
                  <button
                    onClick={() => setSelectedTicketId(null)}
                    className="text-[13px] font-bold text-ink flex items-center gap-1.5 mb-2 cursor-pointer hover:underline"
                  >
                    ← {t('common.back')}
                  </button>

                  {selectedTicket && (
                    <div className="p-4 rounded-2xl bg-paper border border-line">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="num font-bold text-[13px] text-ink-2">
                          {selectedTicket.ticketNumber}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                            selectedTicket.priority === 'urgent'
                              ? 'bg-bad-tint text-bad'
                              : 'bg-sand text-ink'
                          }`}>
                            {t(`support.prio_${selectedTicket.priority}`)}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            selectedTicket.status === 'resolved'
                              ? 'bg-ok-tint text-ok'
                              : 'bg-warn-tint text-warn'
                          }`}>
                            {t(`support.status_${selectedTicket.status}`)}
                          </span>
                        </div>
                      </div>
                      <h4 className="font-bold text-[16px] text-ink mt-2">
                        {selectedTicket.subject}
                      </h4>
                      {selectedTicket.resolutionNote && (
                        <div className="mt-2.5 p-3 rounded-xl bg-ok-tint/80 border border-ok/30 text-ok text-[13px]">
                          <strong>{t('support.resolve_ticket')}:</strong> {selectedTicket.resolutionNote}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Message Thread */}
                  <div className="space-y-3 pt-2">
                    {ticketMessages.map((msg) => {
                      const isMe = msg.senderRole === 'client' || msg.senderRole === 'specialist'
                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                        >
                          <div className="flex items-center gap-1.5 mb-1 text-[11px] text-ink-2">
                            <span className="font-bold">
                              {msg.senderRole === 'admin'
                                ? t('support.admin_badge')
                                : msg.senderName}
                            </span>
                          </div>
                          <div
                            className={`max-w-[85%] rounded-2xl p-3.5 text-[14px] leading-relaxed ${
                              isMe
                                ? 'bg-ink text-white rounded-br-none'
                                : 'bg-sand text-ink rounded-bl-none'
                            }`}
                          >
                            {msg.message}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Reply Input */}
                  <form onSubmit={handleSendReply} className="flex gap-2 pt-4 border-t border-line">
                    <input
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={t('support.desc_placeholder')}
                      className={`${inputCls} flex-1`}
                      disabled={sendingReply}
                    />
                    <Btn type="submit" disabled={sendingReply || !replyText.trim()}>
                      <Send size={16} />
                    </Btn>
                  </form>
                </div>
              ) : (
                /* Ticket List View */
                <div>
                  {loadingTickets ? (
                    <div className="space-y-3">
                      <Skeleton className="h-16" />
                      <Skeleton className="h-16" />
                    </div>
                  ) : myTickets.length === 0 ? (
                    <div className="p-8 text-center text-ink-2">
                      <HelpCircle size={36} className="mx-auto mb-2 text-line" />
                      <p className="font-bold text-ink text-[16px]">{t('support.no_tickets')}</p>
                      <p className="text-[13px] mt-1">{t('support.no_tickets_sub')}</p>
                      <Btn
                        variant="secondary"
                        onClick={() => setActiveTab('new')}
                        className="mt-4"
                      >
                        {t('support.tab_new_ticket')}
                      </Btn>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {myTickets.map((tk) => (
                        <div
                          key={tk.id}
                          onClick={() => loadTicketDetail(tk.id)}
                          className="p-4 rounded-2xl border border-line bg-paper hover:bg-sand/40 transition cursor-pointer flex items-center justify-between gap-4"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="num font-bold text-[12px] text-ink-2">
                                {tk.ticketNumber}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                tk.status === 'resolved'
                                  ? 'bg-ok-tint text-ok'
                                  : 'bg-warn-tint text-warn'
                              }`}>
                                {t(`support.status_${tk.status}`)}
                              </span>
                            </div>
                            <p className="font-bold text-[15px] truncate text-ink">
                              {tk.subject}
                            </p>
                            <p className="text-[13px] text-ink-2 truncate mt-0.5">
                              {tk.lastMessage}
                            </p>
                          </div>
                          <span className="text-ink-2 text-[12px] shrink-0">→</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
