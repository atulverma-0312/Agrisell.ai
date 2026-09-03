import { Camera, CheckCircle2, Plus, Sprout, Truck } from 'lucide-react'
import { useState } from 'react'
import { CROPS, LOCATIONS } from '../../lib/data'
import type { CropListing, DbShape, ListingStatus } from '../../lib/store'
import { LISTING_FLOW, addListing, setListingStatus } from '../../lib/store'
import type { Grade } from '../../lib/types'
import { Badge } from '../ui'

function statusTone(s: ListingStatus): 'slate' | 'blue' | 'amber' | 'green' {
  if (s === 'Payment Completed') return 'green'
  if (s === 'Payment Pending' || s === 'Delivered') return 'amber'
  if (s === 'Crop Added') return 'slate'
  return 'blue'
}

export function StatusTrail({ status }: { status: ListingStatus }) {
  const idx = LISTING_FLOW.indexOf(status)
  return (
    <ol className="mt-3 flex flex-wrap gap-1.5">
      {LISTING_FLOW.map((s, i) => (
        <li
          key={s}
          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            i < idx ? 'bg-emerald-50 text-emerald-700' : i === idx ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'
          }`}
        >
          {i <= idx && <CheckCircle2 size={11} />} {s}
        </li>
      ))}
    </ol>
  )
}

export function MyCrops({
  db,
  update,
  defaultDistrict,
  onGradeFromPhoto,
  onSell,
}: {
  db: DbShape
  update: (fn: (d: DbShape) => DbShape) => void
  defaultDistrict: string
  onGradeFromPhoto: () => void
  onSell: (listing: CropListing) => void
}) {
  const [open, setOpen] = useState(db.listings.length === 0)
  const [crop, setCrop] = useState<string>(CROPS[0])
  const [variety, setVariety] = useState('')
  const [qty, setQty] = useState(25)
  const [grade, setGrade] = useState<Grade>('A')
  const [district, setDistrict] = useState(defaultDistrict)
  const [harvestDate, setHarvestDate] = useState(new Date().toISOString().slice(0, 10))
  const [err, setErr] = useState<string | null>(null)

  function add() {
    if (!qty || qty <= 0) return setErr('Quantity must be greater than 0 quintal.')
    if (qty > 5000) return setErr('Quantity looks unrealistically large.')
    setErr(null)
    update((d) => addListing(d, { crop, variety, quantityQuintal: qty, grade, qualitySource: 'manual', district, harvestDate }).db)
    setOpen(false)
    setVariety('')
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">My Crops / मेरी फसलें</h1>
          <p className="mt-1 text-slate-600">Add a crop lot, verify its quality, list it and follow every status until payment.</p>
        </div>
        <button className="btn-big" onClick={() => setOpen((o) => !o)} data-testid="add-crop">
          <Plus size={18} /> Add crop / फसल जोड़ें
        </button>
      </header>

      {open && (
        <section className="card p-6 fade-up">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="label-big" htmlFor="mc-crop">Crop / फसल</label>
              <select id="mc-crop" className="input-big" value={crop} onChange={(e) => setCrop(e.target.value)}>
                {CROPS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label-big" htmlFor="mc-var">Variety / किस्म</label>
              <input id="mc-var" className="input-big" value={variety} onChange={(e) => setVariety(e.target.value)} placeholder="HD-2967" />
            </div>
            <div>
              <label className="label-big" htmlFor="mc-qty">Quantity (quintal)</label>
              <input id="mc-qty" type="number" min={1} className="input-big" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
            </div>
            <div>
              <label className="label-big" htmlFor="mc-grade">Quality / ग्रेड</label>
              <select id="mc-grade" className="input-big" value={grade} onChange={(e) => setGrade(e.target.value as Grade)}>
                <option value="A">A — Premium</option>
                <option value="B">B — Standard</option>
                <option value="C">C — Low</option>
              </select>
            </div>
            <div>
              <label className="label-big" htmlFor="mc-dist">District</label>
              <select id="mc-dist" className="input-big" value={district} onChange={(e) => setDistrict(e.target.value)}>
                {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="label-big" htmlFor="mc-harv">Harvest date</label>
              <input id="mc-harv" type="date" className="input-big" value={harvestDate} onChange={(e) => setHarvestDate(e.target.value)} />
            </div>
          </div>
          {err && <p className="mt-3 text-sm font-semibold text-rose-600">{err}</p>}
          <div className="mt-5 flex flex-wrap gap-3">
            <button className="btn-big" onClick={add} data-testid="save-crop"><Sprout size={18} /> Save crop</button>
            <button className="btn-big-outline" onClick={onGradeFromPhoto}><Camera size={18} /> Check quality from photo</button>
          </div>
        </section>
      )}

      <section className="space-y-4">
        {db.listings.length === 0 && <p className="card p-6 text-slate-500">No crops yet — add your first lot above.</p>}
        {db.listings.map((l) => (
          <article key={l.id} className="card p-5" data-testid="listing-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xl font-bold text-slate-900">
                  {l.crop} {l.variety && <span className="text-slate-500">· {l.variety}</span>}
                </div>
                <div className="text-sm text-slate-600">
                  {l.quantityQuintal} quintal · Grade {l.grade}
                  {l.qualitySource === 'ai-photo' && l.qualityScore != null && <> · AI photo score {l.qualityScore}/100</>} · {l.district} · harvested {l.harvestDate}
                </div>
              </div>
              <Badge tone={statusTone(l.status)}>{l.status}</Badge>
            </div>
            <StatusTrail status={l.status} />
            <div className="mt-4 flex flex-wrap gap-3">
              {l.status === 'Crop Added' && (
                <button className="btn-big-outline" onClick={() => update((d) => setListingStatus(d, l.id, 'Quality Verified'))}>
                  <CheckCircle2 size={18} /> Mark quality verified
                </button>
              )}
              {l.status === 'Quality Verified' && (
                <button className="btn-big-outline" onClick={() => update((d) => setListingStatus(d, l.id, 'Listed'))}>
                  <Sprout size={18} /> List for sale
                </button>
              )}
              {(l.status === 'Listed' || l.status === 'Buyer Selected') && (
                <button className="btn-big" onClick={() => onSell(l)} data-testid="sell-listing"><Truck size={18} /> Sell this lot</button>
              )}
              <button className="btn-big-outline" onClick={onGradeFromPhoto}><Camera size={18} /> Photo quality check</button>
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}
