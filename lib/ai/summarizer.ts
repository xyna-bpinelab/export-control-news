import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Article, SummaryResult, ImpactLevel } from '@/types'
import { buildSummarizePrompt, PROMPT_VERSION } from './prompts'
import { truncateForLLM } from '@/lib/utils/text'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')

const MODEL = process.env.GEMINI_MODEL ?? 'gemini-1.5-flash'
const MAX_TOKENS = 1024

/**
 * 記事を要約してSummaryResultを返す
 */
export async function generateSummary(article: Article): Promise<SummaryResult & {
  tokens_input: number
  tokens_output: number
  model_used: string
  prompt_version: string
}> {
  // コンテンツを切り詰め
  const truncatedArticle: Article = {
    ...article,
    content_text: article.content_text
      ? truncateForLLM(article.content_text, 8000)
      : null,
  }

  const prompt = buildSummarizePrompt(truncatedArticle)

  const model = genAI.getGenerativeModel(
    { model: MODEL, generationConfig: { maxOutputTokens: MAX_TOKENS } },
    { apiVersion: 'v1' },
  )
  // Gemini 無料枠: 15回/分 → 4秒間隔で制限内に収める
  await new Promise((resolve) => setTimeout(resolve, 4000))
  const response = await model.generateContent(prompt)
  const rawText = response.response.text()

  // JSON パース
  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error(`Gemini returned non-JSON: ${rawText.slice(0, 200)}`)
  }

  let parsed: {
    summary_ja?: string
    title_ja?: string
    key_points?: unknown[]
    impact_level?: string
    related_laws?: unknown[]
  }
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    throw new Error(`JSON parse error: ${jsonMatch[0].slice(0, 200)}`)
  }

  const validImpactLevels: ImpactLevel[] = ['high', 'medium', 'low']
  const impact_level: ImpactLevel =
    validImpactLevels.includes(parsed.impact_level as ImpactLevel)
      ? (parsed.impact_level as ImpactLevel)
      : 'low'

  const usageMeta = response.response.usageMetadata
  return {
    summary_ja: parsed.summary_ja ?? '要約を取得できませんでした。',
    title_ja: parsed.title_ja ?? undefined,
    key_points: (parsed.key_points ?? []).filter((p): p is string => typeof p === 'string'),
    impact_level,
    related_laws: (parsed.related_laws ?? []).filter((l): l is string => typeof l === 'string'),
    tokens_input: usageMeta?.promptTokenCount ?? 0,
    tokens_output: usageMeta?.candidatesTokenCount ?? 0,
    model_used: MODEL,
    prompt_version: PROMPT_VERSION,
  }
}
