import type { Grade } from './types'

/**
 * AI Quality Grading service layer.
 *
 * The UI only talks to the `QualityGradingService` interface, so the model behind it can be
 * swapped (demo → OpenAI vision → own FastAPI/PyTorch model at POST /api/quality/analyze)
 * without touching components.
 */

export const GRADING_CROPS = [
  'Wheat',
  'Rice (Paddy)',
  'Maize',
  'Potato',
  'Onion',
  'Tomato',
  'Apple',
  'Mango',
  'Banana',
  'Mustard',
  'Cotton',
  'Pulses (Arhar)',
  'Sugarcane',
  'Other',
] as const

export const SUPPORTED_TYPES = ['image/jpeg', 'image/png']
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const MAX_IMAGES = 5

export const CONFIDENCE_THRESHOLDS = { high: 0.8, moderate: 0.6 } // configurable

export interface GradingParameters {
  appearance: number
  color_uniformity: number
  surface_condition: number
  visible_defects: number
  uniformity: number
}

export interface GradingRequest {
  crop: string
  variety?: string
  location?: string
  harvestDate?: string
  images: string[] // data URLs
}

export interface GradingResult {
  crop: string
  predicted_grade: Grade
  visual_quality_score: number // 0..100
  confidence: number // 0..1
  parameters: GradingParameters
  detected_issues: string[]
  positive_factors: string[]
  negative_factors: string[]
  recommendation: string
  produce_detected: boolean
  per_image: { score: number; grade: Grade; confidence: number }[]
  variation_warning: boolean
  source: 'demo' | 'openai-vision' | 'api'
}

export interface QualityGradingService {
  readonly name: string
  readonly isDemo: boolean
  analyze(req: GradingRequest, onStep?: (step: number) => void): Promise<GradingResult>
}

export interface Assessment extends GradingResult {
  id: string
  createdAt: number
  variety?: string
  location?: string
  thumbnail: string
  imageCount: number
}

/** Object handed from the grading module to the Selling Strategy Simulator. */
export interface SharedAssessment {
  assessmentId: string
  crop: string
  variety?: string
  quantityKg: number
  predictedGrade: Grade
  qualityScore: number
  confidence: number
  parameters: GradingParameters
  detectedIssues: string[]
  positiveFactors: string[]
  source: GradingResult['source']
  timestamp: number
}

export function toShared(a: Assessment, quantityKg: number): SharedAssessment {
  return {
    assessmentId: a.id,
    crop: a.crop,
    variety: a.variety,
    quantityKg,
    predictedGrade: a.predicted_grade,
    qualityScore: a.visual_quality_score,
    confidence: a.confidence,
    parameters: a.parameters,
    detectedIssues: a.detected_issues,
    positiveFactors: a.positive_factors,
    source: a.source,
    timestamp: a.createdAt,
  }
}

/**
 * Processing stages shown while a request is in flight. Services report the index they have
 * genuinely reached; a single-response backend only reports 0 (sent), 2 (response received)
 * and 7 (parsed), and the UI labels intermediate items as "processing" rather than verified.
 */
export const ANALYSIS_STEPS = [
  'Image received',
  'Image quality validated',
  'Detecting produce',
  'Identifying visible characteristics',
  'Detecting visible defects',
  'Calculating quality score',
  'Predicting grade',
  'Generating explanation',
]

export type GradingErrorKind = 'produce_not_detected' | 'api' | 'network' | 'timeout' | 'not_configured'

export class GradingError extends Error {
  kind: GradingErrorKind
  constructor(kind: GradingErrorKind, detail?: string) {
    super(detail ?? kind)
    this.kind = kind
  }
}

export type AiMode = 'demo' | 'production'
export function aiMode(): AiMode {
  return (import.meta.env.VITE_AI_MODE as string | undefined) === 'production' ? 'production' : 'demo'
}

const REQUEST_TIMEOUT_MS = 45_000

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw new GradingError('timeout')
    throw new GradingError('network', e instanceof Error ? e.message : undefined)
  } finally {
    clearTimeout(timer)
  }
}

/* ---------------- image validation ---------------- */

export interface ImageCheck {
  ok: boolean
  problems: string[]
  brightness: number
  sharpness: number
  coverage: number
}

export function validateFile(file: File): string | null {
  if (!SUPPORTED_TYPES.includes(file.type)) return 'Unsupported format. Please upload a JPG, JPEG or PNG image.'
  if (file.size > MAX_IMAGE_BYTES) return 'Image is larger than 10 MB. Please upload a smaller photo.'
  if (file.size === 0) return 'The file is empty.'
  return null
}

export function readAsDataUrl(file: File, onProgress?: (fraction: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onprogress = (ev) => {
      if (ev.lengthComputable) onProgress?.(ev.loaded / ev.total)
    }
    r.onload = () => {
      onProgress?.(1)
      resolve(String(r.result))
    }
    r.onerror = () => reject(new Error('Could not read file'))
    r.readAsDataURL(file)
  })
}

export const VALIDATION_CHECKS = ['File format', 'Resolution', 'Image integrity', 'Image quality', 'Produce visibility'] as const
export type ValidationCheck = (typeof VALIDATION_CHECKS)[number]
export type CheckState = 'pending' | 'running' | 'passed' | 'failed'

/**
 * Runs the validation checks sequentially and reports each one as it truly completes.
 * Resolves with the final ImageCheck (ok=false when any check failed).
 */
export async function validateImageStaged(file: File, dataUrl: string, onCheck: (check: ValidationCheck, state: CheckState) => void): Promise<ImageCheck> {
  const problems: string[] = []
  const fail = (check: ValidationCheck, msg: string) => {
    problems.push(msg)
    onCheck(check, 'failed')
  }

  onCheck('File format', 'running')
  const fmtErr = validateFile(file)
  if (fmtErr) fail('File format', fmtErr)
  else onCheck('File format', 'passed')

  onCheck('Image integrity', 'running')
  let img: HTMLImageElement | null = null
  try {
    img = await loadImage(dataUrl)
    onCheck('Image integrity', 'passed')
  } catch {
    fail('Image integrity', 'The file could not be decoded as an image.')
  }
  if (!img) {
    onCheck('Resolution', 'failed')
    onCheck('Image quality', 'failed')
    onCheck('Produce visibility', 'failed')
    return { ok: false, problems, brightness: 0, sharpness: 0, coverage: 0 }
  }

  onCheck('Resolution', 'running')
  if (img.naturalWidth < 200 || img.naturalHeight < 200) fail('Resolution', 'Image resolution is too low.')
  else onCheck('Resolution', 'passed')

  onCheck('Image quality', 'running')
  const s = await pixelStats(dataUrl)
  const q: string[] = []
  if (s.brightness < 50) q.push('Image is too dark.')
  if (s.brightness > 235) q.push('Image is over-exposed.')
  if (s.sharpness < 3) q.push('Image appears blurry.')
  if (q.length) {
    problems.push(...q)
    onCheck('Image quality', 'failed')
  } else onCheck('Image quality', 'passed')

  onCheck('Produce visibility', 'running')
  if (s.coverage < 0.15) fail('Produce visibility', 'Produce not clearly visible / does not fill enough of the frame.')
  else onCheck('Produce visibility', 'passed')

  return { ok: problems.length === 0, problems, brightness: s.brightness, sharpness: s.sharpness, coverage: s.coverage }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Invalid image'))
    img.src = src
  })
}

/** Pixel statistics used for both the image-quality check and the demo grader. */
export interface PixelStats {
  brightness: number // 0..255
  sharpness: number // mean abs luminance gradient
  coverage: number // fraction of non-background pixels
  colorVar: number // std-dev of hue-ish channel
  darkSpots: number // fraction of very dark pixels inside produce
  w: number
  h: number
}

export async function pixelStats(dataUrl: string): Promise<PixelStats> {
  const img = await loadImage(dataUrl)
  const S = 96
  const c = document.createElement('canvas')
  c.width = S
  c.height = S
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('Canvas unsupported')
  ctx.drawImage(img, 0, 0, S, S)
  const { data } = ctx.getImageData(0, 0, S, S)
  const lum = new Float32Array(S * S)
  let sum = 0
  const sat: number[] = []
  for (let i = 0; i < S * S; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2]
    const l = 0.299 * r + 0.587 * g + 0.114 * b
    lum[i] = l
    sum += l
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
    sat.push(mx === 0 ? 0 : (mx - mn) / mx)
  }
  const brightness = sum / (S * S)
  let grad = 0
  for (let y = 1; y < S; y++)
    for (let x = 1; x < S; x++) {
      const i = y * S + x
      grad += Math.abs(lum[i] - lum[i - 1]) + Math.abs(lum[i] - lum[i - S])
    }
  const sharpness = grad / ((S - 1) * (S - 1) * 2)
  // background = near-white or near-uniform low-saturation pixels
  let fg = 0, dark = 0
  for (let i = 0; i < S * S; i++) {
    const isBg = (lum[i] > 225 && sat[i] < 0.12) || (lum[i] < 20)
    if (!isBg) {
      fg++
      if (lum[i] < 60) dark++
    }
  }
  const coverage = fg / (S * S)
  const mean = sat.reduce((a, b) => a + b, 0) / sat.length
  const colorVar = Math.sqrt(sat.reduce((a, b) => a + (b - mean) ** 2, 0) / sat.length)
  return { brightness, sharpness, coverage, colorVar, darkSpots: fg ? dark / fg : 0, w: img.naturalWidth, h: img.naturalHeight }
}

export async function makeThumbnail(dataUrl: string, size = 96): Promise<string> {
  const img = await loadImage(dataUrl)
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')
  if (!ctx) return dataUrl
  const s = Math.min(img.naturalWidth, img.naturalHeight)
  ctx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size)
  return c.toDataURL('image/jpeg', 0.7)
}

export async function checkImageQuality(dataUrl: string): Promise<ImageCheck> {
  const s = await pixelStats(dataUrl)
  const problems: string[] = []
  if (s.w < 200 || s.h < 200) problems.push('Image resolution is too low.')
  if (s.brightness < 50) problems.push('Image is too dark.')
  if (s.brightness > 235) problems.push('Image is over-exposed.')
  if (s.sharpness < 3) problems.push('Image appears blurry.')
  if (s.coverage < 0.15) problems.push('Produce does not fill enough of the frame.')
  return { ok: problems.length === 0, problems, brightness: s.brightness, sharpness: s.sharpness, coverage: s.coverage }
}

/* ---------------- grade helpers ---------------- */

export function scoreToGrade(score: number): Grade {
  return score >= 80 ? 'A' : score >= 65 ? 'B' : 'C'
}

export function confidenceBand(c: number): 'high' | 'moderate' | 'low' {
  return c >= CONFIDENCE_THRESHOLDS.high ? 'high' : c >= CONFIDENCE_THRESHOLDS.moderate ? 'moderate' : 'low'
}

const ISSUE_TEXT: Record<keyof GradingParameters, [string, string]> = {
  appearance: ['Attractive overall appearance', 'Dull or uneven appearance'],
  color_uniformity: ['Good color uniformity', 'Slight color variation'],
  surface_condition: ['Clean surface appearance', 'Minor surface spots'],
  visible_defects: ['Low visible damage', 'Some visible damage or bruising'],
  uniformity: ['Consistent size', 'Some size variation'],
}

export function explain(params: GradingParameters) {
  const positive: string[] = []
  const negative: string[] = []
  const issues: string[] = []
  for (const k of Object.keys(params) as (keyof GradingParameters)[]) {
    const v = params[k]
    if (v >= 80) positive.push(ISSUE_TEXT[k][0])
    else {
      negative.push(ISSUE_TEXT[k][1])
      if (v < 75) issues.push(ISSUE_TEXT[k][1])
    }
  }
  if (issues.length === 0) issues.push('No major visible quality defects detected')
  return { positive, negative, issues }
}

export function recommendationFor(grade: Grade): string {
  if (grade === 'A') return 'Your produce appears visually suitable for the higher-quality market segment. Compare APMC/e-NAM bids before selling.'
  if (grade === 'B') return 'Your produce appears suitable for the standard market segment. Sorting out damaged pieces may lift part of the lot to Grade A.'
  return 'Visible defects are likely to lower the offered price. Consider sorting, cleaning and selling the better portion separately.'
}

function aggregate(crop: string, per: { score: number; grade: Grade; confidence: number; params: GradingParameters }[], source: GradingResult['source']): GradingResult {
  const n = per.length
  const avg = (f: (p: typeof per[number]) => number) => Math.round(per.reduce((a, p) => a + f(p), 0) / n)
  const params: GradingParameters = {
    appearance: avg((p) => p.params.appearance),
    color_uniformity: avg((p) => p.params.color_uniformity),
    surface_condition: avg((p) => p.params.surface_condition),
    visible_defects: avg((p) => p.params.visible_defects),
    uniformity: avg((p) => p.params.uniformity),
  }
  const score = avg((p) => p.score)
  const scores = per.map((p) => p.score)
  const spread = Math.max(...scores) - Math.min(...scores)
  const conf = Math.min(0.97, per.reduce((a, p) => a + p.confidence, 0) / n + (n > 1 ? 0.03 * (n - 1) : 0) - spread / 200)
  const grade = scoreToGrade(score)
  const { positive, negative, issues } = explain(params)
  return {
    crop,
    predicted_grade: grade,
    visual_quality_score: score,
    confidence: Math.max(0.3, Math.round(conf * 100) / 100),
    parameters: params,
    detected_issues: issues,
    positive_factors: positive,
    negative_factors: negative,
    recommendation: recommendationFor(grade),
    produce_detected: true,
    per_image: per.map(({ score, grade, confidence }) => ({ score, grade, confidence })),
    variation_warning: spread > 18,
    source,
  }
}

/* ---------------- Demo service (no model connected) ---------------- */

/**
 * Deterministic heuristic grader driven by real pixel statistics of the uploaded photo
 * (brightness, sharpness, saturation variance, dark-spot ratio). It is NOT a trained model and
 * results are always labelled "Demo AI Result".
 */
export const demoService: QualityGradingService = {
  name: 'Demo heuristic grader',
  isDemo: true,
  async analyze(req, onStep) {
    onStep?.(0)
    onStep?.(1)
    const per: { score: number; grade: Grade; confidence: number; params: GradingParameters }[] = []
    for (const img of req.images) {
      onStep?.(2)
      const s = await pixelStats(img)
      if (s.coverage < 0.05) throw new GradingError('produce_not_detected')
      onStep?.(3)
      const clamp = (v: number) => Math.max(40, Math.min(98, Math.round(v)))
      const params: GradingParameters = {
        appearance: clamp(70 + (s.brightness - 120) / 6 + s.sharpness),
        color_uniformity: clamp(96 - s.colorVar * 120),
        surface_condition: clamp(95 - s.darkSpots * 160),
        visible_defects: clamp(93 - s.darkSpots * 120 - Math.max(0, 0.25 - s.colorVar) * 20),
        uniformity: clamp(88 - Math.abs(s.colorVar - 0.15) * 60 + s.coverage * 6),
      }
      onStep?.(4)
      const score = Math.round((params.appearance + params.color_uniformity + params.surface_condition + params.visible_defects + params.uniformity) / 5)
      const confidence = Math.min(0.9, 0.55 + Math.min(s.sharpness, 12) / 40 + Math.min(s.coverage, 0.6) / 3)
      per.push({ score, grade: scoreToGrade(score), confidence, params })
      onStep?.(5)
    }
    onStep?.(6)
    const out = aggregate(req.crop, per, 'demo')
    onStep?.(7)
    return out
  },
}

/* ---------------- OpenAI vision service ---------------- */

export function openAIVisionService(apiKey: string): QualityGradingService {
  return {
    name: 'OpenAI vision (gpt-4o-mini)',
    isDemo: false,
    async analyze(req, onStep) {
      onStep?.(0)
      onStep?.(1)
      const prompt = `You are an agricultural produce visual grader for Indian APMC/e-NAM markets. Crop: ${req.crop}${req.variety ? `, variety ${req.variety}` : ''}. Assess ONLY visible characteristics. Reply with strict JSON: {"produce_detected":bool,"parameters":{"appearance":0-100,"color_uniformity":0-100,"surface_condition":0-100,"visible_defects":0-100,"uniformity":0-100},"confidence":0-1}. Do not assess moisture, chemicals, protein or contamination.`
      const res = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: prompt }, ...req.images.map((url) => ({ type: 'image_url', image_url: { url, detail: 'low' } }))],
            },
          ],
        }),
      })
      if (!res.ok) throw new GradingError('api', `HTTP ${res.status}`)
      onStep?.(2)
      const json = (await res.json()) as { choices: { message: { content: string } }[] }
      let parsed: { produce_detected?: boolean; parameters?: Partial<GradingParameters>; confidence?: number }
      try {
        parsed = JSON.parse(json.choices[0]?.message.content ?? '{}') as typeof parsed
      } catch {
        throw new GradingError('api', 'Malformed model response')
      }
      if (!parsed.produce_detected) throw new GradingError('produce_not_detected')
      const p = parsed.parameters
      const keys: (keyof GradingParameters)[] = ['appearance', 'color_uniformity', 'surface_condition', 'visible_defects', 'uniformity']
      if (!p || keys.some((k) => typeof p[k] !== 'number' || Number.isNaN(p[k]))) throw new GradingError('api', 'Incomplete parameters')
      const params = p as GradingParameters
      onStep?.(6)
      const score = Math.round(keys.reduce((a, k) => a + Math.max(0, Math.min(100, params[k])), 0) / keys.length)
      const conf = typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.7
      const out = aggregate(req.crop, [{ score, grade: scoreToGrade(score), confidence: conf, params }], 'openai-vision')
      onStep?.(7)
      return out
    },
  }
}

/** Future: own backend at POST /api/quality/analyze (FastAPI + PyTorch/YOLO). */
export function remoteApiService(endpoint: string): QualityGradingService {
  return {
    name: 'AgriSell grading API',
    isDemo: false,
    async analyze(req, onStep) {
      onStep?.(0)
      const res = await fetchWithTimeout(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req) })
      if (!res.ok) throw new GradingError('api', `HTTP ${res.status}`)
      onStep?.(2)
      const body = (await res.json()) as Partial<GradingResult> & { status?: string }
      if (body.status === 'produce_not_detected' || body.produce_detected === false) throw new GradingError('produce_not_detected')
      if (!body.predicted_grade || typeof body.visual_quality_score !== 'number' || typeof body.confidence !== 'number' || !body.parameters)
        throw new GradingError('api', 'Incomplete response')
      const { positive, negative, issues } = explain(body.parameters)
      onStep?.(7)
      return {
        crop: body.crop ?? req.crop,
        predicted_grade: body.predicted_grade,
        visual_quality_score: body.visual_quality_score,
        confidence: body.confidence,
        parameters: body.parameters,
        detected_issues: body.detected_issues ?? issues,
        positive_factors: body.positive_factors ?? positive,
        negative_factors: body.negative_factors ?? negative,
        recommendation: body.recommendation ?? recommendationFor(body.predicted_grade),
        produce_detected: true,
        per_image: body.per_image ?? [{ score: body.visual_quality_score, grade: body.predicted_grade, confidence: body.confidence }],
        variation_warning: body.variation_warning ?? false,
        source: 'api',
      }
    },
  }
}

const notConfiguredService: QualityGradingService = {
  name: 'AI service not configured',
  isDemo: false,
  analyze: () => Promise.reject(new GradingError('not_configured')),
}

/**
 * AI_MODE=demo (default): demo heuristic unless a real endpoint/key is present.
 * AI_MODE=production: never fall back to the demo grader.
 */
export function pickService(apiKey: string): QualityGradingService {
  const endpoint = import.meta.env.VITE_GRADING_API as string | undefined
  if (endpoint) return remoteApiService(endpoint)
  if (apiKey) return openAIVisionService(apiKey)
  return aiMode() === 'production' ? notConfiguredService : demoService
}

export function errorKind(e: unknown): GradingErrorKind {
  return e instanceof GradingError ? e.kind : 'api'
}

export function friendlyError(e: unknown): string {
  switch (errorKind(e)) {
    case 'produce_not_detected':
      return 'The selected produce could not be clearly identified in this image.'
    case 'network':
      return 'Connection interrupted. Please check your internet connection.'
    case 'timeout':
      return 'The AI service took too long to respond.'
    case 'not_configured':
      return 'The AI grading service is not configured yet. Please contact support.'
    default:
      return "We couldn't complete the AI analysis."
  }
}

/* ---------------- draft (resume unfinished session) ---------------- */

export interface Draft {
  crop: string
  variety: string
  location: string
  harvest: string
  savedAt: number
}

const DRAFT_KEY = 'agrisell.grading_draft'

export function loadDraft(): Draft | null {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as Draft | null
    return d && d.crop ? d : null
  } catch {
    return null
  }
}
export function saveDraft(d: Omit<Draft, 'savedAt'>) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...d, savedAt: Date.now() }))
}
export function clearDraft() {
  localStorage.removeItem(DRAFT_KEY)
}

/* ---------------- history (browser storage) ---------------- */

const HISTORY_KEY = 'agrisell.grading_history'

export function loadHistory(): Assessment[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as Assessment[]
  } catch {
    return []
  }
}

export function saveHistory(list: Assessment[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 20)))
}
