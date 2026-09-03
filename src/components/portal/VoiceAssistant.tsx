import { ArrowRight, History, Mic, MicOff, Send } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { EXAMPLE_COMMANDS } from '../../lib/intents'
import type { Intent, PortalPage } from '../../lib/intents'
import { smartSearch } from '../../lib/search'
import type { SearchResult } from '../../lib/search'
import type { DbShape } from '../../lib/store'
import { logVoice } from '../../lib/store'
import type { CleanMarket } from '../../lib/types'
import { Badge } from '../ui'

/* Minimal typings for the Web Speech API (not in lib.dom for all browsers). */
interface SpeechResultAlternative { transcript: string }
interface SpeechResultItem { 0: SpeechResultAlternative; isFinal: boolean }
interface SpeechEvent { results: ArrayLike<SpeechResultItem> }
interface Recognition {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((e: SpeechEvent) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
interface RecognitionCtor { new (): Recognition }

function getRecognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export interface AssistantOutcome {
  text: string
  intent: Intent
  results: SearchResult[]
}

export function VoiceAssistant({
  db,
  update,
  markets,
  onNavigate,
  initialQuery,
}: {
  db: DbShape
  update: (fn: (d: DbShape) => DbShape) => void
  markets: CleanMarket[]
  onNavigate: (page: PortalPage, intent: Intent) => void
  initialQuery?: string
}) {
  const [text, setText] = useState(initialQuery ?? '')
  const [listening, setListening] = useState(false)
  const [outcome, setOutcome] = useState<AssistantOutcome | null>(null)
  const [micError, setMicError] = useState<string | null>(null)
  const recognitionRef = useRef<Recognition | null>(null)
  const supported = getRecognitionCtor() !== null

  useEffect(() => () => recognitionRef.current?.stop(), [])

  function run(query: string, mode: 'voice' | 'text') {
    const q = query.trim()
    if (!q) return
    const { intent, results } = smartSearch(q, db, markets)
    setOutcome({ text: q, intent, results })
    update((d) => logVoice(d, { text: q, intent: intent.label, action: intent.action, mode }))
  }

  function toggleMic() {
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }
    const Ctor = getRecognitionCtor()
    if (!Ctor) {
      setMicError('Voice input is not supported in this browser — type your question below instead.')
      return
    }
    const rec = new Ctor()
    rec.lang = 'hi-IN' // handles Hindi and Hinglish; English words are transcribed too
    rec.interimResults = true
    rec.continuous = false
    rec.onresult = (e) => {
      const last = e.results[e.results.length - 1]
      const transcript = last[0].transcript
      setText(transcript)
      if (last.isFinal) run(transcript, 'voice')
    }
    rec.onerror = () => {
      setMicError('Could not hear you clearly. Please try again or type your question.')
      setListening(false)
    }
    rec.onend = () => setListening(false)
    recognitionRef.current = rec
    setMicError(null)
    setListening(true)
    rec.start()
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold text-slate-900">Voice Assistant / वॉइस सहायक</h1>
        <p className="mt-1 text-slate-600">Speak or type in Hindi, English or Hinglish — the assistant understands what you need and takes you there.</p>
      </header>

      <section className="card p-6 text-center">
        <button
          onClick={toggleMic}
          className={`mx-auto flex h-28 w-28 items-center justify-center rounded-full text-white shadow-lg transition ${listening ? 'animate-pulse bg-rose-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}
          aria-label={listening ? 'Stop listening' : 'Start voice command'}
          data-testid="mic-button"
        >
          {listening ? <MicOff size={44} /> : <Mic size={44} />}
        </button>
        <p className="mt-3 font-semibold text-slate-700">{listening ? 'Listening… बोलिए' : 'Tap the mic and speak / माइक दबाकर बोलें'}</p>
        {!supported && <p className="mt-1 text-sm text-amber-700">Voice input is unavailable in this browser — use the text box below.</p>}
        {micError && <p className="mt-1 text-sm text-rose-600">{micError}</p>}

        <div className="mx-auto mt-5 flex max-w-2xl gap-2">
          <input
            className="input-big"
            placeholder="गेहूं का आज का भाव बताओ / Type your question"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && run(text, 'text')}
            data-testid="voice-text"
          />
          <button className="btn-big" onClick={() => run(text, 'text')} data-testid="voice-send"><Send size={18} /> Ask</button>
        </div>

        <div className="mx-auto mt-4 flex max-w-3xl flex-wrap justify-center gap-2">
          {EXAMPLE_COMMANDS.map((c) => (
            <button key={c} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-emerald-100" onClick={() => { setText(c); run(c, 'text') }}>
              {c}
            </button>
          ))}
        </div>
      </section>

      {outcome && (
        <section className="card p-6 fade-up" data-testid="voice-outcome">
          <ol className="grid gap-3 md:grid-cols-4">
            <Flow label="User command" value={outcome.text} />
            <Flow label="Detected intent" value={`${outcome.intent.label} / ${outcome.intent.labelHi}`} />
            <Flow label="Action taken" value={outcome.intent.action} />
            <Flow label="Result" value={`${outcome.results.length} matches found`} />
          </ol>
          <button className="btn-big mt-5" onClick={() => onNavigate(outcome.intent.page, outcome.intent)} data-testid="voice-goto">
            Open {outcome.intent.label} <ArrowRight size={18} />
          </button>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[...new Set(outcome.results.map((r) => r.category))].map((cat) => (
              <div key={cat} className="rounded-xl border border-slate-200 p-4">
                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{cat}</div>
                <ul className="space-y-2">
                  {outcome.results.filter((r) => r.category === cat).map((r) => (
                    <li key={r.title}>
                      <button className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-emerald-50" onClick={() => onNavigate(r.page, outcome.intent)}>
                        <div className="text-sm font-semibold text-slate-800">{r.title}</div>
                        <div className="text-xs text-slate-500">{r.detail}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card p-6">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700"><History size={16} /> Command history ({db.voice.length})</div>
        {db.voice.length === 0 && <p className="mt-2 text-sm text-slate-500">Your voice and text commands will be saved here.</p>}
        <ul className="mt-3 space-y-2">
          {db.voice.slice(0, 12).map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="font-medium text-slate-800">“{v.text}”</span>
              <span className="flex items-center gap-2 text-xs text-slate-500">
                <Badge tone={v.mode === 'voice' ? 'violet' : 'slate'}>{v.mode}</Badge>
                {v.intent} · {new Date(v.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function Flow({ label, value }: { label: string; value: string }) {
  return (
    <li className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-bold text-slate-800">{value}</div>
    </li>
  )
}
