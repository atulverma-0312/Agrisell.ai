import { CheckCircle2, PackageCheck, Truck } from 'lucide-react'
import { fmt } from '../../lib/engine'
import type { DbShape, OrderStatus } from '../../lib/store'
import { advanceOrder } from '../../lib/store'
import { Badge } from '../ui'

const FLOW: OrderStatus[] = ['Order Confirmed', 'In Transit', 'Delivered', 'Payment Pending', 'Payment Completed']

const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  'Order Confirmed': 'Mark dispatched (In Transit)',
  'In Transit': 'Mark delivered at mandi',
  Delivered: 'Move to payment',
  'Payment Pending': 'Confirm payment received',
}

function tone(s: OrderStatus): 'slate' | 'blue' | 'amber' | 'green' | 'red' {
  if (s === 'Payment Completed') return 'green'
  if (s === 'Cancelled') return 'red'
  if (s === 'Payment Pending' || s === 'Delivered') return 'amber'
  return 'blue'
}

export function Orders({ db, update }: { db: DbShape; update: (fn: (d: DbShape) => DbShape) => void }) {
  const pending = db.orders.filter((o) => o.status !== 'Payment Completed' && o.status !== 'Cancelled')
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold text-slate-900">Orders / ऑर्डर</h1>
        <p className="mt-1 text-slate-600">{pending.length} pending · {db.orders.length} total. Every step updates the crop status, transaction and notifications.</p>
      </header>

      {db.orders.length === 0 && <p className="card p-6 text-slate-500">No orders yet — sell a crop lot to create one.</p>}

      <div className="space-y-4">
        {db.orders.map((o) => {
          const idx = FLOW.indexOf(o.status)
          const next = idx >= 0 && idx < FLOW.length - 1 ? FLOW[idx + 1] : null
          return (
            <article key={o.id} className="card p-5" data-testid="order-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-bold text-slate-900">{o.crop} · {o.quantityQuintal} quintal · Grade {o.grade}</div>
                  <div className="text-sm text-slate-600">{o.marketName} · buyer {o.buyer} · ₹{fmt(o.pricePerQuintal)}/q</div>
                  <div className="text-xs text-slate-500">Order {o.id} · placed {new Date(o.placedAt).toLocaleDateString('en-IN')} · {o.transport.mode} (₹{fmt(o.transport.cost)}, ETA {o.transport.eta})</div>
                </div>
                <div className="text-right">
                  <Badge tone={tone(o.status)}>{o.status}</Badge>
                  <div className="mt-1 text-xl font-extrabold text-emerald-700">₹{fmt(o.netAmount)}</div>
                  <div className="text-xs text-slate-500">net after ₹{fmt(o.charges)} charges</div>
                </div>
              </div>

              <ol className="mt-3 flex flex-wrap gap-1.5">
                {FLOW.map((s, i) => (
                  <li key={s} className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${i < idx ? 'bg-emerald-50 text-emerald-700' : i === idx ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    {i <= idx && <CheckCircle2 size={11} />} {s}
                  </li>
                ))}
              </ol>

              {next && (
                <button className="btn-big mt-4" onClick={() => update((d) => advanceOrder(d, o.id, next))} data-testid="advance-order">
                  {next === 'Payment Completed' ? <PackageCheck size={18} /> : <Truck size={18} />} {NEXT_LABEL[o.status]}
                </button>
              )}
              {o.status === 'Payment Completed' && (
                <p className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
                  <CheckCircle2 size={18} /> Transaction secured — payment of ₹{fmt(o.netAmount)} completed.
                </p>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}
