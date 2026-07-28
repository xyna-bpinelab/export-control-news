-- OFAC: RSS配信が2025年1月に廃止されたため、recent-actionsページのスクレイプに切替
UPDATE sources
SET collector_type = 'scraper',
    scrape_url = 'https://ofac.treasury.gov/recent-actions',
    feed_url = NULL
WHERE slug = 'ofac';

-- EU: eur-lex の rss.do エンドポイントが廃止（404）。policy.trade.ec.europa.eu の news RSS に切替
UPDATE sources
SET feed_url = 'https://policy.trade.ec.europa.eu/node/2/rss_en'
WHERE slug = 'eu-commission';

-- CISTEC: export_information ページが廃止（404リダイレクト）。トップページの What's New に切替
UPDATE sources
SET scrape_url = 'https://www.cistec.or.jp/'
WHERE slug = 'cistec';
