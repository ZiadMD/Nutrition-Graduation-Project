export function Segment({
  options,
  value,
  onChange,
  label,
}: {
  options: string[]
  value: string
  onChange: (v: string) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(o)}
          className={`min-h-11 min-w-11 px-4 rounded-xl border font-semibold cursor-pointer ${
            value === o ? 'bg-ink text-white border-ink' : 'bg-white border-ink/25 hover:border-ink'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  )
}
