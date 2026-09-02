import { CalendarDays, CheckCircle2, CreditCard, Handshake, IndianRupee, Lightbulb, Lock, MapPin, ShieldCheck, Sparkles, Target, Truck, User, Users } from 'lucide-react'
import { useState } from 'react'
import { enhanceReasonWithLLM } from '../lib/ai'
import { fmt } from '../lib/engine'
import type { FarmerConstraints, FarmerInput, Recommendation } from '../lib/types'
import { Badge, Stars, StepHeader } from './ui'

export function OutputStep({ input, constraints, rec }: { input: FarmerInput; constraints: FarmerConstraints; rec: Recommendation }) {
  const [apiKey, setApiKey] = useState<string>(import.meta.env.VITE_OPENAI_API_KEY ?? '')
  const [language, setLanguage] = useState('Hindi')
  const [llmReason, setLlmReason] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now] = useState(() => Date.now())
  const best = rec.best
  if (!best) return null

  const riskTone = rec.risk === 'Low' ? 'green' : rec.risk === 'Medium' ? 'amber' : 'red'
  const sellDate = new Date(now + best.sellDay * 86400000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

  async function explain() {
    setBusy(true)
    setError(null)
    try {
      setLlmReason(await enhanceReasonWithLLM(input, constraints, rec, apiKey, language))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card p-6 fade-up">
      <StepHeader step={8} title="Personalized Output" subtitle="Where to sell, to whom, and when" icon={Target} color="bg-emerald-700" ai />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Out icon={MapPin} label="Best Market" value={best.market.name} sub={`${best.market.type} · ${best.distanceKm} km from ${input.location}`} />
        <Out icon={User} label="Best Buyer" value={best.market.buyer ?? 'Open auction (commission agent)'} sub={`${Math.round(best.market.reliability * 100)}% reliability`} />
        <Out icon={IndianRupee} label="Estimated Net Return" value={`₹${fmt(best.netReturn)}`} sub={`for ${input.quantityQuintal} quintals`} accent />
        <Out icon={CalendarDays} label="Suggested Selling Time" value={best.sellDay === 0 ? 'Sell today' : `In ${best.sellDay} days (${sellDate})`} sub={`Deadline: ${constraints.sellingDeadlineDays} days`} />
        <Out icon={Truck} label="Transport Cost" value={`₹${fmt(best.transportCost)}`} sub={`${Math.ceil(input.quantityQuintal / 90)} truck trip(s)`} />
        <Out icon={IndianRupee} label="Expected Price" value={`₹${fmt(best.expectedPrice)} / quintal`} sub={`Grade ${input.grade} · trend ${best.price.trend}`} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 lg:col-span-2">
          <div className="flex items-center gap-2 font-semibold text-amber-800"><Lightbulb size={18} /> Recommendation Reason</div>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{llmReason ?? rec.reason}</p>
          <div className="mt-4 rounded-lg border border-violet-200 bg-white p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-violet-700"><Sparkles size={16} /> Explain with generative AI (optional)</div>
            <p className="mt-1 text-xs text-slate-500">Rewrites the explanation in the farmer's language using an OpenAI-compatible model. The key stays in your browser.</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input className="input min-w-0 sm:flex-1" type="password" placeholder="OpenAI API key (sk-...)" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
              <select className="input sm:w-36 sm:shrink-0" value={language} onChange={(e) => setLanguage(e.target.value)}>
                {['Hindi', 'Marathi', 'English', 'Punjabi', 'Telugu', 'Tamil'].map((l) => <option key={l}>{l}</option>)}
              </select>
              <button className="btn-primary" onClick={explain} disabled={!apiKey || busy}>{busy ? 'Thinking…' : 'Explain'}</button>
            </div>
            {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
          </div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-center gap-2 font-semibold text-emerald-800"><ShieldCheck size={18} /> Risk / Confidence</div>
          <div className="mt-3 flex items-center justify-between text-sm"><span>Risk level</span><Badge tone={riskTone}>{rec.risk}</Badge></div>
          <div className="mt-2 flex items-center justify-between text-sm"><span>Confidence</span><span className="font-bold">{best.confidence}%</span></div>
          <div className="mt-1 text-2xl"><Stars value={best.confidence} /></div>
          <ul className="mt-3 space-y-1 text-xs text-slate-600">
            <li>Price volatility: {(best.price.volatility * 100).toFixed(1)}%</li>
            <li>Demand coverage: {Math.round(best.demandCoverage * 100)}%</li>
            <li>Buyer reliability: {Math.round(best.market.reliability * 100)}%</li>
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-gradient-to-r from-emerald-700 to-emerald-600 p-5 text-white">
        <div className="text-xs font-semibold uppercase tracking-wider text-emerald-200">Farmer summary</div>
        <div className="mt-2 grid gap-3 sm:grid-cols-3 text-sm">
          <div><CheckCircle2 className="mb-1 inline" size={16} /> <b>Where to sell?</b><br />{best.market.name}</div>
          <div><CheckCircle2 className="mb-1 inline" size={16} /> <b>To whom?</b><br />{best.market.buyer ?? 'Highest bidder at auction'}</div>
          <div><CheckCircle2 className="mb-1 inline" size={16} /> <b>When?</b><br />{best.sellDay === 0 ? 'Today' : `${sellDate} (+${best.sellDay} days)`}</div>
        </div>
      </div>
    </section>
  )
}

function Out({ icon: Icon, label, value, sub, accent }: { icon: typeof MapPin; label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className="flex gap-3 rounded-xl border border-slate-200 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"><Icon size={20} /></div>
      <div className="min-w-0">
        <div className="text-xs font-medium uppercase text-slate-500">{label}</div>
        <div className={`truncate font-bold ${accent ? 'text-xl text-emerald-700' : 'text-slate-900'}`}>{value}</div>
        <div className="text-xs text-slate-500">{sub}</div>
      </div>
    </div>
  )
}

const TX_STEPS = [
  { icon: Users, title: 'Connect to Buyer', desc: 'Share your lot details with the buyer.' },
  { icon: IndianRupee, title: 'Negotiate Price', desc: 'Agree on a final price per quintal.' },
  { icon: Lock, title: 'Secure Transaction', desc: 'Digital sale agreement & escrow.' },
  { icon: Truck, title: 'Logistics Arrangement', desc: 'Book truck & schedule pickup.' },
  { icon: CreditCard, title: 'Payment', desc: 'Funds released to your bank account.' },
]

export function TransactionStep({ input, rec }: { input: FarmerInput; rec: Recommendation }) {
  const best = rec.best
  const [done, setDone] = useState(0)
  const [offer, setOffer] = useState(best?.expectedPrice ?? 0)
  if (!best) return null
  const buyerCounter = Math.round(best.expectedPrice * 0.985)
  const finalPrice = done >= 2 ? Math.max(offer, buyerCounter) : offer

  return (
    <section className="card p-6 fade-up">
      <StepHeader step={9} title="Buyer Connection / Transaction" subtitle={`Complete the sale with ${best.market.buyer ?? best.market.name}`} icon={Handshake} color="bg-blue-700" />
      <ol className="grid gap-3 md:grid-cols-5">
        {TX_STEPS.map((s, i) => {
          const state = i < done ? 'done' : i === done ? 'active' : 'todo'
          return (
            <li key={s.title} className={`rounded-xl border p-4 ${state === 'done' ? 'border-emerald-300 bg-emerald-50' : state === 'active' ? 'border-blue-400 bg-blue-50 shadow' : 'border-slate-200 bg-slate-50 opacity-70'}`}>
              <div className="flex items-center gap-2 text-sm font-semibold">
                {state === 'done' ? <CheckCircle2 className="text-emerald-600" size={18} /> : <s.icon size={18} className="text-blue-700" />}
                {s.title}
              </div>
              <p className="mt-1 text-xs text-slate-600">{s.desc}</p>
            </li>
          )
        })}
      </ol>

      <div className="mt-6 rounded-xl border border-slate-200 p-5">
        {done === 0 && (
          <div>
            <p className="text-sm">Send your lot details to <b>{best.market.buyer ?? best.market.name}</b>: {input.quantityQuintal} quintals of Grade-{input.grade} {input.crop} from {input.location}.</p>
            <button className="btn-primary mt-3" onClick={() => setDone(1)}><Users size={16} /> Connect to buyer</button>
          </div>
        )}
        {done === 1 && (
          <div>
            <p className="text-sm">Buyer is online. AI suggested asking price: <b>₹{fmt(best.expectedPrice)}/quintal</b>. Enter your offer:</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input type="number" className="input w-40" value={offer} onChange={(e) => setOffer(Number(e.target.value))} />
              <button className="btn-primary" onClick={() => setDone(2)}><IndianRupee size={16} /> Send offer</button>
            </div>
          </div>
        )}
        {done === 2 && (
          <div>
            <p className="text-sm">Buyer countered at <b>₹{fmt(buyerCounter)}/quintal</b>; agreed final price <b>₹{fmt(finalPrice)}/quintal</b>. Total contract value: <b>₹{fmt(finalPrice * input.quantityQuintal)}</b>.</p>
            <button className="btn-primary mt-3" onClick={() => setDone(3)}><Lock size={16} /> Sign digital agreement</button>
          </div>
        )}
        {done === 3 && (
          <div>
            <p className="text-sm">Agreement secured in escrow. Book transport: {Math.ceil(input.quantityQuintal / 90)} truck(s), {best.distanceKm} km, est. ₹{fmt(best.transportCost)}.</p>
            <button className="btn-primary mt-3" onClick={() => setDone(4)}><Truck size={16} /> Book pickup</button>
          </div>
        )}
        {done === 4 && (
          <div>
            <p className="text-sm">Pickup scheduled. On delivery & quality check, payment of <b>₹{fmt(finalPrice * input.quantityQuintal)}</b> is released via UPI/NEFT.</p>
            <button className="btn-primary mt-3" onClick={() => setDone(5)}><CreditCard size={16} /> Confirm delivery & release payment</button>
          </div>
        )}
        {done === 5 && (
          <div className="text-center">
            <CheckCircle2 className="mx-auto text-emerald-600" size={40} />
            <div className="mt-2 text-lg font-bold">Transaction complete</div>
            <p className="text-sm text-slate-600">₹{fmt(finalPrice * input.quantityQuintal)} credited. Net after costs ≈ ₹{fmt(finalPrice * input.quantityQuintal - best.transportCost - best.storageCost - best.otherCosts)}.</p>
          </div>
        )}
      </div>
    </section>
  )
}
