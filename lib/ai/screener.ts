import { GoogleGenerativeAI } from '@google/generative-ai'
import type { ScreeningInput, ScreeningResult, ScreeningStatus, MatchedOrganization, CheckedList } from '@/types'
import type { ListSearchResult } from '@/lib/list-sync/search'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')
const MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash-lite'
const MAX_TOKENS = 2048

const LIST_SOURCE_LABELS: Record<string, string> = {
  bis_entity_list: '米国BIS エンティティリスト',
  foreign_user_list: '経済産業省 外国ユーザーリスト',
}

function formatDbMatches(matches: ListSearchResult[]): string {
  if (matches.length === 0) return '## データベース照合結果\nなし（DBに一致なし）\n'

  const lines = matches.map(m => {
    const src = LIST_SOURCE_LABELS[m.list_source] ?? m.list_source
    const cats = m.concern_categories.length > 0 ? ` [${m.concern_categories.join(', ')}]` : ''
    const loc = m.country ? ` / ${m.country}` : ''
    const addr = m.address ? ` / ${m.address}` : ''
    return `- **${m.name}**${loc}${addr}${cats} ← 出典: ${src}`
  })

  return `## データベース照合結果（実際のリストデータ）\n⚠️ 以下の組織がリストデータベースに見つかりました。これを最重要証拠として判定してください：\n${lines.join('\n')}\n`
}

function buildPrompt(input: ScreeningInput, listMatches: ListSearchResult[]): string {
  return `あなたは、日本の外為法に基づき、輸出先顧客の「大量破壊兵器等への転用リスク」を判定する専門家です。入力情報が不完全であっても、「安全保障上のリスクを回避する」ことを最優先し、保守的（安全側）な判定を行ってください。

## 判定の基本方針

1. **データベース照合結果を最優先**: 下記「データベース照合結果」に掲載組織が含まれている場合は、それを確定的証拠として扱い、必ず「concern（懸念あり）」または「gray（要詳細調査）」と判定すること。
2. **表記揺れの許容**: 略称、英語名、現地語のカタカナ読み、法人格（Co., Ltd. / Inc.等）の有無に関わらず、核となる名称が一致・類似していれば「懸念あり」と判定すること。
3. **情報不足への対応**: 顧客名のみ、あるいは所在地のみの入力であっても、判明しているキーワードから「外国ユーザーリスト」や「軍関連組織」との関連性を推論すること。
4. **安全側への倒し**: 100%の確証がなくても、類似する懸念組織が存在する場合は「要詳細調査」として警告すること。

${formatDbMatches(listMatches)}

## 入力情報

- 顧客名: ${input.customer_name || '（未入力）'}
- 所在地: ${input.country || '（未入力）'}
- 事業内容: ${input.business_description || '（未入力）'}
- 輸出予定製品: ${input.product || '（未入力）'}

## 出力形式（JSONのみ、説明文不要）

{
  "status": "clear または gray または concern",
  "matched_organizations": [
    {
      "name_on_list": "リスト上の名称（英語/日本語）",
      "location": "所在地",
      "concern_categories": ["核(N)", "ミサイル(M)", "通常兵器(K)等"],
      "list_name": "掲載されているリスト名（例: 経済産業省 外国ユーザーリスト）",
      "similarity_reason": "類似・該当と判断した理由（表記揺れ・略称等の考慮を含む）"
    }
  ],
  "checked_lists": [
    { "name": "チェックしたリスト名", "result": "no_match または match または similar" }
  ],
  "reasoning": "総合的な判定根拠の説明文",
  "missing_info_risks": "未入力項目により現時点で排除しきれないリスクの説明文",
  "next_actions": [
    "次に行うべきアクション1",
    "次に行うべきアクション2"
  ]
}

## checked_listsに必ず含めるリスト（全件チェックし結果を記載すること）
- 経済産業省 外国ユーザーリスト
- 米国BIS エンティティリスト
- 米国OFAC SDNリスト
- 国連安保理制裁リスト
- 日本 資産凍結対象リスト（外為法）
- 中国国防7校リスト（該当する場合）

## statusの判定基準
- clear: 既知の懸念組織との一致・類似が認められない場合
- gray: 類似する懸念組織が存在するが確証がない場合（要詳細調査）
- concern: 外国ユーザーリスト等の懸念組織との一致・高い類似性が認められる場合（要許可申請）

## 参照すべきリスト・規制
- 経済産業省「外国ユーザーリスト」（WMD・ミサイル・通常兵器の懸念組織）
- 米国BIS「エンティティリスト」
- 国連・日本の制裁対象リスト（北朝鮮・イラン・ロシア等）
- 中国国防7校（哈工大・北航・北理工・西工大・南航・電子科技大・国防科技大）および関連組織
- ロシア・ベラルーシの軍事・防衛関連組織

## 注意事項
- JSONのみを出力し、余計な説明文は含めないこと
- matched_organizationsが存在しない場合は空配列 [] とすること
- reasoning・missing_info_risksは必ず記述すること（「なし」「特になし」は不可）`
}

export async function runScreening(
  input: ScreeningInput,
  listMatches: ListSearchResult[] = [],
): Promise<ScreeningResult> {
  const prompt = buildPrompt(input, listMatches)
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

  let parsed: {
    status?: string
    matched_organizations?: unknown[]
    checked_lists?: unknown[]
    reasoning?: string
    missing_info_risks?: string
    next_actions?: unknown[]
  }
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    throw new Error(`JSON parse error: ${jsonMatch[0].slice(0, 200)}`)
  }

  const validStatuses: ScreeningStatus[] = ['clear', 'gray', 'concern']
  const status: ScreeningStatus = validStatuses.includes(parsed.status as ScreeningStatus)
    ? (parsed.status as ScreeningStatus)
    : 'gray'

  const matched_organizations: MatchedOrganization[] = Array.isArray(parsed.matched_organizations)
    ? parsed.matched_organizations
        .filter((o): o is Record<string, unknown> => typeof o === 'object' && o !== null)
        .map((o) => ({
          name_on_list: typeof o.name_on_list === 'string' ? o.name_on_list : '',
          location: typeof o.location === 'string' ? o.location : '',
          concern_categories: Array.isArray(o.concern_categories)
            ? o.concern_categories.filter((c): c is string => typeof c === 'string')
            : [],
          list_name: typeof o.list_name === 'string' ? o.list_name : '',
          similarity_reason: typeof o.similarity_reason === 'string' ? o.similarity_reason : '',
        }))
    : []

  const validResults = ['no_match', 'match', 'similar'] as const
  const checked_lists: CheckedList[] = Array.isArray(parsed.checked_lists)
    ? parsed.checked_lists
        .filter((l): l is Record<string, unknown> => typeof l === 'object' && l !== null)
        .map((l) => ({
          name: typeof l.name === 'string' ? l.name : '',
          result: validResults.includes(l.result as typeof validResults[number])
            ? (l.result as CheckedList['result'])
            : 'no_match',
        }))
    : []

  const usageMeta = response.response.usageMetadata
  return {
    status,
    matched_organizations,
    checked_lists,
    reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
    missing_info_risks: typeof parsed.missing_info_risks === 'string' ? parsed.missing_info_risks : '',
    next_actions: Array.isArray(parsed.next_actions)
      ? parsed.next_actions.filter((a): a is string => typeof a === 'string')
      : [],
    model_used: MODEL,
    tokens_input: usageMeta?.promptTokenCount ?? 0,
    tokens_output: usageMeta?.candidatesTokenCount ?? 0,
  }
}
