import { Users } from 'lucide-react'
import { SVC } from '../constants'
import { Card } from '../ui/Card'
import { Avatar } from '../ui/Avatar'
import { Tag } from '../ui/Tag'
import { Btn } from '../ui/Btn'
import { StarRating } from '../ui/StarRating'
import { useLanguage } from '../../context/LanguageContext'
import type { specialists } from '../../data'

export function SpecialistCard({
  s,
  cta,
}: {
  s: (typeof specialists)[number] & {
    rating?: number
    reviewsCount?: number
    clientsCount?: number
  }
  cta?: string
}) {
  const { t } = useLanguage()
  const sv = SVC[s.svc] || SVC.move
  const rating = s.rating ?? 4.9
  const reviewsCount = s.reviewsCount ?? 12
  const clientsCount = s.clientsCount ?? Math.max(Math.floor((s.sessions || 100) / 12), 24)

  const profileUrl = s.id ? `/app/specialists/${s.id}` : '/app/specialists'

  return (
    <Card className="p-6 flex flex-col h-full hover:border-ink/50 transition">
      <div className="flex items-start gap-4">
        <Avatar initials={s.initials} svc={s.svc} size={64} />
        <div className="min-w-0 flex-1">
          <Tag svc={s.svc}>{s.role}</Tag>
          <p className="h-display text-[20px] mt-2 leading-6" style={{ letterSpacing: '-0.02em' }}>
            {s.name}
          </p>

          {/* 5-Star Rating & Review Count */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <StarRating rating={rating} size={15} showValue />
            <span className="text-[13px] text-ink-2 font-medium">
              ({reviewsCount} {t('specialists.reviews')})
            </span>
          </div>
        </div>
      </div>

      <p className="text-ink-2 mt-4 text-[15px] line-clamp-2">{s.cred}</p>

      {/* Clients Worked With & Experience Stats */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-[14px] bg-paper p-3 rounded-xl border border-line">
        <div>
          <dt className="text-ink-2 text-[12px]">{t('specialists.worked_with')}</dt>
          <dd className="font-bold flex items-center gap-1.5 mt-0.5 text-ink">
            <Users size={15} className="text-ink-2" aria-hidden />
            <span className="num">{clientsCount}</span> {t('specialists.clients')}
          </dd>
        </div>
        <div>
          <dt className="text-ink-2 text-[12px]">{t('specialists.experience')}</dt>
          <dd className="font-bold mt-0.5 text-ink">
            <span className="num">{s.years}</span> {t('specialists.years')}
          </dd>
        </div>
      </dl>

      <div className={`mt-5 rounded-xl px-4 py-3 flex items-baseline justify-between ${sv.tint}`}>
        <span className="num text-[24px]">{s.rate} EGP</span>
        <span className="text-[14px] text-ink-2">{t('specialists.per_session')}</span>
      </div>

      <Btn variant="secondary" className="mt-5 w-full" to={profileUrl}>
        {cta || t('specialists.view_profile')}
      </Btn>
    </Card>
  )
}
