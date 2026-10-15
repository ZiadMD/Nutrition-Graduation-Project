import { useEffect, useState } from 'react'
import { Coins, CheckCircle2, Clock, ArrowRight, ShieldCheck, UserCheck } from 'lucide-react'
import { Card, PageHead, Skeleton, Gate, Btn, Dialog, Field, inputCls, type DemoState } from '../../ui'
import { api } from '../../api'

export default function FinancePayouts() {
  const [state, setState] = useState<DemoState>('loading')
  const [specialists, setSpecialists] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [selectedSpecialist, setSelectedSpecialist] = useState<any | null>(null)
  const [payoutRef, setPayoutRef] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  const loadData = () => {
    setState('loading')
    api.getFinancePayouts()
      .then((res) => {
        setSpecialists(res.specialists || [])
        setHistory(res.history || [])
        setState('loaded')
      })
      .catch((err) => {
        console.error('Failed to load payouts:', err)
        setState('error')
      })
  }

  useEffect(() => {
    loadData()
  }, [])

  const totalDisbursed = history
    .filter((h) => h.status === 'paid')
    .reduce((sum, h) => sum + (h.net_payout_egp || 0), 0)

  const totalPending = specialists.reduce((sum, s) => sum + (s.pendingAmount || 0), 0)

  const handleSettle = async () => {
    if (!selectedSpecialist) return
    setIsSubmitting(true)
    try {
      const net = selectedSpecialist.pendingAmount > 0 ? selectedSpecialist.pendingAmount : selectedSpecialist.netOwed
      const gross = Math.round(net / 0.8)
      const platformCut = gross - net

      await api.settleFinancePayout({
        specialistId: selectedSpecialist.id,
        amountEgp: gross,
        platformCutEgp: platformCut,
        netPayoutEgp: net,
        reference: payoutRef.trim() || undefined,
      })

      setToastMsg(`Disbursement of ${net.toLocaleString('en-US')} EGP settled for ${selectedSpecialist.name}`)
      setSelectedSpecialist(null)
      setPayoutRef('')
      loadData()
      setTimeout(() => setToastMsg(''), 4000)
    } catch (err: any) {
      alert(err.message || 'Failed to settle payout')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <PageHead
        title="Specialist Payouts"
        sub="Manage provider compensation, platform fee deductions (20%), and disbursements."
      />

      {toastMsg && (
        <div className="mb-5 p-4 rounded-xl bg-ok-tint border border-ok/20 text-ink font-semibold flex items-center gap-2">
          <CheckCircle2 size={18} className="text-ok" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-sand rounded-2xl p-5 sm:p-6">
          <p className="label uppercase text-ink-2">Total Settled</p>
          <p className="num text-[36px] sm:text-[40px] leading-none mt-2">
            {totalDisbursed.toLocaleString('en-US')} <span className="text-[14px] font-normal font-sans">EGP</span>
          </p>
          <p className="text-[12px] text-ink-2 mt-2">Historical disbursements paid to providers</p>
        </div>

        <div className="bg-recover-tint rounded-2xl p-5 sm:p-6">
          <p className="label uppercase text-ink-2">Pending Balance</p>
          <p className="num text-[36px] sm:text-[40px] leading-none mt-2 text-recover">
            {totalPending.toLocaleString('en-US')} <span className="text-[14px] font-normal font-sans">EGP</span>
          </p>
          <p className="text-[12px] text-ink-2 mt-2">Earned by specialists awaiting settlement</p>
        </div>

        <div className="bg-paper border border-line rounded-2xl p-5 sm:p-6">
          <p className="label uppercase text-ink-2">Platform Split</p>
          <p className="num text-[36px] sm:text-[40px] leading-none mt-2">
            20% <span className="text-[14px] font-normal font-sans text-ink-2">Commission</span>
          </p>
          <p className="text-[12px] text-ink-2 mt-2">80% credited directly to specialist</p>
        </div>
      </div>

      <Gate
        state={state}
        retry={loadData}
        skeleton={
          <div className="space-y-4">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        }
        empty={<Card className="p-8 text-center text-ink-2">No specialist accounts found.</Card>}
      >
        {/* Specialists Payout Table */}
        <Card className="mb-8 overflow-x-auto">
          <div className="p-5 border-b border-line flex justify-between items-center">
            <div>
              <p className="font-bold text-[18px]">Provider Earnings & Payout Status</p>
              <p className="text-[13px] text-ink-2">Calculated from verified completed sessions</p>
            </div>
          </div>

          <table className="w-full text-left text-[14px]">
            <thead className="bg-paper border-b border-line text-[12px] uppercase text-ink-2">
              <tr>
                <th className="py-3 px-5 font-semibold">Specialist</th>
                <th className="py-3 px-5 font-semibold">Role</th>
                <th className="py-3 px-5 font-semibold">Sessions</th>
                <th className="py-3 px-5 font-semibold">Gross Earned</th>
                <th className="py-3 px-5 font-semibold">Platform Cut (20%)</th>
                <th className="py-3 px-5 font-semibold">Net Payable (80%)</th>
                <th className="py-3 px-5 font-semibold">Pending</th>
                <th className="py-3 px-5 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {specialists.map((sp) => (
                <tr key={sp.id} className="hover:bg-paper/30 transition">
                  <td className="py-3.5 px-5">
                    <p className="font-semibold text-ink">{sp.name}</p>
                    <p className="text-[12px] text-ink-2">{sp.email}</p>
                  </td>
                  <td className="py-3.5 px-5 capitalize text-ink-2">
                    {sp.type.replace('_', ' ')}
                  </td>
                  <td className="py-3.5 px-5 font-semibold">
                    {sp.completedSessions}
                  </td>
                  <td className="py-3.5 px-5 font-semibold">
                    {sp.grossEarned.toLocaleString('en-US')} EGP
                  </td>
                  <td className="py-3.5 px-5 text-ink-2">
                    {sp.platformFee.toLocaleString('en-US')} EGP
                  </td>
                  <td className="py-3.5 px-5 font-bold text-ink">
                    {sp.netOwed.toLocaleString('en-US')} EGP
                  </td>
                  <td className="py-3.5 px-5">
                    {sp.pendingAmount > 0 ? (
                      <span className="font-bold text-recover">
                        {sp.pendingAmount.toLocaleString('en-US')} EGP
                      </span>
                    ) : (
                      <span className="text-[12px] font-semibold text-ok bg-ok-tint px-2 py-0.5 rounded">
                        Settled
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <Btn
                      variant={sp.pendingAmount > 0 ? 'primary' : 'secondary'}
                      className="text-[13px] py-1.5 px-3 min-h-9"
                      onClick={() => {
                        setSelectedSpecialist(sp)
                        setPayoutRef(`PAY-${sp.name.split(/\s+/)[0]?.toUpperCase()}-${Date.now().toString().slice(-4)}`)
                      }}
                    >
                      Settle payout
                    </Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Historical Disbursements Table */}
        <Card className="overflow-x-auto">
          <div className="p-5 border-b border-line">
            <p className="font-bold text-[18px]">Settled Disbursement History</p>
            <p className="text-[13px] text-ink-2">Historical bank / wallet transfers approved by Finance</p>
          </div>

          <table className="w-full text-left text-[14px]">
            <thead className="bg-paper border-b border-line text-[12px] uppercase text-ink-2">
              <tr>
                <th className="py-3 px-5 font-semibold">Reference</th>
                <th className="py-3 px-5 font-semibold">Provider</th>
                <th className="py-3 px-5 font-semibold">Gross</th>
                <th className="py-3 px-5 font-semibold">Platform Fee</th>
                <th className="py-3 px-5 font-semibold">Disbursed (Net)</th>
                <th className="py-3 px-5 font-semibold">Status</th>
                <th className="py-3 px-5 font-semibold">Settled Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {history.map((h) => (
                <tr key={h.id} className="hover:bg-paper/30 transition">
                  <td className="py-3.5 px-5 font-mono text-[12px] font-bold text-ink">
                    {h.reference || `PAY-${h.id}`}
                  </td>
                  <td className="py-3.5 px-5 font-semibold text-ink">
                    {h.specialist_name}
                  </td>
                  <td className="py-3.5 px-5 text-ink-2">
                    {h.amount_egp.toLocaleString('en-US')} EGP
                  </td>
                  <td className="py-3.5 px-5 text-ink-2">
                    {h.platform_cut_egp.toLocaleString('en-US')} EGP
                  </td>
                  <td className="py-3.5 px-5 font-bold text-ink">
                    {h.net_payout_egp.toLocaleString('en-US')} EGP
                  </td>
                  <td className="py-3.5 px-5">
                    <span className={`px-2 py-0.5 rounded text-[12px] font-bold ${h.status === 'paid' ? 'bg-ok-tint text-ok' : 'bg-sand text-ink'}`}>
                      {h.status === 'paid' ? 'Paid' : 'Pending'}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-ink-2 text-[13px]">
                    {h.paid_at ? new Date(h.paid_at).toLocaleDateString('en-GB') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Gate>

      {/* Settle Payout Modal Dialog */}
      <Dialog
        open={Boolean(selectedSpecialist)}
        onClose={() => setSelectedSpecialist(null)}
        title="Settle Specialist Disbursement"
      >
        {selectedSpecialist && (
          <div className="space-y-4">
            <p className="text-[14px] text-ink-2">
              Transfer settlement for <strong className="text-ink">{selectedSpecialist.name}</strong> ({selectedSpecialist.type.replace('_', ' ')}).
            </p>

            <div className="bg-paper p-4 rounded-xl space-y-2 text-[14px]">
              <div className="flex justify-between">
                <span className="text-ink-2">Completed Sessions:</span>
                <span className="font-bold">{selectedSpecialist.completedSessions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-2">Gross Billings:</span>
                <span className="font-bold">{selectedSpecialist.grossEarned.toLocaleString('en-US')} EGP</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-2">Platform Cut (20%):</span>
                <span className="font-bold text-ink-2">-{selectedSpecialist.platformFee.toLocaleString('en-US')} EGP</span>
              </div>
              <div className="pt-2 border-t border-line flex justify-between text-[16px]">
                <span className="font-bold">Net Payout to Specialist:</span>
                <span className="font-bold text-recover">
                  {(selectedSpecialist.pendingAmount > 0 ? selectedSpecialist.pendingAmount : selectedSpecialist.netOwed).toLocaleString('en-US')} EGP
                </span>
              </div>
            </div>

            <Field label="Settlement Reference / Transfer ID" helper="E.g. Bank wire ref, InstaPay reference, or internal check number.">
              <input
                className={inputCls}
                placeholder="PAY-REF-XXXX"
                value={payoutRef}
                onChange={(e) => setPayoutRef(e.target.value)}
              />
            </Field>

            <div className="flex justify-end gap-3 pt-3">
              <Btn variant="secondary" onClick={() => setSelectedSpecialist(null)}>
                Cancel
              </Btn>
              <Btn onClick={handleSettle} disabled={isSubmitting}>
                {isSubmitting ? 'Processing...' : 'Confirm & Mark as Paid'}
              </Btn>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}

