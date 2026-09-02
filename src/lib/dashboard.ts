import { HISTORY_DAYS } from './data'
import { buildOptions, fmt, predictPrice, rankOptions } from './engine'
import type { CleanMarket, FarmerConstraints, FarmerInput, Option } from './types'
import { UP_DISTRICT_NAMES } from './up'

// Indicative cost of cultivation per quintal (₹), used for profit/loss.
export const PRODUCTION_COST: Record<string, number> = {
  Wheat: 1500,
  'Rice (Paddy)': 1650,
  Sugarcane: 240,
  Potato: 650,
  Mustard: 3400,
  Maize: 1350,
  'Pulses (Arhar)': 4600,
  Mango: 1700,
}

export interface WeeklyPoint {
  week: number // weeks ago (negative), 0 = current week
  label: string
  avg: number
  min: number
  max: number
  [market: string]: number | string
}

// 6-month history aggregated to weekly points: market-wide avg/min/max plus the top markets' own lines.
export function sixMonthSeries(markets: CleanMarket[], crop: string, highlight: CleanMarket[]): WeeklyPoint[] {
  const weeks = Math.floor(HISTORY_DAYS / 7)
  const out: WeeklyPoint[] = []
  for (let w = -weeks; w <= 0; w++) {
    const dayFrom = w * 7 - 6
    const dayTo = w * 7
    const all: number[] = []
    const perMarket: Record<string, number[]> = {}
    for (const m of markets) {
      for (const p of m.history[crop]) {
        if (p.day >= dayFrom && p.day <= dayTo) {
          all.push(p.price)
          if (highlight.includes(m)) (perMarket[m.name] ??= []).push(p.price)
        }
      }
    }
    if (!all.length) continue
    const point: WeeklyPoint = {
      week: w,
      label: w === 0 ? 'Now' : `${-w}w ago`,
      avg: Math.round(all.reduce((a, b) => a + b, 0) / all.length),
      min: Math.min(...all),
      max: Math.max(...all),
    }
    for (const [name, arr] of Object.entries(perMarket)) point[name] = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
    out.push(point)
  }
  return out
}

export interface ProfitLoss {
  option: Option
  productionCost: number
  sellingCosts: number
  profit: number
  marginPct: number
  perQuintal: number
}

export function profitLoss(input: FarmerInput, options: Option[]): ProfitLoss[] {
  const productionCost = (PRODUCTION_COST[input.crop] ?? 1000) * input.quantityQuintal
  return options.map((o) => {
    const sellingCosts = o.transportCost + o.storageCost + o.otherCosts
    const profit = o.netReturn - productionCost
    return {
      option: o,
      productionCost,
      sellingCosts,
      profit,
      marginPct: o.revenue ? Math.round((profit / o.revenue) * 100) : 0,
      perQuintal: Math.round(profit / input.quantityQuintal),
    }
  })
}

export interface GrowthOutlook {
  sixMonthChangePct: number
  monthlyChangePct: number
  forecast30: number
  forecast60: number
  forecast90: number
  currentAvg: number
  trend: 'rising' | 'falling' | 'stable'
  bestHoldDays: number
  advice: string[]
  levers: { title: string; gain: string; text: string }[]
}

export function growthOutlook(markets: CleanMarket[], crop: string, series: WeeklyPoint[], grade: FarmerInput['grade']): GrowthOutlook {
  const first = series[0]?.avg ?? 0
  const last = series[series.length - 1]?.avg ?? 0
  const monthAgo = series[Math.max(0, series.length - 5)]?.avg ?? first
  const sixMonthChangePct = first ? Math.round(((last - first) / first) * 100) : 0
  const monthlyChangePct = monthAgo ? Math.round(((last - monthAgo) / monthAgo) * 1000) / 10 : 0

  // Aggregate forecast: average each market's 90-day model
  const horizons = [30, 60, 90]
  const agg = [0, 0, 0]
  let bestHold = 0
  let trendVotes = 0
  for (const m of markets) {
    const f = predictPrice(m.history[crop], 90)
    horizons.forEach((h, i) => (agg[i] += f.forecast[h].price))
    bestHold += f.bestDay
    trendVotes += f.trend === 'rising' ? 1 : f.trend === 'falling' ? -1 : 0
  }
  const n = Math.max(1, markets.length)
  const [forecast30, forecast60, forecast90] = agg.map((v) => Math.round(v / n))
  const trend: GrowthOutlook['trend'] = trendVotes > n / 4 ? 'rising' : trendVotes < -n / 4 ? 'falling' : 'stable'
  const bestHoldDays = Math.round(bestHold / n)

  const advice: string[] = []
  if (trend === 'rising') {
    advice.push(
      `Average ${crop} prices across UP are rising (${monthlyChangePct > 0 ? '+' : ''}${monthlyChangePct}% in the last month). Models expect ~₹${fmt(forecast30)}/q in 30 days and ~₹${fmt(forecast90)}/q in 90 days.`,
    )
    advice.push(`If you have safe storage, holding ~${Math.max(7, bestHoldDays)} days should capture the upswing; sell in tranches to reduce risk.`)
  } else if (trend === 'falling') {
    advice.push(
      `Average prices are softening (${monthlyChangePct}% in the last month; forecast ~₹${fmt(forecast30)}/q in 30 days). Sell soon rather than holding stock.`,
    )
    advice.push('Target the high-price districts on the map and negotiate with buyers now, before arrivals increase further.')
  } else {
    advice.push(`Prices are broadly stable (${monthlyChangePct}% over the month; 6-month change ${sixMonthChangePct}%). Timing matters less than choosing the right market and grade.`)
    advice.push('Focus on reducing transport/commission costs and selling where local demand is highest.')
  }

  const gradeGain = grade === 'A' ? 'already captured' : grade === 'B' ? '+6–8%' : '+10–18%'
  const levers = [
    { title: 'Sort & grade the lot', gain: gradeGain, text: 'Cleaning, sizing and packing to Grade-A standards attracts a premium at every mandi and buyer.' },
    { title: 'Aggregate via FPO', gain: '+3–6%', text: 'Pooling with an FPO lets you sell truckload lots directly to institutional buyers and skip commission agents.' },
    { title: 'Sell in deficit districts', gain: '+4–10%', text: 'Districts shown in dark green on the map have higher prices because arrivals are low there — transport cost is often worth it.' },
    { title: 'Time the sale', gain: trend === 'rising' ? `+${Math.max(1, Math.round(((forecast30 - last) / Math.max(1, last)) * 100))}% / 30 d` : 'sell now', text: 'Use the 6-month trend and the forecast to hold or release stock; avoid selling in the peak-arrival weeks right after harvest.' },
    { title: 'e-NAM online bidding', gain: '+2–5%', text: 'Assayed lots on e-NAM receive bids from buyers across UP, so price discovery is more competitive than a single yard.' },
  ]

  return { sixMonthChangePct, monthlyChangePct, forecast30, forecast60, forecast90, currentAvg: last, trend, bestHoldDays, advice, levers }
}

export interface DistrictResult {
  district: string
  best: Option
  ranked: Option[]
  priceLevel: number // ₹/q achievable expected price from this district
}

// For every UP district: what a farmer located there would get (best market, price, net return).
export function districtResults(input: FarmerInput, constraints: FarmerConstraints, markets: CleanMarket[]): Record<string, DistrictResult> {
  const out: Record<string, DistrictResult> = {}
  for (const district of UP_DISTRICT_NAMES) {
    const ranked = rankOptions(buildOptions({ ...input, location: district }, constraints, markets))
    const best = ranked[0]
    if (!best) continue
    out[district] = { district, best, ranked, priceLevel: best.expectedPrice }
  }
  return out
}
