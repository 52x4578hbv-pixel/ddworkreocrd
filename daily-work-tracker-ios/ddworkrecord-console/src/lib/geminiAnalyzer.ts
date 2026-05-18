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
