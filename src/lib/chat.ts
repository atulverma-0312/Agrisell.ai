import { fmt } from './engine'
import type { FarmerConstraints, FarmerInput, Recommendation } from './types'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatContext {
  input: FarmerInput
  constraints: FarmerConstraints
  rec: Recommendation
}

const KNOWLEDGE: { keys: RegExp; answer: string }[] = [
  {
    keys: /e-?nam|enam/i,
    answer:
      'e-NAM (National Agriculture Market) is a pan-India online trading portal that links APMC mandis. Register at your nearest e-NAM mandi with Aadhaar and a bank passbook; your lot is quality-assayed and buyers across India can bid, with payment directly to your bank account.',
  },
  {
    keys: /msp|minimum support/i,
    answer:
      'MSP (Minimum Support Price) is the price at which the government procures notified crops (e.g. wheat, paddy, cotton, soybean). If a market offers less than MSP, consider selling at a government procurement centre. MSP does not apply to most fruits and vegetables like onion or tomato.',
  },
  {
    keys: /fpo|farmer producer/i,
    answer:
      'An FPO (Farmer Producer Organisation) aggregates produce from many farmers to negotiate better prices, share transport and storage, and sell directly to large buyers. Joining one usually reduces your per-quintal logistics cost.',
  },
  {
    keys: /grade|quality|sort/i,
    answer:
      'Grading (A/B/C) is based on size, uniformity, moisture and damage. Grade A typically earns an 8-10% premium while Grade C is discounted ~10%. Cleaning, sorting and proper packaging before sale is the cheapest way to move up a grade.',
  },
  {
    keys: /storage|warehouse|store|cold/i,
    answer:
      'Storing pays off only when the expected price rise exceeds storage cost plus spoilage. Warehouses registered with WDRA issue negotiable receipts you can use as loan collateral. For perishable crops, sell quickly unless cold storage is available.',
  },
  {
    keys: /payment|money|paid|upi|neft/i,
    answer:
      'On e-NAM and with registered buyers, payment is released to your bank account after weighing and quality check, usually within 1-3 days. Always insist on a written sale slip; avoid cash deals without a receipt.',
  },
  {
    keys: /transport|truck|logistic/i,
    answer:
      'Transport cost is mostly distance × quantity. A standard truck carries about 90 quintals, so filling a truck completely (or sharing with a neighbour or FPO) lowers your cost per quintal significantly.',
  },
]

export function localAssistantReply(question: string, ctx: ChatContext): string {
  const q = question.toLowerCase()
  const { input, constraints, rec } = ctx
  const best = rec.best

  if (/^(hi|hello|namaste|hey)\b/.test(q)) {
    return `Namaste! I'm your AgriSell assistant. Ask me about your recommendation for ${input.crop}, prices, timing, transport, storage, e-NAM, MSP or how selling works.`
  }

  if (best) {
    if (/where|which market|best market|sell to|whom|buyer/.test(q)) {
      return `Your best option is ${best.market.name} (${best.market.buyer ?? best.market.type}), ${best.distanceKm} km from ${input.location}. Estimated net return: ₹${fmt(best.netReturn)} at ₹${fmt(best.expectedPrice)}/quintal.`
    }
    if (/when|time|timing|day|wait|hold/.test(q)) {
      return best.sellDay === 0
        ? `Sell now. Prices at ${best.market.name} are ${best.price.trend}, so waiting adds storage cost without a meaningful price gain.`
        : `Wait about ${best.sellDay} day(s). Prices at ${best.market.name} are rising and expected to peak near ₹${fmt(best.price.bestPrice)}/quintal, within your ${constraints.sellingDeadlineDays}-day deadline.`
    }
    if (/price|rate|how much|expect/.test(q)) {
      return `Expected price at ${best.market.name} is ₹${fmt(best.expectedPrice)}/quintal for Grade ${input.grade}. Today's modal price is ₹${fmt(best.price.today)} and the 14-day trend is ${best.price.trend} (volatility ${(best.price.volatility * 100).toFixed(1)}%).`
    }
    if (/risk|safe|confiden|trust|reliab/.test(q)) {
      return `Risk is ${rec.risk} with ${best.confidence}% confidence. The buyer's reliability is ${Math.round(best.market.reliability * 100)}% and they can absorb ${Math.round(best.demandCoverage * 100)}% of your quantity.`
    }
    if (/second|alternative|other option|else|compare|instead/.test(q)) {
      const alts = rec.ranked.slice(1, 3).map((o) => `${o.market.name} (₹${fmt(o.netReturn)})`).join(' and ')
      return `Alternatives: ${alts}. ${rec.ranked[1] && rec.ranked[1].netReturn > best.netReturn ? 'The runner-up pays slightly more on paper but is riskier.' : 'Both return less than your top choice.'}`
    }
    if (/cost|fee|commission|deduct|charge/.test(q)) {
      return `Cost breakdown at ${best.market.name}: transport ₹${fmt(best.transportCost)}, storage ₹${fmt(best.storageCost)}, fees & commission ₹${fmt(best.otherCosts)}. Revenue ₹${fmt(best.revenue)} − costs = ₹${fmt(best.netReturn)} net.`
    }
    if (/why|reason|explain/.test(q)) return rec.reason
    if (/negotiat|bargain|offer/.test(q)) {
      return `Start by asking ₹${fmt(Math.round(best.expectedPrice * 1.03))}/quintal (3% above the model price) and don't accept below ₹${fmt(Math.round(best.expectedPrice * 0.97))}. Mention that ${rec.ranked[1]?.market.name ?? 'other buyers'} is also interested.`
    }
  }

  for (const k of KNOWLEDGE) if (k.keys.test(q)) return k.answer

  return `I can help with: where to sell, when to sell, expected price, costs, risk, alternatives, negotiation tips, and general topics like e-NAM, MSP, FPOs, grading, storage and payment. Try asking "When should I sell?" or "What is e-NAM?"`
}

export async function llmReply(history: ChatMessage[], ctx: ChatContext, apiKey: string): Promise<string> {
  const best = ctx.rec.best
  const system = `You are AgriSell Assistant, a friendly agricultural market advisor for Indian farmers. Answer briefly in the user's language. Farmer input: ${JSON.stringify(ctx.input)}. Constraints: ${JSON.stringify(ctx.constraints)}. Current recommendation: ${
    best
      ? JSON.stringify({ market: best.market.name, buyer: best.market.buyer, expectedPrice: best.expectedPrice, sellInDays: best.sellDay, netReturn: best.netReturn, risk: ctx.rec.risk, confidence: best.confidence, alternatives: ctx.rec.ranked.slice(1, 3).map((o) => ({ market: o.market.name, netReturn: o.netReturn })) })
      : 'none'
  }.`
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.5,
      messages: [{ role: 'system', content: system }, ...history.slice(-10)],
    }),
  })
  if (!res.ok) throw new Error(`AI request failed (${res.status})`)
  const json = (await res.json()) as { choices: { message: { content: string } }[] }
  return json.choices[0]?.message.content.trim() ?? ''
}
