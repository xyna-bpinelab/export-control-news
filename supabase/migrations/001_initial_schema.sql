-- =============================================
-- 収集元機関マスタ
-- =============================================
CREATE TABLE sources (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           TEXT NOT NULL UNIQUE,
  name_ja        TEXT NOT NULL,
  name_en        TEXT NOT NULL,
  country_code   TEXT NOT NULL,
  base_url       TEXT NOT NULL,
  collector_type TEXT NOT NULL CHECK (collector_type IN ('rss', 'scraper', 'email')),
  feed_url       TEXT,
  scrape_url     TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 収集記事本体
-- =============================================
CREATE TABLE articles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id       UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  title_ja        TEXT,
  url             TEXT NOT NULL UNIQUE,
  url_hash        TEXT NOT NULL UNIQUE,
  content_text    TEXT,
  published_at    TIMESTAMPTZ,
  collected_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  lang            TEXT NOT NULL DEFAULT 'ja' CHECK (lang IN ('ja', 'en')),
  category        TEXT CHECK (category IN ('sanction', 'regulation', 'guidance', 'alert', 'other')),
  tags            TEXT[] DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'collected'
                  CHECK (status IN ('collected', 'summarizing', 'summarized', 'error')),
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- AI要約
-- =============================================
CREATE TABLE summaries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id     UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE UNIQUE,
  summary_ja     TEXT NOT NULL,
  key_points     JSONB DEFAULT '[]',
  impact_level   TEXT CHECK (impact_level IN ('high', 'medium', 'low')),
  related_laws   TEXT[] DEFAULT '{}',
  model_used     TEXT NOT NULL,
  prompt_version TEXT NOT NULL DEFAULT 'v1',
  tokens_input   INTEGER,
  tokens_output  INTEGER,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- 収集ジョブ実行ログ
-- =============================================
CREATE TABLE collection_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id       UUID REFERENCES sources(id) ON DELETE SET NULL,
  job_type        TEXT NOT NULL CHECK (job_type IN ('rss', 'scraper', 'email', 'summarizer')),
  status          TEXT NOT NULL CHECK (status IN ('success', 'partial', 'error')),
  articles_found  INTEGER DEFAULT 0,
  articles_new    INTEGER DEFAULT 0,
  error_message   TEXT,
  duration_ms     INTEGER,
  executed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sources_updated_at BEFORE UPDATE ON sources
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER articles_updated_at BEFORE UPDATE ON articles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
