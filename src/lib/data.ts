import type { Grade, PricePoint, RawMarket } from './types'
import { UP_DISTRICT_NAMES, districtCoords, roadDistanceKm } from './up'

// Major Uttar Pradesh crops (₹/quintal indicative base prices)
export const CROPS = ['Wheat', 'Rice (Paddy)', 'Sugarcane', 'Potato', 'Mustard', 'Maize', 'Pulses (Arhar)', 'Mango'] as const
export const LOCATIONS = UP_DISTRICT_NAMES

const BASE_PRICE: Record<string, number> = {
  Wheat: 2275,
  'Rice (Paddy)': 2300,
  Sugarcane: 370,
  Potato: 1100,
  Mustard: 5650,
  Maize: 2090,
  'Pulses (Arhar)': 7550,
  Mango: 3200,
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

function distancesFrom(district: string): Record<string, number> {
  const here = districtCoords(district)
  const out: Record<string, number> = {}
  for (const d of UP_DISTRICT_NAMES) out[d] = roadDistanceKm(districtCoords(d), here)
  return out
}

function build(
  id: string,
  name: string,
  type: RawMarket['type'],
  district: string,
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
    distanceKm: distancesFrom(district),
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

export const RAW_MARKETS: RawMarket[] = [
  build('lucknow-mandi', 'Lucknow (Sitapur Road) Mandi', 'Mandi', 'Lucknow', 1.02, 1.4, 1400, 0.9, 1.5, true, 'AGMARKNET'),
  build('kanpur-enam', 'Kanpur Chakarpur e-NAM', 'e-NAM', 'Kanpur Nagar', 1.04, 1.9, 1600, 0.93, 1, true, 'e-NAM'),
  build('agra-mandi', 'Agra Sikandra Mandi', 'Mandi', 'Agra', 1.0, 0.6, 1300, 0.87, 1.5, true, 'AGMARKNET'),
  build('varanasi-enam', 'Varanasi Pahadiya e-NAM', 'e-NAM', 'Varanasi', 1.03, 2.2, 1100, 0.92, 1, false, 'e-NAM'),
  build('meerut-mandi', 'Meerut Navin Mandi', 'Mandi', 'Meerut', 1.05, -0.8, 1200, 0.88, 1.5, true, 'AGMARKNET'),
  build('gorakhpur-mandi', 'Gorakhpur Mahewa Mandi', 'Mandi', 'Gorakhpur', 0.98, 2.6, 900, 0.84, 1.5, false, 'AGMARKNET'),
  build('prayagraj-enam', 'Prayagraj Mundera e-NAM', 'e-NAM', 'Prayagraj', 1.01, 1.1, 1000, 0.9, 1, true, 'e-NAM'),
  build('bareilly-mandi', 'Bareilly Delapeer Mandi', 'Mandi', 'Bareilly', 0.99, 0.9, 950, 0.86, 1.5, false, 'AGMARKNET'),
  build('itc-saharanpur', 'ITC Agri Business (Saharanpur)', 'Buyer', 'Saharanpur', 1.1, 0.2, 500, 0.96, 0, false, 'Buyer Portal', 'ITC e-Choupal Procurement'),
  build('reliance-fresh-lko', 'Reliance Retail Sourcing Hub', 'Buyer', 'Lucknow', 1.12, -0.3, 400, 0.94, 0, false, 'Buyer Portal', 'Reliance Fresh Sourcing'),
  build('hafed-aligarh', 'Aligarh Kisan Producer FPO', 'FPO', 'Aligarh', 1.03, 1.0, 600, 0.93, 0.5, true, 'FPO Network', 'Aligarh FPO'),
  build('dcm-hardoi', 'DCM Shriram Sugar (Hardoi)', 'Buyer', 'Hardoi', 1.08, 0.5, 700, 0.95, 0, true, 'Buyer Portal', 'DCM Shriram Cane Procurement'),
]

// Simulate a dirty feed: duplicates, missing values, outliers, inconsistent units.
export function fetchRawFeed(): RawMarket[] {
  const dirty: RawMarket[] = RAW_MARKETS.map((m) => ({ ...m, history: { ...m.history } }))
  // duplicate record
  dirty.push({ ...RAW_MARKETS[0], id: 'lucknow-mandi', raw: true })
  // outlier in Kanpur history (price in paise instead of rupees)
  const kanpur = dirty[1]
  kanpur.history = { ...kanpur.history }
  for (const crop of CROPS) {
    const h = [...kanpur.history[crop]]
    h[10] = { day: h[10].day, price: h[10].price * 100 }
    kanpur.history[crop] = h
  }
  // missing point in Varanasi history
  const varanasi = dirty[3]
  varanasi.history = { ...varanasi.history }
  for (const crop of CROPS) {
    const h = [...varanasi.history[crop]]
    h[5] = { day: h[5].day, price: Number.NaN }
    varanasi.history[crop] = h
  }
  // stale market with no demand data
  dirty.push({
    ...build('ghost', 'Unknown Yard', 'Mandi', 'Lucknow', 1, 0, 0, 0.1, 1, false, 'AGMARKNET'),
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
