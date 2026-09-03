/**
 * Smart Selling Decision engine (Module 1).
 *
 * Wraps the existing optimisation engine with the extra farmer inputs (variety, harvest &
 * expected selling date, minimum acceptable price, storage / transport availability) and
 * produces a transparent decision: recommended mandi, recommended selling date, expected
 * price range, cost break-up, net revenue, mandi comparison and three concrete options
 * (Sell now / Wait / Another mandi) with a plain-language reason in EN / HI / Hinglish.
 *
 * Nothing here is a guaranteed price — every figure is an estimate from the modelled data.
 */
import { PRODUCTION_COST } from './dashboard'
import { MISC, LOGISTICS } from './data'
import { buildOptions, fmt, logisticsCost, rankOptions } from './engine'
import type { CleanMarket, FarmerConstraints, FarmerInput, Grade, Option } from './types'

export interface SmartInput {
  crop: string
  variety: string
  quantityQuintal: number
  grade: Grade
  location: string
  harvestDate: string
  expectedSellingDate: string
  minPricePerQuintal: number
  hasStorage: boolean
  hasTransport: boolean
}

export interface CostBreakup {
  gross: number
  transport: number
  commission: number
  storage: number
  net: number
}

export interface SmartOption {
  kind: 'now' | 'wait' | 'other'
  title: string
  titleHi: string
  option: Option
  sellDay: number
  pricePerQuintal: number
  costs: CostBreakup
  note: string
  noteHi: string
}

export interface SmartDecision {
  best: Option
  ranked: Option[]
  sellDay: number
  sellDate: string
  expectedLow: number
  expectedHigh: number
  costs: CostBreakup
  profitVsCost: number
  confidence: number
  headline: 'SELL NOW' | 'WAIT' | 'SELL AT ANOTHER MANDI'
  headlineHi: string
  waitDays: number
  meetsMinPrice: boolean
  options: SmartOption[]
  reasons: string[]
  reasonsHi: string[]
  comparison: { name: string; price: number; net: number; distanceKm: number; profit: number }[]
  trendSeries: { label: string; price: number }[]
}

const DAY = 86_400_000

export function daysBetween(fromIso: string, toIso: string) {
  const a = new Date(fromIso).getTime()
  const b = new Date(toIso).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.round((b - a) / DAY)
}

function costs(o: Option, quantity: number, sellDay: number, pricePerQuintal: number, hasTransport: boolean): CostBreakup {
  const gross = Math.round(quantity * pricePerQuintal)
  const transport = hasTransport
    ? Math.round(logisticsCost(o.distanceKm, quantity) * 0.55) // own vehicle: only fuel/labour
    : logisticsCost(o.distanceKm, quantity)
  const commission = Math.round(gross * ((o.market.feesPct + MISC.commissionAgentPct) / 100) + quantity * MISC.weighingPerQuintal)
  const storageRate = o.market.hasStorage ? o.market.storagePerQuintalPerDay : 1.2
  const storage = Math.round(sellDay * quantity * storageRate)
  return { gross, transport, commission, storage, net: gross - transport - commission - storage }
}

function priceOn(o: Option, day: number, grade: Grade) {
  const point = o.price.forecast.find((p) => p.day === day) ?? o.price.forecast[o.price.forecast.length - 1]
  return Math.round(point.price * o.market.gradePremium[grade])
}

export function smartDecision(input: SmartInput, markets: CleanMarket[]): SmartDecision | null {
  const horizon = Math.max(1, Math.min(60, daysBetween(new Date().toISOString().slice(0, 10), input.expectedSellingDate) || 7))
  const farmerInput: FarmerInput = {
    crop: input.crop,
    quantityQuintal: input.quantityQuintal,
    grade: input.grade,
    location: input.location,
  }
  const constraints: FarmerConstraints = {
    sellingDeadlineDays: horizon,
    storageCapacityQuintal: input.hasStorage ? input.quantityQuintal : 0,
    budgetInr: 1_000_000,
    transportLimitKm: input.hasTransport ? 800 : 350,
  }
  const ranked = rankOptions(buildOptions(farmerInput, constraints, markets))
  const best = ranked[0]
  if (!best) return null

  const canHold = input.hasStorage || best.market.hasStorage
  const sellDay = canHold ? Math.min(best.price.bestDay, horizon) : 0
  const priceNow = priceOn(best, 0, input.grade)
  const priceWait = priceOn(best, sellDay, input.grade)
  const band = Math.max(20, Math.round(priceWait * (0.01 + best.price.volatility)))
  const expectedLow = priceWait - band
  const expectedHigh = priceWait + band

  const nowCosts = costs(best, input.quantityQuintal, 0, priceNow, input.hasTransport)
  const waitCosts = costs(best, input.quantityQuintal, sellDay, priceWait, input.hasTransport)
  const alternative = ranked.find((o) => o.market.id !== best.market.id) ?? best
  const altDay = alternative.market.hasStorage || input.hasStorage ? Math.min(alternative.price.bestDay, horizon) : 0
  const altPrice = priceOn(alternative, altDay, input.grade)
  const altCosts = costs(alternative, input.quantityQuintal, altDay, altPrice, input.hasTransport)

  const chosen = sellDay > 0 && waitCosts.net > nowCosts.net ? waitCosts : nowCosts
  const chosenDay = chosen === waitCosts ? sellDay : 0
  const chosenPrice = chosen === waitCosts ? priceWait : priceNow

  const headline: SmartDecision['headline'] =
    altCosts.net > chosen.net * 1.02 && alternative.market.id !== best.market.id
      ? 'SELL AT ANOTHER MANDI'
      : chosenDay > 0
        ? 'WAIT'
        : 'SELL NOW'
  const headlineHi = headline === 'WAIT' ? 'थोड़ा इंतज़ार करें' : headline === 'SELL NOW' ? 'आज बेचें' : 'बेहतर मंडी उपलब्ध है'

  const productionCost = (PRODUCTION_COST[input.crop] ?? 1000) * input.quantityQuintal
  const meetsMinPrice = chosenPrice >= input.minPricePerQuintal

  const options: SmartOption[] = [
    {
      kind: 'now',
      title: `Option A — Sell now at ${best.market.name}`,
      titleHi: `विकल्प A — आज ${best.market.name} में बेचें`,
      option: best,
      sellDay: 0,
      pricePerQuintal: priceNow,
      costs: nowCosts,
      note: 'Money in hand immediately, no storage cost and no price risk.',
      noteHi: 'पैसा तुरंत मिलेगा, भंडारण खर्च नहीं और भाव गिरने का जोखिम नहीं।',
    },
    {
      kind: 'wait',
      title: sellDay > 0 ? `Option B — Wait ${sellDay} day(s) and sell at ${best.market.name}` : 'Option B — Waiting is not advised',
      titleHi: sellDay > 0 ? `विकल्प B — ${sellDay} दिन रुककर ${best.market.name} में बेचें` : 'विकल्प B — इंतज़ार करना ठीक नहीं',
      option: best,
      sellDay,
      pricePerQuintal: priceWait,
      costs: waitCosts,
      note:
        sellDay > 0
          ? `Model expects about ₹${fmt(priceWait - priceNow)}/quintal more, minus ₹${fmt(waitCosts.storage)} storage. Prices can also fall.`
          : 'Either prices are not expected to rise before your selling date, or you have no safe storage.',
      noteHi:
        sellDay > 0
          ? `मॉडल के अनुसार लगभग ₹${fmt(priceWait - priceNow)}/क्विंटल अधिक मिल सकता है, ₹${fmt(waitCosts.storage)} भंडारण खर्च घटाकर। भाव गिर भी सकता है।`
          : 'या तो भाव बढ़ने की उम्मीद नहीं है, या सुरक्षित भंडारण उपलब्ध नहीं है।',
    },
    {
      kind: 'other',
      title: `Option C — Sell at ${alternative.market.name} (${alternative.distanceKm} km)`,
      titleHi: `विकल्प C — ${alternative.market.name} (${alternative.distanceKm} किमी) में बेचें`,
      option: alternative,
      sellDay: altDay,
      pricePerQuintal: altPrice,
      costs: altCosts,
      note: `Different buyer pool and price level; transport cost ₹${fmt(altCosts.transport)}.`,
      noteHi: `अलग खरीदार और भाव; परिवहन खर्च ₹${fmt(altCosts.transport)}।`,
    },
  ]

  const sellDate = new Date(Date.now() + chosenDay * DAY).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

  const reasons: string[] = []
  const reasonsHi: string[] = []
  reasons.push(
    `${best.market.name} is ${best.distanceKm} km away and is currently the highest-scoring option (${best.aiScore}/100) for ${input.quantityQuintal} quintal Grade-${input.grade} ${input.crop}.`,
  )
  reasonsHi.push(
    `${best.market.name} आपसे ${best.distanceKm} किमी दूर है और आपके ${input.quantityQuintal} क्विंटल ग्रेड-${input.grade} ${input.crop} के लिए अभी सबसे अच्छा विकल्प है (स्कोर ${best.aiScore}/100)।`,
  )
  if (chosenDay > 0) {
    reasons.push(`Prices there are ${best.price.trend}; holding ${chosenDay} day(s) is estimated to add about ₹${fmt(priceWait - priceNow)}/quintal.`)
    reasonsHi.push(`वहाँ भाव ${best.price.trend === 'rising' ? 'बढ़ रहा' : best.price.trend === 'falling' ? 'गिर रहा' : 'स्थिर'} है; ${chosenDay} दिन रुकने पर लगभग ₹${fmt(priceWait - priceNow)}/क्विंटल अधिक मिलने का अनुमान है।`)
  } else {
    reasons.push('Prices are not expected to improve before your selling date, so selling now avoids storage cost and price risk.')
    reasonsHi.push('आपकी बिक्री तारीख तक भाव बढ़ने की उम्मीद नहीं है, इसलिए अभी बेचने से भंडारण खर्च और जोखिम दोनों बचेंगे।')
  }
  reasons.push(
    `After transport ₹${fmt(chosen.transport)}, mandi/commission ₹${fmt(chosen.commission)} and storage ₹${fmt(chosen.storage)}, your estimated net is ₹${fmt(chosen.net)}.`,
  )
  reasonsHi.push(
    `परिवहन ₹${fmt(chosen.transport)}, मंडी/कमीशन ₹${fmt(chosen.commission)} और भंडारण ₹${fmt(chosen.storage)} घटाने के बाद अनुमानित शुद्ध आय ₹${fmt(chosen.net)} है।`,
  )
  reasons.push(
    meetsMinPrice
      ? `This clears your minimum acceptable price of ₹${fmt(input.minPricePerQuintal)}/quintal.`
      : `This is below your minimum acceptable price of ₹${fmt(input.minPricePerQuintal)}/quintal — consider negotiating, improving grade, or waiting longer.`,
  )
  reasonsHi.push(
    meetsMinPrice
      ? `यह आपके न्यूनतम भाव ₹${fmt(input.minPricePerQuintal)}/क्विंटल से ऊपर है।`
      : `यह आपके न्यूनतम भाव ₹${fmt(input.minPricePerQuintal)}/क्विंटल से कम है — मोल-भाव करें, ग्रेड सुधारें या और इंतज़ार करें।`,
  )
  if (!input.hasTransport) {
    reasons.push(`You marked transport as unavailable, so a hired truck (₹${LOGISTICS.fixedTrip} fixed + per-km) is included in the cost.`)
    reasonsHi.push(`आपने परिवहन उपलब्ध नहीं बताया, इसलिए किराए का ट्रक खर्च शामिल किया गया है।`)
  }

  const comparison = ranked.slice(0, 6).map((o) => {
    const day = o.market.hasStorage || input.hasStorage ? Math.min(o.price.bestDay, horizon) : 0
    const p = priceOn(o, day, input.grade)
    const c = costs(o, input.quantityQuintal, day, p, input.hasTransport)
    return { name: o.market.name.replace(/ \(.*\)/, ''), price: p, net: c.net, distanceKm: o.distanceKm, profit: c.net - productionCost }
  })

  const hist = best.market.history[input.crop]
  const trendSeries = [
    ...hist
      .filter((p) => p.day >= -84 && p.day % 7 === 0)
      .map((p) => ({ label: p.day === 0 ? 'Now' : `${-p.day / 7}w ago`, price: Math.round(p.price * best.market.gradePremium[input.grade]) })),
    ...best.price.forecast
      .filter((p) => p.day > 0 && p.day % 7 === 0)
      .map((p) => ({ label: `+${p.day / 7}w`, price: Math.round(p.price * best.market.gradePremium[input.grade]) })),
  ]

  return {
    best,
    ranked,
    sellDay: chosenDay,
    sellDate,
    expectedLow,
    expectedHigh,
    costs: chosen,
    profitVsCost: chosen.net - productionCost,
    confidence: best.confidence,
    headline,
    headlineHi,
    waitDays: chosenDay,
    meetsMinPrice,
    options,
    reasons,
    reasonsHi,
    comparison,
    trendSeries,
  }
}
