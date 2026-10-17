import { SVC } from '../constants'
import { Card } from '../ui/Card'
import { Avatar } from '../ui/Avatar'
import { Tag } from '../ui/Tag'
import { Btn } from '../ui/Btn'
import type { specialists } from '../../data'

export function SpecialistCard({ s, cta = 'View profile' }: { s: (typeof specialists)[number]; cta?: string }) {
  const sv = SVC[s.svc]
  return (
    <Card className="p-6 flex flex-col h-full">
      <div className="flex items-start gap-4">
        <Avatar initials={s.initials} svc={s.svc} size={64} />
        <div className="min-w-0">
          <Tag svc={s.svc}>{s.role}</Tag>
          <p className="h-display text-[20px] mt-2 leading-6" style={{ letterSpacing: '-0.02em' }}>
            {s.name}
          </p>
        </div>
      </div>
      <p className="text-ink-2 mt-4 text-[15px]">{s.cred}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-[14px]">
        <div>
          <dt className="text-ink-2">Experience</dt>
          <dd className="font-semibold">{s.years} years</dd>
        </div>
        <div>
          <dt className="text-ink-2">Languages</dt>
          <dd className="font-semibold">{s.langs}</dd>
        </div>
      </dl>
      <div className={`mt-5 rounded-xl px-4 py-3 flex items-baseline justify-between ${sv.tint}`}>
        <span className="num text-[24px]">{s.rate} EGP</span>
        <span className="text-[14px]">per session</span>
      </div>
      <Btn variant="secondary" className="mt-5 w-full" to="/app/specialists">
        {cta}
      </Btn>
    </Card>
  )
}
