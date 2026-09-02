import { CheckCircle2, ClipboardList, Leaf, ScanSearch, X } from 'lucide-react'
import { CROPS, LOCATIONS } from '../lib/data'
import type { SharedAssessment } from '../lib/grading'
import type { FarmerConstraints, FarmerInput, Grade } from '../lib/types'
import { Badge, StepHeader } from './ui'

export function InputStep({
  input,
  constraints,
  onInput,
  onConstraints,
  onGradeFromPhoto,
  aiAssessment,
  onClearAssessment,
}: {
  input: FarmerInput
  constraints: FarmerConstraints
  onInput: (v: FarmerInput) => void
  onConstraints: (v: FarmerConstraints) => void
  onGradeFromPhoto?: () => void
  aiAssessment?: SharedAssessment | null
  onClearAssessment?: () => void
}) {
  const aiApplied = aiAssessment && aiAssessment.predictedGrade === input.grade
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card p-6 fade-up">
        <StepHeader step={1} title="Farmer Input" subtitle="What are you selling and from where?" icon={Leaf} color="bg-emerald-600" />
        {aiAssessment && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900" data-testid="ai-assessment-banner">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600" />
              <span>
                AI photo grade applied: <b>Grade {aiAssessment.predictedGrade}</b> · {aiAssessment.qualityScore}/100 · {Math.round(aiAssessment.confidence * 100)}% confidence · {aiAssessment.quantityKg.toLocaleString('en-IN')} kg
              </span>
              {aiAssessment.source === 'demo' && <Badge tone="amber">Demo AI Result</Badge>}
              {!aiApplied && <Badge tone="amber">grade edited manually</Badge>}
            </div>
            {onClearAssessment && <button className="text-xs text-slate-500 hover:underline" onClick={onClearAssessment}><X size={12} className="inline" /> dismiss</button>}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="crop">Crop</label>
            <select id="crop" className="input" value={input.crop} onChange={(e) => onInput({ ...input, crop: e.target.value })}>
              {CROPS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="qty">Quantity (quintals)</label>
            <input id="qty" type="number" min={1} className="input" value={input.quantityQuintal}
              onChange={(e) => onInput({ ...input, quantityQuintal: Math.max(1, Number(e.target.value)) })} />
          </div>
          <div>
            <label className="label" htmlFor="grade">
              Quality / Grade
              {onGradeFromPhoto && (
                <button type="button" className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline" onClick={onGradeFromPhoto}>
                  <ScanSearch size={12} /> Estimate from photo (AI)
                </button>
              )}
            </label>
            <select id="grade" className="input" value={input.grade} onChange={(e) => onInput({ ...input, grade: e.target.value as Grade })}>
              <option value="A">Grade A (premium)</option>
              <option value="B">Grade B (standard)</option>
              <option value="C">Grade C (fair)</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="loc">Location</label>
            <select id="loc" className="input" value={input.location} onChange={(e) => onInput({ ...input, location: e.target.value })}>
              {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="card p-6 fade-up" style={{ animationDelay: '80ms' }}>
        <StepHeader step={2} title="Farmer Constraints" subtitle="Limits the engine must respect" icon={ClipboardList} color="bg-blue-600" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="deadline">Selling deadline (days)</label>
            <input id="deadline" type="number" min={0} max={60} className="input" value={constraints.sellingDeadlineDays}
              onChange={(e) => onConstraints({ ...constraints, sellingDeadlineDays: Math.min(60, Math.max(0, Number(e.target.value))) })} />
          </div>
          <div>
            <label className="label" htmlFor="storage">Own storage capacity (quintals)</label>
            <input id="storage" type="number" min={0} className="input" value={constraints.storageCapacityQuintal}
              onChange={(e) => onConstraints({ ...constraints, storageCapacityQuintal: Math.max(0, Number(e.target.value)) })} />
          </div>
          <div>
            <label className="label" htmlFor="budget">Budget for logistics (₹)</label>
            <input id="budget" type="number" min={0} step={500} className="input" value={constraints.budgetInr}
              onChange={(e) => onConstraints({ ...constraints, budgetInr: Math.max(0, Number(e.target.value)) })} />
          </div>
          <div>
            <label className="label" htmlFor="transport">Transport limit (km)</label>
            <input id="transport" type="number" min={10} step={10} className="input" value={constraints.transportLimitKm}
              onChange={(e) => onConstraints({ ...constraints, transportLimitKm: Math.max(10, Number(e.target.value)) })} />
          </div>
        </div>
      </section>
    </div>
  )
}
