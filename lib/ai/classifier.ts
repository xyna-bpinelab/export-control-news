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
const MAX_TOKENS = 4096

function buildPrompt(input: ClassificationInput): string {
  return `あなたは、日本の外為法（外国為替及び外国貿易法）および米国のEAR（Export Administration Regulations）に精通した輸出管理の専門家です。
提供された製品・技術情報をもとに、輸出規制の**該非判定**を行ってください。

該非判定とは「製品そのものが規制対象品目に該当するか否か」を判定するものです。
仕向地・最終用途・需要者は関係ありません。製品のスペック・機能のみで判断してください。

## 判定対象製品の情報

- 品名・型番: ${input.product_name || '（未入力）'}
- 用途・機能説明: ${input.description || '（未入力）'}
- 主要仕様・パラメータ: ${input.specs || '（未入力）'}

## CCL主要ECCN参照表（技術閾値）

以下の技術パラメータを入力情報と照合してECCNを特定すること。
EAR99と判定する場合は、以下の全該当ECCN候補を検討し、非該当理由を明記すること。

### カテゴリ3: 電子部品 (Electronics)
- **3A001.a.1**: マイクロプロセッサ・演算能力 > 8 TFLOPS
- **3A001.a.5.a**: ADC サンプリングレート ≥ 5 GSPS かつ分解能 ≥ 12bit、または ≥ 1 GSPS かつ ≥ 14bit
- **3A001.b.1**: 動作周波数 > 31.8 GHz の発振器・周波数シンセサイザー
- **3A001.b.4**: 周波数変換器・シンセサイザー: 出力周波数 > 31.8 GHz
- **3E001**: カテゴリ3規制品の開発・製造のための技術

### カテゴリ5 Part1: 通信機器
- **5A001.b.3**: スペクトラムアナライザー / 信号アナライザー: 周波数範囲 > 31.8 GHz
- **5A001.b.5**: 信号インテリジェンス（SIGINT）機器
- **5A001.f**: 通信傍受・妨害装置

### カテゴリ5 Part2: 情報セキュリティ
- **5A002.a.1**: 暗号機能を持つ情報セキュリティ機器（対称鍵長 > 56bit、非対称鍵 > 512bit相当）
- **5E002**: 5A002規制品の開発・製造のための技術

### カテゴリ6: センサー・レーザー
- **6A001.a**: アクティブソナー
- **6A002.a.1**: 赤外線検出器アレイ（非冷却型 > 4メガピクセル、冷却型は仕様による）
- **6A003.b**: 赤外線カメラ（非冷却マイクロボロメーター > 4MP等）

### カテゴリ7: 航法・航空電子機器
- **7A001.a**: 加速度計: バイアス安定性 < 1,000 μg（1 mg）
- **7A001.b**: ジャイロスコープ: バイアスドリフト < 3.6°/hr
- **7A002.a**: FOGジャイロ: ARW < 0.1°/√hr または バイアス安定性 < 1°/hr
- **7A003.a**: INS: 位置精度 < 0.8 nm/hr または速度誤差 < 0.4 m/s
- **7E001**: カテゴリ7規制品の開発技術

### カテゴリ9: 推進系・宇宙
- **9A004**: 宇宙打ち上げロケット・宇宙船
- **9E003.a.1**: ガスタービンエンジン技術

### 外為法 輸出令別表第1 対応表
| 外為法 | 対応ECCN | 規制内容 |
|--------|----------|----------|
| 第6項 | Cat.3,6 | 先端電子部品・センサー |
| 第7項 | Cat.3 | 電子部品（ADC・発振器等） |
| 第8項 | Cat.4 | コンピュータ |
| 第9項 | Cat.5P1,5P2 | 通信・情報セキュリティ |
| 第10項 | Cat.6 | センサー・レーザー |
| 第11項 | Cat.7 | 航法・航空電子 |
| 第13項 | Cat.9 | 推進装置 |
| 第15項 | Cat.2 | 製造装置 |

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
        "reason": "該当・非該当の根拠（技術パラメータと閾値の比較を含む）"
      }
    ],
    "reasoning": "外為法リスト規制の総合判定根拠"
  },
  "us_ear": {
    "eccn": "ECCNコード（例: 5A002.a.1）またはEAR99",
    "applicable_reasons": ["NS1", "NP2" 等の規制理由コード（EAR99の場合は[]）],
    "reasoning": "ECCNの特定根拠（参照表のどの閾値に該当/非該当か）"
  },
  "overall_assessment": "外為法・EAR両方を踏まえた総合判断",
  "missing_info_risks": "スペック不明等により現時点で排除できないリスク（必ず記述）",
  "next_actions": [
    "確認・実施すべき具体的アクション"
  ]
}

## statusの基準
- controlled: リスト規制品目に該当（輸出許可申請が必要になる取引が存在する）
- gray: 該当可能性があるが、スペック詳細の確認が必要
- clear: リスト規制対象外（EAR99・外為法非該当）

## 注意事項
- JSONのみを出力し、余計な説明文は含めないこと
- EAR99判定は上記全ECCN候補を検討した上で行うこと
- relevant_itemsには関連する可能性のある項目を全て列挙すること
- missing_info_risksは「特になし」不可。必ず記述すること`
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
    reasoning: typeof rawFefta.reasoning === 'string' ? rawFefta.reasoning : '',
  }

  const rawEar = (parsed.us_ear ?? {}) as Record<string, unknown>
  const us_ear: EarResult = {
    eccn: typeof rawEar.eccn === 'string' ? rawEar.eccn : 'EAR99',
    license_required: false, // 該非判定では不問
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
