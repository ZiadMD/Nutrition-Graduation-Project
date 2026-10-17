export type DemoState = 'loaded' | 'loading' | 'empty' | 'error'

export function StateSwitcher({ value, onChange }: { value: DemoState; onChange: (v: DemoState) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-[14px] text-ink-2">
      Preview state
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as DemoState)}
        className="h-11 rounded-xl border border-ink/25 bg-white px-3 text-ink font-semibold"
      >
        <option value="loaded">Loaded</option>
        <option value="loading">Loading</option>
        <option value="empty">Empty</option>
        <option value="error">Error</option>
      </select>
    </label>
  )
}
