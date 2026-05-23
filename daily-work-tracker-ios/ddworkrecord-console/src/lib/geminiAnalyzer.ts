import type { AiReportContext } from './aiAnalyzerReport'

export type GeminiAnalyzerResponse = {
  text: string
  source: 'gemini' | 'fallback'
}

export async function fetchGeminiAnalyzerReport(params: {
  context: AiReportContext
  deterministicReportText: string
}): Promise<GeminiAnalyzerResponse> {
  const res = await fetch('/api/v1/console/ai-analyzer/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      context: params.context,
      deterministicReportText: params.deterministicReportText,
    }),
  })

  if (!res.ok) {
    const msg = await res.text().catch(() => '')
    throw new Error(`Gemini request failed: ${res.status} ${msg}`)
  }

  const data = (await res.json()) as unknown

  if (
    !data ||
    typeof data !== 'object' ||
    !('text' in data) ||
    typeof (data as { text?: unknown }).text !== 'string' ||
    !('source' in data) ||
    !['gemini', 'fallback'].includes((data as { source?: unknown }).source as string)
  ) {
    throw new Error('Gemini request returned an unexpected response shape.')
  }

  return data as GeminiAnalyzerResponse
}

export type GeminiChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export async function fetchGeminiChat(params: {
  deterministicReportText?: string
  question: string
  messages: GeminiChatMessage[]
}): Promise<GeminiAnalyzerResponse> {
  // Backend note: the running VPS may not yet include /ai-analyzer/chat.
  // We intentionally route chat through the existing /ai-analyzer/gemini endpoint,
  // by embedding the question + chat context into deterministicReportText.
  const deterministic = params.deterministicReportText?.trim() || ''

  const chatHistory = params.messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n')

  const deterministicWithChat = [
    deterministic || '(no deterministic facts provided)',
    '',
    'USER QUESTION:',
    params.question.trim(),
    '',
    'CHAT HISTORY:',
    chatHistory,
  ].join('\n')

  const res = await fetch('/api/v1/console/ai-analyzer/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // context is ignored by backend today; keep it out to reduce payload.
      deterministicReportText: deterministicWithChat,
    }),
  })

  if (!res.ok) {
    const msg = await res.text().catch(() => '')
    throw new Error(`Gemini chat failed: ${res.status} ${msg}`)
  }

  const data = (await res.json()) as unknown

  if (
    !data ||
    typeof data !== 'object' ||
    !('text' in data) ||
    typeof (data as { text?: unknown }).text !== 'string' ||
    !('source' in data) ||
    !['gemini', 'fallback'].includes((data as { source?: unknown }).source as string)
  ) {
    throw new Error('Gemini chat returned an unexpected response shape.')
  }

  return data as GeminiAnalyzerResponse
}
