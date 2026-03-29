import { GoogleGenerativeAI } from '@google/generative-ai'
import type {
  LicenseInput,
  LicenseResult,
  LicenseStatus,
  JapanLicenseResult,
  UsEarLicenseResult,
} from '@/types'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')
const MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash-lite'
const MAX_TOKENS = 4096

function buildPrompt(input: LicenseInput): string {
  const earSection = input.has_us_content ? `
### 米国 EAR：仕向地カントリーグループ
- **Country Group A**: 同盟国（A:1〜A:6の細分類あり）
  - A:5/A:6: 英国・オーストラリア等（AUKUS・最優遇）
- **Country Group B**: 一般（EAR規制に服するが比較的緩い）
- **Country Group D**: 懸念国
  - D:1（武器禁輸）: ロシア・ベラルーシ・中国・ベネズエラ等
  - D:2（核）: イラン・北朝鮮等
  - D:4（ミサイル技術）: イラン・北朝鮮・シリア等
- **Country Group E**: 禁輸対象（E:1 テロ支援国: キューバ・イラン・北朝鮮・シリア、E:2: ロシア・ベラルーシ）

### 米国 EAR：主要ライセンス例外
- **NLR（No License Required）**: EAR99またはカントリーグループA向け等
- **LVS（Low Value Shipment）**: 少額貨物
- **CIV（Civil End Users）**: 民間最終用途・最終需要者向け
- **ENC（Encryption）**: 暗号品目（5A002等）の民間向け輸出
- **STA（Strategic Trade Authorization）**: 同盟国向け戦略物資
- **禁止（Prohibited）**: E:1国向け規制品等は原則ライセンス例外不可

### EAR End-Use/End-User規制
- 核・生化学兵器・ミサイル開発用途：明確な禁止（Part 744）
- Entity List掲載者への輸出：ライセンス必要（原則不承認）
- 軍需エンドユーザー（MEU）規制：中国・ロシア等の軍需企業向け` : ''

  const earOutputSection = input.has_us_content ? `  "us_ear_license": {
    "license_required": true または false,
    "country_group": "Country Group A/B/D:1/D:2/E:1等",
    "applicable_exceptions": ["NLR", "ENC" 等、適用可能なライセンス例外（なければ[]）],
    "reasoning": "EARにおける許可要否の判断根拠"
  },` : `  "us_ear_license": {
    "license_required": false,
    "country_group": "N/A",
    "applicable_exceptions": [],
    "reasoning": "米国成分なし。EARの適用対象外。"
  },`

  return `あなたは、日本の外為法および米国EARに精通した輸出管理の専門家です。
以下の製品分類・取引情報をもとに、**輸出許可判断**を行ってください。

許可判断とは「特定の取引（仕向地・需要者・用途）に対して輸出許可申請が必要かどうか」を判断するものです。

## 取引情報

- 米国成分の有無: ${input.has_us_content ? 'あり（EAR対象）' : 'なし（EAR非対象）'}
- ECCN（米国EAR分類）: ${input.has_us_content ? (input.eccn || '（未入力）') : 'N/A'}
- 外為法 該当項目: ${input.japan_fefta_item || '（未入力・非該当）'}
- 仕向地国: ${input.destination_country || '（未入力）'}
- 最終用途: ${input.end_use || '（未入力）'}
- 需要者の種別: ${input.end_user_type || '（未入力）'}
- 取引金額（参考）: ${input.transaction_value || '（未入力）'}

## 参照すべき規制・国別グループ分類

### 日本 外為法：輸出相手国グループ
- **グループA（旧ホワイト国）**: 米国・EU加盟国・英国・豪州・カナダ・NZ・韓国・日本の同盟・友好国（41か国）
  → リスト規制品でも包括許可・少額特例等の活用が可能なケースあり
- **グループB**: 上記以外の多くの国
  → 規制品は原則 個別輸出許可が必要
- **グループC**: 一部の国（グループDでもなくBでもない）
- **グループD**: ロシア・ベラルーシ・中国・イラン・北朝鮮・ミャンマー等
  → 規制強化対象。キャッチオール規制も厳格に適用
- **グループE**: 北朝鮮・イラン等（禁輸・資産凍結対象）

### 日本 外為法：主要な許可例外・手続き
- **少額特例**（輸出令第4条）: 取引金額が100万円以下で一定条件を満たす場合
- **持参輸出特例**: 個人的使用目的での持参・携帯
- **再輸出特例**: 一時輸出した後の再輸出
- **グループA向け包括許可**: 旧ホワイト国向けの一部品目
- **役務取引許可**: 技術移転を伴う取引
- **特別一般包括輸出・役務許可（特一包）**: 認定輸出者向け簡易手続き

### 日本 外為法：キャッチオール規制
- グループD向け輸出で、WMD・通常兵器用途が懸念される場合は非リスト品でも許可必要
- 外国ユーザーリスト掲載組織への輸出は特に注意

${earSection}

## 出力形式（JSONのみ、説明文不要）

{
  "status": "permit_required または exception_applicable または no_permit_required または prohibited または gray",
  "japan_license": {
    "permit_required": true または false,
    "applicable_exceptions": ["適用可能な例外規定（例: 少額特例、グループA向け包括許可）"],
    "country_group": "グループA/B/C/D/E",
    "reasoning": "外為法における許可要否の判断根拠（仕向地グループ・該当項目・例外適用可否を含む）"
  },
  ${earOutputSection}
  "overall_assessment": "${input.has_us_content ? '日本・米国両規制を踏まえた総合的な許可判断' : '日本外為法の観点での許可判断（米国成分なしのためEARは対象外）'}",
  "missing_info_risks": "未入力情報により現時点で確定できないリスク（必ず記述）",
  "next_actions": [
    "次に確認・実施すべき具体的なアクション"
  ]
}

## statusの基準
- permit_required: 輸出許可申請が必要（日本またはEAR）
- exception_applicable: 許可は必要だが例外規定適用の可能性あり（要確認）
- no_permit_required: 許可申請不要（ただし需要者スクリーニング等は別途実施のこと）
- prohibited: 輸出禁止（制裁対象国・禁輸品等）
- gray: 情報不足等で確定判断できない状態

## 注意事項
- JSONのみを出力し、余計な説明文は含めないこと
- 仕向地が不明な場合は最もリスクの高いシナリオを想定して gray または permit_required とすること
${input.has_us_content ? '- EAR99であってもEAR End-Use規制（Part 744）・制裁規制には服することを考慮すること' : '- 米国成分なしのため us_ear_license は上記の固定値をそのまま出力すること'}
- missing_info_risksは「特になし」不可。必ず記述すること`
}

export async function runLicenseAdvisory(input: LicenseInput): Promise<LicenseResult> {
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

  const validStatuses: LicenseStatus[] = [
    'permit_required', 'exception_applicable', 'no_permit_required', 'prohibited', 'gray',
  ]
  const status: LicenseStatus = validStatuses.includes(parsed.status as LicenseStatus)
    ? (parsed.status as LicenseStatus)
    : 'gray'

  const rawJp = (parsed.japan_license ?? {}) as Record<string, unknown>
  const japan_license: JapanLicenseResult = {
    permit_required: Boolean(rawJp.permit_required),
    applicable_exceptions: Array.isArray(rawJp.applicable_exceptions)
      ? rawJp.applicable_exceptions.filter((e): e is string => typeof e === 'string')
      : [],
    country_group: typeof rawJp.country_group === 'string' ? rawJp.country_group : '',
    reasoning: typeof rawJp.reasoning === 'string' ? rawJp.reasoning : '',
  }

  const rawEar = (parsed.us_ear_license ?? {}) as Record<string, unknown>
  const us_ear_license: UsEarLicenseResult = {
    license_required: Boolean(rawEar.license_required),
    country_group: typeof rawEar.country_group === 'string' ? rawEar.country_group : '',
    applicable_exceptions: Array.isArray(rawEar.applicable_exceptions)
      ? rawEar.applicable_exceptions.filter((e): e is string => typeof e === 'string')
      : [],
    reasoning: typeof rawEar.reasoning === 'string' ? rawEar.reasoning : '',
  }

  const usageMeta = response.response.usageMetadata
  return {
    status,
    japan_license,
    us_ear_license,
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
