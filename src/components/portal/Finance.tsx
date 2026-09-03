import { AlertTriangle, BadgeCheck, Banknote, CalendarClock, FileText, History, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CROPS } from '../../lib/data'
import { fmt } from '../../lib/engine'
import type { DbShape, FinancialApplication, FinanceStatus } from '../../lib/store'
import { PURPOSES, addFinance, financeSignals, setFinanceStatus, txnStats } from '../../lib/store'
import { Badge, Stat } from '../ui'

const DISCLAIMER =
  'Financial eligibility shown in this demo is simulated and does not constitute a loan approval. Actual credit approval depends on the authorized financial institution.'

interface Eligibility {
  min: number
  max: number
  tenureMonths: number
  interestPct: number
  emi: number
  repayTotal: number
  risk: 'Low' | 'Medium' | 'High'
  reason: string
  documents: string[]
}

function tone(s: FinanceStatus): 'slate' | 'blue' | 'amber' | 'green' | 'red' {
  if (s === 'Approved' || s === 'Disbursed') return 'green'
  if (s === 'Rejected') return 'red'
  if (s === 'Under Review') return 'amber'
  if (s === 'Draft') return 'slate'
  return 'blue'
}

export function Finance({
  db,
  update,
  expectedCropValue,
}: {
  db: DbShape
  update: (fn: (d: DbShape) => DbShape) => void
  expectedCropValue: number
}) {
  const [amount, setAmount] = useState(50_000)
  const [purpose, setPurpose] = useState<string>(PURPOSES[0])
  const [crop, setCrop] = useState<string>(CROPS[0])
  const [harvestDate, setHarvestDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [sellingDate, setSellingDate] = useState(() => new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10))
  const [checking, setChecking] = useState(false)
  const [elig, setElig] = useState<Eligibility | null>(null)
  const [tab, setTab] = useState<'apply' | 'history' | 'schedule'>('apply')
  const [error, setError] = useState<string | null>(null)
  const timers = useRef<number[]>([])

  const signals = useMemo(() => financeSignals(db.transactions, expectedCropValue), [db.transactions, expectedCropValue])
  const stats = txnStats(db.transactions)
  const latest = db.finance[0] ?? null

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  function checkEligibility() {
    if (!amount || amount < 5000) return setError('Enter an amount of ₹5,000 or more.')
    if (amount > 1_000_000) return setError('This demo assesses requests up to ₹10,00,000.')
    setError(null)
    setChecking(true)
    window.setTimeout(() => {
      const max = Math.max(10_000, Math.round(signals.cap / 1000) * 1000)
      const min = Math.max(5000, Math.round(max * 0.3))
      const risk: Eligibility['risk'] = signals.strength === 'Strong' && amount <= max ? 'Low' : amount <= max * 1.3 ? 'Medium' : 'High'
      const tenureMonths = amount > max ? 12 : amount > max * 0.6 ? 9 : 6
      const interestPct = risk === 'Low' ? 9.5 : risk === 'Medium' ? 12 : 15
      const principal = Math.min(amount, max)
      const repayTotal = Math.round(principal * (1 + (interestPct / 100) * (tenureMonths / 12)))
      setElig({
        min,
        max,
        tenureMonths,
        interestPct,
        emi: Math.round(repayTotal / tenureMonths),
        repayTotal,
        risk,
        reason:
          `${signals.strength} selling record: ${signals.total} recorded sales, ₹${fmt(signals.revenue)} lifetime net revenue, ` +
          `${Math.round(signals.repaymentRate * 100)}% of sales already settled, expected revenue from the standing crop ₹${fmt(expectedCropValue)}` +
          (signals.outstanding ? `, current outstanding receivable ₹${fmt(signals.outstanding)}` : '') + '.',
        documents: ['Aadhaar card', 'Khasra / Khatauni (land record)', 'Bank passbook first page', 'Latest mandi sale receipt', 'Passport-size photograph'],
      })
      setChecking(false)
    }, 700)
  }

  function apply() {
    if (!elig) return
    let created: FinancialApplication | null = null
    update((d) => {
      const res = addFinance(d, {
        amount: Math.min(amount, elig.max),
        purpose,
        crop,
        harvestDate,
        expectedSellingDate: sellingDate,
        status: 'Submitted',
        eligibleMin: elig.min,
        eligibleMax: elig.max,
        risk: elig.risk,
        reason: elig.reason,
        tenureMonths: elig.tenureMonths,
        interestPct: elig.interestPct,
        repayTotal: elig.repayTotal,
      })
      created = res.app
      return res.db
    })
    const app = created as FinancialApplication | null
    if (!app) return
    // Demo partner processing — statuses change over time and each change raises a notification.
    timers.current.push(window.setTimeout(() => update((d) => setFinanceStatus(d, app.id, 'Under Review')), 2500))
    timers.current.push(
      window.setTimeout(() => update((d) => setFinanceStatus(d, app.id, elig.risk === 'High' ? 'Rejected' : 'Approved')), 6000),
    )
  }

  const schedule = latest && latest.status !== 'Rejected'
    ? Array.from({ length: latest.tenureMonths }, (_, i) => ({
        no: i + 1,
        due: new Date(latest.createdAt + (i + 1) * 30 * 86_400_000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        amount: Math.round(latest.repayTotal / latest.tenureMonths),
      }))
    : []

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold text-slate-900">Financial Support / वित्तीय सहायता</h1>
        <p className="mt-1 text-slate-600">Check indicative eligibility from your own selling record and apply to a partner institution.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge tone="amber"><AlertTriangle size={12} className="mr-1" /> Demo / Financial Partner Integration</Badge>
          <Badge tone="slate">AgriSell is not a bank or lender</Badge>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {([['apply', 'Apply', Banknote], ['history', 'View financial history', History], ['schedule', 'View repayment schedule', CalendarClock]] as const).map(([k, label, Icon]) => (
          <button key={k} className={tab === k ? 'btn-big' : 'btn-big-outline'} onClick={() => setTab(k)} data-testid={`fin-tab-${k}`}>
            <Icon size={18} /> {label}
          </button>
        ))}
      </div>

      {tab === 'apply' && (
        <>
          <section className="card p-6">
            <h2 className="text-lg font-bold text-slate-900">Step 1 — What do you need?</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div>
                <label className="label-big" htmlFor="fin-amt">Required amount (₹)</label>
                <input id="fin-amt" type="number" className="input-big" value={amount} onChange={(e) => { setAmount(Number(e.target.value)); setElig(null) }} />
              </div>
              <div>
                <label className="label-big" htmlFor="fin-purpose">Purpose</label>
                <select id="fin-purpose" className="input-big" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                  {PURPOSES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="label-big" htmlFor="fin-crop">Crop</label>
                <select id="fin-crop" className="input-big" value={crop} onChange={(e) => setCrop(e.target.value)}>
                  {CROPS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label-big" htmlFor="fin-harv">Expected harvest date</label>
                <input id="fin-harv" type="date" className="input-big" value={harvestDate} onChange={(e) => setHarvestDate(e.target.value)} />
              </div>
              <div>
                <label className="label-big" htmlFor="fin-sell">Expected selling date</label>
                <input id="fin-sell" type="date" className="input-big" value={sellingDate} onChange={(e) => setSellingDate(e.target.value)} />
              </div>
              <div className="flex items-end">
                <button className="btn-big w-full" onClick={checkEligibility} disabled={checking} data-testid="check-eligibility">
                  {checking ? <><Loader2 size={18} className="animate-spin" /> Checking…</> : <><BadgeCheck size={18} /> Check eligibility</>}
                </button>
              </div>
            </div>
            {error && <p className="mt-3 text-sm font-semibold text-rose-600">{error}</p>}
          </section>

          <section className="card p-6">
            <h2 className="text-lg font-bold text-slate-900">Step 2 — Your record used for the assessment</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Previous transactions" value={String(stats.total)} hint={`${signals.strength.toLowerCase()} history`} />
              <Stat label="Average sale value" value={`₹${fmt(stats.total ? Math.round(stats.revenue / stats.total) : 0)}`} hint={`avg price ₹${fmt(stats.avgPrice)}/q`} />
              <Stat label="Settled sales" value={`${Math.round(signals.repaymentRate * 100)}%`} hint="payments already received" />
              <Stat label="Expected crop revenue" value={`₹${fmt(expectedCropValue)}`} hint={`outstanding ₹${fmt(signals.outstanding)}`} />
            </div>
          </section>

          {elig && (
            <section className="card p-6 fade-up" data-testid="eligibility-result">
              <h2 className="text-lg font-bold text-slate-900">Step 3 — Simulated eligibility</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Eligible amount" value={`₹${fmt(elig.min)} – ₹${fmt(elig.max)}`} accent="text-emerald-700" />
                <Stat label="Suggested repayment period" value={`${elig.tenureMonths} months`} hint={`indicative interest ${elig.interestPct}% p.a.`} />
                <Stat label="Estimated repayment" value={`₹${fmt(elig.repayTotal)}`} hint={`≈ ₹${fmt(elig.emi)} per month`} />
                <Stat label="Risk category" value={elig.risk} accent={elig.risk === 'Low' ? 'text-emerald-700' : elig.risk === 'Medium' ? 'text-amber-600' : 'text-rose-600'} />
              </div>
              <p className="mt-4 text-sm text-slate-700"><strong>Why:</strong> {elig.reason}</p>
              <div className="mt-4">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-700"><FileText size={16} /> Documents required</div>
                <ul className="mt-2 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
                  {elig.documents.map((d) => <li key={d}>• {d}</li>)}
                </ul>
              </div>
              <button className="btn-big mt-5" onClick={apply} data-testid="apply-now"><Banknote size={18} /> Apply now</button>
              <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">{DISCLAIMER}</p>
            </section>
          )}
        </>
      )}

      {tab === 'history' && (
        <section className="space-y-4">
          {db.finance.length === 0 && <p className="card p-6 text-slate-500">No applications yet.</p>}
          {db.finance.map((f) => (
            <article key={f.id} className="card p-5" data-testid="finance-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-bold text-slate-900">₹{fmt(f.amount)} · {f.purpose}</div>
                  <div className="text-sm text-slate-600">{f.crop} · harvest {f.harvestDate} · selling {f.expectedSellingDate}</div>
                  <div className="text-xs text-slate-500">Application {f.id} · {new Date(f.createdAt).toLocaleString('en-IN')}</div>
                </div>
                <Badge tone={tone(f.status)}>{f.status}</Badge>
              </div>
              <ol className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                {f.history.map((h) => (
                  <li key={`${h.status}-${h.at}`} className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                    {h.status} · {new Date(h.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-sm text-slate-600">{f.reason}</p>
              {f.status === 'Approved' && (
                <button className="btn-big mt-4" onClick={() => update((d) => setFinanceStatus(d, f.id, 'Disbursed'))} data-testid="mark-disbursed">
                  Mark as disbursed (demo)
                </button>
              )}
              <p className="mt-3 text-xs text-amber-700">{DISCLAIMER}</p>
            </article>
          ))}
        </section>
      )}

      {tab === 'schedule' && (
        <section className="card p-5">
          {!latest || schedule.length === 0 ? (
            <p className="text-slate-500">No active application — check eligibility and apply to see a repayment schedule.</p>
          ) : (
            <>
              <div className="mb-3 text-sm font-bold text-slate-700">
                Indicative repayment schedule for ₹{fmt(latest.amount)} over {latest.tenureMonths} months at {latest.interestPct}% p.a. (total ₹{fmt(latest.repayTotal)})
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr><th className="px-4 py-3">#</th><th className="px-4 py-3">Due date</th><th className="px-4 py-3">Instalment</th></tr>
                </thead>
                <tbody>
                  {schedule.map((s) => (
                    <tr key={s.no} className="border-t border-slate-100">
                      <td className="px-4 py-3">{s.no}</td><td className="px-4 py-3">{s.due}</td><td className="px-4 py-3 font-semibold">₹{fmt(s.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-amber-700">{DISCLAIMER}</p>
            </>
          )}
        </section>
      )}
    </div>
  )
}
