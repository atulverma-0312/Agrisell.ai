import { useMemo, useState } from 'react'
import geo from '../lib/up-districts.json'

type Ring = [number, number][]
interface Feature {
  properties: { name: string }
  geometry: { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] }
}
const FEATURES = (geo as unknown as { features: Feature[] }).features

const W = 760
const H = 560
const PAD = 12

function bbox() {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const f of FEATURES) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
    for (const poly of polys) for (const [x, y] of poly[0]) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  return { minX, minY, maxX, maxY }
}
const BB = bbox()
// Equirectangular projection with latitude correction, fit to viewBox
const midLat = ((BB.minY + BB.maxY) / 2) * (Math.PI / 180)
const kx = Math.cos(midLat)
const SCALE = Math.min((W - 2 * PAD) / ((BB.maxX - BB.minX) * kx), (H - 2 * PAD) / (BB.maxY - BB.minY))
const project = ([lon, lat]: [number, number]): [number, number] => [
  PAD + (lon - BB.minX) * kx * SCALE,
  PAD + (BB.maxY - lat) * SCALE,
]
function ringPath(r: Ring) {
  return r.map((c, i) => `${i ? 'L' : 'M'}${project(c).map((v) => v.toFixed(1)).join(',')}`).join('') + 'Z'
}
const PATHS: { name: string; d: string; centroid: [number, number] }[] = FEATURES.map((f) => {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates
  const d = polys.map((p) => p.map(ringPath).join('')).join('')
  let sx = 0, sy = 0, n = 0
  for (const poly of polys) for (const c of poly[0]) { const [x, y] = project(c); sx += x; sy += y; n++ }
  return { name: f.properties.name, d, centroid: [sx / n, sy / n] }
})

const RAMP = ['#fee2e2', '#fde68a', '#bbf7d0', '#4ade80', '#15803d']

export function DistrictMap({
  values,
  selected,
  home,
  onSelect,
  format,
}: {
  values: Record<string, number>
  selected: string | null
  home: string
  onSelect: (district: string) => void
  format: (v: number) => string
}) {
  const [hover, setHover] = useState<string | null>(null)
  const thresholds = useMemo(() => {
    const vs = Object.values(values).sort((a, b) => a - b)
    if (!vs.length) return []
    return [0.2, 0.4, 0.6, 0.8].map((q) => vs[Math.floor(q * (vs.length - 1))])
  }, [values])
  const colorOf = (name: string) => {
    const v = values[name]
    if (v === undefined) return '#e2e8f0'
    let i = 0
    while (i < thresholds.length && v > thresholds[i]) i++
    return RAMP[i]
  }
  const hovered = hover ? PATHS.find((p) => p.name === hover) : null
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Uttar Pradesh district map">
        {PATHS.map((p) => (
          <path
            key={p.name}
            d={p.d}
            fill={colorOf(p.name)}
            stroke={selected === p.name ? '#0f172a' : '#ffffff'}
            strokeWidth={selected === p.name ? 2.5 : 0.8}
            className="cursor-pointer transition-opacity hover:opacity-80"
            onMouseEnter={() => setHover(p.name)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onSelect(p.name)}
            data-district={p.name}
          />
        ))}
        {PATHS.filter((p) => p.name === home).map((p) => (
          <g key="home">
            <circle cx={p.centroid[0]} cy={p.centroid[1]} r={7} fill="#7c3aed" stroke="#fff" strokeWidth={2} />
            <text x={p.centroid[0]} y={p.centroid[1] - 11} textAnchor="middle" fontSize={11} fontWeight={700} fill="#4c1d95">You</text>
          </g>
        ))}
        {hovered && (
          <g pointerEvents="none">
            <rect x={Math.min(hovered.centroid[0] + 10, W - 190)} y={Math.max(hovered.centroid[1] - 40, 4)} width={180} height={36} rx={6} fill="#0f172a" opacity={0.92} />
            <text x={Math.min(hovered.centroid[0] + 18, W - 182)} y={Math.max(hovered.centroid[1] - 40, 4) + 15} fontSize={12} fontWeight={700} fill="#fff">{hovered.name}</text>
            <text x={Math.min(hovered.centroid[0] + 18, W - 182)} y={Math.max(hovered.centroid[1] - 40, 4) + 29} fontSize={11} fill="#a7f3d0">
              {values[hovered.name] !== undefined ? format(values[hovered.name]) : 'no data'}
            </text>
          </g>
        )}
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <span className="font-semibold">Low</span>
        {RAMP.map((c) => <span key={c} className="h-3 w-8 rounded" style={{ background: c }} />)}
        <span className="font-semibold">High</span>
        <span className="ml-auto text-slate-400">Click any district for its direct result</span>
      </div>
    </div>
  )
}
