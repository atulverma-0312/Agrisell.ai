import { LOGISTICS, MISC, fetchRawFeed } from './data'
import type {
  CleanMarket,
  FarmerConstraints,
  FarmerInput,
  Option,
  PriceModelResult,
  PricePoint,
  ProcessingReport,
  RawMarket,
  Recommendation,
} from './types'

// ---------- Step 3: Data Integration ----------
export function integrateData(): RawMarket[] {
  return fetchRawFeed()
}

// ---------- Step 4: Data Processing (cleaning, validation, normalization) ----------
export function processData(raw: RawMarket[], crop: string): ProcessingReport {
  const fixes: string[] = []
  const seen = new Set<string>()
  const markets: CleanMarket[] = []
  let rejected = 0

  for (const m of raw) {
    if (seen.has(m.id)) {
      fixes.push(`Removed duplicate record for ${m.name}`)
      continue
    }
    seen.add(m.id)

    const issues: string[] = []
    const hist = m.history[crop]
    if (!hist || Object.keys(m.demandQuintal).length === 0) {
      fixes.push(`Rejected ${m.name}: missing demand/price data (validation failed)`)
      rejected++
      continue
    }

    // Fill missing values via linear interpolation
    const filled: PricePoint[] = hist.map((p, i) => {
      if (Number.isFinite(p.price)) return p
      const prev = hist.slice(0, i).reverse().find((q) => Number.isFinite(q.price))?.price
      const next = hist.slice(i + 1).find((q) => Number.isFinite(q.price))?.price
      issues.push(`Interpolated missing price on day ${p.day}`)
      return { day: p.day, price: Math.round(((prev ?? next ?? 0) + (next ?? prev ?? 0)) / 2) }
    })

    // Outlier normalization (unit mismatch / spikes) via median absolute deviation
    const prices = [...filled.map((p) => p.price)].sort((a, b) => a - b)
    const median = prices[Math.floor(prices.length / 2)]
    const normalized = filled.map((p) => {
      if (p.price > median * 3 || p.price < median / 3) {
        issues.push(`Normalized outlier ₹${p.price} → ₹${median} on day ${p.day}`)
        return { day: p.day, price: median }
      }
      return p
    })

    if (issues.length) fixes.push(`${m.name}: ${issues.length} value(s) cleaned`)
    markets.push({ ...m, history: { ...m.history, [crop]: normalized }, issuesFixed: issues })
  }

  return { fetched: raw.length, cleaned: markets.length, rejected, fixes, markets }
}

// ---------- Step 5a: AI Price Model (linear trend + Holt exponential smoothing ensemble) ----------
export function predictPrice(history: PricePoint[], horizonDays: number): PriceModelResult {
  const n = history.length
  const xs = history.map((p) => p.day)
  const ys = history.map((p) => p.price)
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    den += (xs[i] - mx) ** 2
  }
  const slope = den === 0 ? 0 : num / den
  const intercept = my - slope * mx

  // Holt's double exponential smoothing
  const alpha = 0.5
  const beta = 0.3
  let level = ys[0]
  let trend = ys[1] - ys[0]
  for (let i = 1; i < n; i++) {
    const prevLevel = level
    level = alpha * ys[i] + (1 - alpha) * (level + trend)
    trend = beta * (level - prevLevel) + (1 - beta) * trend
  }

  const residuals = ys.map((y, i) => y - (intercept + slope * xs[i]))
  const volatility = Math.sqrt(residuals.reduce((a, r) => a + r * r, 0) / n) / my

  const forecast: PricePoint[] = []
  const anchor = 0.5 * intercept + 0.5 * level
  const blendedSlope = 0.5 * slope + 0.5 * trend
  for (let d = 0; d <= horizonDays; d++) {
    // Dampen long-horizon trend to avoid runaway extrapolation
    const damp = 1 / (1 + d / 30)
    forecast.push({ day: d, price: Math.round(anchor + blendedSlope * d * damp) })
  }

  const today = forecast[0].price
  let best = forecast[0]
  for (const p of forecast) if (p.price > best.price) best = p
  const pct = (slope * 7) / my
  return {
    today,
    forecast,
    slopePerDay: slope,
    trend: pct > 0.01 ? 'rising' : pct < -0.01 ? 'falling' : 'stable',
    bestDay: best.day,
    bestPrice: best.price,
    volatility,
  }
}

// ---------- Step 5b: Demand analysis ----------
export function analyseDemand(market: CleanMarket, crop: string, quantity: number) {
  const demand = market.demandQuintal[crop] ?? 0
  const coverage = Math.min(1, demand / Math.max(1, quantity))
  // Market appetite: how much of the market's demand we'd saturate (lower is better for price stability)
  const saturation = quantity / Math.max(1, demand)
  const score = Math.round(100 * (0.7 * coverage + 0.3 * Math.max(0, 1 - saturation)))
  return { demand, coverage, score }
}

// ---------- Step 5c: Logistics cost engine ----------
export function logisticsCost(distanceKm: number, quantity: number) {
  const trips = Math.ceil(quantity / LOGISTICS.truckCapacityQuintal)
  const variable = distanceKm * quantity * LOGISTICS.ratePerQuintalKm
  const loading = quantity * LOGISTICS.loadingPerQuintal
  return Math.round(variable + loading + trips * LOGISTICS.fixedTrip)
}

// ---------- Step 5d + 6 + 7: matching, economics, AI ranking ----------
export function buildOptions(
  input: FarmerInput,
  constraints: FarmerConstraints,
  markets: CleanMarket[],
): Option[] {
  return markets.map((m) => {
    const distanceKm = m.distanceKm[input.location] ?? 9999
    const price = predictPrice(m.history[input.crop], constraints.sellingDeadlineDays)

    // Choose sell day: best forecast day within deadline, but only if storage is feasible
    const canStore = input.quantityQuintal <= constraints.storageCapacityQuintal || m.hasStorage
    const sellDay = canStore ? price.bestDay : 0
    const basePrice = canStore ? price.bestPrice : price.today
    const expectedPrice = Math.round(basePrice * m.gradePremium[input.grade])

    const { coverage, score: demandScore } = analyseDemand(m, input.crop, input.quantityQuintal)
    const sellableQty = Math.round(input.quantityQuintal * Math.max(coverage, 0.35))

    const revenue = sellableQty * expectedPrice
    const transportCost = logisticsCost(distanceKm, input.quantityQuintal)
    const storageRate = m.hasStorage && input.quantityQuintal > constraints.storageCapacityQuintal ? m.storagePerQuintalPerDay : 1.2
    const storageCost = Math.round(sellDay * input.quantityQuintal * storageRate)
    const otherCosts = Math.round(
      revenue * ((m.feesPct + MISC.commissionAgentPct + MISC.gstPct) / 100) + input.quantityQuintal * MISC.weighingPerQuintal,
    )
    const netReturn = revenue - transportCost - storageCost - otherCosts

    const infeasibleReasons: string[] = []
    if (distanceKm > constraints.transportLimitKm) infeasibleReasons.push(`Distance ${distanceKm} km exceeds transport limit`)
    if (transportCost + storageCost > constraints.budgetInr) infeasibleReasons.push('Upfront transport + storage exceeds budget')
    if (sellDay > constraints.sellingDeadlineDays) infeasibleReasons.push('Suggested sell day is after deadline')

    const suitabilityScore = Math.round(
      100 * (0.4 * m.reliability + 0.3 * coverage + 0.3 * Math.max(0, 1 - distanceKm / 1500)),
    )

    return {
      market: m,
      distanceKm,
      price,
      expectedPrice,
      sellDay,
      demandScore,
      demandCoverage: coverage,
      transportCost,
      storageCost,
      otherCosts,
      revenue,
      netReturn,
      suitabilityScore,
      aiScore: 0,
      confidence: 0,
      feasible: infeasibleReasons.length === 0,
      infeasibleReasons,
    }
  })
}

export function rankOptions(options: Option[]): Option[] {
  const feasible = options.filter((o) => o.feasible)
  const pool = feasible.length ? feasible : options
  const maxNet = Math.max(...pool.map((o) => o.netReturn), 1)
  const minNet = Math.min(...pool.map((o) => o.netReturn), 0)

  const scored = options.map((o) => {
    const netNorm = (o.netReturn - minNet) / Math.max(1, maxNet - minNet)
    const riskPenalty = o.price.volatility * 2 + (1 - o.market.reliability)
    // Multi-criteria utility: profit, suitability, demand, minus risk
    const aiScore = Math.round(
      100 * Math.max(0, 0.55 * netNorm + 0.2 * (o.suitabilityScore / 100) + 0.15 * (o.demandScore / 100) - 0.1 * riskPenalty),
    )
    const confidence = Math.round(
      100 * Math.max(0.2, Math.min(0.98, o.market.reliability * (1 - o.price.volatility * 3) * (0.7 + 0.3 * o.demandCoverage))),
    )
    return { ...o, aiScore: o.feasible ? aiScore : Math.round(aiScore * 0.4), confidence }
  })

  return scored.sort((a, b) => Number(b.feasible) - Number(a.feasible) || b.aiScore - a.aiScore)
}

// ---------- Step 8: AI-generated recommendation reasoning ----------
export function buildRecommendation(input: FarmerInput, constraints: FarmerConstraints, ranked: Option[]): Recommendation {
  const best = ranked[0] ?? null
  if (!best) return { ranked, best: null, reason: 'No market data available.', risk: 'High' }

  const second = ranked[1]
  const parts: string[] = []
  parts.push(
    `${best.market.name} scores highest overall (${best.aiScore}/100) with an estimated net return of ₹${fmt(best.netReturn)} for your ${input.quantityQuintal} quintals of Grade-${input.grade} ${input.crop}.`,
  )
  if (best.price.trend === 'rising' && best.sellDay > 0) {
    parts.push(
      `Prices there are trending up (~₹${Math.abs(Math.round(best.price.slopePerDay * 7))}/quintal per week), so holding for ${best.sellDay} day(s) is expected to lift the price to ₹${fmt(best.expectedPrice)}.`,
    )
  } else if (best.price.trend === 'falling') {
    parts.push(`Prices are softening, so selling immediately locks in ₹${fmt(best.expectedPrice)} before further decline.`)
  } else {
    parts.push(`Prices are stable, so timing risk is low; ₹${fmt(best.expectedPrice)} is a reliable expectation.`)
  }
  parts.push(
    `Transport is ${best.distanceKm} km (₹${fmt(best.transportCost)}), well within your ${constraints.transportLimitKm} km limit, and the buyer covers ${Math.round(best.demandCoverage * 100)}% of your quantity with a ${Math.round(best.market.reliability * 100)}% reliability record.`,
  )
  if (second) {
    const diff = best.netReturn - second.netReturn
    if (diff >= 0) {
      parts.push(
        `It beats ${second.market.name} by ₹${fmt(diff)}${diff < best.netReturn * 0.05 ? ' — a narrow margin, so consider negotiating with both.' : '.'}`,
      )
    } else {
      parts.push(
        `${second.market.name} offers ₹${fmt(-diff)} more on paper, but its lower reliability and higher price volatility make ${best.market.name} the safer overall choice — negotiate with both if you can.`,
      )
    }
  }

  const riskIdx = best.price.volatility * 3 + (1 - best.market.reliability) + (1 - best.demandCoverage) * 0.5
  const risk: Recommendation['risk'] = riskIdx < 0.25 ? 'Low' : riskIdx < 0.5 ? 'Medium' : 'High'
  return { ranked, best, reason: parts.join(' '), risk }
}

export function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)
}
