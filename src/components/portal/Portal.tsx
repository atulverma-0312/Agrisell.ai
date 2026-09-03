import {
  Bell, ChevronLeft, LayoutDashboard, Mic, Package, Receipt, ScanSearch, Search, Sprout, Store, User, Wallet, BarChart3, Sparkles, Home, Truck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { predictPrice } from '../../lib/engine'
import type { Intent, PortalPage } from '../../lib/intents'
import { LANGS } from '../../lib/i18n'
import { smartSearch } from '../../lib/search'
import type { CropListing, Lang } from '../../lib/store'
import { addListing, useDb } from '../../lib/store'
import type { CleanMarket, Grade } from '../../lib/types'
import { FarmerDashboard } from './FarmerDashboard'
import { Finance } from './Finance'
import { MarketPrices } from './MarketPrices'
import { MyCrops } from './MyCrops'
import { AdminAnalytics, NotificationBell, Notifications, Profile } from './Misc'
import { Orders } from './Orders'
import { SellFlow } from './SellFlow'
import { SmartSelling } from './SmartSelling'
import type { SmartSellingResult } from './SmartSelling'
import { Transactions } from './Transactions'
import { VoiceAssistant } from './VoiceAssistant'

const NAV: { page: PortalPage; label: string; icon: LucideIcon }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: Home },
  { page: 'crops', label: 'My Crops', icon: Sprout },
  { page: 'prices', label: 'Market Prices', icon: Store },
  { page: 'smart', label: 'Smart Selling', icon: Sparkles },
  { page: 'sell', label: 'Sell Produce', icon: Truck },
  { page: 'orders', label: 'Orders', icon: Package },
  { page: 'transactions', label: 'Transactions', icon: Receipt },
  { page: 'finance', label: 'Financial Support', icon: Wallet },
  { page: 'voice', label: 'Voice Assistant', icon: Mic },
  { page: 'notifications', label: 'Notifications', icon: Bell },
  { page: 'profile', label: 'Profile', icon: User },
  { page: 'admin', label: 'Admin Analytics', icon: BarChart3 },
]

export function Portal({
  markets,
  lastSync,
  onRefreshFeed,
  onExit,
  onOpenGrading,
  onOpenMarketDashboard,
  crop,
  district,
  onCrop,
  onDistrict,
  chatToggle,
}: {
  markets: CleanMarket[]
  lastSync: number
  onRefreshFeed: () => void
  onExit: () => void
  onOpenGrading: () => void
  onOpenMarketDashboard: () => void
  crop: string
  district: string
  onCrop: (c: string) => void
  onDistrict: (d: string) => void
  chatToggle: React.ReactNode
}) {
  const { db, update, reset } = useDb()
  const [page, setPage] = useState<PortalPage>('dashboard')
  const [lang, setLang] = useState<Lang>(db.profile.language)
  const [query, setQuery] = useState('')
  const [voiceSeed, setVoiceSeed] = useState<string | undefined>(undefined)
  const [sellListing, setSellListing] = useState<CropListing | null>(null)
  const [smartDefaults, setSmartDefaults] = useState<{ crop: string; district: string; quantityQuintal?: number; grade?: Grade }>({ crop, district })

  const unread = db.notifications.filter((n) => !n.read).length

  const searchHits = useMemo(() => (query.trim().length > 1 ? smartSearch(query, db, markets).results.slice(0, 6) : []), [query, db, markets])

  const expectedCropValue = useMemo(() => {
    const l = db.listings[0]
    if (!l) return 0
    const m = markets.find((x) => x.history[l.crop])
    if (!m) return 0
    return Math.round(predictPrice(m.history[l.crop], 30).today * l.quantityQuintal)
  }, [db.listings, markets])

  const go = (p: PortalPage) => {
    if (p === 'grading') return onOpenGrading()
    setPage(p)
    setQuery('')
  }

  const onIntent = (p: PortalPage, intent: Intent) => {
    if (intent.crop) {
      onCrop(intent.crop)
      setSmartDefaults((s) => ({ ...s, crop: intent.crop as string }))
    }
    if (intent.district) onDistrict(intent.district)
    go(p)
  }

  function startSellFrom(r: SmartSellingResult) {
    // Create (or reuse) a crop lot for the analysed produce, then move to the sell flow.
    const existing = db.listings.find(
      (l) => l.crop === r.input.crop && l.quantityQuintal === r.input.quantityQuintal && l.status !== 'Payment Completed',
    )
    if (existing) setSellListing(existing)
    else {
      let created: CropListing | null = null
      update((d) => {
        const res = addListing(d, {
          crop: r.input.crop,
          variety: r.input.variety,
          quantityQuintal: r.input.quantityQuintal,
          grade: r.input.grade,
          qualitySource: 'manual',
          district: r.input.location,
          harvestDate: r.input.harvestDate,
        })
        created = res.listing
        return res.db
      })
      setSellListing(created)
    }
    setPage('sell')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <button className="flex items-center gap-2 text-lg font-extrabold text-emerald-700" onClick={onExit}>
            <Sprout size={24} /> AgriSell AI
          </button>

          <div className="relative order-last w-full sm:order-none sm:ml-4 sm:w-auto sm:flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-emerald-500"
              placeholder="Smart search — “मेरे गेहूं को कहाँ बेचूं?”, “pending orders”, “50000 loan”"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && query.trim()) {
                  setVoiceSeed(query)
                  setPage('voice')
                  setQuery('')
                }
              }}
              data-testid="smart-search"
            />
            {searchHits.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                {searchHits.map((r) => (
                  <button key={`${r.category}-${r.title}`} className="block w-full px-4 py-2.5 text-left hover:bg-emerald-50" onClick={() => go(r.page)}>
                    <div className="text-xs font-bold uppercase tracking-wide text-emerald-700">{r.category}</div>
                    <div className="text-sm font-semibold text-slate-800">{r.title}</div>
                    <div className="text-xs text-slate-500">{r.detail}</div>
                  </button>
                ))}
                <button className="block w-full bg-slate-50 px-4 py-2 text-left text-xs font-bold text-slate-600" onClick={() => { setVoiceSeed(query); setPage('voice'); setQuery('') }}>
                  See all results in the assistant →
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-semibold" value={lang} onChange={(e) => setLang(e.target.value as Lang)} aria-label="Language">
              {LANGS.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
            </select>
            <button className="rounded-xl bg-emerald-600 p-2.5 text-white hover:bg-emerald-700" onClick={() => setPage('voice')} aria-label="Voice assistant" data-testid="header-mic">
              <Mic size={20} />
            </button>
            <button className="relative rounded-xl p-2 text-slate-600 hover:bg-slate-100" onClick={() => setPage('notifications')} aria-label={`Notifications (${unread} unread)`} data-testid="header-bell">
              <NotificationBell unread={unread} />
            </button>
            {chatToggle}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <nav className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
            {NAV.map((n) => (
              <button
                key={n.page}
                onClick={() => go(n.page)}
                className={`flex items-center gap-3 whitespace-nowrap rounded-xl px-3.5 py-3 text-left text-sm font-semibold transition ${
                  page === n.page ? 'bg-emerald-600 text-white shadow' : 'bg-white text-slate-700 hover:bg-emerald-50'
                }`}
                data-testid={`nav-${n.page}`}
              >
                <n.icon size={18} />
                <span className="flex-1">{n.label}</span>
                {n.page === 'notifications' && unread > 0 && (
                  <span className={`rounded-full px-1.5 text-[11px] font-bold ${page === n.page ? 'bg-white/25' : 'bg-rose-600 text-white'}`}>{unread}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
            <button className="flex w-full items-center gap-3 rounded-xl bg-white px-3.5 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-sky-50" onClick={onOpenGrading}>
              <ScanSearch size={18} /> AI Quality Grading
            </button>
            <button className="flex w-full items-center gap-3 rounded-xl bg-white px-3.5 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100" onClick={onOpenMarketDashboard}>
              <LayoutDashboard size={18} /> Market Dashboard
            </button>
            <button className="flex w-full items-center gap-3 rounded-xl bg-white px-3.5 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100" onClick={onExit}>
              <ChevronLeft size={18} /> Selling Simulator
            </button>
          </div>
        </aside>

        <main className="min-w-0 pb-24">
          {page === 'dashboard' && (
            <FarmerDashboard
              db={db}
              markets={markets}
              crop={crop}
              district={district}
              onNavigate={go}
              onMarketDashboard={onOpenMarketDashboard}
              onGrading={onOpenGrading}
            />
          )}
          {page === 'crops' && (
            <MyCrops
              db={db}
              update={update}
              defaultDistrict={district}
              onGradeFromPhoto={onOpenGrading}
              onSell={(l) => { setSellListing(l); setPage('sell') }}
            />
          )}
          {page === 'prices' && (
            <MarketPrices
              markets={markets}
              crop={crop}
              district={district}
              onCrop={(c) => { onCrop(c); setSmartDefaults((s) => ({ ...s, crop: c })) }}
              onDistrict={(d) => { onDistrict(d); setSmartDefaults((s) => ({ ...s, district: d })) }}
              onRefresh={onRefreshFeed}
              lastSync={lastSync}
              onSmartSelling={() => setPage('smart')}
            />
          )}
          {page === 'smart' && (
            <SmartSelling markets={markets} lang={lang} defaults={smartDefaults} onSell={startSellFrom} />
          )}
          {page === 'sell' && (
            <SellFlow
              db={db}
              update={update}
              markets={markets}
              listing={sellListing}
              onPickListing={setSellListing}
              onDone={() => { setSellListing(null); setPage('orders') }}
            />
          )}
          {page === 'orders' && <Orders db={db} update={update} />}
          {page === 'transactions' && <Transactions db={db} />}
          {page === 'finance' && <Finance db={db} update={update} expectedCropValue={expectedCropValue} />}
          {page === 'voice' && (
            <VoiceAssistant db={db} update={update} markets={markets} onNavigate={onIntent} initialQuery={voiceSeed} key={voiceSeed ?? 'voice'} />
          )}
          {page === 'notifications' && <Notifications db={db} update={update} />}
          {page === 'profile' && <Profile db={db} update={update} lang={lang} onLang={setLang} onReset={reset} />}
          {page === 'admin' && <AdminAnalytics db={db} />}
        </main>
      </div>

      <p className="pb-8 text-center text-xs text-slate-400">
        Demo data lives in your browser · estimates only · AgriSell is not a bank, lender or certification authority · last price sync {new Date(lastSync).toLocaleTimeString('en-IN')}
      </p>
    </div>
  )
}
