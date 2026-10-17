export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="flex gap-[3px] items-end h-6" aria-hidden>
        <span className="w-[7px] h-6 rounded-full bg-move" />
        <span className="w-[7px] h-4 rounded-full bg-eat" />
        <span className="w-[7px] h-5 rounded-full bg-recover" />
      </span>
      <span className="h-display text-[22px] tracking-tight" style={{ letterSpacing: '-0.04em' }}>
        Rebound
      </span>
    </span>
  )
}
