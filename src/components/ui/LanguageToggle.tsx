import React from 'react'
import { Globe } from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'

interface LanguageToggleProps {
  className?: string
  variant?: 'pill' | 'button' | 'compact'
}

export function LanguageToggle({ className = '', variant = 'button' }: LanguageToggleProps) {
  const { lang, toggleLang, t } = useLanguage()

  const label = lang === 'en' ? 'العربية 🇪🇬' : 'English 🇬🇧'
  const altLang = lang === 'en' ? 'ar' : 'en'

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={toggleLang}
        aria-label={`Switch language to ${lang === 'en' ? 'Arabic' : 'English'}`}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-bold border border-line bg-white hover:bg-paper transition cursor-pointer ${className}`}
      >
        <Globe size={14} className="text-ink-2" aria-hidden />
        <span>{label}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggleLang}
      aria-label={`Switch language to ${lang === 'en' ? 'Arabic' : 'English'}`}
      className={`min-h-11 px-3.5 rounded-xl border border-line bg-white hover:bg-paper font-semibold text-[14px] inline-flex items-center gap-2 cursor-pointer transition select-none ${className}`}
    >
      <Globe size={18} className="text-ink-2 shrink-0" aria-hidden />
      <span className="font-bold tracking-tight">{label}</span>
    </button>
  )
}
