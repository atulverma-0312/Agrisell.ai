import { ArrowLeft, ArrowRight, Calculator, ClipboardList, Cpu, Database, Handshake, Puzzle, RotateCcw, Sprout, Target, Trophy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { IntegrationStep, ProcessingStep } from './components/DataSteps'
import { EconomicsStep, EngineStep, RankingStep } from './components/EngineSteps'
import { InputStep } from './components/InputStep'
import { OutputStep, TransactionStep } from './components/OutputSteps'
import { buildOptions, buildRecommendation, integrateData, processData, rankOptions } from './lib/engine'
import type { FarmerConstraints, FarmerInput } from './lib/types'

const STAGES = [
  { key: 'input', label: 'Farmer Input & Constraints', icon: ClipboardList },
  { key: 'integrate', label: 'Data Integration', icon: Database },
  { key: 'process', label: 'Data Processing', icon: Puzzle },
  { key: 'engine', label: 'Optimization Engine', icon: Cpu, ai: true },
  { key: 'economics', label: 'Economic Calculation', icon: Calculator },
  { key: 'rank', label: 'Option Ranking', icon: Trophy, ai: true },
  { key: 'output', label: 'Personalized Output', icon: Target, ai: true },
  { key: 'transact', label: 'Buyer Connection', icon: Handshake },
] as const

const DEFAULT_INPUT: FarmerInput = { crop: 'Onion', quantityQuintal: 120, grade: 'A', location: 'Nashik' }
const DEFAULT_CONSTRAINTS: FarmerConstraints = { sellingDeadlineDays: 14, storageCapacityQuintal: 60, budgetInr: 40000, transportLimitKm: 700 }

export default function App() {
  const [started, setStarted] = useState(false)
  const [stage, setStage] = useState(0)
  const [input, setInput] = useState(DEFAULT_INPUT)
  const [constraints, setConstraints] = useState(DEFAULT_CONSTRAINTS)

  const raw = useMemo(() => integrateData(), [])
  const report = useMemo(() => processData(raw, input.crop), [raw, input.crop])
  const options = useMemo(() => buildOptions(input, constraints, report.markets), [input, constraints, report])
  const ranked = useMemo(() => rankOptions(options), [options])
  const rec = useMemo(() => buildRecommendation(input, constraints, ranked), [input, constraints, ranked])

  if (!started) return <Landing onStart={() => setStarted(true)} />

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <button className="flex items-center gap-2 font-bold text-emerald-700" onClick={() => setStarted(false)}>
            <Sprout size={22} /> AgriSell AI
          </button>
          <button className="btn-secondary !py-1.5 text-xs" onClick={() => { setStage(0); setInput(DEFAULT_INPUT); setConstraints(DEFAULT_CONSTRAINTS) }}>
            <RotateCcw size={14} /> Reset
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[260px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <ol className="flex gap-2 overflow-x-auto lg:flex-col">
            {STAGES.map((s, i) => (
              <li key={s.key}>
                <button
                  onClick={() => i <= stage && setStage(i)}
                  className={`flex w-full items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-sm transition ${
                    i === stage ? 'bg-emerald-600 text-white shadow' : i < stage ? 'bg-white text-slate-700 hover:bg-slate-100' : 'text-slate-400'
                  }`}
                  disabled={i > stage}
                >
                  <s.icon size={18} />
                  <span className="flex-1">{s.label}</span>
                  {'ai' in s && s.ai && <span className={`rounded px-1.5 text-[10px] font-bold ${i === stage ? 'bg-white/20' : 'bg-violet-100 text-violet-700'}`}>AI</span>}
                </button>
              </li>
            ))}
          </ol>
        </aside>

        <main className="min-w-0">
          <div key={stage}>
            {stage === 0 && <InputStep input={input} constraints={constraints} onInput={setInput} onConstraints={setConstraints} />}
            {stage === 1 && <IntegrationStep raw={raw} />}
            {stage === 2 && <ProcessingStep report={report} />}
            {stage === 3 && <EngineStep input={input} options={options} />}
            {stage === 4 && <EconomicsStep options={options} />}
            {stage === 5 && <RankingStep ranked={ranked} />}
            {stage === 6 && <OutputStep input={input} constraints={constraints} rec={rec} />}
            {stage === 7 && <TransactionStep input={input} rec={rec} />}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <button className="btn-secondary" onClick={() => setStage((s) => Math.max(0, s - 1))} disabled={stage === 0}>
              <ArrowLeft size={16} /> Back
            </button>
            <span className="text-sm text-slate-500">Stage {stage + 1} of {STAGES.length}</span>
            {stage < STAGES.length - 1 ? (
              <button className="btn-primary" onClick={() => setStage((s) => s + 1)}>
                {stage === 0 ? 'Run analysis' : 'Next'} <ArrowRight size={16} />
              </button>
            ) : (
              <button className="btn-primary" onClick={() => setStage(0)}>Start new sale</button>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

function Landing({ onStart }: { onStart: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2 text-xl font-bold text-emerald-700"><Sprout size={26} /> AgriSell AI</div>
        <nav className="hidden gap-6 text-sm font-medium text-slate-600 md:flex">
          <a href="#how">How it works</a>
          <a href="#ai">AI models</a>
          <a href="#sources">Data sources</a>
        </nav>
        <button className="btn-primary" onClick={onStart}>Get recommendation</button>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-16 text-center">
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Farmer-specific market optimization</span>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 md:text-6xl">
          Know <span className="text-emerald-600">where</span>, to <span className="text-emerald-600">whom</span> and <span className="text-emerald-600">when</span> to sell your harvest
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
          AgriSell AI integrates e-NAM, mandi, buyer and logistics data, runs AI price & demand models against your own constraints, and hands you a ranked, explained recommendation with net-return estimates.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <button className="btn-primary !px-7 !py-3 !text-base" onClick={onStart}>Start free analysis <ArrowRight size={18} /></button>
          <a href="#how" className="btn-secondary !px-7 !py-3 !text-base">See the pipeline</a>
        </div>
        <div className="mx-auto mt-12 grid max-w-3xl grid-cols-3 gap-4">
          {[['8', 'markets & buyers compared'], ['4', 'AI models per option'], ['30 d', 'price history analysed']].map(([v, l]) => (
            <div key={l} className="card p-4"><div className="text-3xl font-extrabold text-emerald-700">{v}</div><div className="text-xs text-slate-500">{l}</div></div>
          ))}
        </div>
      </section>

      <section id="how" className="mx-auto max-w-7xl px-4 py-12">
        <h2 className="text-center text-3xl font-bold">How it works</h2>
        <p className="mt-2 text-center text-slate-500">Every stage of the pipeline is visible and explainable.</p>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STAGES.map((s, i) => (
            <li key={s.key} className="card relative p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white"><s.icon size={20} /></div>
                <div className="text-xs font-semibold uppercase text-slate-400">Step {i + 1}</div>
                {'ai' in s && s.ai && <span className="ml-auto rounded bg-violet-100 px-1.5 text-[10px] font-bold text-violet-700">AI</span>}
              </div>
              <div className="mt-3 font-semibold">{s.label}</div>
              <p className="mt-1 text-sm text-slate-500">{DESCRIPTIONS[i]}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="ai" className="bg-slate-900 py-14 text-white">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-center text-3xl font-bold">Where AI is used</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {[
              ['Price prediction', 'Ensemble of linear trend regression and Holt exponential smoothing forecasts prices up to your deadline and picks the best selling day.'],
              ['Demand forecasting', 'Buyer appetite and saturation modelling estimate how much of your lot each market can absorb without depressing price.'],
              ['Multi-criteria ranking', 'A utility score blends net return, market suitability, demand and volatility risk to rank options and compute confidence.'],
              ['Explainable advice', 'Recommendation reasons are generated automatically, with optional LLM rewriting in Hindi, Marathi and other languages.'],
            ].map(([t, d]) => (
              <div key={t} className="rounded-xl border border-slate-700 bg-slate-800 p-5"><div className="font-semibold text-emerald-300">{t}</div><p className="mt-2 text-sm text-slate-300">{d}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section id="sources" className="mx-auto max-w-7xl px-4 py-14 text-center">
        <h2 className="text-3xl font-bold">Integrated data sources</h2>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {['e-NAM', 'AGMARKNET', 'APMC Mandis', 'Buyer & FPO demand', 'Historical prices', 'Logistics rates', 'Warehouse storage'].map((s) => (
            <span key={s} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium shadow-sm">{s}</span>
          ))}
        </div>
        <button className="btn-primary mt-10 !px-7 !py-3 !text-base" onClick={onStart}>Get my recommendation <ArrowRight size={18} /></button>
      </section>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">© {new Date().getFullYear()} AgriSell AI · Demo uses simulated market feeds</footer>
    </div>
  )
}

const DESCRIPTIONS = [
  'Crop, quantity, grade, location plus deadline, storage, budget and transport limits.',
  'Live pull from e-NAM/AGMARKNET, mandis, buyer demand, price history, logistics and storage.',
  'Cleaning, validation and normalization of the raw feeds into one consistent dataset.',
  'Price model, demand analysis, logistics cost engine and market/buyer matching.',
  'Revenue − transport − storage − other costs = estimated net return per option.',
  'AI utility score ranks every feasible option: best, second and third.',
  'Best market, buyer, selling time, price, net return, reason and confidence.',
  'Connect, negotiate, secure, arrange logistics and get paid.',
]
