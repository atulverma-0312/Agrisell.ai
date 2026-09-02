import type { FarmerConstraints, FarmerInput, Recommendation } from './types'

/**
 * Optional generative-AI layer. If an OpenAI-compatible key is provided (VITE_OPENAI_API_KEY
 * or entered by the user), the recommendation reason is rewritten by an LLM in the farmer's
 * language. Otherwise the deterministic on-device explanation is used.
 */
export async function enhanceReasonWithLLM(
  input: FarmerInput,
  constraints: FarmerConstraints,
  rec: Recommendation,
  apiKey: string,
  language: string,
): Promise<string> {
  const best = rec.best
  if (!best || !apiKey) return rec.reason
  const top = rec.ranked.slice(0, 3).map((o) => ({
    market: o.market.name,
    type: o.market.type,
    buyer: o.market.buyer ?? null,
    distanceKm: o.distanceKm,
    expectedPrice: o.expectedPrice,
    sellInDays: o.sellDay,
    netReturn: o.netReturn,
    trend: o.price.trend,
    confidence: o.confidence,
  }))
  const prompt = `You are an agricultural market advisor for Indian farmers. Explain in ${language}, in 3-4 short sentences and simple words, why option #1 is recommended. Farmer: ${JSON.stringify(input)}. Constraints: ${JSON.stringify(constraints)}. Options: ${JSON.stringify(top)}. Risk: ${rec.risk}.`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`LLM request failed (${res.status})`)
  const json = (await res.json()) as { choices: { message: { content: string } }[] }
  return json.choices[0]?.message.content.trim() || rec.reason
}
