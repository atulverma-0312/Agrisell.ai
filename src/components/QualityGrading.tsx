import { AlertTriangle, Camera, Check, CheckCircle2, Download, ImagePlus, Info, Loader2, ScanSearch, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import {
  ANALYSIS_STEPS,
  GRADING_CROPS,
  MAX_IMAGES,
  checkImageQuality,
  confidenceBand,
  friendlyError,
  loadHistory,
  makeThumbnail,
  pickService,
  readAsDataUrl,
  saveHistory,
  validateFile,
} from '../lib/grading'
import type { Assessment, GradingResult, ImageCheck } from '../lib/grading'
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
  selectProduce: { en: 'Select Produce', hi: 'उपज चुनें' },
  variety: { en: 'Variety (Optional)', hi: 'किस्म (वैकल्पिक)' },
  location: { en: 'Location / Mandi (Optional)', hi: 'स्थान / मंडी (वैकल्पिक)' },
  harvest: { en: 'Harvest Date (Optional)', hi: 'कटाई की तारीख (वैकल्पिक)' },
  upload: { en: 'Upload Produce Image', hi: 'उपज की फोटो अपलोड करें' },
  uploadHint: { en: 'Take a clear photo in good lighting with the produce clearly visible.', hi: 'अच्छी रोशनी में साफ फोटो लें जिसमें उपज स्पष्ट दिखे।' },
  takePhoto: { en: 'Take Photo', hi: 'फोटो लें' },
  uploadImage: { en: 'Upload Image', hi: 'फोटो अपलोड करें' },
  analyze: { en: 'Analyze Quality', hi: 'गुणवत्ता जांचें' },
  predicted: { en: 'Predicted Quality Grade', hi: 'अनुमानित गुणवत्ता ग्रेड' },
  confidence: { en: 'Confidence', hi: 'विश्वास स्तर' },
  breakdown: { en: 'Quality Breakdown', hi: 'गुणवत्ता विवरण' },
  issues: { en: 'Detected Visible Issues', hi: 'पाई गई दिखने वाली समस्याएँ' },
  why: { en: 'Why did AI assign this grade?', hi: 'AI ने यह ग्रेड क्यों दिया?' },
  history: { en: 'Grading History', hi: 'ग्रेडिंग इतिहास' },
  useGrade: { en: 'Use this grade in Selling Strategy', hi: 'यह ग्रेड बिक्री रणनीति में उपयोग करें' },
}

const PARAM_LABEL: Record<string, string> = {
  appearance: 'Appearance',
  color_uniformity: 'Color Uniformity',
  surface_condition: 'Surface Condition',
  visible_defects: 'Visible Defects',
  uniformity: 'Uniformity',
}

interface Img {
  url: string
  check: ImageCheck
}

export function QualityGrading({
  step,
  markets,
  defaultCrop,
  defaultLocation,
  onUseGrade,
  onCompareMarkets,
}: {
  step: number
  markets: CleanMarket[]
  defaultCrop: string
  defaultLocation: string
  onUseGrade: (crop: string, grade: Grade, quantityQuintal: number) => void
  onCompareMarkets: () => void
}) {
  const [lang, setLang] = useState<Lang>('en')
  const t = (k: string) => T[k][lang]
  const [crop, setCrop] = useState(defaultCrop)
  const [variety, setVariety] = useState('')
  const [location, setLocation] = useState(defaultLocation)
  const [harvest, setHarvest] = useState('')
  const [images, setImages] = useState<Img[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busyStep, setBusyStep] = useState<number | null>(null)
  const [result, setResult] = useState<GradingResult | null>(null)
  const [history, setHistory] = useState<Assessment[]>(() => loadHistory())
  const [viewing, setViewing] = useState<Assessment | null>(null)
  const [qtyKg, setQtyKg] = useState(1000)
  const fileRef = useRef<HTMLInputElement>(null)
  const camRef = useRef<HTMLInputElement>(null)
  const apiKey = localStorage.getItem(KEY_STORAGE) ?? import.meta.env.VITE_OPENAI_API_KEY ?? ''
  const service = useMemo(() => pickService(apiKey), [apiKey])

  useEffect(() => saveHistory(history), [history])

  const badImages = images.filter((i) => !i.check.ok)

  async function addFiles(files: FileList | File[]) {
    setError(null)
    setResult(null)
    const next: Img[] = []
    for (const f of Array.from(files).slice(0, MAX_IMAGES - images.length)) {
      const err = validateFile(f)
      if (err) {
        setError(err)
        continue
      }
      try {
        const url = await readAsDataUrl(f)
        const check = await checkImageQuality(url)
        next.push({ url, check })
      } catch {
        setError('This file could not be read as an image.')
      }
    }
    setImages((prev) => [...prev, ...next].slice(0, MAX_IMAGES))
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) void addFiles(e.target.files)
    e.target.value = ''
  }
  function onDrop(e: DragEvent) {
    e.preventDefault()
    void addFiles(e.dataTransfer.files)
  }

  async function analyze() {
    if (images.length === 0) {
      setError('Please upload at least one image first.')
      return
    }
    if (badImages.length) {
      setError('The image quality is not sufficient for reliable assessment.')
      return
    }
    setError(null)
    setBusyStep(0)
    try {
      const r = await service.analyze(
        { crop, variety: variety || undefined, location: location || undefined, harvestDate: harvest || undefined, images: images.map((i) => i.url) },
        (s) => setBusyStep(s),
      )
      setResult(r)
      const a: Assessment = {
        ...r,
        id: `${Date.now()}`,
        createdAt: Date.now(),
        variety: variety || undefined,
        location: location || undefined,
        thumbnail: await makeThumbnail(images[0].url),
        imageCount: images.length,
      }
      setHistory((h) => [a, ...h])
      setViewing(a)
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusyStep(null)
    }
  }

  function reset() {
    setImages([])
    setResult(null)
    setError(null)
  }

  const cropInFeed = markets.some((m) => m.history[crop])
  const todayPrice = cropInFeed ? Math.round(markets.reduce((a, m) => a + m.history[crop].at(-1)!.price, 0) / markets.length) : 0
  const premium: Record<Grade, number> = markets[0]?.gradePremium ?? { A: 1.08, B: 1, C: 0.9 }

  const shown = result ?? viewing
  const shownThumb = result ? images[0]?.url : viewing?.thumbnail

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
            <b>Demo AI Result mode</b> — no trained vision model is connected. Grades are computed from basic photo statistics (lighting, sharpness, colour variation, dark spots) to
            demonstrate the workflow. Enter an OpenAI key in the AI assistant settings, or set <code>VITE_GRADING_API</code>, to use a real vision model.
          </span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        {/* ---------- left: inputs ---------- */}
        <div className="space-y-4">
          <div className="card space-y-3">
            <div>
              <label className="label" htmlFor="g-crop">{t('selectProduce')}</label>
              <select id="g-crop" className="input" value={crop} onChange={(e) => setCrop(e.target.value)}>
                {GRADING_CROPS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
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
          </div>

          <div className="card" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png" multiple hidden onChange={onPick} data-testid="file-input" />
            <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={onPick} />
            <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-sky-200 bg-sky-50/40 p-6 text-center">
              <ImagePlus className="text-sky-500" size={36} />
              <div className="mt-2 text-lg font-bold text-slate-900">{t('upload')}</div>
              <p className="text-sm text-slate-500">{t('uploadHint')}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button className="btn-primary !bg-sky-600 hover:!bg-sky-700" onClick={() => camRef.current?.click()} disabled={images.length >= MAX_IMAGES}>
                  <Camera size={16} /> {t('takePhoto')}
                </button>
                <button className="btn-secondary" onClick={() => fileRef.current?.click()} disabled={images.length >= MAX_IMAGES}>
                  <Upload size={16} /> {t('uploadImage')}
                </button>
              </div>
              <div className="mt-3 text-xs text-slate-400">JPG, JPEG, PNG · max 10 MB · up to {MAX_IMAGES} images of the same batch (front, side, close-up, samples)</div>
            </div>

            {images.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {images.map((img, i) => (
                  <div key={i} className={`relative overflow-hidden rounded-lg border-2 ${img.check.ok ? 'border-emerald-300' : 'border-rose-400'}`}>
                    <img src={img.url} alt={`Sample ${i + 1}`} className="aspect-square w-full object-cover" />
                    <button
                      aria-label="Remove image"
                      className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-slate-700 shadow hover:bg-white"
                      onClick={() => setImages(images.filter((_, j) => j !== i))}
                    >
                      <X size={12} />
                    </button>
                    {!img.check.ok && <div className="absolute inset-x-0 bottom-0 bg-rose-600/90 px-1 py-0.5 text-[10px] text-white">Low quality</div>}
                  </div>
                ))}
              </div>
            )}

            {badImages.length > 0 && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                <div className="font-semibold">The image quality is not sufficient for reliable assessment.</div>
                <ul className="mt-1 list-disc pl-5 text-xs">
                  {[...new Set(badImages.flatMap((b) => b.check.problems))].map((p) => <li key={p}>{p}</li>)}
                </ul>
                <div className="mt-2 text-xs">Tips: use natural or bright lighting · keep the camera steady · plain background · avoid strong shadows · capture several samples.</div>
                <button className="btn-secondary mt-2 !py-1.5 text-xs" onClick={() => { setImages(images.filter((i) => i.check.ok)); fileRef.current?.click() }}>
                  Upload Better Image
                </button>
              </div>
            )}

            {error && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn-primary" onClick={analyze} disabled={busyStep !== null || images.length === 0 || badImages.length > 0}>
                {busyStep !== null ? <Loader2 size={16} className="animate-spin" /> : <ScanSearch size={16} />} {t('analyze')}
              </button>
              <button className="btn-secondary" onClick={() => { reset(); camRef.current?.click() }} disabled={images.length === 0}>Retake</button>
              <button className="btn-secondary" onClick={reset} disabled={images.length === 0}><Trash2 size={14} /> Remove</button>
            </div>
          </div>

          {busyStep !== null && (
            <div className="card">
              <div className="mb-2 text-sm font-semibold text-slate-900">Analyzing with {service.name}…</div>
              <ol className="space-y-1.5 text-sm">
                {ANALYSIS_STEPS.map((s, i) => (
                  <li key={s} className={`flex items-center gap-2 ${i <= busyStep ? 'text-slate-900' : 'text-slate-400'}`}>
                    {i < busyStep ? <CheckCircle2 size={16} className="text-emerald-600" /> : i === busyStep ? <Loader2 size={16} className="animate-spin text-sky-600" /> : <span className="inline-block h-4 w-4 rounded-full border border-slate-300" />}
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="card">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">{t('history')}</h3>
              {history.length > 0 && <button className="text-xs text-rose-600 hover:underline" onClick={() => { setHistory([]); setViewing(null) }}>Clear all</button>}
            </div>
            {history.length === 0 ? (
              <p className="text-sm text-slate-500">No assessments yet. Your results are stored only in this browser.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-slate-500">
                    <tr><th className="py-1">Date</th><th>Crop</th><th>Grade</th><th>Score</th><th>Conf.</th><th>Images</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {history.map((a) => (
                      <tr key={a.id} className={`border-t border-slate-100 ${viewing?.id === a.id ? 'bg-sky-50' : ''}`}>
                        <td className="py-1.5">{new Date(a.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        <td>{a.crop}</td>
                        <td className="font-bold">{a.predicted_grade}</td>
                        <td>{a.visual_quality_score}</td>
                        <td>{Math.round(a.confidence * 100)}%</td>
                        <td>{a.imageCount}</td>
                        <td className="whitespace-nowrap">
                          <button className="text-sky-700 hover:underline" onClick={() => { setResult(null); setViewing(a) }}>View</button>
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

        {/* ---------- right: results ---------- */}
        <div className="space-y-4">
          {!shown ? (
            <div className="card flex h-full min-h-[320px] flex-col items-center justify-center text-center text-slate-500">
              <ScanSearch size={40} className="text-slate-300" />
              <p className="mt-3 text-sm">Select your crop, upload 1–5 clear photos and press <b>Analyze Quality</b>. The AI grade, score, confidence and explanation will appear here.</p>
            </div>
          ) : (
            <ResultView
              r={shown}
              thumb={shownThumb}
              t={t}
              qtyKg={qtyKg}
              setQtyKg={setQtyKg}
              todayPrice={todayPrice}
              premium={premium}
              cropInFeed={cropInFeed}
              onUseGrade={() => onUseGrade(shown.crop, shown.predicted_grade, Math.max(1, Math.round(qtyKg / 100)))}
              onCompareMarkets={onCompareMarkets}
              assessment={viewing}
            />
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <Info size={12} className="mr-1 inline" /> {DISCLAIMER}
          </div>
        </div>
      </div>
    </div>
  )
}

function Bar({ label, value }: { label: string; value: number }) {
  const tone = value >= 80 ? 'bg-emerald-500' : value >= 65 ? 'bg-amber-400' : 'bg-rose-500'
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-600"><span>{label}</span><span className="font-semibold text-slate-900">{value}</span></div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${tone}`} style={{ width: `${value}%` }} /></div>
    </div>
  )
}

function ResultView({
  r,
  thumb,
  t,
  qtyKg,
  setQtyKg,
  todayPrice,
  premium,
  cropInFeed,
  onUseGrade,
  onCompareMarkets,
  assessment,
}: {
  r: GradingResult
  thumb?: string
  t: (k: string) => string
  qtyKg: number
  setQtyKg: (n: number) => void
  todayPrice: number
  premium: Record<Grade, number>
  cropInFeed: boolean
  onUseGrade: () => void
  onCompareMarkets: () => void
  assessment: Assessment | null
}) {
  const band = confidenceBand(r.confidence)
  const pct = Math.round(r.confidence * 100)
  const gradeTone = r.predicted_grade === 'A' ? 'text-emerald-600' : r.predicted_grade === 'B' ? 'text-amber-600' : 'text-rose-600'
  const [customPrice, setCustomPrice] = useState('')
  const basePerKg = customPrice ? Number(customPrice) : todayPrice / 100
  const gradeLabel: Record<Grade, string> = { A: 'Premium / A', B: 'Standard / B', C: 'Low / C' }

  function downloadReport() {
    const lines = [
      'AI-Assisted Produce Quality Assessment',
      '======================================',
      `Date/time: ${new Date(assessment?.createdAt ?? Date.now()).toLocaleString('en-IN')}`,
      `Crop: ${r.crop}${assessment?.variety ? ` (${assessment.variety})` : ''}${assessment?.location ? ` · ${assessment.location}` : ''}`,
      `Images analysed: ${assessment?.imageCount ?? r.per_image.length}`,
      `Predicted grade: ${r.predicted_grade}`,
      `Visual quality score: ${r.visual_quality_score}/100`,
      `Confidence: ${pct}% (${band})`,
      `Result source: ${r.source === 'demo' ? 'Demo AI Result (no trained model connected)' : r.source}`,
      '',
      'Quality breakdown:',
      ...Object.entries(r.parameters).map(([k, v]) => `  ${PARAM_LABEL[k]}: ${v}`),
      '',
      'Detected visible issues:',
      ...r.detected_issues.map((i) => `  - ${i}`),
      '',
      'Positive factors:',
      ...r.positive_factors.map((i) => `  + ${i}`),
      'Factors reducing grade:',
      ...(r.negative_factors.length ? r.negative_factors.map((i) => `  ! ${i}`) : ['  none']),
      '',
      `Selling strategy implication: ${r.recommendation}`,
      '',
      'This report is an AI-assisted preliminary visual assessment and does not constitute official APMC/eNAM/laboratory certification.',
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `agrisell-quality-${r.crop.replace(/\W+/g, '-')}-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <>
      <div className="card border-2 border-sky-200">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {thumb && <img src={thumb} alt="" className="h-16 w-16 rounded-lg object-cover" />}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('predicted')}</div>
              <div className={`text-4xl font-extrabold ${gradeTone}`}>Grade: {r.predicted_grade}</div>
              <div className="text-sm text-slate-600">{r.crop} · Visual Quality Score <b>{r.visual_quality_score}/100</b></div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {r.source === 'demo' ? <Badge tone="amber">Demo AI Result</Badge> : <Badge tone="violet">AI vision result</Badge>}
            {r.per_image.length > 1 && <Badge tone="blue">Batch of {r.per_image.length} images</Badge>}
          </div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs text-slate-600"><span>{t('confidence')}</span><span className="font-semibold">{pct}%</span></div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${band === 'high' ? 'bg-emerald-500' : band === 'moderate' ? 'bg-amber-400' : 'bg-rose-500'}`} style={{ width: `${pct}%` }} />
          </div>
          {band === 'moderate' && <div className="mt-1 text-xs text-amber-700">Moderate confidence. Consider additional images.</div>}
          {band === 'low' && <div className="mt-1 text-xs text-rose-700">Low confidence. AI cannot reliably assess this image.</div>}
          {r.variation_warning && <div className="mt-1 text-xs text-amber-700">The images show considerable variation. Please upload additional representative samples.</div>}
        </div>
        {r.per_image.length > 1 && (
          <div className="mt-3 text-xs text-slate-600">
            Batch summary — {(['A', 'B', 'C'] as Grade[]).map((g) => `${gradeLabel[g]}: ${Math.round((r.per_image.filter((p) => p.grade === g).length / r.per_image.length) * 100)}%`).join(' · ')}
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">This is an AI-assisted visual estimate based on the uploaded image. It is not an official quality certificate or laboratory/APMC grading result.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card space-y-2.5">
          <h3 className="font-semibold text-slate-900">{t('breakdown')}</h3>
          {Object.entries(r.parameters).map(([k, v]) => <Bar key={k} label={PARAM_LABEL[k]} value={v} />)}
          <Bar label="Overall Visual Quality" value={r.visual_quality_score} />
        </div>
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-semibold text-slate-900">{t('issues')}</h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {r.detected_issues.map((i) => <li key={i} className="flex gap-2"><span className="text-slate-400">•</span>{i}</li>)}
            </ul>
          </div>
          <div className="card">
            <h3 className="font-semibold text-slate-900">{t('why')}</h3>
            <div className="mt-2 text-xs font-semibold uppercase text-emerald-700">Positive factors</div>
            <ul className="mt-1 space-y-0.5 text-sm">
              {r.positive_factors.length ? r.positive_factors.map((f) => <li key={f} className="flex gap-2 text-slate-700"><Check size={14} className="mt-0.5 text-emerald-600" />{f}</li>) : <li className="text-slate-500">—</li>}
            </ul>
            <div className="mt-3 text-xs font-semibold uppercase text-amber-700">Factors reducing grade</div>
            <ul className="mt-1 space-y-0.5 text-sm">
              {r.negative_factors.length ? r.negative_factors.map((f) => <li key={f} className="flex gap-2 text-slate-700"><AlertTriangle size={14} className="mt-0.5 text-amber-500" />{f}</li>) : <li className="text-slate-500">None significant</li>}
            </ul>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold text-slate-900">Grade Comparison & Selling Strategy Impact</h3>
        <table className="mt-2 w-full text-left text-sm">
          <thead className="text-xs text-slate-500"><tr><th className="py-1">Grade</th><th>Visual Quality</th><th>Potential price impact</th></tr></thead>
          <tbody>
            {([['A', 'Excellent', 'Higher price potential'], ['B', 'Good', 'Normal market price'], ['C', 'Below average', 'Lower price potential']] as [Grade, string, string][]).map(([g, q, p]) => (
              <tr key={g} className={`border-t border-slate-100 ${g === r.predicted_grade ? 'bg-emerald-50 font-semibold' : ''}`}>
                <td className="py-1.5">{gradeLabel[g]} {g === r.predicted_grade && <Badge tone="green">your estimate</Badge>}</td><td>{q}</td><td>{p}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
          <div className="text-xs font-semibold uppercase text-emerald-700">Recommended action</div>
          {r.recommendation}
          <ol className="mt-2 list-decimal pl-5 text-xs">
            <li>Keep produce properly sorted.</li><li>Remove visibly damaged pieces.</li><li>Maintain clean packaging.</li><li>Compare current mandi/e-NAM bids.</li><li>Sell when market conditions are favourable.</li>
          </ol>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 p-3">
          <div className="text-sm font-semibold text-slate-900">What if my produce gets a different grade? <span className="text-xs font-normal text-slate-500">(illustrative estimate)</span></div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-slate-600">Quantity (kg)
              <input type="number" className="input mt-1" value={qtyKg} min={1} onChange={(e) => setQtyKg(Number(e.target.value))} />
            </label>
            <label className="text-xs text-slate-600">Current market price (₹/kg){cropInFeed && !customPrice ? ' — from UP feed' : ''}
              <input type="number" className="input mt-1" placeholder={cropInFeed ? (todayPrice / 100).toFixed(2) : 'enter price'} value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} />
            </label>
          </div>
          {basePerKg > 0 ? (
            <div className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
              {(['A', 'B', 'C'] as Grade[]).map((g) => (
                <div key={g} className={`rounded-lg p-2 ${g === r.predicted_grade ? 'bg-emerald-100' : 'bg-slate-50'}`}>
                  <div className="text-xs text-slate-500">Grade {g} · ₹{(basePerKg * premium[g] / premium.B).toFixed(2)}/kg</div>
                  <div className="font-bold text-slate-900">{fmt(Math.round(qtyKg * basePerKg * premium[g] / premium.B))}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2 text-xs text-slate-500">Enter a current market price to see illustrative revenue by grade.</div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn-primary" onClick={onUseGrade}><Check size={16} /> {t('useGrade')}</button>
          <button className="btn-secondary" onClick={onCompareMarkets}>Compare Market Prices</button>
          <button className="btn-secondary" onClick={downloadReport}><Download size={14} /> Download Report</button>
        </div>
        <p className="mt-2 text-xs text-slate-500">AI visual grade = preliminary estimate. Official APMC/e-NAM grading = final accepted grade.</p>
      </div>
    </>
  )
}
