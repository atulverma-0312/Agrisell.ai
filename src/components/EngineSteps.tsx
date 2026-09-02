import { Calculator, Cpu, Handshake, LineChart as LineIcon, Trophy, Truck, Users } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmt } from '../lib/engine'
import type { FarmerInput, Option } from '../lib/types'
import { Badge, StepHeader } from './ui'

export function EngineStep({ input, options }: { input: FarmerInput; options: Option[] }) {
  const top = [...options].sort((a, b) => b.netReturn - a.netReturn).slice(0, 3)
  const chartData = top[0]
    ? top[0].price.forecast.map((p, i) => {
        const row: Record<string, number> = { day: p.day }
        top.forEach((o) => (row[o.market.name] = o.price.forecast[i]?.price ?? 0))
        return row
      })
    : []
  const colors = ['#2563eb', '#16a34a', '#f97316']

  return (
    <section className="card p-6 fade-up">
      <StepHeader step={5} title="Farmer-Specific Optimization Engine" subtitle="Four AI models run for every candidate market" icon={Cpu} color="bg-blue-600" ai />
      <div className="grid gap-4 lg:grid-cols-2">
        <Tile icon={LineIcon} title="Price Model" tag="Trend regression + Holt smoothing" color="text-blue-600 bg-blue-50 border-blue-100">
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" tickFormatter={(d) => (d === 0 ? 'Today' : `+${d}d`)} fontSize={11} />
                <YAxis fontSize={11} domain={['auto', 'auto']} tickFormatter={(v) => `₹${v}`} width={60} />
                <Tooltip formatter={(v) => `₹${fmt(Number(v))}`} labelFormatter={(d) => `Day +${d}`} />
                <ReferenceLine x={0} stroke="#94a3b8" />
                {top.map((o, i) => <Line key={o.market.id} type="monotone" dataKey={o.market.name} stroke={colors[i]} dot={false} strokeWidth={2} />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-1 text-sm">
            {top.map((o, i) => (
              <li key={o.market.id} className="flex items-center justify-between">
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[i] }} />{o.market.name}</span>
                <span className="text-slate-600">
                  <Badge tone={o.price.trend === 'rising' ? 'green' : o.price.trend === 'falling' ? 'red' : 'slate'}>{o.price.trend}</Badge>{' '}
                  peak ₹{fmt(o.price.bestPrice)} on day {o.price.bestDay}
                </span>
              </li>
            ))}
          </ul>
        </Tile>

        <Tile icon={Users} title="Demand Analysis" tag="Demand forecasting · market appetite" color="text-emerald-700 bg-emerald-50 border-emerald-100">
          <div className="space-y-3">
            {[...options].sort((a, b) => b.demandScore - a.demandScore).map((o) => (
              <div key={o.market.id}>
                <div className="flex justify-between text-sm"><span>{o.market.name}</span><span className="text-slate-500">{fmt(o.market.demandQuintal[input.crop])} q demand · {Math.round(o.demandCoverage * 100)}% coverage</span></div>
                <div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-emerald-500" style={{ width: `${o.demandScore}%` }} /></div>
              </div>
            ))}
          </div>
        </Tile>

        <Tile icon={Truck} title="Logistics Cost Engine" tag="Distance · transport cost · trips" color="text-orange-700 bg-orange-50 border-orange-100">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-1">Market</th><th>Distance</th><th>Trips</th><th className="text-right">Cost</th></tr></thead>
            <tbody>
              {[...options].sort((a, b) => a.transportCost - b.transportCost).map((o) => (
                <tr key={o.market.id} className="border-t border-slate-100">
                  <td className="py-1.5">{o.market.name}</td>
                  <td>{o.distanceKm} km</td>
                  <td>{Math.ceil(input.quantityQuintal / 90)}</td>
                  <td className="text-right font-medium">₹{fmt(o.transportCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Tile>

        <Tile icon={Handshake} title="Market / Buyer Matching" tag="Suitability · reliability" color="text-violet-700 bg-violet-50 border-violet-100">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-1">Market</th><th>Buyer</th><th>Suitability</th><th className="text-right">Reliability</th></tr></thead>
            <tbody>
              {[...options].sort((a, b) => b.suitabilityScore - a.suitabilityScore).map((o) => (
                <tr key={o.market.id} className="border-t border-slate-100">
                  <td className="py-1.5">{o.market.name}</td>
                  <td className="text-slate-500">{o.market.buyer ?? 'Open auction'}</td>
                  <td><Badge tone={o.suitabilityScore > 70 ? 'green' : o.suitabilityScore > 50 ? 'amber' : 'red'}>{o.suitabilityScore}/100</Badge></td>
                  <td className="text-right">{Math.round(o.market.reliability * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Tile>
      </div>
    </section>
  )
}

function Tile({ icon: Icon, title, tag, color, children }: { icon: typeof Cpu; title: string; tag: string; color: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border p-4 ${color.split(' ').slice(1).join(' ')}`}>
      <div className={`mb-3 flex items-center gap-2 font-semibold ${color.split(' ')[0]}`}><Icon size={18} /> {title} <span className="ml-auto text-xs font-normal text-slate-500">{tag}</span></div>
      <div className="rounded-lg bg-white p-3">{children}</div>
    </div>
  )
}

export function EconomicsStep({ options }: { options: Option[] }) {
  const sorted = [...options].sort((a, b) => b.netReturn - a.netReturn)
  return (
    <section className="card p-6 fade-up">
      <StepHeader step={6} title="Economic Calculation" subtitle="Revenue − Transport − Storage − Other costs = Estimated Net Return" icon={Calculator} color="bg-rose-600" />
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm font-semibold">
        <Chip c="bg-emerald-50 text-emerald-800 border-emerald-200">Revenue (Qty × Expected Price)</Chip><span>−</span>
        <Chip c="bg-rose-50 text-rose-800 border-rose-200">Transport</Chip><span>−</span>
        <Chip c="bg-amber-50 text-amber-800 border-amber-200">Storage</Chip><span>−</span>
        <Chip c="bg-violet-50 text-violet-800 border-violet-200">Other (fees, commission)</Chip><span>=</span>
        <Chip c="bg-slate-900 text-white border-slate-900">Net Return</Chip>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-3 py-2">Market</th><th className="px-3 py-2">Sell day</th><th className="px-3 py-2">Exp. price</th><th className="px-3 py-2 text-right">Revenue</th><th className="px-3 py-2 text-right">Transport</th><th className="px-3 py-2 text-right">Storage</th><th className="px-3 py-2 text-right">Other</th><th className="px-3 py-2 text-right">Net return</th><th className="px-3 py-2">Feasible</th></tr>
          </thead>
          <tbody>
            {sorted.map((o) => (
              <tr key={o.market.id} className={`border-t border-slate-100 ${o.feasible ? '' : 'opacity-50'}`}>
                <td className="px-3 py-2 font-medium">{o.market.name}</td>
                <td className="px-3 py-2">{o.sellDay === 0 ? 'Today' : `+${o.sellDay}d`}</td>
                <td className="px-3 py-2">₹{fmt(o.expectedPrice)}/q</td>
                <td className="px-3 py-2 text-right text-emerald-700">₹{fmt(o.revenue)}</td>
                <td className="px-3 py-2 text-right text-rose-700">−₹{fmt(o.transportCost)}</td>
                <td className="px-3 py-2 text-right text-amber-700">−₹{fmt(o.storageCost)}</td>
                <td className="px-3 py-2 text-right text-violet-700">−₹{fmt(o.otherCosts)}</td>
                <td className="px-3 py-2 text-right font-bold">₹{fmt(o.netReturn)}</td>
                <td className="px-3 py-2">{o.feasible ? <Badge tone="green">Yes</Badge> : <Badge tone="red" >{o.infeasibleReasons[0]}</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Chip({ c, children }: { c: string; children: React.ReactNode }) {
  return <span className={`rounded-lg border px-3 py-1.5 ${c}`}>{children}</span>
}

export function RankingStep({ ranked }: { ranked: Option[] }) {
  const medals = ['🥇', '🥈', '🥉']
  const styles = ['border-amber-300 bg-amber-50', 'border-slate-300 bg-slate-50', 'border-orange-300 bg-orange-50']
  return (
    <section className="card p-6 fade-up">
      <StepHeader step={7} title="Option Ranking" subtitle="Multi-criteria AI score: 55% net return · 20% suitability · 15% demand · −10% risk" icon={Trophy} color="bg-violet-600" ai />
      <div className="grid gap-4 md:grid-cols-3">
        {ranked.slice(0, 3).map((o, i) => (
          <div key={o.market.id} className={`rounded-2xl border-2 p-5 ${styles[i]} ${i === 0 ? 'md:-mt-2 md:shadow-lg' : ''}`}>
            <div className="text-3xl">{medals[i]}</div>
            <div className="mt-2 text-xs font-semibold uppercase text-slate-500">{i === 0 ? 'Best Market / Buyer' : i === 1 ? 'Second Best' : 'Third Best'}</div>
            <div className="text-lg font-bold">{o.market.name}</div>
            <div className="text-sm text-slate-500">{o.market.buyer ?? o.market.type} · {o.distanceKm} km</div>
            <div className="mt-3 text-2xl font-extrabold text-emerald-700">₹{fmt(o.netReturn)}</div>
            <div className="text-xs text-slate-500">estimated net return</div>
            <div className="mt-3 flex items-center justify-between text-sm"><span>AI score</span><span className="font-bold">{o.aiScore}/100</span></div>
            <div className="mt-1 h-2 rounded-full bg-white"><div className="h-2 rounded-full bg-violet-500" style={{ width: `${o.aiScore}%` }} /></div>
          </div>
        ))}
      </div>
      {ranked.length > 3 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-medium text-slate-600">Show all {ranked.length} options</summary>
          <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {ranked.slice(3).map((o, i) => (
              <li key={o.market.id} className="flex items-center justify-between px-3 py-2">
                <span>#{i + 4} {o.market.name} {!o.feasible && <Badge tone="red">{o.infeasibleReasons[0]}</Badge>}</span>
                <span>₹{fmt(o.netReturn)} · score {o.aiScore}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
