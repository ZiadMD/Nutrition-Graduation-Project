import type { ReactNode } from 'react'
import { Check } from 'lucide-react'

export function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-11 px-4 rounded-full border font-semibold text-[15px] transition cursor-pointer inline-flex items-center gap-2 ${
        selected ? 'bg-ink text-white border-ink' : 'bg-white border-ink/25 hover:border-ink'
      }`}
    >
      {selected && <Check size={16} strokeWidth={3} aria-hidden />}
      {children}
    </button>
  )
}
