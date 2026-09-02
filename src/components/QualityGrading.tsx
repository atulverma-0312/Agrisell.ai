import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  CircleAlert,
  Download,
  ImagePlus,
  Info,
  Loader2,
  RefreshCw,
  ScanSearch,
  Upload,
  WifiOff,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import {
  ANALYSIS_STEPS,
  GRADING_CROPS,
  MAX_IMAGES,
  VALIDATION_CHECKS,
  aiMode,
  clearDraft,
  confidenceBand,
  errorKind,
  friendlyError,
  loadDraft,
  loadHistory,
  makeThumbnail,
  pickService,
  readAsDataUrl,
  saveDraft,
  saveHistory,
  toShared,
  validateImageStaged,
} from '../lib/grading'
import type { Assessment, CheckState, Draft, GradingErrorKind, GradingResult, ImageCheck, SharedAssessment, ValidationCheck } from '../lib/grading'
import { fmt } from '../lib/engine'
import type { CleanMarket, Grade } from '../lib/types'
import { LOCATIONS } from '../lib/data'
import { Badge, StepHeader } from './ui'

const KEY_STORAGE = 'agrisell.openai_key'
const DISCLAIMER =
  'Important: AI grading is based on visible characteristics in the uploaded photograph. It cannot reliably determine all physical, chemical, nutritional, or safety parameters. The result is a preliminary decision-support estimate and should not replace official grading, laboratory testing, or applicable regulatory standards.'

type Lang = 'en' | 'hi'
const T: Record<string, Record<Lang, string>> = {
  title: { en: 'AI Quality Grading', hi: 'AI गुणवत्ता ग्रेडिंग' },
  subtitle: { en: 'Upload a photo of your produce and get an AI-assisted preliminary quality assessment.', hi: 'अपनी उपज की फोटो अपलोड करें और AI आधारित प्रारंभिक गुणवत्ता आकलन पाएं।' },
  badge: { en: 'AI-Assisted • Preliminary Assessment', hi: 'AI आधारित • प्रारंभिक गुणवत्ता आकलन' },
  s1: { en: 'Produce', hi: 'उपज' },
  s2: { en: 'Photo', hi: 'फोटो' },
  s3: { en: 'Validation', hi: 'जांच' },
  s4: { en: 'AI Analysis', hi: 'AI विश्लेषण' },
  s5: { en: 'Grade', hi: 'ग्रेड' },
  s6: { en: 'Selling Insight', hi: 'बिक्री सलाह' },
  step1: { en: 'Step 1 — Select Produce', hi: 'चरण 1 — उपज चुनें' },
  whatProduce: { en: 'What produce do you want to grade?', hi: 'आप किस उपज की ग्रेडिंग करना चाहते हैं?' },
  none: { en: 'None', hi: 'कोई नहीं' },
  selectedCrop: { en: 'Selected Crop', hi: 'चुनी गई उपज' },
  produceSelected: { en: 'Produce Selected', hi: 'उपज चुनी गई' },
  continue: { en: 'Continue', hi: 'आगे बढ़ें' },
  variety: { en: 'Variety (Optional)', hi: 'किस्म (वैकल्पिक)' },
  location: { en: 'Location / Mandi (Optional)', hi: 'स्थान / मंडी (वैकल्पिक)' },
  harvest: { en: 'Harvest Date (Optional)', hi: 'कटाई की तारीख (वैकल्पिक)' },
  step2: { en: 'Step 2 — Upload Produce Photo', hi: 'चरण 2 — उपज की फोटो अपलोड करें' },
  uploadHint: { en: 'Take a clear photo in good lighting with the produce clearly visible.', hi: 'अच्छी रोशनी में साफ फोटो लें जिसमें उपज स्पष्ट दिखे।' },
  takePhoto: { en: 'Take Photo', hi: 'फोटो लें' },
  uploadImage: { en: 'Upload Photo', hi: 'फोटो अपलोड करें' },
  uploadMultiple: { en: 'Upload Multiple Photos', hi: 'कई फोटो अपलोड करें' },
  uploading: { en: 'Uploading image...', hi: 'फोटो अपलोड हो रही है...' },
  uploaded: { en: 'Image uploaded successfully', hi: 'फोटो सफलतापूर्वक अपलोड हुई' },
  checking: { en: 'Checking image quality...', hi: 'फोटो की गुणवत्ता जांची जा रही है...' },
  suitable: { en: 'Image is suitable for analysis', hi: 'फोटो विश्लेषण के लिए उपयुक्त है' },
  tooLow: { en: 'Image quality is too low for reliable analysis.', hi: 'विश्वसनीय विश्लेषण के लिए फोटो की गुणवत्ता बहुत कम है।' },
  uploadAnother: { en: 'Upload Another Photo', hi: 'दूसरी फोटो अपलोड करें' },
  replace: { en: 'Replace', hi: 'बदलें' },
  remove: { en: 'Remove', hi: 'हटाएं' },
  startAnalysis: { en: 'Start AI Analysis', hi: 'AI विश्लेषण शुरू करें' },
  analyzing: { en: 'Analyzing...', hi: 'विश्लेषण हो रहा है...' },
  analysisComplete: { en: 'Analysis Complete', hi: 'विश्लेषण पूरा' },
  tryAgain: { en: 'Try Again', hi: 'फिर कोशिश करें' },
  progressTitle: { en: 'AI Analysis Progress', hi: 'AI विश्लेषण प्रगति' },
  predicted: { en: 'Predicted Grade', hi: 'अनुमानित ग्रेड' },
  score: { en: 'Visual Quality Score', hi: 'दृश्य गुणवत्ता स्कोर' },
  confidence: { en: 'Confidence', hi: 'विश्वास स्तर' },
  breakdown: { en: 'Quality Breakdown', hi: 'गुणवत्ता विवरण' },
  issues: { en: 'Detected Visible Issues', hi: 'पाई गई दिखने वाली समस्याएँ' },
  why: { en: 'Why this grade?', hi: 'यह ग्रेड क्यों?' },
  history: { en: 'Assessment History', hi: 'आकलन इतिहास' },
  step6: { en: 'Step 6 — Selling Insight', hi: 'चरण 6 — बिक्री सलाह' },
  completed: { en: 'Quality assessment completed', hi: 'गुणवत्ता आकलन पूरा हुआ' },
  howMuch: { en: 'How much produce do you want to sell?', hi: 'आप कितनी उपज बेचना चाहते हैं?' },
  useResult: { en: 'Use This Result in Selling Strategy Simulator', hi: 'यह परिणाम बिक्री रणनीति में उपयोग करें' },
  lowConf: { en: 'Low Confidence', hi: 'कम विश्वास स्तर' },
  uploadMore: { en: 'Upload More Photos', hi: 'और फोटो अपलोड करें' },
  back: { en: 'Back', hi: 'पीछे' },
}

const PARAM_LABEL: Record<string, string> = {
  appearance: 'Appearance',
  color_uniformity: 'Color Uniformity',
  surface_condition: 'Surface Condition',
  visible_defects: 'Visible Defects',
  uniformity: 'Uniformity',
}

type Phase = 'idle' | 'uploading' | 'uploaded' | 'validating' | 'validation_failed' | 'ready' | 'analyzing' | 'success' | 'low_confidence' | 'error'
type ImgStatus = 'uploading' | 'validating' | 'valid' | 'invalid'

interface Img {
  id: string
  name: string
  url: string
  status: ImgStatus
  progress: number
  checks: Record<ValidationCheck, CheckState>
  check?: ImageCheck
}

type StepState = 'pending' | 'current' | 'done' | 'error'
type Confirm = { kind: 'crop'; next: string } | { kind: 'back'; to: 1 | 2 } | null

const emptyChecks = (): Record<ValidationCheck, CheckState> =>
  Object.fromEntries(VALIDATION_CHECKS.map((c) => [c, 'pending'])) as Record<ValidationCheck, CheckState>

const MAX_QTY_KG = 1_000_000

export function QualityGrading({
  step,
  markets,
  defaultLocation,
  onUseGrade,
  onCompareMarkets,
}: {
  step: number
  markets: CleanMarket[]
  defaultLocation: string
  onUseGrade: (a: SharedAssessment) => void
  onCompareMarkets: () => void
}) {
  const [lang, setLang] = useState<Lang>('en')
  const t = (k: string) => T[k][lang]

  const [draft] = useState<Draft | null>(() => loadDraft())
  const [showResume, setShowResume] = useState(() => loadDraft() !== null)
  const [crop, setCrop] = useState('')
  const [cropConfirmed, setCropConfirmed] = useState(false)
  const [variety, setVariety] = useState('')
  const [location, setLocation] = useState(defaultLocation)
  const [harvest, setHarvest] = useState('')
  const [images, setImages] = useState<Img[]>([])
  const [analysis, setAnalysis] = useState<'idle' | 'analyzing' | 'success' | 'low_confidence' | 'error'>('idle')
  const [analysisStep, setAnalysisStep] = useState(-1)
  const [error, setError] = useState<{ kind: GradingErrorKind; text: string } | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [result, setResult] = useState<Assessment | null>(null)
  const [history, setHistory] = useState<Assessment[]>(() => loadHistory())
  const [viewing, setViewing] = useState<Assessment | null>(null)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [online, setOnline] = useState(() => navigator.onLine)
  const [qtyText, setQtyText] = useState('1000')
  const [unit, setUnit] = useState<'kg' | 'quintal'>('kg')
  const fileRef = useRef<HTMLInputElement>(null)
  const camRef = useRef<HTMLInputElement>(null)
  const replaceRef = useRef<string | null>(null)
  const inFlight = useRef(false)
  const apiKey = localStorage.getItem(KEY_STORAGE) ?? import.meta.env.VITE_OPENAI_API_KEY ?? ''
  const service = useMemo(() => pickService(apiKey), [apiKey])
  const mode = aiMode()

  useEffect(() => saveHistory(history), [history])
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  useEffect(() => {
    if (cropConfirmed && !result) saveDraft({ crop, variety, location, harvest })
  }, [cropConfirmed, crop, variety, location, harvest, result])

  /* ---------- derived phase / stepper ---------- */
  const phase: Phase =
    analysis !== 'idle'
      ? analysis
      : images.length === 0
        ? 'idle'
        : images.some((i) => i.status === 'uploading')
          ? 'uploading'
          : images.some((i) => i.status === 'validating')
            ? 'validating'
            : images.some((i) => i.status === 'invalid')
              ? 'validation_failed'
              : 'ready'

  const hasResult = result !== null
  const stepStates: StepState[] = useMemo(() => {
    const s: StepState[] = ['pending', 'pending', 'pending', 'pending', 'pending', 'pending']
    if (!cropConfirmed) {
      s[0] = 'current'
      return s
    }
    s[0] = 'done'
    if (images.length === 0) {
      s[1] = 'current'
      return s
    }
    if (phase === 'uploading') {
      s[1] = 'current'
      return s
    }
    s[1] = 'done'
    if (phase === 'validating') {
      s[2] = 'current'
      return s
    }
    if (phase === 'validation_failed') {
      s[2] = 'error'
      return s
    }
    s[2] = 'done'
    if (phase === 'ready') {
      s[3] = 'current'
      return s
    }
    if (phase === 'analyzing') {
      s[3] = 'current'
      return s
    }
    if (phase === 'error') {
      s[3] = 'error'
      return s
    }
    s[3] = 'done'
    s[4] = 'done'
    s[5] = 'current'
    return s
  }, [cropConfirmed, images.length, phase])

  /* ---------- actions ---------- */
  function resetAnalysis() {
    setResult(null)
    setError(null)
    setAnalysisStep(-1)
    setAnalysis('idle')
  }

  function applyCrop(next: string) {
    setCrop(next)
    if (hasResult) {
      setImages([])
      setResult(null)
      setError(null)
      setAnalysisStep(-1)
      setAnalysis('idle')
    }
  }
  function requestCropChange(next: string) {
    if (hasResult && next !== crop) setConfirm({ kind: 'crop', next })
    else applyCrop(next)
  }

  function updateImg(id: string, patch: Partial<Img> | ((i: Img) => Partial<Img>)) {
    setImages((prev) => prev.map((i) => (i.id === id ? { ...i, ...(typeof patch === 'function' ? patch(i) : patch) } : i)))
  }

  async function addFiles(files: FileList | File[]) {
    setUploadError(null)
    if (hasResult || phase === 'error') resetAnalysis()
    const replacingId = replaceRef.current
    replaceRef.current = null
    const list = Array.from(files)
    const room = replacingId ? 1 : MAX_IMAGES - images.length
    if (list.length > room) setUploadError(`You can upload up to ${MAX_IMAGES} images. Only the first ${room} were added.`)
    for (const f of list.slice(0, Math.max(0, room))) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const entry: Img = { id, name: f.name, url: '', status: 'uploading', progress: 0, checks: emptyChecks() }
      setImages((prev) => (replacingId ? prev.map((i) => (i.id === replacingId ? entry : i)) : [...prev, entry]))
      let url: string
      try {
        url = await readAsDataUrl(f, (p) => updateImg(id, { progress: p }))
      } catch {
        updateImg(id, { status: 'invalid', progress: 1, check: { ok: false, problems: ['This file could not be read.'], brightness: 0, sharpness: 0, coverage: 0 } })
        continue
      }
      updateImg(id, { url, progress: 1, status: 'validating' })
      const check = await validateImageStaged(f, url, (c, s) => updateImg(id, (i) => ({ checks: { ...i.checks, [c]: s } })))
      updateImg(id, { check, status: check.ok ? 'valid' : 'invalid' })
    }
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) void addFiles(e.target.files)
    e.target.value = ''
  }
  function onDrop(e: DragEvent) {
    e.preventDefault()
    if (cropConfirmed) void addFiles(e.dataTransfer.files)
  }
  function removeImage(id: string) {
    setImages((prev) => prev.filter((i) => i.id !== id))
    if (hasResult || phase === 'error') resetAnalysis()
  }
  function replaceImage(id: string) {
    replaceRef.current = id
    fileRef.current?.click()
  }
  function removeInvalid() {
    setImages((prev) => prev.filter((i) => i.status !== 'invalid'))
  }

  async function analyze() {
    if (inFlight.current || phase !== 'ready') return
    inFlight.current = true
    setError(null)
    setViewing(null)
    setAnalysis('analyzing')
    setAnalysisStep(0)
    try {
      const r: GradingResult = await service.analyze(
        { crop, variety: variety || undefined, location: location || undefined, harvestDate: harvest || undefined, images: images.map((i) => i.url) },
        (s) => setAnalysisStep(s),
      )
      const a: Assessment = {
        ...r,
        id: `${Date.now()}`,
        createdAt: Date.now(),
        variety: variety || undefined,
        location: location || undefined,
        thumbnail: await makeThumbnail(images[0].url),
        imageCount: images.length,
      }
      setResult(a)
      setHistory((h) => [a, ...h])
      clearDraft()
      setAnalysis(confidenceBand(a.confidence) === 'low' ? 'low_confidence' : 'success')
    } catch (e) {
      console.error('[grading] analysis failed', e)
      setError({ kind: errorKind(e), text: friendlyError(e) })
      setAnalysisStep(-1)
      setAnalysis('error')
    } finally {
      inFlight.current = false
    }
  }

  function goBack(to: 1 | 2) {
    if (hasResult) {
      setConfirm({ kind: 'back', to })
      return
    }
    doBack(to)
  }
  function doBack(to: 1 | 2) {
    setResult(null)
    setError(null)
    setAnalysisStep(-1)
    setAnalysis('idle')
    if (to === 1) {
      setCropConfirmed(false)
      setImages([])
    }
  }

  function resumeDraft() {
    if (!draft) return
    setCrop(draft.crop)
    setVariety(draft.variety)
    setLocation(draft.location)
    setHarvest(draft.harvest)
    setCropConfirmed(true)
    setShowResume(false)
  }
  function discardDraft() {
    clearDraft()
    setShowResume(false)
  }

  /* ---------- market info ---------- */
  const shown = result ?? viewing
  const shownCrop = shown?.crop ?? crop
  const cropInFeed = markets.some((m) => m.history[shownCrop])
  const todayPrice = cropInFeed ? Math.round(markets.reduce((a, m) => a + m.history[shownCrop].at(-1)!.price, 0) / markets.length) : 0
  const premium: Record<Grade, number> = markets[0]?.gradePremium ?? { A: 1.08, B: 1, C: 0.9 }
  const feedUpdatedAt = cropInFeed ? Math.max(...markets.map((m) => m.updatedAt ?? 0)) : 0

  const qtyNum = Number(qtyText)
  const qtyKg = unit === 'kg' ? qtyNum : qtyNum * 100
  const qtyError =
    qtyText.trim() === '' || Number.isNaN(qtyNum) ? 'Enter a number.' : qtyNum <= 0 ? 'Quantity must be greater than 0.' : qtyKg > MAX_QTY_KG ? 'Quantity is unrealistically large.' : null

  const validCount = images.filter((i) => i.status === 'valid').length
  const analyzeLabel =
    phase === 'analyzing' ? t('analyzing') : phase === 'success' || phase === 'low_confidence' ? t('analysisComplete') : phase === 'error' ? t('tryAgain') : t('startAnalysis')
  const analyzeDisabled = phase === 'analyzing' || phase === 'success' || phase === 'low_confidence' || (phase !== 'error' && phase !== 'ready') || validCount === 0
  const showUploadCard = cropConfirmed

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <StepHeader step={step} title={t('title')} subtitle={t('subtitle')} icon={ScanSearch} color="bg-sky-600" ai />
        <div className="flex items-center gap-2">
          <Badge tone="blue">{t('badge')}</Badge>
          <div className="flex overflow-hidden rounded-lg border border-slate-200 text-xs font-semibold">
            <button className={`px-2.5 py-1 ${lang === 'en' ? 'bg-slate-900 text-white' : 'text-slate-600'}`} onClick={() => setLang('en')}>English</button>
            <button className={`px-2.5 py-1 ${lang === 'hi' ? 'bg-slate-900 text-white' : 'text-slate-600'}`} onClick={() => setLang('hi')}>हिंदी</button>
          </div>
        </div>
      </div>

      {service.isDemo && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <Info size={14} className="mt-0.5 shrink-0" />
          <span>
            <b>AI_MODE={mode} · Demo AI Result</b> — no trained vision model is connected. Grades are computed from basic photo statistics to demonstrate the workflow. Set{' '}
            <code>VITE_GRADING_API</code> (POST /api/quality/analyze) or an OpenAI key to use a real model.
          </span>
        </div>
      )}
      {!online && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <WifiOff size={14} /> Connection interrupted. You can keep preparing photos; analysis will need a connection{service.isDemo ? ' only for real AI mode' : ''}.
        </div>
      )}

      {showResume && draft && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
          <span>
            You have an unfinished assessment (<b>{draft.crop}</b>, {new Date(draft.savedAt).toLocaleString('en-IN')}). Photos are not kept between sessions.
          </span>
          <div className="flex gap-2">
            <button className="btn-primary !bg-sky-600 !py-1.5 text-xs" onClick={resumeDraft}>Resume</button>
            <button className="btn-secondary !py-1.5 text-xs" onClick={discardDraft}>Discard</button>
          </div>
        </div>
      )}

      <Stepper states={stepStates} labels={[t('s1'), t('s2'), t('s3'), t('s4'), t('s5'), t('s6')]} />

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        {/* ---------- left: workflow ---------- */}
        <div className="space-y-4">
          {/* Step 1 */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">{t('step1')}</h3>
              {cropConfirmed && <Badge tone="green"><Check size={12} className="mr-1 inline" />{t('produceSelected')}</Badge>}
            </div>
            {!cropConfirmed ? (
              <>
                <label className="label" htmlFor="g-crop">{t('whatProduce')}</label>
                <select id="g-crop" className="input" value={crop} onChange={(e) => requestCropChange(e.target.value)}>
                  <option value="">— {t('none')} —</option>
                  {GRADING_CROPS.map((c) => <option key={c}>{c}</option>)}
                </select>
                <div className="text-xs text-slate-500">{t('selectedCrop')}: <b className="text-slate-800">{crop || t('none')}</b></div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="label" htmlFor="g-var">{t('variety')}</label>
                    <input id="g-var" className="input" value={variety} onChange={(e) => setVariety(e.target.value)} placeholder="e.g. HD-2967" />
                  </div>
                  <div>
                    <label className="label" htmlFor="g-loc">{t('location')}</label>
                    <select id="g-loc" className="input" value={location} onChange={(e) => setLocation(e.target.value)}>
                      <option value="">—</option>
                      {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="g-date">{t('harvest')}</label>
                    <input id="g-date" type="date" className="input" value={harvest} onChange={(e) => setHarvest(e.target.value)} />
                  </div>
                </div>
                <button className="btn-primary !bg-sky-600 hover:!bg-sky-700" disabled={!crop} onClick={() => setCropConfirmed(true)}>
                  {t('continue')}
                </button>
              </>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-50 p-3">
                <div>
                  <div className="text-xs text-emerald-700">{t('selectedCrop')}</div>
                  <div className="text-lg font-bold text-emerald-900">🌾 {crop}{variety ? ` · ${variety}` : ''}{location ? ` · ${location}` : ''}</div>
                </div>
                <button className="btn-secondary !py-1.5 text-xs" onClick={() => goBack(1)}><ChevronLeft size={14} /> Change Produce</button>
              </div>
            )}
          </div>

          {/* Step 2 + 3 */}
          {showUploadCard && (
            <div className="card fade-up" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
              <h3 className="font-semibold text-slate-900">{t('step2')}</h3>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png" multiple hidden onChange={onPick} data-testid="file-input" />
              <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={onPick} />
              {images.length < MAX_IMAGES && (
                <div className="mt-3 flex flex-col items-center rounded-xl border-2 border-dashed border-sky-200 bg-sky-50/40 p-5 text-center">
                  <ImagePlus className="text-sky-500" size={32} />
                  <p className="mt-2 text-sm text-slate-500">{t('uploadHint')}</p>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    <button className="btn-primary !bg-sky-600 hover:!bg-sky-700 min-h-11" onClick={() => camRef.current?.click()} disabled={phase === 'analyzing'}>
                      <Camera size={16} /> {t('takePhoto')}
                    </button>
                    <button className="btn-secondary min-h-11" onClick={() => fileRef.current?.click()} disabled={phase === 'analyzing'}>
                      <Upload size={16} /> {images.length ? t('uploadMultiple') : t('uploadImage')}
                    </button>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">JPG, JPEG, PNG · max 10 MB · up to {MAX_IMAGES} images ({images.length}/{MAX_IMAGES} added)</div>
                </div>
              )}
              {uploadError && <div className="mt-2 text-xs text-rose-700">{uploadError}</div>}

              {images.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {images.map((img, idx) => (
                    <li key={img.id} className={`rounded-xl border p-2 ${img.status === 'invalid' ? 'border-rose-300 bg-rose-50/40' : img.status === 'valid' ? 'border-emerald-200' : 'border-slate-200'}`}>
                      <div className="flex items-start gap-3">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                          {img.url ? <img src={img.url} alt={`Sample ${idx + 1}`} className="h-full w-full object-cover" /> : <Loader2 className="m-5 animate-spin text-slate-400" size={20} />}
                        </div>
                        <div className="min-w-0 flex-1 text-xs">
                          <div className="truncate font-semibold text-slate-800">{idx + 1}. {img.name}</div>
                          {img.status === 'uploading' && (
                            <div className="mt-1">
                              <div className="text-slate-600">{t('uploading')} {Math.round(img.progress * 100)}%</div>
                              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-sky-500 transition-all" style={{ width: `${img.progress * 100}%` }} /></div>
                            </div>
                          )}
                          {img.status !== 'uploading' && <div className="mt-0.5 flex items-center gap-1 text-emerald-700"><CheckCircle2 size={12} /> {t('uploaded')}</div>}
                          {(img.status === 'validating' || img.status === 'invalid' || img.status === 'valid') && (
                            <div className="mt-1 text-slate-600">
                              {img.status === 'validating' && <div className="mb-1 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> {t('checking')}</div>}
                              <ul className="grid grid-cols-2 gap-x-3 sm:grid-cols-3">
                                {VALIDATION_CHECKS.map((c) => (
                                  <li key={c} className="flex items-center gap-1">
                                    <CheckIcon state={img.checks[c]} /> <span className={img.checks[c] === 'pending' ? 'text-slate-400' : ''}>{c}</span>
                                  </li>
                                ))}
                              </ul>
                              {img.status === 'valid' && <div className="mt-1 flex items-center gap-1 font-semibold text-emerald-700"><CheckCircle2 size={12} /> {t('suitable')}</div>}
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col gap-1">
                          <button className="btn-secondary !px-2 !py-1 text-[11px]" onClick={() => replaceImage(img.id)} disabled={phase === 'analyzing' || img.status === 'uploading'}>{t('replace')}</button>
                          <button className="btn-secondary !px-2 !py-1 text-[11px] !text-rose-700" aria-label="Remove image" onClick={() => removeImage(img.id)} disabled={phase === 'analyzing'}><X size={12} /> {t('remove')}</button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {phase === 'validation_failed' && (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                  <div className="flex items-center gap-2 font-semibold"><CircleAlert size={16} /> {t('tooLow')}</div>
                  <div className="mt-1 text-xs font-semibold">Reasons:</div>
                  <ul className="list-disc pl-5 text-xs">
                    {[...new Set(images.filter((i) => i.status === 'invalid').flatMap((b) => b.check?.problems ?? []))].map((p) => <li key={p}>{p}</li>)}
                  </ul>
                  <div className="mt-1 text-xs font-semibold">Recommendations:</div>
                  <ul className="list-disc pl-5 text-xs"><li>Use better lighting</li><li>Move camera closer</li><li>Keep produce in focus</li><li>Plain background, avoid strong shadows</li></ul>
                  <button className="btn-secondary mt-2 !py-1.5 text-xs" onClick={() => { removeInvalid(); fileRef.current?.click() }}>{t('uploadAnother')}</button>
                </div>
              )}

              {(phase === 'ready' || phase === 'analyzing' || phase === 'error' || phase === 'success' || phase === 'low_confidence') && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button className="btn-primary min-h-11" onClick={analyze} disabled={analyzeDisabled} data-testid="analyze-btn">
                    {phase === 'analyzing' ? <Loader2 size={16} className="animate-spin" /> : phase === 'error' ? <RefreshCw size={16} /> : phase === 'success' || phase === 'low_confidence' ? <Check size={16} /> : <ScanSearch size={16} />}
                    {analyzeLabel}
                  </button>
                  {(phase === 'success' || phase === 'low_confidence' || phase === 'error') && (
                    <button className="btn-secondary" onClick={() => goBack(2)}><ChevronLeft size={14} /> {t('back')}</button>
                  )}
                  <span className="text-xs text-slate-500">{validCount} valid image{validCount === 1 ? '' : 's'} · {service.name}</span>
                </div>
              )}
            </div>
          )}

          {/* Step 4 progress */}
          {(phase === 'analyzing' || phase === 'error') && (
            <div className="card fade-up">
              <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-900">
                <span>{t('progressTitle')}</span>
                {phase === 'analyzing' && <span className="text-xs font-normal text-slate-500">Processing stages · {service.name}</span>}
              </div>
              <ol className="space-y-1.5 text-sm">
                {ANALYSIS_STEPS.map((s, i) => {
                  const done = i < analysisStep || (phase !== 'error' && analysisStep >= ANALYSIS_STEPS.length - 1)
                  const cur = i === analysisStep && phase === 'analyzing'
                  const failed = phase === 'error' && i === Math.max(0, analysisStep)
                  return (
                    <li key={s} className={`flex items-center gap-2 ${done || cur ? 'text-slate-900' : 'text-slate-400'}`}>
                      {done ? <CheckCircle2 size={16} className="text-emerald-600" /> : cur ? <Loader2 size={16} className="animate-spin text-sky-600" /> : failed ? <CircleAlert size={16} className="text-rose-600" /> : <span className="inline-block h-4 w-4 rounded-full border border-slate-300" />}
                      {s}
                    </li>
                  )
                })}
              </ol>
              {phase === 'error' && error && (
                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                  <div className="flex items-center gap-2 font-semibold"><AlertTriangle size={16} /> {error.text}</div>
                  {error.kind === 'produce_not_detected' && (
                    <>
                      <ul className="mt-1 list-disc pl-5 text-xs"><li>Upload a closer photo.</li><li>Use better lighting.</li><li>Ensure only the selected produce is visible.</li></ul>
                      <div className="mt-2 flex gap-2">
                        <button className="btn-secondary !py-1.5 text-xs" onClick={() => { setImages([]); setError(null); setAnalysis('idle'); fileRef.current?.click() }}>Upload New Photo</button>
                        <button className="btn-secondary !py-1.5 text-xs" onClick={() => doBack(1)}>Change Produce</button>
                      </div>
                    </>
                  )}
                  {(error.kind === 'network' || error.kind === 'timeout') && (
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <button className="btn-secondary !py-1.5 text-xs" onClick={analyze} disabled={!online}><RefreshCw size={12} /> Retry Analysis</button>
                      {!online && <span>Waiting for connection…</span>}
                    </div>
                  )}
                  {error.kind === 'api' && <div className="mt-1 text-xs">Your crop and photos are kept. Press <b>Try Again</b> above.</div>}
                </div>
              )}
            </div>
          )}

          {/* History */}
          <div className="card">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">{t('history')}</h3>
              {history.length > 0 && <button className="text-xs text-rose-600 hover:underline" onClick={() => { setHistory([]); setViewing(null) }}>Clear all</button>}
            </div>
            {history.length === 0 ? (
              <p className="text-sm text-slate-500">No completed assessments yet. Only successful analyses are saved (in this browser).</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-slate-500">
                    <tr><th className="py-1">Date</th><th>Crop</th><th>Grade</th><th>Score</th><th>Conf.</th><th>Images</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {history.map((a) => (
                      <tr key={a.id} className={`border-t border-slate-100 ${shown?.id === a.id ? 'bg-sky-50' : ''}`}>
                        <td className="py-1.5">{new Date(a.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        <td>{a.crop}</td>
                        <td className="font-bold">{a.predicted_grade}</td>
                        <td>{a.visual_quality_score}/100</td>
                        <td>{Math.round(a.confidence * 100)}%</td>
                        <td>{a.imageCount}</td>
                        <td className="whitespace-nowrap">
                          <button className="text-sky-700 hover:underline" onClick={() => setViewing(a)}>View</button>
                          <span className="text-slate-300"> · </span>
                          <button className="text-rose-600 hover:underline" onClick={() => { setHistory(history.filter((h) => h.id !== a.id)); if (viewing?.id === a.id) setViewing(null) }}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ---------- right: result ---------- */}
        <div className="space-y-4">
          {!shown ? (
            <div className="card flex min-h-[280px] flex-col items-center justify-center text-center text-slate-500">
              {phase === 'analyzing' ? (
                <>
                  <Loader2 size={36} className="animate-spin text-sky-500" />
                  <p className="mt-3 text-sm">Analyzing your photos… the grade card will appear here when the AI service responds.</p>
                </>
              ) : (
                <>
                  <ScanSearch size={40} className="text-slate-300" />
                  <p className="mt-3 text-sm">
                    {!cropConfirmed ? 'Start by selecting your produce.' : images.length === 0 ? 'Now upload or take 1–5 clear photos.' : phase === 'ready' ? <>Photos validated. Press <b>{t('startAnalysis')}</b>.</> : 'Waiting for valid photos.'}
                  </p>
                </>
              )}
            </div>
          ) : (
            <ResultView
              key={shown.id}
              a={shown}
              isCurrent={result?.id === shown.id}
              lowConfidence={confidenceBand(shown.confidence) === 'low'}
              t={t}
              qtyText={qtyText}
              setQtyText={setQtyText}
              unit={unit}
              setUnit={setUnit}
              qtyKg={qtyKg}
              qtyError={qtyError}
              todayPrice={todayPrice}
              feedUpdatedAt={feedUpdatedAt}
              premium={premium}
              cropInFeed={cropInFeed}
              onUploadMore={() => fileRef.current?.click()}
              onUseGrade={() => onUseGrade(toShared(shown, qtyKg))}
              onCompareMarkets={onCompareMarkets}
              onClose={result?.id === shown.id ? undefined : () => setViewing(null)}
            />
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <Info size={12} className="mr-1 inline" /> {DISCLAIMER}
          </div>
        </div>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center gap-2 font-semibold text-slate-900"><AlertTriangle size={18} className="text-amber-500" /> Reset current assessment?</div>
            <p className="mt-2 text-sm text-slate-600">
              {confirm.kind === 'crop' ? 'Changing the crop will reset the current assessment. Continue?' : 'Changing this information will reset the current AI assessment. Do you want to continue?'}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setConfirm(null)}>{confirm.kind === 'crop' ? 'Cancel' : 'Keep Current Assessment'}</button>
              <button
                className="btn-primary !bg-rose-600 hover:!bg-rose-700"
                onClick={() => {
                  if (confirm.kind === 'crop') applyCrop(confirm.next)
                  else doBack(confirm.to)
                  setConfirm(null)
                }}
              >
                {confirm.kind === 'crop' ? 'Change Crop' : 'Reset & Change'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------------- sub-components ---------------- */

function CheckIcon({ state }: { state: CheckState }) {
  if (state === 'passed') return <CheckCircle2 size={12} className="text-emerald-600" />
  if (state === 'failed') return <CircleAlert size={12} className="text-rose-600" />
  if (state === 'running') return <Loader2 size={12} className="animate-spin text-sky-600" />
  return <span className="inline-block h-3 w-3 rounded-full border border-slate-300" />
}

function Stepper({ states, labels }: { states: StepState[]; labels: string[] }) {
  return (
    <ol className="flex items-center gap-1 overflow-x-auto pb-1 text-xs" aria-label="Progress">
      {labels.map((l, i) => {
        const s = states[i]
        const circle =
          s === 'done' ? 'bg-emerald-600 text-white' : s === 'current' ? 'bg-sky-600 text-white ring-4 ring-sky-100' : s === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-500'
        return (
          <li key={l} className="flex shrink-0 items-center gap-1" data-state={s}>
            <span className={`flex h-6 w-6 items-center justify-center rounded-full font-bold transition-all ${circle}`}>
              {s === 'done' ? <Check size={14} /> : s === 'error' ? '!' : i + 1}
            </span>
            <span className={`whitespace-nowrap ${s === 'current' ? 'font-semibold text-slate-900' : s === 'pending' ? 'text-slate-400' : 'text-slate-700'}`}>{l}</span>
            {i < labels.length - 1 && <span className={`mx-1 h-px w-4 sm:w-8 ${s === 'done' ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
          </li>
        )
      })}
    </ol>
  )
}

function useCountUp(target: number, ms = 600) {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms)
      setV(Math.round(target * (1 - (1 - p) ** 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}

function Bar({ label, value }: { label: string; value: number }) {
  const tone = value >= 80 ? 'bg-emerald-500' : value >= 65 ? 'bg-amber-400' : 'bg-rose-500'
  const [w, setW] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setW(value))
    return () => cancelAnimationFrame(id)
  }, [value])
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-600"><span>{label}</span><span className="font-semibold text-slate-900">{value}%</span></div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full transition-all duration-700 ${tone}`} style={{ width: `${w}%` }} /></div>
    </div>
  )
}

function ResultView({
  a,
  isCurrent,
  lowConfidence,
  t,
  qtyText,
  setQtyText,
  unit,
  setUnit,
  qtyKg,
  qtyError,
  todayPrice,
  feedUpdatedAt,
  premium,
  cropInFeed,
  onUploadMore,
  onUseGrade,
  onCompareMarkets,
  onClose,
}: {
  a: Assessment
  isCurrent: boolean
  lowConfidence: boolean
  t: (k: string) => string
  qtyText: string
  setQtyText: (s: string) => void
  unit: 'kg' | 'quintal'
  setUnit: (u: 'kg' | 'quintal') => void
  qtyKg: number
  qtyError: string | null
  todayPrice: number
  feedUpdatedAt: number
  premium: Record<Grade, number>
  cropInFeed: boolean
  onUploadMore: () => void
  onUseGrade: () => void
  onCompareMarkets: () => void
  onClose?: () => void
}) {
  const band = confidenceBand(a.confidence)
  const pct = Math.round(a.confidence * 100)
  const score = useCountUp(a.visual_quality_score)
  const gradeTone = a.predicted_grade === 'A' ? 'text-emerald-600' : a.predicted_grade === 'B' ? 'text-amber-600' : 'text-rose-600'
  const [customPrice, setCustomPrice] = useState('')
  const basePerKg = customPrice ? Number(customPrice) : todayPrice / 100
  const gradeLabel: Record<Grade, string> = { A: 'Premium / A', B: 'Standard / B', C: 'Low / C' }
  const [generating, setGenerating] = useState(false)

  function downloadReport() {
    setGenerating(true)
    const lines = [
      'AI-Assisted Produce Quality Assessment',
      '======================================',
      `Date/time: ${new Date(a.createdAt).toLocaleString('en-IN')}`,
      `Assessment ID: ${a.id}`,
      `Crop: ${a.crop}${a.variety ? ` (${a.variety})` : ''}${a.location ? ` · ${a.location}` : ''}`,
      `Images analysed: ${a.imageCount}`,
      `Predicted grade: ${a.predicted_grade}`,
      `Visual quality score: ${a.visual_quality_score}/100`,
      `Confidence: ${pct}% (${band})`,
      `Result source: ${a.source === 'demo' ? 'Demo AI Result (no trained model connected)' : a.source}`,
      '',
      'Quality breakdown:',
      ...Object.entries(a.parameters).map(([k, v]) => `  ${PARAM_LABEL[k] ?? k}: ${v}`),
      '',
      'Detected visible issues:',
      ...a.detected_issues.map((i) => `  - ${i}`),
      '',
      'Positive factors:',
      ...a.positive_factors.map((i) => `  + ${i}`),
      'Factors reducing grade:',
      ...(a.negative_factors.length ? a.negative_factors.map((i) => `  ! ${i}`) : ['  none']),
      '',
      `Selling strategy implication: ${a.recommendation}`,
      '',
      'This report is an AI-assisted preliminary visual assessment and does not constitute official APMC/eNAM/laboratory certification.',
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const el = document.createElement('a')
    el.href = URL.createObjectURL(blob)
    el.download = `agrisell-quality-${a.crop.replace(/\W+/g, '-')}-${a.id}.txt`
    el.click()
    URL.revokeObjectURL(el.href)
    setGenerating(false)
  }

  return (
    <>
      <div className="card fade-up border-2 border-sky-200" data-testid="result-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={a.thumbnail} alt="" className="h-16 w-16 rounded-lg object-cover" />
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">AI Quality Assessment{!isCurrent && ' · saved'}</div>
              <div className={`text-4xl font-extrabold ${gradeTone}`}>{t('predicted')}: {a.predicted_grade}</div>
              <div className="text-sm text-slate-600">{a.crop} · {t('score')} <b>{score} / 100</b></div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {a.source === 'demo' ? <Badge tone="amber">Demo AI Result</Badge> : <Badge tone="violet">AI vision result</Badge>}
            {a.per_image.length > 1 && <Badge tone="blue">Batch of {a.per_image.length} images</Badge>}
            {onClose && <button className="text-xs text-slate-500 hover:underline" onClick={onClose}>Close</button>}
          </div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs text-slate-600"><span>{t('confidence')}</span><span className="font-semibold">{pct}%</span></div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full transition-all duration-700 ${band === 'high' ? 'bg-emerald-500' : band === 'moderate' ? 'bg-amber-400' : 'bg-rose-500'}`} style={{ width: `${pct}%` }} />
          </div>
          {band === 'moderate' && <div className="mt-1 text-xs text-amber-700">Moderate confidence. Consider additional images.</div>}
          {lowConfidence && (
            <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <div className="flex items-center gap-1 font-semibold"><AlertTriangle size={14} /> {t('lowConf')}</div>
              The AI could not confidently assess this image. Upload additional representative photos for a better assessment.
              {isCurrent && <button className="btn-secondary mt-2 !py-1.5 text-xs" onClick={onUploadMore}><Upload size={12} /> {t('uploadMore')}</button>}
            </div>
          )}
          {a.variation_warning && <div className="mt-1 text-xs text-amber-700">The images show considerable variation. Please upload additional representative samples.</div>}
        </div>
        {a.per_image.length > 1 && (
          <div className="mt-3 text-xs text-slate-600">
            Batch summary — {(['A', 'B', 'C'] as Grade[]).map((g) => `${gradeLabel[g]}: ${Math.round((a.per_image.filter((p) => p.grade === g).length / a.per_image.length) * 100)}%`).join(' · ')}
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">This is an AI-assisted visual estimate based on the uploaded image. It is not an official quality certificate or laboratory/APMC grading result.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card fade-up space-y-2.5" style={{ animationDelay: '80ms' }}>
          <h3 className="font-semibold text-slate-900">{t('breakdown')}</h3>
          {Object.entries(a.parameters).map(([k, v]) => <Bar key={k} label={PARAM_LABEL[k] ?? k} value={v} />)}
        </div>
        <div className="space-y-4">
          <div className="card fade-up" style={{ animationDelay: '120ms' }}>
            <h3 className="font-semibold text-slate-900">{t('issues')}</h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {a.detected_issues.length ? a.detected_issues.map((i) => <li key={i} className="flex gap-2"><span className="text-slate-400">•</span>{i}</li>) : <li className="text-slate-500">None reported</li>}
            </ul>
          </div>
          <div className="card fade-up" style={{ animationDelay: '160ms' }}>
            <h3 className="font-semibold text-slate-900">{t('why')}</h3>
            <div className="mt-2 text-xs font-semibold uppercase text-emerald-700">Positive factors</div>
            <ul className="mt-1 space-y-0.5 text-sm">
              {a.positive_factors.length ? a.positive_factors.map((f) => <li key={f} className="flex gap-2 text-slate-700"><Check size={14} className="mt-0.5 text-emerald-600" />{f}</li>) : <li className="text-slate-500">—</li>}
            </ul>
            <div className="mt-3 text-xs font-semibold uppercase text-amber-700">Factors reducing score</div>
            <ul className="mt-1 space-y-0.5 text-sm">
              {a.negative_factors.length ? a.negative_factors.map((f) => <li key={f} className="flex gap-2 text-slate-700"><AlertTriangle size={14} className="mt-0.5 text-amber-500" />{f}</li>) : <li className="text-slate-500">None significant</li>}
            </ul>
          </div>
        </div>
      </div>

      {/* Step 6 */}
      <div className="card fade-up border-2 border-emerald-200" style={{ animationDelay: '200ms' }} data-testid="selling-insight">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-slate-900">{t('step6')}</h3>
          <Badge tone="green"><Check size={12} className="mr-1 inline" />{t('completed')}</Badge>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-lg bg-slate-50 p-2"><div className="text-xs text-slate-500">Crop</div><div className="font-bold">{a.crop}</div></div>
          <div className="rounded-lg bg-slate-50 p-2"><div className="text-xs text-slate-500">Grade</div><div className={`font-bold ${gradeTone}`}>{a.predicted_grade}</div></div>
          <div className="rounded-lg bg-slate-50 p-2"><div className="text-xs text-slate-500">Visual Score</div><div className="font-bold">{a.visual_quality_score}/100</div></div>
        </div>

        <table className="mt-3 w-full text-left text-sm">
          <thead className="text-xs text-slate-500"><tr><th className="py-1">Grade</th><th>Visual Quality</th><th>Potential price impact</th></tr></thead>
          <tbody>
            {([['A', 'Excellent', 'Higher price potential'], ['B', 'Good', 'Normal market price'], ['C', 'Below average', 'Lower price potential']] as [Grade, string, string][]).map(([g, q, p]) => (
              <tr key={g} className={`border-t border-slate-100 ${g === a.predicted_grade ? 'bg-emerald-50 font-semibold' : ''}`}>
                <td className="py-1.5">{gradeLabel[g]} {g === a.predicted_grade && <Badge tone="green">your estimate</Badge>}</td><td>{q}</td><td>{p}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
          <div className="text-xs font-semibold uppercase text-emerald-700">Recommended action</div>
          {a.recommendation}
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 p-3">
          <div className="text-sm font-semibold text-slate-900">{t('howMuch')}</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div className="text-xs text-slate-600">
              Quantity
              <div className="mt-1 flex gap-1">
                <input type="number" inputMode="numeric" className="input" value={qtyText} min={1} onChange={(e) => setQtyText(e.target.value)} aria-label="Quantity" />
                <select className="input !w-28" value={unit} onChange={(e) => setUnit(e.target.value as 'kg' | 'quintal')} aria-label="Unit">
                  <option value="kg">kg</option>
                  <option value="quintal">quintal</option>
                </select>
              </div>
              {qtyError && <div className="mt-1 text-rose-600">{qtyError}</div>}
            </div>
            <label className="text-xs text-slate-600">
              Price scenario (₹/kg)
              <input type="number" inputMode="decimal" className="input mt-1" placeholder={cropInFeed ? (todayPrice / 100).toFixed(2) : 'enter price'} value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} />
              <div className="mt-1 text-[11px] text-slate-500">
                {customPrice ? 'Your price scenario' : cropInFeed ? <><CheckCircle2 size={10} className="mr-0.5 inline text-emerald-600" /> Market information updated {feedUpdatedAt ? new Date(feedUpdatedAt).toLocaleTimeString('en-IN') : ''} (integrated UP feed avg.)</> : 'No live price for this crop — illustrative market estimate; enter a price.'}
              </div>
            </label>
          </div>
          {!qtyError && basePerKg > 0 ? (
            <>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
                {(['A', 'B', 'C'] as Grade[]).map((g) => (
                  <div key={g} className={`rounded-lg p-2 ${g === a.predicted_grade ? 'bg-emerald-100' : 'bg-slate-50'}`}>
                    <div className="text-xs text-slate-500">Grade {g} · ₹{((basePerKg * premium[g]) / premium.B).toFixed(2)}/kg</div>
                    <div className="font-bold text-slate-900">{fmt(Math.round((qtyKg * basePerKg * premium[g]) / premium.B))}</div>
                  </div>
                ))}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">Estimated gross value for {qtyKg.toLocaleString('en-IN')} kg — Estimated / Illustrative, not guaranteed income.</div>
            </>
          ) : (
            !qtyError && <div className="mt-2 text-xs text-slate-500">Enter a price scenario to see illustrative gross value by grade.</div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn-primary min-h-11" onClick={onUseGrade} disabled={qtyError !== null} data-testid="use-result"><Check size={16} /> {t('useResult')}</button>
          <button className="btn-secondary" onClick={onCompareMarkets}>Compare Market Prices</button>
          <button className="btn-secondary" onClick={downloadReport} disabled={generating}>{generating ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} {generating ? 'Generating report...' : 'Download Report'}</button>
        </div>
        <p className="mt-2 text-xs text-slate-500">AI visual grade = preliminary estimate. Official APMC/e-NAM grading = final accepted grade.</p>
      </div>
    </>
  )
}
