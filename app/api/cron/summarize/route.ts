import { NextResponse } from 'next/server'
import { verifyCronRequest } from '@/lib/utils/cron-auth'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { generateSummary } from '@/lib/ai/summarizer'
import type { Article } from '@/types'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const BATCH_SIZE = parseInt(process.env.SUMMARIZE_BATCH_SIZE ?? '10', 10)

export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()
  const start = Date.now()

  // 未要約記事をバッチ取得
  const { data: articles, error } = await supabase
    .from('articles')
    .select('*')
    .eq('status', 'collected')
    .order('collected_at', { ascending: true })
    .limit(BATCH_SIZE)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!articles || articles.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, message: '要約待ち記事なし' })
  }

  // 二重処理防止: status を summarizing に更新
  const ids = (articles as Article[]).map((a) => a.id)
  await supabase
    .from('articles')
    .update({ status: 'summarizing' })
    .in('id', ids)

  let processed = 0
  let failed = 0

  for (const article of articles as Article[]) {
    try {
      const result = await generateSummary(article)

      // summaries テーブルに保存
      const { error: summaryError } = await supabase.from('summaries').upsert({
        article_id: article.id,
        summary_ja: result.summary_ja,
        key_points: result.key_points,
        impact_level: result.impact_level,
        related_laws: result.related_laws,
        model_used: result.model_used,
        prompt_version: result.prompt_version,
        tokens_input: result.tokens_input,
        tokens_output: result.tokens_output,
      })

      if (summaryError) throw new Error(summaryError.message)

      // 記事のステータス更新（英語記事の場合は title_ja も更新）
      const updateData: Record<string, unknown> = { status: 'summarized' }
      if (result.title_ja && article.lang === 'en') {
        updateData.title_ja = result.title_ja
      }

      await supabase.from('articles').update(updateData).eq('id', article.id)

      processed++
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      await supabase
        .from('articles')
        .update({ status: 'error', error_message: errorMessage })
        .eq('id', article.id)
      failed++
    }
  }

  // ログ記録
  await supabase.from('collection_logs').insert({
    source_id: null,
    job_type: 'summarizer',
    status: failed === 0 ? 'success' : processed > 0 ? 'partial' : 'error',
    articles_found: articles.length,
    articles_new: processed,
    error_message: failed > 0 ? `${failed}件の要約に失敗` : null,
    duration_ms: Date.now() - start,
  })

  return NextResponse.json({
    ok: true,
    processed,
    failed,
    duration_ms: Date.now() - start,
  })
}
