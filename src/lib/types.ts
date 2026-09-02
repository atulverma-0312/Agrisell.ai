export type Grade = 'A' | 'B' | 'C'

export interface FarmerInput {
  crop: string
  quantityQuintal: number
  grade: Grade
  location: string
}

export interface FarmerConstraints {
  sellingDeadlineDays: number
  storageCapacityQuintal: number
  budgetInr: number
  transportLimitKm: number
}

export interface PricePoint {
  day: number // days ago (negative) or ahead (positive); 0 = today
  price: number // INR per quintal
}

export interface RawMarket {
  id: string
  name: string
  type: 'Mandi' | 'e-NAM' | 'Buyer' | 'FPO'
  district: string
  distanceKm: Record<string, number>
  history: Record<string, PricePoint[]>
  demandQuintal: Record<string, number>
  buyer?: string
  reliability: number // 0..1
  feesPct: number
  storagePerQuintalPerDay: number
  gradePremium: Record<Grade, number>
  hasStorage: boolean
  source: string
  raw?: boolean
}

export interface CleanMarket extends RawMarket {
  issuesFixed: string[]
}

export interface ProcessingReport {
  fetched: number
  cleaned: number
  rejected: number
  fixes: string[]
  markets: CleanMarket[]
}

export interface PriceModelResult {
  today: number
  forecast: PricePoint[]
  slopePerDay: number
  trend: 'rising' | 'falling' | 'stable'
  bestDay: number
  bestPrice: number
  volatility: number
}

export interface Option {
  market: CleanMarket
  distanceKm: number
  price: PriceModelResult
  expectedPrice: number
  sellDay: number
  demandScore: number
  demandCoverage: number
  transportCost: number
  storageCost: number
  otherCosts: number
  revenue: number
  netReturn: number
  suitabilityScore: number
  aiScore: number
  confidence: number
  feasible: boolean
  infeasibleReasons: string[]
}

export interface Recommendation {
  ranked: Option[]
  best: Option | null
  reason: string
  risk: 'Low' | 'Medium' | 'High'
}
