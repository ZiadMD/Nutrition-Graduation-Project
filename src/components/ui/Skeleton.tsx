export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-[#ece8e0] rounded-xl ${className}`} aria-hidden />
}
