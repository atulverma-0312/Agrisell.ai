/**
 * Browser-local demo "database" for the farmer portal.
 *
 * Entities mirror a realistic relational schema (users / farmer_profiles / crop_listings /
 * crop_quality / orders / transactions / financial_applications / voice_queries /
 * notifications / recommendations / transport_orders). Everything is persisted in
 * localStorage so the app works immediately after setup and can later be swapped for a
 * real API by replacing this module (see `db` object at the bottom).
 */
import { useCallback, useEffect, useState } from 'react'
import { CROPS } from './data'
import type { Grade } from './types'

export const DB_KEY = 'agrisell.db.v1'
export const DB_VERSION = 1

/* ------------------------------- entities ------------------------------- */

export interface FarmerProfile {
  id: string
  name: string
  nameHi: string
  phone: string
  district: string
  village: string
  landAcres: number
  farmerId: string
  bank: string
  language: Lang
  joinedAt: number
}

export type Lang = 'en' | 'hi' | 'hinglish'

export type ListingStatus =
  | 'Crop Added'
  | 'Quality Verified'
  | 'Listed'
  | 'Buyer Selected'
  | 'Order Confirmed'
  | 'In Transit'
  | 'Delivered'
  | 'Payment Pending'
  | 'Payment Completed'

export const LISTING_FLOW: ListingStatus[] = [
  'Crop Added',
  'Quality Verified',
  'Listed',
  'Buyer Selected',
  'Order Confirmed',
  'In Transit',
  'Delivered',
  'Payment Pending',
  'Payment Completed',
]

export interface CropListing {
  id: string
  farmerId: string
  crop: string
  variety: string
  quantityQuintal: number
  grade: Grade
  qualitySource: 'manual' | 'ai-photo'
  qualityScore?: number
  qualityConfidence?: number
  district: string
  harvestDate: string
  status: ListingStatus
  createdAt: number
  history: { status: ListingStatus; at: number }[]
}

export type OrderStatus = 'Order Confirmed' | 'In Transit' | 'Delivered' | 'Payment Pending' | 'Payment Completed' | 'Cancelled'

export interface TransportOrder {
  id: string
  mode: 'Self transport' | 'Mandi tractor-trolley' | 'Hired truck (9 MT)' | 'Buyer pickup'
  distanceKm: number
  cost: number
  eta: string
}

export interface Order {
  id: string
  listingId: string
  farmerId: string
  marketId: string
  marketName: string
  buyer: string
  crop: string
  quantityQuintal: number
  grade: Grade
  pricePerQuintal: number
  grossAmount: number
  charges: number
  netAmount: number
  status: OrderStatus
  transport: TransportOrder
  placedAt: number
  history: { status: OrderStatus; at: number }[]
}

export type PaymentStatus = 'Pending' | 'Completed'

export interface Transaction {
  id: string
  orderId: string
  farmerId: string
  date: number
  crop: string
  quantityQuintal: number
  mandi: string
  buyer: string
  pricePerQuintal: number
  grossAmount: number
  charges: number
  netAmount: number
  paymentStatus: PaymentStatus
}

export type FinanceStatus = 'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Rejected' | 'Disbursed'

export interface FinancialApplication {
  id: string
  farmerId: string
  amount: number
  purpose: string
  crop: string
  harvestDate: string
  expectedSellingDate: string
  status: FinanceStatus
  eligibleMin: number
  eligibleMax: number
  risk: 'Low' | 'Medium' | 'High'
  reason: string
  tenureMonths: number
  interestPct: number
  repayTotal: number
  createdAt: number
  history: { status: FinanceStatus; at: number }[]
}

export interface VoiceQuery {
  id: string
  farmerId: string
  text: string
  intent: string
  action: string
  mode: 'voice' | 'text'
  at: number
}

export interface AppNotification {
  id: string
  farmerId: string
  title: string
  body: string
  kind: 'price' | 'order' | 'finance' | 'recommendation' | 'payment' | 'system'
  read: boolean
  at: number
}

export interface DbShape {
  version: number
  profile: FarmerProfile
  listings: CropListing[]
  orders: Order[]
  transactions: Transaction[]
  finance: FinancialApplication[]
  voice: VoiceQuery[]
  notifications: AppNotification[]
}

/* --------------------------------- seed --------------------------------- */

const DAY = 86_400_000
export const FARMER_ID = 'farmer-1'

function iso(daysAgo: number) {
  return new Date(Date.now() - daysAgo * DAY).toISOString().slice(0, 10)
}

const SEED_MANDIS: [string, string, string][] = [
  ['lucknow-mandi', 'Lucknow (Sitapur Road) Mandi', 'Mandi Samiti Lucknow'],
  ['kanpur-enam', 'Kanpur Chakarpur e-NAM', 'e-NAM Trader Kanpur'],
  ['hafed-aligarh', 'Aligarh Kisan Producer FPO', 'Aligarh FPO'],
  ['reliance-fresh-lko', 'Reliance Retail Sourcing Hub', 'Reliance Fresh Sourcing'],
]

function seedTransactions(): Transaction[] {
  const rows: Transaction[] = []
  const specs: [number, string, number, number, number][] = [
    [12, 'Wheat', 42, 2380, 0],
    [38, 'Potato', 60, 1180, 1],
    [67, 'Mustard', 18, 5720, 2],
    [96, 'Wheat', 55, 2290, 1],
    [124, 'Rice (Paddy)', 48, 2340, 3],
    [151, 'Maize', 30, 2050, 0],
  ]
  specs.forEach(([daysAgo, crop, qty, price, mandiIdx], i) => {
    const [, mandi, buyer] = SEED_MANDIS[mandiIdx]
    const gross = qty * price
    const charges = Math.round(gross * 0.025 + qty * 3)
    rows.push({
      id: `txn-seed-${i + 1}`,
      orderId: `ord-seed-${i + 1}`,
      farmerId: FARMER_ID,
      date: Date.now() - daysAgo * DAY,
      crop,
      quantityQuintal: qty,
      mandi,
      buyer,
      pricePerQuintal: price,
      grossAmount: gross,
      charges,
      netAmount: gross - charges,
      paymentStatus: daysAgo < 15 ? 'Pending' : 'Completed',
    })
  })
  return rows.sort((a, b) => b.date - a.date)
}

function seedOrders(txns: Transaction[]): Order[] {
  return txns.map((t, i) => {
    const spec = SEED_MANDIS.find(([, name]) => name === t.mandi) ?? SEED_MANDIS[0]
    const status: OrderStatus = t.paymentStatus === 'Completed' ? 'Payment Completed' : 'Payment Pending'
    return {
      id: t.orderId,
      listingId: `lst-seed-${i + 1}`,
      farmerId: FARMER_ID,
      marketId: spec[0],
      marketName: t.mandi,
      buyer: t.buyer,
      crop: t.crop,
      quantityQuintal: t.quantityQuintal,
      grade: 'A',
      pricePerQuintal: t.pricePerQuintal,
      grossAmount: t.grossAmount,
      charges: t.charges,
      netAmount: t.netAmount,
      status,
      transport: { id: `trn-seed-${i + 1}`, mode: 'Hired truck (9 MT)', distanceKm: 40 + i * 12, cost: 2200 + i * 300, eta: 'Same day' },
      placedAt: t.date,
      history: [{ status, at: t.date }],
    }
  })
}

function seedListings(): CropListing[] {
  return [
    {
      id: 'lst-open-1',
      farmerId: FARMER_ID,
      crop: 'Wheat',
      variety: 'HD-2967',
      quantityQuintal: 50,
      grade: 'A',
      qualitySource: 'manual',
      district: 'Lucknow',
      harvestDate: iso(6),
      status: 'Listed',
      createdAt: Date.now() - 5 * DAY,
      history: [
        { status: 'Crop Added', at: Date.now() - 5 * DAY },
        { status: 'Quality Verified', at: Date.now() - 5 * DAY + 3600_000 },
        { status: 'Listed', at: Date.now() - 4 * DAY },
      ],
    },
  ]
}

function seedNotifications(): AppNotification[] {
  const base = Date.now()
  return [
    { id: 'ntf-1', farmerId: FARMER_ID, title: 'Better selling opportunity found nearby', body: 'Kanpur Chakarpur e-NAM is quoting a higher wheat price than your usual mandi today.', kind: 'recommendation', read: false, at: base - 2 * 3600_000 },
    { id: 'ntf-2', farmerId: FARMER_ID, title: 'Price increased by 4.2% in nearby mandi', body: 'Wheat price in Lucknow (Sitapur Road) Mandi moved up over the last week.', kind: 'price', read: false, at: base - 9 * 3600_000 },
    { id: 'ntf-3', farmerId: FARMER_ID, title: 'Payment pending', body: 'Payment for order ord-seed-1 (Wheat, 42 quintal) is awaited from the mandi.', kind: 'payment', read: true, at: base - 3 * DAY },
  ]
}

export function seedDb(): DbShape {
  const transactions = seedTransactions()
  return {
    version: DB_VERSION,
    profile: {
      id: FARMER_ID,
      name: 'Rohan Patel',
      nameHi: 'रोहन पटेल',
      phone: '+91 98xxx xxx12',
      district: 'Lucknow',
      village: 'Bakshi Ka Talab',
      landAcres: 6.5,
      farmerId: 'UP-KIS-2019-004512',
      bank: 'UP Gramin Bank ••••4512',
      language: 'en',
      joinedAt: Date.now() - 420 * DAY,
    },
    listings: seedListings(),
    orders: seedOrders(transactions),
    transactions,
    finance: [],
    voice: [],
    notifications: seedNotifications(),
  }
}

/* ------------------------------ persistence ------------------------------ */

function isDb(v: unknown): v is DbShape {
  if (typeof v !== 'object' || v === null) return false
  const d = v as Partial<DbShape>
  return d.version === DB_VERSION && !!d.profile && Array.isArray(d.listings) && Array.isArray(d.orders)
}

export function loadDb(): DbShape {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (isDb(parsed)) return parsed
    }
  } catch {
    /* corrupted storage → reseed */
  }
  const fresh = seedDb()
  saveDb(fresh)
  return fresh
}

export function saveDb(db: DbShape) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db))
  } catch {
    /* storage full / private mode — the app keeps working in memory */
  }
  window.dispatchEvent(new CustomEvent(DB_EVENT))
}

export const DB_EVENT = 'agrisell:db'

/** Reactive access to the local database. Any mutation re-renders every subscriber. */
export function useDb() {
  const [db, setDbState] = useState<DbShape>(() => loadDb())

  useEffect(() => {
    const sync = () => setDbState(loadDb())
    window.addEventListener(DB_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(DB_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const update = useCallback((fn: (d: DbShape) => DbShape) => {
    const next = fn(loadDb())
    saveDb(next)
    setDbState(next)
  }, [])

  const reset = useCallback(() => {
    const fresh = seedDb()
    saveDb(fresh)
    setDbState(fresh)
  }, [])

  return { db, update, reset }
}

/* ------------------------------- mutations ------------------------------- */

export const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`

export function notify(d: DbShape, n: Omit<AppNotification, 'id' | 'farmerId' | 'read' | 'at'>): DbShape {
  return {
    ...d,
    notifications: [{ ...n, id: id('ntf'), farmerId: FARMER_ID, read: false, at: Date.now() }, ...d.notifications].slice(0, 60),
  }
}

export function addListing(d: DbShape, l: Omit<CropListing, 'id' | 'farmerId' | 'status' | 'createdAt' | 'history'>): { db: DbShape; listing: CropListing } {
  const listing: CropListing = {
    ...l,
    id: id('lst'),
    farmerId: FARMER_ID,
    status: 'Crop Added',
    createdAt: Date.now(),
    history: [{ status: 'Crop Added', at: Date.now() }],
  }
  const db = notify({ ...d, listings: [listing, ...d.listings] }, {
    title: 'Crop added',
    body: `${listing.quantityQuintal} quintal ${listing.crop} added to My Crops.`,
    kind: 'system',
  })
  return { db, listing }
}

export function setListingStatus(d: DbShape, listingId: string, status: ListingStatus): DbShape {
  return {
    ...d,
    listings: d.listings.map((l) =>
      l.id === listingId && l.status !== status ? { ...l, status, history: [...l.history, { status, at: Date.now() }] } : l,
    ),
  }
}

export function updateListing(d: DbShape, listingId: string, patch: Partial<CropListing>): DbShape {
  return { ...d, listings: d.listings.map((l) => (l.id === listingId ? { ...l, ...patch } : l)) }
}

export function placeOrder(d: DbShape, o: Omit<Order, 'id' | 'farmerId' | 'status' | 'placedAt' | 'history'>): { db: DbShape; order: Order } {
  const order: Order = {
    ...o,
    id: id('ord'),
    farmerId: FARMER_ID,
    status: 'Order Confirmed',
    placedAt: Date.now(),
    history: [{ status: 'Order Confirmed', at: Date.now() }],
  }
  const txn: Transaction = {
    id: id('txn'),
    orderId: order.id,
    farmerId: FARMER_ID,
    date: order.placedAt,
    crop: order.crop,
    quantityQuintal: order.quantityQuintal,
    mandi: order.marketName,
    buyer: order.buyer,
    pricePerQuintal: order.pricePerQuintal,
    grossAmount: order.grossAmount,
    charges: order.charges,
    netAmount: order.netAmount,
    paymentStatus: 'Pending',
  }
  let db: DbShape = { ...d, orders: [order, ...d.orders], transactions: [txn, ...d.transactions] }
  db = setListingStatus(db, order.listingId, 'Order Confirmed')
  db = notify(db, {
    title: 'Your order has been confirmed',
    body: `${order.quantityQuintal} quintal ${order.crop} → ${order.marketName} at ₹${order.pricePerQuintal}/quintal.`,
    kind: 'order',
  })
  return { db, order }
}

const ORDER_TO_LISTING: Partial<Record<OrderStatus, ListingStatus>> = {
  'Order Confirmed': 'Order Confirmed',
  'In Transit': 'In Transit',
  Delivered: 'Delivered',
  'Payment Pending': 'Payment Pending',
  'Payment Completed': 'Payment Completed',
}

export function advanceOrder(d: DbShape, orderId: string, status: OrderStatus): DbShape {
  const order = d.orders.find((o) => o.id === orderId)
  if (!order) return d
  let db: DbShape = {
    ...d,
    orders: d.orders.map((o) => (o.id === orderId ? { ...o, status, history: [...o.history, { status, at: Date.now() }] } : o)),
    transactions: d.transactions.map((t) =>
      t.orderId === orderId ? { ...t, paymentStatus: status === 'Payment Completed' ? 'Completed' : t.paymentStatus } : t,
    ),
  }
  const listingStatus = ORDER_TO_LISTING[status]
  if (listingStatus) db = setListingStatus(db, order.listingId, listingStatus)
  const messages: Partial<Record<OrderStatus, string>> = {
    'In Transit': 'Your produce is on the way to the buyer.',
    Delivered: 'Produce delivered and weighed at the mandi.',
    'Payment Pending': 'Delivery accepted. Payment is being processed.',
    'Payment Completed': `Payment of ₹${order.netAmount.toLocaleString('en-IN')} has been completed.`,
    Cancelled: 'Order was cancelled.',
  }
  const body = messages[status]
  if (body) db = notify(db, { title: status === 'Payment Completed' ? 'Payment has been completed' : `Order ${status.toLowerCase()}`, body, kind: status.startsWith('Payment') ? 'payment' : 'order' })
  return db
}

export function addFinance(d: DbShape, a: Omit<FinancialApplication, 'id' | 'farmerId' | 'createdAt' | 'history'>): { db: DbShape; app: FinancialApplication } {
  const app: FinancialApplication = { ...a, id: id('fin'), farmerId: FARMER_ID, createdAt: Date.now(), history: [{ status: a.status, at: Date.now() }] }
  const db = notify({ ...d, finance: [app, ...d.finance] }, {
    title: 'Financial application submitted',
    body: `Your request for ₹${app.amount.toLocaleString('en-IN')} has been submitted to the partner institution (demo).`,
    kind: 'finance',
  })
  return { db, app }
}

export function setFinanceStatus(d: DbShape, appId: string, status: FinanceStatus): DbShape {
  const app = d.finance.find((f) => f.id === appId)
  if (!app || app.status === status) return d
  const db: DbShape = {
    ...d,
    finance: d.finance.map((f) => (f.id === appId ? { ...f, status, history: [...f.history, { status, at: Date.now() }] } : f)),
  }
  const bodies: Record<FinanceStatus, string> = {
    Draft: 'Application saved as draft.',
    Submitted: 'Application submitted to the partner institution (demo).',
    'Under Review': 'Your financial application is under review.',
    Approved: `Indicative approval for ₹${app.eligibleMax.toLocaleString('en-IN')} (demo — subject to the lender).`,
    Rejected: 'The demo assessment could not support this amount right now.',
    Disbursed: `₹${app.amount.toLocaleString('en-IN')} marked as disbursed in this demo.`,
  }
  return notify(db, { title: `Financial application: ${status}`, body: bodies[status], kind: 'finance' })
}

export function logVoice(d: DbShape, q: Omit<VoiceQuery, 'id' | 'farmerId' | 'at'>): DbShape {
  return { ...d, voice: [{ ...q, id: id('vq'), farmerId: FARMER_ID, at: Date.now() }, ...d.voice].slice(0, 80) }
}

export function markAllRead(d: DbShape): DbShape {
  return { ...d, notifications: d.notifications.map((n) => ({ ...n, read: true })) }
}

export function markRead(d: DbShape, notificationId: string): DbShape {
  return { ...d, notifications: d.notifications.map((n) => (n.id === notificationId ? { ...n, read: true } : n)) }
}

/* ------------------------------- analytics ------------------------------- */

export function txnStats(txns: Transaction[]) {
  const total = txns.length
  const revenue = txns.reduce((a, t) => a + t.netAmount, 0)
  const volume = txns.reduce((a, t) => a + t.quantityQuintal, 0)
  const avgPrice = volume ? Math.round(txns.reduce((a, t) => a + t.pricePerQuintal * t.quantityQuintal, 0) / volume) : 0
  const best = txns.reduce<Transaction | null>((b, t) => (!b || t.pricePerQuintal > b.pricePerQuintal ? t : b), null)
  const pending = txns.filter((t) => t.paymentStatus === 'Pending').reduce((a, t) => a + t.netAmount, 0)
  return { total, revenue, volume, avgPrice, best, pending }
}

export function monthlyRevenue(txns: Transaction[]) {
  const map = new Map<string, { month: string; revenue: number; volume: number }>()
  for (const t of [...txns].sort((a, b) => a.date - b.date)) {
    const key = new Date(t.date).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
    const row = map.get(key) ?? { month: key, revenue: 0, volume: 0 }
    row.revenue += t.netAmount
    row.volume += t.quantityQuintal
    map.set(key, row)
  }
  return [...map.values()]
}

/** Simple credit-style signals derived only from local demo transaction history. */
export function financeSignals(txns: Transaction[], expectedCropValue: number) {
  const { total, revenue, avgPrice } = txnStats(txns)
  const completed = txns.filter((t) => t.paymentStatus === 'Completed').length
  const repaymentRate = total ? completed / total : 0
  const strength = total >= 5 && repaymentRate >= 0.6 ? 'Strong' : total >= 2 ? 'Moderate' : 'Limited'
  const outstanding = txns.filter((t) => t.paymentStatus === 'Pending').reduce((a, t) => a + t.netAmount, 0)
  const cap = Math.round((revenue / Math.max(1, total)) * 0.6 + expectedCropValue * 0.3)
  return { total, revenue, avgPrice, repaymentRate, strength, outstanding, cap }
}

/** Aggregate figures for the admin/system analytics view (demo scale). */
export function adminStats(d: DbShape) {
  const { total, revenue, volume, avgPrice } = txnStats(d.transactions)
  const cropCount = new Map<string, number>()
  for (const t of d.transactions) cropCount.set(t.crop, (cropCount.get(t.crop) ?? 0) + 1)
  for (const l of d.listings) cropCount.set(l.crop, (cropCount.get(l.crop) ?? 0) + 1)
  const mandiCount = new Map<string, number>()
  for (const t of d.transactions) mandiCount.set(t.mandi, (mandiCount.get(t.mandi) ?? 0) + 1)
  return {
    farmers: 1 + 1284, // this device's farmer + simulated platform population
    activeListings: d.listings.filter((l) => l.status !== 'Payment Completed').length,
    transactions: total,
    volume,
    avgPrice,
    revenue,
    financeApplications: d.finance.length,
    voiceQueries: d.voice.length,
    completedOrders: d.orders.filter((o) => o.status === 'Payment Completed').length,
    pendingOrders: d.orders.filter((o) => o.status !== 'Payment Completed' && o.status !== 'Cancelled').length,
    topCrops: [...cropCount.entries()].map(([crop, count]) => ({ crop, count })).sort((a, b) => b.count - a.count).slice(0, 6),
    topMandis: [...mandiCount.entries()].map(([mandi, count]) => ({ mandi, count })).sort((a, b) => b.count - a.count).slice(0, 5),
  }
}

export const PURPOSES = ['Seeds & fertiliser', 'Labour cost', 'Irrigation / diesel', 'Storage rent', 'Household need', 'Equipment repair'] as const
export const CROP_LIST = CROPS
