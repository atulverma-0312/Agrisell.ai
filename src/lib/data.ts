import type { Grade, PricePoint, RawMarket } from './types'

export const CROPS = ['Wheat', 'Rice (Paddy)', 'Tomato', 'Onion', 'Soybean', 'Cotton'] as const
export const LOCATIONS = ['Nashik', 'Pune', 'Nagpur', 'Indore', 'Lucknow'] as const

const BASE_PRICE: Record<string, number> = {
  Wheat: 2275,
  'Rice (Paddy)': 2300,
  Tomato: 1450,
  Onion: 1800,
  Soybean: 4600,
  Cotton: 7000,
}

// Deterministic pseudo-random so the demo is reproducible.
function rng(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

function history(crop: string, seed: number, bias: number, drift: number): PricePoint[] {
  const r = rng(seed)
  const base = BASE_PRICE[crop] * bias
  const out: PricePoint[] = []
  for (let d = -30; d <= 0; d++) {
    const noise = (r() - 0.5) * base * 0.05
    const seasonal = Math.sin((d + seed) / 6) * base * 0.02
    out.push({ day: d, price: Math.round(base + drift * (d + 30) + noise + seasonal) })
  }
  return out
}

const defaultPremium: Record<Grade, number> = { A: 1.08, B: 1, C: 0.9 }

function build(
  id: string,
  name: string,
  type: RawMarket['type'],
  district: string,
  distanceKm: Record<string, number>,
  bias: number,
  drift: number,
  demand: number,
  reliability: number,
  feesPct: number,
  hasStorage: boolean,
  source: string,
  buyer?: string,
): RawMarket {
  const seed = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const hist: Record<string, PricePoint[]> = {}
  const dem: Record<string, number> = {}
  CROPS.forEach((c, i) => {
    hist[c] = history(c, seed + i * 17, bias, drift * (1 + i * 0.1))
    dem[c] = Math.round(demand * (0.6 + ((seed + i) % 5) * 0.2))
  })
  return {
    id,
    name,
    type,
    district,
    distanceKm,
    history: hist,
    demandQuintal: dem,
    buyer,
    reliability,
    feesPct,
    storagePerQuintalPerDay: hasStorage ? 2.5 : 0,
    gradePremium: defaultPremium,
    hasStorage,
    source,
  }
}

const D = (n: number, p: number, ng: number, i: number, l: number) => ({
  Nashik: n,
  Pune: p,
  Nagpur: ng,
  Indore: i,
  Lucknow: l,
})

export const RAW_MARKETS: RawMarket[] = [
  build('lasalgaon', 'Lasalgaon APMC', 'Mandi', 'Nashik', D(25, 210, 620, 480, 1250), 1.0, 1.6, 900, 0.9, 1.5, true, 'AGMARKNET'),
  build('pune-apmc', 'Pune Market Yard', 'Mandi', 'Pune', D(215, 12, 720, 600, 1400), 1.06, 0.8, 1200, 0.88, 2, true, 'AGMARKNET'),
  build('nagpur-enam', 'Nagpur e-NAM', 'e-NAM', 'Nagpur', D(640, 720, 15, 470, 880), 1.04, 2.1, 700, 0.93, 1, false, 'e-NAM'),
  build('indore-enam', 'Indore e-NAM', 'e-NAM', 'Indore', D(480, 600, 470, 10, 850), 1.03, -1.2, 800, 0.91, 1, true, 'e-NAM'),
  build('lucknow-apmc', 'Lucknow Mandi', 'Mandi', 'Lucknow', D(1250, 1400, 880, 850, 8), 0.97, 2.8, 1000, 0.82, 1.5, false, 'AGMARKNET'),
  build('agrofresh', 'AgroFresh Foods Pvt Ltd', 'Buyer', 'Nashik', D(40, 190, 600, 460, 1230), 1.11, 0.3, 350, 0.96, 0, false, 'Buyer Portal', 'AgroFresh Procurement'),
  build('sahyadri-fpo', 'Sahyadri Farmers FPO', 'FPO', 'Nashik', D(18, 220, 630, 490, 1260), 1.02, 1.0, 500, 0.94, 0.5, true, 'FPO Network', 'Sahyadri FPO'),
  build('bigbasket', 'BigBasket Sourcing Hub', 'Buyer', 'Pune', D(200, 25, 710, 590, 1380), 1.14, -0.4, 260, 0.9, 0, false, 'Buyer Portal', 'BB Fresh Sourcing'),
]

// Simulate a dirty feed: duplicates, missing values, outliers, inconsistent units.
export function fetchRawFeed(): RawMarket[] {
  const dirty: RawMarket[] = RAW_MARKETS.map((m) => ({ ...m, history: { ...m.history } }))
  // duplicate record
  dirty.push({ ...RAW_MARKETS[0], id: 'lasalgaon', raw: true })
  // outlier in Pune history (price in paise instead of rupees)
  const pune = dirty[1]
  pune.history = { ...pune.history }
  for (const crop of CROPS) {
    const h = [...pune.history[crop]]
    h[10] = { day: h[10].day, price: h[10].price * 100 }
    pune.history[crop] = h
  }
  // missing point in Nagpur history
  const nagpur = dirty[2]
  nagpur.history = { ...nagpur.history }
  for (const crop of CROPS) {
    const h = [...nagpur.history[crop]]
    h[5] = { day: h[5].day, price: Number.NaN }
    nagpur.history[crop] = h
  }
  // stale market with no demand data
  dirty.push({
    ...build('ghost', 'Unknown Yard', 'Mandi', 'N/A', D(9999, 9999, 9999, 9999, 9999), 1, 0, 0, 0.1, 1, false, 'AGMARKNET'),
    demandQuintal: {},
  })
  return dirty
}

export const LOGISTICS = {
  ratePerQuintalKm: 0.55, // INR
  loadingPerQuintal: 12,
  fixedTrip: 800,
  truckCapacityQuintal: 90,
}

export const MISC = {
  gstPct: 0,
  commissionAgentPct: 1,
  weighingPerQuintal: 3,
}
