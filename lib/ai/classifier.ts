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
提供された製品・技術情報をもとに、輸出規制の該非判定を行ってください。
情報が不完全な場合でも、保守的（安全側）な判定を行い、残リスクを明示してください。

## 判定対象製品の情報

- 品名・型番: ${input.product_name || '（未入力）'}
- 用途・機能説明: ${input.description || '（未入力）'}
- 主要仕様・パラメータ: ${input.specs || '（未入力）'}
- 輸出先国: ${input.destination_country || '（未入力）'}
- 最終用途: ${input.end_use || '（未入力）'}

## CCL主要ECCN参照表（技術閾値）

以下の技術パラメータを入力情報と照合してECCNを特定すること。
EAR99と判定する場合は、以下の全該当ECCN候補を検討し、非該当理由を明記すること。

### カテゴリ3: 電子部品 (Electronics)
- **3A001.a.1**: マイクロプロセッサ・演算能力 > 8 TFLOPS
- **3A001.a.5.a**: ADC（アナログデジタル変換器）サンプリングレート ≥ 5 GSPS かつ分解能 ≥ 12bit、または ≥ 1 GSPS かつ ≥ 14bit
- **3A001.b.1**: 動作周波数 > 31.8 GHz の発振器（水晶振動子・周波数シンセサイザー等）
- **3A001.b.4**: 周波数変換器・シンセサイザー: 出力周波数 > 31.8 GHz
- **3E001**: カテゴリ3規制品の開発・製造のための技術

### カテゴリ5 Part1: 通信・情報セキュリティ
- **5A001.b.3**: スペクトラムアナライザー / 信号アナライザー: 周波数範囲 > 31.8 GHz
- **5A001.b.5**: 信号インテリジェンス（SIGINT）機器
- **5A001.f**: 通信傍受・妨害装置
- **5A002.a.1**: 暗号機能を持つ情報セキュリティ機器（対称鍵長 > 56bit、非対称鍵 > 512bit相当）。ただし「EI」規制でありライセンス例外が適用される場合が多い
- **5B001.a**: 通信試験・製造装置: スペクトラムアナライザー等
- **5E002**: 5A002規制品の開発・製造のための技術

### カテゴリ6: センサー・レーザー
- **6A001.a**: アクティブソナー（送受信周波数・出力等）
- **6A002.a.1**: 赤外線検出器アレイ（非冷却型: > 4メガピクセル、冷却型: 規制あり）
- **6A002.b**: レーザーレンジファインダー（軍用仕様）
- **6A003.b**: 赤外線カメラ（非冷却マイクロボロメーター > 4MP等）

### カテゴリ7: 航法・航空電子機器
- **7A001.a**: 加速度計: バイアス安定性 < 1,000 μg（1 mg）かつ動作環境が規制仕様
- **7A001.b**: ジャイロスコープ: バイアスドリフト < 3.6°/hr（0.001°/sec）
- **7A002.a**: ファイバーオプティックジャイロ（FOG）: ARW < 0.1°/√hr または バイアス安定性 < 1°/hr
- **7A003.a**: INS（慣性航法システム）: 位置精度 < 0.8 nm/hr または速度誤差 < 0.4 m/s（RSS）
- **7A005**: GPS受信機: 精度を軍用水準に制限する機能を持つもの
- **7E001**: カテゴリ7規制品の開発技術

### カテゴリ9: 推進系・宇宙
- **9A004**: 宇宙打ち上げロケット・宇宙船
- **9A515**: 商用衛星（規制仕様）
- **9E003.a.1**: ガスタービンエンジン技術（燃焼温度・効率が規制閾値超）

### 外為法 輸出令別表第1 主要項目と対応ECCN
| 外為法 | 対応ECCN | 規制内容 |
|--------|----------|----------|
| 第6項 | Cat.3,6 | 先端電子部品・センサー |
| 第7項 | Cat.3 | 電子部品（マイコン・ADC等） |
| 第8項 | Cat.4 | コンピュータ |
| 第9項 | Cat.5P1,5P2 | 通信・情報セキュリティ |
| 第10項 | Cat.6 | センサー・レーザー |
| 第11項 | Cat.7 | 航法・航空電子 |
| 第13項 | Cat.9 | 推進装置 |
| 第15項 | Cat.2 | 製造装置 |

## 判定方針

1. **外為法 リスト規制（輸出令別表第1）**
   - 上記参照表のパラメータと入力仕様を照合すること
   - 閾値が不明な場合は「gray（要確認）」として残リスクに記載すること

2. **外為法 キャッチオール規制（輸出令別表第1第16項）**
   - 大量破壊兵器キャッチオール（WMD用途の懸念がある場合）
   - 外国ユーザーリスト掲載国・組織への輸出
   - 軍事関連用途の懸念（レーダー・電子戦・ミサイル誘導等）

3. **米国EAR（Commerce Control List: CCL）**
   - 上記CCL参照表から最も関連性の高いECCNを特定すること
   - **重要**: EAR99判定は、上記全カテゴリーを検討した上で該当なしと確認した場合のみ。安易にEAR99としないこと
   - ライセンス規制理由: AT（テロ支援国家向け）、NS（国家安全保障）、NP（核不拡散）、MT（ミサイル技術）、EI（暗号）
   - 仕向地・最終用途・最終需要者によるライセンス要件の変化を考慮すること

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
