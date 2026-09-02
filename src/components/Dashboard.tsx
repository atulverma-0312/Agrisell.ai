import { ArrowDownRight, ArrowUpRight, LayoutDashboard, Lightbulb, MapPin, Minus, TrendingUp, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Area, Bar, BarChart, Cell, ComposedChart, CartesianGrid, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PRODUCTION_COST, districtResults, growthOutlook, profitLoss, sixMonthSeries } from '../lib/dashboard'
import { fmt } from '../lib/engine'
import type { CleanMarket, FarmerConstraints, FarmerInput, Recommendation } from '../lib/types'
import { DistrictMap } from './DistrictMap'
import { Badge, Stat, StepHeader } from './ui'

type Metric = 'net' | 'price'
const COLORS = ['#2563eb', '#16a34a', '#f97316']

export function Dashboard({
  input,
  constraints,
  markets,
  rec,
  onUseDistrict,
}: {
  input: FarmerInput
  constraints: FarmerConstraints
  markets: CleanMarket[]
  rec: Recommendation
  onUseDistrict: (district: string) => void
}) {
  const top3 = rec.ranked.slice(0, 3)
  const series = useMemo(() => sixMonthSeries(markets, input.crop, top3.map((o) => o.market)), [markets, input.crop, top3])
  const outlook = useMemo(() => growthOutlook(markets, input.crop, series, input.grade), [markets, input.crop, series, input.grade])
  const pnl = useMemo(() => profitLoss(input, rec.ranked), [input, rec.ranked])
  const byDistrict = useMemo(() => districtResults(input, constraints, markets), [input, constraints, markets])

  const [metric, setMetric] = useState<Metric>('net')
  const [selected, setSelected] = useState<string | null>(input.location)
  const mapValues = useMemo(() => {
    const out: Record<string, number> = {}
    for (const [d, r] of Object.entries(byDistrict)) out[d] = metric === 'net' ? Math.round(r.best.netReturn / input.quantityQuintal) : r.priceLevel
    return out
  }, [byDistrict, metric, input.quantityQuintal])
  const sel = selected ? byDistrict[selected] : undefined
  const bestPnl = pnl[0]
  const TrendIcon = outlook.trend === 'rising' ? ArrowUpRight : outlook.trend === 'falling' ? ArrowDownRight : Minus
  const trendColor = outlook.trend === 'rising' ? 'text-emerald-600' : outlook.trend === 'falling' ? 'text-rose-600' : 'text-slate-600'
  const sortedDistricts = Object.values(byDistrict).sort((a, b) => mapValues[b.district] - mapValues[a.district])

  return (
    <section className="card p-6 fade-up">
      <StepHeader step={10} title="Market Dashboard" subtitle={`6-month Uttar Pradesh view for ${input.crop} — prices, profit & loss, growth outlook and district map`} icon={LayoutDashboard} color="bg-slate-800" ai />

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Current UP average" value={`₹${fmt(outlook.currentAvg)}/q`} hint={`${series.length} weeks · ${markets.length} markets`} />
        <Stat label="6-month change" value={<span className={`flex items-center gap-1 ${trendColor}`}><TrendIcon size={20} />{outlook.sixMonthChangePct > 0 ? '+' : ''}{outlook.sixMonthChangePct}%</span>} hint={`${outlook.monthlyChangePct > 0 ? '+' : ''}${outlook.monthlyChangePct}% last month`} />
        <Stat label="90-day forecast" value={`₹${fmt(outlook.forecast90)}/q`} hint={`30 d ₹${fmt(outlook.forecast30)} · 60 d ₹${fmt(outlook.forecast60)}`} accent="text-blue-700" />
        {bestPnl && (
          <Stat
            label={bestPnl.profit >= 0 ? 'Expected profit' : 'Expected loss'}
            value={`${bestPnl.profit < 0 ? '−' : ''}₹${fmt(Math.abs(bestPnl.profit))}`}
            hint={`${bestPnl.marginPct}% margin · ₹${fmt(bestPnl.perQuintal)}/q at ${bestPnl.option.market.name}`}
            accent={bestPnl.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}
          />
        )}
      </div>

      {/* 6-month chart */}
      <div className="mt-6 rounded-2xl border border-slate-200 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700"><TrendingUp size={16} className="text-blue-600" /> 6-month price history (weekly, ₹/quintal)</div>
        <div className="h-72">
          <ResponsiveContainer>
            <ComposedChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" fontSize={11} interval={3} />
              <YAxis fontSize={11} domain={['auto', 'auto']} tickFormatter={(v) => `₹${v}`} width={60} />
              <Tooltip formatter={(v) => `₹${fmt(Number(v))}`} />
              <Legend />
              <Area type="monotone" dataKey="max" stroke="none" fill="#dbeafe" name="UP range (min–max)" />
              <Area type="monotone" dataKey="min" stroke="none" fill="#ffffff" legendType="none" tooltipType="none" />
              <Line type="monotone" dataKey="avg" stroke="#0f172a" strokeWidth={2} dot={false} name="UP average" />
              {top3.map((o, i) => <Line key={o.market.id} type="monotone" dataKey={o.market.name} stroke={COLORS[i]} strokeWidth={1.5} dot={false} strokeDasharray="4 2" />)}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Profit & Loss */}
        <div className="rounded-2xl border border-slate-200 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700"><Wallet size={16} className="text-emerald-600" /> Profit & loss per market ({input.quantityQuintal} q, cost of cultivation ₹{fmt(PRODUCTION_COST[input.crop] ?? 0)}/q)</div>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={pnl.map((p) => ({ name: p.option.market.name.split(' ')[0], profit: p.profit }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" fontSize={10} interval={0} angle={-25} textAnchor="end" height={50} />
                <YAxis fontSize={11} tickFormatter={(v) => `₹${Math.round(v / 1000)}k`} width={50} />
                <Tooltip formatter={(v) => `₹${fmt(Number(v))}`} />
                <ReferenceLine y={0} stroke="#64748b" />
                <Bar dataKey="profit" name="Profit / loss" radius={[4, 4, 0, 0]}>
                  {pnl.map((p) => <Cell key={p.option.market.id} fill={p.profit >= 0 ? '#16a34a' : '#dc2626'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="mt-3 w-full text-xs">
            <thead className="text-left text-slate-500"><tr><th className="py-1">Market</th><th className="py-1 text-right">Revenue</th><th className="py-1 text-right">Selling costs</th><th className="py-1 text-right">Production</th><th className="py-1 text-right">Profit / loss</th></tr></thead>
            <tbody>
              {pnl.slice(0, 5).map((p) => (
                <tr key={p.option.market.id} className="border-t border-slate-100">
                  <td className="py-1 font-medium">{p.option.market.name}</td>
                  <td className="py-1 text-right">₹{fmt(p.option.revenue)}</td>
                  <td className="py-1 text-right text-slate-500">−₹{fmt(p.sellingCosts)}</td>
                  <td className="py-1 text-right text-slate-500">−₹{fmt(p.productionCost)}</td>
                  <td className={`py-1 text-right font-bold ${p.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{p.profit < 0 ? '−' : '+'}₹{fmt(Math.abs(p.profit))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Price growth advice */}
        <div className="rounded-2xl border border-slate-200 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700"><Lightbulb size={16} className="text-amber-500" /> How your price can increase</div>
          <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
            <div className="mb-1 flex items-center gap-2">
              <Badge tone={outlook.trend === 'rising' ? 'green' : outlook.trend === 'falling' ? 'red' : 'slate'}>{outlook.trend} trend</Badge>
              <span className="text-xs text-slate-500">best hold ≈ {outlook.bestHoldDays} days</span>
            </div>
            {outlook.advice.map((a) => <p key={a} className="mt-1">{a}</p>)}
          </div>
          <ul className="mt-3 space-y-2">
            {outlook.levers.map((l) => (
              <li key={l.title} className="flex gap-3 rounded-xl border border-slate-100 p-3">
                <div className="min-w-16 rounded-lg bg-emerald-50 px-2 py-1 text-center text-xs font-bold text-emerald-700">{l.gain}</div>
                <div><div className="text-sm font-semibold">{l.title}</div><div className="text-xs text-slate-500">{l.text}</div></div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* District map */}
      <div className="mt-6 rounded-2xl border border-slate-200 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700"><MapPin size={16} className="text-rose-600" /> Uttar Pradesh district map — {input.crop} {metric === 'net' ? 'net return per quintal' : 'expected selling price'}</div>
          <div className="ml-auto flex rounded-lg border border-slate-200 p-0.5 text-xs">
            {(['net', 'price'] as Metric[]).map((m) => (
              <button key={m} onClick={() => setMetric(m)} className={`rounded-md px-3 py-1 font-semibold ${metric === m ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>
                {m === 'net' ? 'Net return ₹/q' : 'Expected price ₹/q'}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <DistrictMap values={mapValues} selected={selected} home={input.location} onSelect={setSelected} format={(v) => `₹${fmt(v)}/q ${metric === 'net' ? 'net' : 'price'}`} />
          </div>
          <div className="lg:col-span-2">
            {sel ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 fade-up" key={sel.district}>
                <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Direct result · {sel.district}{sel.district === input.location ? ' (your district)' : ''}</div>
                <div className="mt-1 text-lg font-bold text-slate-900">{sel.best.market.name}</div>
                <div className="text-xs text-slate-500">{sel.best.market.buyer ?? sel.best.market.type} · {sel.best.distanceKm} km away</div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <Mini label="Expected price" value={`₹${fmt(sel.best.expectedPrice)}/q`} />
                  <Mini label="Net return" value={`₹${fmt(sel.best.netReturn)}`} accent />
                  <Mini label="Transport" value={`₹${fmt(sel.best.transportCost)}`} />
                  <Mini label="Sell" value={sel.best.sellDay === 0 ? 'Today' : `in ${sel.best.sellDay} days`} />
                  <Mini label="Profit / loss" value={`${sel.best.netReturn - (PRODUCTION_COST[input.crop] ?? 0) * input.quantityQuintal < 0 ? '−' : '+'}₹${fmt(Math.abs(sel.best.netReturn - (PRODUCTION_COST[input.crop] ?? 0) * input.quantityQuintal))}`} accent />
                  <Mini label="Confidence" value={`${sel.best.confidence}%`} />
                </div>
                <div className="mt-3 text-xs font-semibold text-slate-600">Other options from {sel.district}</div>
                <ul className="mt-1 space-y-1 text-xs">
                  {sel.ranked.slice(1, 4).map((o) => (
                    <li key={o.market.id} className="flex justify-between"><span>{o.market.name}</span><span className="font-semibold">₹{fmt(o.netReturn)}</span></li>
                  ))}
                </ul>
                {sel.district !== input.location && (
                  <button className="btn-primary mt-3 w-full !py-2 text-xs" onClick={() => onUseDistrict(sel.district)}>Use {sel.district} as my location & re-run</button>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Click a district on the map to see its best market, price and profit.</div>
            )}
            <div className="mt-3 text-xs font-semibold text-slate-600">Top 5 districts by {metric === 'net' ? 'net return' : 'price'}</div>
            <ul className="mt-1 space-y-1 text-xs">
              {sortedDistricts.slice(0, 5).map((r, i) => (
                <li key={r.district}>
                  <button className="flex w-full justify-between rounded-lg px-2 py-1 hover:bg-slate-50" onClick={() => setSelected(r.district)}>
                    <span>{i + 1}. {r.district}</span><span className="font-semibold text-emerald-700">₹{fmt(mapValues[r.district])}/q</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

function Mini({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-white p-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`text-sm font-bold ${accent ? 'text-emerald-700' : 'text-slate-800'}`}>{value}</div>
    </div>
  )
}
