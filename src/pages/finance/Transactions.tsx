import { useEffect, useState } from 'react'
import { Search, ReceiptText, CreditCard, Filter, Download } from 'lucide-react'
import { Card, PageHead, Skeleton, Gate, inputCls, Segment, type DemoState, Btn } from '../../ui'
import { api } from '../../api'

const PREVIEW_TRANSACTIONS = [
  { id: '1', type: 'subscription', reference: 'SUB-2026-001', customer_name: 'Sara Hassan', customer_email: 'sara@demo.com', description: 'Full Team Subscription', method: 'card', created_at: '2026-10-15T10:00:00Z', amount_egp: 1499 },
  { id: '2', type: 'session', reference: 'SES-2026-042', customer_name: 'Omar Khaled', customer_email: 'omar@demo.com', description: 'Rehab Session with Dr. Mona', method: 'instapay', created_at: '2026-10-14T16:30:00Z', amount_egp: 450 },
  { id: '3', type: 'subscription', reference: 'SUB-2026-002', customer_name: 'Laila Mostafa', customer_email: 'laila@demo.com', description: 'Plus Plan Subscription', method: 'vodafone_cash', created_at: '2026-10-12T11:20:00Z', amount_egp: 899 },
  { id: '4', type: 'session', reference: 'SES-2026-043', customer_name: 'Youssef Nabil', customer_email: 'youssef@demo.com', description: 'Strength Review with Coach Karim', method: 'card', created_at: '2026-10-10T14:00:00Z', amount_egp: 350 },
  { id: '5', type: 'subscription', reference: 'SUB-2026-003', customer_name: 'Mariam Adel', customer_email: 'mariam@demo.com', description: 'Starter Plan Subscription', method: 'fawry', created_at: '2026-10-08T09:45:00Z', amount_egp: 399 },
  { id: '6', type: 'session', reference: 'SES-2026-044', customer_name: 'Tarek Samir', customer_email: 'tarek@demo.com', description: 'Dietary Consultation with Hana Ibrahim', method: 'instapay', created_at: '2026-10-05T13:15:00Z', amount_egp: 300 },
]

export default function FinanceTransactions() {
  const [state, setState] = useState<DemoState>('loading')
  const [transactions, setTransactions] = useState<any[]>(PREVIEW_TRANSACTIONS)
  const [totalCount, setTotalCount] = useState(PREVIEW_TRANSACTIONS.length)
  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [methodFilter, setMethodFilter] = useState('All')

  const loadData = () => {
    setState('loading')
    const t = typeFilter === 'All' ? undefined : typeFilter.toLowerCase() === 'subscriptions' ? 'subscription' : 'session'
    const m = methodFilter === 'All' ? undefined : methodFilter.toLowerCase().replace(/\s+/g, '_')

    api.getFinanceTransactions({ q, type: t, method: m })
      .then((res) => {
        setTransactions(res.transactions || [])
        setTotalCount(res.totalCount || 0)
        setState('loaded')
      })
      .catch((err) => {
        console.warn('Backend unavailable, using preview transactions:', err)
        let filtered = PREVIEW_TRANSACTIONS
        if (t) filtered = filtered.filter((tx) => tx.type === t)
        if (m) filtered = filtered.filter((tx) => tx.method === m)
        if (q) {
          const lower = q.toLowerCase()
          filtered = filtered.filter(
            (tx) =>
              tx.customer_name.toLowerCase().includes(lower) ||
              tx.reference.toLowerCase().includes(lower) ||
              tx.description.toLowerCase().includes(lower)
          )
        }
        setTransactions(filtered)
        setTotalCount(filtered.length)
        setState('loaded')
      })
  }

  useEffect(() => {
    loadData()
  }, [typeFilter, methodFilter])

  // Debounced search
  useEffect(() => {
    const handler = setTimeout(() => {
      loadData()
    }, 250)
    return () => clearTimeout(handler)
  }, [q])

  return (
    <div>
      <PageHead
        title="Transaction Ledger"
        sub={`${totalCount} recorded platform payments across Egypt.`}
      />

      {/* Controls & Search */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-2" aria-hidden />
          <input
            type="search"
            aria-label="Search ledger"
            placeholder="Search by customer, reference, or description..."
            className={`${inputCls} pl-11`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-3 mb-6">
        <div>
          <p className="label text-ink-2 mb-1.5 uppercase text-[11px]">Type</p>
          <Segment
            label="Type"
            options={['All', 'Subscriptions', 'Sessions']}
            value={typeFilter}
            onChange={setTypeFilter}
          />
        </div>
        <div>
          <p className="label text-ink-2 mb-1.5 uppercase text-[11px]">Payment Method</p>
          <Segment
            label="Payment Method"
            options={['All', 'Card', 'Instapay', 'Vodafone Cash', 'Fawry']}
            value={methodFilter}
            onChange={setMethodFilter}
          />
        </div>
      </div>

      <Gate
        state={state}
        retry={loadData}
        skeleton={
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        }
        empty={<Card className="p-8 text-center text-ink-2">No transactions match your criteria.</Card>}
      >
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-[14px]">
            <thead className="bg-paper border-b border-line text-[12px] uppercase text-ink-2">
              <tr>
                <th className="py-3.5 px-5 font-semibold">Reference</th>
                <th className="py-3.5 px-5 font-semibold">Customer</th>
                <th className="py-3.5 px-5 font-semibold">Description</th>
                <th className="py-3.5 px-5 font-semibold">Method</th>
                <th className="py-3.5 px-5 font-semibold">Date</th>
                <th className="py-3.5 px-5 font-semibold text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {transactions.map((tx) => (
                <tr key={tx.id + tx.type} className="hover:bg-paper/40 transition">
                  <td className="py-4 px-5 font-mono text-[12px] font-bold text-ink whitespace-nowrap">
                    {tx.reference}
                  </td>
                  <td className="py-4 px-5">
                    <p className="font-semibold text-ink">{tx.customer_name}</p>
                    <p className="text-[12px] text-ink-2">{tx.customer_email}</p>
                  </td>
                  <td className="py-4 px-5 font-medium text-ink-2">
                    <div className="flex items-center gap-2">
                      <span className={`size-2 rounded-full ${tx.type === 'subscription' ? 'bg-eat' : 'bg-move'}`} />
                      <span>{tx.description}</span>
                    </div>
                  </td>
                  <td className="py-4 px-5 whitespace-nowrap">
                    <span className="capitalize px-2.5 py-1 rounded-lg text-[12px] font-bold bg-sand">
                      {tx.method.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-4 px-5 text-ink-2 text-[13px] whitespace-nowrap">
                    {new Date(tx.created_at).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="py-4 px-5 text-right font-bold text-ink whitespace-nowrap">
                    +{(tx.amount_egp ?? 0).toLocaleString('en-US')} EGP
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

