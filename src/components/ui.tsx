import type { LucideIcon } from 'lucide-react'
import { Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'

export function StepHeader({
  step,
  title,
  subtitle,
  icon: Icon,
  color,
  ai,
}: {
  step: number
  title: string
  subtitle: string
  icon: LucideIcon
  color: string
  ai?: boolean
}) {
  return (
    <div className="mb-6 flex items-start gap-4">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow ${color}`}>
        <Icon size={24} />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Step {step}</span>
          {ai && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
              <Sparkles size={12} /> AI-powered
            </span>
          )}
        </div>
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
    </div>
  )
}

export function Stat({ label, value, hint, accent }: { label: string; value: ReactNode; hint?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-bold ${accent ?? 'text-slate-900'}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
    </div>
  )
}

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'green' | 'amber' | 'red' | 'blue' | 'violet' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-rose-100 text-rose-700',
    blue: 'bg-blue-100 text-blue-700',
    violet: 'bg-violet-100 text-violet-700',
  }
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>
}

export function Stars({ value }: { value: number }) {
  const n = Math.round((value / 100) * 5)
  return (
    <span className="text-amber-500" aria-label={`${n} of 5 stars`}>
      {'★'.repeat(n)}
      <span className="text-slate-300">{'★'.repeat(5 - n)}</span>
    </span>
  )
}
