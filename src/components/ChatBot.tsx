import { Bot, MessageCircle, Send, Settings2, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { llmReply, localAssistantReply, type ChatContext, type ChatMessage } from '../lib/chat'

const QUICK = ['Where should I sell?', 'When should I sell?', 'What is e-NAM?', 'How do I negotiate?']
const KEY_STORAGE = 'agrisell.openai_key'

export function ChatBot({ ctx }: { ctx: ChatContext }) {
  const [open, setOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(KEY_STORAGE) ?? import.meta.env.VITE_OPENAI_API_KEY ?? '')
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: `Namaste! I'm your AgriSell AI assistant. Ask me anything about selling your ${ctx.input.crop} — markets, prices, timing, e-NAM, MSP or payments.` },
  ])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  function saveKey(v: string) {
    setApiKey(v)
    if (v) localStorage.setItem(KEY_STORAGE, v)
    else localStorage.removeItem(KEY_STORAGE)
  }

  async function send(q: string) {
    const question = q.trim()
    if (!question || busy) return
    const history: ChatMessage[] = [...messages, { role: 'user', content: question }]
    setMessages(history)
    setText('')
    setBusy(true)
    try {
      const answer = apiKey ? await llmReply(history, ctx, apiKey) : localAssistantReply(question, ctx)
      setMessages([...history, { role: 'assistant', content: answer }])
    } catch {
      setMessages([...history, { role: 'assistant', content: `${localAssistantReply(question, ctx)}\n\n(Cloud AI unavailable — answered from built-in knowledge.)` }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-xl transition hover:bg-violet-700"
          aria-label="Open AI assistant"
        >
          <MessageCircle size={20} /> Ask AI
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-40 flex h-[min(600px,85vh)] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl fade-up">
          <div className="flex items-center gap-2 bg-violet-600 px-4 py-3 text-white">
            <Bot size={20} />
            <div className="flex-1">
              <div className="text-sm font-bold">AgriSell AI Assistant</div>
              <div className="text-[11px] text-violet-200">{apiKey ? 'Cloud AI mode' : 'Built-in knowledge mode'}</div>
            </div>
            <button onClick={() => setShowSettings((s) => !s)} className="rounded p-1 hover:bg-white/20" aria-label="Settings"><Settings2 size={16} /></button>
            <button onClick={() => setOpen(false)} className="rounded p-1 hover:bg-white/20" aria-label="Close"><X size={18} /></button>
          </div>

          {showSettings && (
            <div className="border-b border-slate-200 bg-violet-50 p-3 text-xs">
              <div className="flex items-center gap-1 font-semibold text-violet-700"><Sparkles size={14} /> Connect a generative model (optional)</div>
              <input className="input mt-2 !text-xs" type="password" placeholder="OpenAI API key (sk-...) — stored in this browser only" value={apiKey} onChange={(e) => saveKey(e.target.value)} />
              <p className="mt-1 text-slate-500">Without a key, the assistant answers from built-in agricultural knowledge and your live recommendation.</p>
            </div>
          )}

          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${m.role === 'user' ? 'rounded-br-sm bg-emerald-600 text-white' : 'rounded-bl-sm border border-slate-200 bg-white text-slate-800'}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {busy && <div className="text-xs text-slate-400">Assistant is typing…</div>}
            <div ref={endRef} />
          </div>

          <div className="border-t border-slate-200 bg-white p-2">
            <div className="mb-2 flex gap-1.5 overflow-x-auto">
              {QUICK.map((q) => (
                <button key={q} onClick={() => send(q)} className="whitespace-nowrap rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-700 hover:bg-violet-100">{q}</button>
              ))}
            </div>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send(text) }}>
              <input className="input flex-1" placeholder="Ask about markets, prices, timing…" value={text} onChange={(e) => setText(e.target.value)} />
              <button type="submit" className="btn-primary !bg-violet-600 !px-3 hover:!bg-violet-700" disabled={busy || !text.trim()} aria-label="Send"><Send size={16} /></button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
