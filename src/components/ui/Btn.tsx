import { Link } from 'react-router'
import type { ComponentProps, ReactNode } from 'react'

const variants = {
  primary: 'bg-ink text-white hover:bg-[#2a2e35]',
  secondary: 'bg-white text-ink border border-ink/20 hover:border-ink',
  inverse: 'bg-white text-ink hover:bg-eat-tint',
  ghost: 'text-ink hover:bg-ink/5',
}

export type BtnProps = {
  variant?: keyof typeof variants
  to?: string
  className?: string
  children: ReactNode
} & Omit<ComponentProps<'button'>, 'className' | 'children'>

export function Btn({ variant = 'primary', to, className = '', children, ...rest }: BtnProps) {
  const cls = `inline-flex items-center justify-center gap-2 min-h-12 px-6 rounded-xl font-bold text-[16px] transition active:scale-[.98] cursor-pointer disabled:opacity-50 ${variants[variant]} ${className}`
  if (to)
    return (
      <Link to={to} className={cls}>
        {children}
      </Link>
    )
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  )
}

export { Btn as Button }
