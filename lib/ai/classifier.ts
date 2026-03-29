import { GoogleGenerativeAI } from '@google/generative-ai'
import type {
  ClassificationInput,
  ClassificationResult,
  ClassificationStatus,
  FeftaResult,
  EarResult,
} from '@/types'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')
const MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash-lite'
const MAX_TOKENS = 3072

function buildPrompt(input: ClassificationInput): string {
  return `あなたは、日本の外為法（外国為替及び外国貿易法）および米国のEAR（Export Administration Regulations）に精通した輸出管理の専門家です。
提供された製品・技術情報をもとに、輸出規制の該非判定を行ってください。
情報が不完全な場合でも、保守的（安全側）な判定を行い、残リスクを明示してください。

## 判定対象製品の情報

- 品名・型番: ${input.product_name || '（未入力）'}
- 用途・機能説明: ${input.description || '（未入力）'}
- 主要仕様・パラメータ: ${input.specs || '（未入力）'}
- 輸出先国: ${input.destination_country || '（未入力）'}
- 最終用途: ${input.end_use || '（未入力）'}

## 判定方針

1. **外為法 リスト規制（輸出令別表第1）**
   - 1〜15項の各カテゴリーに該当する可能性を評価すること
   - 各項目の技術パラメータ（周波数帯域、出力、精度等）と比較し、閾値超過の可能性を検討すること
   - 主要な規制項目：
     * 第6項: 先端的な機器（センサー・レーザー等）
     * 第7項: 先端的な電子部品
     * 第8項: コンピュータ
     * 第9項: 通信・情報セキュリティ機器
     * 第10項: センサー・レーザー
     * 第11項: 航法・航空電子機器
     * 第14項: 先端材料
     * 第15項: 製造装置等

2. **外為法 キャッチオール規制（輸出令別表第1第16項）**
   - 大量破壊兵器キャッチオール（WMD用途の懸念がある場合）
   - 外国ユーザーリスト掲載国・組織への輸出
   - 軍事関連用途の懸念

3. **米国EAR（Commerce Control List: CCL）**
   - ECCNを可能な限り特定すること（形式: カテゴリ番号+製品グループ+詳細番号、例: 5A002.a.1）
   - EAR99判定の場合もその根拠を示すこと
   - ライセンス必要性の判断基準（AT, NS, NP, MT等）
   - 仕向地・最終用途・最終需要者によるライセンス要件の変化

## 出力形式（JSONのみ、説明文不要）

{
  "status": "controlled または gray または clear",
  "japan_fefta": {
    "list_controlled": true または false,
    "relevant_items": [
      {
        "item_number": "別表第1 第○項",
        "category": "カテゴリー名",
        "applicable": true または false,
        "reason": "該当・非該当の根拠（技術パラメータ等）"
      }
    ],
    "catchall_applicable": true または false,
    "catchall_reason": "キャッチオール規制の適用根拠または非適用理由",
    "license_required": true または false,
    "reasoning": "外為法全体の判定根拠"
  },
  "us_ear": {
    "eccn": "ECCNコード（例: 5A002.a.1）またはEAR99",
    "license_required": true または false,
    "applicable_reasons": ["NS1", "NP2" 等のライセンス必要理由コード（空の場合は[]）],
    "reasoning": "EAR判定根拠（ECCNの特定根拠を含む）"
  },
  "overall_assessment": "外為法・EAR両方を踏まえた総合判断",
  "missing_info_risks": "未入力・不明情報により現時点で排除できないリスクの説明",
  "next_actions": [
    "次に確認・実施すべきアクション1",
    "次に確認・実施すべきアクション2"
  ]
}

## statusの基準
- controlled: 規制品目に該当する可能性が高く、輸出許可申請が必要と判断
- gray: 規制品目への該当可能性があり、詳細確認が必要（スペック確認・メーカーへの問い合わせ等）
- clear: 規制対象外（EAR99相当）と判断されるが、キャッチオール規制・最終用途確認は引き続き必要

## 注意事項
- JSONのみを出力し、余計な説明文は含めないこと
- relevant_itemsには関連性のある項目を全て含めること（該当しない可能性のある項目も gray として記載）
- next_actionsは具体的なアクション（どの書類を確認するか等）を記載すること
- missing_info_risksは「特になし」は不可。必ず記述すること`
}

export async function runClassification(input: ClassificationInput): Promise<ClassificationResult> {
  const prompt = buildPrompt(input)
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: { maxOutputTokens: MAX_TOKENS },
  })

  const response = await model.generateContent(prompt)
  const rawText = response.response.text()

  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error(`Gemini returned non-JSON: ${rawText.slice(0, 200)}`)
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    throw new Error(`JSON parse error: ${jsonMatch[0].slice(0, 200)}`)
  }

  const validStatuses: ClassificationStatus[] = ['controlled', 'gray', 'clear']
  const status: ClassificationStatus = validStatuses.includes(parsed.status as ClassificationStatus)
    ? (parsed.status as ClassificationStatus)
    : 'gray'

  const rawFefta = (parsed.japan_fefta ?? {}) as Record<string, unknown>
  const japan_fefta: FeftaResult = {
    list_controlled: Boolean(rawFefta.list_controlled),
    relevant_items: Array.isArray(rawFefta.relevant_items)
      ? rawFefta.relevant_items
          .filter((i): i is Record<string, unknown> => typeof i === 'object' && i !== null)
          .map((i) => ({
            item_number: typeof i.item_number === 'string' ? i.item_number : '',
            category: typeof i.category === 'string' ? i.category : '',
            applicable: Boolean(i.applicable),
            reason: typeof i.reason === 'string' ? i.reason : '',
          }))
      : [],
    catchall_applicable: Boolean(rawFefta.catchall_applicable),
    catchall_reason: typeof rawFefta.catchall_reason === 'string' ? rawFefta.catchall_reason : '',
    license_required: Boolean(rawFefta.license_required),
    reasoning: typeof rawFefta.reasoning === 'string' ? rawFefta.reasoning : '',
  }

  const rawEar = (parsed.us_ear ?? {}) as Record<string, unknown>
  const us_ear: EarResult = {
    eccn: typeof rawEar.eccn === 'string' ? rawEar.eccn : 'EAR99',
    license_required: Boolean(rawEar.license_required),
    applicable_reasons: Array.isArray(rawEar.applicable_reasons)
      ? rawEar.applicable_reasons.filter((r): r is string => typeof r === 'string')
      : [],
    reasoning: typeof rawEar.reasoning === 'string' ? rawEar.reasoning : '',
  }

  const usageMeta = response.response.usageMetadata
  return {
    status,
    japan_fefta,
    us_ear,
    overall_assessment:
      typeof parsed.overall_assessment === 'string' ? parsed.overall_assessment : '',
    missing_info_risks:
      typeof parsed.missing_info_risks === 'string' ? parsed.missing_info_risks : '',
    next_actions: Array.isArray(parsed.next_actions)
      ? parsed.next_actions.filter((a): a is string => typeof a === 'string')
      : [],
    model_used: MODEL,
    tokens_input: usageMeta?.promptTokenCount ?? 0,
    tokens_output: usageMeta?.candidatesTokenCount ?? 0,
  }
}
