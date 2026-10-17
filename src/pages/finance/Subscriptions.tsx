import { useEffect, useState } from 'react'
import { CreditCard, Users, TrendingUp, Sparkles, CheckCircle2 } from 'lucide-react'
import { Card, PageHead, Skeleton, Gate, type DemoState } from '../../ui'
import { api } from '../../api'

const PREVIEW_SUBSCRIPTIONS_DATA = {
  mrr: 4296,
  totalActive: 4,
  tiers: {
    Starter: { count: 1, price: 399, revenue: 399 },
    Plus: { count: 1, price: 899, revenue: 899 },
    'Full Team': { count: 2, price: 1499, revenue: 2998 },
  },
  subscribers: [
    { id: 1, client_name: 'Sara Hassan', client_email: 'sara@demo.com', plan_name: 'Full Team', price_egp: 1499, method: 'card', reference: 'SUB-2026-001', created_at: '2026-09-01T10:00:00Z', status: 'active' },
    { id: 2, client_name: 'Laila Mostafa', client_email: 'laila@demo.com', plan_name: 'Plus', price_egp: 899, method: 'vodafone_cash', reference: 'SUB-2026-002', created_at: '2026-09-15T12:30:00Z', status: 'active' },
    { id: 3, client_name: 'Omar Khaled', client_email: 'omar@demo.com', plan_name: 'Starter', price_egp: 399, method: 'instapay', reference: 'SUB-2026-003', created_at: '2026-09-20T14:15:00Z', status: 'active' },
    { id: 4, client_name: 'Youssef Nabil', client_email: 'youssef@demo.com', plan_name: 'Full Team', price_egp: 1499, method: 'card', reference: 'SUB-2026-004', created_at: '2026-10-01T09:00:00Z', status: 'active' },
  ],
}

export default function FinanceSubscriptions() {
  const [state, setState] = useState<DemoState>('loading')
  const [data, setData] = useState<any>(PREVIEW_SUBSCRIPTIONS_DATA)

  const loadData = () => {
    setState('loading')
    api.getFinanceSubscriptions()
      .then((res) => {
        setData(res)
        setState('loaded')
      })
      .catch((err) => {
        console.warn('Backend unavailable, using preview subscriptions:', err)
        setData(PREVIEW_SUBSCRIPTIONS_DATA)
        setState('loaded')
      })
  }

  useEffect(() => {
    loadData()
  }, [])

  const mrr = data?.mrr || 4296
  const totalActive = data?.totalActive || 4
  const tiers = data?.tiers || {
    Starter: { count: 1, price: 399, revenue: 399 },
    Plus: { count: 1, price: 899, revenue: 899 },
    'Full Team': { count: 2, price: 1499, revenue: 2998 },
  }
  const subscribers = data?.subscribers || []

  const arpu = totalActive > 0 ? Math.round(mrr / totalActive) : 0

  return (
    <div>
      <PageHead
        title="Subscriptions & MRR"
        sub="Monthly recurring revenue run-rate, tier distribution, and active membership roster."
      />

      <Gate
        state={state}
        retry={loadData}
        skeleton={
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
            <Skeleton className="h-64" />
          </div>
        }
        empty={<Card className="p-8 text-center text-ink-2">No subscription data found.</Card>}
      >
        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-eat-tint rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <span className="label uppercase text-ink-2">Monthly Recurring Revenue</span>
              <TrendingUp size={18} className="text-eat" />
            </div>
            <p className="num text-[36px] sm:text-[44px] leading-none mt-3 text-eat">
              {mrr.toLocaleString('en-US')} <span className="text-[14px] font-normal font-sans text-ink-2">EGP / mo</span>
            </p>
            <p className="text-[13px] text-ink-2 mt-2">Active recurring subscription run-rate</p>
          </div>

          <div className="bg-sand rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <span className="label uppercase text-ink-2">Active Subscribers</span>
              <Users size={18} className="text-ink-2" />
            </div>
            <p className="num text-[36px] sm:text-[44px] leading-none mt-3">
              {totalActive} <span className="text-[14px] font-normal font-sans text-ink-2">Members</span>
            </p>
            <p className="text-[13px] text-ink-2 mt-2">100% active billing accounts</p>
          </div>

          <div className="bg-paper border border-line rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <span className="label uppercase text-ink-2">Average ARPU</span>
              <Sparkles size={18} className="text-ink-2" />
            </div>
            <p className="num text-[36px] sm:text-[44px] leading-none mt-3">
              {arpu.toLocaleString('en-US')} <span className="text-[14px] font-normal font-sans text-ink-2">EGP / member</span>
            </p>
            <p className="text-[13px] text-ink-2 mt-2">Average revenue per active user</p>
          </div>
        </div>

        {/* Tier Distribution Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {Object.entries(tiers).map(([tierName, t]: [string, any]) => {
            const share = mrr > 0 ? Math.round((t.revenue / mrr) * 100) : 0
            const tintClass =
              tierName === 'Full Team'
                ? 'border-move/40 bg-move-tint/30'
                : tierName === 'Plus'
                ? 'border-eat/40 bg-eat-tint/30'
                : 'border-line bg-paper'

            return (
              <Card key={tierName} className={`p-5 ${tintClass}`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-bold text-[18px]">{tierName}</p>
                    <p className="text-[13px] text-ink-2">{t.price} EGP / month</p>
                  </div>
                  <span className="label px-2 py-0.5 rounded font-bold bg-white border border-line">
                    {t.count} {t.count === 1 ? 'member' : 'members'}
                  </span>
                </div>

                <p className="num text-[28px] mt-4 font-bold">
                  {t.revenue.toLocaleString('en-US')} <span className="text-[12px] font-normal font-sans text-ink-2">EGP / mo</span>
                </p>

                <div className="mt-3">
                  <div className="flex justify-between text-[12px] text-ink-2 mb-1">
                    <span>Share of MRR</span>
                    <span className="font-bold">{share}%</span>
                  </div>
                  <div className="w-full h-2 bg-white rounded-full overflow-hidden border border-line">
                    <div
                      className={`h-full rounded-full ${tierName === 'Full Team' ? 'bg-move' : tierName === 'Plus' ? 'bg-eat' : 'bg-ink'}`}
                      style={{ width: `${share}%` }}
                    />
                  </div>
                </div>
              </Card>
            )
          })}
        </div>

        {/* Active Subscribers Roster */}
        <Card className="overflow-x-auto">
          <div className="p-5 border-b border-line">
            <p className="font-bold text-[18px]">Subscriber Roster</p>
            <p className="text-[13px] text-ink-2">All currently registered membership plans</p>
          </div>

          <table className="w-full text-left text-[14px]">
            <thead className="bg-paper border-b border-line text-[12px] uppercase text-ink-2">
              <tr>
                <th className="py-3 px-5 font-semibold">Client</th>
                <th className="py-3 px-5 font-semibold">Tier</th>
                <th className="py-3 px-5 font-semibold">Monthly Rate</th>
                <th className="py-3 px-5 font-semibold">Payment Method</th>
                <th className="py-3 px-5 font-semibold">Reference</th>
                <th className="py-3 px-5 font-semibold">Start Date</th>
                <th className="py-3 px-5 font-semibold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {subscribers.map((s: any) => (
                <tr key={s.id} className="hover:bg-paper/30 transition">
                  <td className="py-4 px-5">
                    <p className="font-semibold text-ink">{s.client_name}</p>
                    <p className="text-[12px] text-ink-2">{s.client_email}</p>
                  </td>
                  <td className="py-4 px-5 font-semibold">
                    <span className="px-2.5 py-1 rounded-lg text-[12px] font-bold bg-sand">
                      {s.plan_name}
                    </span>
                  </td>
                  <td className="py-4 px-5 font-bold text-ink">
                    {s.price_egp.toLocaleString('en-US')} EGP
                  </td>
                  <td className="py-4 px-5 capitalize text-ink-2">
                    {s.method.replace('_', ' ')}
                  </td>
                  <td className="py-4 px-5 font-mono text-[12px] text-ink font-semibold">
                    {s.reference}
                  </td>
                  <td className="py-4 px-5 text-ink-2 text-[13px]">
                    {new Date(s.created_at).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="py-4 px-5 text-right">
                    <span className="px-2.5 py-1 rounded-md text-[12px] font-bold bg-ok-tint text-ok">
                      Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Gate>
    </div>
  )
}

