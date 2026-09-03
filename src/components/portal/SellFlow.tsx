import { CheckCircle2, IndianRupee, Store, Truck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { LOGISTICS, MISC } from '../../lib/data'
import { buildOptions, fmt, logisticsCost, rankOptions } from '../../lib/engine'
import type { CropListing, DbShape, Order, TransportOrder } from '../../lib/store'
import { placeOrder, setListingStatus } from '../../lib/store'
import type { CleanMarket, Option } from '../../lib/types'
import { Badge } from '../ui'

const MODES: { mode: TransportOrder['mode']; factor: number; eta: string; note: string }[] = [
  { mode: 'Self transport', factor: 0.5, eta: 'Same day', note: 'Your own tractor/vehicle — only fuel and labour.' },
  { mode: 'Mandi tractor-trolley', factor: 0.8, eta: 'Same day', note: 'Shared trolley arranged by the mandi samiti.' },
  { mode: 'Hired truck (9 MT)', factor: 1, eta: 'Next day', note: 'Full-load truck with loading/unloading included.' },
  { mode: 'Buyer pickup', factor: 0, eta: '1–2 days', note: 'Buyer collects from your village; price is usually slightly lower.' },
]

export function SellFlow({
  db,
  update,
  markets,
  listing,
  onPickListing,
  onDone,
}: {
  db: DbShape
  update: (fn: (d: DbShape) => DbShape) => void
  markets: CleanMarket[]
  listing: CropListing | null
  onPickListing: (l: CropListing) => void
  onDone: () => void
}) {
  const [marketId, setMarketId] = useState<string | null>(null)
  const [modeIdx, setModeIdx] = useState(2)
  const [placed, setPlaced] = useState<Order | null>(null)

  const sellable = db.listings.filter((l) => l.status !== 'Payment Completed' && l.status !== 'Payment Pending')

  const options = useMemo<Option[]>(() => {
    if (!listing) return []
    return rankOptions(
      buildOptions(
        { crop: listing.crop, quantityQuintal: listing.quantityQuintal, grade: listing.grade, location: listing.district },
        { sellingDeadlineDays: 7, storageCapacityQuintal: listing.quantityQuintal, budgetInr: 1_000_000, transportLimitKm: 800 },
        markets,
      ),
    )
  }, [listing, markets])

  const chosen = options.find((o) => o.market.id === marketId) ?? null
  const mode = MODES[modeIdx]

  const quote = useMemo(() => {
    if (!listing || !chosen) return null
    const price = chosen.expectedPrice
    const gross = Math.round(price * listing.quantityQuintal)
    const transport = Math.round(logisticsCost(chosen.distanceKm, listing.quantityQuintal) * mode.factor)
    const charges =
      Math.round(gross * ((chosen.market.feesPct + MISC.commissionAgentPct) / 100) + listing.quantityQuintal * MISC.weighingPerQuintal) + transport
    return { price, gross, transport, charges, net: gross - charges }
  }, [listing, chosen, mode])

  if (!listing) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-extrabold text-slate-900">Sell Produce / फसल बेचें</h1>
        <p className="text-slate-600">Choose which crop lot you want to sell.</p>
        {sellable.length === 0 && <p className="card p-6 text-slate-500">No crop lots available — add a crop in “My Crops” first.</p>}
        <div className="grid gap-4 md:grid-cols-2">
          {sellable.map((l) => (
            <button key={l.id} className="card p-5 text-left hover:border-emerald-400" onClick={() => onPickListing(l)} data-testid="pick-listing">
              <div className="text-lg font-bold text-slate-900">{l.crop} · {l.quantityQuintal} quintal</div>
              <div className="text-sm text-slate-600">Grade {l.grade} · {l.district}</div>
              <Badge tone="blue">{l.status}</Badge>
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (placed) {
    return (
      <div className="space-y-6">
        <section className="card border-emerald-300 bg-emerald-50 p-8 text-center fade-up" data-testid="order-success">
          <CheckCircle2 size={56} className="mx-auto text-emerald-600" />
          <h1 className="mt-3 text-3xl font-extrabold text-emerald-900">Order confirmed / ऑर्डर पक्का हुआ</h1>
          <p className="mt-2 text-emerald-900">
            {placed.quantityQuintal} quintal {placed.crop} to {placed.marketName} at ₹{fmt(placed.pricePerQuintal)}/quintal — estimated net ₹{fmt(placed.netAmount)}.
          </p>
          <p className="mt-1 text-sm text-emerald-800">Transport: {placed.transport.mode} · ETA {placed.transport.eta} · order {placed.id}</p>
          <button className="btn-big mx-auto mt-5" onClick={onDone} data-testid="goto-orders">Track this order</button>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold text-slate-900">Sell Produce / फसल बेचें</h1>
        <p className="mt-1 text-slate-600">
          {listing.crop} · {listing.quantityQuintal} quintal · Grade {listing.grade} · {listing.district}
        </p>
      </header>

      <section className="card p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Store size={18} className="text-emerald-600" /> 1. Select mandi / buyer</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {options.slice(0, 6).map((o) => (
            <button
              key={o.market.id}
              onClick={() => setMarketId(o.market.id)}
              className={`rounded-xl border-2 p-4 text-left transition ${o.market.id === marketId ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-300'}`}
              data-testid="pick-market"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-900">{o.market.name}</span>
                {o.market.id === marketId && <CheckCircle2 size={18} className="text-emerald-600" />}
              </div>
              <div className="text-sm text-slate-600">{o.market.type} · {o.distanceKm} km · buyer {o.market.buyer ?? 'mandi traders'}</div>
              <div className="mt-2 text-xl font-extrabold text-emerald-700">₹{fmt(o.expectedPrice)}<span className="text-sm font-semibold text-slate-500">/quintal</span></div>
              <div className="text-xs text-slate-500">demand score {o.demandScore}/100 · fee {o.market.feesPct}%</div>
            </button>
          ))}
        </div>
      </section>

      {chosen && (
        <section className="card p-6 fade-up">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Truck size={18} className="text-blue-600" /> 2. Choose transportation</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {MODES.map((m, i) => {
              const cost = Math.round(logisticsCost(chosen.distanceKm, listing.quantityQuintal) * m.factor)
              return (
                <button
                  key={m.mode}
                  onClick={() => setModeIdx(i)}
                  className={`rounded-xl border-2 p-4 text-left transition ${i === modeIdx ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}
                  data-testid="pick-transport"
                >
                  <div className="font-bold text-slate-900">{m.mode}</div>
                  <div className="text-sm text-slate-600">{m.note}</div>
                  <div className="mt-1 text-sm font-bold text-slate-800">₹{fmt(cost)} · ETA {m.eta}</div>
                </button>
              )
            })}
          </div>
          <p className="mt-3 text-xs text-slate-500">Hired-truck rate: ₹{LOGISTICS.fixedTrip} fixed + ₹{LOGISTICS.ratePerQuintalKm}/quintal-km + ₹{LOGISTICS.loadingPerQuintal}/quintal loading.</p>
        </section>
      )}

      {chosen && quote && (
        <section className="card p-6 fade-up">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><IndianRupee size={18} className="text-amber-600" /> 3. Confirm order</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Line label="Price" value={`₹${fmt(quote.price)}/q`} />
            <Line label="Gross amount" value={`₹${fmt(quote.gross)}`} />
            <Line label="Transport + mandi charges" value={`₹${fmt(quote.charges)}`} />
            <Line label="Estimated net amount" value={`₹${fmt(quote.net)}`} accent="text-emerald-700" />
          </dl>
          <button
            className="btn-big mt-5"
            data-testid="place-order"
            onClick={() => {
              let created: Order | null = null
              update((d) => {
                let next = setListingStatus(d, listing.id, 'Buyer Selected')
                const res = placeOrder(next, {
                  listingId: listing.id,
                  marketId: chosen.market.id,
                  marketName: chosen.market.name,
                  buyer: chosen.market.buyer ?? `${chosen.market.name} traders`,
                  crop: listing.crop,
                  quantityQuintal: listing.quantityQuintal,
                  grade: listing.grade,
                  pricePerQuintal: quote.price,
                  grossAmount: quote.gross,
                  charges: quote.charges,
                  netAmount: quote.net,
                  transport: {
                    id: `trn-${Date.now().toString(36)}`,
                    mode: mode.mode,
                    distanceKm: chosen.distanceKm,
                    cost: quote.transport,
                    eta: mode.eta,
                  },
                })
                next = res.db
                created = res.order
                return next
              })
              setPlaced(created)
            }}
          >
            <CheckCircle2 size={18} /> Place sell order
          </button>
          <p className="mt-2 text-xs text-slate-500">Prices are indicative estimates from modelled mandi data; the final rate is settled at the mandi after weighing and assaying.</p>
        </section>
      )}
    </div>
  )
}

function Line({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-1 text-lg font-extrabold ${accent ?? 'text-slate-900'}`}>{value}</dd>
    </div>
  )
}
