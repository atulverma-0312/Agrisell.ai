import { Download } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmt } from '../../lib/engine'
import type { DbShape } from '../../lib/store'
import { monthlyRevenue, txnStats } from '../../lib/store'
import { Badge, Stat } from '../ui'

export function Transactions({ db }: { db: DbShape }) {
  const [crop, setCrop] = useState('All')
  const [mandi, setMandi] = useState('All')
  const [status, setStatus] = useState('All')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const crops = ['All', ...new Set(db.transactions.map((t) => t.crop))]
  const mandis = ['All', ...new Set(db.transactions.map((t) => t.mandi))]

  const rows = useMemo(
    () =>
      db.transactions.filter((t) => {
        if (crop !== 'All' && t.crop !== crop) return false
        if (mandi !== 'All' && t.mandi !== mandi) return false
        if (status !== 'All' && t.paymentStatus !== status) return false
        if (from && t.date < new Date(from).getTime()) return false
        if (to && t.date > new Date(to).getTime() + 86_400_000) return false
        return true
      }),
    [db.transactions, crop, mandi, status, from, to],
  )

  const stats = txnStats(rows)
  const monthly = monthlyRevenue(rows)

  function exportCsv() {
    const header = 'Date,Crop,Quantity (q),Buyer/Mandi,Price/q,Gross,Charges,Net,Payment\n'
    const body = rows
      .map((t) => [new Date(t.date).toLocaleDateString('en-IN'), t.crop, t.quantityQuintal, `${t.buyer} (${t.mandi})`, t.pricePerQuintal, t.grossAmount, t.charges, t.netAmount, t.paymentStatus].join(','))
      .join('\n')
    const url = URL.createObjectURL(new Blob([header + body], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'agrisell-transactions.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Transaction History / लेन-देन इतिहास</h1>
          <p className="mt-1 text-slate-600">Every completed and pending sale, with charges and payment status.</p>
        </div>
        <button className="btn-big-outline" onClick={exportCsv} disabled={rows.length === 0}><Download size={18} /> Export CSV</button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Total sales" value={String(stats.total)} hint={`${fmt(stats.volume)} quintal sold`} />
        <Stat label="Total revenue (net)" value={`₹${fmt(stats.revenue)}`} accent="text-emerald-700" hint={`₹${fmt(stats.pending)} pending`} />
        <Stat label="Average selling price" value={`₹${fmt(stats.avgPrice)}/q`} hint="weighted by quantity" />
        <Stat label="Best selling price" value={stats.best ? `₹${fmt(stats.best.pricePerQuintal)}/q` : '—'} hint={stats.best ? `${stats.best.crop} · ${stats.best.mandi}` : ''} />
        <Stat label="Months tracked" value={String(monthly.length)} hint="monthly revenue below" />
      </div>

      <section className="card p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="label" htmlFor="tx-crop">Crop</label>
            <select id="tx-crop" className="input" value={crop} onChange={(e) => setCrop(e.target.value)}>{crops.map((c) => <option key={c}>{c}</option>)}</select>
          </div>
          <div>
            <label className="label" htmlFor="tx-mandi">Mandi</label>
            <select id="tx-mandi" className="input" value={mandi} onChange={(e) => setMandi(e.target.value)}>{mandis.map((m) => <option key={m}>{m}</option>)}</select>
          </div>
          <div>
            <label className="label" htmlFor="tx-status">Payment status</label>
            <select id="tx-status" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option>All</option><option>Pending</option><option>Completed</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="tx-from">From</label>
            <input id="tx-from" type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="tx-to">To</label>
            <input id="tx-to" type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </section>

      <section className="card overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Date</th><th className="px-4 py-3">Crop</th><th className="px-4 py-3">Qty (q)</th>
              <th className="px-4 py-3">Buyer / Mandi</th><th className="px-4 py-3">Price</th><th className="px-4 py-3">Gross</th>
              <th className="px-4 py-3">Charges</th><th className="px-4 py-3">Net</th><th className="px-4 py-3">Payment</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-t border-slate-100" data-testid="txn-row">
                <td className="px-4 py-3">{new Date(t.date).toLocaleDateString('en-IN')}</td>
                <td className="px-4 py-3 font-semibold text-slate-800">{t.crop}</td>
                <td className="px-4 py-3">{t.quantityQuintal}</td>
                <td className="px-4 py-3">{t.buyer}<div className="text-xs text-slate-500">{t.mandi}</div></td>
                <td className="px-4 py-3">₹{fmt(t.pricePerQuintal)}</td>
                <td className="px-4 py-3">₹{fmt(t.grossAmount)}</td>
                <td className="px-4 py-3 text-rose-600">−₹{fmt(t.charges)}</td>
                <td className="px-4 py-3 font-bold text-emerald-700">₹{fmt(t.netAmount)}</td>
                <td className="px-4 py-3"><Badge tone={t.paymentStatus === 'Completed' ? 'green' : 'amber'}>{t.paymentStatus}</Badge></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">No transactions match these filters.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="card p-5">
        <div className="mb-2 text-sm font-bold text-slate-700">Historical performance — monthly net revenue and volume</div>
        <div className="h-64">
          <ResponsiveContainer>
            <ComposedChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="l" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `₹${Math.round(v / 1000)}k`} />
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v, n) => (n === 'Net revenue' ? `₹${fmt(Number(v))}` : `${Number(v)} q`)} />
              <Legend />
              <Bar yAxisId="l" dataKey="revenue" name="Net revenue" fill="#16a34a" radius={[6, 6, 0, 0]} />
              <Line yAxisId="r" type="monotone" dataKey="volume" name="Quintal sold" stroke="#2563eb" strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  )
}
