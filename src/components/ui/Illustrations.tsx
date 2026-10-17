export function Kettlebell({ className = '', fill = '#14161A', accent = '#fff' }: { className?: string; fill?: string; accent?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      <path d="M32 58a28 28 0 0 1 56 0H76a16 16 0 0 0-32 0z" fill={fill} />
      <circle cx="60" cy="78" r="34" fill={fill} />
      <circle cx="48" cy="70" r="7" fill={accent} opacity=".9" />
    </svg>
  )
}

export function Bowl({ className = '', fill = '#14161A', accent = '#fff' }: { className?: string; fill?: string; accent?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      <circle cx="44" cy="50" r="16" fill={accent} />
      <circle cx="68" cy="42" r="14" fill={accent} opacity=".7" />
      <circle cx="84" cy="54" r="12" fill={accent} opacity=".9" />
      <path d="M10 62h100a50 50 0 0 1-100 0z" fill={fill} />
      <rect x="38" y="104" width="44" height="8" rx="4" fill={fill} />
    </svg>
  )
}

export function Roller({ className = '', fill = '#14161A', accent = '#fff' }: { className?: string; fill?: string; accent?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      <rect x="8" y="34" width="104" height="52" rx="26" fill={fill} />
      <circle cx="86" cy="60" r="16" fill={accent} opacity=".9" />
      <rect x="30" y="46" width="30" height="8" rx="4" fill={accent} opacity=".5" />
    </svg>
  )
}
