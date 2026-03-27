-- 記事一覧（最新順）
CREATE INDEX idx_articles_published_at ON articles(published_at DESC NULLS LAST);
CREATE INDEX idx_articles_source_id    ON articles(source_id);
CREATE INDEX idx_articles_status       ON articles(status);
CREATE INDEX idx_articles_lang         ON articles(lang);
CREATE INDEX idx_articles_category     ON articles(category);

-- タグ検索
CREATE INDEX idx_articles_tags ON articles USING GIN (tags);

-- 収集ログ
CREATE INDEX idx_collection_logs_executed_at      ON collection_logs(executed_at DESC);
CREATE INDEX idx_collection_logs_source_status    ON collection_logs(source_id, status);

-- 未要約記事の高速取得（Cron Job 用）
CREATE INDEX idx_articles_status_collected_at
  ON articles(status, collected_at DESC)
  WHERE status = 'collected';
