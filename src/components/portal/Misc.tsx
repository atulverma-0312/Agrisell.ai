import { Bell, CheckCheck, Landmark, Mic, Package, ShieldCheck, Sprout, Store, Users } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmt } from '../../lib/engine'
import { LANGS } from '../../lib/i18n'
import type { DbShape, Lang } from '../../lib/store'
import { adminStats, markAllRead, markRead, monthlyRevenue } from '../../lib/store'
import { Badge, Stat } from '../ui'

const KIND_TONE: Record<string, 'slate' | 'green' | 'amber' | 'blue' | 'violet'> = {
  price: 'blue', order: 'violet', finance: 'amber', recommendation: 'green', payment: 'green', system: 'slate',
}

export function Notifications({ db, update }: { db: DbShape; update: (fn: (d: DbShape) => DbShape) => void }) {
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Notifications / सूचनाएं</h1>
          <p className="mt-1 text-slate-600">{db.notifications.filter((n) => !n.read).length} unread</p>
        </div>
        <button className="btn-big-outline" onClick={() => update(markAllRead)} data-testid="mark-all-read"><CheckCheck size={18} /> Mark all as read</button>
      </header>
      <div className="space-y-3">
        {db.notifications.length === 0 && <p className="card p-6 text-slate-500">No notifications yet.</p>}
        {db.notifications.map((n) => (
          <button
            key={n.id}
            onClick={() => update((d) => markRead(d, n.id))}
            className={`card w-full p-5 text-left ${n.read ? '' : 'border-emerald-300 bg-emerald-50/40'}`}
            data-testid="notification-item"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-base font-bold text-slate-900">{n.title}</span>
              <span className="flex items-center gap-2">
                <Badge tone={KIND_TONE[n.kind] ?? 'slate'}>{n.kind}</Badge>
                <span className="text-xs text-slate-500">{new Date(n.at).toLocaleString('en-IN')}</span>
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">{n.body}</p>
            {!n.read && <span className="mt-2 inline-block text-xs font-bold text-emerald-700">Tap to mark as read</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Profile({
  db,
  update,
  lang,
  onLang,
  onReset,
}: {
  db: DbShape
  update: (fn: (d: DbShape) => DbShape) => void
  lang: Lang
  onLang: (l: Lang) => void
  onReset: () => void
}) {
  const p = db.profile
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold text-slate-900">Profile / प्रोफ़ाइल</h1>
      <section className="card p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="Farmer" value={`${p.name} (${p.nameHi})`} hint={p.phone} />
          <Stat label="Village & district" value={`${p.village}, ${p.district}`} hint={`${p.landAcres} acres`} />
          <Stat label="Farmer ID" value={p.farmerId} hint={p.bank} />
        </div>
        <div className="mt-6">
          <div className="label-big">Language / भाषा</div>
          <div className="flex flex-wrap gap-2">
            {LANGS.map((l) => (
              <button
                key={l.key}
                className={lang === l.key ? 'btn-big' : 'btn-big-outline'}
                onClick={() => { onLang(l.key); update((d) => ({ ...d, profile: { ...d.profile, language: l.key } })) }}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
          <div className="flex items-center gap-2 font-bold text-slate-700"><ShieldCheck size={16} /> Safety & trust</div>
          <ul className="mt-2 space-y-1">
            <li>• Prices, demand and forecasts are estimates from modelled Uttar Pradesh market data — not guaranteed future prices.</li>
            <li>• AgriSell is not a bank or lender; financial eligibility is simulated and does not constitute a loan approval.</li>
            <li>• Photo quality grading is an AI estimate, not an official APMC / e-NAM / laboratory certificate.</li>
            <li>• Your data in this demo stays in this browser; nothing is shared with a buyer without your action.</li>
          </ul>
        </div>
        <button className="btn-big-outline mt-6" onClick={onReset}>Reset demo data</button>
      </section>
    </div>
  )
}

const PIE = ['#16a34a', '#2563eb', '#f97316', '#a855f7', '#0ea5e9', '#eab308']

export function AdminAnalytics({ db }: { db: DbShape }) {
  const s = adminStats(db)
  const monthly = monthlyRevenue(db.transactions)
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold text-slate-900">Admin / System Analytics</h1>
        <p className="mt-1 text-slate-600">Platform-level activity. Farmer count is a simulated demo population; all other figures come from live local data.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Farmers" value={fmt(s.farmers)} hint="demo population" />
        <Stat label="Active crop listings" value={String(s.activeListings)} hint={`${db.listings.length} total`} />
        <Stat label="Total transactions" value={String(s.transactions)} hint={`₹${fmt(s.revenue)} net revenue`} />
        <Stat label="Total crop volume" value={`${fmt(s.volume)} q`} hint={`avg ₹${fmt(s.avgPrice)}/q`} />
        <Stat label="Financial applications" value={String(s.financeApplications)} hint="demo partner integration" />
        <Stat label="Voice assistant usage" value={String(s.voiceQueries)} hint="saved commands" />
        <Stat label="Completed orders" value={String(s.completedOrders)} accent="text-emerald-700" />
        <Stat label="Pending orders" value={String(s.pendingOrders)} accent="text-amber-600" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700"><Sprout size={16} className="text-emerald-600" /> Most active crops</div>
          <div className="h-60">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={s.topCrops} dataKey="count" nameKey="crop" outerRadius={90} label>
                  {s.topCrops.map((c, i) => <Cell key={c.crop} fill={PIE[i % PIE.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="card p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700"><Store size={16} className="text-blue-600" /> Most active mandis</div>
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={s.topMandis} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="mandi" width={150} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563eb" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="card p-5 lg:col-span-2">
          <div className="mb-2 text-sm font-bold text-slate-700">Monthly platform revenue (net, ₹)</div>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `₹${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v) => `₹${fmt(Number(v))}`} />
                <Bar dataKey="revenue" fill="#16a34a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm text-slate-600">
        <p className="card flex items-center gap-2 p-4"><Users size={16} /> 1 signed-in farmer on this device</p>
        <p className="card flex items-center gap-2 p-4"><Package size={16} /> {db.orders.length} orders recorded</p>
        <p className="card flex items-center gap-2 p-4"><Landmark size={16} /> {db.finance.length} finance applications</p>
        <p className="card flex items-center gap-2 p-4"><Mic size={16} /> {db.voice.length} assistant queries</p>
      </div>
    </div>
  )
}

export function NotificationBell({ unread }: { unread: number }) {
  return (
    <span className="relative inline-flex">
      <Bell size={22} />
      {unread > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-bold text-white">
          {unread}
        </span>
      )}
    </span>
  )
}
