INSERT INTO sources (slug, name_ja, name_en, country_code, base_url, collector_type, feed_url, scrape_url) VALUES
  (
    'meti',
    '経済産業省（安全保障貿易管理）',
    'METI - Security Export Control',
    'JP',
    'https://www.meti.go.jp',
    'scraper',
    NULL,
    'https://www.meti.go.jp/policy/anpo/index.html'
  ),
  (
    'mofa',
    '外務省（制裁・資産凍結情報）',
    'MOFA - Sanctions',
    'JP',
    'https://www.mofa.go.jp',
    'scraper',
    NULL,
    'https://www.mofa.go.jp/mofaj/gaiko/huzai/index.html'
  ),
  (
    'bis',
    'BIS（産業安全保障局）',
    'Bureau of Industry and Security',
    'US',
    'https://www.bis.doc.gov',
    'rss',
    'https://www.federalregister.gov/api/v1/documents.rss?conditions%5Bagencies%5D%5B%5D=industry-and-security-bureau&conditions%5Btype%5D%5B%5D=Rule&conditions%5Btype%5D%5B%5D=Proposed+Rule&conditions%5Btype%5D%5B%5D=Notice',
    NULL
  ),
  (
    'ofac',
    'OFAC（外国資産管理局）',
    'Office of Foreign Assets Control',
    'US',
    'https://ofac.treasury.gov',
    'rss',
    'https://ofac.treasury.gov/recent-actions/rss',
    NULL
  ),
  (
    'eu-commission',
    '欧州委員会（輸出管理・二重用途規制）',
    'European Commission - Export Controls',
    'EU',
    'https://policy.trade.ec.europa.eu',
    'rss',
    'https://eur-lex.europa.eu/tools/rss.do?other=&type=qdrSimple&qid=1&locale=en',
    NULL
  ),
  (
    'cistec',
    'CISTEC（安全保障貿易情報センター）',
    'Center for Information on Security Trade Control',
    'JP',
    'https://www.cistec.or.jp',
    'scraper',
    NULL,
    'https://www.cistec.or.jp/service/export_information/index.html'
  );
