-- BIS: federalregister.gov の RSSエンドポイントはVercelから一貫して400を返す
-- （JSON APIは問題ない）。JSON API を使うカスタムスクレイパーに切替。
UPDATE sources
SET collector_type = 'scraper',
    scrape_url = 'https://www.federalregister.gov/api/v1/documents.json',
    feed_url = NULL
WHERE slug = 'bis';
