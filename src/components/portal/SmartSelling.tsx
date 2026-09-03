import { BadgeIndianRupee, BarChart3, CalendarDays, CheckCircle2, Info, Loader2, Sparkles, TrendingUp, Truck } from 'lucide-react'
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CROPS, LOCATIONS } from '../../lib/data'
import { fmt } from '../../lib/engine'
import { smartDecision } from '../../lib/smart'
import type { SmartDecision, SmartInput, SmartOption } from '../../lib/smart'
import type { Lang } from '../../lib/store'
import type { CleanMarket, Grade } from '../../lib/types'
import { Badge } from '../ui'

const today = () => new Date().toISOString().slice(0, 10)
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)

export interface SmartSellingResult {
  input: SmartInput
  decision: SmartDecision
  option: SmartOption
}

export function SmartSelling({
  markets,
  lang,
  defaults,
  onSell,
}: {
  markets: CleanMarket[]
  lang: Lang
  defaults: { crop: string; district: string; quantityQuintal?: number; grade?: Grade }
  onSell: (r: SmartSellingResult) => void
}) {
  const hi = lang === 'hi'
  const [form, setForm] = useState<SmartInput>({
    crop: defaults.crop,
    variety: '',
    quantityQuintal: defaults.quantityQuintal ?? 50,
    grade: defaults.grade ?? 'A',
    location: defaults.district,
    harvestDate: inDays(-7),
    expectedSellingDate: inDays(10),
    minPricePerQuintal: 2300,
    hasStorage: true,
    hasTransport: false,
  })
  const [busy, setBusy] = useState(false)
  const [decision, setDecision] = useState<SmartDecision | null>(null)
  const [chosen, setChosen] = useState<SmartOption['kind']>('now')
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof SmartInput>(k: K, v: SmartInput[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    setDecision(null) // any input change invalidates the previous recommendation
  }

  const invalid =
    form.quantityQuintal <= 0 || Number.isNaN(form.quantityQuintal)
      ? 'Enter a quantity greater than 0.'
      : form.quantityQuintal > 5000
        ? 'Quantity looks unrealistically large.'
        : form.minPricePerQuintal < 0 || Number.isNaN(form.minPricePerQuintal)
          ? 'Enter a valid minimum price.'
          : new Date(form.expectedSellingDate) < new Date(today())
            ? 'Expected selling date cannot be in the past.'
            : null

  async function run() {
    if (invalid) return
    setBusy(true)
    setError(null)
    await new Promise((r) => setTimeout(r, 350)) // model run
    const d = smartDecision(form, markets)
    if (!d) setError('No market data is available for this crop right now.')
    else {
      setDecision(d)
      setChosen(d.headline === 'WAIT' ? 'wait' : d.headline === 'SELL AT ANOTHER MANDI' ? 'other' : 'now')
    }
    setBusy(false)
  }

  const selected = decision?.options.find((o) => o.kind === chosen) ?? decision?.options[0]

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold text-slate-900">{hi ? 'स्मार्ट बिक्री निर्णय' : 'Smart Selling Decision'}</h1>
        <p className="mt-1 text-slate-600">
          {hi
            ? 'अपनी फसल की जानकारी भरें — सिस्टम मंडी भाव, पुराने रुझान, माँग, दूरी, ढुलाई और भंडारण जोड़कर बताएगा कि कहाँ और कब बेचना बेहतर है।'
            : 'Enter your crop details — the system combines mandi prices, price history, demand, distance, transport and storage to tell you where and when to sell.'}
        </p>
      </header>

      <section className="card p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="label-big" htmlFor="ss-crop">Crop / फसल</label>
            <select id="ss-crop" className="input-big" value={form.crop} onChange={(e) => set('crop', e.target.value)}>
              {CROPS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label-big" htmlFor="ss-variety">Variety / किस्म</label>
            <input id="ss-variety" className="input-big" placeholder="HD-2967, Pusa…" value={form.variety} onChange={(e) => set('variety', e.target.value)} />
          </div>
          <div>
            <label className="label-big" htmlFor="ss-qty">Quantity (quintal) / मात्रा</label>
            <input id="ss-qty" type="number" min={1} className="input-big" value={form.quantityQuintal} onChange={(e) => set('quantityQuintal', Number(e.target.value))} />
          </div>
          <div>
            <label className="label-big" htmlFor="ss-grade">Quality / ग्रेड</label>
            <select id="ss-grade" className="input-big" value={form.grade} onChange={(e) => set('grade', e.target.value as Grade)}>
              <option value="A">A — Premium</option>
              <option value="B">B — Standard</option>
              <option value="C">C — Low</option>
            </select>
          </div>
          <div>
            <label className="label-big" htmlFor="ss-loc">Current location / स्थान</label>
            <select id="ss-loc" className="input-big" value={form.location} onChange={(e) => set('location', e.target.value)}>
              {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label-big" htmlFor="ss-min">Minimum acceptable price (₹/q)</label>
            <input id="ss-min" type="number" min={0} className="input-big" value={form.minPricePerQuintal} onChange={(e) => set('minPricePerQuintal', Number(e.target.value))} />
          </div>
          <div>
            <label className="label-big" htmlFor="ss-harvest">Harvest date / कटाई</label>
            <input id="ss-harvest" type="date" className="input-big" value={form.harvestDate} onChange={(e) => set('harvestDate', e.target.value)} />
          </div>
          <div>
            <label className="label-big" htmlFor="ss-sell">Expected selling date / बिक्री तारीख</label>
            <input id="ss-sell" type="date" className="input-big" value={form.expectedSellingDate} onChange={(e) => set('expectedSellingDate', e.target.value)} />
          </div>
          <div className="flex flex-col justify-end gap-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" className="h-5 w-5 accent-emerald-600" checked={form.hasStorage} onChange={(e) => set('hasStorage', e.target.checked)} />
              Storage available / भंडारण उपलब्ध
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" className="h-5 w-5 accent-emerald-600" checked={form.hasTransport} onChange={(e) => set('hasTransport', e.target.checked)} />
              Own transport / अपना वाहन
            </label>
          </div>
        </div>

        {invalid && <p className="mt-3 text-sm font-semibold text-rose-600">{invalid}</p>}
        {error && <p className="mt-3 text-sm font-semibold text-rose-600">{error}</p>}

        <button className="btn-big mt-5 w-full sm:w-auto" onClick={run} disabled={busy || !!invalid} data-testid="ss-analyze">
          {busy ? <><Loader2 size={18} className="animate-spin" /> Analyzing…</> : <><Sparkles size={18} /> {hi ? 'विश्लेषण करें और सलाह पाएं' : 'Analyze & recommend'}</>}
        </button>
      </section>

      {decision && selected && (
        <>
          <section className="card overflow-hidden fade-up" data-testid="ss-best">
            <div className="bg-emerald-600 px-6 py-4 text-white">
              <div className="text-xs font-bold uppercase tracking-widest text-emerald-100">{hi ? 'बेचने का सबसे अच्छा विकल्प' : 'Best option to sell'}</div>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <span className="text-3xl font-extrabold">{decision.headline}</span>
                <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-bold">{decision.headlineHi}</span>
                <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">Confidence {decision.confidence}%</span>
              </div>
            </div>
            <div className="grid gap-4 p-6 md:grid-cols-3">
              <Field label={hi ? 'सुझाई गई मंडी' : 'Recommended mandi'} value={decision.best.market.name} sub={`${decision.best.distanceKm} km · ${decision.best.market.type}`} />
              <Field label={hi ? 'बिक्री की तारीख' : 'Recommended selling date'} value={decision.sellDate} sub={decision.sellDay > 0 ? `wait ${decision.sellDay} day(s)` : 'today'} />
              <Field label={hi ? 'अनुमानित भाव' : 'Expected price range'} value={`₹${fmt(decision.expectedLow)} – ₹${fmt(decision.expectedHigh)}/q`} sub={`current ₹${fmt(decision.options[0].pricePerQuintal)}/q`} />
              <Field label={hi ? 'अनुमानित कुल आय' : 'Estimated gross revenue'} value={`₹${fmt(selected.costs.gross)}`} sub={`${form.quantityQuintal} quintal`} />
              <Field label={hi ? 'ढुलाई खर्च' : 'Transport cost'} value={`₹${fmt(selected.costs.transport)}`} sub={form.hasTransport ? 'own vehicle (fuel/labour)' : 'hired truck'} />
              <Field label={hi ? 'मंडी / कमीशन' : 'Mandi & commission'} value={`₹${fmt(selected.costs.commission)}`} sub={`${decision.best.market.feesPct}% mandi fee + 1% commission`} />
              <Field label={hi ? 'भंडारण खर्च' : 'Storage cost'} value={`₹${fmt(selected.costs.storage)}`} sub={selected.sellDay > 0 ? `${selected.sellDay} day(s)` : 'not applicable'} />
              <Field label={hi ? 'अनुमानित शुद्ध आय' : 'Estimated net revenue'} value={`₹${fmt(selected.costs.net)}`} accent="text-emerald-700" sub={`${decision.profitVsCost >= 0 ? 'profit' : 'loss'} vs cost of cultivation ₹${fmt(Math.abs(decision.profitVsCost))}`} />
              <Field
                label={hi ? 'आपका न्यूनतम भाव' : 'Your minimum price'}
                value={`₹${fmt(form.minPricePerQuintal)}/q`}
                accent={decision.meetsMinPrice ? 'text-emerald-700' : 'text-rose-600'}
                sub={decision.meetsMinPrice ? 'met by this option' : 'not met — negotiate or wait'}
              />
            </div>
            <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 text-xs text-slate-500">
              <Info size={12} className="mr-1 inline" />
              {hi ? 'सभी आंकड़े अनुमान हैं — भविष्य का भाव गारंटी नहीं है।' : 'All figures are estimates from modelled market data — future prices are not guaranteed.'}
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-3" data-testid="ss-options">
            {decision.options.map((o) => (
              <button
                key={o.kind}
                onClick={() => setChosen(o.kind)}
                className={`card p-5 text-left transition ${chosen === o.kind ? 'ring-2 ring-emerald-500' : 'hover:border-emerald-300'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold text-slate-900">{hi ? o.titleHi : o.title}</div>
                  {chosen === o.kind && <CheckCircle2 size={20} className="shrink-0 text-emerald-600" />}
                </div>
                <div className="mt-3 text-2xl font-extrabold text-emerald-700">₹{fmt(o.costs.net)}</div>
                <div className="text-xs text-slate-500">estimated net · ₹{fmt(o.pricePerQuintal)}/quintal</div>
                <p className="mt-3 text-sm text-slate-600">{hi ? o.noteHi : o.note}</p>
              </button>
            ))}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="card p-5">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700"><TrendingUp size={16} className="text-blue-600" /> Price trend & forecast (₹/quintal)</div>
              <div className="h-60">
                <ResponsiveContainer>
                  <LineChart data={decision.trendSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                    <Tooltip formatter={(v) => `₹${fmt(Number(v))}`} />
                    <Line type="monotone" dataKey="price" stroke="#2563eb" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card p-5">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700"><BarChart3 size={16} className="text-emerald-600" /> Mandi comparison — estimated net revenue</div>
              <div className="h-60">
                <ResponsiveContainer>
                  <BarChart data={decision.comparison} layout="vertical" margin={{ left: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `₹${Math.round(v / 1000)}k`} />
                    <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => `₹${fmt(Number(v))}`} />
                    <Bar dataKey="net" radius={[0, 6, 6, 0]}>
                      {decision.comparison.map((c) => (
                        <Cell key={c.name} fill={c.name === decision.best.market.name.replace(/ \(.*\)/, '') ? '#16a34a' : '#94a3b8'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card p-5 lg:col-span-2">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700"><BadgeIndianRupee size={16} className="text-amber-600" /> Expected profit after cost of cultivation (₹)</div>
              <div className="h-56">
                <ResponsiveContainer>
                  <BarChart data={decision.comparison}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-12} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `₹${Math.round(v / 1000)}k`} />
                    <Tooltip formatter={(v) => `₹${fmt(Number(v))}`} />
                    <Bar dataKey="profit" radius={[6, 6, 0, 0]}>
                      {decision.comparison.map((c) => <Cell key={c.name} fill={c.profit >= 0 ? '#16a34a' : '#e11d48'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="card border-emerald-200 bg-emerald-50 p-6">
            <div className="flex items-center gap-2 text-lg font-bold text-emerald-900"><Info size={18} /> {hi ? 'यह सलाह क्यों?' : 'Why this recommendation?'}</div>
            <ul className="mt-3 space-y-2 text-sm text-emerald-900">
              {(hi ? decision.reasonsHi : decision.reasons).map((r) => (
                <li key={r} className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />{r}</li>
              ))}
            </ul>
            {!hi && (
              <div className="mt-4 rounded-xl border border-emerald-300 bg-white p-4 text-sm text-slate-700">
                <div className="mb-1 text-xs font-bold uppercase tracking-wide text-emerald-700">हिंदी में सरल भाषा</div>
                {decision.reasonsHi.map((r) => <p key={r} className="mt-1">{r}</p>)}
              </div>
            )}
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-big" data-testid="ss-sell" onClick={() => onSell({ input: form, decision, option: selected })}>
              <Truck size={18} /> {hi ? 'इस विकल्प से फसल बेचें' : 'Sell with this option'}
            </button>
            <Badge tone="amber"><CalendarDays size={12} className="mr-1" /> {hi ? 'अनुमान — गारंटीड भाव नहीं' : 'Estimate — not a guaranteed price'}</Badge>
          </div>
        </>
      )}
    </div>
  )
}

function Field({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-extrabold ${accent ?? 'text-slate-900'}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  )
}
