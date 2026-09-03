interface StatCardProps {
  label: string
  value: string | number
  tone?: 'default' | 'emerald' | 'gold' | 'red'
}

const toneClasses: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'text-ink-900',
  emerald: 'text-emerald-700',
  gold: 'text-gold-600',
  red: 'text-red-600',
}

export function StatCard({ label, value, tone = 'default' }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${toneClasses[tone]}`}>{value}</p>
    </div>
  )
}
