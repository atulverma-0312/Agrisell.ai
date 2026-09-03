/** Smart search: turns one natural-language query into categorised, clickable results. */
import { fmt } from './engine'
import { detectIntent } from './intents'
import type { Intent, PortalPage } from './intents'
import type { DbShape } from './store'
import type { CleanMarket } from './types'

export type ResultCategory = 'Crop Prices' | 'Mandis' | 'Orders' | 'Financial Support' | 'Recommendations' | 'Transactions'

export interface SearchResult {
  category: ResultCategory
  title: string
  detail: string
  page: PortalPage
}

function todayPrice(m: CleanMarket, crop: string) {
  const h = m.history[crop]
  return h ? Math.round(h[h.length - 1].price) : 0
}

export function smartSearch(query: string, db: DbShape, markets: CleanMarket[]): { intent: Intent; results: SearchResult[] } {
  const intent = detectIntent(query)
  const crop = intent.crop ?? db.listings[0]?.crop ?? 'Wheat'
  const results: SearchResult[] = []

  const priced = markets
    .filter((m) => m.history[crop])
    .map((m) => ({ m, price: todayPrice(m, crop) }))
    .sort((a, b) => b.price - a.price)

  for (const { m, price } of priced.slice(0, 3)) {
    results.push({
      category: 'Crop Prices',
      title: `${crop} — ₹${fmt(price)}/quintal at ${m.name}`,
      detail: `${m.type} · ${m.district} · updated ${m.updatedAt ? new Date(m.updatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'today'}`,
      page: 'prices',
    })
  }

  const nearby = intent.district ? markets.filter((m) => m.district === intent.district) : markets.slice(0, 3)
  for (const m of nearby.slice(0, 3)) {
    results.push({ category: 'Mandis', title: m.name, detail: `${m.type} · ${m.district} · mandi fee ${m.feesPct}% · ${m.hasStorage ? 'storage available' : 'no storage'}`, page: 'prices' })
  }

  for (const o of db.orders.filter((x) => x.status !== 'Payment Completed').slice(0, 3)) {
    results.push({ category: 'Orders', title: `${o.crop} · ${o.quantityQuintal} q → ${o.marketName}`, detail: `${o.status} · net ₹${fmt(o.netAmount)}`, page: 'orders' })
  }

  if (db.finance.length) {
    for (const f of db.finance.slice(0, 2)) {
      results.push({ category: 'Financial Support', title: `₹${fmt(f.amount)} · ${f.purpose}`, detail: `Status: ${f.status} · ${f.tenureMonths} months (demo)`, page: 'finance' })
    }
  } else {
    results.push({
      category: 'Financial Support',
      title: intent.amount ? `Check eligibility for ₹${fmt(intent.amount)}` : 'Check financial support eligibility',
      detail: 'Simulated assessment from your selling record — demo partner integration.',
      page: 'finance',
    })
  }

  results.push({
    category: 'Recommendations',
    title: `Smart selling recommendation for ${crop}`,
    detail: 'Best mandi, best date, expected price range and net revenue with costs.',
    page: 'smart',
  })

  for (const t of db.transactions.slice(0, 2)) {
    results.push({
      category: 'Transactions',
      title: `${t.crop} · ${t.quantityQuintal} q · ₹${fmt(t.netAmount)} net`,
      detail: `${new Date(t.date).toLocaleDateString('en-IN')} · ${t.mandi} · ${t.paymentStatus}`,
      page: 'transactions',
    })
  }

  return { intent, results }
}
