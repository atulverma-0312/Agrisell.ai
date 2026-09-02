import { Brush, CheckCircle2, Database, Globe, Puzzle, RefreshCw, ShieldCheck, Store, TrendingUp, Truck, Users, Warehouse, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { HISTORY_DAYS } from '../lib/data'
import type { ProcessingReport, RawMarket } from '../lib/types'
import { Badge, Stat, StepHeader } from './ui'

const SOURCES = [
  { name: 'e-NAM / AGMARKNET', icon: Globe, desc: 'Daily arrivals & modal prices' },
  { name: 'Mandis (APMC)', icon: Store, desc: 'Local yard price boards' },
  { name: 'Buyer Demand', icon: Users, desc: 'Procurement requests from buyers/FPOs' },
  { name: 'Historical Price', icon: TrendingUp, desc: `${HISTORY_DAYS}-day (6-month) price series per crop` },
  { name: 'Logistics', icon: Truck, desc: 'Distance matrix & freight rates' },
  { name: 'Storage', icon: Warehouse, desc: 'Warehouse capacity & tariffs' },
]

export function IntegrationStep({
  raw,
  feedVersion,
  lastSync,
  autoRefresh,
  onToggleAuto,
  onRefresh,
}: {
  raw: RawMarket[]
  feedVersion: number
  lastSync: number
  autoRefresh: boolean
  onToggleAuto: () => void
  onRefresh: () => void
}) {
  const [loaded, setLoaded] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setLoaded((n) => (n >= SOURCES.length ? n : n + 1)), 220)
    return () => clearInterval(t)
  }, [])
  const done = loaded >= SOURCES.length
  return (
    <section className="card p-6 fade-up">
      <StepHeader step={3} title="Data Integration" subtitle="Pulling live feeds from every market data source" icon={Database} color="bg-amber-500" />
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
        <span className={`h-2.5 w-2.5 rounded-full ${autoRefresh ? 'animate-pulse bg-emerald-500' : 'bg-slate-400'}`} />
        <span className="font-semibold text-slate-700">{autoRefresh ? 'Live sync on' : 'Live sync paused'}</span>
        <span className="text-slate-500">
          Last update {new Date(lastSync).toLocaleTimeString()} · feed v{feedVersion + 1} · models re-run automatically on every update
        </span>
        <div className="ml-auto flex gap-2">
          <button className="btn-secondary !py-1.5 text-xs" onClick={onToggleAuto}>{autoRefresh ? 'Pause auto-refresh' : 'Resume auto-refresh'}</button>
          <button className="btn-primary !py-1.5 text-xs" onClick={onRefresh}><RefreshCw size={14} /> Refresh now</button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SOURCES.map((s, i) => (
          <div key={s.name} className={`flex items-center gap-3 rounded-xl border p-4 transition ${i < loaded ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50 opacity-60'}`}>
            <s.icon className="text-amber-600" size={22} />
            <div className="flex-1">
              <div className="text-sm font-semibold">{s.name}</div>
              <div className="text-xs text-slate-500">{s.desc}</div>
            </div>
            {i < loaded ? <CheckCircle2 className="text-emerald-600" size={18} /> : <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-amber-500" />}
          </div>
        ))}
      </div>
      {done && (
        <div className="mt-6 fade-up">
          <div className="mb-2 text-sm font-semibold text-slate-700">Raw records received ({raw.length})</div>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr><th className="px-3 py-2">Market</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">District</th><th className="px-3 py-2">Reliability</th><th className="px-3 py-2">Updated</th></tr>
              </thead>
              <tbody>
                {raw.map((m, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium">{m.name}</td>
                    <td className="px-3 py-2"><Badge tone="blue">{m.type}</Badge></td>
                    <td className="px-3 py-2 text-slate-500">{m.source}</td>
                    <td className="px-3 py-2 text-slate-500">{m.district}</td>
                    <td className="px-3 py-2">{Math.round(m.reliability * 100)}%</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{m.updatedAt ? new Date(m.updatedAt).toLocaleTimeString() : 'initial load'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}

export function ProcessingStep({ report }: { report: ProcessingReport }) {
  return (
    <section className="card p-6 fade-up">
      <StepHeader step={4} title="Data Processing" subtitle="Cleaning → Validation → Normalization & Integration" icon={Puzzle} color="bg-violet-600" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Fetched" value={report.fetched} hint="raw records" />
        <Stat label="Validated" value={report.cleaned} hint="clean markets" accent="text-emerald-600" />
        <Stat label="Rejected" value={report.rejected} hint="failed validation" accent="text-rose-600" />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Pipeline icon={Brush} title="Cleaning" text="Duplicate records dropped, missing prices interpolated from neighbouring days." />
        <Pipeline icon={ShieldCheck} title="Validation" text="Markets without demand or price series are rejected; reliability scores verified." />
        <Pipeline icon={Puzzle} title="Normalization" text="Unit mismatches & outliers replaced with the series median; all prices in ₹/quintal." />
      </div>
      <div className="mt-6">
        <div className="mb-2 text-sm font-semibold text-slate-700">Processing log</div>
        <ul className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-900 p-4 font-mono text-xs text-emerald-200">
          {report.fixes.map((f, i) => (
            <li key={i} className="flex gap-2">
              {f.startsWith('Rejected') ? <XCircle size={14} className="mt-0.5 shrink-0 text-rose-400" /> : <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-400" />}
              {f}
            </li>
          ))}
          {report.fixes.length === 0 && <li>No issues detected.</li>}
        </ul>
      </div>
    </section>
  )
}

function Pipeline({ icon: Icon, title, text }: { icon: typeof Brush; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-violet-100 bg-violet-50 p-4">
      <div className="flex items-center gap-2 font-semibold text-violet-800"><Icon size={18} /> {title}</div>
      <p className="mt-1 text-sm text-slate-600">{text}</p>
    </div>
  )
}
