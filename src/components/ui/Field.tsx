import { useId, type ReactNode } from 'react'
import { CircleAlert } from 'lucide-react'

export function Field({
  label,
  helper,
  error,
  children,
}: {
  label: string
  helper?: string
  error?: string
  children: ReactNode | ((p: { id: string; 'aria-describedby': string; 'aria-invalid': boolean }) => ReactNode)
}) {
  const id = useId()
  const d = `${id}-d`
  return (
    <div>
      <label htmlFor={id} className="block text-[14px] font-semibold mb-2">
        {label}
      </label>
      {typeof children === 'function' ? children({ id, 'aria-describedby': d, 'aria-invalid': !!error }) : children}
      {(error || helper) && (
        <p id={d} className={`mt-2 text-[14px] leading-5 ${error ? 'text-[#a02a2a] font-semibold flex gap-1.5 items-start' : 'text-ink-2'}`}>
          {error ? (
            <>
              <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
              {error}
            </>
          ) : (
            helper
          )}
        </p>
      )}
    </div>
  )
}
