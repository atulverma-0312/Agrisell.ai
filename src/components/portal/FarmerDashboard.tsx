import { Bell, Camera, IndianRupee, LayoutDashboard, Mic, Package, Receipt, Sparkles, Store, TrendingUp, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { fmt, predictPrice } from '../../lib/engine'
import { smartDecision } from '../../lib/smart'
import type { PortalPage } from '../../lib/intents'
import type { DbShape } from '../../lib/store'
import { txnStats } from '../../lib/store'
import type { CleanMarket } from '../../lib/types'
import { Badge } from '../ui'

export function FarmerDashboard({
  db,
  markets,
  crop,
  district,
  onNavigate,
  onMarketDashboard,
  onGrading,
}: {
  db: DbShape
  markets: CleanMarket[]
  crop: string
  district: string
  onNavigate: (p: PortalPage) => void
  onMarketDashboard: () => void
  onGrading: () => void
}) {
  const listing = db.listings.find((l) => l.status !== 'Payment Completed') ?? db.listings[0] ?? null
  const activeCrop = listing?.crop ?? crop
  const quantity = listing?.quantityQuintal ?? 50

  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const [sellByDate] = useState(() => new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10))

  const best = useMemo(() => {
    const priced = markets.filter((m) => m.history[activeCrop]).map((m) => ({ m, model: predictPrice(m.history[activeCrop], 30) }))
    return priced.sort((a, b) => b.model.today - a.model.today)[0] ?? null
  }, [markets, activeCrop])

  const decision = useMemo(
    () =>
      smartDecision(
        {
          crop: activeCrop,
          variety: listing?.variety ?? '',
          quantityQuintal: quantity,
          grade: listing?.grade ?? 'A',
          location: listing?.district ?? district,
          harvestDate: listing?.harvestDate ?? today,
          expectedSellingDate: sellByDate,
          minPricePerQuintal: 0,
          hasStorage: true,
          hasTransport: false,
        },
        markets,
      ),
    [activeCrop, listing, quantity, district, markets, today, sellByDate],
  )

  const stats = txnStats(db.transactions)
  const pendingOrders = db.orders.filter((o) => o.status !== 'Payment Completed' && o.status !== 'Cancelled')
  const unread = db.notifications.filter((n) => !n.read).length
  const finance = db.finance[0] ?? null

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">नमस्ते, {db.profile.name.split(' ')[0]} 👋</h1>
          <p className="mt-1 text-slate-600">{db.profile.village}, {db.profile.district} · {db.profile.landAcres} acres · tracking {activeCrop}</p>
        </div>
        <button className="btn-big-outline" onClick={onMarketDashboard}><LayoutDashboard size={18} /> 6-month Market Dashboard</button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          icon={TrendingUp}
          tone="emerald"
          title="Today's best crop price"
          titleHi="आज का सबसे अच्छा भाव"
          value={best ? `₹${fmt(best.model.today)}/q` : '—'}
          sub={best ? `${best.m.name} · ${activeCrop} · ${best.model.trend}` : 'No feed for this crop'}
          action="See all mandi prices"
          onClick={() => onNavigate('prices')}
        />
        <Card
          icon={Store}
          tone="blue"
          title="Recommended mandi"
          titleHi="सुझाई गई मंडी"
          value={decision ? decision.best.market.name : '—'}
          sub={decision ? `${decision.best.distanceKm} km · confidence ${decision.confidence}%` : ''}
          action="Open smart selling"
          onClick={() => onNavigate('smart')}
        />
        <Card
          icon={Sparkles}
          tone="violet"
          title="Smart selling recommendation"
          titleHi="स्मार्ट बिक्री सलाह"
          value={decision ? decision.headline : '—'}
          sub={decision ? `${decision.headlineHi} · sell around ${decision.sellDate}` : ''}
          action="See why"
          onClick={() => onNavigate('smart')}
        />
        <Card
          icon={IndianRupee}
          tone="emerald"
          title="Estimated crop revenue"
          titleHi="अनुमानित फसल आय"
          value={decision ? `₹${fmt(decision.costs.net)}` : '—'}
          sub={decision ? `${quantity} quintal ${activeCrop} · net after costs (estimate)` : ''}
          action="Sell this lot"
          onClick={() => onNavigate('sell')}
        />
        <Card
          icon={Wallet}
          tone="amber"
          title="Financial support"
          titleHi="वित्तीय सहायता"
          value={finance ? `₹${fmt(finance.amount)} · ${finance.status}` : 'Check eligibility'}
          sub="Demo / financial partner integration — not a loan approval"
          action={finance ? 'View application' : 'Check now'}
          onClick={() => onNavigate('finance')}
        />
        <Card
          icon={Package}
          tone="blue"
          title="Pending orders"
          titleHi="लंबित ऑर्डर"
          value={String(pendingOrders.length)}
          sub={pendingOrders[0] ? `${pendingOrders[0].crop} → ${pendingOrders[0].marketName} (${pendingOrders[0].status})` : 'No pending orders'}
          action="Track orders"
          onClick={() => onNavigate('orders')}
        />
        <Card
          icon={Receipt}
          tone="slate"
          title="Transaction history"
          titleHi="लेन-देन इतिहास"
          value={`₹${fmt(stats.revenue)}`}
          sub={`${stats.total} sales · avg ₹${fmt(stats.avgPrice)}/q · ₹${fmt(stats.pending)} pending`}
          action="View history"
          onClick={() => onNavigate('transactions')}
        />
        <Card
          icon={Camera}
          tone="sky"
          title="Crop quality"
          titleHi="फसल गुणवत्ता"
          value={listing ? `Grade ${listing.grade}` : '—'}
          sub={listing?.qualitySource === 'ai-photo' ? `AI photo score ${listing.qualityScore}/100` : 'Check quality from a photo'}
          action="Open AI quality grading"
          onClick={onGrading}
        />
        <Card
          icon={Mic}
          tone="violet"
          title="Voice assistant"
          titleHi="वॉइस सहायक"
          value={db.voice.length ? `${db.voice.length} commands` : 'Ask by voice'}
          sub="Hindi · English · Hinglish"
          action="Start speaking"
          onClick={() => onNavigate('voice')}
        />
        <Card
          icon={Bell}
          tone="rose"
          title="Notifications"
          titleHi="सूचनाएं"
          value={`${unread} unread`}
          sub={db.notifications[0]?.title ?? 'Nothing new'}
          action="Open notifications"
          onClick={() => onNavigate('notifications')}
        />
      </div>

      <p className="text-xs text-slate-500">
        All prices, forecasts and revenue figures are estimates from modelled Uttar Pradesh market data — they are not guaranteed prices, buyers or profits.
      </p>
    </div>
  )
}

const TONES: Record<string, string> = {
  emerald: 'bg-emerald-600', blue: 'bg-blue-600', violet: 'bg-violet-600', amber: 'bg-amber-500', slate: 'bg-slate-700', sky: 'bg-sky-600', rose: 'bg-rose-600',
}

function Card({
  icon: Icon, tone, title, titleHi, value, sub, action, onClick,
}: {
  icon: LucideIcon
  tone: keyof typeof TONES
  title: string
  titleHi: string
  value: string
  sub: string
  action: string
  onClick: () => void
}) {
  return (
    <button onClick={onClick} className="card p-5 text-left transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md" data-testid="dash-card">
      <div className="flex items-start gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white ${TONES[tone]}`}><Icon size={22} /></span>
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-800">{title}</div>
          <div className="text-xs text-slate-500">{titleHi}</div>
        </div>
      </div>
      <div className="mt-3 truncate text-2xl font-extrabold text-slate-900">{value}</div>
      <p className="mt-1 line-clamp-2 text-sm text-slate-600">{sub}</p>
      <Badge tone="green">{action} →</Badge>
    </button>
  )
}
