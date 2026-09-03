import { MapPin, RefreshCw, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CROPS, LOCATIONS } from '../../lib/data'
import { fmt, predictPrice } from '../../lib/engine'
import type { CleanMarket } from '../../lib/types'
import { Badge } from '../ui'

export function MarketPrices({
  markets,
  crop,
  district,
  onCrop,
  onDistrict,
  onRefresh,
  lastSync,
  onSmartSelling,
}: {
  markets: CleanMarket[]
  crop: string
  district: string
  onCrop: (c: string) => void
  onDistrict: (d: string) => void
  onRefresh: () => void
  lastSync: number
  onSmartSelling: () => void
}) {
  const [sort, setSort] = useState<'price' | 'distance'>('price')

  const rows = useMemo(() => {
    const list = markets
      .filter((m) => m.history[crop])
      .map((m) => {
        const model = predictPrice(m.history[crop], 30)
        return {
          m,
          price: model.today,
          trend: model.trend,
          forecast30: model.forecast[30]?.price ?? model.today,
          distance: m.distanceKm[district] ?? 0,
          demand: m.demandQuintal[crop] ?? 0,
        }
      })
    return list.sort((a, b) => (sort === 'price' ? b.price - a.price : a.distance - b.distance))
  }, [markets, crop, district, sort])

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Market Prices / मंडी भाव</h1>
          <p className="mt-1 text-slate-600">Uttar Pradesh mandis, e-NAM centres, FPOs and buyers — updated {new Date(lastSync).toLocaleTimeString('en-IN')}.</p>
        </div>
        <button className="btn-big-outline" onClick={onRefresh}><RefreshCw size={18} /> Refresh prices</button>
      </header>

      <section className="card p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label-big" htmlFor="mp-crop">Crop</label>
            <select id="mp-crop" className="input-big" value={crop} onChange={(e) => onCrop(e.target.value)}>{CROPS.map((c) => <option key={c}>{c}</option>)}</select>
          </div>
          <div>
            <label className="label-big" htmlFor="mp-dist">My district</label>
            <select id="mp-dist" className="input-big" value={district} onChange={(e) => onDistrict(e.target.value)}>{LOCATIONS.map((l) => <option key={l}>{l}</option>)}</select>
          </div>
          <div>
            <label className="label-big" htmlFor="mp-sort">Sort by</label>
            <select id="mp-sort" className="input-big" value={sort} onChange={(e) => setSort(e.target.value === 'distance' ? 'distance' : 'price')}>
              <option value="price">Highest price</option>
              <option value="distance">Nearest mandi</option>
            </select>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((r) => (
          <article key={r.m.id} className="card p-5" data-testid="price-card">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-lg font-bold text-slate-900">{r.m.name}</div>
                <div className="text-sm text-slate-600"><MapPin size={13} className="mr-1 inline" />{r.m.district} · {r.distance} km · {r.m.type}</div>
              </div>
              <Badge tone={r.trend === 'rising' ? 'green' : r.trend === 'falling' ? 'red' : 'slate'}>{r.trend}</Badge>
            </div>
            <div className="mt-3 flex items-end gap-3">
              <div className="text-3xl font-extrabold text-emerald-700">₹{fmt(r.price)}</div>
              <div className="pb-1 text-sm text-slate-500">/quintal</div>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              <TrendingUp size={12} className="mr-1 inline" />30-day estimate ₹{fmt(r.forecast30)} · demand {fmt(r.demand)} q · fee {r.m.feesPct}% · {r.m.hasStorage ? 'storage available' : 'no storage'}
            </div>
          </article>
        ))}
      </div>

      <button className="btn-big" onClick={onSmartSelling}>Get a selling recommendation for {crop}</button>
      <p className="text-xs text-slate-500">Prices are modelled demo feeds for Uttar Pradesh markets, refreshed automatically; they are indicative, not official APMC/e-NAM quotes.</p>
    </div>
  )
}
