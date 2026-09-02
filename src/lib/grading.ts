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

export const ANALYSIS_STEPS = [
  'Image received',
  'Detecting produce',
  'Analyzing visible quality characteristics',
  'Estimating quality grade',
  'Generating selling insights',
]

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

export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('Could not read file'))
    r.readAsDataURL(file)
  })
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
    const per: { score: number; grade: Grade; confidence: number; params: GradingParameters }[] = []
    for (const img of req.images) {
      onStep?.(1)
      const s = await pixelStats(img)
      if (s.coverage < 0.05) throw new Error('PRODUCE_NOT_DETECTED')
      onStep?.(2)
      const clamp = (v: number) => Math.max(40, Math.min(98, Math.round(v)))
      const params: GradingParameters = {
        appearance: clamp(70 + (s.brightness - 120) / 6 + s.sharpness),
        color_uniformity: clamp(96 - s.colorVar * 120),
        surface_condition: clamp(95 - s.darkSpots * 160),
        visible_defects: clamp(93 - s.darkSpots * 120 - Math.max(0, 0.25 - s.colorVar) * 20),
        uniformity: clamp(88 - Math.abs(s.colorVar - 0.15) * 60 + s.coverage * 6),
      }
      onStep?.(3)
      const score = Math.round((params.appearance + params.color_uniformity + params.surface_condition + params.visible_defects + params.uniformity) / 5)
      const confidence = Math.min(0.9, 0.55 + Math.min(s.sharpness, 12) / 40 + Math.min(s.coverage, 0.6) / 3)
      per.push({ score, grade: scoreToGrade(score), confidence, params })
    }
    onStep?.(4)
    return aggregate(req.crop, per, 'demo')
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
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
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
      if (!res.ok) throw new Error('API_FAILURE')
      onStep?.(2)
      const json = (await res.json()) as { choices: { message: { content: string } }[] }
      const parsed = JSON.parse(json.choices[0]?.message.content ?? '{}') as { produce_detected?: boolean; parameters?: GradingParameters; confidence?: number }
      if (!parsed.produce_detected || !parsed.parameters) throw new Error('PRODUCE_NOT_DETECTED')
      onStep?.(3)
      const p = parsed.parameters
      const score = Math.round((p.appearance + p.color_uniformity + p.surface_condition + p.visible_defects + p.uniformity) / 5)
      onStep?.(4)
      return aggregate(req.crop, [{ score, grade: scoreToGrade(score), confidence: parsed.confidence ?? 0.7, params: p }], 'openai-vision')
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
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req) })
      if (!res.ok) throw new Error('API_FAILURE')
      onStep?.(4)
      return { ...((await res.json()) as GradingResult), source: 'api' }
    },
  }
}

export function pickService(apiKey: string): QualityGradingService {
  const endpoint = import.meta.env.VITE_GRADING_API as string | undefined
  if (endpoint) return remoteApiService(endpoint)
  if (apiKey) return openAIVisionService(apiKey)
  return demoService
}

export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : ''
  if (msg === 'PRODUCE_NOT_DETECTED') return 'We could not clearly detect produce in this photo. Please place the produce in the centre against a plain background.'
  return "We couldn't analyze this image right now. Please try again with a clearer photo."
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
