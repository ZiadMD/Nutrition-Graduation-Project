import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function Dialog({
  open,
  onClose,
  title,
  children,
  side = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  side?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className={`fixed inset-0 z-50 bg-ink/40 flex ${side ? 'justify-end' : 'items-center justify-center p-5'}`} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`bg-white shadow-[0_16px_48px_rgba(20,22,26,0.25)] overflow-y-auto ${
          side ? 'w-full max-w-[440px] h-full p-6' : 'rounded-2xl p-6 max-w-md w-full max-h-full'
        }`}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 className="h-display text-[24px]" style={{ letterSpacing: '-0.02em' }}>
            {title}
          </h2>
          <button onClick={onClose} aria-label="Close" className="size-11 -mt-2 -mr-2 grid place-items-center rounded-xl hover:bg-ink/5 cursor-pointer shrink-0">
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
