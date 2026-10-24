import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import {
  ArrowLeft,
  Search,
  Globe,
  Check,
  Users,
  CalendarCheck,
  Star,
  ShieldCheck,
  Lock,
  MessageSquare,
  AlertCircle,
  ThumbsUp,
} from 'lucide-react'
import {
  Avatar,
  Btn,
  Card,
  EmptyState,
  Gate,
  inputCls,
  Skeleton,
  SVC,
  Tabs,
  Tag,
  type DemoState,
} from '../../ui'
import {
  specialists as staticSpecialists,
  nextSlots,
  slotLabel,
  slotsFor,
  days,
  t12,
  packagesFor,
  type Svc,
} from '../../data'
import { api } from '../../api'
import { StarRating } from '../../components/ui/StarRating'
import { useLanguage } from '../../context/LanguageContext'

type Filter = 'all' | Svc
const dot = { move: 'bg-move', eat: 'bg-eat', recover: 'bg-recover' }

function formatNextSlot(startsAtStr?: string) {
  if (!startsAtStr) return 'No open slots'
  const d = new Date(startsAtStr)
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const dow = dayNames[d.getDay()]
  const date = d.getDate()
  const mon = months[d.getMonth()]
  const h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const ap = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${dow} ${date} ${mon}, ${h12}:${m} ${ap}`
}

function formatDate(isoStr?: string) {
  if (!isoStr) return ''
  try {
    const d = new Date(isoStr)
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return isoStr
  }
}

function getInitials(name = '') {
  return name
    .replace(/^(Dr\.|Coach)\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

function parseFocusTags(raw: any): string[] {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    return raw.split(',').map((x) => x.trim()).filter(Boolean)
  }
  return ['Rehab', 'Strength']
}

export function SpecialistsList() {
  const { t, isRtl } = useLanguage()
  const [f, setF] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('soonest')
  const [state, setState] = useState<DemoState>('loading')
  const [list, setList] = useState<any[]>([])

  const load = () => {
    setState('loading')
    api
      .getSpecialists({ type: f, q, sort })
      .then((res) => {
        const mapped = (res.specialists || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          initials: getInitials(s.name),
          svc:
            s.service ||
            (s.type === 'physical_therapist'
              ? 'recover'
              : s.type === 'nutritionist'
              ? 'eat'
              : 'move'),
          role:
            s.type === 'physical_therapist'
              ? 'Physical therapist'
              : s.type === 'nutritionist'
              ? 'Dietitian'
              : 'Personal trainer',
          cred: s.credentials,
          langs: Array.isArray(s.languages) ? s.languages.join(', ') : s.languages,
          years: s.yearsExperience || s.years_experience || 0,
          rate: s.rateEgp || s.rate_egp || 400,
          rating: s.rating ?? 4.9,
          reviewsCount: s.reviewsCount ?? 0,
          clientsCount: s.clientsCount ?? 24,
          nextSlot: formatNextSlot(s.nextAvailable),
        }))
        setList(mapped)
        setState('loaded')
      })
      .catch((err) => {
        console.error('Failed to load specialists:', err)
        setState('error')
      })
  }

  useEffect(() => {
    load()
  }, [f, q, sort])

  const pills: { id: Filter; label: string }[] = [
    { id: 'all', label: t('specialists.filter_all') },
    { id: 'move', label: t('specialists.filter_trainers') },
    { id: 'eat', label: t('specialists.filter_dietitians') },
    { id: 'recover', label: t('specialists.filter_pts') },
  ]

  const clear = () => {
    setF('all')
    setQ('')
  }

  const empty = (
    <Card>
      <EmptyState
        title={t('specialists.no_match')}
        text={t('specialists.no_match_sub')}
        action={
          <Btn variant="secondary" onClick={clear}>
            {t('specialists.clear_filters')}
          </Btn>
        }
      />
    </Card>
  )

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Filter by type">
        {pills.map((p) => (
          <button
            key={p.id}
            aria-pressed={f === p.id}
            onClick={() => setF(p.id)}
            className={`min-h-11 px-4 rounded-full border font-semibold inline-flex items-center gap-2 cursor-pointer transition ${
              f === p.id
                ? 'bg-ink text-white border-ink'
                : 'bg-white border-ink/25 hover:border-ink'
            }`}
          >
            {p.id !== 'all' && (
              <span
                className={`size-3 rounded-full ${dot[p.id]} ${
                  f === p.id ? 'ring-2 ring-white' : ''
                }`}
                aria-hidden
              />
            )}
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            size={18}
            className={`absolute top-1/2 -translate-y-1/2 text-ink-2 ${
              isRtl ? 'right-4' : 'left-4'
            }`}
            aria-hidden
          />
          <input
            aria-label={t('specialists.search_placeholder')}
            placeholder={t('specialists.search_placeholder')}
            className={`${inputCls} ${isRtl ? 'pr-11 pl-4' : 'pl-11 pr-4'}`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-[14px] text-ink-2 whitespace-nowrap">
          {t('specialists.sort_by')}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className={`${inputCls} w-auto text-ink font-semibold`}
          >
            <option value="soonest">{t('specialists.sort_soonest')}</option>
            <option value="rating">{t('specialists.sort_rating')}</option>
            <option value="low">{t('specialists.sort_low')}</option>
            <option value="high">{t('specialists.sort_high')}</option>
            <option value="exp">{t('specialists.sort_exp')}</option>
          </select>
        </label>
      </div>

      <Gate
        state={state}
        retry={load}
        skeleton={
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-36" />
            ))}
          </div>
        }
        empty={empty}
      >
        {list.length === 0 ? (
          empty
        ) : (
          <>
            <p className="text-[14px] text-ink-2 mb-3" aria-live="polite">
              <span className="num font-bold text-ink">{list.length}</span>{' '}
              {t('specialists.count_label')}
            </p>
            <Card>
              <ul className="divide-y divide-line">
                {list.map((s) => (
                  <li
                    key={s.id}
                    className="p-5 sm:p-6 grid md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto] gap-x-8 gap-y-4 items-center"
                  >
                    <div className="flex gap-4 items-start min-w-0">
                      <Avatar initials={s.initials} svc={s.svc} size={64} />
                      <div className="min-w-0">
                        <Tag svc={s.svc}>{s.role}</Tag>
                        <p
                          className="h-display text-[20px] mt-2 leading-6"
                          style={{ letterSpacing: '-0.02em' }}
                        >
                          {s.name}
                        </p>

                        {/* 5-Star Rating & Reviews Count */}
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          <StarRating rating={s.rating} size={15} showValue />
                          <span className="text-[13px] text-ink-2 font-medium">
                            ({s.reviewsCount} {t('specialists.reviews')})
                          </span>
                        </div>

                        <p className="text-ink-2 text-[15px] mt-1.5 line-clamp-2">{s.cred}</p>

                        {/* Languages, Experience & Clients Worked With */}
                        <div className="text-[13px] mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-2">
                          <span className="flex items-center gap-1.5">
                            <Globe size={15} aria-hidden /> {s.langs} · {s.years}{' '}
                            {t('specialists.years')}
                          </span>
                          <span className="flex items-center gap-1.5 font-semibold text-ink">
                            <Users size={15} className="text-ink-2" aria-hidden />
                            <span className="num">{s.clientsCount}</span>{' '}
                            {t('specialists.clients_worked_with')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div
                      className={`rounded-xl p-3 ${
                        (SVC[(s.svc as Svc) || 'move'] || SVC.move).tint
                      }`}
                    >
                      <p className="text-[13px] font-semibold">{t('specialists.next_available')}</p>
                      <p className="font-bold">{s.nextSlot}</p>
                    </div>

                    <div className="flex md:flex-col items-center md:items-end justify-between gap-3">
                      <p className="whitespace-nowrap">
                        <span className="num text-[24px]">{s.rate} EGP</span>{' '}
                        <span className="text-[14px] text-ink-2">
                          {t('specialists.per_session')}
                        </span>
                      </p>
                      <Btn
                        variant="secondary"
                        className="whitespace-nowrap"
                        to={`/app/specialists/${s.id}`}
                      >
                        {t('specialists.view_profile')}
                      </Btn>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}
      </Gate>
    </div>
  )
}

export function SpecialistProfile() {
  const { id } = useParams()
  const nav = useNavigate()
  const { t, isRtl } = useLanguage()
  const [tab, setTab] = useState<'about' | 'avail' | 'pack' | 'reviews'>('about')
  const [slot, setSlot] = useState(0)
  const [spData, setSpData] = useState<any>(null)
  const [slotsList, setSlotsList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Reviews state
  const [reviewsData, setReviewsData] = useState<{
    summary: {
      averageRating: number
      totalReviews: number
      breakdown: Record<string, number>
      clientsCount: number
    }
    reviews: Array<{
      id: number
      rating: number
      comment: string
      createdAt: string
      client: { id: number; name: string }
    }>
    eligibility: {
      canReview: boolean
      alreadyReviewed: boolean
      userReview?: { id: number; rating: number; comment: string; createdAt: string }
      reason?: string | null
    }
  }>({
    summary: {
      averageRating: 4.9,
      totalReviews: 0,
      breakdown: { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 },
      clientsCount: 24,
    },
    reviews: [],
    eligibility: { canReview: false, alreadyReviewed: false, reason: null },
  })

  // Review Form state
  const [myRating, setMyRating] = useState<number>(5)
  const [myComment, setMyComment] = useState<string>('')
  const [submittingReview, setSubmittingReview] = useState<boolean>(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null)

  const loadData = () => {
    if (!id) return
    setLoading(true)
    Promise.all([
      api.getSpecialist(id),
      api.getSpecialistSlots(id),
      api.getSpecialistReviews(id).catch((err) => {
        console.warn('Reviews endpoint fallback:', err)
        return null
      }),
    ])
      .then(([spRes, slotsRes, reviewsRes]) => {
        setSpData(spRes.specialist)
        setSlotsList(slotsRes.slots || [])
        if (reviewsRes) {
          setReviewsData(reviewsRes)
          if (reviewsRes.eligibility?.userReview) {
            setMyRating(reviewsRes.eligibility.userReview.rating)
            setMyComment(reviewsRes.eligibility.userReview.comment || '')
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load profile:', err)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [id])

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    setSubmittingReview(true)
    setReviewError(null)
    setReviewSuccess(null)

    try {
      await api.submitSpecialistReview(id, {
        rating: myRating,
        comment: myComment,
      })
      setReviewSuccess(t('reviews.success'))
      // Refresh reviews list and summary
      const updatedReviews = await api.getSpecialistReviews(id)
      setReviewsData(updatedReviews)
    } catch (err: any) {
      console.error('Failed to submit review:', err)
      setReviewError(err?.message || 'Failed to submit review. Please try again.')
    } finally {
      setSubmittingReview(false)
    }
  }

  const s = spData
    ? {
        id: spData.id,
        name: spData.name,
        initials: getInitials(spData.name),
        svc: (spData.service ||
          (spData.type === 'physical_therapist'
            ? 'recover'
            : spData.type === 'nutritionist'
            ? 'eat'
            : 'move')) as Svc,
        role:
          spData.type === 'physical_therapist'
            ? 'Physical therapist'
            : spData.type === 'nutritionist'
            ? 'Dietitian'
            : 'Personal trainer',
        cred: spData.credentials,
        langs: Array.isArray(spData.languages) ? spData.languages.join(', ') : spData.languages,
        sessions: spData.sessionsCompleted || spData.sessions_completed || 120,
        rate: spData.rateEgp || spData.rate_egp || 450,
        rating: spData.rating ?? reviewsData.summary.averageRating,
        reviewsCount: spData.reviewsCount ?? reviewsData.summary.totalReviews,
        clientsCount: spData.clientsCount ?? reviewsData.summary.clientsCount,
        about: spData.bio || 'Experienced specialist working in Cairo and Alexandria.',
        focus: parseFocusTags(spData.focusTags ?? spData.focus_tags ?? spData.focus),
        how: 'I review your weekly progress reports and coordinate plan adjustments with your care team.',
        packages:
          spData.packages && spData.packages.length > 0
            ? spData.packages
            : packagesFor(spData.rateEgp || 450),
      }
    : staticSpecialists.find((x) => x.id === id)

  if (!s && !loading)
    return (
      <Card>
        <EmptyState
          title="We couldn't find that specialist"
          text="The profile may have moved."
          action={<Btn to="/app/specialists">{t('specialists.all_specialists')}</Btn>}
        />
      </Card>
    )

  if (!s) {
    return (
      <Card className="p-8">
        <Skeleton className="h-64" />
      </Card>
    )
  }

  const formattedSlots =
    slotsList.length > 0
      ? slotsList.slice(0, 4).map((sl: any) => ({
          id: sl.id,
          label: formatNextSlot(sl.startsAt || sl.starts_at),
        }))
      : nextSlots(s.id, 4).map((x) => ({ id: 0, label: slotLabel(x) }))

  const others = staticSpecialists
    .filter((x) => x.id !== String(s.id) && ['karim', 'hana', 'mona'].includes(String(x.id)))
    .filter((x) => x.svc !== s.svc)
  const book = () => nav(`/app/specialists/${s.id}/book?slot=${slot}`)

  const panel = (
    <Card className="p-6">
      <p className="h-display text-[20px]" style={{ letterSpacing: '-0.02em' }}>
        {t('specialists.next_free_slots')}
      </p>
      <p className="text-[14px] text-ink-2">{t('specialists.cairo_time')}</p>
      <div role="radiogroup" aria-label="Next free slots" className="grid gap-2 mt-4">
        {formattedSlots.map((x, i) => (
          <button
            key={i}
            role="radio"
            aria-checked={slot === i}
            onClick={() => setSlot(i)}
            className={`min-h-12 px-4 rounded-xl border text-left font-semibold flex items-center justify-between cursor-pointer ${
              slot === i ? 'border-ink border-2 bg-white' : 'border-ink/25 hover:border-ink'
            }`}
          >
            {x.label}
            {slot === i && <Check size={18} aria-hidden />}
          </button>
        ))}
      </div>
      <div className="flex items-baseline justify-between mt-5">
        <span className="num text-[28px]">{s.rate} EGP</span>
        <span className="text-[14px] text-ink-2">{t('specialists.per_session')}</span>
      </div>
      <Btn onClick={book} className="w-full mt-4">
        {t('specialists.book_session')}
      </Btn>
    </Card>
  )

  const summary = reviewsData.summary
  const totalReviewsCount = summary.totalReviews || 0

  return (
    <div className="pb-28 lg:pb-0">
      <Link
        to="/app/specialists"
        className="inline-flex items-center gap-2 min-h-11 font-semibold mb-2"
      >
        <ArrowLeft size={18} className={isRtl ? 'rotate-180' : ''} aria-hidden />
        {t('specialists.all_specialists')}
      </Link>
      <div className="grid lg:grid-cols-[1fr_340px] gap-8 items-start">
        <div>
          {/* Header Banner */}
          <div
            className={`rounded-[28px] p-6 sm:p-8 ${
              (SVC[(s.svc as Svc) || 'move'] || SVC.move).tint
            } flex flex-col sm:flex-row gap-6 sm:items-center`}
          >
            <Avatar initials={s.initials} svc={s.svc} size={96} />
            <div className="flex-1">
              <Tag svc={s.svc}>{s.role}</Tag>
              <h2
                className="h-display text-[28px] lg:text-[32px] mt-2"
                style={{ letterSpacing: '-0.025em' }}
              >
                {s.name}
              </h2>
              <p className="mt-1 text-ink">{s.cred}</p>

              {/* 5-Star Rating & Clients Count Badges in Banner */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-3 pt-3 border-t border-ink/10">
                <div
                  className="flex items-center gap-2 cursor-pointer bg-white/70 hover:bg-white px-3 py-1.5 rounded-full transition"
                  onClick={() => setTab('reviews')}
                >
                  <StarRating rating={summary.averageRating} size={16} showValue />
                  <span className="text-[13px] font-semibold text-ink-2">
                    ({totalReviewsCount} {t('specialists.reviews')})
                  </span>
                </div>

                <div className="flex items-center gap-2 bg-white/70 px-3 py-1.5 rounded-full">
                  <Users size={16} className="text-ink-2" aria-hidden />
                  <span className="text-[13px] font-semibold text-ink">
                    <span className="num font-bold">{summary.clientsCount}</span>{' '}
                    {t('specialists.clients_worked_with')}
                  </span>
                </div>

                <span className="flex items-center gap-2 text-[14px] text-ink-2">
                  <Globe size={16} aria-hidden /> {s.langs}
                </span>

                <span className="flex items-center gap-2 text-[14px] text-ink-2">
                  <CalendarCheck size={16} aria-hidden />
                  <span className="num">{s.sessions.toLocaleString('en-US')}</span>{' '}
                  {t('specialists.sessions_completed')}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <Tabs
              label="Profile sections"
              value={tab}
              onChange={setTab as any}
              tabs={[
                { id: 'about', label: t('profile.tab_about') },
                { id: 'reviews', label: `${t('profile.tab_reviews')} (${totalReviewsCount})` },
                { id: 'avail', label: t('profile.tab_avail') },
                { id: 'pack', label: t('profile.tab_pack') },
              ]}
            />
          </div>

          <div className="mt-6" role="tabpanel">
            {tab === 'about' && (
              <div className="space-y-6">
                <Card className="p-6">
                  <p className="leading-7 max-w-2xl">{s.about}</p>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {parseFocusTags(s.focus).map((f: string) => (
                      <span
                        key={f}
                        className="rounded-full bg-paper border border-line px-3 h-8 inline-flex items-center text-[14px] font-semibold"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </Card>
                <Card className="p-6">
                  <h3
                    className="h-display text-[22px] flex items-center gap-2"
                    style={{ letterSpacing: '-0.02em' }}
                  >
                    <Users size={22} aria-hidden /> {t('profile.how_i_work')}
                  </h3>
                  <p className="leading-7 mt-3 max-w-2xl">{s.how}</p>
                  <div className="flex flex-wrap gap-3 mt-4">
                    {others.map((o) => (
                      <span
                        key={o.id}
                        className="inline-flex items-center gap-2 rounded-xl bg-paper border border-line p-2 pr-4 text-[14px] font-semibold"
                      >
                        <Avatar initials={o.initials} svc={o.svc} size={32} /> {o.name}
                      </span>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {/* REVIEWS & RATINGS TAB */}
            {tab === 'reviews' && (
              <div className="space-y-6">
                {/* 1. Reviews Summary Card */}
                <Card className="p-6 sm:p-8">
                  <div className="grid md:grid-cols-[220px_1fr] gap-8 items-center border-b border-line pb-8">
                    {/* Overall Score Box */}
                    <div className="text-center md:border-r md:border-line md:pr-8">
                      <p className="text-[13px] font-bold text-ink-2 uppercase tracking-wider">
                        {t('reviews.overall_rating')}
                      </p>
                      <p className="num text-[56px] leading-tight font-extrabold text-ink mt-2">
                        {summary.averageRating.toFixed(1)}
                      </p>
                      <div className="flex justify-center mt-2">
                        <StarRating rating={summary.averageRating} size={22} />
                      </div>
                      <p className="text-[13px] text-ink-2 mt-2">
                        {t('reviews.based_on')}{' '}
                        <strong className="text-ink">{totalReviewsCount}</strong>{' '}
                        {t('reviews.verified_reviews')}
                      </p>
                      <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sand text-ink text-[12px] font-bold">
                        <Users size={14} />
                        <span>
                          {t('specialists.worked_with')}{' '}
                          <strong className="num">{summary.clientsCount}</strong>{' '}
                          {t('specialists.clients')}
                        </span>
                      </div>
                    </div>

                    {/* Star Breakdown Progress Bars */}
                    <div>
                      <p className="font-bold text-[16px] mb-3">
                        {t('reviews.breakdown_title')}
                      </p>
                      <div className="space-y-2.5">
                        {[5, 4, 3, 2, 1].map((star) => {
                          const count = summary.breakdown?.[String(star)] ?? 0
                          const percentage =
                            totalReviewsCount > 0 ? (count / totalReviewsCount) * 100 : 0
                          return (
                            <div key={star} className="flex items-center gap-3 text-[14px]">
                              <span className="w-16 flex items-center gap-1 font-semibold text-ink-2 shrink-0">
                                <span className="num">{star}</span>
                                <Star
                                  size={13}
                                  className="text-amber-400 fill-amber-400 shrink-0"
                                />
                              </span>
                              <div className="flex-1 h-3 rounded-full bg-line overflow-hidden">
                                <div
                                  className="h-full bg-amber-400 rounded-full transition-all duration-500"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <span className="w-12 text-right num font-semibold text-ink-2 shrink-0">
                                {count}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* 2. Leave a Review Form (Only for verified clients who booked/subscribed) */}
                  <div className="mt-8">
                    {reviewsData.eligibility?.canReview ? (
                      <div className="rounded-2xl bg-paper border border-line p-5 sm:p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <ShieldCheck size={20} className="text-ok" />
                              <span className="text-[13px] font-bold text-ok uppercase tracking-wide">
                                {t('reviews.verified_badge')}
                              </span>
                            </div>
                            <h4 className="h-display text-[20px] mt-1">
                              {reviewsData.eligibility?.alreadyReviewed
                                ? t('reviews.edit_review')
                                : t('reviews.write_review')}
                            </h4>
                            <p className="text-[14px] text-ink-2 mt-1">
                              {t('reviews.verified_desc')}
                            </p>
                          </div>
                        </div>

                        {reviewSuccess && (
                          <div className="mt-4 p-4 rounded-xl bg-ok-tint border border-ok text-ok text-[14px] font-semibold flex items-center gap-2">
                            <Check size={18} /> {reviewSuccess}
                          </div>
                        )}

                        {reviewError && (
                          <div className="mt-4 p-4 rounded-xl bg-bad-tint border border-bad text-bad text-[14px] font-semibold flex items-center gap-2">
                            <AlertCircle size={18} /> {reviewError}
                          </div>
                        )}

                        <form onSubmit={handleReviewSubmit} className="mt-5 space-y-4">
                          <div>
                            <label className="block text-[14px] font-bold text-ink mb-1.5">
                              {t('reviews.your_rating')}
                            </label>
                            <StarRating
                              rating={myRating}
                              size={28}
                              interactive
                              onChange={setMyRating}
                              showValue
                            />
                          </div>

                          <div>
                            <label className="block text-[14px] font-bold text-ink mb-1.5">
                              {t('reviews.your_feedback')}
                            </label>
                            <textarea
                              rows={3}
                              className={`${inputCls} h-auto py-3`}
                              placeholder={t('reviews.feedback_placeholder')}
                              value={myComment}
                              onChange={(e) => setMyComment(e.target.value)}
                              required
                            />
                          </div>

                          <Btn type="submit" disabled={submittingReview}>
                            {submittingReview
                              ? t('reviews.submitting')
                              : reviewsData.eligibility?.alreadyReviewed
                              ? t('reviews.update')
                              : t('reviews.submit')}
                          </Btn>
                        </form>
                      </div>
                    ) : (
                      /* Anti-Spam Notice for Unverified Clients / Guests */
                      <div className="rounded-2xl border border-line bg-paper p-5 sm:p-6 flex items-start gap-4">
                        <div className="size-10 rounded-xl bg-sand grid place-items-center shrink-0">
                          <Lock size={20} className="text-ink-2" />
                        </div>
                        <div>
                          <p className="font-bold text-[16px] text-ink">
                            {t('reviews.locked_title')}
                          </p>
                          <p className="text-[14px] text-ink-2 mt-1.5 leading-relaxed">
                            {t('reviews.locked_desc')}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>

                {/* 3. Client Reviews List */}
                <div className="space-y-4">
                  <h3 className="h-display text-[22px] flex items-center gap-2">
                    <MessageSquare size={20} />
                    <span>
                      {t('reviews.title')} ({totalReviewsCount})
                    </span>
                  </h3>

                  {reviewsData.reviews.length === 0 ? (
                    <Card className="p-8 text-center">
                      <p className="font-bold text-ink text-[16px]">
                        {t('reviews.no_reviews')}
                      </p>
                      <p className="text-ink-2 text-[14px] mt-1">
                        {t('reviews.be_first')}
                      </p>
                    </Card>
                  ) : (
                    <div className="grid gap-4">
                      {reviewsData.reviews.map((rev) => (
                        <Card key={rev.id} className="p-6">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <span className="grid size-11 place-items-center rounded-xl bg-sand font-display font-bold text-[14px]">
                                {getInitials(rev.client?.name || 'Client')}
                              </span>
                              <div>
                                <p className="font-bold text-[16px] text-ink">
                                  {rev.client?.name || 'Verified Client'}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-ok bg-ok-tint px-2 py-0.5 rounded-full">
                                    <ShieldCheck size={12} /> {t('reviews.verified_badge')}
                                  </span>
                                  <span className="text-[13px] text-ink-2">
                                    {formatDate(rev.createdAt)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <StarRating rating={rev.rating} size={16} />
                          </div>

                          {rev.comment && (
                            <p className="mt-4 text-[15px] leading-relaxed text-ink/90 bg-paper/60 p-3.5 rounded-xl border border-line/60">
                              "{rev.comment}"
                            </p>
                          )}
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === 'avail' && (
              <Card className="p-6">
                <p className="text-[14px] text-ink-2 mb-4">
                  {t('profile.open_slots_week')}
                </p>
                <div className="grid gap-3">
                  {days.map((d, di) => {
                    const sl = slotsFor(s.id, di)
                    return (
                      <div
                        key={d.n}
                        className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-3 border-b border-line last:border-0"
                      >
                        <p className="w-24 font-bold shrink-0">
                          {d.d} <span className="num">{d.n}</span>
                        </p>
                        {sl.length ? (
                          <div className="flex flex-wrap gap-2">
                            {sl.map((t) => (
                              <span
                                key={t}
                                className={`rounded-lg px-3 h-9 inline-flex items-center text-[14px] font-semibold ${
                                  SVC[s.svc].tint
                                }`}
                              >
                                {t12(t)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-ink-2 text-[15px]">
                            {t('profile.no_free_times')}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}

            {tab === 'pack' && (
              <div className="grid md:grid-cols-3 gap-4">
                {packagesFor(s.rate).map((p) => (
                  <Card key={p.id} className="p-6 flex flex-col">
                    <p className="font-bold">{p.name}</p>
                    <p className="mt-3">
                      <span className="num text-[32px]">
                        {p.price.toLocaleString('en-US')}
                      </span>{' '}
                      <span className="font-semibold">EGP</span>
                    </p>
                    <p className="text-[14px] text-ink-2">
                      {p.n} {p.n === 1 ? 'session' : 'sessions'} ·{' '}
                      <span className="num">{Math.round(p.price / p.n)}</span> EGP each
                    </p>
                    <p className="text-[15px] mt-3 text-ink-2">{p.note}</p>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="hidden lg:block sticky top-24">{panel}</div>
      </div>

      <div className="lg:hidden fixed bottom-16 inset-x-0 z-20 bg-white border-t border-line px-5 py-3 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-ink-2">{t('specialists.next_available')}</p>
          <p className="font-bold truncate">
            {formattedSlots[0]?.label || t('specialists.no_open_slots')}
          </p>
        </div>
        <Btn onClick={() => nav(`/app/specialists/${s.id}/book?slot=0`)}>
          {t('specialists.book_session')}
        </Btn>
      </div>
    </div>
  )
}
