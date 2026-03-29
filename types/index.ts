export type CountryCode = 'JP' | 'US' | 'EU'
export type CollectorType = 'rss' | 'scraper' | 'email'
export type ArticleStatus = 'collected' | 'summarizing' | 'summarized' | 'error'
export type ArticleCategory = 'sanction' | 'regulation' | 'guidance' | 'alert' | 'other'
export type ImpactLevel = 'high' | 'medium' | 'low'
export type Lang = 'ja' | 'en'

export interface Source {
  id: string
  slug: string
  name_ja: string
  name_en: string
  country_code: CountryCode
  base_url: string
  collector_type: CollectorType
  feed_url: string | null
  scrape_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Article {
  id: string
  source_id: string
  title: string
  title_ja: string | null
  url: string
  url_hash: string
  content_text: string | null
  published_at: string | null
  collected_at: string
  lang: Lang
  category: ArticleCategory | null
  tags: string[]
  status: ArticleStatus
  error_message: string | null
  created_at: string
  updated_at: string
  // joined
  sources?: Source
  summaries?: Summary | null
}

export interface Summary {
  id: string
  article_id: string
  summary_ja: string
  key_points: string[]
  impact_level: ImpactLevel | null
  related_laws: string[]
  model_used: string
  prompt_version: string
  tokens_input: number | null
  tokens_output: number | null
  created_at: string
}

export interface CollectionLog {
  id: string
  source_id: string | null
  job_type: CollectorType | 'summarizer'
  status: 'success' | 'partial' | 'error'
  articles_found: number
  articles_new: number
  error_message: string | null
  duration_ms: number | null
  executed_at: string
}

// 収集結果の中間型
export interface CollectedItem {
  title: string
  url: string
  content_text: string | null
  published_at: Date | null
  lang: Lang
  category?: ArticleCategory
  tags?: string[]
}

export interface SummaryResult {
  summary_ja: string
  key_points: string[]
  impact_level: ImpactLevel
  related_laws: string[]
  title_ja?: string
}

// ---- スクリーニング機能 ----

export type ScreeningStatus = 'clear' | 'gray' | 'concern'

export interface ScreeningInput {
  customer_name: string
  country: string
  business_description: string
  product: string
}

export interface MatchedOrganization {
  name_on_list: string
  location: string
  concern_categories: string[]
  list_name: string
  similarity_reason: string
}

export interface CheckedList {
  name: string
  result: 'no_match' | 'match' | 'similar'
}

export interface ScreeningResult {
  status: ScreeningStatus
  matched_organizations: MatchedOrganization[]
  checked_lists: CheckedList[]
  reasoning: string
  missing_info_risks: string
  next_actions: string[]
  model_used: string
  tokens_input: number
  tokens_output: number
}
