-- 全テーブルで RLS を有効化
ALTER TABLE sources         ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE summaries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_logs ENABLE ROW LEVEL SECURITY;

-- 公開読み取り（認証不要の公開サイト）
CREATE POLICY "public_read_sources" ON sources
  FOR SELECT TO anon, authenticated USING (is_active = true);

CREATE POLICY "public_read_articles" ON articles
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "public_read_summaries" ON summaries
  FOR SELECT TO anon, authenticated USING (true);

-- サービスロールのみ書き込み可（Cron Job / Webhook 用）
CREATE POLICY "service_write_articles" ON articles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_write_summaries" ON summaries
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_write_logs" ON collection_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
