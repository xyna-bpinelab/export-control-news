import type { Article } from '@/types'

export const PROMPT_VERSION = 'v1'

export function buildSummarizePrompt(article: Article): string {
  const isEnglish = article.lang === 'en'
  const title = article.title
  const content = article.content_text ?? ''

  return `あなたは輸出管理・安全保障貿易規制の専門家です。
以下の記事を分析し、日本の輸出管理担当者向けに日本語で要約してください。

## 記事情報
- タイトル: ${title}
- 言語: ${isEnglish ? '英語' : '日本語'}
- 本文:
${content}

## 出力形式（JSON のみ、説明文不要）
{
  "summary_ja": "日本語での要約（3〜5文。誰が・何を・いつから・対象国/品目・実務上の影響を含めること）",
  "title_ja": "${isEnglish ? '日本語訳タイトル（英語記事の場合のみ）' : title}",
  "key_points": [
    "重要ポイント1（20〜40文字）",
    "重要ポイント2（20〜40文字）",
    "重要ポイント3（20〜40文字）"
  ],
  "impact_level": "high または medium または low（日本企業への実務影響度）",
  "related_laws": ["関連法令・規制名1", "関連法令・規制名2"]
}

## impact_level の判定基準
- high: 新しい制裁・禁輸措置・エンティティリスト追加・許可要件の変更等、即時対応が必要
- medium: 規制の改正・パブリックコメント・ガイダンス更新等、確認・検討が必要
- low: 統計・報告書・研究資料等、参考情報

## 注意事項
- 輸出管理に無関係な内容は impact_level を low とする
- 固有名詞（国名・企業名・法令名）は正確に記載する
- JSON 以外の文字は出力しないこと`
}
