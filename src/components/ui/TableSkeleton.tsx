import { Skeleton } from './Skeleton'

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="bg-white border border-line rounded-2xl p-4 space-y-3" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="size-11 !rounded-full shrink-0" />
          <Skeleton className="h-5 flex-1" />
          <Skeleton className="h-5 w-1/4 hidden md:block" />
          <Skeleton className="h-8 w-24" />
        </div>
      ))}
    </div>
  )
}
