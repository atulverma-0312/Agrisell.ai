import { ArrowLeft, ArrowRight, Calculator, ClipboardList, Cpu, Database, Handshake, LayoutDashboard, MessageCircle, Puzzle, RotateCcw, ScanSearch, Sprout, Target, Trophy, Users } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChatBot } from './components/ChatBot'
import { IntegrationStep, ProcessingStep } from './components/DataSteps'
import { EconomicsStep, EngineStep, RankingStep } from './components/EngineSteps'
import { InputStep } from './components/InputStep'
import { Dashboard } from './components/Dashboard'
import { QualityGrading } from './components/QualityGrading'
import { Portal } from './components/portal/Portal'
import { addListing, loadDb, saveDb } from './lib/store'
import { CROPS } from './lib/data'
import { OutputStep, TransactionStep } from './components/OutputSteps'
import { buildOptions, buildRecommendation, integrateData, processData, rankOptions } from './lib/engine'
import type { FarmerConstraints, FarmerInput } from './lib/types'
import type { SharedAssessment } from './lib/grading'

const STAGES = [
  { key: 'input', label: 'Farmer Input & Constraints', icon: ClipboardList },
  { key: 'integrate', label: 'Data Integration', icon: Database },
  { key: 'process', label: 'Data Processing', icon: Puzzle },
  { key: 'engine', label: 'Optimization Engine', icon: Cpu, ai: true },
  { key: 'economics', label: 'Economic Calculation', icon: Calculator },
  { key: 'rank', label: 'Option Ranking', icon: Trophy, ai: true },
  { key: 'output', label: 'Personalized Output', icon: Target, ai: true },
  { key: 'transact', label: 'Buyer Connection', icon: Handshake },
  { key: 'dashboard', label: 'Market Dashboard', icon: LayoutDashboard, ai: true },
] as const
const DASHBOARD_STAGE = STAGES.length - 1

const DEFAULT_INPUT: FarmerInput = { crop: 'Wheat', quantityQuintal: 120, grade: 'A', location: 'Lucknow' }
const CHAT_HIDDEN_KEY = 'agrisell.chat_hidden'
const FEED_REFRESH_MS = 60_000 // poll upstream feeds every minute

const DEFAULT_CONSTRAINTS: FarmerConstraints = { sellingDeadlineDays: 14, storageCapacityQuintal: 60, budgetInr: 40000, transportLimitKm: 700 }

export default function App() {
  const [started, setStarted] = useState(false)
  const [stage, setStage] = useState(0)
  const [view, setView] = useState<'pipeline' | 'grading' | 'portal'>('pipeline')
  const [gradingReturn, setGradingReturn] = useState<'pipeline' | 'portal'>('pipeline')
  const [input, setInput] = useState(DEFAULT_INPUT)
  const [aiAssessment, setAiAssessment] = useState<SharedAssessment | null>(null)
  const [constraints, setConstraints] = useState(DEFAULT_CONSTRAINTS)
  const [chatHidden, setChatHiddenState] = useState(() => localStorage.getItem(CHAT_HIDDEN_KEY) === '1')
  const setChatHidden = (v: boolean) => {
    setChatHiddenState(v)
    localStorage.setItem(CHAT_HIDDEN_KEY, v ? '1' : '0')
  }

  const [feedVersion, setFeedVersion] = useState(0)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastSync, setLastSync] = useState(() => Date.now())
  const refreshFeed = useCallback(() => {
    setFeedVersion((v) => v + 1)
    setLastSync(Date.now())
  }, [])
  useEffect(() => {
    if (!autoRefresh) return
    const t = setInterval(refreshFeed, FEED_REFRESH_MS)
    return () => clearInterval(t)
  }, [autoRefresh, refreshFeed])
  const raw = useMemo(() => integrateData(feedVersion), [feedVersion])
  const report = useMemo(() => processData(raw, input.crop), [raw, input.crop])
  const options = useMemo(() => buildOptions(input, constraints, report.markets), [input, constraints, report])
  const ranked = useMemo(() => rankOptions(options), [options])
  const rec = useMemo(() => buildRecommendation(input, constraints, ranked), [input, constraints, ranked])

  const chat = <ChatBot ctx={{ input, constraints, rec }} hidden={chatHidden} onHide={() => setChatHidden(true)} />
  const chatToggle = (
    <button className="btn-secondary !py-1.5 text-xs" onClick={() => setChatHidden(!chatHidden)}>
      <MessageCircle size={14} /> {chatHidden ? 'Show AI assistant' : 'Hide AI assistant'}
    </button>
  )

  const openDashboard = () => { setStarted(true); setView('pipeline'); setStage(DASHBOARD_STAGE) }
  const openGrading = (from: 'pipeline' | 'portal' = 'pipeline') => { setStarted(true); setGradingReturn(from); setView('grading') }
  const openPortal = () => { setStarted(true); setView('portal') }
  const goStage = (i: number) => { setView('pipeline'); setStage(i) }
  const useGrade = (a: SharedAssessment) => {
    setAiAssessment(a)
    const crop = (CROPS as readonly string[]).includes(a.crop) ? a.crop : input.crop
    const quantityQuintal = Math.max(1, Math.round(a.quantityKg / 100))
    setInput({ ...input, crop, grade: a.predictedGrade, quantityQuintal })
    if (gradingReturn === 'portal') {
      // Photo grade becomes a graded crop lot in the farmer portal.
      saveDb(
        addListing(loadDb(), {
          crop,
          variety: a.variety ?? '',
          quantityQuintal,
          grade: a.predictedGrade,
          qualitySource: 'ai-photo',
          qualityScore: a.qualityScore,
          qualityConfidence: a.confidence,
          district: input.location,
          harvestDate: new Date().toISOString().slice(0, 10),
        }).db,
      )
      setView('portal')
      return
    }
    goStage(0)
  }
  if (!started)
    return (
      <>
        <Landing onStart={() => setStarted(true)} onDashboard={openDashboard} onGrading={() => openGrading('pipeline')} onPortal={openPortal} chatToggle={chatToggle} />
        {chat}
      </>
    )

  if (view === 'portal')
    return (
      <>
        {chat}
        <Portal
          markets={report.markets}
          lastSync={lastSync}
          onRefreshFeed={refreshFeed}
          onExit={() => setView('pipeline')}
          onOpenGrading={() => openGrading('portal')}
          onOpenMarketDashboard={openDashboard}
          crop={input.crop}
          district={input.location}
          onCrop={(c) => setInput((i) => ({ ...i, crop: c }))}
          onDistrict={(d) => setInput((i) => ({ ...i, location: d }))}
          chatToggle={chatToggle}
        />
      </>
    )

  return (
    <div className="min-h-screen">
      {chat}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <button className="flex items-center gap-2 font-bold text-emerald-700" onClick={() => setStarted(false)}>
            <Sprout size={22} /> AgriSell AI
          </button>
          <div className="flex items-center gap-2">
            {chatToggle}
            <button className="btn-secondary !py-1.5 text-xs" onClick={openPortal}>
              <Users size={14} /> Farmer Dashboard
            </button>
            {view !== 'grading' && (
              <button className="btn-secondary !py-1.5 text-xs" onClick={() => openGrading('pipeline')}>
                <ScanSearch size={14} /> AI Quality Grading
              </button>
            )}
            {(stage !== DASHBOARD_STAGE || view === 'grading') && (
              <button className="btn-secondary !py-1.5 text-xs" onClick={openDashboard}>
                <LayoutDashboard size={14} /> Market Dashboard
              </button>
            )}
            <button className="btn-secondary !py-1.5 text-xs" onClick={() => { goStage(0); setInput(DEFAULT_INPUT); setConstraints(DEFAULT_CONSTRAINTS) }}>
              <RotateCcw size={14} /> Reset
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[260px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <ol className="flex gap-2 overflow-x-auto lg:flex-col">
            {STAGES.map((s, i) => (
              <li key={s.key}>
                <button
                  onClick={() => (i <= stage || i === DASHBOARD_STAGE) && goStage(i)}
                  className={`flex w-full items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-sm transition ${
                    i === stage && view === 'pipeline' ? 'bg-emerald-600 text-white shadow' : i < stage || i === DASHBOARD_STAGE ? 'bg-white text-slate-700 hover:bg-slate-100' : 'text-slate-400'
                  }`}
                  disabled={i > stage && i !== DASHBOARD_STAGE}
                >
                  <s.icon size={18} />
                  <span className="flex-1">{s.label}</span>
                  {'ai' in s && s.ai && <span className={`rounded px-1.5 text-[10px] font-bold ${i === stage ? 'bg-white/20' : 'bg-violet-100 text-violet-700'}`}>AI</span>}
                </button>
              </li>
            ))}
          </ol>
          <div className="mt-3 border-t border-slate-200 pt-3">
            <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Tools</div>
            <button
              onClick={() => openGrading('pipeline')}
              className={`flex w-full items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-sm transition ${
                view === 'grading' ? 'bg-sky-600 text-white shadow' : 'bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              <ScanSearch size={18} />
              <span className="flex-1">AI Quality Grading</span>
              <span className={`rounded px-1.5 text-[10px] font-bold ${view === 'grading' ? 'bg-white/20' : 'bg-violet-100 text-violet-700'}`}>AI</span>
            </button>
          </div>
        </aside>

        <main className="min-w-0">
          {view === 'grading' ? (
            <div className="mb-20">
              <QualityGrading
                step={0}
                markets={report.markets}
                defaultLocation={input.location}
                onUseGrade={useGrade}
                onCompareMarkets={() => (gradingReturn === 'portal' ? setView('portal') : goStage(6))}
              />
            </div>
          ) : (
          <>
          <div key={stage}>
            {stage === 0 && <InputStep input={input} constraints={constraints} onInput={setInput} onConstraints={setConstraints} onGradeFromPhoto={openGrading} aiAssessment={aiAssessment} onClearAssessment={() => setAiAssessment(null)} />}
            {stage === 1 && <IntegrationStep raw={raw} feedVersion={feedVersion} lastSync={lastSync} autoRefresh={autoRefresh} onToggleAuto={() => setAutoRefresh((a) => !a)} onRefresh={refreshFeed} />}
            {stage === 2 && <ProcessingStep report={report} />}
            {stage === 3 && <EngineStep input={input} options={options} />}
            {stage === 4 && <EconomicsStep options={options} />}
            {stage === 5 && <RankingStep ranked={ranked} />}
            {stage === 6 && <OutputStep input={input} constraints={constraints} rec={rec} />}
            {stage === 7 && <TransactionStep input={input} rec={rec} />}
            {stage === 8 && (
              <Dashboard
                input={input}
                constraints={constraints}
                markets={report.markets}
                rec={rec}
                onUseDistrict={(d) => { setInput({ ...input, location: d }); setStage(6) }}
              />
            )}
          </div>

          <div className="mt-6 mb-20 flex items-center justify-between">
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
          </>
          )}
        </main>
      </div>
    </div>
  )
}

function Landing({ onStart, onDashboard, onGrading, onPortal, chatToggle }: { onStart: () => void; onDashboard: () => void; onGrading: () => void; onPortal: () => void; chatToggle: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2 text-xl font-bold text-emerald-700"><Sprout size={26} /> AgriSell AI</div>
        <nav className="hidden gap-6 text-sm font-medium text-slate-600 md:flex">
          <a href="#how">How it works</a>
          <a href="#grading">AI Quality Grading</a>
          <a href="#ai">AI models</a>
          <a href="#sources">Data sources</a>
          <a href="#chat">AI assistant</a>
        </nav>
        <div className="flex items-center gap-2">
          {chatToggle}
          <button className="btn-secondary" onClick={onDashboard}><LayoutDashboard size={16} /> Market Dashboard</button>
          <button className="btn-primary" onClick={onPortal}><Users size={16} /> Farmer Dashboard</button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-16 text-center">
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Farmer-specific market optimization · Uttar Pradesh</span>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 md:text-6xl">
          Know <span className="text-emerald-600">where</span>, to <span className="text-emerald-600">whom</span> and <span className="text-emerald-600">when</span> to sell your harvest
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
          AgriSell AI integrates Uttar Pradesh e-NAM, mandi, buyer and logistics data across all 75 districts, runs AI price & demand models against your own constraints, and hands you a ranked, explained recommendation with net-return estimates.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button className="btn-primary !px-7 !py-3 !text-base" onClick={onPortal}><Users size={18} /> Open Farmer Dashboard</button>
          <button className="btn-secondary !px-7 !py-3 !text-base" onClick={onStart}>Start free analysis <ArrowRight size={18} /></button>
          <button className="btn-secondary !px-7 !py-3 !text-base" onClick={onDashboard}><LayoutDashboard size={18} /> Open Market Dashboard</button>
          <button className="btn-secondary !px-7 !py-3 !text-base" onClick={onGrading}><ScanSearch size={18} /> AI Quality Grading</button>
        </div>
        <div className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
          {[['12', 'UP markets & buyers compared'], ['75', 'UP districts covered'], ['4', 'AI models per option'], ['6 mo', 'price history analysed']].map(([v, l]) => (
            <div key={l} className="card p-4"><div className="text-3xl font-extrabold text-emerald-700">{v}</div><div className="text-xs text-slate-500">{l}</div></div>
          ))}
        </div>
      </section>

      <section id="how" className="mx-auto max-w-7xl px-4 py-12">
        <h2 className="text-center text-3xl font-bold">How it works</h2>
        <p className="mt-2 text-center text-slate-500">Every stage of the pipeline is visible and explainable.</p>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

      <section id="grading" className="mx-auto max-w-7xl px-4 py-6">
        <div className="card flex flex-col items-center gap-6 border-sky-200 bg-gradient-to-r from-sky-50 to-white p-8 md:flex-row">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-sky-600 text-white"><ScanSearch size={32} /></div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold">AI Quality Grading <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700">AI-Assisted • Preliminary</span></h2>
            <p className="mt-1 text-slate-600">Upload a produce photo → get a preliminary visual quality assessment: grade (A/B/C), quality score, confidence, detected visible issues and why the AI decided so. Use the grade directly in your selling strategy. Not an official APMC/e-NAM certification.</p>
          </div>
          <button className="btn-primary !bg-sky-600 hover:!bg-sky-700" onClick={onGrading}>Analyze Produce <ArrowRight size={16} /></button>
        </div>
      </section>

      <section id="ai" className="bg-slate-900 py-14 text-white">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-center text-3xl font-bold">Where AI is used</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-5">
            {[
              ['Price prediction', 'Ensemble of linear trend regression and Holt exponential smoothing forecasts prices up to your deadline and picks the best selling day.'],
              ['Demand forecasting', 'Buyer appetite and saturation modelling estimate how much of your lot each market can absorb without depressing price.'],
              ['Multi-criteria ranking', 'A utility score blends net return, market suitability, demand and volatility risk to rank options and compute confidence.'],
              ['Explainable advice', 'Recommendation reasons are generated automatically, with optional LLM rewriting in Hindi, Urdu, Awadhi and Bhojpuri.'],
              ['Photo quality grading', 'Replaceable vision-model service estimates visual grade, score and confidence from produce photos, with explainable factors.'],
            ].map(([t, d]) => (
              <div key={t} className="rounded-xl border border-slate-700 bg-slate-800 p-5"><div className="font-semibold text-emerald-300">{t}</div><p className="mt-2 text-sm text-slate-300">{d}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section id="chat" className="mx-auto max-w-7xl px-4 py-14">
        <div className="card flex flex-col items-center gap-6 bg-gradient-to-r from-violet-50 to-white p-8 md:flex-row">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white"><MessageCircle size={32} /></div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold">Talk to the AI assistant anytime</h2>
            <p className="mt-1 text-slate-600">Ask in your own words — “When should I sell my onions?”, “What is e-NAM?”, “How do I negotiate?”. The assistant knows your live recommendation and Indian agri-market basics (MSP, FPOs, grading, storage, payments). Use the <b>Ask AI</b> button at the bottom-right of every page — you can hide or restore it anytime from the header.</p>
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
  'Live pull from e-NAM/AGMARKNET, mandis, buyer demand, 6-month price history, logistics and storage — auto-refreshed, and every downstream model re-runs on each update.',
  'Cleaning, validation and normalization of the raw feeds into one consistent dataset.',
  'Price model, demand analysis, logistics cost engine and market/buyer matching.',
  'Revenue − transport − storage − other costs = estimated net return per option.',
  'AI utility score ranks every feasible option: best, second and third.',
  'Best market, buyer, selling time, price, net return, reason and confidence.',
  'Connect, negotiate, secure, arrange logistics and get paid.',
  '6-month price dashboard: profit & loss, how prices can rise, and a clickable UP district map with direct results.',
]
