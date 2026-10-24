import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { DollarSign, TrendingUp, CreditCard, Coins, ArrowRight, ReceiptText, ShieldCheck, Wallet, ArrowUpRight } from 'lucide-react'
import { Card, PageHead, Skeleton, SVC, Gate, type DemoState } from '../../ui'
import { api } from '../../api'
import { LineChart } from '@/components/charts/LineChart'

const PREVIEW_OVERVIEW_DATA = {
  metrics: {
    grossRevenue: 5546,
    mrr: 4296,
    subscriptionRevenue: 4296,
    sessionRevenue: 1250,
    specialistDisbursed: 1280,
    specialistPending: 760,
    netPlatformProfit: 3506,
    activeSubscribers: 4,
    completedSessions: 3,
    arpu: 1387,
  },
  weeklyTrend: [
    { weekLabel: 'W1', date: '2026-08-25', revenue: 1200, subscriptions: 800, sessions: 400 },
    { weekLabel: 'W2', date: '2026-09-01', revenue: 1450, subscriptions: 950, sessions: 500 },
    { weekLabel: 'W3', date: '2026-09-08', revenue: 1900, subscriptions: 1200, sessions: 700 },
    { weekLabel: 'W4', date: '2026-09-15', revenue: 2300, subscriptions: 1500, sessions: 800 },
    { weekLabel: 'W5', date: '2026-09-22', revenue: 2800, subscriptions: 2000, sessions: 800 },
    { weekLabel: 'W6', date: '2026-09-29', revenue: 3400, subscriptions: 2600, sessions: 800 },
    { weekLabel: 'W7', date: '2026-10-06', revenue: 4200, subscriptions: 3300, sessions: 900 },
    { weekLabel: 'W8', date: '2026-10-13', revenue: 5546, subscriptions: 4296, sessions: 1250 },
  ],
  revenueStreams: {
    subscriptions: { amount: 4296, percentage: 77 },
    sessions: { amount: 1250, percentage: 23 },
  },
  paymentMethods: {
    card: { count: 2, total: 1898 },
    instapay: { count: 1, total: 1499 },
    vodafone_cash: { count: 1, total: 899 },
    fawry: { count: 0, total: 0 },
  },
  recentTransactions: [
    { id: '1', type: 'subscription', reference: 'SUB-2026-001', customer_name: 'Sara Hassan', customer_email: 'sara@demo.com', description: 'Monthly Full Team Plan', method: 'card', amount_egp: 1499 },
    { id: '2', type: 'session', reference: 'SES-2026-042', customer_name: 'Omar Khaled', customer_email: 'omar@demo.com', description: 'Rehab Consultation with Dr. Mona', method: 'instapay', amount_egp: 450 },
    { id: '3', type: 'subscription', reference: 'SUB-2026-002', customer_name: 'Laila Mostafa', customer_email: 'laila@demo.com', description: 'Starter Plan - Movement', method: 'vodafone_cash', amount_egp: 899 },
    { id: '4', type: 'session', reference: 'SES-2026-043', customer_name: 'Youssef Nabil', customer_email: 'youssef@demo.com', description: 'Strength Assessment with Coach Karim', method: 'card', amount_egp: 350 },
  ],
}

export default function FinanceOverview() {
  const [state, setState] = useState<DemoState>('loading')
  const [data, setData] = useState<any>(PREVIEW_OVERVIEW_DATA)

  const loadData = () => {
    setState('loading')
    api.getFinanceOverview()
      .then((res) => {
        setData(res)
        setState('loaded')
      })
      .catch((err) => {
        console.warn('Backend unavailable, using preview finance overview:', err)
        setData(PREVIEW_OVERVIEW_DATA)
        setState('loaded')
      })
  }

  useEffect(() => {
    loadData()
  }, [])

  const m = data?.metrics || {
    grossRevenue: 5546,
    mrr: 4296,
    subscriptionRevenue: 4296,
    sessionRevenue: 1250,
    specialistDisbursed: 1280,
    specialistPending: 760,
    netPlatformProfit: 3506,
    activeSubscribers: 4,
    completedSessions: 3,
    arpu: 1387,
  }

  const weeklyTrend = data?.weeklyTrend || []
  const labels = weeklyTrend.map((w: any) => w.weekLabel)
  const revenuePoints = weeklyTrend.map((w: any) => w.revenue)
  const minR = revenuePoints.length > 0 ? Math.floor(Math.min(...revenuePoints) / 500) * 500 : 0
  const maxR = revenuePoints.length > 0 ? Math.ceil(Math.max(...revenuePoints) / 500) * 500 + 500 : 3000
  const stepR = Math.max(200, Math.round((maxR - minR) / 4))
  const ticksR = [minR, minR + stepR, minR + stepR * 2, minR + stepR * 3, maxR]

  const streams = data?.revenueStreams || {
    subscriptions: { amount: 4296, percentage: 77 },
    sessions: { amount: 1250, percentage: 23 },
  }

  const methods = data?.paymentMethods || {
    card: { count: 2, total: 1898 },
    instapay: { count: 1, total: 1499 },
    vodafone_cash: { count: 1, total: 899 },
    fawry: { count: 0, total: 0 },
  }

  const recentTxs = data?.recentTransactions || []

  return (
    <div>
      <PageHead
        title="Financial Overview"
        sub="Platform collections, recurring revenue, and specialist disbursements."
      />

      <Gate
        state={state}
        retry={loadData}
        skeleton={
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-36" />
              ))}
            </div>
            <Skeleton className="h-72" />
          </div>
        }
        empty={<Card className="p-8 text-center text-ink-2">No financial data recorded yet.</Card>}
      >
        {/* KPI Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="bg-sand rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <span className="label uppercase text-ink-2">Gross Revenue</span>
              <DollarSign size={18} className="text-ink-2" />
            </div>
            <p className="num text-[36px] sm:text-[44px] leading-none mt-3">
              {(m?.grossRevenue ?? 0).toLocaleString('en-US')} <span className="text-[16px] font-sans text-ink-2 font-normal">EGP</span>
            </p>
            <p className="text-[13px] text-ink-2 font-medium mt-3">All-time inflow across platform</p>
          </div>

          <div className={`${SVC.eat.tint} rounded-2xl p-5 sm:p-6`}>
            <div className="flex items-center justify-between">
              <span className="label uppercase text-ink-2">MRR (Subscriptions)</span>
              <TrendingUp size={18} className="text-eat" />
            </div>
            <p className="num text-[36px] sm:text-[44px] leading-none mt-3 text-eat">
              {(m?.mrr ?? 0).toLocaleString('en-US')} <span className="text-[16px] font-sans text-ink-2 font-normal">EGP</span>
            </p>
            <p className="text-[13px] text-ink-2 font-medium mt-3">{m?.activeSubscribers ?? 0} active paying subscribers</p>
          </div>

          <div className={`${SVC.recover.tint} rounded-2xl p-5 sm:p-6`}>
            <div className="flex items-center justify-between">
              <span className="label uppercase text-ink-2">Specialist Payouts</span>
              <Coins size={18} className="text-recover" />
            </div>
            <p className="num text-[36px] sm:text-[44px] leading-none mt-3 text-recover">
              {(m?.specialistDisbursed ?? 0).toLocaleString('en-US')} <span className="text-[16px] font-sans text-ink-2 font-normal">EGP</span>
            </p>
            <p className="text-[13px] text-ink-2 font-medium mt-3">
              {(m?.specialistPending ?? 0) > 0 ? `${(m?.specialistPending ?? 0).toLocaleString('en-US')} EGP pending approval` : 'All payouts settled'}
            </p>
          </div>

          <div className={`${SVC.move.tint} rounded-2xl p-5 sm:p-6`}>
            <div className="flex items-center justify-between">
              <span className="label uppercase text-ink-2">Net Platform Profit</span>
              <Wallet size={18} className="text-move" />
            </div>
            <p className="num text-[36px] sm:text-[44px] leading-none mt-3 text-move">
              {(m?.netPlatformProfit ?? 0).toLocaleString('en-US')} <span className="text-[16px] font-sans text-ink-2 font-normal">EGP</span>
            </p>
            <p className="text-[13px] text-ink-2 font-medium mt-3">Retained earnings after payouts</p>
          </div>
        </div>

        {/* Revenue Trend Chart */}
        {revenuePoints.length > 0 && (
          <Card className="p-6 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <p className="font-bold text-[18px]">Weekly Revenue Inflow</p>
                <p className="text-[14px] text-ink-2">Total platform earnings over the last 8 weeks</p>
              </div>
              <span className="label bg-paper border border-line px-3 py-1.5 rounded-full font-bold">
                ARPU: {(m?.arpu ?? 0).toLocaleString('en-US')} EGP
              </span>
            </div>
            <LineChart
              labels={labels}
              data={revenuePoints}
              min={minR}
              max={maxR}
              ticks={ticksR}
              unit="EGP"
              desc="Weekly revenue trajectory"
              color="#14161A"
            />
          </Card>
        )}

        {/* Breakdown row: Revenue Streams & Payment Methods */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className="p-6">
            <p className="font-bold text-[18px] mb-1">Income Streams</p>
            <p className="text-[14px] text-ink-2 mb-5">Subscription plans vs individual consultations</p>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-[14px] font-semibold mb-1">
                  <span>Recurring Subscriptions</span>
                  <span>{(streams?.subscriptions?.amount ?? 0).toLocaleString('en-US')} EGP ({streams?.subscriptions?.percentage ?? 0}%)</span>
                </div>
                <div className="w-full h-3 bg-paper rounded-full overflow-hidden border border-line">
                  <div className="h-full bg-eat rounded-full" style={{ width: `${streams?.subscriptions?.percentage ?? 0}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[14px] font-semibold mb-1">
                  <span>1-on-1 Consultations</span>
                  <span>{(streams?.sessions?.amount ?? 0).toLocaleString('en-US')} EGP ({streams?.sessions?.percentage ?? 0}%)</span>
                </div>
                <div className="w-full h-3 bg-paper rounded-full overflow-hidden border border-line">
                  <div className="h-full bg-move rounded-full" style={{ width: `${streams.sessions.percentage}%` }} />
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-line flex justify-between items-center text-[13px] text-ink-2">
              <span>{m.completedSessions} sessions completed</span>
              <Link to="/app/finance/subscriptions" className="font-bold text-ink hover:underline inline-flex items-center gap-1">
                Subscriptions report <ArrowRight size={14} />
              </Link>
            </div>
          </Card>

          <Card className="p-6">
            <p className="font-bold text-[18px] mb-1">Payment Methods</p>
            <p className="text-[14px] text-ink-2 mb-5">Distribution of collected payments in Egypt</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-paper rounded-xl border border-line">
                <p className="label uppercase text-ink-2 text-[11px]">InstaPay</p>
                <p className="num text-[22px] mt-1">{methods.instapay?.total?.toLocaleString('en-US') || 0} <span className="text-[12px] font-normal font-sans">EGP</span></p>
                <p className="text-[12px] text-ink-2 mt-1">{methods.instapay?.count || 0} transactions</p>
              </div>

              <div className="p-3 bg-paper rounded-xl border border-line">
                <p className="label uppercase text-ink-2 text-[11px]">Vodafone Cash</p>
                <p className="num text-[22px] mt-1">{methods.vodafone_cash?.total?.toLocaleString('en-US') || 0} <span className="text-[12px] font-normal font-sans">EGP</span></p>
                <p className="text-[12px] text-ink-2 mt-1">{methods.vodafone_cash?.count || 0} transactions</p>
              </div>

              <div className="p-3 bg-paper rounded-xl border border-line">
                <p className="label uppercase text-ink-2 text-[11px]">Credit / Debit Card</p>
                <p className="num text-[22px] mt-1">{methods.card?.total?.toLocaleString('en-US') || 0} <span className="text-[12px] font-normal font-sans">EGP</span></p>
                <p className="text-[12px] text-ink-2 mt-1">{methods.card?.count || 0} transactions</p>
              </div>

              <div className="p-3 bg-paper rounded-xl border border-line">
                <p className="label uppercase text-ink-2 text-[11px]">Fawry Pay</p>
                <p className="num text-[22px] mt-1">{methods.fawry?.total?.toLocaleString('en-US') || 0} <span className="text-[12px] font-normal font-sans">EGP</span></p>
                <p className="text-[12px] text-ink-2 mt-1">{methods.fawry?.count || 0} transactions</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Recent Transactions Feed */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-bold text-[18px]">Recent Ledger Entries</p>
              <p className="text-[14px] text-ink-2">Latest collections and consultations</p>
            </div>
            <Link to="/app/finance/transactions" className="font-bold text-[14px] text-ink hover:underline inline-flex items-center gap-1.5">
              Full Ledger <ArrowRight size={16} />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14px]">
              <thead className="text-[12px] uppercase text-ink-2 border-b border-line">
                <tr>
                  <th className="pb-3 font-semibold">Reference</th>
                  <th className="pb-3 font-semibold">Customer</th>
                  <th className="pb-3 font-semibold">Description</th>
                  <th className="pb-3 font-semibold">Method</th>
                  <th className="pb-3 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {recentTxs.map((tx: any) => (
                  <tr key={tx.id + tx.type} className="hover:bg-paper/50 transition">
                    <td className="py-3 font-mono text-[12px] font-bold text-ink">{tx.reference}</td>
                    <td className="py-3">
                      <p className="font-semibold">{tx.customer_name}</p>
                      <p className="text-[12px] text-ink-2">{tx.customer_email}</p>
                    </td>
                    <td className="py-3 font-medium text-ink-2">{tx.description}</td>
                    <td className="py-3">
                      <span className="capitalize px-2 py-0.5 rounded text-[12px] font-bold bg-sand">
                        {tx.method.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 text-right font-bold text-ink">
                      +{(tx.amount_egp ?? 0).toLocaleString('en-US')} EGP
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </Gate>
    </div>
  )
}

