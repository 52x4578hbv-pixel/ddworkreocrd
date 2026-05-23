import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchGeminiChat } from '../lib/geminiAnalyzer'
import { theme } from '../lib/theme'

type ChatRole = 'user' | 'assistant'
type GeminiChatSource = 'gemini' | 'fallback'

export type ChatMessage = {
  role: ChatRole
  content: string
}

export default function AiChatPanel(props: {
  deterministicReportText: string
  canUseDatasetFacts: boolean
}) {
  const { deterministicReportText, canUseDatasetFacts } = props

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      role: 'assistant',
      content:
        'Ask a question about the work dataset. You can also say things like “calculate totals for these filters” or “suggest improvements with numbers.”',
    },
  ])

  const [question, setQuestion] = useState<string>('calculate overtime totals for these filters')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastChatSource, setLastChatSource] = useState<GeminiChatSource | null>(null)
  const [debugStage, setDebugStage] = useState<string>('init')

  const [includeDatasetFacts, setIncludeDatasetFacts] = useState<boolean>(canUseDatasetFacts)

  useEffect(() => {
    if (!canUseDatasetFacts) setIncludeDatasetFacts(false)
  }, [canUseDatasetFacts])

  const didAutoAskRef = useRef(false)

  const canAsk = useMemo(() => question.trim().length > 0 && !busy, [question, busy])

  const onAsk = async (overrideQuestion?: string) => {
    const q = (overrideQuestion ?? question).trim()
    if (!q || busy) return

    setBusy(true)
    setError(null)
    setLastChatSource(null)
    setDebugStage('onAsk_start')

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: q }]
    setMessages(nextMessages)
    setDebugStage('user_message_set')
    setQuestion('')

    try {
      const resp = await fetchGeminiChat({
        deterministicReportText: includeDatasetFacts ? deterministicReportText : undefined,
        question: q,
        messages: nextMessages,
      })

      setLastChatSource(resp.source)
      setDebugStage('assistant_message_queued')
      setMessages((cur) => [...cur, { role: 'assistant', content: resp.text }])
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Gemini chat failed.'
      setError(msg)
      setDebugStage('error_catch')
      setMessages((cur) => [
        ...cur,
        {
          role: 'assistant',
          content: `Sorry — I couldn’t get a response. ${msg}`,
        },
      ])
    } finally {
      setBusy(false)
      setDebugStage('onAsk_done')
    }
  }

  // Auto-ask once in local preview to validate end-to-end wiring.
  useEffect(() => {
    if (!canUseDatasetFacts) return
    if (didAutoAskRef.current) return
    didAutoAskRef.current = true

    void onAsk('calculate overtime totals for these filters')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUseDatasetFacts])

  // Keep the conversation view pinned to the newest message.
  const conversationEndRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' })
  }, [messages])

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 10,
          right: 10,
          zIndex: 99999,
          padding: 8,
          border: `2px solid ${theme.text}`,
          borderRadius: theme.radiusSm,
          background: '#fff',
          fontWeight: 1100,
          color: theme.text,
          fontSize: 12,
          boxShadow: `3px 3px 0 ${theme.text}`,
        }}
      >
        AIChat debug: msgs:{messages.length} last:{lastChatSource ?? '—'} busy:{busy ? 'yes' : 'no'} stage:{debugStage}
      </div>
      <div style={{ marginTop: 16, padding: 14, border: `2px solid ${theme.text}`, borderRadius: theme.radiusMd, background: theme.surface }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <div style={{ fontWeight: 1000, color: theme.text }}>Gemini chat</div>
        <div style={{ color: theme.muted2, fontWeight: 950, fontSize: 12 }}>
          {busy ? 'Gemini thinking…' : `Ready${lastChatSource ? ` · last:${lastChatSource}` : ''}`} · msgs:{messages.length}
        </div>
      </div>

      <div style={{ marginTop: 10, padding: 12, border: `2px solid ${theme.text}`, borderRadius: theme.radiusSm, background: '#fff' }}>
        <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 900, color: theme.text, userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={includeDatasetFacts}
            disabled={!canUseDatasetFacts}
            onChange={(e) => setIncludeDatasetFacts(e.target.checked)}
          />
          Use dataset facts (only works in `#/local-preview`)
        </label>

        <div style={{ marginTop: 10 }}>
          <textarea
            aria-label="Ask Gemini"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder='Ask: "calculate overtime totals", "why costs are high", "what should we do next"...'
            rows={3}
            style={{
              width: '100%',
              padding: 10,
              border: `2px solid ${theme.text}`,
              borderRadius: theme.radiusSm,
              fontWeight: 950,
              background: '#fff',
              color: theme.text,
              resize: 'vertical',
              outline: 'none',
            }}
            onKeyDown={(e) => {
              // Submit on Enter (Shift+Enter keeps newline). Also keep Ctrl/Cmd+Enter as a submit shortcut.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void onAsk()
                return
              }
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault()
                void onAsk()
              }
            }}
          />
        </div>

        <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => void onAsk()}
            disabled={!canAsk}
            style={{
              padding: '10px 12px',
              border: `2px solid ${theme.text}`,
              background: canAsk ? theme.text : theme.surface,
              color: canAsk ? '#fff' : theme.text,
              cursor: canAsk ? 'pointer' : 'not-allowed',
              fontWeight: 1000,
              borderRadius: theme.radiusSm,
              boxShadow: canAsk ? `3px 3px 0 ${theme.text}` : undefined,
              whiteSpace: 'nowrap',
              opacity: canAsk ? 1 : 0.7,
            }}
          >
            Ask
          </button>

          <button
            type="button"
            onClick={() => {
              setMessages([
                {
                  role: 'assistant',
                  content:
                    'Chat reset. Ask a new question about the work dataset.',
                },
              ])
              setError(null)
              setQuestion('')
            }}
            style={{
              padding: '10px 12px',
              border: `2px solid ${theme.text}`,
              background: theme.surface,
              color: theme.text,
              cursor: 'pointer',
              fontWeight: 1000,
              borderRadius: theme.radiusSm,
              whiteSpace: 'nowrap',
            }}
          >
            Reset
          </button>
        </div>

        {error ? (
          <div style={{ marginTop: 10, color: theme.error ?? '#ef4444', fontWeight: 950 }}>
            {error}
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 10, padding: 12, border: `2px dashed ${theme.text}`, borderRadius: theme.radiusSm, background: '#fff' }}>
        <div style={{ fontWeight: 1000, color: theme.text }}>Conversation</div>
        <div
          style={{
            marginTop: 10,
            maxHeight: 600,
            overflow: 'auto',
            display: 'grid',
            gap: 10,
          }}
        >
          {messages.map((m, idx) => (
            <div
              key={`${m.role}-${idx}`}
              style={{
                padding: 10,
                border: `2px solid ${theme.text}`,
                borderRadius: theme.radiusSm,
                background: m.role === 'user' ? '#fff' : theme.pageBg,
              }}
            >
              <div style={{ fontWeight: 1000, color: theme.text, fontSize: 12 }}>{m.role === 'user' ? 'You' : 'Gemini'}</div>
              <div style={{ marginTop: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontWeight: 900, color: theme.text }}>
                {m.content}
              </div>
            </div>
          ))}
          <div ref={conversationEndRef} />
        </div>
      </div>
    </div>
    </>
  )
}
